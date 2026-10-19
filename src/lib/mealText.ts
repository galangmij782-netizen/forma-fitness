// Turns typed meals like "2 medium eggs scrambled, 1 tbsp butter, 1 mug coffee"
// into meal items, using the built-in food table plus the user's own saved foods.
import { FOODS, type BuiltinFood, type UnitKey } from './foodDb'
import type { Food, MealItem } from './types'

export interface Suggestion { kind: 'builtin' | 'saved'; name: string; id?: number }

export interface ParsedLine {
  text: string
  item: MealItem | null
  /** how the portion was read, e.g. "2 medium (88 g)" */
  portion: string
  assumed: boolean
  /** some words of the entry were not explained by the food that matched ("shrimp sinigang" -> Shrimp) */
  unsure?: boolean
  /** other foods it might be, best first */
  suggestions?: Suggestion[]
  /** the food words of the entry, used to remember the user's pick */
  key?: string
}

/** Foods the user picked for an entry before: food words -> food. */
export type Learned = Record<string, Suggestion>

const NUM_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, isa: 1, isang: 1, two: 2, dalawa: 2, dalawang: 2, three: 3, tatlo: 3, tatlong: 3, four: 4, apat: 4, apat_na: 4,
  five: 5, lima: 5, limang: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  half: 0.5, kalahati: 0.5, kalahating: 0.5, third: 1 / 3, quarter: 0.25, couple: 2, few: 3, dozen: 12,
}
const FRACTIONS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 }

const UNIT_WORDS: Record<string, UnitKey | 'g' | 'kg' | 'oz' | 'lb' | 'ml' | 'l'> = {
  g: 'g', gr: 'g', gram: 'g', grams: 'g', grm: 'g', grms: 'g', kg: 'kg', kilo: 'kg', kilos: 'kg',
  oz: 'oz', ounce: 'oz', ounces: 'oz', lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  ml: 'ml', milliliter: 'ml', milliliters: 'ml', l: 'l', liter: 'l', liters: 'l', litre: 'l', litres: 'l',
  cup: 'cup', cups: 'cup', tasa: 'cup', mug: 'mug', mugs: 'mug', glass: 'glass', glasses: 'glass', baso: 'glass',
  tbsp: 'tbsp', tbsps: 'tbsp', tbs: 'tbsp', tbl: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp', kutsara: 'tbsp',
  tsp: 'tsp', tsps: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp', kutsarita: 'tsp',
  slice: 'slice', slices: 'slice', piece: 'piece', pieces: 'piece', pc: 'piece', pcs: 'piece', strip: 'piece', strips: 'piece',
  fillet: 'piece', fillets: 'piece', stick: 'piece', sticks: 'piece', square: 'piece', squares: 'piece', bar: 'piece', bars: 'piece',
  serving: 'serving', servings: 'serving', serve: 'serving', order: 'serving', orders: 'serving', portion: 'serving',
  scoop: 'scoop', scoops: 'scoop', bowl: 'bowl', bowls: 'bowl', mangkok: 'bowl', plate: 'plate', plates: 'plate', plato: 'plate',
  can: 'can', cans: 'can', lata: 'can', bottle: 'bottle', bottles: 'bottle', bote: 'bottle',
  pack: 'pack', packs: 'pack', packet: 'pack', packets: 'pack', sachet: 'pack', sachets: 'pack', bag: 'pack', bags: 'pack',
  handful: 'handful', handfuls: 'handful',
}
const SIZE_WORDS: Record<string, UnitKey> = { small: 'small', maliit: 'small', medium: 'medium', regular: 'medium', large: 'large', big: 'large', malaki: 'large', jumbo: 'xl', xl: 'xl' }
const VOLUME_ML: Partial<Record<UnitKey, number>> = { cup: 240, mug: 300, glass: 250, tbsp: 15, tsp: 5, bowl: 350 }
const FILLER = new Set(['of', 'ng', 'na', 'some', 'my', 'the', 'about', 'around', 'approx', 'x'])

const stem = (w: string) => w.length > 3 && w.endsWith('ies') ? `${w.slice(0, -3)}y` : w.length > 3 && w.endsWith('oes') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9ñ%\s-]/g, ' ').split(/[\s-]+/).filter(Boolean).map(stem)

const PART: Record<string, number> = { half: 0.5, kalahati: 0.5, kalahating: 0.5, quarter: 0.25, third: 1 / 3 }
const WHOLE = Object.keys(NUM_WORDS).filter((w) => NUM_WORDS[w] >= 1 && !w.includes('_') && w !== 'a' && w !== 'an').join('|')

/** "1 and a half" -> "1.5", "isa't kalahati" -> "1.5", "half a cup" -> "0.5 cup", "1-1/2" -> "1 1/2", so "and" doesn't split the amount off its food. */
export function normalizeAmounts(text: string): string {
  const num = (w: string) => (/^\d/.test(w) ? parseFloat(w) : NUM_WORDS[w.toLowerCase()] ?? 1)
  return text
    .replace(/(\d)\s*(?:-|&|\+|\band\b|\bat\b)\s*(\d+\/\d+)/gi, '$1 $2')
    .replace(new RegExp(`\\b(\\d+(?:\\.\\d+)?|${WHOLE})(?:\\s*'t|\\s+(?:and|at|n|&|\\+))?\\s+(?:a\\s+|an\\s+)?(half|kalahati|kalahating|quarter|third)\\b`, 'gi'),
      (all, w: string, p: string) => {
        // "2 half" is two halves only when nothing joins them; keep it as written then.
        if (!/'t|and|at|\bn\b|&|\+/i.test(all) && !/^(isa|one)/i.test(w) && /^\d/.test(w)) return all
        return ` ${+(num(w) + PART[p.toLowerCase()]).toFixed(2)} `
      })
    .replace(/\b(?:a\s+)?(half|quarter|third)\s+(?:a|an)\b/gi, (_, p: string) => ` ${+PART[p.toLowerCase()].toFixed(2)} `)
    .replace(/\ba\s+(half|quarter|third)\b/gi, (_, p: string) => ` ${+PART[p.toLowerCase()].toFixed(2)} `)
}

/** Split a typed meal into one entry per food. */
export function splitEntries(text: string): string[] {
  return normalizeAmounts(text)
    .replace(/\btable\s+spoons?\b/gi, 'tbsp').replace(/\btea\s+spoons?\b/gi, 'tsp')
    .split(/\n|,|;|\+|&|\band\b|\bwith\b|\bplus\b|\bat\b/i)
    .map((s) => s.trim()).filter((s) => /[a-zñ]/i.test(s))
}

interface Quantity { qty: number; unit: string | null; size: UnitKey | null; rest: string[]; explicit: boolean }

export function readQuantity(entry: string): Quantity {
  // "200g" -> "200 g", "1.5cups" -> "1.5 cups", "1/2" stays, "½" -> " 0.5 "
  let s = entry.toLowerCase().replace(/\b3\s*-?\s*in\s*-?\s*1\b/g, 'threeinone')
  for (const [k, v] of Object.entries(FRACTIONS)) s = s.replaceAll(k, ` ${v} `)
  s = s.replace(/(\d)([a-z])/g, '$1 $2')
  const tokens = s.split(/\s+/).filter(Boolean)
  let qty = 0, unit: string | null = null, size: UnitKey | null = null, explicit = false
  const rest: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i].replace(/[^a-z0-9./ñ]/g, '')
    if (!t) continue
    const frac = t.match(/^(\d+)\/(\d+)$/)
    if (frac && +frac[2]) { qty += +frac[1] / +frac[2]; explicit = true; continue }
    if (/^\d+(\.\d+)?$/.test(t)) { qty += parseFloat(t); explicit = true; continue }
    if (t in NUM_WORDS && !unit && rest.length === 0) { qty += NUM_WORDS[t]; explicit = true; continue }
    if (!unit && t in UNIT_WORDS && (explicit || rest.length === 0)) { unit = UNIT_WORDS[t]; continue }
    if (!size && t in SIZE_WORDS) { size = SIZE_WORDS[t]; continue }
    if (FILLER.has(t)) continue
    rest.push(t)
  }
  return { qty: qty || 1, unit, size, rest, explicit }
}

type Candidate = { kind: 'builtin'; food: BuiltinFood; score: number } | { kind: 'saved'; food: Food; score: number }

// Cooking words that describe a dish without changing what it is; leaving them unexplained is fine.
const SOFT = new Set(['cooked', 'homemade', 'plain', 'fresh', 'hot', 'warm', 'leftover', 'small', 'big', 'lutong', 'bahay', 'ulam', 'with', 'w', 'and', 'at', 'sa', 'yung', 'ung', 'lang', 'only', 'piece', 'style', 'grilled', 'inihaw', 'fried', 'prito', 'pritong', 'boiled', 'steamed', 'baked', 'roasted', 'sauteed', 'stir', 'fry'])

const ALIAS_WORDS: { food: BuiltinFood; words: string[] }[] = FOODS.flatMap((f) => f.aliases.map((a) => ({ food: f, words: words(a) })).filter((a) => a.words.length))
const VOCAB = new Set(ALIAS_WORDS.flatMap((a) => a.words))

function editDistanceAtMost1(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0, j = 0, edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue }
    if (++edits > 1) return false
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++ }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

/** Maps a typed word onto the food vocabulary: Tagalog linkers ("tortang" -> torta, "adobong" -> adobo) and one-letter typos. */
function normalize(w: string, vocab: Set<string>) {
  if (vocab.has(w)) return w
  for (const cut of [2, 1]) if (w.length > 4 && w.endsWith('ng') && vocab.has(w.slice(0, -cut))) return w.slice(0, -cut)
  if (w.length >= 5) {
    const near = [...vocab].filter((v) => v.length >= 4 && editDistanceAtMost1(w, v))
    if (near.length === 1) return near[0]
  }
  return w
}

function bestMatch(rest: string[], saved: Food[]): { best: Candidate | null; suggestions: Suggestion[]; unsure: boolean; key: string } {
  const savedWords = saved.map((f) => ({ food: f, words: words(f.name) }))
  const vocab = new Set([...VOCAB, ...savedWords.flatMap((s) => s.words)])
  const have = new Set(rest.map(stem).map((w) => normalize(w, vocab)))
  const key = [...have].filter((w) => !SOFT.has(w)).sort().join(' ')
  if (!have.size) return { best: null, suggestions: [], unsure: false, key }
  const hard = [...have].filter((w) => !SOFT.has(w))
  let best: Candidate | null = null
  let bestMissing = 0
  const partial: { s: Suggestion; score: number }[] = []
  const consider = (aliasWords: string[], make: (score: number) => Candidate, sug: Suggestion) => {
    const hit = aliasWords.filter((w) => have.has(w)).length
    if (!hit) return
    if (hit < aliasWords.length) {
      partial.push({ s: sug, score: hit * 10 - (aliasWords.length - hit) * 4 - hard.length * 0.1 })
      return
    }
    // More matched words wins; a tie goes to the alias that leaves fewer words unexplained.
    const missing = hard.filter((w) => !aliasWords.includes(w)).length
    const score = aliasWords.length * 10 - missing * 0.5
    partial.push({ s: sug, score: score + 5 })
    if (!best || score > best.score) { best = make(score); bestMissing = missing }
  }
  for (const f of savedWords) consider(f.words, (score) => ({ kind: 'saved', food: f.food, score: score + 0.05 }), { kind: 'saved', name: f.food.name, id: f.food.id })
  for (const a of ALIAS_WORDS) consider(a.words, (score) => ({ kind: 'builtin', food: a.food, score }), { kind: 'builtin', name: a.food.name })
  const chosen = best as Candidate | null
  const seen = new Set<string>(chosen ? [chosen.food.name] : [])
  const suggestions = partial.sort((a, b) => b.score - a.score).map((p) => p.s)
    .filter((s) => (seen.has(s.name) ? false : (seen.add(s.name), true))).slice(0, 4)
  return { best: chosen, suggestions, unsure: !!chosen && bestMissing > 0, key }
}

const r1 = (v: number) => Math.round(v * 10) / 10
const fmtQty = (q: number) => (Number.isInteger(q) ? String(q) : q === 0.5 ? '½' : q === 0.25 ? '¼' : String(r1(q)))
const UNIT_LABEL: Record<string, string> = { tbsp: 'tbsp', tsp: 'tsp', g: 'g', ml: 'ml', kg: 'kg', oz: 'oz', lb: 'lb', l: 'L', xl: 'extra large' }

function gramsFor(f: BuiltinFood, q: Quantity): { grams: number; label: string; assumed: boolean } {
  const n = q.qty
  const plural = (w: string) => (n > 1 && !['g', 'ml', 'kg', 'oz', 'lb', 'L', 'tbsp', 'tsp'].includes(w) ? `${w}s` : w)
  const lbl = (u: string) => `${fmtQty(n)} ${plural(UNIT_LABEL[u] ?? u)}`
  switch (q.unit) {
    case 'g': return { grams: n, label: lbl('g'), assumed: false }
    case 'kg': return { grams: n * 1000, label: lbl('kg'), assumed: false }
    case 'oz': return { grams: n * 28.35, label: lbl('oz'), assumed: false }
    case 'lb': return { grams: n * 453.6, label: lbl('lb'), assumed: false }
    case 'ml': return { grams: n * (f.d ?? 1), label: lbl('ml'), assumed: false }
    case 'l': return { grams: n * 1000 * (f.d ?? 1), label: lbl('l'), assumed: false }
  }
  const u = q.unit as UnitKey | null
  if (u) {
    const sized = q.size && u === 'piece' ? f.u[q.size] : undefined
    if (sized ?? f.u[u]) return { grams: n * (sized ?? f.u[u]!), label: lbl(q.size && u === 'piece' ? `${q.size} piece` : u), assumed: false }
    const ml = VOLUME_ML[u]
    if (ml) return { grams: n * ml * (f.d ?? (f.u.cup ? f.u.cup / 240 : 1)), label: lbl(u), assumed: false }
    // A count-like unit the food doesn't know: use its usual serving.
    const g = f.u.serving ?? f.u.piece ?? 100
    return { grams: n * g, label: lbl(u), assumed: true }
  }
  if (q.size && f.u[q.size]) return { grams: n * f.u[q.size]!, label: `${fmtQty(n)} ${q.size}`, assumed: !q.explicit }
  // Rice and similar: a bare count means cups when a serving is one cup ("1 and a half rice").
  if (f.u.cup && f.u.serving === f.u.cup && !f.u.piece) return { grams: n * f.u.cup, label: lbl('cup'), assumed: false }
  for (const k of ['piece', 'serving', 'slice', 'cup', 'pack', 'can', 'glass', 'scoop', 'tbsp'] as const) {
    if (f.u[k]) return { grams: n * f.u[k]!, label: k === 'piece' ? `${fmtQty(n)}` : lbl(k), assumed: !q.explicit || k !== 'piece' }
  }
  return { grams: n * 100, label: `${fmtQty(n * 100)} g`, assumed: true }
}

/** Parse one typed entry. Returns item null when no food matched. */
export function parseEntry(entry: string, saved: Food[] = [], learned: Learned = {}): ParsedLine {
  const q = readQuantity(entry)
  const found = bestMatch(q.rest, saved)
  const pick = found.key ? learned[found.key] : undefined
  const picked: Candidate | null = pick
    ? pick.kind === 'saved'
      ? (() => { const f = saved.find((x) => x.id === pick.id || x.name === pick.name); return f ? { kind: 'saved' as const, food: f, score: 99 } : null })()
      : (() => { const f = FOODS.find((x) => x.name === pick.name); return f ? { kind: 'builtin' as const, food: f, score: 99 } : null })()
    : null
  const line = parseWith(entry, q, picked ?? found.best)
  return { ...line, key: found.key, unsure: picked ? false : found.unsure, suggestions: picked ? [] : found.suggestions }
}

function parseWith(entry: string, q: Quantity, m: Candidate | null): ParsedLine {
  if (!m) return { text: entry, item: null, portion: '', assumed: false }
  if (m.kind === 'saved') {
    const f = m.food
    const base = f.grams || 100
    let grams: number, portion: string, assumed = false
    if (q.unit === 'g') { grams = q.qty; portion = `${fmtQty(q.qty)} g` }
    else if (q.unit === 'kg') { grams = q.qty * 1000; portion = `${fmtQty(q.qty)} kg` }
    else if (q.unit === 'oz') { grams = q.qty * 28.35; portion = `${fmtQty(q.qty)} oz` }
    else { grams = base * q.qty; portion = `${fmtQty(q.qty)} × your usual (${Math.round(base)} g)`; assumed = !q.explicit }
    const k = grams / base
    return { text: entry, portion, assumed, item: { name: f.name, grams: Math.round(grams), base_grams: Math.round(grams), kcal: Math.round(f.kcal * k), protein: r1(f.protein * k), carbs: r1(f.carbs * k), fat: r1(f.fat * k), food_id: f.id } }
  }
  const f = m.food
  const { grams, label, assumed } = gramsFor(f, q)
  const k = grams / 100
  return {
    text: entry, assumed,
    portion: `${label} · ${Math.round(grams)} g`,
    item: { name: f.name, grams: Math.round(grams), base_grams: Math.round(grams), kcal: Math.round(f.kcal * k), protein: r1(f.protein * k), carbs: r1(f.carbs * k), fat: r1(f.fat * k) },
  }
}

export const parseMeal = (text: string, saved: Food[] = [], learned: Learned = {}) => splitEntries(text).map((e) => parseEntry(e, saved, learned))

/** Breakfast before 10:30, lunch until 15:00, snack until 17:30, dinner after. */
export function mealForTime(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  const t = h * 60 + m
  return t < 630 ? 'Breakfast' : t < 900 ? 'Lunch' : t < 1050 ? 'Snack' : 'Dinner'
}
