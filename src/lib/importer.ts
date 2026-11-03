import type { AppData, BackupFile } from '../types'

export function makeBackup(data: AppData): BackupFile {
  return { app: 'GymApp', version: 1, exportedAt: new Date().toISOString(), ...data }
}

/** Parses and validates a backup file's text. Throws an Error with a readable message. */
export function parseBackup(text: string): AppData {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('This file is not valid JSON.')
  }
  const o = raw as Partial<BackupFile> | null
  if (!o || o.app !== 'GymApp') throw new Error('This is not a GymApp backup file.')
  if (o.version !== 1) throw new Error('Unsupported backup version.')
  const arr = <T,>(v: T[] | undefined): T[] => (Array.isArray(v) ? v : [])
  const data: AppData = {
    exercises: arr(o.exercises),
    workouts: arr(o.workouts),
    cardio: arr(o.cardio),
    steps: arr(o.steps),
  }
  const dateOk = (d: unknown) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)
  for (const e of data.exercises) if (!e.id || !e.name) throw new Error('Backup contains an invalid exercise.')
  for (const w of data.workouts)
    if (!w.id || !dateOk(w.date) || !Array.isArray(w.entries)) throw new Error('Backup contains an invalid workout.')
  for (const c of data.cardio) if (!c.id || !dateOk(c.date)) throw new Error('Backup contains an invalid cardio entry.')
  for (const s of data.steps) if (!dateOk(s.date) || typeof s.steps !== 'number') throw new Error('Backup contains an invalid step entry.')
  return data
}
