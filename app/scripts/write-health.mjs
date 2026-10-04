// Writes dist/health.json AFTER the Vite build, so it is NOT in the service-worker precache:
// it always reflects what is actually deployed. Used by scripts/healthcheck.sh and judges' curiosity.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

const read = (p) => JSON.parse(readFileSync(p, 'utf8'))
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
let commit = process.env.GIT_COMMIT || 'unknown'   // CLI uploads carry no .git: pass --build-env GIT_COMMIT=...
if (commit === 'unknown') try { commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch {}
const meta = read('dist/model/meta.json')
const grid = existsSync('dist/grid/plot_grid.json') ? read('dist/grid/plot_grid.json').meta : {}
const packs = ['en', 'sw'].map((l) => {
  const p = read(`src/content/packs/${l}.json`)
  return { lang: l, machineDrafted: !!p.machineDrafted, cards: p.cards.length, reviewedCards: p.cards.filter((c) => c.reviewed).length }
})
const health = {
  status: 'ok',
  app: read('package.json').name, version: read('package.json').version, commit,
  builtAt: new Date().toISOString(),
  model: { file: meta.file, bytes: meta.size_bytes, sha256: sha(`dist/model/${meta.file}`), classes: meta.classes, quantized: meta.quantized },
  data: { gridBuiltOn: grid.builtOn ?? null, gridBounds: grid.bounds ?? null, rainDataThrough: grid.chirpsYears ?? null },
  packs,
}
writeFileSync('dist/health.json', JSON.stringify(health, null, 1))
console.log(`health.json: commit ${commit}, model ${health.model.sha256.slice(0, 12)}…`)
