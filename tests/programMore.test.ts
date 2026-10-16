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

describe('week-by-week programs', () => {
  it('keeps one of each day and reads rest lines', () => {
    const p = parseProgram(`Week 1
Upper A
Bench press 4 x 6
Rest: 2-3 min
Row 3x10
Lower A
Squat 4x5
Notes: brace hard
Leg curl 3x12
Week 2
Upper A
Bench press 4 x 5
Row 3x10
Lower A
Squat 4x4
Leg curl 3x12
Week 3
Lower A
Squat 5x3`)
    expect(p.days.map((d) => d.name)).toEqual(['Upper A', 'Lower A'])
    expect(p.days[0].exercises.map((e) => e.name)).toEqual(['Bench Press', 'Row'])
    expect(p.days[0].exercises[0].rest).toBe(120)
    expect(p.days[1].exercises.map((e) => e.name)).toEqual(['Back Squat', 'Leg Curl'])
  })
})
