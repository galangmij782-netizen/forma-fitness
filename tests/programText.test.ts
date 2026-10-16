import { describe, expect, it } from 'vitest'
import { parseProgram } from '../src/lib/programText'

describe('program text', () => {
  it('reads days, sets, reps and rest', () => {
    const p = parseProgram(`My PPL
Day 1 - Push
1. Incline bench press 3x8-12
- OHP 4 x 6, rest 2 min
Lateral raises 3 sets of 15 rest 60s
Tricep pushdown 3x12

Pull:
Pull ups 4xAMRAP
Barbell row 4 sets 8-10 reps
Leg curl 3x12
Hammer curl 3 x 10-12 (each arm)`)
    expect(p.title).toBe('My PPL')
    expect(p.days.map((d) => d.name)).toEqual(['Push', 'Pull'])
    const [incline, ohp, lat, tri] = p.days[0].exercises
    expect(incline).toMatchObject({ name: 'Incline Bench Press', muscle: 'Chest', sets: 3, repsMin: 8, repsMax: 12 })
    expect(ohp).toMatchObject({ name: 'Overhead Press', muscle: 'Shoulders', sets: 4, repsMin: 6, repsMax: 6, rest: 120, restGiven: true })
    expect(lat).toMatchObject({ name: 'Lateral Raise', sets: 3, repsMin: 15, rest: 60 })
    expect(tri.muscle).toBe('Triceps')
    const [pull, row, curl, hammer] = p.days[1].exercises
    expect(pull).toMatchObject({ name: 'Pull-up', muscle: 'Back', sets: 4, repsMin: 8, repsMax: 12 })
    expect(row).toMatchObject({ name: 'Barbell Row', sets: 4, repsMin: 8, repsMax: 10 })
    expect(curl.muscle).toBe('Hamstrings')
    expect(hammer).toMatchObject({ name: 'Hammer Curl', muscle: 'Biceps', repsMax: 12 })
  })
  it('works without day headers', () => {
    const p = parseProgram('squat 5x5\nrdl 3x8')
    expect(p.days).toHaveLength(1)
    expect(p.days[0].exercises.map((e) => [e.name, e.muscle, e.rest])).toEqual([['Back Squat', 'Quads', 180], ['Romanian Deadlift', 'Hamstrings', 120]])
  })
})
