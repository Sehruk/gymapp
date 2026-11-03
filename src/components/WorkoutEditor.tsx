import { useEffect, useMemo, useRef, useState } from 'react'
import { formatDate } from '../lib/dates'
import { formatSet } from '../lib/exporters'
import { entriesFrom, lastWorkoutWithTitle, titleOptions } from '../lib/templates'
import { newId, useStore } from '../store'
import type { Exercise, ExerciseEntry, SetEntry, Workout } from '../types'
import { ExercisePicker } from './ExercisePicker'
import { NumInput } from './NumInput'

interface Props {
  initial: Workout
  onDone: () => void
}

const isMeaningful = (w: Workout) => w.entries.length > 0 || w.comment.trim() !== ''

export function WorkoutEditor({ initial, onDone }: Props) {
  const { data, saveWorkout, deleteWorkout, saveExercise } = useStore()
  const [draft, setDraft] = useState<Workout>(initial)
  const [picking, setPicking] = useState(false)
  const [titleOpen, setTitleOpen] = useState(false)
  const latest = useRef(draft)
  const dirty = useRef(false)

  const update = (fn: (w: Workout) => Workout) => {
    setDraft((w) => {
      const next = { ...fn(w), updatedAt: Date.now() }
      latest.current = next
      dirty.current = true
      return next
    })
  }

  // Autosave (debounced) and flush when leaving the screen.
  useEffect(() => {
    if (!dirty.current) return
    const t = setTimeout(() => {
      if (isMeaningful(latest.current)) saveWorkout(latest.current)
      dirty.current = false
    }, 400)
    return () => clearTimeout(t)
  }, [draft, saveWorkout])
  useEffect(
    () => () => {
      if (dirty.current && isMeaningful(latest.current)) saveWorkout(latest.current)
    },
    [saveWorkout],
  )

  const exById = useMemo(() => new Map(data.exercises.map((e) => [e.id, e])), [data.exercises])

  const lastTime = (exerciseId: string) => {
    let best: { date: string; sets: SetEntry[]; comment: string } | null = null
    for (const w of data.workouts) {
      if (w.id === draft.id || w.date > draft.date) continue
      const e = w.entries.find((x) => x.exerciseId === exerciseId)
      if (e && e.sets.length && (!best || w.date > best.date)) best = { date: w.date, sets: e.sets, comment: e.comment }
    }
    return best
  }

  const titles = useMemo(() => titleOptions(data.workouts), [data.workouts])

  const chooseTitle = (title: string) => {
    setTitleOpen(false)
    const prev = lastWorkoutWithTitle(data.workouts, title, draft.id, draft.date)
    const fill = prev && draft.entries.length === 0
    const replace =
      prev && draft.entries.length > 0 && confirm(`Replace the exercises below with those from your last ${title} (${prev.date})?`)
    update((w) => ({ ...w, title, entries: fill || replace ? entriesFrom(prev, newId) : w.entries }))
  }

  const addExercise = (ex: Exercise) => {
    setPicking(false)
    const last = lastTime(ex.id)
    const entry: ExerciseEntry = {
      id: newId(),
      exerciseId: ex.id,
      comment: '',
      sets: last ? [{ ...last.sets[0] }] : [{}],
    }
    update((w) => ({ ...w, entries: [...w.entries, entry] }))
  }

  const patchEntry = (id: string, patch: Partial<ExerciseEntry>) =>
    update((w) => ({ ...w, entries: w.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) }))

  const remove = async () => {
    if (!confirm('Delete this workout?')) return
    dirty.current = false
    await deleteWorkout(draft.id)
    onDone()
  }

  return (
    <div className="screen">
      <header className="top">
        <button className="btn ghost" onClick={onDone}>← Back</button>
        <h1>Workout</h1>
        <button className="btn ghost danger" onClick={remove}>Delete</button>
      </header>

      <div className="card">
        <label className="field">
          <span>Date</span>
          <input type="date" value={draft.date} onChange={(e) => e.target.value && update((w) => ({ ...w, date: e.target.value }))} />
        </label>
        <label className="field">
          <span>Title</span>
          <div className="row">
            <input placeholder="Pick or type, e.g. UPPER A" value={draft.title} onChange={(e) => update((w) => ({ ...w, title: e.target.value }))} />
            <button className="btn secondary" aria-label="Choose title" onClick={() => setTitleOpen(true)}>▾</button>
          </div>
        </label>
      </div>

      {draft.entries.map((entry) => {
        const ex = exById.get(entry.exerciseId)
        const last = lastTime(entry.exerciseId)
        return (
          <div className="card" key={entry.id}>
            <div className="entry-head">
              <h2>{ex?.name ?? '(deleted exercise)'}</h2>
              <button
                className="btn ghost danger small"
                onClick={() => confirm('Remove this exercise from the workout?') && update((w) => ({ ...w, entries: w.entries.filter((e) => e.id !== entry.id) }))}
              >
                Remove
              </button>
            </div>

            {ex && (
              <details className="form-note" open={!!ex.formNote}>
                <summary>Form notes{ex.formNote ? '' : ' (none yet)'}</summary>
                <textarea
                  rows={3}
                  placeholder="What to watch out for in this exercise…"
                  value={ex.formNote}
                  onChange={(e) => saveExercise({ ...ex, formNote: e.target.value })}
                />
              </details>
            )}

            {last && (
              <div className="last">
                Last time ({last.date}): {last.sets.map(formatSet).join(', ')}
                <button
                  className="btn ghost small"
                  onClick={() => patchEntry(entry.id, { sets: last.sets.map((s) => ({ ...s })) })}
                >
                  Copy
                </button>
              </div>
            )}
            {last?.comment && <div className="last-note">Your note last time: {last.comment}</div>}

            <label className="field">
              <span>Goal</span>
              <input placeholder="e.g. 3 x 5-8" value={entry.goal ?? ''} onChange={(e) => patchEntry(entry.id, { goal: e.target.value })} />
            </label>

            <div className="sets">
              <div className="set-row set-head">
                <span>#</span><span>Reps</span><span>kg</span><span />
              </div>
              {entry.sets.map((s, i) => (
                <SetRow
                  key={i}
                  index={i}
                  set={s}
                  onChange={(ns) => patchEntry(entry.id, { sets: entry.sets.map((x, j) => (j === i ? ns : x)) })}
                  onRemove={() => patchEntry(entry.id, { sets: entry.sets.filter((_, j) => j !== i) })}
                />
              ))}
              <button
                className="btn secondary"
                onClick={() => {
                  const prev = entry.sets[entry.sets.length - 1]
                  patchEntry(entry.id, { sets: [...entry.sets, prev ? { reps: prev.reps, weight: prev.weight } : {}] })
                }}
              >
                + Add set
              </button>
            </div>

            <label className="field">
              <span>Note for today</span>
              <textarea rows={2} placeholder="How did it feel? Anything to remember…" value={entry.comment} onChange={(e) => patchEntry(entry.id, { comment: e.target.value })} />
            </label>
          </div>
        )
      })}

      <button className="btn primary big" onClick={() => setPicking(true)}>+ Add exercise</button>

      <div className="card">
        <label className="field">
          <span>Day comment</span>
          <textarea rows={3} placeholder="Overall notes about today's session…" value={draft.comment} onChange={(e) => update((w) => ({ ...w, comment: e.target.value }))} />
        </label>
      </div>
      <p className="hint">Saved automatically · {formatDate(draft.date)}</p>

      {titleOpen && (
        <div className="sheet-backdrop" onClick={() => setTitleOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head"><strong style={{ flex: 1 }}>Workout title</strong><button className="btn ghost" onClick={() => setTitleOpen(false)}>Close</button></div>
            <div className="sheet-body">
              <p className="hint">Picking a title fills in the exercises from your last workout with that title.</p>
              {titles.map((t) => (
                <button key={t} className="list-item" onClick={() => chooseTitle(t)}>{t}</button>
              ))}
            </div>
          </div>
        </div>
      )}
      {picking && <ExercisePicker onPick={addExercise} onClose={() => setPicking(false)} />}
    </div>
  )
}

function SetRow({ index, set, onChange, onRemove }: { index: number; set: SetEntry; onChange: (s: SetEntry) => void; onRemove: () => void }) {
  const [more, setMore] = useState(set.durationSec != null || set.restSec != null || set.rpe != null)
  return (
    <div className="set-block">
      <div className="set-row">
        <span className="set-no">{index + 1}</span>
        <NumInput integer value={set.reps} placeholder="reps" onChange={(v) => onChange({ ...set, reps: v })} />
        <NumInput value={set.weight} placeholder="kg" onChange={(v) => onChange({ ...set, weight: v })} />
        <button className="btn ghost small" aria-label="More set fields" onClick={() => setMore(!more)}>{more ? '▴' : '▾'}</button>
        <button className="btn ghost danger small" aria-label="Remove set" onClick={onRemove}>✕</button>
      </div>
      {more && (
        <div className="set-more">
          <label>Time (s)<NumInput integer value={set.durationSec} placeholder="sec" onChange={(v) => onChange({ ...set, durationSec: v })} /></label>
          <label>Rest (s)<NumInput integer value={set.restSec} placeholder="sec" onChange={(v) => onChange({ ...set, restSec: v })} /></label>
          <label>RPE<NumInput value={set.rpe} placeholder="1-10" onChange={(v) => onChange({ ...set, rpe: v })} /></label>
        </div>
      )}
    </div>
  )
}
