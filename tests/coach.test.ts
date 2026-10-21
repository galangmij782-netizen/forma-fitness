import { describe, expect, it } from 'vitest'
import { coachDay, mealNote } from '../src/lib/coach'
import type { Meal, MealItem } from '../src/lib/types'

const item = (name: string, kcal: number, protein: number, carbs = 0, fat = 0): MealItem => ({ name, grams: 100, kcal, protein, carbs, fat })
const meal = (name: string, items: MealItem[]): Meal => ({ id: 1, date: '2026-10-16', time: '08:00', name, source: 'manual', photo: null, items })
const targets = { kcal: 2800, protein: 160, carbs: 350, fat: 80, tdee: 2600, bmr: 1800 }
const base = { targets, phase: 'lean_bulk' as const, trainedToday: false, bodyweightKg: 75, hour: 14, isToday: true }

describe('coach', () => {
  it('flags low protein with concrete foods and low-protein meals', () => {
    const tips = coachDay({ ...base, meals: [meal('Breakfast', [item('White bread', 300, 9, 50)]), meal('Lunch', [item('Pancit', 400, 12, 60)])] })
    const ids = tips.map((t) => t.id)
    expect(ids).toContain('protein-low')
    expect(ids).toContain('protein-spread')
    expect(ids).toContain('produce')
    expect(tips.find((t) => t.id === 'protein-low')!.detail).toMatch(/chicken breast/)
  })
  it('notices sweet drinks, alcohol and salty food, without matching words inside other words', () => {
    const tips = coachDay({ ...base, meals: [meal('Dinner', [item('Milk tea', 375, 3, 75), item('Beer', 140, 1, 12), item('Tocino', 300, 18), item('Longganisa', 300, 12)]), meal('Snack', [item('Champorado', 300, 7, 60)])] })
    const ids = tips.map((t) => t.id)
    expect(ids).toEqual(expect.arrayContaining(['drinks', 'alcohol', 'sodium']))
    expect(tips.find((t) => t.id === 'sodium')!.detail).not.toMatch(/Champorado/)
  })
  it('does not mistake gin-, rum- or wine-starting dishes for alcohol', () => {
    const tips = coachDay({ ...base, meals: [meal('Lunch', [item('Ginisang sayote', 70, 3, 6), item('Ginataang gulay', 150, 3, 10), item('Ginger tea', 20, 0, 5)])] })
    expect(tips.map((t) => t.id)).not.toContain('alcohol')
    const drunk = coachDay({ ...base, meals: [meal('Night', [item('Ginebra gin', 200, 0, 0), item('Red Horse beers', 300, 2, 20)])] })
    expect(drunk.map((t) => t.id)).toContain('alcohol')
  })
  it('praises a good meal note', () => {
    expect(mealNote([item('Chicken breast', 330, 62)])).toMatch(/62 g protein/)
    expect(mealNote([item('White rice', 400, 8, 88)])).toMatch(/Only 8 g/)
  })
})
