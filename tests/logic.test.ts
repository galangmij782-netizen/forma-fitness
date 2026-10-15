import { describe, expect, it } from 'vitest'
import { computeTargets } from '../src/lib/nutrition'
import { smooth, weeklyRate } from '../src/lib/trend'
import { analyzeTraining, e1rm, isNewPR } from '../src/lib/training'
import { weeklyInsights } from '../src/lib/insights'
import { addDays } from '../src/lib/dates'

const base = { sex: 'male' as const, age: 28, height_cm: 178, activity: 'moderate' as const }

describe('nutrition targets', () => {
  it('uses Mifflin-St Jeor and the phase adjustment', () => {
    const m = computeTargets({ ...base, phase: 'maintenance' }, 78)
    expect(m.bmr).toBe(Math.round(10 * 78 + 6.25 * 178 - 5 * 28 + 5))
    expect(Math.abs(m.tdee - m.bmr * 1.55)).toBeLessThan(1)
    const cut = computeTargets({ ...base, phase: 'cut' }, 78)
    expect(cut.kcal).toBeLessThan(m.kcal * 0.85)
    expect(cut.protein).toBe(Math.round(78 * 2.3))
  })
  it('macros add up to roughly the calorie target', () => {
    const t = computeTargets({ ...base, phase: 'lean_bulk' }, 78)
    expect(Math.abs(t.protein * 4 + t.carbs * 4 + t.fat * 9 - t.kcal)).toBeLessThan(12)
  })
})

describe('weight trend', () => {
  it('measures weekly rate as % of body weight', () => {
    const entries = Array.from({ length: 28 }, (_, i) => ({ id: i, date: addDays('2026-01-01', i), kg: 80 + i * (0.4 / 7) }))
    const r = weeklyRate(smooth(entries))!
    expect(r.kgPerWeek).toBeGreaterThan(0.3)
    expect(r.kgPerWeek).toBeLessThan(0.45)
    expect(r.pctPerWeek).toBeCloseTo((r.kgPerWeek / r.current) * 100, 5)
  })
})

describe('training analysis', () => {
  it('estimates 1RM with Epley', () => {
    expect(e1rm(100, 1)).toBe(100)
    expect(e1rm(100, 5)).toBeCloseTo(116.67, 1)
  })
  it('detects PRs only above previous bests', () => {
    expect(isNewPR(100, 5, [{ weight: 100, reps: 5 }])).toBeNull()
    expect(isNewPR(102.5, 3, [{ weight: 100, reps: 5 }])?.kind).toBe('weight')
    expect(isNewPR(100, 6, [{ weight: 100, reps: 5 }])?.kind).toBe('e1rm')
  })
  it('flags regression, missed reps and low-volume muscles', () => {
    const today = '2026-03-01'
    const sets: Parameters<typeof analyzeTraining>[0]['sets'] = []
    let sid = 0, id = 0
    const add = (exercise_id: number, name: string, muscle: any, daysAgo: number, weight: number, reps: number, n = 3, tmin = 6, tmax = 8) => {
      sid++
      for (let i = 0; i < n; i++) sets.push({ id: ++id, session_id: sid, exercise_id, set_index: i, weight, reps, target_min: tmin, target_max: tmax, date: addDays(today, -daysAgo), name, muscle })
    }
    for (const d of [40, 33, 26, 19]) add(1, 'Deadlift', 'Back', d, 160, 5)
    for (const d of [10, 3]) add(1, 'Deadlift', 'Back', d, 145, 4)
    for (const d of [24, 17, 10, 3]) add(2, 'Curl', 'Biceps', d, 35, 5, 3, 8, 12)
    for (const d of [24, 20, 17, 13, 10, 6, 3]) add(3, 'Bench', 'Chest', d, 80 + d * -0.2, 7, 4)
    for (const d of [24, 20, 17, 13, 10, 6, 3]) add(4, 'Squat', 'Quads', d, 100, 7, 4)
    const flags = analyzeTraining({ sets, today, plannedMuscles: ['Back', 'Biceps', 'Chest', 'Quads', 'Hamstrings'] })
    const kinds = flags.map((f) => `${f.kind}:${f.exercise_id ?? f.muscle}`)
    expect(kinds).toContain('regressing:1')
    expect(kinds).toContain('missed_reps:2')
    expect(kinds).toContain('undertrained:Hamstrings')
    expect(flags.every((f) => f.suggestion.length > 10)).toBe(true)
  })
})

describe('weekly insights', () => {
  it('gives a suggestion for every insight', () => {
    const days = Array.from({ length: 7 }, (_, i) => ({ date: addDays('2026-03-01', i), kcal: 2400, protein: i % 2 ? 170 : 120, carbs: 250, fat: 70 }))
    const targets = { kcal: 2800, protein: 160, carbs: 330, fat: 80, tdee: 2600, bmr: 1800 }
    const trend = smooth(Array.from({ length: 21 }, (_, i) => ({ id: i, date: addDays('2026-02-15', i), kg: 80 })))
    const ins = weeklyInsights(days, targets, 'lean_bulk', trend)
    expect(ins.map((i) => i.id)).toEqual(['kcal', 'protein', 'weight'])
    expect(ins[0].tone).toBe('warn')
    expect(ins[2].suggestion).toMatch(/Add about/)
  })
})
