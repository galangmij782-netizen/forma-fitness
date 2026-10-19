import { afterEach, describe, expect, it, vi } from 'vitest'
import { lookupBarcode, readPieces } from '../src/lib/barcode'

vi.stubGlobal('location', { search: '' })
afterEach(() => vi.unstubAllGlobals())

const reply = (body: unknown, status = 200) => vi.stubGlobal('fetch', vi.fn(async () => ({ ok: status < 400, status, json: async () => body })))

describe('lookupBarcode', () => {
  it('scales per-100 g values to one serving', async () => {
    vi.stubGlobal('location', { search: '' })
    reply({ status: 1, product: { product_name: 'Skyr', brands: 'Arla, Foo', serving_quantity: 150, nutriments: { 'energy-kcal_100g': 60, proteins_100g: 10, carbohydrates_100g: 4, fat_100g: 0.2 } } })
    const p = await lookupBarcode('5701234567890')
    expect(p?.item).toMatchObject({ name: 'Skyr (Arla)', grams: 150, kcal: 90, protein: 15, carbs: 6, fat: 0.3 })
  })
  it('returns null for unknown products', async () => {
    vi.stubGlobal('location', { search: '' })
    reply({ status: 0 })
    expect(await lookupBarcode('123456789')).toBeNull()
  })
})

describe('pieces from labels', () => {
  it('reads counts and piece weights', () => {
    expect(readPieces('8 pcs', '', 200)).toEqual({ pieces: 8, pieceGrams: 25 })
    expect(readPieces('10 x 25 g', '')).toEqual({ pieces: 10, pieceGrams: 25 })
    expect(readPieces('200 g', '4 pieces (100 g)', 200, 100)).toEqual({ pieces: 8, pieceGrams: 25 })
    expect(readPieces('500 g', '30 g', 500, 30)).toEqual({ pieces: undefined, pieceGrams: undefined })
  })
})
