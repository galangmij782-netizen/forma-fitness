// Turns a typed or pasted training program into split days and exercises.
//   Push day
//   Incline bench press 3x8-12
//   Lateral raise 4 sets of 15, rest 60s
import type { MuscleGroup } from './types'

export interface ProgramExercise { name: string; muscle: MuscleGroup; sets: number; repsMin: number; repsMax: number; rest: number; restGiven: boolean; line: string }
export interface ProgramDay { name: string; exercises: ProgramExercise[]; weekdays?: number[] }

// Weekday 0 = Monday. English and Tagalog names and short forms.
const WEEKDAY_RE: [number, RegExp][] = [
  [0, /\b(mon(day)?|lunes)\b/i], [1, /\b(tue(s(day)?)?|martes)\b/i], [2, /\b(wed(nesday)?|miyerkules|miyerkoles)\b/i],
  [3, /\b(thu(r(s(day)?)?)?|huwebes)\b/i], [4, /\b(fri(day)?|biyernes)\b/i], [5, /\b(sat(urday)?|sabado)\b/i], [6, /\b(sun(day)?|linggo)\b/i],
]
const WEEKDAY_ANY = /\b(mon(day)?|tue(s(day)?)?|wed(nesday)?|thu(r(s(day)?)?)?|fri(day)?|sat(urday)?|sun(day)?|lunes|martes|miyerkules|miyerkoles|huwebes|biyernes|sabado|linggo)\b/gi
export const weekdaysIn = (line: string) => WEEKDAY_RE.filter(([, re]) => re.test(line)).map(([w]) => w)
/** "Lower A (Tuesday)", "Tue - Lower A", "Lower A – Tue/Fri" -> "Lower A". */
export function stripWeekdays(line: string) {
  const out = line.replace(WEEKDAY_ANY, ' ').replace(/\(\s*[\/,&+\s]*(and|at)?[\/,&+\s]*\)/gi, ' ').replace(/\s*(?:[\/,&+]|\band\b)\s*(?=[\/,&+\s]*$)/gi, ' ')
  return out.replace(/^[\s:\-–—|.,\/&+]+|[\s:\-–—|.,\/&+]+$/g, '').replace(/\s{2,}/g, ' ').trim()
}
const isRestLine = (l: string) => /\b(rest|off|recovery|pahinga|walang gym)\b/i.test(stripWeekdays(l)) && !/\d\s*[x×]/.test(l)
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

const dayKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '')

export function parseProgram(text: string): Program {
  const overview: { weekdays: number[]; key: string }[] = []
  const lines = text.split(/\r?\n/).map((l) => l.replace(/^\s*(?:[-*•▪◦]|\d+[.)])\s*/, '').trim()).filter(Boolean)
  const days: ProgramDay[] = []
  let title: string | null = null
  let pendingHeaders: string[] = []
  for (const line of lines) {
    const sr = readSetsReps(line)
    if (!sr) {
      // "Rest: 2-3 min" on its own line belongs to the exercise above it.
      const lastDay = days[days.length - 1], lastEx = lastDay?.exercises[lastDay.exercises.length - 1]
      const rest = readRest(line)
      if (rest && lastEx && !pendingHeaders.length && line.length < 40) { lastEx.rest = rest.secs; lastEx.restGiven = true; continue }
      // Coaching notes are not day names.
      if (lastEx && !pendingHeaders.length && /^(notes?|tips?|cues?|focus|tempo|warm[ -]?up|cool[ -]?down|rpe|rir|progression|superset)\b/i.test(line)) continue
      if (weekdaysIn(line).length && !isRestLine(line) && stripWeekdays(line)) overview.push({ weekdays: weekdaysIn(line), key: dayKey(stripWeekdays(line).replace(/^(day|araw)\s*\d+\s*[:\-–—.]?\s*/i, '')) })
      // A header: strip "Day 1:" style prefixes but keep the useful part ("Day 1 - Push" -> "Push").
      const h = line.replace(/[:\-–—]+\s*$/, '').trim()
      pendingHeaders.push(h)
      continue
    }
    if (pendingHeaders.length || !days.length) {
      if (pendingHeaders.length > 1 && !days.length && !title && !weekdaysIn(pendingHeaders[0]).length && !/^(week|linggo)\s*\d/i.test(pendingHeaders[0])) title = pendingHeaders.shift()!
      // Weekday names in this day's own header ("Lower A (Tuesday)", or "Tuesday" on the line above it).
      const own = pendingHeaders.filter((h) => !isRestLine(h))
      const raw = own.pop()
      const wk = raw ? weekdaysIn(raw) : []
      if (raw && !wk.length && own.length && weekdaysIn(own[own.length - 1]).length && !stripWeekdays(own[own.length - 1])) wk.push(...weekdaysIn(own[own.length - 1]))
      const plain = raw ? stripWeekdays(raw) || raw : ''
      const name = plain ? (plain.replace(/^(day|araw)\s*\d+\s*[:\-–—.]?\s*/i, '').trim() || plain) : `Day ${days.length + 1}`
      days.push({ name: titleCase(name.toLowerCase()), exercises: [], weekdays: wk })
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
  // Programs written week by week repeat the same day ("Week 1 ... Lower A ... Week 2 ... Lower A").
  // A split day is a template, so keep the first one of each name.
  // Repeats of the same day add their weekdays to the first one.
  const byKey = new Map<string, ProgramDay>()
  for (const d of days) {
    if (!d.exercises.length) continue
    const key = dayKey(d.name)
    const first = byKey.get(key)
    if (first) first.weekdays = [...new Set([...(first.weekdays ?? []), ...(d.weekdays ?? [])])]
    else byKey.set(key, d)
  }
  const unique = [...byKey.values()]
  // A weekly overview ("Mon - Rest, Tue - Lower A") fills in weekdays the day headers left out.
  for (const o of overview) {
    const d = byKey.get(o.key)
    if (d) d.weekdays = [...new Set([...(d.weekdays ?? []), ...o.weekdays])]
  }
  // One day per weekday: the first day that claims it keeps it.
  const taken = new Set<number>()
  for (const d of unique) { d.weekdays = (d.weekdays ?? []).filter((w) => !taken.has(w)).sort(); d.weekdays.forEach((w) => taken.add(w)) }
  return { title, days: unique }
}
