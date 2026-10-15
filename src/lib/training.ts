import { addDays, daysBetween } from './dates'
import type { MuscleGroup, SetRow } from './types'

/** Epley estimate; above 12 reps the estimate gets unreliable, so reps are capped there. */
export const e1rm = (weight: number, reps: number) => (reps <= 1 ? weight : weight * (1 + Math.min(reps, 12) / 30))

export interface SessionStat { session_id: number; date: string; top: { weight: number; reps: number }; e1rm: number; volume: number; sets: number }

export function sessionStats(sets: SetRow[]): SessionStat[] {
  const by = new Map<number, SetRow[]>()
  for (const s of sets) {
    if (!by.has(s.session_id)) by.set(s.session_id, [])
    by.get(s.session_id)!.push(s)
  }
  return [...by.values()]
    .map((rows) => {
      const top = rows.reduce((a, b) => (b.weight > a.weight || (b.weight === a.weight && b.reps > a.reps) ? b : a))
      return {
        session_id: rows[0].session_id,
        date: rows[0].date,
        top: { weight: top.weight, reps: top.reps },
        e1rm: Math.max(...rows.map((r) => e1rm(r.weight, r.reps))),
        volume: rows.reduce((v, r) => v + r.weight * r.reps, 0),
        sets: rows.length,
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.session_id - b.session_id)
}

export interface PR { kind: 'e1rm' | 'weight' | 'volume'; value: number; date: string; detail: string }

export function personalRecords(stats: SessionStat[], sets: SetRow[]): PR[] {
  if (!stats.length) return []
  const bestE = stats.reduce((a, b) => (b.e1rm > a.e1rm ? b : a))
  const heaviest = sets.reduce((a, b) => (b.weight > a.weight || (b.weight === a.weight && b.reps > a.reps) ? b : a))
  const bestV = stats.reduce((a, b) => (b.volume > a.volume ? b : a))
  return [
    { kind: 'e1rm', value: bestE.e1rm, date: bestE.date, detail: `${bestE.top.weight} × ${bestE.top.reps}` },
    { kind: 'weight', value: heaviest.weight, date: heaviest.date, detail: `${heaviest.reps} reps` },
    { kind: 'volume', value: bestV.volume, date: bestV.date, detail: `${bestV.sets} sets` },
  ]
}

/** Is this set a new best estimated 1RM or heaviest weight compared with everything logged before it? */
export function isNewPR(weight: number, reps: number, previous: { weight: number; reps: number }[]) {
  if (!previous.length || weight <= 0 || reps <= 0) return null
  const bestE = Math.max(...previous.map((p) => e1rm(p.weight, p.reps)))
  const heaviest = Math.max(...previous.map((p) => p.weight))
  if (weight > heaviest) return { kind: 'weight' as const, value: weight }
  const est = e1rm(weight, reps)
  if (est > bestE + 0.01) return { kind: 'e1rm' as const, value: est }
  return null
}

// ---------- what needs work ----------
export type FlagKind = 'regressing' | 'stalled' | 'missed_reps' | 'undertrained' | 'ready'
export interface Flag {
  kind: FlagKind
  severity: 1 | 2 | 3
  title: string
  detail: string
  suggestion: string
  exercise_id?: number
  muscle?: MuscleGroup
}

const LOWER: MuscleGroup[] = ['Quads', 'Hamstrings', 'Glutes', 'Calves']

export function analyzeTraining(opts: {
  sets: (SetRow & { name: string; muscle: MuscleGroup })[]
  plannedMuscles: MuscleGroup[]
  today: string
  cutting?: boolean
  unit?: string
}): Flag[] {
  const { sets, today, unit = 'kg' } = opts
  const flags: Flag[] = []
  const byEx = new Map<number, typeof sets>()
  for (const s of sets) {
    if (daysBetween(s.date, today) > 56) continue
    if (!byEx.has(s.exercise_id)) byEx.set(s.exercise_id, [])
    byEx.get(s.exercise_id)!.push(s)
  }

  for (const [exId, rows] of byEx) {
    const { name, muscle } = rows[0]
    const stats = sessionStats(rows)
    const step = LOWER.includes(muscle) ? 5 : 2.5

    // Trend: best e1RM in the last 2 weeks vs the 4 weeks before.
    const recent = stats.filter((s) => daysBetween(s.date, today) <= 14)
    const prior = stats.filter((s) => { const d = daysBetween(s.date, today); return d > 14 && d <= 42 })
    const hasTrend = recent.length >= 1 && prior.length >= 2 && stats.length >= 4
    const r = hasTrend ? Math.max(...recent.map((s) => s.e1rm)) : 0
    const p = hasTrend ? Math.max(...prior.map((s) => s.e1rm)) : 0
    const change = hasTrend ? (r - p) / p : 0
    if (hasTrend && change < -0.03) {
      flags.push({
        kind: 'regressing', severity: 3, exercise_id: exId, muscle,
        title: `${name} is going down`,
        detail: `Best estimated 1RM fell ${Math.abs(change * 100).toFixed(1)}% over the last two weeks (${p.toFixed(1)} → ${r.toFixed(1)} ${unit}).`,
        suggestion: opts.cutting
          ? `Some loss is normal in a deficit. Take a deload week at about 90% of your working weight, keep protein high, and hold the weight rather than pushing for reps.`
          : `Deload for one week at about 90% of your working weight, then build back up. If it keeps dropping, check sleep, calories and how many hard sets you do for ${muscle.toLowerCase()}.`,
      })
      continue
    }

    // Rep targets over the last 4 sessions.
    const lastSessions = stats.slice(-4).map((s) => s.session_id)
    const window = rows.filter((s) => lastSessions.includes(s.session_id))
    const missed = window.filter((s) => s.reps < s.target_min).length
    if (window.length >= 6 && missed / window.length >= 0.4) {
      flags.push({
        kind: 'missed_reps', severity: 2, exercise_id: exId, muscle,
        title: `Missing reps on ${name}`,
        detail: `${missed} of your last ${window.length} sets fell short of the ${window[0].target_min}–${window[0].target_max} rep target.`,
        suggestion: `Drop the weight by 5–10% so every set lands in range, then add weight again once you hit the top of the range.`,
      })
      continue
    }

    if (hasTrend && Math.abs(change) <= 0.01) {
      const last = rows.filter((s) => s.session_id === stats[stats.length - 1].session_id)
      const topOfRange = last.every((s) => s.reps >= s.target_max)
      flags.push({
        kind: 'stalled', severity: 2, exercise_id: exId, muscle,
        title: `${name} has stalled`,
        detail: `No real change in estimated 1RM for about a month (${p.toFixed(1)} → ${r.toFixed(1)} ${unit}).`,
        suggestion: topOfRange
          ? `You're reaching the top of your rep range, so add ${step} ${unit} next session.`
          : `Add one set per session for the next two weeks, or switch to a new rep range (for example from 6–8 to 8–10) to restart progress.`,
      })
      continue
    }

    const lastTwo = stats.slice(-2).map((s) => s.session_id)
    const lt = rows.filter((s) => lastTwo.includes(s.session_id))
    if (lastTwo.length === 2 && lt.length && lt.every((s) => s.reps >= s.target_max) && daysBetween(stats[stats.length - 1].date, today) <= 14) {
      flags.push({
        kind: 'ready', severity: 1, exercise_id: exId, muscle,
        title: `${name} is ready to progress`,
        detail: `You hit the top of the rep range on every set for two sessions in a row.`,
        suggestion: `Add ${step} ${unit} next time.`,
      })
    }
  }

  // Weekly hard sets per muscle group over the last 4 weeks.
  const since = addDays(today, -28)
  const counts = new Map<MuscleGroup, number>()
  for (const s of sets) if (s.date > since) counts.set(s.muscle, (counts.get(s.muscle) ?? 0) + 1)
  const groups = [...new Set([...opts.plannedMuscles, ...counts.keys()])]
  const weekly = groups.map((g) => ({ g, v: (counts.get(g) ?? 0) / 4 }))
  const nonzero = weekly.map((w) => w.v).filter((v) => v > 0).sort((a, b) => a - b)
  if (nonzero.length >= 3) {
    const median = nonzero[Math.floor(nonzero.length / 2)]
    for (const { g, v } of weekly) {
      if (v < median * 0.5) {
        const add = Math.max(2, Math.round(median - v))
        flags.push({
          kind: 'undertrained', severity: v === 0 ? 3 : 2, muscle: g,
          title: `${g} is getting less work`,
          detail: `${v.toFixed(1)} sets a week, against about ${median.toFixed(0)} for your other muscle groups.`,
          suggestion: `Add ${add}–${add + 2} sets a week for ${g.toLowerCase()}, either one more exercise on a day that already trains it or an extra set on the lifts you have.`,
        })
      }
    }
  }

  return flags.sort((a, b) => b.severity - a.severity)
}
