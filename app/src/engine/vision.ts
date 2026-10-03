// Leaf vision wrapper around onnxruntime-web. Owned by the UI agent.
// Loads <base>model/leaf_int8.onnx + model/meta.json {temperature, classes, input_size}.
// If the model is missing it falls back to a clearly-labelled DEMO stub (isDemo() === true);
// the UI must show a banner whenever isDemo() is true. Results are never silently faked.
import { LEAF_CLASSES, type LeafClass, type VisionResult } from './types'

interface Meta { temperature: number; classes: string[]; input_size: number }
type Ort = typeof import('onnxruntime-web/wasm')
interface Loaded { ort: Ort; session: import('onnxruntime-web/wasm').InferenceSession; meta: Meta }

const BASE = import.meta.env.BASE_URL
let loading: Promise<Loaded | null> | null = null
let demo = false
const listeners = new Set<() => void>()
export const isDemo = () => demo
export const onDemoChange = (f: () => void) => { listeners.add(f); return () => listeners.delete(f) }
const setDemo = (v: boolean) => { if (demo !== v) { demo = v; listeners.forEach((f) => f()) } }

async function load(): Promise<Loaded | null> {
  try {
    const [metaRes, modelRes] = await Promise.all([fetch(BASE + 'model/meta.json'), fetch(BASE + 'model/leaf_int8.onnx')])
    const ct = modelRes.headers.get('content-type') ?? ''
    if (!metaRes.ok || !modelRes.ok || ct.includes('text/html')) throw new Error('model files missing')
    const meta = (await metaRes.json()) as Meta
    if (meta.classes.join() !== LEAF_CLASSES.join()) throw new Error('class order mismatch in meta.json')
    const ort = await import('onnxruntime-web/wasm')
    ort.env.wasm.numThreads = 1
    const session = await ort.InferenceSession.create(new Uint8Array(await modelRes.arrayBuffer()), { executionProviders: ['wasm'] })
    setDemo(false)
    return { ort, session, meta }
  } catch (e) {
    console.warn('[vision] using DEMO stub:', e)
    setDemo(true)
    return null
  }
}
export function initVision() { return (loading ??= load()) }

const MEAN = [0.485, 0.456, 0.406]
const STD = [0.229, 0.224, 0.225]

/** Convert RGBA pixels already resized to size x size into NCHW float32 with ImageNet normalisation. */
export function toTensorData(rgba: Uint8ClampedArray, size: number): Float32Array {
  const n = size * size
  const out = new Float32Array(3 * n)
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) out[c * n + i] = (rgba[i * 4 + c] / 255 - MEAN[c]) / STD[c]
  return out
}

export function softmax(logits: ArrayLike<number>, temperature: number): number[] {
  const z = Array.from(logits, (x) => x / temperature)
  const m = Math.max(...z)
  const e = z.map((x) => Math.exp(x - m))
  const s = e.reduce((a, b) => a + b, 0)
  return e.map((x) => x / s)
}

export function toResult(probs: number[]): VisionResult {
  let k = 0
  probs.forEach((p, i) => { if (p > probs[k]) k = i })
  const top = LEAF_CLASSES[k] as LeafClass
  return { probs, top, topProb: probs[k], usable: top !== 'not_coffee' }
}

/** Draw any image source to size x size (centre-crop square) and return RGBA pixels. */
export function rasterize(src: CanvasImageSource, w: number, h: number, size: number): ImageData {
  const cv = document.createElement('canvas'); cv.width = cv.height = size
  const ctx = cv.getContext('2d', { willReadFrequently: true })!
  const s = Math.min(w, h)
  ctx.drawImage(src, (w - s) / 2, (h - s) / 2, s, s, 0, 0, size, size)
  return ctx.getImageData(0, 0, size, size)
}

/** Run the model on a 224x224 (or meta.input_size) ImageData. */
export async function runVision(img: ImageData): Promise<VisionResult> {
  const m = await initVision()
  if (!m) {
    // DEMO stub: deliberately flat, never confident, so nothing looks like a real diagnosis.
    return { probs: [0.25, 0.2, 0.15, 0.15, 0.15, 0.1], top: 'healthy', topProb: 0.25, usable: true }
  }
  const size = m.meta.input_size
  const data = toTensorData(img.data, size)
  const input = new m.ort.Tensor('float32', data, [1, 3, size, size])
  const out = await m.session.run({ [m.session.inputNames[0]]: input })
  const logits = out[m.session.outputNames[0]].data as Float32Array
  return toResult(softmax(logits, m.meta.temperature || 1))
}
