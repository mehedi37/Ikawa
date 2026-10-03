import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { Store } from './index'

const mk = (id: string) => ({ id, farmerId: 'F1', createdAt: 1, payload: { x: id } })

describe('store', () => {
  it('sets PIN, round-trips encrypted data, rejects wrong PIN', async () => {
    const s = await Store.unlock('1234')
    await s.putCase(mk('c1'))
    expect((await s.getCase('c1'))?.payload).toEqual({ x: 'c1' })
    s.close()
    await expect(Store.unlock('0000')).rejects.toThrow('bad-pin')
    const s2 = await Store.unlock('1234')
    expect((await s2.listCases()).length).toBe(1)
    s2.close()
  })
  it('stores ciphertext, not plaintext', async () => {
    const { openDB } = await import('idb')
    const d = await openDB('ikawa')
    const raw = JSON.stringify(Array.from(new Uint8Array(((await d.getAll('cases'))[0] as { data: ArrayBuffer }).data)))
    expect(raw).not.toContain('c1')
    expect(JSON.stringify(await d.getAll('cases'))).not.toContain('farmerId')
    d.close()
  })
  it('deletes only cases marked synced', async () => {
    const s = await Store.unlock('1234')
    await s.putCase(mk('c2'))
    await s.markSynced(['c1'])
    expect(await s.deleteSynced()).toBe(1)
    const left = await s.listCases()
    expect(left.map((c) => c.id)).toEqual(['c2'])
    expect(left[0].synced).toBe(false)
    s.close()
  })
})
