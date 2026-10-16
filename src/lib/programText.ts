// Turns a typed or pasted training program into split days and exercises.
//   Push day
//   Incline bench press 3x8-12
//   Lateral raise 4 sets of 15, rest 60s
import type { MuscleGroup } from './types'

export interface ProgramExercise { name: string; muscle: MuscleGroup; sets: number; repsMin: number; repsMax: number; rest: number; restGiven: boolean; line: string }
export interface ProgramDay { name: string; exercises: ProgramExercise[] }
export interface Program { title: string | null; days: ProgramDay[] }

const MUSCLE_RULES: [MuscleGroup, RegExp][] = [
  ['Calves', /calf|calves/],
  ['Core', /\babs?\b|crunch|plank|\bcore\b|leg raise|sit ?-?ups?|russian twist|ab wheel|hollow|oblique|woodchop/],
  ['Hamstrings', /leg curl|hamstring|\brdl\b|romanian|stiff|good ?morning|nordic|lying curl|seated curl/],
  ['Quads', /squat|leg press|lunge|leg extension|hack|step ?-?ups?|sissy|quad/],
  ['Glutes', /hip thrust|glute|bridge|kickback|abduct/],
  ['Triceps', /tricep|pushdown|push ?down|skull|\bdips?\b|close ?-?grip|overhead extension|french press|kick ?back/],
  ['Biceps', /curl|bicep|hammer|preacher/],
  ['Shoulders', /overhead|\bohp\b|shoulder|lateral|side raise|front raise|rear delt|face ?pull|arnold|military|upright row|delt/],
  ['Back', /\brows?\b|pull ?-?ups?|chin ?-?ups?|\blat\b|lats|pulldown|pull ?down|deadlift|shrug|pullover|back extension|hyperextension|t-?bar/],
  ['Chest', /bench|chest|pec|fl(y|ies|yes)|push ?-?ups?|incline|decline|\bpress\b/],
]

const ALIASES: Record<string, string> = {
  ohp: 'Overhead Press', rdl: 'Romanian Deadlift', rdls: 'Romanian Deadlift', bench: 'Bench Press', squat: 'Back Squat', squats: 'Back Squat',
  pullups: 'Pull-up', 'pull ups': 'Pull-up', pullup: 'Pull-up', 'pull up': 'Pull-up', chinups: 'Chin-up', 'chin ups': 'Chin-up', dl: 'Deadlift', deadlifts: 'Deadlift',
  'lat pulldown': 'Lat Pulldown', 'lat pull down': 'Lat Pulldown', dips: 'Dips', 'face pulls': 'Face Pull', 'lateral raises': 'Lateral Raise', 'lat raise': 'Lateral Raise', 'lat raises': 'Lateral Raise',
}

export const guessMuscle = (name: string): MuscleGroup => {
  const n = name.toLowerCase()
  return MUSCLE_RULES.find(([, re]) => re.test(n))?.[0] ?? 'Chest'
}

const BIG = /squat|deadlift|bench|overhead press|\bohp\b|\brows?\b|pull ?-?up|chin ?-?up|leg press|hip thrust|\brdl\b|romanian|dips?/i
export const defaultRest = (name: string, repsMax: number) => (repsMax <= 6 ? 180 : BIG.test(name) ? 120 : repsMax >= 15 ? 60 : 90)

const ABBR = new Set(['db', 'bb', 'kb', 'ez', 'rdl', 'ohp', 'sldl', 'ghr', 'jm'])
const titleCase = (s: string) => s.replace(/\b([a-z])([a-z]*)/g, (_, a: string, b: string) => (ABBR.has(a + b) ? (a + b).toUpperCase() : ['and', 'of', 'to', 'on', 'with'].includes(a + b) ? a + b : a.toUpperCase() + b))

function cleanName(raw: string) {
  const n = raw
    .replace(/\(.*?\)/g, ' ')
    .replace(/[@].*$/, ' ')
    .replace(/[:|,;–—]+/g, ' ')
    .replace(/\s-\s/g, ' ')
    .replace(/\b(sets?|reps?|x|each( side| arm| leg)?|per side)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[-\s]+|[-\s]+$/g, '')
    .trim()
  const alias = ALIASES[n.toLowerCase()]
  return alias ?? titleCase(n.toLowerCase())
}

function readRest(line: string): { secs: number; text: string } | null {
  const U = String.raw`(seconds?|secs?|s|minutes?|mins?|m)\b`
  const m = line.match(new RegExp(String.raw`(?:rest|pahinga)\s*[:=]?\s*(\d+(?:[.:]\d+)?)\s*(?:${U})?|(\d+(?:[.:]\d+)?)\s*${U}\s*(?:rest|pahinga)`, 'i'))
  if (!m) return null
  const num = m[1] ?? m[3], unit = (m[2] ?? m[4] ?? '').toLowerCase()
  let secs: number
  if (num.includes(':')) { const [a, b] = num.split(':').map(Number); secs = a * 60 + b }
  else secs = parseFloat(num) * (unit.startsWith('m') || (!unit && parseFloat(num) <= 5) ? 60 : 1)
  return { secs: Math.max(15, Math.min(600, Math.round(secs / 15) * 15)), text: m[0] }
}

function readSetsReps(line: string): { sets: number; min: number; max: number; text: string } | null {
  const range = String.raw`(\d+)(?:\s*(?:-|–|to)\s*(\d+))?`
  const tries: [RegExp, (m: RegExpMatchArray) => [number, number, number]][] = [
    [new RegExp(String.raw`(\d+)\s*sets?\s*(?:of|x|×)?\s*${range}\s*(?:reps?)?`, 'i'), (m) => [+m[1], +m[2], +(m[3] ?? m[2])]],
    [new RegExp(String.raw`(\d+)\s*[x×*]\s*${range}`, 'i'), (m) => [+m[1], +m[2], +(m[3] ?? m[2])]],
    [new RegExp(String.raw`${range}\s*reps?\s*(?:x|×|for)?\s*(\d+)\s*sets?`, 'i'), (m) => [+m[3], +m[1], +(m[2] ?? m[1])]],
    [/(\d+)\s*(?:sets?)?\s*[x×*]?\s*(?:amrap|to failure|max)/i, (m) => [+m[1], 8, 12]],
  ]
  for (const [re, pick] of tries) {
    const m = line.match(re)
    if (m) {
      const [sets, a, b] = pick(m)
      if (!sets || !a || sets > 20 || a > 100) continue
      return { sets, min: Math.min(a, b), max: Math.max(a, b), text: m[0] }
    }
  }
  return null
}

export function parseProgram(text: string): Program {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/^\s*(?:[-*•▪◦]|\d+[.)])\s*/, '').trim()).filter(Boolean)
  const days: ProgramDay[] = []
  let title: string | null = null
  let pendingHeaders: string[] = []
  for (const line of lines) {
    const sr = readSetsReps(line)
    if (!sr) {
      // A header: strip "Day 1:" style prefixes but keep the useful part ("Day 1 - Push" -> "Push").
      const h = line.replace(/[:\-–—]+\s*$/, '').trim()
      pendingHeaders.push(h)
      continue
    }
    if (pendingHeaders.length || !days.length) {
      if (pendingHeaders.length > 1 && !days.length && !title) title = pendingHeaders.shift()!
      const raw = pendingHeaders.pop()
      const name = raw ? (raw.replace(/^(day|araw)\s*\d+\s*[:\-–—.]?\s*/i, '').trim() || raw) : `Day ${days.length + 1}`
      days.push({ name: titleCase(name.toLowerCase()), exercises: [] })
      pendingHeaders = []
    }
    const rest = readRest(line)
    let nameRaw = line.replace(sr.text, ' ')
    if (rest) nameRaw = nameRaw.replace(rest.text, ' ')
    nameRaw = nameRaw.replace(/\b(rest|pahinga)\b.*$/i, ' ')
    const name = cleanName(nameRaw) || 'Exercise'
    days[days.length - 1].exercises.push({
      name, muscle: guessMuscle(name), sets: sr.sets, repsMin: sr.min, repsMax: sr.max,
      rest: rest?.secs ?? defaultRest(name, sr.max), restGiven: !!rest, line,
    })
  }
  return { title, days: days.filter((d) => d.exercises.length) }
}
