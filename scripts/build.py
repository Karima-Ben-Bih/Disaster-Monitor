#!/usr/bin/env python3
"""Bundle the site into ONE self-contained file: dist/index.html.

Styles, script, event settings and all data are inlined, so when the page is
password-protected (StaticCrypt) everything on it is encrypted together.
"""
import csv
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC, DATA, DIST = ROOT / "src", ROOT / "data", ROOT / "dist"


def read_json(path, default=None):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def read_csv(path):
    """CSV -> list of dicts. Skips blank rows and rows whose first cell starts with '#'."""
    if not path.exists():
        return []
    with path.open(encoding="utf-8-sig", newline="") as f:
        rows = []
        for row in csv.DictReader(f):
            vals = [(v or "").strip() for v in row.values() if isinstance(v, str)]
            if not any(vals) or vals[0].startswith("#"):
                continue
            rows.append({(k or "").strip().lower(): (v or "").strip() for k, v in row.items() if isinstance(v, str)})
        return rows


def main():
    payload = {
        "event": read_json(ROOT / "event.json", {}),
        "usgs": read_json(DATA / "usgs.json"),
        "shakemap": read_json(DATA / "shakemap_mmi.json"),
        "aftershocks": read_json(DATA / "aftershocks.json", {"items": []}),
        "impacts": read_csv(DATA / "impacts.csv"),
        "updates": read_csv(DATA / "updates.csv"),
        "built_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    # "</" must not appear inside an inline <script>
    data_js = "window.MONITOR_DATA = " + json.dumps(payload, ensure_ascii=False).replace("</", "<\\/") + ";"

    title = (payload["event"].get("title") or {}).get(
        (payload["event"].get("languages") or ["en"])[0], "Disaster monitor")
    html = (SRC / "index.html").read_text(encoding="utf-8")
    html = html.replace("__TITLE__", title.replace("&", "&amp;").replace("<", "&lt;"))
    html = html.replace("/*__CSS__*/", (SRC / "style.css").read_text(encoding="utf-8"))
    html = html.replace("/*__APP__*/", (SRC / "app.js").read_text(encoding="utf-8"))
    html = html.replace("/*__DATA__*/", data_js)  # last, so data text is never re-scanned

    DIST.mkdir(exist_ok=True)
    (DIST / "index.html").write_text(html, encoding="utf-8")
    print(f"[build] dist/index.html ({len(html) // 1024} KB) - "
          f"{len(payload['aftershocks'].get('items', []))} aftershocks, "
          f"{len(payload['impacts'])} impact rows, {len(payload['updates'])} updates")


if __name__ == "__main__":
    main()
