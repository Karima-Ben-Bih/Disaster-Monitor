# Rapid Disaster Monitor: template

One repository per disaster. Edit **one file** (`event.json`) and GitHub builds and publishes a situational-overview website for you. It refreshes every 30 minutes and can be password-protected.

**What the site shows (earthquake module)**

| Tab | Content | Source |
|---|---|---|
| Overview | Headline figures, hazard summary, PAGER alerts, aftershock summary, latest updates, population exposed by intensity | USGS + your curated data |
| Map | Epicentre, ShakeMap intensity contours, aftershocks (red = last 24 h) | USGS |
| Aftershocks | Daily count chart, latest 100 events, "refresh live" button (also auto-refreshes every 5 min in the browser) | USGS |
| Impacts | Full table of reported figures with sources | Your curated data |
| Updates | Timeline of key developments | Your curated data |
| Sources & methods | Links, disclaimer, method notes | Automatic |

Bilingual English/Spanish, works on phones, single self-contained page.

---

## Part A: one-time setup (about 20 minutes, on a laptop)

**1. Get a GitHub account.** Sign up at github.com. For official GFDRR or World Bank use, check with ITS whether this should live under the Bank's GitHub organization instead (see "Before you use this for real" below).

**2. Create the repository.**
- Click **+** (top right) → **New repository**.
- Name: for example `disaster-monitor-template`. Visibility: **Public**. A free account can only publish public repositories to GitHub Pages.
- Tick **Add a README file**, then click **Create repository**.

**3. Upload the files.**
- Unzip `disaster-monitor-template.zip` on your computer.
- In the repository, click **Add file → Upload files**.
- Drag in **`event.json`**, **`README.md`** and the **`src`**, **`scripts`** and **`data`** folders. Folders keep their structure when dragged in Chrome or Edge.
- Click **Commit changes**.

**4. Add the automation file.** The `.github` folder is hidden on most computers, so create this file by hand:
- Click **Add file → Create new file**.
- In the name box, type exactly: `.github/workflows/monitor.yml`. GitHub creates the folders as you type each `/`.
- Open `setup/monitor.yml` from the zip in any text editor (it is the same file, in a visible folder), copy everything and paste it in.
- Click **Commit changes**.

**5. Turn on GitHub Pages.** Go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.

**6. Set the password (optional but recommended).** Go to **Settings → Secrets and variables → Actions → New repository secret**.
- Name: `SITE_PASSWORD`. Value: your access code.
- Without this secret, the site publishes with no password.

**7. Run it.** Go to the **Actions** tab. If asked, click "I understand my workflows, enable them". Then select **Update and publish monitor → Run workflow**. After about 2 minutes, your site is live at:
`https://YOUR-USERNAME.github.io/disaster-monitor-template/`

The demo uses the February 2023 Türkiye earthquake so you can check that everything works.

**8. Make it a template.** Go to **Settings → General** and tick **Template repository**.

---

## Part B: activating for a new disaster (about 10 minutes)

1. On the template repository, click **Use this template → Create a new repository**. Name it after the event, for example `pan-eq-2026`, and make it public.
2. Repeat steps 5 and 6 from Part A for the new repository: turn on Pages and set the password.
3. Find the USGS event ID. Open the event on earthquake.usgs.gov. The ID is in the address: `.../eventpage/`**`us7000abcd`**.
4. Edit `event.json` by clicking the file, then the pencil icon:
   - `usgs_id`: the ID from step 3. Everything else from USGS fills in automatically.
   - `title`, `country`, `local_timezone` (for example `America/Panama`), `languages`.
   - `aftershocks`: search radius in km, minimum magnitude, number of days.
   - `official_sources`: the national agency websites.
5. Click **Commit changes**. The site rebuilds within about 2 minutes, then every 30 minutes after that.

---

## Part C: curating impacts and updates without touching code

**Option 1 (recommended): Google Sheet.**
1. Create a sheet with two tabs. Use these exact column headers in row 1:
   - **impacts**: `date, category, value, area, source, url, note`
   - **updates**: `time_utc, text, source, url`
2. Go to **File → Share → Publish to web**. Choose the *impacts* tab and *Comma-separated values (.csv)*, then click **Publish** and copy the link. Do the same for *updates*.
3. In the repository, go to **Settings → Secrets → Actions** and add the links as secrets named `IMPACTS_CSV_URL` and `UPDATES_CSV_URL`. Storing them as secrets keeps the sheet links out of the public repository.
4. The team edits the sheet. The site picks up changes at the next refresh, within 30 minutes. To publish immediately, use **Actions → Run workflow**.

**Option 2: edit the CSV files in `data/` on GitHub.** This is quicker to set up, but these files are visible to anyone who finds the repository.

**How the rows are used**
- On the Overview tab, the most recent row (by `date`) for each `category` becomes a headline figure, for example "Deaths", "Displaced", "Houses damaged" or "Schools affected". Keep category names consistent.
- Rows whose first cell starts with `#` are ignored. Use this for notes or for figures not yet verified.
- `value` can include commas (`1,234`).

---

## Before you use this for real

- **The password is light protection.** StaticCrypt encrypts the page itself, but anyone with the link and the code can read everything. A free account also means a **public repository**, so anything in `event.json` and `data/*.csv` is visible there. Keep sensitive or official-use material out of it. For restricted content, use a private repository on GitHub Enterprise (ask whether the Bank's organization allows it) or a host with real sign-in.
- **Branding and status.** The page says "Unofficial situational overview". Keep that unless your unit clears it as an official product.
- **Scheduled runs.** GitHub can delay the 30-minute schedule at busy times. It switches schedules off in repositories with no activity for 60 days, which is fine because events end. The browser's live aftershock refresh is unaffected.
- **PAGER and ShakeMap** appear once USGS publishes them, usually within 30 to 60 minutes of a large event, and they are updated over the following days. The site picks up new versions automatically.

---

## How it works

```
event.json ─┐
            ├─ scripts/fetch_data.py  → data/*.json  (USGS + Google Sheet, Python standard library only)
Sheets ─────┘
src/ (html, css, js) + data → scripts/build.py → dist/index.html (one self-contained file)
                                             → StaticCrypt (if SITE_PASSWORD) → GitHub Pages
```
The whole pipeline is `.github/workflows/monitor.yml`. It runs on every change, every 30 minutes, and when you click **Run workflow**.

**Preview on your own computer** (needs Python 3): run `python scripts/fetch_data.py && python scripts/build.py`, then open `dist/index.html`.

## Roadmap: next modules

| Module | Data feeds | Status |
|---|---|---|
| Earthquake | USGS event, ShakeMap, PAGER, FDSN aftershocks | Included |
| Tropical cyclone | GDACS, NHC/JTWC advisories, wind swath | Next |
| Flood | GloFAS, Copernicus EMS rapid mapping | Next |
| Exposure pack | Admin boundaries, WorldPop, building footprints, intersected with the hazard footprint to give a district table | Next |
| Review gate | Scheduled AI curation opens a pull request; a named reviewer approves it before it goes live | Next |

To add a hazard, write a `fetch_<hazard>()` function in `scripts/fetch_data.py` and set `"hazard"` in `event.json`. The curated tabs already work for any hazard.
