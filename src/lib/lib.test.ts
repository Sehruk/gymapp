import { describe, expect, it } from 'vitest'
import type { AppData } from '../types'
import { addDays, weekday } from './dates'
import { filterData, formatSet, toAiText, toCsv } from './exporters'
import type { ExportOptions } from './exporters'
import { makeBackup, parseBackup } from './importer'

const data: AppData = {
  exercises: [{ id: 'e1', name: 'Dumbbell Press', formNote: 'Elbows 45 deg', createdAt: 0 }],
  workouts: [
    { id: 'w1', date: '2026-10-01', title: 'UPPER A', comment: 'good, "quoted"', createdAt: 0, updatedAt: 0,
      entries: [{ id: 'x1', exerciseId: 'e1', goal: '3 x 5-8', comment: 'felt strong', sets: [{ reps: 8, weight: 30 }, { reps: 7, weight: 30, rpe: 9 }] }] },
    { id: 'w2', date: '2026-09-01', title: 'OLD', comment: '', createdAt: 0, updatedAt: 0, entries: [] },
  ],
  cardio: [{ id: 'c1', date: '2026-10-02', type: 'Treadmill walk', minutes: 30, speedKmh: 5.5, inclinePct: 8, distanceKm: 2.75, notes: '' }],
  steps: [{ date: '2026-10-02', steps: 9000 }, { date: '2026-10-03', steps: 7000 }],
}
const opts: ExportOptions = { from: '2026-09-15', to: '2026-10-31', workouts: true, cardio: true, steps: true, formNotes: true }

describe('dates', () => {
  it('adds days across month boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(weekday('2026-11-03')).toBe('Tue')
  })
})

describe('exporters', () => {
  it('filters by inclusive date range', () => {
    const f = filterData(data, opts)
    expect(f.workouts.map((w) => w.id)).toEqual(['w1'])
    expect(filterData(data, { ...opts, from: '', to: '' }).workouts).toHaveLength(2)
  })
  it('respects section toggles', () => {
    expect(filterData(data, { ...opts, cardio: false, steps: false }).cardio).toHaveLength(0)
  })
  it('formats sets', () => {
    expect(formatSet({ reps: 8, weight: 30 })).toBe('8 x 30kg')
    expect(formatSet({ reps: 7, weight: 27.5, rpe: 9, restSec: 90 })).toBe('7 x 27.5kg [RPE 9, rest 90s]')
    expect(formatSet({ durationSec: 60, weight: 25 })).toBe('60s x 25kg')
  })
  it('builds AI text', () => {
    const t = toAiText(data, opts, '2026-11-03')
    expect(t).toContain('### 2026-10-01 (Thu) - UPPER A')
    expect(t).toContain('- Dumbbell Press (goal 3 x 5-8): 8 x 30kg, 7 x 30kg [RPE 9]')
    expect(t).toContain('Treadmill walk: 30 min, 5.5 km/h, incline 8%, 2.75 km')
    expect(t).toContain('Average over logged days: 8000')
    expect(t).toContain('Dumbbell Press: Elbows 45 deg')
    expect(t).not.toContain('OLD')
  })
  it('escapes CSV', () => {
    const csv = toCsv(data, opts)
    expect(csv.split('\r\n')[0]).toContain('Weight (kg)')
    expect(csv).toContain('"good, ""quoted"""')
  })
})

describe('backup', () => {
  it('round-trips', () => {
    const back = parseBackup(JSON.stringify(makeBackup(data)))
    expect(back.workouts).toHaveLength(2)
    expect(back.steps).toHaveLength(2)
  })
  it('rejects foreign or broken files', () => {
    expect(() => parseBackup('nope')).toThrow(/JSON/)
    expect(() => parseBackup('{"app":"Other"}')).toThrow(/GymApp/)
    expect(() => parseBackup(JSON.stringify({ app: 'GymApp', version: 1, workouts: [{ id: 'x', date: 'bad', entries: [] }] }))).toThrow(/invalid workout/)
  })
})

import { entriesFrom, lastWorkoutWithTitle, titleOptions } from './templates'

describe('templates', () => {
  const mk = (id: string, date: string, title: string, n = 1) => ({
    id, date, title, comment: '', createdAt: 0, updatedAt: 0,
    entries: Array.from({ length: n }, (_, i) => ({ id: `${id}e${i}`, exerciseId: 'e1', goal: '3 x 5', comment: 'old', sets: [{ reps: 8, weight: 30, rpe: 9 }] })),
  })
  const ws = [mk('a', '2026-10-01', 'UPPER A'), mk('b', '2026-10-20', 'upper a', 2), mk('c', '2026-10-10', 'LOWER A')]
  it('offers presets plus history without case duplicates', () => {
    const t = titleOptions(ws)
    expect(t.filter((x) => x.toLowerCase() === 'upper a')).toHaveLength(1)
    expect(t).toContain('LEG')
  })
  it('finds the latest same-title workout, ignoring case and the current one', () => {
    expect(lastWorkoutWithTitle(ws, 'UPPER A', 'x', '2026-11-03')?.id).toBe('b')
    expect(lastWorkoutWithTitle(ws, 'UPPER A', 'b', '2026-11-03')?.id).toBe('a')
    expect(lastWorkoutWithTitle(ws, 'PULL', 'x', '2026-11-03')).toBeNull()
  })
  it('copies exercises and sets but not comments or RPE', () => {
    const e = entriesFrom(ws[1], () => 'new')
    expect(e).toHaveLength(2)
    expect(e[0]).toMatchObject({ goal: '3 x 5', comment: '', sets: [{ reps: 8, weight: 30 }] })
    expect(e[0].sets[0]).not.toHaveProperty('rpe', 9)
  })
})
