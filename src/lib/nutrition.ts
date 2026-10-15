import type { Activity, Phase, Profile, Sex, Targets } from './types'

export const ACTIVITY: Record<Activity, { label: string; factor: number; hint: string }> = {
  sedentary: { label: 'Sedentary', factor: 1.2, hint: 'Desk job, little walking' },
  light: { label: 'Light', factor: 1.375, hint: 'Training 1–3 days a week' },
  moderate: { label: 'Moderate', factor: 1.55, hint: 'Training 3–5 days a week' },
  very: { label: 'Very active', factor: 1.725, hint: 'Training 6–7 days a week' },
  extra: { label: 'Athlete', factor: 1.9, hint: 'Physical job plus training' },
}

/** kcal adjustment vs TDEE, protein g/kg, fat share of kcal, expected weekly change as % of body weight. */
export const PHASES: Record<Phase, { label: string; blurb: string; adjust: number; proteinPerKg: number; fatShare: number; rate: [number, number] }> = {
  bulk: { label: 'Bulk', blurb: 'Fastest muscle gain, accepts some fat gain.', adjust: 0.15, proteinPerKg: 1.8, fatShare: 0.27, rate: [0.5, 1.0] },
  lean_bulk: { label: 'Lean Bulk', blurb: 'Slow, controlled gain with minimal fat.', adjust: 0.08, proteinPerKg: 2.0, fatShare: 0.27, rate: [0.25, 0.5] },
  cut: { label: 'Cut', blurb: 'Lose fat while keeping muscle.', adjust: -0.2, proteinPerKg: 2.3, fatShare: 0.25, rate: [-1.0, -0.5] },
  maintenance: { label: 'Maintenance', blurb: 'Hold weight, consolidate strength.', adjust: 0, proteinPerKg: 1.8, fatShare: 0.3, rate: [-0.15, 0.15] },
  recomp: { label: 'Recomp', blurb: 'Slight deficit, high protein, build and lean out together.', adjust: -0.05, proteinPerKg: 2.2, fatShare: 0.27, rate: [-0.25, 0.05] },
}

/** Mifflin–St Jeor resting energy expenditure. */
export function bmr(sex: Sex, kg: number, cm: number, age: number) {
  return 10 * kg + 6.25 * cm - 5 * age + (sex === 'male' ? 5 : -161)
}

export function computeTargets(p: Pick<Profile, 'sex' | 'age' | 'height_cm' | 'activity' | 'phase'>, kg: number): Targets {
  const rest = bmr(p.sex, kg, p.height_cm, p.age)
  const tdee = rest * ACTIVITY[p.activity].factor
  const ph = PHASES[p.phase]
  const kcal = Math.round((tdee * (1 + ph.adjust)) / 10) * 10
  const protein = Math.round(kg * ph.proteinPerKg)
  const fat = Math.max(Math.round((kcal * ph.fatShare) / 9), Math.round(kg * 0.6))
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4))
  return { kcal, protein, carbs, fat, tdee: Math.round(tdee), bmr: Math.round(rest) }
}

export function effectiveTargets(p: Profile, kg: number): Targets & { overridden: boolean } {
  const auto = computeTargets(p, kg)
  return p.override ? { ...auto, ...p.override, overridden: true } : { ...auto, overridden: false }
}

export const kcalFromMacros = (protein: number, carbs: number, fat: number) => protein * 4 + carbs * 4 + fat * 9
