import { describe, expect, it } from 'vitest'
import { parseEntry, parseMeal } from '../src/lib/mealText'

describe('food matching', () => {
  it('finds cooked Filipino dishes by name', () => {
    for (const [text, name] of [['tortang talong', 'Tortang talong'], ['1 serving dinuguan', 'Dinuguan'], ['laing', 'Laing'], ['adobong kangkong', 'Adobong kangkong'], ['kangkong adobo', 'Adobong kangkong'], ['2 kutsinta', 'Kutsinta']] as const) {
      expect(parseEntry(text).item?.name, text).toBe(name)
    }
  })
  it('understands Tagalog linkers and small typos', () => {
    expect(parseEntry('1 cup sinigang na baboy').item?.name).toMatch(/Sinigang/)
    expect(parseEntry('1 cup pinakbett').item?.name).toBe('Pinakbet')
  })
  it('flags a partial match instead of silently guessing', () => {
    const l = parseEntry('kalabasa con queso surprise')
    expect(!l.item || l.unsure).toBe(true)
  })
  it('remembers what the user picked', () => {
    const l = parseEntry('mystery ulam ni lola')
    const again = parseEntry('mystery ulam ni lola', [], { [l.key!]: { kind: 'builtin', name: 'Pinakbet' } })
    expect(again.item?.name).toBe('Pinakbet')
    expect(again.unsure).toBe(false)
  })
})

describe('mixed amounts', () => {
  const grams = (t: string) => parseMeal(t).map((l) => l.item?.grams)
  it('reads "and a half" style amounts as one number', () => {
    for (const t of ['1 and half rice', '1 and a half cup rice', 'one and a half cups of rice', "isa't kalahating kanin", '1 at kalahati kanin', '1 1/2 cup rice', '1-1/2 cups rice', '1 & 1/2 cup rice', '1.5 cups rice'])
      expect(grams(t), t).toEqual([237])
    expect(grams('half a cup of rice')).toEqual([79])
    expect(grams('a half cup rice')).toEqual([79])
    expect(grams('1 rice and 2 eggs')).toEqual([158, 100])
  })
})
