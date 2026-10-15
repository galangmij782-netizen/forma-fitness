import { PHASES } from './nutrition'
import type { TrendPoint } from './trend'
import { weeklyRate } from './trend'
import type { Phase, Targets } from './types'

export interface DayTotals { date: string; kcal: number; protein: number; carbs: number; fat: number }
export interface Insight {
  id: string
  tone: 'good' | 'warn' | 'neutral'
  title: string
  metric: string
  detail: string
  suggestion: string
}

export function weeklyInsights(days: DayTotals[], targets: Targets, phase: Phase, trend: TrendPoint[]): Insight[] {
  const out: Insight[] = []
  const logged = days.filter((d) => d.kcal > 0)

  if (logged.length >= 3) {
    const avg = logged.reduce((a, d) => a + d.kcal, 0) / logged.length
    const diff = avg - targets.kcal
    const pct = (diff / targets.kcal) * 100
    const ok = Math.abs(pct) <= 5
    out.push({
      id: 'kcal',
      tone: ok ? 'good' : 'warn',
      title: 'Average calories',
      metric: `${Math.round(avg).toLocaleString()} kcal`,
      detail: `${Math.abs(Math.round(diff))} kcal ${diff >= 0 ? 'over' : 'under'} your ${targets.kcal.toLocaleString()} kcal target across ${logged.length} logged days.`,
      suggestion: ok
        ? 'Right on target. Keep the same routine next week.'
        : diff > 0
          ? `Trim about ${Math.round(diff / 50) * 50 || 50} kcal a day; the easiest place is usually cooking oil, sauces or drinks.`
          : `Add about ${Math.round(-diff / 50) * 50 || 50} kcal a day, for example a bigger carb portion at your post-workout meal.`,
    })

    const hit = logged.filter((d) => d.protein >= targets.protein * 0.95).length
    const avgP = logged.reduce((a, d) => a + d.protein, 0) / logged.length
    out.push({
      id: 'protein',
      tone: hit / logged.length >= 0.7 ? 'good' : 'warn',
      title: 'Protein target',
      metric: `${hit} of ${logged.length} days`,
      detail: `You averaged ${Math.round(avgP)} g against a ${targets.protein} g target.`,
      suggestion: hit / logged.length >= 0.7
        ? 'Consistent protein. Keep spreading it across 3–4 meals.'
        : `You're about ${Math.max(0, Math.round(targets.protein - avgP))} g short on average. Add a protein-first snack such as Greek yogurt, a shake or cottage cheese.`,
    })
  } else {
    out.push({
      id: 'log', tone: 'neutral', title: 'Not enough logged days', metric: `${logged.length} of 7 days`,
      detail: 'Weekly insights need at least three days with meals logged.',
      suggestion: 'Log every meal for the next few days, even rough photo estimates, to unlock calorie and protein insights.',
    })
  }

  const rate = weeklyRate(trend)
  const [lo, hi] = PHASES[phase].rate
  if (rate) {
    const p = rate.pctPerWeek
    const label = PHASES[phase].label.toLowerCase()
    const inRange = p >= lo && p <= hi
    const tooFastUp = p > hi && hi > 0
    const range = `${lo > 0 ? '+' : ''}${lo}% to ${hi > 0 ? '+' : ''}${hi}%`
    let suggestion: string
    if (inRange) suggestion = `Your weight is moving at the pace a ${label} expects. Keep calories where they are.`
    else if (p > hi) suggestion = tooFastUp
      ? `You're gaining faster than a ${label} needs, which adds mostly fat. Cut about 150 kcal a day.`
      : `You're not losing as fast as a ${label} expects. Cut about 150 kcal a day or add 2,000–3,000 steps.`
    else suggestion = hi <= 0
      ? `You're losing faster than a ${label} needs, which risks muscle. Add about 150 kcal a day, mostly from carbs around training.`
      : `You're not gaining as fast as a ${label} expects. Add about 150–200 kcal a day.`
    out.push({
      id: 'weight',
      tone: inRange ? 'good' : 'warn',
      title: 'Weight trend',
      metric: `${p >= 0 ? '+' : ''}${p.toFixed(2)}% / week`,
      detail: `Trend weight is ${rate.current.toFixed(1)} kg, changing ${rate.kgPerWeek >= 0 ? '+' : ''}${rate.kgPerWeek.toFixed(2)} kg a week. A ${label} expects ${range}.`,
      suggestion,
    })
  } else {
    out.push({
      id: 'weight', tone: 'neutral', title: 'Weight trend', metric: 'Needs data',
      detail: 'The trend needs at least a week of weigh-ins.',
      suggestion: 'Weigh in each morning after the bathroom, before eating. The trend line smooths out daily water swings.',
    })
  }
  return out
}
