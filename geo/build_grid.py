"""Build app/public/grid/plot_grid.json (PlotContext grid, contracts.md section 5).

Run:  uv run python geo/build_grid.py

OUTPUT FORMAT (for the app's nearest-cell lookup, implemented elsewhere in geo/lookup.ts):
  { "meta": {step, bounds, floweringWindow, ... sources},
    "cells": [ {lat, lon, rainDaysOver40mm90d, rainAnomalyFloweringPct,
                soilPh|null, soilSource|null, dataThrough, rainSource, rainAnomalySource} ] }
  Lookup: pick the cell minimising (lat-cell.lat)^2 + (lon-cell.lon)^2 (or round to the
  0.05 deg grid: lat0=-2.60, lon0=29.10). Reject (return null PlotContext) if the point is
  more than ~0.05 deg outside `meta.bounds`. Cell fields are exactly PlotContext plus the
  two *Source provenance strings (extra fields may be ignored).

ASSUMPTIONS
  * Rain: CHIRPS npz (rain_mm[day,y,x]) is used for rainDaysOver40mm90d when it covers the
    last 90 days; otherwise NASA POWER PRECTOTCORR. CHIRPS is only fetched for one year, so
    the flowering anomaly (needs 2015-2024 baseline) always uses POWER (rainAnomalySource).
  * POWER fill value -999 = missing; trailing missing days define dataThrough (last valid day).
  * iSDAsoil pH raw int, band 1 (mean_0_20), pH = raw/10 (STAC ph.json: "back-transformation": "x/10").
  * SoilGrids fallback: phh2o 0-5cm mean, value is pH*10 (needs network; skipped if offline).
"""
from __future__ import annotations

import json
import sys
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "app" / "public" / "grid" / "plot_grid.json"

# Study box; MUST match data/scripts/fetch_open_data.py
LAT_MIN, LAT_MAX = -0.62, -0.32   # Kirinyaga county, Kenya (Mutira ward is at -0.47, 37.23; D-019)
LON_MIN, LON_MAX = 37.10, 37.40
STEP = 0.05

# Flowering window, Rwandan Arabica: single main bloom after the Jun-Aug dry season,
# triggered by first rains in September; bloom Sep-Oct (NAEB, Sweet Maria's Rwanda overview,
# Harmony Coffee Rwanda guide, found by web search 2026-10-04).
# UNVERIFIED by an agronomist / RAB extension; secondary sources only. Change here if needed.
FLOWERING_START = (9, 1)    # Sep 1
FLOWERING_END = (10, 31)    # Oct 31
BASELINE_YEARS = range(2015, 2025)  # 2015-2024
HEAVY_MM = 40.0
POWER_FILL = -999.0
SOIL_FILE = RAW / "soil" / "isdasoil_study_points.json"
PH_MIN, PH_MAX = 3.0, 9.0


def grid_points():
    n_lat = int(round((LAT_MAX - LAT_MIN) / STEP)) + 1
    n_lon = int(round((LON_MAX - LON_MIN) / STEP)) + 1
    return [(round(LAT_MIN + i * STEP, 3), round(LON_MIN + j * STEP, 3))
            for i in range(n_lat) for j in range(n_lon)]


def load_power(lat, lon):
    f = RAW / "weather" / "nasa_power" / f"power_{lat}_{lon}.json"
    if not f.exists():
        return None
    p = json.loads(f.read_text())["properties"]["parameter"]["PRECTOTCORR"]
    return {datetime.strptime(k, "%Y%m%d").date(): v for k, v in p.items()}


def load_chirps():
    """Return {year: (rain[day,y,x], days, transform)} for npz files present."""
    out = {}
    for f in sorted((RAW / "weather" / "chirps").glob("chirps_daily_*_study.npz")):
        z = np.load(f)
        out[int(f.name.split("_")[2])] = (z["rain_mm"], [date.fromisoformat(str(d)) for d in z["days"]],
                                          z["transform"])
    return out


def chirps_cell(ch, lat, lon, last, n=90):
    """CHIRPS daily series for the cell (nearest pixel), or None if 90 days not covered."""
    if not ch:
        return None
    series = {}
    for rain, days, tr in ch.values():
        a, _, c, _, e, f = tr  # affine: x = a*col + c ; y = e*row + f
        col = int(np.floor((lon - c) / a)); row = int(np.floor((lat - f) / e))
        if not (0 <= row < rain.shape[1] and 0 <= col < rain.shape[2]):
            return None
        for d, v in zip(days, rain[:, row, col]):
            series[d] = float(v)
    want = [last - timedelta(days=i) for i in range(n)]
    if any(d not in series or series[d] < -100 for d in want):  # CHIRPS nodata = -9999
        return None
    return series


def window_sum(series, year, last):
    s = date(year, *FLOWERING_START)
    e = min(date(year, *FLOWERING_END), last if year == last.year else date(year, *FLOWERING_END))
    return sum(series[d] for d in (s + timedelta(i) for i in range((e - s).days + 1))
               if d in series and series[d] != POWER_FILL), e


def soil_lookup():
    d = json.loads(SOIL_FILE.read_text())
    vals = d["layers"]["ph"]["values"]
    return {(round(p["lat"], 3), round(p["lon"], 3)): v for p, v in zip(d["points"], vals)}


def soilgrids_ph(lat, lon):
    url = ("https://rest.isric.org/soilgrids/v2.0/properties/query?"
           f"lon={lon}&lat={lat}&property=phh2o&depth=0-5cm&value=mean")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "ikawa-hackathon/0.1"})
        j = json.load(urllib.request.urlopen(req, timeout=30))
        v = j["properties"]["layers"][0]["depths"][0]["values"]["mean"]
        return None if v is None else v / 10.0
    except Exception as e:  # noqa: BLE001
        print(f"  soilgrids fallback failed {lat},{lon}: {e}", file=sys.stderr)
        return None


def main():
    soil = soil_lookup()
    ch = load_chirps()
    cells, missing = [], []
    for lat, lon in grid_points():
        power = load_power(lat, lon)
        if power is None:
            missing.append((lat, lon)); continue
        valid = [d for d, v in power.items() if v != POWER_FILL]
        last = max(valid)
        # --- rain days >= 40 mm in the last 90 days (inclusive of `last`)
        # CHIRPS is published with a lag, so its last day is earlier than POWER's. Prefer CHIRPS (5 km, resolves
        # real differences between cells) over the 90 days ending at ITS last day, and record that date.
        chirps_last = max((d for _, days, _ in ch.values() for d in days), default=None)
        cs = chirps_cell(ch, lat, lon, chirps_last) if chirps_last else None
        if cs is not None:
            ser, rain_src, rain_last = cs, "chirps", chirps_last
        else:
            ser, rain_src, rain_last = power, "nasa_power", last
        days90 = [rain_last - timedelta(i) for i in range(90)]
        heavy = sum(1 for d in days90 if ser.get(d, 0) not in (None,) and ser.get(d, 0) >= HEAVY_MM)
        # --- flowering anomaly (POWER only): latest year whose window has started by `last`
        fy = last.year if date(last.year, *FLOWERING_START) <= last else last.year - 1
        cur, end = window_sum(power, fy, last)
        # baseline: same calendar days (clipped like current window)
        base = []
        for y in BASELINE_YEARS:
            s = date(y, *FLOWERING_START)
            try:
                e = date(y, end.month, end.day)
            except ValueError:
                e = date(y, end.month, 28)
            base.append(sum(power[d] for d in (s + timedelta(i) for i in range((e - s).days + 1))
                            if d in power and power[d] != POWER_FILL))
        bmean = float(np.mean(base))
        anomaly = round((cur - bmean) / bmean * 100, 1) if bmean > 0 else 0.0
        # --- soil
        ph, ph_src = None, None
        raw = soil.get((lat, lon))
        if raw and raw[0] and PH_MIN <= raw[0] / 10 <= PH_MAX:
            ph, ph_src = round(raw[0] / 10, 1), "isdasoil"
        else:
            v = soilgrids_ph(lat, lon)
            if v is not None and PH_MIN <= v <= PH_MAX:
                ph, ph_src = round(v, 1), "soilgrids"
        cells.append({"lat": lat, "lon": lon, "rainDaysOver40mm90d": int(heavy),
                      "rainAnomalyFloweringPct": anomaly, "soilPh": ph, "soilSource": ph_src,
                      "dataThrough": last.isoformat(), "rainDaysThrough": rain_last.isoformat(), "rainSource": rain_src,
                      "rainAnomalySource": "nasa_power"})
    meta = {"step": STEP, "bounds": {"latMin": LAT_MIN, "latMax": LAT_MAX, "lonMin": LON_MIN, "lonMax": LON_MAX},
            "floweringWindow": {"start": "%02d-%02d" % FLOWERING_START, "end": "%02d-%02d" % FLOWERING_END,
                                "verified": False, "baseline": "2015-2024 same calendar days"},
            "soilPhBackTransform": "isdasoil raw/10 (band mean_0_20); soilgrids phh2o/10 (0-5cm)",
            "builtOn": date.today().isoformat(), "chirpsYears": sorted(ch),
            "missingPowerCells": missing}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"meta": meta, "cells": cells}, separators=(",", ":")))
    print(f"{len(cells)} cells, {OUT.stat().st_size} bytes, missing POWER: {len(missing)}")
    from collections import Counter
    print("rain sources:", Counter(c["rainSource"] for c in cells),
          "soil sources:", Counter(c["soilSource"] for c in cells))


if __name__ == "__main__":
    main()
