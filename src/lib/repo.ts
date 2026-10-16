import { all, get, getSetting, run, setSetting, tx } from './db'
import { addDays, nowTime, today } from './dates'
import type { DayExercise, Exercise, Food, Meal, MealItem, MuscleGroup, Profile, Session, SetRow, Split, SplitDay, WeightEntry } from './types'
import type { DayTotals } from './insights'

// ---------- profile ----------
export const DEFAULT_PROFILE: Profile = {
  sex: 'male', age: 28, height_cm: 178, activity: 'moderate', phase: 'lean_bulk',
  override: null, units: 'kg', theme: 'dark', model: 'claude-opus-5-5', active_split_id: null, onboarded: false,
}
export const getProfile = (): Profile => ({ ...DEFAULT_PROFILE, ...getSetting<Partial<Profile>>('profile', {}) })
export const saveProfile = (patch: Partial<Profile>) => setSetting('profile', { ...getProfile(), ...patch })

// ---------- exercises ----------
export const listExercises = () => all<Exercise>('SELECT * FROM exercises ORDER BY name')
export function ensureExercise(name: string, muscle: MuscleGroup): number {
  const found = get<{ id: number }>('SELECT id FROM exercises WHERE name = ?', [name.trim()])
  if (found) return found.id
  return run('INSERT INTO exercises(name, muscle) VALUES(?, ?)', [name.trim(), muscle])
}

// ---------- splits ----------
export const listSplits = () => all<Split & { days: number; exercises: number }>(`
  SELECT s.*, (SELECT COUNT(*) FROM split_days d WHERE d.split_id = s.id) AS days,
    (SELECT COUNT(*) FROM day_exercises e JOIN split_days d ON d.id = e.day_id WHERE d.split_id = s.id) AS exercises
  FROM splits s ORDER BY s.position, s.id`)

export const getSplit = (id: number) => get<Split>('SELECT * FROM splits WHERE id = ?', [id])
export const listDays = (splitId: number) => all<SplitDay>('SELECT * FROM split_days WHERE split_id = ? ORDER BY position, id', [splitId])
export const dayExercises = (dayId: number) => all<DayExercise>(`
  SELECT de.*, e.name, e.muscle FROM day_exercises de JOIN exercises e ON e.id = de.exercise_id
  WHERE de.day_id = ? ORDER BY de.position, de.id`, [dayId])

export const splitMuscles = (splitId: number) => all<{ muscle: MuscleGroup }>(`
  SELECT DISTINCT e.muscle FROM day_exercises de JOIN exercises e ON e.id = de.exercise_id
  JOIN split_days d ON d.id = de.day_id WHERE d.split_id = ?`, [splitId]).map((r) => r.muscle)

type TemplateEx = [string, MuscleGroup, number, number, number, number]
export const TEMPLATES: Record<string, { name: string; description: string; days: { name: string; ex: TemplateEx[] }[] }> = {
  ppl: {
    name: 'Push / Pull / Legs', description: 'Six-day rotation built around the big presses, pulls and squats.',
    days: [
      { name: 'Push', ex: [['Bench Press', 'Chest', 4, 6, 8, 150], ['Overhead Press', 'Shoulders', 3, 6, 10, 120], ['Incline Dumbbell Press', 'Chest', 3, 8, 12, 90], ['Lateral Raise', 'Shoulders', 3, 12, 15, 60], ['Triceps Pushdown', 'Triceps', 3, 10, 12, 60]] },
      { name: 'Pull', ex: [['Deadlift', 'Back', 3, 4, 6, 180], ['Pull-up', 'Back', 3, 6, 10, 120], ['Barbell Row', 'Back', 3, 8, 10, 90], ['Face Pull', 'Shoulders', 3, 12, 15, 60], ['Barbell Curl', 'Biceps', 3, 8, 12, 60]] },
      { name: 'Legs', ex: [['Back Squat', 'Quads', 4, 5, 8, 180], ['Romanian Deadlift', 'Hamstrings', 3, 8, 10, 120], ['Leg Press', 'Quads', 3, 10, 12, 90], ['Leg Curl', 'Hamstrings', 3, 10, 12, 60], ['Standing Calf Raise', 'Calves', 4, 10, 15, 60]] },
    ],
  },
  ul: {
    name: 'Upper / Lower', description: 'Four days a week, each muscle trained twice.',
    days: [
      { name: 'Upper A', ex: [['Bench Press', 'Chest', 4, 5, 8, 150], ['Barbell Row', 'Back', 4, 6, 10, 120], ['Overhead Press', 'Shoulders', 3, 8, 10, 90], ['Barbell Curl', 'Biceps', 2, 10, 12, 60]] },
      { name: 'Lower A', ex: [['Back Squat', 'Quads', 4, 5, 8, 180], ['Romanian Deadlift', 'Hamstrings', 3, 8, 10, 120], ['Standing Calf Raise', 'Calves', 3, 10, 15, 60]] },
      { name: 'Upper B', ex: [['Incline Dumbbell Press', 'Chest', 3, 8, 12, 90], ['Pull-up', 'Back', 3, 6, 10, 120], ['Lateral Raise', 'Shoulders', 3, 12, 15, 60], ['Triceps Pushdown', 'Triceps', 3, 10, 12, 60]] },
      { name: 'Lower B', ex: [['Deadlift', 'Back', 3, 3, 5, 180], ['Leg Press', 'Quads', 3, 10, 12, 90], ['Leg Curl', 'Hamstrings', 3, 10, 12, 60], ['Hanging Leg Raise', 'Core', 3, 10, 15, 60]] },
    ],
  },
  full: {
    name: 'Full Body', description: 'Three days a week, every session hits everything.',
    days: [
      { name: 'Day A', ex: [['Back Squat', 'Quads', 3, 5, 8, 150], ['Bench Press', 'Chest', 3, 5, 8, 120], ['Barbell Row', 'Back', 3, 8, 10, 90]] },
      { name: 'Day B', ex: [['Deadlift', 'Back', 3, 4, 6, 180], ['Overhead Press', 'Shoulders', 3, 6, 10, 120], ['Pull-up', 'Back', 3, 6, 10, 90]] },
    ],
  },
}

export function createSplit(templateKey: string | null, name?: string): number {
  const t = templateKey ? TEMPLATES[templateKey] : null
  const pos = (get<{ m: number }>('SELECT COALESCE(MAX(position), -1) + 1 AS m FROM splits')?.m ?? 0)
  const exIds = new Map<string, number>()
  if (t) for (const d of t.days) for (const [n, m] of d.ex) if (!exIds.has(n)) exIds.set(n, ensureExercise(n, m))
  return tx((exec) => {
    const sid = exec('INSERT INTO splits(name, description, position, created_at) VALUES(?, ?, ?, ?)', [name ?? t?.name ?? 'New split', t?.description ?? '', pos, new Date().toISOString()])
    const days = t?.days ?? [{ name: 'Day 1', ex: [] }]
    days.forEach((d, i) => {
      const did = exec('INSERT INTO split_days(split_id, name, position) VALUES(?, ?, ?)', [sid, d.name, i])
      d.ex.forEach(([n, , sets, rmin, rmax, rest], j) =>
        exec('INSERT INTO day_exercises(day_id, exercise_id, position, sets, reps_min, reps_max, rest_sec) VALUES(?,?,?,?,?,?,?)', [did, exIds.get(n)!, j, sets, rmin, rmax, rest]))
    })
    return sid
  })
}

export function duplicateSplit(id: number): number {
  const s = getSplit(id)!
  const days = listDays(id)
  return tx((exec) => {
    const sid = exec('INSERT INTO splits(name, description, position, created_at) VALUES(?, ?, ?, ?)', [`${s.name} (copy)`, s.description, s.position + 1, new Date().toISOString()])
    for (const d of days) {
      const did = exec('INSERT INTO split_days(split_id, name, position) VALUES(?, ?, ?)', [sid, d.name, d.position])
      for (const e of dayExercises(d.id))
        exec('INSERT INTO day_exercises(day_id, exercise_id, position, sets, reps_min, reps_max, rest_sec) VALUES(?,?,?,?,?,?,?)', [did, e.exercise_id, e.position, e.sets, e.reps_min, e.reps_max, e.rest_sec])
    }
    return sid
  })
}

export const updateSplit = (id: number, patch: { name?: string; description?: string }) => {
  if (patch.name !== undefined) run('UPDATE splits SET name = ? WHERE id = ?', [patch.name, id])
  if (patch.description !== undefined) run('UPDATE splits SET description = ? WHERE id = ?', [patch.description, id])
}
export const deleteSplit = (id: number) => run('DELETE FROM splits WHERE id = ?', [id])
export const addDay = (splitId: number, name: string) =>
  run('INSERT INTO split_days(split_id, name, position) VALUES(?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM split_days WHERE split_id = ?))', [splitId, name, splitId])
export const renameDay = (id: number, name: string) => run('UPDATE split_days SET name = ? WHERE id = ?', [name, id])
export const deleteDay = (id: number) => run('DELETE FROM split_days WHERE id = ?', [id])
export const reorder = (table: 'split_days' | 'day_exercises' | 'splits', ids: number[]) =>
  tx((exec) => ids.forEach((id, i) => exec(`UPDATE ${table} SET position = ? WHERE id = ?`, [i, id])))

export function addDayExercise(dayId: number, exerciseId: number) {
  return run(`INSERT INTO day_exercises(day_id, exercise_id, position, sets, reps_min, reps_max, rest_sec)
    VALUES(?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM day_exercises WHERE day_id = ?), 3, 8, 12, 90)`, [dayId, exerciseId, dayId])
}
export const updateDayExercise = (id: number, p: Partial<Pick<DayExercise, 'sets' | 'reps_min' | 'reps_max' | 'rest_sec'>>) => {
  const cur = get<DayExercise>('SELECT * FROM day_exercises WHERE id = ?', [id])!
  const n = { ...cur, ...p }
  run('UPDATE day_exercises SET sets = ?, reps_min = ?, reps_max = ?, rest_sec = ? WHERE id = ?', [n.sets, n.reps_min, Math.max(n.reps_min, n.reps_max), n.rest_sec, id])
}
export const removeDayExercise = (id: number) => run('DELETE FROM day_exercises WHERE id = ?', [id])

// ---------- sessions ----------
export const activeSession = () => get<Session>('SELECT * FROM sessions WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1')
export const getSession = (id: number) => get<Session>('SELECT * FROM sessions WHERE id = ?', [id])
export const listSessions = (limit = 30) => all<Session & { sets: number; volume: number }>(`
  SELECT s.*, COUNT(x.id) AS sets, COALESCE(SUM(x.weight * x.reps), 0) AS volume
  FROM sessions s LEFT JOIN sets x ON x.session_id = s.id WHERE s.ended_at IS NOT NULL
  GROUP BY s.id ORDER BY s.date DESC, s.id DESC LIMIT ?`, [limit])

export function startSession(dayId: number) {
  const d = get<SplitDay & { split_name: string }>('SELECT d.*, s.name AS split_name FROM split_days d JOIN splits s ON s.id = d.split_id WHERE d.id = ?', [dayId])!
  return run('INSERT INTO sessions(day_id, day_name, split_name, date, started_at) VALUES(?, ?, ?, ?, ?)', [dayId, d.name, d.split_name, today(), new Date().toISOString()])
}
export const finishSession = (id: number) => {
  const count = get<{ n: number }>('SELECT COUNT(*) AS n FROM sets WHERE session_id = ?', [id])!.n
  if (count === 0) run('DELETE FROM sessions WHERE id = ?', [id])
  else run('UPDATE sessions SET ended_at = ? WHERE id = ?', [new Date().toISOString(), id])
}
export const deleteSession = (id: number) => run('DELETE FROM sessions WHERE id = ?', [id])

export const sessionSets = (sessionId: number) => all<SetRow>('SELECT x.*, s.date FROM sets x JOIN sessions s ON s.id = x.session_id WHERE x.session_id = ? ORDER BY x.exercise_id, x.set_index', [sessionId])
export const logSet = (sessionId: number, exerciseId: number, setIndex: number, weight: number, reps: number, tmin: number, tmax: number) =>
  run('INSERT INTO sets(session_id, exercise_id, set_index, weight, reps, target_min, target_max) VALUES(?,?,?,?,?,?,?)', [sessionId, exerciseId, setIndex, weight, reps, tmin, tmax])
export const deleteSet = (id: number) => run('DELETE FROM sets WHERE id = ?', [id])

/** Sets for an exercise from finished sessions plus, optionally, everything before a given session. */
export const exerciseHistory = (exerciseId: number, excludeSession?: number) => all<SetRow>(`
  SELECT x.*, s.date FROM sets x JOIN sessions s ON s.id = x.session_id
  WHERE x.exercise_id = ? AND s.id != ? ORDER BY s.date, x.session_id, x.set_index`, [exerciseId, excludeSession ?? -1])

export const lastPerformance = (exerciseId: number, excludeSession: number) => {
  const last = get<{ session_id: number }>(`SELECT x.session_id FROM sets x JOIN sessions s ON s.id = x.session_id
    WHERE x.exercise_id = ? AND s.id != ? ORDER BY s.date DESC, s.id DESC LIMIT 1`, [exerciseId, excludeSession])
  return last ? all<SetRow>('SELECT x.*, s.date FROM sets x JOIN sessions s ON s.id = x.session_id WHERE x.session_id = ? AND x.exercise_id = ? ORDER BY set_index', [last.session_id, exerciseId]) : []
}

export const allSets = () => all<SetRow & { name: string; muscle: MuscleGroup }>(`
  SELECT x.*, s.date, e.name, e.muscle FROM sets x JOIN sessions s ON s.id = x.session_id JOIN exercises e ON e.id = x.exercise_id
  ORDER BY s.date, x.session_id, x.set_index`)

export const trainedExercises = () => all<Exercise & { sessions: number; last: string }>(`
  SELECT e.*, COUNT(DISTINCT x.session_id) AS sessions, MAX(s.date) AS last FROM exercises e
  JOIN sets x ON x.exercise_id = e.id JOIN sessions s ON s.id = x.session_id GROUP BY e.id ORDER BY sessions DESC, e.name`)

/** The split day that comes after the most recently trained one. */
export function nextDay(splitId: number): SplitDay | undefined {
  const days = listDays(splitId)
  if (!days.length) return undefined
  const last = get<{ day_id: number }>(`SELECT s.day_id FROM sessions s JOIN split_days d ON d.id = s.day_id WHERE d.split_id = ? AND s.ended_at IS NOT NULL ORDER BY s.date DESC, s.id DESC LIMIT 1`, [splitId])
  if (!last) return days[0]
  const i = days.findIndex((d) => d.id === last.day_id)
  return days[(i + 1) % days.length]
}

// ---------- body weight ----------
export const listWeights = () => all<WeightEntry>('SELECT * FROM bodyweight ORDER BY date')
export const latestWeight = () => get<WeightEntry>('SELECT * FROM bodyweight ORDER BY date DESC LIMIT 1')
export const logWeight = (date: string, kg: number) =>
  run('INSERT INTO bodyweight(date, kg) VALUES(?, ?) ON CONFLICT(date) DO UPDATE SET kg = excluded.kg', [date, kg])
export const deleteWeight = (id: number) => run('DELETE FROM bodyweight WHERE id = ?', [id])

// ---------- meals ----------
export function mealsOn(date: string): Meal[] {
  const meals = all<Omit<Meal, 'items'>>('SELECT * FROM meals WHERE date = ? ORDER BY time, id', [date])
  return meals.map((m) => ({ ...m, items: all<MealItem>('SELECT * FROM meal_items WHERE meal_id = ? ORDER BY id', [m.id]) }))
}

export function saveMeal(meal: { id?: number; date: string; time?: string; name: string; source: 'photo' | 'manual'; photo?: string | null; items: MealItem[] }) {
  return tx((exec) => {
    let id = meal.id
    if (id) {
      exec('UPDATE meals SET name = ?, time = ? WHERE id = ?', [meal.name, meal.time ?? nowTime(), id])
      exec('DELETE FROM meal_items WHERE meal_id = ?', [id])
    } else {
      id = exec('INSERT INTO meals(date, time, name, source, photo) VALUES(?, ?, ?, ?, ?)', [meal.date, meal.time ?? nowTime(), meal.name, meal.source, meal.photo ?? null])
    }
    for (const it of meal.items) {
      exec('INSERT INTO meal_items(meal_id, name, grams, kcal, protein, carbs, fat, confidence, food_id) VALUES(?,?,?,?,?,?,?,?,?)',
        [id, it.name, it.grams, it.kcal, it.protein, it.carbs, it.fat, it.confidence ?? null, it.food_id ?? null])
      // Every logged item becomes a reusable food (per its logged portion).
      exec(`INSERT INTO foods(name, grams, kcal, protein, carbs, fat, last_used, uses) VALUES(?,?,?,?,?,?,?,1)
        ON CONFLICT(name) DO UPDATE SET grams = excluded.grams, kcal = excluded.kcal, protein = excluded.protein, carbs = excluded.carbs, fat = excluded.fat, last_used = excluded.last_used, uses = uses + 1`,
        [it.name, it.grams, it.kcal, it.protein, it.carbs, it.fat, new Date().toISOString()])
    }
    return id
  })
}
export const deleteMeal = (id: number) => run('DELETE FROM meals WHERE id = ?', [id])

export function dayTotals(from: string, to: string): DayTotals[] {
  const rows = all<DayTotals>(`SELECT m.date, SUM(i.kcal) AS kcal, SUM(i.protein) AS protein, SUM(i.carbs) AS carbs, SUM(i.fat) AS fat
    FROM meals m JOIN meal_items i ON i.meal_id = m.id WHERE m.date BETWEEN ? AND ? GROUP BY m.date`, [from, to])
  const map = new Map(rows.map((r) => [r.date, r]))
  const out: DayTotals[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(map.get(d) ?? { date: d, kcal: 0, protein: 0, carbs: 0, fat: 0 })
  return out
}

// ---------- foods ----------
export const searchFoods = (q: string) => all<Food>(`SELECT * FROM foods WHERE name LIKE ? ORDER BY favorite DESC, uses DESC, name LIMIT 30`, [`%${q}%`])
export const allFoods = () => all<Food>('SELECT * FROM foods ORDER BY uses DESC LIMIT 1000')
export const recentFoods = () => all<Food>('SELECT * FROM foods WHERE last_used IS NOT NULL ORDER BY last_used DESC LIMIT 12')
export const favoriteFoods = () => all<Food>('SELECT * FROM foods WHERE favorite = 1 ORDER BY name')
export const toggleFavorite = (id: number) => run('UPDATE foods SET favorite = 1 - favorite WHERE id = ?', [id])
export const saveFood = (f: Omit<Food, 'id' | 'favorite' | 'last_used' | 'uses'>) =>
  run(`INSERT INTO foods(name, grams, kcal, protein, carbs, fat, favorite) VALUES(?,?,?,?,?,?,1)
    ON CONFLICT(name) DO UPDATE SET grams = excluded.grams, kcal = excluded.kcal, protein = excluded.protein, carbs = excluded.carbs, fat = excluded.fat, favorite = 1`,
    [f.name, f.grams, f.kcal, f.protein, f.carbs, f.fat])
export const deleteFood = (id: number) => run('DELETE FROM foods WHERE id = ?', [id])
