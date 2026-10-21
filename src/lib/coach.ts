// Built-in nutrition coach. Reads the day's meals and gives lifting-focused tips.
// Rules follow common sports-nutrition guidance (protein per meal and per day,
// carbs around training, produce, alcohol, sodium); no network or AI service needed.
import type { Meal, MealItem, Phase, Targets } from './types'

export interface CoachTip {
  id: string
  tone: 'good' | 'warn' | 'neutral'
  title: string
  detail: string
  /** why it matters for someone who lifts */
  why: string
}

const has = (name: string, words: string[], whole = false) => { const n = name.toLowerCase(); return words.some((w) => new RegExp(`\\b${w.replace(/[-]/g, '\\-')}${whole ? 's?\\b' : ''}`).test(n)) }
const PRODUCE = ['banana', 'saging', 'apple', 'orange', 'mango', 'papaya', 'pineapple', 'watermelon', 'grape', 'berr', 'avocado', 'broccoli', 'spinach', 'kangkong', 'lettuce', 'salad', 'tomato', 'cucumber', 'carrot', 'vegetable', 'veggie', 'gulay', 'chop suey', 'pinakbet', 'saba', 'fruit', 'monggo', 'sinigang', 'tinola']
const SUGARY_DRINKS = ['soda', 'coke', 'cola', 'sprite', 'royal', 'pepsi', 'milk tea', 'boba', 'juice', '3-in-1', 'softdrink']
const ALCOHOL = ['beer', 'wine', 'san miguel', 'red horse', 'vodka', 'whisky', 'rum', 'gin', 'ginebra', 'emperador', 'brandy', 'tequila', 'cocktail', 'soju', 'alfonso']
const SALTY = ['tocino', 'longganisa', 'hotdog', 'hot dog', 'corned beef', 'luncheon', 'spam', 'ham', 'bacon', 'instant noodle', 'pancit canton', 'chips', 'tapa', 'silog', 'sardines', 'soy sauce']
const FRIED = ['fried', 'lechon', 'chicharon', 'fries', 'chickenjoy', 'turon', 'lumpia', 'sisig', 'donut', 'kawali', 'bagnet']

const sum = (items: MealItem[], k: 'kcal' | 'protein' | 'carbs' | 'fat') => items.reduce((a, i) => a + (Number(i[k]) || 0), 0)

/** Short note about one meal while it's being typed, or null when it looks fine. */
export function mealNote(items: MealItem[]): string | null {
  if (!items.length) return null
  const p = sum(items, 'protein')
  if (p < 20 && sum(items, 'kcal') > 150) {
    const need = Math.ceil((25 - p) / 6)
    return `Only ${Math.round(p)} g protein here. Adding ${need} egg${need > 1 ? 's' : ''} or a palm of chicken gets this meal to the 25 g that best supports muscle growth.`
  }
  if (p >= 25) return `${Math.round(p)} g protein in this meal. That's in the range that best supports muscle growth.`
  return null
}

export function coachDay(opts: { meals: Meal[]; targets: Targets; phase: Phase; trainedToday: boolean; bodyweightKg: number | null; hour: number; isToday: boolean }): CoachTip[] {
  const { meals, targets, phase, trainedToday, bodyweightKg, hour, isToday } = opts
  const items = meals.flatMap((m) => m.items)
  const tips: CoachTip[] = []
  if (!items.length) {
    return [{ id: 'empty', tone: 'neutral', title: 'Nothing logged yet', detail: 'Type what you eat in the box above and I will check protein, carbs and food quality as you go.', why: 'Lifters who track intake consistently hit their protein and calorie goals far more often.' }]
  }
  const kcal = sum(items, 'kcal'), protein = sum(items, 'protein'), carbs = sum(items, 'carbs'), fat = sum(items, 'fat')
  // How far through the eating day we are, so a 9am total isn't judged against a full day.
  const pace = !isToday ? 1 : Math.min(1, Math.max(0.25, (hour - 6) / 15))

  // 1. Protein for the day
  const pLeft = targets.protein - protein
  if (pLeft <= targets.protein * 0.05) {
    tips.push({ id: 'protein-hit', tone: 'good', title: 'Protein target reached', detail: `${Math.round(protein)} g of ${targets.protein} g today.`, why: 'Hitting your protein daily is the single biggest nutrition lever for building and keeping muscle.' })
  } else if (protein < targets.protein * pace * 0.8) {
    const chicken = Math.round((pLeft / 31) * 100 / 10) * 10
    const eggs = Math.ceil(pLeft / 6.3)
    tips.push({
      id: 'protein-low', tone: 'warn', title: `${Math.round(pLeft)} g protein to go`,
      detail: `You're at ${Math.round(protein)} of ${targets.protein} g. Easy ways to close it: about ${chicken} g chicken breast, ${Math.ceil(pLeft / 25)} can${Math.ceil(pLeft / 25) > 1 ? 's' : ''} of tuna, ${Math.ceil(pLeft / 24)} scoop${Math.ceil(pLeft / 24) > 1 ? 's' : ''} of whey, or ${eggs} eggs.`,
      why: bodyweightKg ? `Around ${(targets.protein / bodyweightKg).toFixed(1)} g per kg of body weight gives your muscles what they need to repair after training.` : 'Muscles are rebuilt from protein; falling short slows recovery and growth.',
    })
  }

  // 2. Protein spread across meals
  const lowMeals = meals.filter((m) => sum(m.items, 'protein') < 20 && sum(m.items, 'kcal') > 200)
  if (lowMeals.length && meals.length >= 2) {
    tips.push({
      id: 'protein-spread', tone: 'neutral', title: 'Spread protein across meals',
      detail: `${lowMeals.map((m) => m.name).slice(0, 3).join(', ')} had under 20 g protein. Aim for 25 to 40 g in each of 3 to 5 meals.`,
      why: 'Muscle building switches on with each protein-rich meal, so several 25 g+ doses beat one big one.',
    })
  }

  // 3. Carbs around training
  if (trainedToday && carbs < targets.carbs * pace * 0.6) {
    tips.push({
      id: 'carbs-training', tone: 'warn', title: 'Refuel after training',
      detail: `You trained today but you're only at ${Math.round(carbs)} g carbs. A cup of rice (44 g) or a banana (27 g) with your next meal helps.`,
      why: 'Carbs refill muscle glycogen, which keeps your next sessions strong and reduces fatigue.',
    })
  }

  // 4. Calories against the goal phase
  const target = targets.kcal
  if (phase === 'cut' && kcal > target * 1.05) {
    tips.push({ id: 'kcal-cut', tone: 'warn', title: 'Over your cut calories', detail: `${Math.round(kcal - target)} kcal over today. Keep protein high tomorrow and trim oils, sauces and drinks first.`, why: 'A steady deficit keeps fat coming off while your strength holds; one high day is fine, a pattern is not.' })
  } else if ((phase === 'bulk' || phase === 'lean_bulk') && isToday && hour >= 19 && kcal < target * 0.8) {
    tips.push({ id: 'kcal-bulk', tone: 'warn', title: `${Math.round(target - kcal)} kcal short of your bulk`, detail: 'An easy top-up: peanut butter on bread (about 280 kcal), a glass of milk (160 kcal) or an extra cup of rice (205 kcal).', why: 'You need a small surplus every day to build new muscle; under-eating on a bulk stalls progress.' })
  } else if (!isToday || hour >= 20) {
    const pct = Math.round((kcal / target) * 100)
    if (Math.abs(pct - 100) <= 7) tips.push({ id: 'kcal-ok', tone: 'good', title: 'Calories on target', detail: `${Math.round(kcal).toLocaleString()} of ${target.toLocaleString()} kcal.`, why: 'Consistent calories make your weight trend predictable, so you can tell if the plan is working.' })
  }

  // 5. Produce
  const produce = items.filter((i) => has(i.name, PRODUCE))
  if (!produce.length && (!isToday || hour >= 13)) {
    tips.push({ id: 'produce', tone: 'neutral', title: 'No fruit or vegetables yet', detail: 'Add a banana, a mango, or a cup of vegetables to your next meal.', why: 'Fruit and vegetables bring potassium, magnesium and vitamin C that support muscle contractions, recovery and immune health under heavy training.' })
  } else if (produce.length >= 3) {
    tips.push({ id: 'produce-good', tone: 'good', title: 'Good fruit and veg variety', detail: `${produce.length} servings logged today.`, why: 'Micronutrients and fibre support recovery, digestion and steady energy for training.' })
  }

  // 6. Sugary drinks
  const drinks = items.filter((i) => has(i.name, SUGARY_DRINKS))
  const drinkKcal = sum(drinks, 'kcal')
  if (drinkKcal >= 150) {
    tips.push({ id: 'drinks', tone: 'warn', title: `${Math.round(drinkKcal)} kcal from sweet drinks`, detail: `${drinks.map((d) => d.name).join(', ')}. Swapping to water, black coffee or zero-sugar drinks frees those calories for food.`, why: 'Liquid sugar fills your calorie budget without protein or fullness, which makes body-composition goals harder.' })
  }

  // 7. Alcohol
  const alcohol = items.filter((i) => has(i.name, ALCOHOL, true))
  if (alcohol.length) {
    tips.push({ id: 'alcohol', tone: 'warn', title: 'Alcohol logged', detail: `${alcohol.map((a) => a.name).join(', ')}. Keep it to 1 to 2 drinks and drink water alongside.`, why: 'Alcohol blunts muscle protein synthesis and disrupts deep sleep, the two things recovery depends on most.' })
  }

  // 8. Salty processed food
  const salty = items.filter((i) => has(i.name, SALTY))
  if (salty.length >= 2) {
    tips.push({ id: 'sodium', tone: 'neutral', title: 'Salty, processed foods today', detail: `${salty.map((s) => s.name).slice(0, 3).join(', ')}. Drink extra water and expect the scale to be up a little tomorrow.`, why: 'High sodium holds water for a day or two, which can hide your real weight trend. It is not fat gain.' })
  }

  // 9. Fried food and fat
  const fried = items.filter((i) => has(i.name, FRIED))
  if (fat > targets.fat * Math.max(pace, 0.5) * 1.2 && fried.length) {
    tips.push({ id: 'fat', tone: 'neutral', title: 'Fat is running high', detail: `${Math.round(fat)} g so far, mostly from ${fried.map((f) => f.name).slice(0, 2).join(' and ')}. Grilled, boiled or air-fried versions save a lot of calories.`, why: 'Fat is essential for hormones, but extra fried food crowds out the carbs you train on and the protein you grow from.' })
  }

  if (!tips.length) {
    tips.push({ id: 'on-pace', tone: 'good', title: 'On track so far', detail: `${Math.round(protein)} g protein and ${Math.round(kcal).toLocaleString()} kcal, right on pace for this time of day.`, why: 'Steady intake through the day keeps energy up for training and protein flowing to your muscles.' })
  }
  const order = { warn: 0, neutral: 1, good: 2 }
  return tips.sort((a, b) => order[a.tone] - order[b.tone])
}
