import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { deleteItem, loadAll, putItem, putMany, replaceAll } from './db'
import type { AppData, Cardio, Exercise, Workout } from './types'

export const newId = () => crypto.randomUUID()

interface Store {
  data: AppData
  saveWorkout: (w: Workout) => Promise<void>
  deleteWorkout: (id: string) => Promise<void>
  saveExercise: (e: Exercise) => Promise<void>
  deleteExercise: (id: string) => Promise<void>
  /** Finds an exercise by name (case-insensitive) or creates it. */
  ensureExercise: (name: string) => Promise<Exercise>
  saveCardio: (c: Cardio) => Promise<void>
  deleteCardio: (id: string) => Promise<void>
  setSteps: (date: string, steps: number | null) => Promise<void>
  importData: (incoming: AppData, mode: 'merge' | 'replace') => Promise<void>
}

const Ctx = createContext<Store | null>(null)

const upsert = <T,>(list: T[], item: T, same: (a: T) => boolean): T[] => {
  const i = list.findIndex(same)
  if (i === -1) return [...list, item]
  const copy = list.slice()
  copy[i] = item
  return copy
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null)

  useEffect(() => {
    loadAll().then(setData)
    // Ask the browser not to evict our data under storage pressure (best effort).
    navigator.storage?.persist?.().catch(() => {})
  }, [])

  const saveWorkout = useCallback(async (w: Workout) => {
    await putItem('workouts', w)
    setData((d) => d && { ...d, workouts: upsert(d.workouts, w, (x) => x.id === w.id) })
  }, [])
  const deleteWorkout = useCallback(async (id: string) => {
    await deleteItem('workouts', id)
    setData((d) => d && { ...d, workouts: d.workouts.filter((x) => x.id !== id) })
  }, [])
  const saveExercise = useCallback(async (e: Exercise) => {
    await putItem('exercises', e)
    setData((d) => d && { ...d, exercises: upsert(d.exercises, e, (x) => x.id === e.id) })
  }, [])
  const deleteExercise = useCallback(async (id: string) => {
    await deleteItem('exercises', id)
    setData((d) => d && { ...d, exercises: d.exercises.filter((x) => x.id !== id) })
  }, [])
  const saveCardio = useCallback(async (c: Cardio) => {
    await putItem('cardio', c)
    setData((d) => d && { ...d, cardio: upsert(d.cardio, c, (x) => x.id === c.id) })
  }, [])
  const deleteCardio = useCallback(async (id: string) => {
    await deleteItem('cardio', id)
    setData((d) => d && { ...d, cardio: d.cardio.filter((x) => x.id !== id) })
  }, [])
  const setSteps = useCallback(async (date: string, steps: number | null) => {
    if (steps == null) {
      await deleteItem('steps', date)
      setData((d) => d && { ...d, steps: d.steps.filter((x) => x.date !== date) })
    } else {
      const s = { date, steps }
      await putItem('steps', s)
      setData((d) => d && { ...d, steps: upsert(d.steps, s, (x) => x.date === date) })
    }
  }, [])

  const importData = useCallback(async (incoming: AppData, mode: 'merge' | 'replace') => {
    if (mode === 'replace') await replaceAll(incoming)
    else await putMany(incoming)
    setData(await loadAll())
  }, [])

  const exercisesRef = data?.exercises
  const ensureExercise = useCallback(
    async (name: string) => {
      const clean = name.trim()
      const found = exercisesRef?.find((e) => e.name.toLowerCase() === clean.toLowerCase())
      if (found) return found
      const e: Exercise = { id: newId(), name: clean, formNote: '', createdAt: Date.now() }
      await saveExercise(e)
      return e
    },
    [exercisesRef, saveExercise],
  )

  const value = useMemo<Store | null>(
    () =>
      data && {
        data, saveWorkout, deleteWorkout, saveExercise, deleteExercise, ensureExercise,
        saveCardio, deleteCardio, setSteps, importData,
      },
    [data, saveWorkout, deleteWorkout, saveExercise, deleteExercise, ensureExercise, saveCardio, deleteCardio, setSteps, importData],
  )

  if (!value) return <div className="loading">Loading…</div>
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside StoreProvider')
  return s
}
