import { daysBetween } from './dates'
import type { WeightEntry } from './types'

export interface TrendPoint { date: string; kg: number; trend: number }

/** Exponentially smoothed weight, which hides day-to-day water swings. */
export function smooth(entries: WeightEntry[], alpha = 0.15): TrendPoint[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  let t: number | null = null
  let prev: string | null = null
  return sorted.map((e) => {
    if (t === null || prev === null) t = e.kg
    else {
      const gap = Math.max(1, daysBetween(prev, e.date))
      const a = 1 - Math.pow(1 - alpha, gap)
      t = t + a * (e.kg - t)
    }
    prev = e.date
    return { date: e.date, kg: e.kg, trend: t }
  })
}

/** Least-squares slope of the trend over the last `days`, as kg per week and % of body weight per week. */
export function weeklyRate(points: TrendPoint[], days = 21) {
  if (points.length < 4) return null
  const last = points[points.length - 1].date
  const recent = points.filter((p) => daysBetween(p.date, last) <= days)
  if (recent.length < 4 || daysBetween(recent[0].date, last) < 7) return null
  const xs = recent.map((p) => daysBetween(recent[0].date, p.date))
  const ys = recent.map((p) => p.trend)
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length
  const my = ys.reduce((a, b) => a + b, 0) / ys.length
  let num = 0, den = 0
  xs.forEach((x, i) => { num += (x - mx) * (ys[i] - my); den += (x - mx) ** 2 })
  const perDay = den ? num / den : 0
  const kgPerWeek = perDay * 7
  const current = points[points.length - 1].trend
  return { kgPerWeek, pctPerWeek: (kgPerWeek / current) * 100, current, span: daysBetween(recent[0].date, last) }
}
