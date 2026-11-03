export interface SetEntry {
  reps?: number
  weight?: number // kg
  durationSec?: number
  restSec?: number
  rpe?: number
}

export interface ExerciseEntry {
  id: string
  exerciseId: string
  goal?: string // e.g. "3 x 5-8"
  comment: string // note for this exercise on this day
  sets: SetEntry[]
}

export interface Workout {
  id: string
  date: string // YYYY-MM-DD
  title: string // e.g. "UPPER A"
  comment: string
  entries: ExerciseEntry[]
  createdAt: number
  updatedAt: number
}

export interface Exercise {
  id: string
  name: string
  formNote: string // persistent "what to watch out for" note
  createdAt: number
}

export interface Cardio {
  id: string
  date: string
  type: string
  minutes?: number
  speedKmh?: number
  inclinePct?: number
  distanceKm?: number
  notes: string
}

export interface StepDay {
  date: string
  steps: number
}

export interface AppData {
  exercises: Exercise[]
  workouts: Workout[]
  cardio: Cardio[]
  steps: StepDay[]
}

export interface BackupFile extends AppData {
  app: 'GymApp'
  version: 1
  exportedAt: string
}
