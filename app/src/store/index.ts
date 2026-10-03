// Encrypted local store (contracts.md section 10): IndexedDB `ikawa`, stores farmers/cases/outbox,
// payloads AES-GCM encrypted with a key derived from the agent PIN.
// Only the id and the `synced` flag are stored in clear (needed for deletion rules).
import { openDB, type IDBPDatabase } from 'idb'
import { deriveKey, newSalt, open, seal, type Sealed } from './crypto'

export type StoreName = 'farmers' | 'cases' | 'outbox'
interface Row { id: string; synced: 0 | 1; updated: number; iv: Uint8Array<ArrayBuffer>; data: ArrayBuffer }

export interface FarmerRecord { id: string; name?: string; consents: { service: boolean; registry: boolean; photos: boolean }; voice?: unknown; createdAt: number }
export interface CaseRecord { id: string; farmerId: string; createdAt: number; sms?: string; payload: Record<string, unknown> }
export interface OutboxRecord { id: string; caseId: string; sms: string; createdAt: number }

const CHECK = 'ikawa-pin-check'
const DB = 'ikawa'

async function db(): Promise<IDBPDatabase> {
  return openDB(DB, 1, {
    upgrade(d) {
      for (const n of ['farmers', 'cases', 'outbox']) d.createObjectStore(n, { keyPath: 'id' })
      d.createObjectStore('meta') // salt + PIN check value
    },
  })
}

export class Store {
  private d: IDBPDatabase
  private key: CryptoKey
  private constructor(d: IDBPDatabase, key: CryptoKey) { this.d = d; this.key = key }

  /** First call with a PIN sets it; later calls verify it. Throws 'bad-pin' on mismatch. */
  static async unlock(pin: string): Promise<Store> {
    const d = await db()
    let salt = (await d.get('meta', 'salt')) as Uint8Array<ArrayBuffer> | undefined
    const first = !salt
    if (!salt) { salt = newSalt(); await d.put('meta', salt, 'salt') }
    const key = await deriveKey(pin, salt)
    if (first) await d.put('meta', await seal(key, CHECK), 'check')
    else {
      try {
        if ((await open<string>(key, (await d.get('meta', 'check')) as Sealed)) !== CHECK) throw new Error()
      } catch { d.close(); throw new Error('bad-pin') }
    }
    return new Store(d, key)
  }
  static async hasPin(): Promise<boolean> {
    const d = await db(); const s = await d.get('meta', 'salt'); d.close(); return !!s
  }

  close() { this.d.close() }

  private async put<T extends { id: string }>(store: StoreName, v: T, synced: 0 | 1 = 0) {
    const s = await seal(this.key, v)
    const row: Row = { id: v.id, synced, updated: Date.now(), ...s }
    await this.d.put(store, row)
  }
  private async get<T>(store: StoreName, id: string): Promise<T | undefined> {
    const r = (await this.d.get(store, id)) as Row | undefined
    return r ? open<T>(this.key, r) : undefined
  }
  private async all<T>(store: StoreName): Promise<(T & { synced: boolean })[]> {
    const rows = (await this.d.getAll(store)) as Row[]
    return Promise.all(rows.map(async (r) => ({ ...(await open<T>(this.key, r)), synced: !!r.synced })))
  }

  putFarmer = (f: FarmerRecord) => this.put('farmers', f)
  getFarmer = (id: string) => this.get<FarmerRecord>('farmers', id)
  listFarmers = () => this.all<FarmerRecord>('farmers')
  putCase = (c: CaseRecord) => this.put('cases', c)
  getCase = (id: string) => this.get<CaseRecord>('cases', id)
  listCases = () => this.all<CaseRecord>('cases')
  queueSms = (o: OutboxRecord) => this.put('outbox', o)
  listOutbox = () => this.all<OutboxRecord>('outbox')
  clearOutbox = (id: string) => this.d.delete('outbox', id)

  /** The user confirms a case reached the cooperative. Only then may it be deleted. */
  async markSynced(caseIds: string[]) {
    for (const id of caseIds) {
      const r = (await this.d.get('cases', id)) as Row | undefined
      if (r) await this.d.put('cases', { ...r, synced: 1 })
    }
  }
  /** Deletes ONLY cases marked synced. Returns the number deleted. */
  async deleteSynced(): Promise<number> {
    const rows = (await this.d.getAll('cases')) as Row[]
    let n = 0
    for (const r of rows) if (r.synced) { await this.d.delete('cases', r.id); n++ }
    return n
  }
}
