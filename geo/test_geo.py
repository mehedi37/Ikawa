"""Sanity tests: uv run python -m pytest geo/test_geo.py  (needs `uv add --dev pytest`)."""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GRID = ROOT / "app" / "public" / "grid" / "plot_grid.json"
PRICES = ROOT / "app" / "public" / "prices" / "prices.json"


def _nums(o):
    if isinstance(o, dict):
        for v in o.values():
            yield from _nums(v)
    elif isinstance(o, list):
        for v in o:
            yield from _nums(v)
    elif isinstance(o, float):
        yield o


def test_grid_size_and_count():
    assert GRID.stat().st_size <= 300 * 1024
    d = json.loads(GRID.read_text())
    assert len(d["cells"]) == 49  # 7 lat x 7 lon at 0.05 deg


def test_grid_values():
    for c in json.loads(GRID.read_text())["cells"]:
        assert c["rainDaysOver40mm90d"] >= 0
        assert c["rainSource"] in ("chirps", "nasa_power")
        assert -100 <= c["rainAnomalyFloweringPct"] < 1000
        if c["soilPh"] is None:
            assert c["soilSource"] is None
        else:
            assert 3 <= c["soilPh"] <= 9 and c["soilSource"] in ("isdasoil", "soilgrids")
        assert len(c["dataThrough"]) == 10


def test_no_nan():
    for p in (GRID, PRICES):
        assert all(math.isfinite(x) for x in _nums(json.loads(p.read_text())))


def test_prices():
    d = json.loads(PRICES.read_text())
    assert d["coffee"] is None
    assert {r["commodity"] for r in d["rows"]} <= {"maize", "beans"}
    assert all(r["latestPrice"] > 0 and r["median12m"] > 0 for r in d["rows"])
