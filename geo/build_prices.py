"""Build app/public/prices/prices.json from WFP food prices (maize and beans only).

Run:  uv run python geo/build_prices.py [ken|rwa]     (default ken: Kenya, D-019)
Per market+commodity: latest date, latest price, 12-month median (12 months before the
latest date of that series), unit, currency. Retail preferred; Wholesale used only where a
market has no Retail series for that commodity (pricetype recorded). No coffee in this dataset.
"""
from __future__ import annotations

import csv
import json
import statistics
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
import sys
COUNTRY = (sys.argv[1] if len(sys.argv) > 1 else "ken").lower()
SRC = ROOT / "data" / "raw" / "prices" / f"wfp_food_prices_{COUNTRY}.csv"
MARKETS = ROOT / "data" / "raw" / "prices" / f"wfp_markets_{COUNTRY}.csv"
OUT = ROOT / "app" / "public" / "prices" / "prices.json"
STUDY_POINT = (-0.47, 37.23)  # Mutira ward, Kirinyaga (D-019)
MAX_KM = 150                  # keep the file small: only markets a farmer could plausibly compare with


def commodity_key(name: str) -> str | None:
    """WFP names differ by country ('Maize (white)', 'Beans (rosecoco)'...). Grain only: no flour."""
    n = name.lower()
    if n.startswith("maize") and "flour" not in n:
        return "maize"
    if n.startswith("beans"):
        return "beans"
    return None


def main():
    rows = [r for r in csv.DictReader(SRC.open(encoding="utf-8")) if not r["date"].startswith("#")]
    commodities = {r["commodity"] for r in rows}
    coffee = sorted(c for c in commodities if "coffee" in c.lower())
    print(f"coffee commodities in WFP {COUNTRY}:", coffee or "NONE (confirmed)")
    assert not coffee, "unexpected coffee rows; revisit D-008"
    series: dict = {}
    for r in rows:
        com = commodity_key(r["commodity"])
        if com is None or not r["price"]:
            continue
        key = (r["market"], com, r["pricetype"], r["unit"], r["currency"])
        series.setdefault(key, []).append((date.fromisoformat(r["date"]), float(r["price"]),
                                           r["admin1"], r["admin2"]))
    best: dict = {}
    for (market, com, ptype, unit, cur), pts in series.items():
        pts.sort()
        cand = (ptype == "Retail", pts[-1][0], ptype, unit, cur, pts)
        k = (market, com)
        if k not in best or cand[:2] > best[k][:2]:
            best[k] = cand
    out_rows = []
    for (market, com), (_, _, ptype, unit, cur, pts) in sorted(best.items()):
        last_d, last_p, adm1, adm2 = pts[-1]
        cutoff = date(last_d.year - 1, last_d.month, 1)
        win = [p for d, p, *_ in pts if d > cutoff]
        out_rows.append({"market": market, "district": adm2, "province": adm1, "commodity": com,
                         "priceType": ptype, "unit": unit, "currency": cur,
                         "latestDate": last_d.isoformat(), "latestPrice": round(last_p, 1),
                         "median12m": round(statistics.median(win), 1), "nObs12m": len(win)})
    dmax = max(r["latestDate"] for r in out_rows)
    for r in out_rows:  # series with no data in the 24 months before dmax are flagged, not dropped
        r["stale"] = r["latestDate"] < date(int(dmax[:4]) - 2, int(dmax[5:7]), 1).isoformat()
    # nearest market to the study area (great-circle distance from the WFP market list)
    import math
    coords = {}
    if MARKETS.exists():
        for m in csv.DictReader(MARKETS.open(encoding="utf-8")):
            try:
                coords[m["market"]] = (float(m["latitude"]), float(m["longitude"]))
            except (KeyError, ValueError):
                pass
    def km(a, b):
        la1, lo1, la2, lo2 = map(math.radians, (*a, *b))
        h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
        return 6371 * 2 * math.asin(math.sqrt(h))
    for r in out_rows:
        r["distanceKm"] = round(km(STUDY_POINT, coords[r["market"]])) if r["market"] in coords else None
    with_d = [r for r in out_rows if r["distanceKm"] is not None]
    nearest = min(with_d, key=lambda r: r["distanceKm"])["market"] if with_d else None
    doc = {"source": f"WFP food prices {COUNTRY.upper()} (HDX); no coffee in this dataset",
           "country": COUNTRY, "dataThrough": dmax, "coffee": None,
           "studyPoint": STUDY_POINT, "nearestMarket": nearest,
           "note": "No WFP market inside Kirinyaga; the nearest market's series may be stale (see 'stale').",
           "maxDistanceKm": MAX_KM,
           "rows": sorted([r for r in out_rows if r["distanceKm"] is not None and r["distanceKm"] <= MAX_KM],
                          key=lambda r: (r["distanceKm"], r["commodity"]))}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(doc, separators=(",", ":")))
    print(f"{len(out_rows)} market-commodity rows, through {dmax}, {OUT.stat().st_size} bytes")


if __name__ == "__main__":
    main()
