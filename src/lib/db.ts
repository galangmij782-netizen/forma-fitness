// SQLite (sql.js, WebAssembly) with one database file per profile.
// Writes are flushed to disk through the platform layer shortly after each change.
import initSqlJs, { type Database, type SqlValue } from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { platform } from './platform'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS exercises (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE, muscle TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS splits (id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', position INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS split_days (id INTEGER PRIMARY KEY, split_id INTEGER NOT NULL REFERENCES splits(id) ON DELETE CASCADE, name TEXT NOT NULL, position INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS day_exercises (id INTEGER PRIMARY KEY, day_id INTEGER NOT NULL REFERENCES split_days(id) ON DELETE CASCADE, exercise_id INTEGER NOT NULL REFERENCES exercises(id), position INTEGER NOT NULL, sets INTEGER NOT NULL, reps_min INTEGER NOT NULL, reps_max INTEGER NOT NULL, rest_sec INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS split_schedule (split_id INTEGER NOT NULL REFERENCES splits(id) ON DELETE CASCADE, weekday INTEGER NOT NULL, day_id INTEGER REFERENCES split_days(id) ON DELETE SET NULL, PRIMARY KEY (split_id, weekday));
CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY, day_id INTEGER REFERENCES split_days(id) ON DELETE SET NULL, day_name TEXT NOT NULL, split_name TEXT NOT NULL, date TEXT NOT NULL, started_at TEXT NOT NULL, ended_at TEXT);
CREATE TABLE IF NOT EXISTS sets (id INTEGER PRIMARY KEY, session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, exercise_id INTEGER NOT NULL REFERENCES exercises(id), set_index INTEGER NOT NULL, weight REAL NOT NULL, reps INTEGER NOT NULL, target_min INTEGER NOT NULL, target_max INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS day_marks (date TEXT PRIMARY KEY, status TEXT NOT NULL, note TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS bodyweight (id INTEGER PRIMARY KEY, date TEXT NOT NULL UNIQUE, kg REAL NOT NULL);
CREATE TABLE IF NOT EXISTS foods (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE, grams REAL NOT NULL, kcal REAL NOT NULL, protein REAL NOT NULL, carbs REAL NOT NULL, fat REAL NOT NULL, favorite INTEGER NOT NULL DEFAULT 0, last_used TEXT, uses INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS meals (id INTEGER PRIMARY KEY, date TEXT NOT NULL, time TEXT NOT NULL, name TEXT NOT NULL, source TEXT NOT NULL, photo TEXT);
CREATE TABLE IF NOT EXISTS meal_items (id INTEGER PRIMARY KEY, meal_id INTEGER NOT NULL REFERENCES meals(id) ON DELETE CASCADE, name TEXT NOT NULL, grams REAL NOT NULL, kcal REAL NOT NULL, protein REAL NOT NULL, carbs REAL NOT NULL, fat REAL NOT NULL, confidence TEXT, food_id INTEGER);
CREATE INDEX IF NOT EXISTS idx_sets_ex ON sets(exercise_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);
CREATE INDEX IF NOT EXISTS idx_meals_date ON meals(date);
`
export const TABLES = ['settings', 'exercises', 'splits', 'split_days', 'day_exercises', 'split_schedule', 'sessions', 'sets', 'day_marks', 'bodyweight', 'foods', 'meals', 'meal_items'] as const

let SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null
let db: Database | null = null
let profileId: string | null = null
let version = 0
let saveTimer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<() => void>()

export async function openDatabase(id: string) {
  SQL ??= await initSqlJs({ locateFile: () => wasmUrl })
  await flush()
  const bytes = await platform.db.load(id)
  db = bytes ? new SQL.Database(bytes) : new SQL.Database()
  db.exec('PRAGMA foreign_keys = ON;')
  db.exec(SCHEMA)
  profileId = id
  bump(false)
}

export function closeDatabase() {
  void flush()
  db?.close()
  db = null
  profileId = null
}

function bump(persist = true) {
  version++
  listeners.forEach((l) => l())
  if (persist) scheduleSave()
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => void flush(), 350)
}

export async function flush() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  if (db && profileId) await platform.db.save(profileId, db.export())
}

window.addEventListener('beforeunload', () => { void flush() })

const conn = () => { if (!db) throw new Error('Database not open'); return db }

export function all<T = Record<string, unknown>>(sql: string, params: SqlValue[] = []): T[] {
  const stmt = conn().prepare(sql)
  stmt.bind(params)
  const rows: T[] = []
  while (stmt.step()) rows.push(stmt.getAsObject() as T)
  stmt.free()
  return rows
}

export const get = <T = Record<string, unknown>>(sql: string, params: SqlValue[] = []): T | undefined => all<T>(sql, params)[0]

/** Runs a write and returns the last inserted row id. Notifies subscribers. */
export function run(sql: string, params: SqlValue[] = []): number {
  conn().run(sql, params)
  const id = (conn().exec('SELECT last_insert_rowid()')[0]?.values[0]?.[0] as number) ?? 0
  bump()
  return id
}

/** Several writes as one transaction and one notification. */
export function tx<T>(fn: (exec: (sql: string, params?: SqlValue[]) => number) => T): T {
  const d = conn()
  d.exec('BEGIN')
  try {
    const result = fn((sql, params = []) => {
      d.run(sql, params)
      return d.exec('SELECT last_insert_rowid()')[0].values[0][0] as number
    })
    d.exec('COMMIT')
    bump()
    return result
  } catch (e) {
    d.exec('ROLLBACK')
    throw e
  }
}

const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l) }
const snapshot = () => version

/** Re-runs a read whenever the database changes. */
export function useQuery<T>(fn: () => T, deps: unknown[] = []): T {
  const v = useSyncExternalStore(subscribe, snapshot)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => (db ? fn() : (undefined as T)), [v, ...deps])
}

// ---------- settings ----------
export function getSetting<T>(key: string, fallback: T): T {
  const row = get<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key])
  return row ? (JSON.parse(row.value) as T) : fallback
}
export function setSetting(key: string, value: unknown) {
  run('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, JSON.stringify(value)])
}

// ---------- backup ----------
export function exportJson() {
  const data: Record<string, unknown[]> = {}
  for (const t of TABLES) data[t] = all(`SELECT * FROM ${t}`)
  return JSON.stringify({ app: 'forma', format: 1, exported_at: new Date().toISOString(), data }, null, 1)
}

export function importJson(json: string) {
  const parsed = JSON.parse(json)
  if (parsed?.app !== 'forma' || !parsed.data) throw new Error('This file is not a Forma backup.')
  const d = conn()
  d.exec('PRAGMA foreign_keys = OFF; BEGIN;')
  try {
    for (const t of [...TABLES].reverse()) d.exec(`DELETE FROM ${t}`)
    for (const t of TABLES) {
      for (const row of (parsed.data[t] ?? []) as Record<string, SqlValue>[]) {
        const cols = Object.keys(row)
        if (!cols.every((c) => /^[a-z_]+$/.test(c))) throw new Error('This backup file is damaged.')
        d.run(`INSERT INTO ${t} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, cols.map((c) => row[c]))
      }
    }
    d.exec('COMMIT; PRAGMA foreign_keys = ON;')
  } catch (e) {
    d.exec('ROLLBACK; PRAGMA foreign_keys = ON;')
    throw e
  }
  bump()
}

export function wipeAll() {
  const d = conn()
  d.exec('PRAGMA foreign_keys = OFF; BEGIN;')
  for (const t of TABLES) if (t !== 'settings') d.exec(`DELETE FROM ${t}`)
  d.exec('COMMIT; PRAGMA foreign_keys = ON;')
  bump()
}

export function useDbReady(id: string | null) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let alive = true
    setReady(false)
    if (id) openDatabase(id).then(() => alive && setReady(true))
    return () => { alive = false }
  }, [id])
  return ready
}
