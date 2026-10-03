// Builds dist-qa: the real app + the SMOKE model (runs/kill is a smoke run, not the shipped model).
import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../../', import.meta.url))
const app = root + 'app/'
rmSync(app + '.qa-public', { recursive: true, force: true })
cpSync(app + 'public', app + '.qa-public', { recursive: true })
if (!existsSync(app + 'public/model/leaf_int8.onnx')) {
  mkdirSync(app + '.qa-public/model', { recursive: true })
  cpSync(root + 'data/interim/export_test/leaf_fp32.onnx', app + '.qa-public/model/leaf_int8.onnx')
  cpSync(root + 'data/interim/export_test/meta.json', app + '.qa-public/model/meta.json')
}
execSync('npx vite build', { cwd: app, stdio: 'inherit', env: { ...process.env, QA_PUBLIC: '.qa-public', QA_OUT: 'dist-qa' } })
