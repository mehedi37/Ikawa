// Fails if dist/ (excluding onnxruntime wasm) exceeds the budget. wasm is printed separately.
import { readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
const LIMIT = 6 * 1024 * 1024
const walk = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f)
  return statSync(p).isDirectory() ? walk(p) : [[p, statSync(p).size]]
})
let files
try { files = walk('dist') } catch { console.error('dist/ missing: run npm run build first'); process.exit(2) }
const wasm = files.filter(([p]) => extname(p) === '.wasm')
const rest = files.filter(([p]) => extname(p) !== '.wasm')
const sum = (a) => a.reduce((s, [, n]) => s + n, 0)
const mb = (n) => (n / 1048576).toFixed(2) + ' MB'
const byExt = {}
for (const [p, n] of rest) byExt[extname(p) || '(none)'] = (byExt[extname(p) || '(none)'] || 0) + n
console.log('dist (excluding wasm):', mb(sum(rest)), '/ budget', mb(LIMIT))
for (const [k, v] of Object.entries(byExt)) console.log('  ', k.padEnd(8), mb(v))
console.log('onnxruntime wasm (reported separately):', mb(sum(wasm)), wasm.map(([p]) => p).join(', '))
if (sum(rest) > LIMIT) { console.error('FAIL: over budget'); process.exit(1) }
console.log('OK')
