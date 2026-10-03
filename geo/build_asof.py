"""Per-date heavy-rain counts so a case can be evaluated "as of" a real date (video demo + honest history).

Writes app/public/grid/rain_asof.json:
  { "dates": ["2025-04-30", ...],              # as-of dates (every ~15 days where CHIRPS covers the 90-day window)
    "cells": [[lat, lon], ...],                # same order as plot_grid.json cells
    "rainDaysOver40mm90d": [[int per cell] per date],
    "maxDailyMm90d":       [[float per cell] per date],   # biggest single day in the window, for the demo caption
    "source": "CHIRPS v2.0 daily 0.05 deg", "note": "..." }
CHIRPS is a satellite+gauge estimate at ~5 km: it cannot see one slope (stated in the data-gaps slide).
Run after geo/build_grid.py:  uv run python geo/build_asof.py
"""
from __future__ import annotations

import json
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import build_grid as bg  # noqa: E402

OUT = Path(__file__).resolve().parents[1] / "app" / "public" / "grid" / "rain_asof.json"


def main() -> None:
    ch = bg.load_chirps()
    pts = bg.grid_points()
    all_days = sorted(d for _, days, _ in ch.values() for d in days)
    first, last = all_days[0], all_days[-1]
    dates, d = [], first + timedelta(days=89)
    while d <= last:
        dates.append(d)
        d += timedelta(days=15)
    if dates[-1] != last:
        dates.append(last)
    series = {}
    for lat, lon in pts:
        s = bg.chirps_cell(ch, lat, lon, last, n=(last - first).days + 1)  # full coverage required
        if s is None:
            raise SystemExit(f"CHIRPS missing for cell {lat},{lon}")
        series[(lat, lon)] = s
    counts, maxes = [], []
    for asof in dates:
        win = [asof - timedelta(i) for i in range(90)]
        counts.append([sum(1 for x in win if series[p][x] >= bg.HEAVY_MM) for p in pts])
        maxes.append([round(max(series[p][x] for x in win), 1) for p in pts])
    OUT.write_text(json.dumps({"dates": [x.isoformat() for x in dates], "cells": [list(p) for p in pts],
                               "rainDaysOver40mm90d": counts, "maxDailyMm90d": maxes,
                               "source": "CHIRPS v2.0 daily 0.05 deg",
                               "note": "satellite+gauge estimate, ~5 km; cannot resolve a single slope"},
                              separators=(",", ":")))
    best = max(range(len(dates)), key=lambda i: sum(counts[i]))
    print(f"{len(dates)} as-of dates {dates[0]}..{dates[-1]}, {OUT.stat().st_size / 1e3:.1f} KB; "
          f"most heavy-rain days: as-of {dates[best]} (cells with >=1 day: {sum(c > 0 for c in counts[best])}/{len(pts)}, "
          f"max single day {max(maxes[best])} mm)")


if __name__ == "__main__":
    main()
