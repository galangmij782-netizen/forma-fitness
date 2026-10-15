// Barcode lookup against Open Food Facts, a free and open food database.
// Values are per 100 g; when the label has a serving size we start from one serving.
import type { MealItem } from './types'

export interface Product { code: string; name: string; brand: string; item: MealItem }

const isDemo = () => new URLSearchParams(location.search).has('demo')
const r1 = (v: number) => Math.round(v * 10) / 10

export async function lookupBarcode(code: string): Promise<Product | null> {
  const clean = code.replace(/\D/g, '')
  if (clean.length < 6) return null
  if (isDemo()) return demoProduct(clean)
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${clean}.json?fields=product_name,product_name_en,brands,nutriments,serving_quantity`)
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
  const grams = serving > 0 && serving < 2000 ? serving : 100
  const k = grams / 100
  return {
    code: clean, name, brand,
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
  return { code, name: 'Greek yogurt 0%', brand: 'Fage', item: { name: 'Greek yogurt 0% (Fage)', grams: 170, base_grams: 170, kcal: 92, protein: 17, carbs: 5.4, fat: 0 } }
}
