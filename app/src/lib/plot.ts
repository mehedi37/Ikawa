import type { PlotContext } from '../adapters'
// Plot data = nearest cell of public/grid/plot_grid.json ({meta, cells}) plus, for the chosen as-of date,
// the rain numbers from public/grid/rain_asof.json ({dates[], cells[[lat,lon]], rainDaysOver40mm90d[date][cell], maxDailyMm90d[date][cell]}).

export interface Area { lat: number; lon: number; kind: 'gps' | 'demo' }
/** Demo area: Mutira, Kirinyaga (JMuBEN was photographed here). */
export const DEMO_AREA = { lat: -0.47, lon: 37.23 }
export const DEMO_AREA_NAME = 'Mutira, Kirinyaga'
export const DEMO_SHORTCUT_DATE = '2026-05-15' // "After the April 2026 heavy rains": nearest available as-of date

export interface PlotExtra { maxDailyMm: number | null; rainAsOf: string | null }
interface Bounds { latMin: number; latMax: number; lonMin: number; lonMax: number }
interface Rain { dates: string[]; cells: [number, number][]; rainDaysOver40mm90d: number[][]; maxDailyMm90d: number[][] }

let grid: PlotContext[] | null | undefined
let bounds: Bounds | null = null
let rain: Rain | null | undefined

export const round2 = (x: number) => Math.round(x * 100) / 100
const fetchJson = async (name: string): Promise<unknown | null> => {
  try {
    const r = await fetch(import.meta.env.BASE_URL + name)
    if (!r.ok || (r.headers.get('content-type') ?? '').includes('text/html')) return null
    return await r.json()
  } catch { return null }
}

export async function loadGrid(): Promise<PlotContext[] | null> {
  if (grid !== undefined) return grid
  const j = (await fetchJson('grid/plot_grid.json')) as { meta?: { bounds?: Bounds }; cells?: PlotContext[] } | PlotContext[] | null
  const list = Array.isArray(j) ? j : Array.isArray(j?.cells) ? j.cells : []
  grid = list.length ? list : null
  bounds = (!Array.isArray(j) && j?.meta?.bounds) || null
  if (!grid) grid = undefined // allow a retry later (e.g. first load offline before the cache is warm)
  return grid ?? null
}
export async function loadRain(): Promise<Rain | null> {
  if (rain !== undefined) return rain
  const j = (await fetchJson('grid/rain_asof.json')) as Rain | null
  rain = j && Array.isArray(j.dates) && j.dates.length && Array.isArray(j.cells) ? j : null
  return rain
}
/** As-of dates available (ascending). Empty if the rain file is missing. */
export async function asOfDates(): Promise<string[]> { return (await loadRain())?.dates ?? [] }
/** The available as-of date closest to `target` (YYYY-MM-DD), or '' if none. */
export async function nearestDate(target: string): Promise<string> {
  const ds = await asOfDates()
  if (!ds.length) return ''
  const t = Date.parse(target)
  return ds.reduce((b, d) => (Math.abs(Date.parse(d) - t) < Math.abs(Date.parse(b) - t) ? d : b))
}

export async function inBounds(p: { lat: number; lon: number }): Promise<boolean> {
  await loadGrid()
  const b = bounds ?? { latMin: -0.62, latMax: -0.32, lonMin: 37.1, lonMax: 37.4 }
  return p.lat >= b.latMin && p.lat <= b.latMax && p.lon >= b.lonMin && p.lon <= b.lonMax
}

export type LocateResult = { ok: true; lat: number; lon: number } | { ok: false; reason: 'unavailable' | 'denied' | 'outside' }
/** Device location with a 6 s timeout. Never throws. Coordinates are rounded to 2 decimals. */
export function locate(timeoutMs = 6000): Promise<LocateResult> {
  return new Promise((res) => {
    let done = false
    const fin = async (r: { lat: number; lon: number } | 'unavailable' | 'denied') => {
      if (done) return
      done = true
      if (typeof r === 'string') return res({ ok: false, reason: r })
      const p = { lat: round2(r.lat), lon: round2(r.lon) }
      res((await inBounds(p)) ? { ok: true, ...p } : { ok: false, reason: 'outside' })
    }
    try {
      if (!navigator.geolocation) return void fin('unavailable')
      setTimeout(() => void fin('unavailable'), timeoutMs + 500)
      navigator.geolocation.getCurrentPosition(
        (p) => void fin({ lat: p.coords.latitude, lon: p.coords.longitude }),
        (e) => void fin(e.code === 1 ? 'denied' : 'unavailable'),
        { timeout: timeoutMs, maximumAge: 600000 })
    } catch { void fin('unavailable') }
  })
}

const sq = (p: { lat: number; lon: number }, q: { lat: number; lon: number }) => Math.hypot(p.lat - q.lat, p.lon - q.lon)

/** Plot context for an area and an as-of date ('' = latest). Null if no area or no grid. */
export async function loadPlot(area: { lat: number; lon: number } | null, asOf = ''): Promise<{ plot: PlotContext; extra: PlotExtra } | null> {
  try {
    const list = await loadGrid()
    if (!list || !area) return null
    const cell = list.reduce((b, p) => (sq(p, area) < sq(b, area) ? p : b))
    const plot: PlotContext = { ...cell, lat: round2(area.lat), lon: round2(area.lon) }
    const extra: PlotExtra = { maxDailyMm: null, rainAsOf: null }
    const r = await loadRain()
    if (r) {
      const di = asOf && r.dates.includes(asOf) ? r.dates.indexOf(asOf) : r.dates.length - 1
      const ci = r.cells.reduce((b, c, i) => (sq({ lat: c[0], lon: c[1] }, area) < sq({ lat: r.cells[b][0], lon: r.cells[b][1] }, area) ? i : b), 0)
      const days = r.rainDaysOver40mm90d[di]?.[ci]
      if (Number.isFinite(days)) {
        plot.rainDaysOver40mm90d = days
        plot.dataThrough = r.dates[di]
        extra.rainAsOf = r.dates[di]
        const mm = r.maxDailyMm90d?.[di]?.[ci]
        extra.maxDailyMm = Number.isFinite(mm) ? Math.round(mm) : null
      }
    }
    return { plot, extra }
  } catch { return null }
}
