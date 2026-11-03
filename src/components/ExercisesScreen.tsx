import { useMemo, useState } from 'react'
import { newId, useStore } from '../store'
import type { Exercise } from '../types'

export function ExercisesScreen() {
  const { data, saveExercise, deleteExercise } = useStore()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [newName, setNewName] = useState('')

  const list = useMemo(
    () => data.exercises.filter((e) => e.name.toLowerCase().includes(q.trim().toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)),
    [data.exercises, q],
  )
  const usage = (id: string) => data.workouts.filter((w) => w.entries.some((e) => e.exerciseId === id)).length

  const add = async () => {
    const name = newName.trim()
    if (!name) return
    if (data.exercises.some((e) => e.name.toLowerCase() === name.toLowerCase())) return alert('That exercise already exists.')
    const e: Exercise = { id: newId(), name, formNote: '', createdAt: Date.now() }
    await saveExercise(e)
    setNewName('')
    setOpen(e.id)
  }

  return (
    <div className="screen">
      <header className="top"><h1>Exercises</h1></header>
      <div className="card">
        <div className="row">
          <input placeholder="New exercise name" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <button className="btn primary" onClick={add}>Add</button>
        </div>
      </div>
      <input placeholder="Search exercises…" value={q} onChange={(e) => setQ(e.target.value)} />
      {list.length === 0 && <p className="hint">No exercises yet. They are also created automatically when you add them to a workout.</p>}
      {list.map((e) => (
        <div className="card" key={e.id}>
          <div className="row-between tap" onClick={() => setOpen(open === e.id ? null : e.id)}>
            <strong>{e.name}</strong>
            <span className="muted">{usage(e.id)} workouts {open === e.id ? '▴' : '▾'}</span>
          </div>
          {open === e.id && (
            <>
              <label className="field">
                <span>Name</span>
                <input value={e.name} onChange={(ev) => saveExercise({ ...e, name: ev.target.value })} />
              </label>
              <label className="field">
                <span>Form notes (what to watch out for)</span>
                <textarea rows={4} value={e.formNote} onChange={(ev) => saveExercise({ ...e, formNote: ev.target.value })} />
              </label>
              <button
                className="btn ghost danger"
                onClick={() => {
                  const n = usage(e.id)
                  const msg = n > 0 ? `“${e.name}” is used in ${n} workouts. Deleting it leaves those entries without a name. Delete anyway?` : `Delete “${e.name}”?`
                  if (confirm(msg)) deleteExercise(e.id)
                }}
              >
                Delete exercise
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
