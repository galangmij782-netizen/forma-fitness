// Daily supplement checklist. The list lives in settings; each tick is a row in supplement_log.
import { all, getSetting, run, setSetting } from './db'

export interface Supplement { name: string; dose: string }

export const SUPPLEMENT_PRESETS: Supplement[] = [
  { name: 'Multivitamin', dose: '1 tablet' },
  { name: 'Creatine', dose: '5 g' },
  { name: 'Fish oil', dose: '1–2 softgels' },
  { name: 'Vitamin D3', dose: '1 capsule' },
  { name: 'Vitamin C', dose: '500 mg' },
  { name: 'Magnesium', dose: '200–400 mg' },
  { name: 'Zinc', dose: '1 tablet' },
]

export const getSupplements = () => getSetting<Supplement[]>('supplements', [])
export const setSupplements = (list: Supplement[]) => setSetting('supplements', list)

export const takenOn = (date: string) => new Set(all<{ name: string }>('SELECT name FROM supplement_log WHERE date = ?', [date]).map((r) => r.name))

export function setTaken(date: string, name: string, taken: boolean) {
  if (taken) run('INSERT OR IGNORE INTO supplement_log(date, name) VALUES(?, ?)', [date, name])
  else run('DELETE FROM supplement_log WHERE date = ? AND name = ?', [date, name])
}

/** Days in a row, up to today, on which every supplement on the list was ticked. */
export function supplementStreak(list: Supplement[], todayIso: string, addDays: (d: string, n: number) => string) {
  if (!list.length) return 0
  const rows = all<{ date: string; n: number }>(`SELECT date, COUNT(*) AS n FROM supplement_log WHERE name IN (${list.map(() => '?').join(',')}) GROUP BY date`, list.map((s) => s.name))
  const full = new Set(rows.filter((r) => r.n >= list.length).map((r) => r.date))
  let d = full.has(todayIso) ? todayIso : addDays(todayIso, -1)
  let n = 0
  while (full.has(d)) { n++; d = addDays(d, -1) }
  return n
}
