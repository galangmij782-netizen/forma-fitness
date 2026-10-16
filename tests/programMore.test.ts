import { describe, expect, it } from 'vitest'
import { parseProgram } from '../src/lib/programText'

describe('pasted programs', () => {
  it('reads common formats', () => {
    const p = parseProgram(`UPPER A
1. Incline Bench Press - 3 sets x 8-10 reps
2) Seated cable row: 3 x 10-12 (90s rest)
- DB shoulder press 3x10
Lat pulldown 4 sets 10 reps

LOWER A
Squats 5x5
Romanian deadlift 3 x 8
Leg press 3x12-15
Calf raises 4x15`)
    expect(p.days.map((d) => d.name)).toEqual(['Upper A', 'Lower A'])
    const [u, l] = p.days
    expect(u.exercises.map((e) => [e.name, e.sets, e.repsMin, e.repsMax])).toEqual([
      ['Incline Bench Press', 3, 8, 10], ['Seated Cable Row', 3, 10, 12], ['DB Shoulder Press', 3, 10, 10], ['Lat Pulldown', 4, 10, 10],
    ])
    expect(u.exercises[1].rest).toBe(90)
    expect(l.exercises[0].rest).toBe(180)
    expect(l.exercises.map((e) => e.muscle)).toEqual(['Quads', 'Hamstrings', 'Quads', 'Calves'])
  })
})
