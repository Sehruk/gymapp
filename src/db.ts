import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'
import type { AppData, Cardio, Exercise, StepDay, Workout } from './types'

interface GymDB extends DBSchema {
  exercises: { key: string; value: Exercise }
  workouts: { key: string; value: Workout; indexes: { date: string } }
  cardio: { key: string; value: Cardio; indexes: { date: string } }
  steps: { key: string; value: StepDay }
}

let dbPromise: Promise<IDBPDatabase<GymDB>> | null = null

export function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<GymDB>('gymapp', 1, {
      upgrade(db) {
        db.createObjectStore('exercises', { keyPath: 'id' })
        db.createObjectStore('workouts', { keyPath: 'id' }).createIndex('date', 'date')
        db.createObjectStore('cardio', { keyPath: 'id' }).createIndex('date', 'date')
        db.createObjectStore('steps', { keyPath: 'date' })
      },
    })
  }
  return dbPromise
}

export async function loadAll(): Promise<AppData> {
  const db = await getDb()
  const [exercises, workouts, cardio, steps] = await Promise.all([
    db.getAll('exercises'),
    db.getAll('workouts'),
    db.getAll('cardio'),
    db.getAll('steps'),
  ])
  return { exercises, workouts, cardio, steps }
}

export async function putItem<S extends 'exercises' | 'workouts' | 'cardio' | 'steps'>(
  store: S,
  value: GymDB[S]['value'],
) {
  const db = await getDb()
  await db.put(store, value)
}

export async function deleteItem(store: 'exercises' | 'workouts' | 'cardio' | 'steps', key: string) {
  const db = await getDb()
  await db.delete(store, key)
}

export async function replaceAll(data: AppData) {
  const db = await getDb()
  const tx = db.transaction(['exercises', 'workouts', 'cardio', 'steps'], 'readwrite')
  await Promise.all([
    tx.objectStore('exercises').clear(),
    tx.objectStore('workouts').clear(),
    tx.objectStore('cardio').clear(),
    tx.objectStore('steps').clear(),
  ])
  for (const e of data.exercises) tx.objectStore('exercises').put(e)
  for (const w of data.workouts) tx.objectStore('workouts').put(w)
  for (const c of data.cardio) tx.objectStore('cardio').put(c)
  for (const s of data.steps) tx.objectStore('steps').put(s)
  await tx.done
}

export async function putMany(data: AppData) {
  const db = await getDb()
  const tx = db.transaction(['exercises', 'workouts', 'cardio', 'steps'], 'readwrite')
  for (const e of data.exercises) tx.objectStore('exercises').put(e)
  for (const w of data.workouts) tx.objectStore('workouts').put(w)
  for (const c of data.cardio) tx.objectStore('cardio').put(c)
  for (const s of data.steps) tx.objectStore('steps').put(s)
  await tx.done
}
