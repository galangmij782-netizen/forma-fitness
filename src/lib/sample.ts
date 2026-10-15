// Realistic sample data so every screen can be explored before real logging starts.
import { tx } from './db'
import { addDays, today } from './dates'
import { createSplit, dayExercises, listDays, saveProfile } from './repo'

function rng(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
}

const FOODS = {
  oats: { name: 'Oats with milk and banana', grams: 380, kcal: 520, protein: 22, carbs: 86, fat: 10 },
  eggs: { name: 'Scrambled eggs on toast', grams: 260, kcal: 480, protein: 30, carbs: 34, fat: 24 },
  yogurt: { name: 'Greek yogurt with berries', grams: 250, kcal: 230, protein: 24, carbs: 26, fat: 3 },
  chicken: { name: 'Chicken rice bowl', grams: 450, kcal: 720, protein: 56, carbs: 88, fat: 14 },
  salmon: { name: 'Salmon, potatoes and greens', grams: 480, kcal: 690, protein: 44, carbs: 58, fat: 28 },
  pasta: { name: 'Beef ragù pasta', grams: 420, kcal: 780, protein: 42, carbs: 96, fat: 22 },
  shake: { name: 'Whey shake with milk', grams: 330, kcal: 260, protein: 36, carbs: 14, fat: 6 },
  wrap: { name: 'Turkey wrap', grams: 280, kcal: 510, protein: 34, carbs: 48, fat: 18 },
  nuts: { name: 'Mixed nuts', grams: 40, kcal: 250, protein: 8, carbs: 8, fat: 21 },
}

export function loadSampleData() {
  const r = rng(42)
  createSplit('ul')
  const splitId = createSplit('ppl')
  const days = listDays(splitId)
  const plan = days.map((d) => ({ day: d, ex: dayExercises(d.id) }))

  // Per-exercise starting weight, progression per session and behaviour.
  const behaviour: Record<string, { start: number; step: number; mode?: 'stall' | 'regress' | 'miss' }> = {
    'Bench Press': { start: 80, step: 1.25 },
    'Overhead Press': { start: 50, step: 0, mode: 'stall' },
    'Incline Dumbbell Press': { start: 28, step: 0.5 },
    'Lateral Raise': { start: 10, step: 0.15 },
    'Triceps Pushdown': { start: 25, step: 0.5 },
    'Deadlift': { start: 150, step: 2.5, mode: 'regress' },
    'Pull-up': { start: 5, step: 0.5 },
    'Barbell Row': { start: 70, step: 1.25 },
    'Face Pull': { start: 20, step: 0.3 },
    'Barbell Curl': { start: 32.5, step: 0.5, mode: 'miss' },
    'Back Squat': { start: 110, step: 2.5 },
    'Romanian Deadlift': { start: 100, step: 1.25 },
    'Leg Press': { start: 180, step: 2.5 },
    'Leg Curl': { start: 40, step: 0.5 },
    'Standing Calf Raise': { start: 60, step: 1 },
  }
  const count: Record<string, number> = {}
  const end = today()
  const start = addDays(end, -56)

  tx((exec) => {
    let dayIdx = 0
    for (let d = start, n = 0; d < end; d = addDays(d, 1), n++) {
      if (n % 4 === 3) continue // a rest day every fourth day
      const { day, ex } = plan[dayIdx % plan.length]
      dayIdx++
      const startedAt = `${d}T18:${String(Math.floor(r() * 50)).padStart(2, '0')}:00`
      const sid = exec('INSERT INTO sessions(day_id, day_name, split_name, date, started_at, ended_at) VALUES(?,?,?,?,?,?)', [day.id, day.name, 'Push / Pull / Legs', d, startedAt, startedAt])
      const weeksLeft = (56 - n) / 7
      for (const e of ex) {
        const b = behaviour[e.name]
        const k = (count[e.name] = (count[e.name] ?? 0) + 1)
        let w = b.start + b.step * (k - 1)
        if (b.mode === 'regress' && weeksLeft < 2.2) w = b.start + b.step * 8 - 10
        w = Math.round(w / 1.25) * 1.25
        for (let s = 0; s < e.sets; s++) {
          let reps = Math.round(e.reps_min + r() * (e.reps_max - e.reps_min))
          if (b.mode === 'stall') reps = 7 - (s > 1 ? 1 : 0)
          if (b.mode === 'miss') reps = e.reps_min - 1 - Math.round(r())
          if (b.mode === 'regress' && weeksLeft < 2.2) reps = Math.max(2, e.reps_min - 1)
          if (s === e.sets - 1 && r() < 0.3) reps = Math.max(1, reps - 1)
          exec('INSERT INTO sets(session_id, exercise_id, set_index, weight, reps, target_min, target_max) VALUES(?,?,?,?,?,?,?)', [sid, e.exercise_id, s, w, reps, e.reps_min, e.reps_max])
        }
      }
    }

    // Body weight: lean bulk at roughly +0.3% a week, with daily water noise.
    for (let i = 60; i >= 0; i--) {
      if (r() < 0.12) continue
      const kg = 76 + (60 - i) * 0.033 + (r() - 0.5) * 0.9
      exec('INSERT OR REPLACE INTO bodyweight(date, kg) VALUES(?, ?)', [addDays(end, -i), Math.round(kg * 10) / 10])
    }

    // Meals for the past week and the first part of today.
    const meal = (date: string, time: string, f: (typeof FOODS)[keyof typeof FOODS], scale = 1) => {
      const mid = exec('INSERT INTO meals(date, time, name, source) VALUES(?,?,?,?)', [date, time, f.name, 'manual'])
      exec('INSERT INTO meal_items(meal_id, name, grams, kcal, protein, carbs, fat) VALUES(?,?,?,?,?,?,?)',
        [mid, f.name, Math.round(f.grams * scale), Math.round(f.kcal * scale), +(f.protein * scale).toFixed(1), +(f.carbs * scale).toFixed(1), +(f.fat * scale).toFixed(1)])
      exec(`INSERT INTO foods(name, grams, kcal, protein, carbs, fat, last_used, uses, favorite) VALUES(?,?,?,?,?,?,?,1,?)
        ON CONFLICT(name) DO UPDATE SET uses = uses + 1, last_used = excluded.last_used`, [f.name, f.grams, f.kcal, f.protein, f.carbs, f.fat, `${date}T${time}:00`, f === FOODS.shake ? 1 : 0])
    }
    const breakfasts = [FOODS.oats, FOODS.eggs]
    const lunches = [FOODS.chicken, FOODS.wrap]
    const dinners = [FOODS.salmon, FOODS.pasta, FOODS.chicken]
    for (let i = 7; i >= 1; i--) {
      const d = addDays(end, -i)
      meal(d, '08:10', breakfasts[i % 2])
      meal(d, '12:45', lunches[i % 2], 1.1 + r() * 0.3)
      if (i % 3 !== 0) meal(d, '16:30', FOODS.shake)
      else meal(d, '16:30', FOODS.nuts)
      meal(d, '19:40', dinners[i % 3], 1.1 + r() * 0.3)
      if (i % 3 === 1) meal(d, '10:30', FOODS.nuts)
      if (i % 2) meal(d, '21:30', FOODS.yogurt)
    }
    meal(end, '08:05', FOODS.oats)
    meal(end, '12:30', FOODS.chicken)
  })

  saveProfile({ active_split_id: splitId, onboarded: true, sex: 'male', age: 28, height_cm: 178, activity: 'moderate', phase: 'lean_bulk' })
}
