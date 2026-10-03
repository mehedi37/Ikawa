"""Build app/public/prices/prices.json from WFP Rwanda food prices (maize and beans only).

Run:  uv run python geo/build_prices.py
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
SRC = ROOT / "data" / "raw" / "prices" / "wfp_food_prices_rwa.csv"
OUT = ROOT / "app" / "public" / "prices" / "prices.json"
KEEP = {"Maize": "maize", "Beans": "beans"}


def main():
    rows = [r for r in csv.DictReader(SRC.open(encoding="utf-8")) if not r["date"].startswith("#")]
    commodities = {r["commodity"] for r in rows}
    coffee = sorted(c for c in commodities if "coffee" in c.lower())
    print("coffee commodities in WFP Rwanda:", coffee or "NONE (confirmed)")
    assert not coffee, "unexpected coffee rows; revisit D-008"
    series: dict = {}
    for r in rows:
        if r["commodity"] not in KEEP or not r["price"]:
            continue
        key = (r["market"], KEEP[r["commodity"]], r["pricetype"], r["unit"], r["currency"])
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
    doc = {"source": "WFP food prices Rwanda (HDX), no coffee in dataset",
           "dataThrough": dmax, "coffee": None, "rows": out_rows}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(doc, separators=(",", ":")))
    print(f"{len(out_rows)} market-commodity rows, through {dmax}, {OUT.stat().st_size} bytes")


if __name__ == "__main__":
    main()
