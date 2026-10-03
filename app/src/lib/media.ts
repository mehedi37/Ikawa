import { extractMfcc, type Mfcc } from '../adapters'
import { getLang } from '../content/i18n'

const BASE = import.meta.env.BASE_URL

/** Where the clip for `id` lives per language. The existing clips are Kiswahili and sit flat in public/audio/;
 *  other languages use public/audio/<lang>/<id>.opus (D-029). No clip in the active language => not available. */
export const audioUrls = (id: string, lang = getLang()): string[] =>
  lang === 'sw' ? [`${BASE}audio/sw/${id}.opus`, `${BASE}audio/${id}.opus`] : [`${BASE}audio/${lang}/${id}.opus`]

/** Play a pre-rendered clip in the active language. Returns false if the clip is not there. */
export async function playClip(id: string): Promise<boolean> {
  for (const url of audioUrls(id)) {
    try {
      const head = await fetch(url, { method: 'HEAD' })
      if (!head.ok || (head.headers.get('content-type') ?? '').includes('text/html')) continue  // missing file (SPA fallback)
      const a = new Audio(url)
      await a.play()
      return true
    } catch { /* try the next candidate */ }
  }
  return false
}

/** Record `ms` of microphone audio and return its MFCC sequence. Throws if the mic is unavailable. */
export async function recordMfcc(ms = 1800): Promise<Mfcc> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  try {
    const rec = new MediaRecorder(stream)
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => chunks.push(e.data)
    const done = new Promise<void>((r) => { rec.onstop = () => r() })
    rec.start()
    await new Promise((r) => setTimeout(r, ms))
    rec.stop()
    await done
    const ctx = new AudioContext()
    const buf = await ctx.decodeAudioData(await new Blob(chunks).arrayBuffer())
    const mf = extractMfcc(buf.getChannelData(0), buf.sampleRate)
    void ctx.close()
    return mf
  } finally { stream.getTracks().forEach((t) => t.stop()) }
}

export async function fileToBitmap(f: File): Promise<ImageBitmap> { return createImageBitmap(f) }

export async function share(name: string, mime: string, text: string) {
  const file = new File([text], name, { type: mime })
  if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: name }); return }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(file); a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}
