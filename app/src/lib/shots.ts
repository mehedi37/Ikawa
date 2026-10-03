import { photoGate } from '../adapters'
import { rasterize, runVision } from '../engine/vision'
import type { Shot } from './session'

/** Gate + (if ok) classify one photo. Throws on undecodable files. */
export async function processBlob(f: Blob): Promise<Shot> {
  const bmp = await createImageBitmap(f)
  try {
    const gate = photoGate(rasterize(bmp, bmp.width, bmp.height, 256))
    let probs: number[] | null = null
    if (gate.ok) probs = (await runVision(rasterize(bmp, bmp.width, bmp.height, 224))).probs
    return { url: URL.createObjectURL(f), probs, gate }
  } finally { bmp.close() }
}
