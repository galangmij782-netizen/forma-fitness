export type Phase = 'bulk' | 'lean_bulk' | 'cut' | 'maintenance' | 'recomp'
export type Sex = 'male' | 'female'
export type Activity = 'sedentary' | 'light' | 'moderate' | 'very' | 'extra'
export type Confidence = 'low' | 'medium' | 'high'

export const MUSCLE_GROUPS = ['Chest', 'Back', 'Shoulders', 'Quads', 'Hamstrings', 'Glutes', 'Biceps', 'Triceps', 'Calves', 'Core'] as const
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number]

export interface Exercise { id: number; name: string; muscle: MuscleGroup }
export interface Split { id: number; name: string; description: string; position: number; created_at: string }
export interface SplitDay { id: number; split_id: number; name: string; position: number }
export interface DayExercise {
  id: number; day_id: number; exercise_id: number; position: number
  sets: number; reps_min: number; reps_max: number; rest_sec: number
  name: string; muscle: MuscleGroup
}
export interface Session { id: number; day_id: number | null; day_name: string; split_name: string; date: string; started_at: string; ended_at: string | null }
export interface SetRow { id: number; session_id: number; exercise_id: number; set_index: number; weight: number; reps: number; target_min: number; target_max: number; date: string }
export interface WeightEntry { id: number; date: string; kg: number }
export interface Food { id: number; name: string; kcal: number; protein: number; carbs: number; fat: number; grams: number; favorite: number; last_used: string | null; uses: number }
export interface MealItem { id?: number; name: string; grams: number; kcal: number; protein: number; carbs: number; fat: number; confidence?: Confidence | null; food_id?: number | null; base_grams?: number }
export interface Meal { id: number; date: string; time: string; name: string; source: 'photo' | 'manual'; photo: string | null; items: MealItem[] }

export interface MealAnalysis {
  meal_name: string
  notes: string
  items: { name: string; grams: number; kcal: number; protein_g: number; carbs_g: number; fat_g: number; confidence: Confidence }[]
}

export interface Profile {
  sex: Sex; age: number; height_cm: number; activity: Activity; phase: Phase
  override: null | { kcal: number; protein: number; carbs: number; fat: number }
  units: 'kg' | 'lb'
  theme: 'dark' | 'light' | 'system'
  model: string
  active_split_id: number | null
  onboarded: boolean
}

export interface Targets { kcal: number; protein: number; carbs: number; fat: number; tdee: number; bmr: number }
