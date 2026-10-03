// WebCrypto helpers: PBKDF2(PIN) -> AES-GCM key.
const enc = new TextEncoder()
const dec = new TextDecoder()
const ITER = 150_000

export const newSalt = (): Uint8Array<ArrayBuffer> => crypto.getRandomValues(new Uint8Array(16))

export async function deriveKey(pin: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export interface Sealed { iv: Uint8Array<ArrayBuffer>; data: ArrayBuffer }

export async function seal(key: CryptoKey, value: unknown): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value)))
  return { iv, data }
}

export async function open<T>(key: CryptoKey, s: Sealed): Promise<T> {
  const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: s.iv }, key, s.data)
  return JSON.parse(dec.decode(buf)) as T
}
