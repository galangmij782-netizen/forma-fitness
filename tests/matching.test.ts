import { describe, expect, it } from 'vitest'
import { parseEntry } from '../src/lib/mealText'

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
