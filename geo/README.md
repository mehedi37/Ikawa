# geo/ - data prep for Ikawa

Re-run (from project root; needs data/raw filled by `data/scripts/fetch_open_data.py`):

    uv run python geo/build_grid.py     # -> app/public/grid/plot_grid.json   (~10 KB)
    uv run python geo/build_prices.py   # -> app/public/prices/prices.json    (~26 KB)
    uv run --with pytest python -m pytest geo/test_geo.py

## Grid (PlotContext, contracts.md section 5)
49 cells, 0.05 deg step over lat -2.60..-2.30, lon 29.10..29.40. Each cell has the PlotContext
fields plus `rainSource` and `rainAnomalySource` (provenance). `meta` records window, bounds, sources.
- rainDaysOver40mm90d: days >= 40 mm in the 90 days ending at `dataThrough`. CHIRPS npz if one
  covering those 90 days exists, else NASA POWER PRECTOTCORR (mm/day).
- rainAnomalyFloweringPct: (window rain - mean of 2015-2024 same calendar days) / mean * 100.
  Window = Sep 1 - Oct 31 (constants FLOWERING_START/END in build_grid.py), latest year whose window has
  started; clipped to `dataThrough` and baseline clipped the same way. Always POWER (CHIRPS only has one year).
  Window is UNVERIFIED: from secondary sources (NAEB, Sweet Maria's, Harmony Coffee): single bloom after the
  Jun-Aug dry season, first rains in September.
- soilPh: iSDAsoil band 1 (mean 0-20 cm), pH = raw / 10 (STAC ph.json: `"back-transformation": "x/10"`).
  SoilGrids phh2o 0-5 cm (value/10) fallback when iSDA is missing or outside 3-9. Else null.
- dataThrough: last POWER day with a non -999 value (POWER lags ~3 days).

## Known gaps
- No CHIRPS file yet: all rain is NASA POWER. POWER is ~0.5 deg resolution, so all 49 cells share the
  same rain series (identical anomaly, rainDays); heavy-rain day counts are also smoothed low (0 here).
  Rebuild after CHIRPS lands to get per-cell heavy-rain days (anomaly stays POWER).
- Cell (-2.3, 29.1) has soilPh null (iSDA nodata, likely Lake Kivu; SoilGrids call timed out).
- Prices: no coffee in WFP (asserted in code). Retail preferred, Wholesale fallback (`priceType`).
  Units KG, currency RWF. 12m median = observations in the 12 months before that series' latest date.
  Many markets stopped reporting; those rows have `stale: true` (latest older than 2 years before dataThrough).
