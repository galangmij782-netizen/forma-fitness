// Barcode lookup against Open Food Facts, a free and open food database.
// Values are per 100 g; when the label has a serving size we start from one serving.
import type { MealItem } from './types'

export interface Per100 { kcal: number; protein: number; carbs: number; fat: number }
export interface Product {
  code: string; name: string; brand: string
  /** one serving (or 100 g when the label has none) */
  item: MealItem
  per100: Per100
  /** weight of the whole pack, when known */
  packGrams?: number
  servingGrams?: number
  /** pieces in the pack and the weight of one, when the label says */
  pieces?: number
  pieceGrams?: number
}

const PIECE_WORDS = 'pcs|pc|pieces?|pieces|nuggets?|sticks?|bars?|biscuits?|cookies?|crackers?|slices?|sachets?|packs?|packets?|buns?|rolls?|units?|candies|candy|tablets?|x'

/** Reads "8 pcs", "8 x 25 g", "10 pieces (250 g)" style text. */
export function readPieces(quantity: string, serving: string, packGrams?: number, servingGrams?: number): { pieces?: number; pieceGrams?: number } {
  const q = quantity.toLowerCase(), sv = serving.toLowerCase()
  const times = q.match(/(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*g\b/)
  if (times) return { pieces: +times[1], pieceGrams: parseFloat(times[2].replace(',', '.')) }
  const count = q.match(new RegExp(`(\\d+)\\s*(?:${PIECE_WORDS})\\b`))
  const pieces = count ? +count[1] : undefined
  const sCount = sv.match(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(?:${PIECE_WORDS})\\b`))
  const perServing = sCount ? parseFloat(sCount[1].replace(',', '.')) : undefined
  let pieceGrams: number | undefined
  if (perServing && servingGrams) pieceGrams = servingGrams / perServing
  else if (pieces && packGrams) pieceGrams = packGrams / pieces
  const n = pieces ?? (pieceGrams && packGrams ? Math.round(packGrams / pieceGrams) : undefined)
  return { pieces: n && n > 1 && n < 500 ? n : undefined, pieceGrams: pieceGrams && pieceGrams > 0 ? r1(pieceGrams) : undefined }
}

/** A portion of the product, from per-100 g values. */
export function portionOf(p: Product, grams: number): MealItem {
  const k = grams / 100
  return { name: p.item.name, grams: Math.round(grams), base_grams: Math.round(grams), kcal: Math.round(p.per100.kcal * k), protein: r1(p.per100.protein * k), carbs: r1(p.per100.carbs * k), fat: r1(p.per100.fat * k) }
}

const isDemo = () => new URLSearchParams(location.search).has('demo')
const r1 = (v: number) => Math.round(v * 10) / 10

export async function lookupBarcode(code: string): Promise<Product | null> {
  const clean = code.replace(/\D/g, '')
  if (clean.length < 6) return null
  if (isDemo()) return demoProduct(clean)
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${clean}.json?fields=product_name,product_name_en,brands,nutriments,serving_quantity,serving_size,product_quantity,quantity`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Lookup failed (${res.status})`)
  const data = await res.json()
  if (data.status !== 1 || !data.product) return null
  const p = data.product
  const n = p.nutriments ?? {}
  const kcal100 = Number(n['energy-kcal_100g'] ?? (n.energy_100g ? n.energy_100g / 4.184 : NaN))
  if (!Number.isFinite(kcal100)) return null
  const name = (p.product_name || p.product_name_en || 'Unnamed product').trim()
  const brand = String(p.brands ?? '').split(',')[0].trim()
  const serving = Number(p.serving_quantity)
  const servingGrams = serving > 0 && serving < 2000 ? serving : undefined
  const pq = Number(p.product_quantity)
  const packGrams = pq > 0 && pq < 20000 ? pq : undefined
  const grams = servingGrams ?? 100
  const k = grams / 100
  const per100 = { kcal: kcal100, protein: Number(n.proteins_100g ?? 0), carbs: Number(n.carbohydrates_100g ?? 0), fat: Number(n.fat_100g ?? 0) }
  return {
    code: clean, name, brand, per100, packGrams, servingGrams,
    ...readPieces(String(p.quantity ?? ''), String(p.serving_size ?? ''), packGrams, servingGrams),
    item: {
      name: brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${name} (${brand})` : name,
      grams, base_grams: grams,
      kcal: Math.round(kcal100 * k),
      protein: r1(Number(n.proteins_100g ?? 0) * k),
      carbs: r1(Number(n.carbohydrates_100g ?? 0) * k),
      fat: r1(Number(n.fat_100g ?? 0) * k),
    },
  }
}

async function demoProduct(code: string): Promise<Product> {
  await new Promise((r) => setTimeout(r, 500))
  return {
    code, name: 'Chicken nuggets', brand: 'Purefoods', packGrams: 200, servingGrams: 100, pieces: 8, pieceGrams: 25,
    per100: { kcal: 250, protein: 14, carbs: 16, fat: 14 },
    item: { name: 'Chicken nuggets (Purefoods)', grams: 100, base_grams: 100, kcal: 250, protein: 14, carbs: 16, fat: 14 },
  }
}
