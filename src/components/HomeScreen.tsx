import { useMemo, useState } from 'react'
import { formatDate, todayStr } from '../lib/dates'
import { daysSinceBackup } from '../lib/backupState'
import { newId, useStore } from '../store'
import type { Workout } from '../types'
import { WorkoutEditor } from './WorkoutEditor'

export function HomeScreen({ goData }: { goData: () => void }) {
  const { data } = useStore()
  const [editing, setEditing] = useState<Workout | null>(null)

  const sorted = useMemo(
    () => [...data.workouts].sort((a, b) => (a.date === b.date ? b.updatedAt - a.updatedAt : a.date < b.date ? 1 : -1)),
    [data.workouts],
  )
  const names = useMemo(() => new Map(data.exercises.map((e) => [e.id, e.name])), [data.exercises])

  const blank = (): Workout => ({
    id: newId(), date: todayStr(), title: '', comment: '', entries: [], createdAt: Date.now(), updatedAt: Date.now(),
  })
  const fromPrevious = (w: Workout): Workout => ({
    ...blank(),
    title: w.title,
    entries: w.entries.map((e) => ({ ...e, id: newId(), comment: '', sets: e.sets.map((s) => ({ ...s })) })),
  })

  if (editing) return <WorkoutEditor key={editing.id} initial={editing} onDone={() => setEditing(null)} />

  const since = daysSinceBackup()
  const hasData = data.workouts.length + data.cardio.length + data.steps.length > 0
  const showBackupNag = hasData && (since == null || since >= 7)

  return (
    <div className="screen">
      <header className="top"><h1>Workouts</h1></header>

      {showBackupNag && (
        <button className="banner" onClick={goData}>
          {since == null ? 'No backup yet' : `Last backup ${since} days ago`} — tap to back up your data
        </button>
      )}

      <button className="btn primary big" onClick={() => setEditing(blank())}>+ New workout</button>
      {sorted.length > 0 && (
        <button className="btn secondary" onClick={() => setEditing(fromPrevious(sorted[0]))}>
          Repeat last workout{sorted[0].title ? ` (${sorted[0].title})` : ''}
        </button>
      )}

      {sorted.length === 0 && <p className="hint">No workouts yet. Tap “New workout” to log your first one.</p>}

      {sorted.map((w) => (
        <div className="card tap" key={w.id} onClick={() => setEditing(w)}>
          <div className="row-between">
            <strong>{formatDate(w.date)}</strong>
            <span className="tag">{w.title || 'Workout'}</span>
          </div>
          <div className="muted">
            {w.entries.map((e) => names.get(e.exerciseId) ?? '?').join(' · ') || 'No exercises'}
          </div>
          {w.comment && <div className="comment">{w.comment}</div>}
        </div>
      ))}
    </div>
  )
}
