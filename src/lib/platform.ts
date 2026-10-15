// Platform layer. The desktop build talks to the Electron main process through
// window.forma; the browser build (dev preview, and later the iPhone web app)
// keeps everything in IndexedDB on the device.
import type { MealAnalysis } from './types'

export interface ProfileInfo { id: string; name: string; color: string; hasPin: boolean; createdAt: string }
export interface KeyStatus { set: boolean; hint: string | null; encrypted?: boolean }
export interface AnalyzeArgs { id: string; imageBase64: string; mediaType: string; model: string; note?: string }

export interface Platform {
  isDesktop: boolean
  profiles: {
    list(): Promise<ProfileInfo[]>
    create(a: { name: string; pin?: string; color?: string }): Promise<ProfileInfo>
    unlock(a: { id: string; pin?: string }): Promise<boolean>
    lock(a: { id: string }): Promise<boolean>
    update(a: { id: string; name?: string; color?: string; pin?: string; clearPin?: boolean }): Promise<ProfileInfo>
    remove(a: { id: string }): Promise<boolean>
  }
  db: { load(id: string): Promise<Uint8Array | null>; save(id: string, bytes: Uint8Array): Promise<boolean> }
  key: { set(id: string, key: string): Promise<KeyStatus>; status(id: string): Promise<KeyStatus>; clear(id: string): Promise<KeyStatus> }
  meal: { analyze(a: AnalyzeArgs): Promise<MealAnalysis> }
  backup: { export(name: string, json: string): Promise<string | null>; import(): Promise<string | null> }
  app: { info(): Promise<{ version: string; dataPath: string }>; openDataFolder(): Promise<unknown>; setTheme(mode: string): void }
}

declare global { interface Window { forma?: Platform } }

// ---------- IndexedDB key-value store ----------
const idb = (() => {
  let dbp: Promise<IDBDatabase> | null = null
  const open = () => (dbp ??= new Promise((res, rej) => {
    const r = indexedDB.open('forma', 1)
    r.onupgradeneeded = () => r.result.createObjectStore('kv')
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  }))
  const tx = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) => {
    const db = await open()
    return new Promise<T>((res, rej) => {
      const req = fn(db.transaction('kv', mode).objectStore('kv'))
      req.onsuccess = () => res(req.result)
      req.onerror = () => rej(req.error)
    })
  }
  return {
    get: <T>(k: string) => tx<T | undefined>('readonly', (s) => s.get(k) as IDBRequest<T | undefined>),
    set: (k: string, v: unknown) => tx('readwrite', (s) => s.put(v, k)),
    del: (k: string) => tx('readwrite', (s) => s.delete(k)),
  }
})()

async function hashPin(pin: string, salt: string) {
  const enc = new TextEncoder()
  const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 150_000, hash: 'SHA-256' }, base, 256)
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

type StoredProfile = ProfileInfo & { salt?: string; pinHash?: string }
const pub = (p: StoredProfile): ProfileInfo => ({ id: p.id, name: p.name, color: p.color, hasPin: !!p.pinHash, createdAt: p.createdAt })
const isDemo = () => new URLSearchParams(location.search).has('demo')

function browserPlatform(): Platform {
  const unlocked = new Set<string>()
  const list = async () => (await idb.get<StoredProfile[]>('profiles')) ?? []
  const guard = (id: string) => { if (!unlocked.has(id)) throw new Error('Profile is locked') }
  return {
    isDesktop: false,
    profiles: {
      list: async () => (await list()).map(pub),
      async create({ name, pin, color }) {
        const p: StoredProfile = { id: crypto.randomUUID(), name: name.trim().slice(0, 40), color: color ?? 'green', hasPin: !!pin, createdAt: new Date().toISOString() }
        if (pin) { p.salt = crypto.randomUUID(); p.pinHash = await hashPin(pin, p.salt) }
        await idb.set('profiles', [...(await list()), p])
        unlocked.add(p.id)
        return pub(p)
      },
      async unlock({ id, pin }) {
        const p = (await list()).find((x) => x.id === id)
        if (!p) throw new Error('Profile not found')
        if (p.pinHash && (await hashPin(pin ?? '', p.salt!)) !== p.pinHash) return false
        unlocked.add(id)
        return true
      },
      async lock({ id }) { unlocked.delete(id); return true },
      async update({ id, name, color, pin, clearPin }) {
        guard(id)
        const all = await list()
        const p = all.find((x) => x.id === id)!
        if (name) p.name = name.trim().slice(0, 40)
        if (color) p.color = color
        if (clearPin) { delete p.pinHash; delete p.salt }
        if (pin) { p.salt = crypto.randomUUID(); p.pinHash = await hashPin(pin, p.salt) }
        await idb.set('profiles', all)
        return pub(p)
      },
      async remove({ id }) {
        guard(id)
        await idb.set('profiles', (await list()).filter((x) => x.id !== id))
        await idb.del(`db:${id}`); await idb.del(`key:${id}`)
        unlocked.delete(id)
        return true
      },
    },
    db: {
      load: async (id) => { guard(id); return (await idb.get<Uint8Array>(`db:${id}`)) ?? null },
      save: async (id, bytes) => { guard(id); await idb.set(`db:${id}`, bytes); return true },
    },
    key: {
      async set(id, key) { guard(id); await idb.set(`key:${id}`, key.trim()); return { set: true, hint: key.trim().slice(-4), encrypted: false } },
      async status(id) { guard(id); const k = await idb.get<string>(`key:${id}`); return { set: !!k || isDemo(), hint: k ? k.slice(-4) : isDemo() ? 'demo' : null, encrypted: false } },
      async clear(id) { guard(id); await idb.del(`key:${id}`); return { set: false, hint: null } },
    },
    meal: {
      async analyze({ id, imageBase64, mediaType, model, note }) {
        guard(id)
        const key = await idb.get<string>(`key:${id}`)
        if (!key) {
          if (isDemo()) return demoAnalysis()
          throw new Error('NO_KEY')
        }
        const { analyzeWithClaude } = await import('./claude-browser')
        return analyzeWithClaude({ apiKey: key, imageBase64, mediaType, model, note })
      },
    },
    backup: {
      async export(name, json) {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
        a.download = name
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 2000)
        return name
      },
      import: () => new Promise((res) => {
        const input = document.createElement('input')
        input.type = 'file'; input.accept = 'application/json,.json'
        input.onchange = async () => res(input.files?.[0] ? await input.files[0].text() : null)
        input.click()
      }),
    },
    app: {
      info: async () => ({ version: '0.1.0', dataPath: 'Browser storage on this device' }),
      openDataFolder: async () => null,
      setTheme: () => {},
    },
  }
}

// Demo-only stand-in used for previews without an API key (?demo in the URL).
async function demoAnalysis(): Promise<MealAnalysis> {
  await new Promise((r) => setTimeout(r, 2200))
  return {
    meal_name: 'Chicken rice bowl',
    notes: 'Cooking oil is hard to see; the rice depth is a guess.',
    items: [
      { name: 'Grilled chicken breast', grams: 160, kcal: 264, protein_g: 49.6, carbs_g: 0, fat_g: 5.8, confidence: 'high' },
      { name: 'White rice, cooked', grams: 210, kcal: 273, protein_g: 5.7, carbs_g: 59.2, fat_g: 0.6, confidence: 'medium' },
      { name: 'Avocado', grams: 60, kcal: 96, protein_g: 1.2, carbs_g: 5.1, fat_g: 8.8, confidence: 'medium' },
      { name: 'Olive oil (cooking)', grams: 8, kcal: 71, protein_g: 0, carbs_g: 0, fat_g: 8, confidence: 'low' },
    ],
  }
}

export const platform: Platform = window.forma ?? browserPlatform()
