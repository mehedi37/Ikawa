"""Fetch the small, open (non-Kaggle) datasets Ikawa needs into data/raw/.

Idempotent: every step skips files that already exist, so it is safe to re-run
after an interruption.

    uv run python data/scripts/fetch_open_data.py            # everything
    uv run python data/scripts/fetch_open_data.py power wfp  # selected steps

Study area: Kirinyaga county, central Kenya (Mt Kenya coffee belt), docs/decisions.md D-019.
"""

from __future__ import annotations

import gzip
import json
import shutil
import sys
import time
import urllib.error
import urllib.request
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"

# Study-area box (lon/lat, WGS84). Lake Kivu lies west of ~29.10E, so stay east of it.
LAT_MIN, LAT_MAX = -0.62, -0.32   # Kirinyaga county, Kenya (Mutira ward is at -0.47, 37.23; D-019)
LON_MIN, LON_MAX = 37.10, 37.40
GRID_STEP = 0.05  # ~5.5 km, matches CHIRPS resolution


def grid_points() -> list[tuple[float, float]]:
    pts = []
    lat = LAT_MIN
    while lat <= LAT_MAX + 1e-9:
        lon = LON_MIN
        while lon <= LON_MAX + 1e-9:
            pts.append((round(lat, 3), round(lon, 3)))
            lon += GRID_STEP
        lat += GRID_STEP
    return pts


def download(url: str, dest: Path, retries: int = 3) -> Path:
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "ikawa-hackathon/0.1"})
            with urllib.request.urlopen(req, timeout=120) as r, open(tmp, "wb") as f:
                shutil.copyfileobj(r, f)
            tmp.rename(dest)
            return dest
        except urllib.error.HTTPError as e:
            if e.code == 404:  # file does not exist (e.g. CHIRPS days not published yet): do not retry
                raise FileNotFoundError(url) from e
            print(f"  retry {attempt}/{retries} {url}: {e}")
            time.sleep(3 * attempt)
        except Exception as e:  # noqa: BLE001 - report and retry any network error
            print(f"  retry {attempt}/{retries} {url}: {e}")
            time.sleep(3 * attempt)
    raise RuntimeError(f"failed: {url}")


def step_wfp() -> None:
    """WFP food prices, Rwanda (HDX). Note: contains maize/beans but NO coffee."""
    url = ("https://data.humdata.org/dataset/a4a84c1c-81d1-491b-9fbe-1955ae736508/resource/"
           "8c22eeb5-cc2e-46bc-8a0d-08b7486b2486/download/wfp_food_prices_rwa.csv")
    download(url, RAW / "prices" / "wfp_food_prices_rwa.csv")
    url_m = ("https://data.humdata.org/dataset/a4a84c1c-81d1-491b-9fbe-1955ae736508/resource/"
             "31d038ef-416e-4c66-906f-54de20794918/download/wfp_markets_rwa.csv")
    download(url_m, RAW / "prices" / "wfp_markets_rwa.csv")
    print("wfp: ok")


def step_faostat() -> None:
    """FAOSTAT crops & livestock, Africa (bulk; the REST API now needs a token)."""
    url = "https://bulks-faostat.fao.org/production/Production_Crops_Livestock_E_Africa.zip"
    download(url, RAW / "faostat" / "Production_Crops_Livestock_E_Africa.zip")
    print("faostat: ok")


def step_power() -> None:
    """NASA POWER daily rain (PRECTOTCORR) + temperature per grid point, 2015-01-01 → today."""
    out_dir = RAW / "weather" / "nasa_power"
    end = date.today().strftime("%Y%m%d")
    for lat, lon in grid_points():
        dest = out_dir / f"power_{lat}_{lon}.json"
        if dest.exists():
            continue
        url = ("https://power.larc.nasa.gov/api/temporal/daily/point?"
               "parameters=PRECTOTCORR,T2M,T2M_MAX,T2M_MIN,RH2M&community=AG"
               f"&longitude={lon}&latitude={lat}&start=20150101&end={end}&format=JSON")
        download(url, dest)
        time.sleep(0.5)  # be polite to the API
    print(f"power: {len(list(out_dir.glob('*.json')))} points")


def step_chirps(year: int = 2025) -> None:
    """CHIRPS v2 Africa daily (0.05°), clipped to the study box → one small .npz per year."""
    import numpy as np
    import rasterio
    from rasterio.windows import from_bounds

    out = RAW / "weather" / "chirps" / f"chirps_daily_{year}_study.npz"
    if out.exists():
        print(f"chirps {year}: exists")
        return
    tmp_dir = RAW / "weather" / "chirps" / "_tmp"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    # 1) download every day in parallel (the files are ~1 MB each; the server is the bottleneck, not us)
    from concurrent.futures import ThreadPoolExecutor
    dates = []
    d = date(year, 1, 1)
    while d.year == year:
        dates.append(d)
        d += timedelta(days=1)

    def get(day: date):
        name = f"chirps-v2.0.{day:%Y.%m.%d}.tif.gz"
        url = f"https://data.chc.ucsb.edu/products/CHIRPS-2.0/africa_daily/tifs/p05/{year}/{name}"
        try:
            return day, download(url, tmp_dir / name)
        except FileNotFoundError:
            return day, None  # not published yet

    with ThreadPoolExecutor(max_workers=12) as ex:
        got = list(ex.map(get, dates))
    # 2) clip each to the study box, in date order, stopping at the first unpublished day
    days, arrays, transform = [], [], None
    for day, gz in got:
        if gz is None:
            print(f"  chirps {year}: data ends before {day} (not published yet)")
            break
        tif = gz.with_suffix("")
        with gzip.open(gz) as fi, open(tif, "wb") as fo:
            shutil.copyfileobj(fi, fo)
        with rasterio.open(tif) as src:
            win = from_bounds(LON_MIN - 0.05, LAT_MIN - 0.05, LON_MAX + 0.05, LAT_MAX + 0.05, src.transform)
            arrays.append(src.read(1, window=win))
            transform = src.window_transform(win)
        gz.unlink()
        tif.unlink()
        days.append(day.isoformat())
    np.savez_compressed(out, rain_mm=np.stack(arrays), days=np.array(days),
                        transform=np.array(transform)[:6])
    shutil.rmtree(tmp_dir, ignore_errors=True)
    print(f"chirps {year}: {len(days)} days → {out.name}")


def step_soil() -> None:
    """iSDAsoil (30 m, Africa) pH / N / organic carbon sampled at every grid point via HTTP range reads."""
    import rasterio
    from rasterio.warp import transform as warp_transform

    dest = RAW / "soil" / "isdasoil_study_points.json"
    if dest.exists():
        print("soil: exists")
        return
    layers = {"ph": "ph", "nitrogen_total": "nitrogen_total", "carbon_organic": "carbon_organic"}
    pts = grid_points()
    result: dict = {"source": "iSDAsoil (isdasoil.s3.amazonaws.com), 30 m, predicted values",
                    "points": [{"lat": la, "lon": lo} for la, lo in pts], "layers": {}}
    for key, layer in layers.items():
        url = f"/vsicurl/https://isdasoil.s3.amazonaws.com/soil_data/{layer}/{layer}.tif"
        with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR"):
            with rasterio.open(url) as src:
                xs, ys = warp_transform("EPSG:4326", src.crs, [lo for _, lo in pts], [la for la, _ in pts])
                vals = [list(map(float, v)) for v in src.sample(zip(xs, ys))]
                result["layers"][key] = {"band_descriptions": list(src.descriptions),
                                         "scale_note": "raw stored values; see iSDAsoil docs for back-transform",
                                         "values": vals}
        print(f"soil {key}: ok")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(result, indent=1))


def step_chirps_2026() -> None:
    step_chirps(2026)


STEPS = {"wfp": step_wfp, "faostat": step_faostat, "power": step_power,
         "soil": step_soil, "chirps": step_chirps, "chirps2026": step_chirps_2026}

if __name__ == "__main__":
    chosen = sys.argv[1:] or list(STEPS)
    for name in chosen:
        print(f"== {name}")
        try:
            STEPS[name]()
        except Exception as e:  # noqa: BLE001 - keep going so one failure doesn't block the rest
            print(f"!! {name} failed: {e}")
