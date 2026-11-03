import type { ExerciseEntry, Workout } from '../types'

/** Default split names offered in the title picker (history titles are added to these). */
export const PRESET_TITLES = ['UPPER A', 'UPPER B', 'LOWER A', 'LOWER B', 'PUSH A', 'PUSH B', 'PULL', 'LEG']

const norm = (t: string) => t.trim().toLowerCase()

/** Preset titles plus every title used before, without case-insensitive duplicates. */
export function titleOptions(workouts: Workout[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const add = (t: string) => {
    const k = norm(t)
    if (k && !seen.has(k)) {
      seen.add(k)
      out.push(t.trim())
    }
  }
  PRESET_TITLES.forEach(add)
  ;[...workouts].sort((a, b) => (a.date < b.date ? 1 : -1)).forEach((w) => add(w.title))
  return out
}

/** Most recent other workout with the same title (not later than `date` if possible). */
export function lastWorkoutWithTitle(workouts: Workout[], title: string, excludeId: string, date: string): Workout | null {
  const same = workouts
    .filter((w) => w.id !== excludeId && norm(w.title) === norm(title) && w.entries.length > 0)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.updatedAt - a.updatedAt))
  return same.find((w) => w.date <= date) ?? same[0] ?? null
}

/** Copies the exercises (with goal and last sets as a starting point) from a previous workout. */
export function entriesFrom(w: Workout, newId: () => string): ExerciseEntry[] {
  return w.entries.map((e) => ({
    id: newId(),
    exerciseId: e.exerciseId,
    goal: e.goal,
    comment: '',
    sets: e.sets.map((s) => ({ reps: s.reps, weight: s.weight, durationSec: s.durationSec })),
  }))
}
