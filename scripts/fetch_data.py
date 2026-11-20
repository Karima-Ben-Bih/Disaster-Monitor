#!/usr/bin/env python3
"""Fetch hazard data for the event defined in event.json and save it to data/.

Uses only the Python standard library, so it runs on GitHub Actions with no installs.
If a source is unreachable, the previous file is kept and the build continues.

Earthquake module (USGS):
  - event summary (magnitude, depth, location, time, PAGER alert, felt reports)
  - ShakeMap intensity (MMI) contours
  - PAGER population exposure by intensity, if published
  - aftershocks within a radius of the epicentre
Optional: curated impacts/updates CSVs published from a Google Sheet.
"""
import csv
import io
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
UA = {"User-Agent": "disaster-monitor-template (GitHub Pages)"}
USGS_DETAIL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/{id}.geojson"
USGS_QUERY = "https://earthquake.usgs.gov/fdsnws/event/1/query"


def log(msg):
    print(f"[fetch] {msg}", flush=True)


def get(url, as_json=True, timeout=60):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
    return json.loads(raw) if as_json else raw.decode("utf-8-sig")


def save_json(name, obj):
    DATA.mkdir(exist_ok=True)
    (DATA / name).write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    log(f"wrote data/{name}")


def iso(ms):
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def first_product(props, name):
    prods = (props.get("products") or {}).get(name) or []
    return prods[0] if prods else None


def find_content(product, *needles):
    """Return the URL of the first product file whose path contains every needle."""
    for path, meta in (product.get("contents") or {}).items():
        if all(n in path for n in needles):
            return meta.get("url")
    return None


def fetch_earthquake(cfg):
    eid = cfg.get("usgs_id", "").strip()
    if not eid:
        log("no usgs_id in event.json - skipping earthquake module")
        return
    detail = get(USGS_DETAIL.format(id=eid))
    p = detail["properties"]
    lon, lat, depth = detail["geometry"]["coordinates"]
    summary = {
        "id": eid,
        "title": p.get("title"),
        "place": p.get("place"),
        "mag": p.get("mag"),
        "mag_type": p.get("magType"),
        "time_utc": iso(p["time"]),
        "lat": lat,
        "lon": lon,
        "depth_km": depth,
        "alert": p.get("alert"),          # PAGER: green / yellow / orange / red
        "tsunami": p.get("tsunami"),      # 1 = tsunami flag in NOAA region
        "felt": p.get("felt"),            # Did You Feel It? responses
        "max_mmi": p.get("mmi"),
        "url": p.get("url"),
        "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "pager": None,
        "shakemap_image": None,
    }

    # ShakeMap intensity contours
    sm = first_product(p, "shakemap")
    if sm:
        summary["shakemap_image"] = find_content(sm, "intensity", ".jpg")
        url = find_content(sm, "cont_mmi", ".json")
        if url:
            try:
                save_json("shakemap_mmi.json", get(url))
            except Exception as e:  # noqa: BLE001
                log(f"ShakeMap contours unavailable: {e}")

    # PAGER exposure and alert levels (best effort - structure varies by version)
    pg = first_product(p, "losspager")
    if pg:
        pager = {"alert": (pg.get("properties") or {}).get("alertlevel"), "exposure": None,
                 "fatality_alert": None, "economic_alert": None}
        url = find_content(pg, "exposures.json")
        if url:
            try:
                ex = get(url).get("population_exposure", {})
                agg = ex.get("aggregated_exposure")
                mmi = ex.get("mmi") or list(range(1, len(agg or []) + 1))
                if agg:
                    pager["exposure"] = [{"mmi": int(m), "population": int(v)} for m, v in zip(mmi, agg)]
            except Exception as e:  # noqa: BLE001
                log(f"PAGER exposure unavailable: {e}")
        url = find_content(pg, "alerts.json")
        if url:
            try:
                al = get(url)
                pager["fatality_alert"] = (al.get("fatality") or {}).get("level")
                pager["economic_alert"] = (al.get("economic") or {}).get("level")
            except Exception as e:  # noqa: BLE001
                log(f"PAGER alerts unavailable: {e}")
        summary["pager"] = pager

    save_json("usgs.json", summary)

    # Aftershocks
    a = cfg.get("aftershocks", {})
    start = datetime.fromtimestamp(p["time"] / 1000, tz=timezone.utc)
    end = min(datetime.now(timezone.utc), start + timedelta(days=a.get("days", 30)))
    q = urllib.parse.urlencode({
        "format": "geojson",
        "starttime": start.strftime("%Y-%m-%dT%H:%M:%S"),
        "endtime": end.strftime("%Y-%m-%dT%H:%M:%S"),
        "latitude": lat,
        "longitude": lon,
        "maxradiuskm": a.get("radius_km", 250),
        "minmagnitude": a.get("min_magnitude", 3.0),
        "orderby": "time-asc",
    })
    feed = get(f"{USGS_QUERY}?{q}")
    quakes = []
    for f in feed.get("features", []):
        if f["id"] == eid:
            continue
        fp, (flon, flat, fdep) = f["properties"], f["geometry"]["coordinates"]
        quakes.append([iso(fp["time"]), fp.get("mag"), round(flat, 4), round(flon, 4),
                       round(fdep or 0, 1), fp.get("place"), f["id"]])
    save_json("aftershocks.json", {"fields": ["time_utc", "mag", "lat", "lon", "depth_km", "place", "id"],
                                   "query": a, "items": quakes})


def fetch_csv(url, name):
    """Download a CSV published from Google Sheets (File > Share > Publish to web > CSV)."""
    if not url:
        return
    text = get(url, as_json=False)
    rows = list(csv.reader(io.StringIO(text)))
    if not rows:
        raise ValueError("empty CSV")
    (DATA / name).write_text(text, encoding="utf-8")
    log(f"wrote data/{name} ({len(rows) - 1} rows)")


def main():
    cfg = json.loads((ROOT / "event.json").read_text(encoding="utf-8"))
    hazard = cfg.get("hazard", "earthquake")
    steps = []
    if hazard == "earthquake":
        steps.append(("earthquake (USGS)", lambda: fetch_earthquake(cfg)))
    else:
        log(f"hazard '{hazard}' has no automatic module yet - curated data only")
    # Sheet links can be kept out of the (public) repo as GitHub secrets: IMPACTS_CSV_URL, UPDATES_CSV_URL
    impacts_url = os.environ.get("IMPACTS_CSV_URL") or cfg.get("impacts_csv_url", "")
    updates_url = os.environ.get("UPDATES_CSV_URL") or cfg.get("updates_csv_url", "")
    steps.append(("impacts CSV", lambda: fetch_csv(impacts_url, "impacts.csv")))
    steps.append(("updates CSV", lambda: fetch_csv(updates_url, "updates.csv")))

    failures = 0
    for name, fn in steps:
        try:
            fn()
        except Exception as e:  # noqa: BLE001
            failures += 1
            log(f"WARNING: {name} failed ({e}); keeping previous data")
    log("done" if not failures else f"done with {failures} warning(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
