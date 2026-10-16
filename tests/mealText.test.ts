import { describe, expect, it } from 'vitest'
import { parseMeal, splitEntries } from '../src/lib/mealText'

describe('typed meals', () => {
  it('splits entries on commas, newlines and "and"', () => {
    expect(splitEntries('2 eggs, 1 tbsp butter and 1 mug coffee\ntoast')).toEqual(['2 eggs', '1 tbsp butter', '1 mug coffee', 'toast'])
  })
  it('reads counts, sizes and spoons', () => {
    const [eggs, butter, coffee] = parseMeal('2 medium eggs scrambled, 1 table spoon of butter, 1 mug of coffee')
    expect(eggs.item?.name).toBe('Scrambled egg')
    expect(eggs.item?.grams).toBe(110)
    expect(butter.item?.name).toBe('Butter')
    expect(butter.item?.kcal).toBe(100)
    expect(coffee.item?.name).toBe('Coffee (black)')
    expect(coffee.item!.kcal).toBeLessThan(10)
  })
  it('handles grams, fractions and Filipino foods', () => {
    const [rice, chicken, adobo] = parseMeal('1 1/2 cups kanin\n200g chicken breast\nadobo')
    expect(rice.item?.name).toBe('White rice')
    expect(rice.item?.grams).toBe(237)
    expect(chicken.item?.kcal).toBe(330)
    expect(adobo.item?.name).toBe('Chicken adobo')
    expect(adobo.assumed).toBe(true)
  })
  it('flags unknown foods', () => {
    expect(parseMeal('1 cup zzqx')[0].item).toBeNull()
  })
  it('prefers the more specific food', () => {
    expect(parseMeal('fried egg')[0].item?.name).toBe('Fried egg')
    expect(parseMeal('3in1 coffee')[0].item?.name).toBe('3-in-1 coffee')
    expect(parseMeal('half cup oats')[0].item?.grams).toBe(41)
  })
})
