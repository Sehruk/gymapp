import { useMemo, useState } from 'react'
import { formatDate, todayStr } from '../lib/dates'
import { newId, useStore } from '../store'
import type { Cardio } from '../types'
import { NumInput, parseNum } from './NumInput'

const TYPES = ['Treadmill walk', 'Treadmill run', 'Outdoor walk', 'Outdoor run', 'Cycling', 'Elliptical', 'Stair climber', 'Rowing', 'HIIT', 'Other']

export function ActivityScreen() {
  const { data, saveCardio, deleteCardio, setSteps } = useStore()
  const [stepDate, setStepDate] = useState(todayStr())
  const stepsToday = data.steps.find((s) => s.date === stepDate)?.steps
  const [stepText, setStepText] = useState('')
  const [editing, setEditing] = useState<Cardio | null>(null)

  const cardio = useMemo(() => [...data.cardio].sort((a, b) => (a.date < b.date ? 1 : -1)), [data.cardio])
  const steps = useMemo(() => [...data.steps].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 14), [data.steps])

  const newCardio = (): Cardio => ({ id: newId(), date: todayStr(), type: 'Treadmill walk', notes: '' })

  const saveSteps = async () => {
    const n = parseNum(stepText)
    if (n == null) return
    await setSteps(stepDate, Math.round(n))
    setStepText('')
  }

  return (
    <div className="screen">
      <header className="top"><h1>Cardio & Steps</h1></header>

      <div className="card">
        <h2>Daily steps</h2>
        <div className="row">
          <input type="date" value={stepDate} onChange={(e) => e.target.value && setStepDate(e.target.value)} />
        </div>
        <div className="row">
          <input
            className="num"
            inputMode="numeric"
            placeholder={stepsToday != null ? `Currently ${stepsToday}` : 'Steps'}
            value={stepText}
            onChange={(e) => /^[0-9]*$/.test(e.target.value) && setStepText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveSteps()}
          />
          <button className="btn primary" onClick={saveSteps}>Save</button>
        </div>
        {stepsToday != null && (
          <button className="btn ghost danger small" onClick={() => setSteps(stepDate, null)}>Clear this day</button>
        )}
        {steps.map((s) => (
          <div className="row-between small-row" key={s.date}>
            <span>{formatDate(s.date)}</span>
            <strong>{s.steps.toLocaleString('en-US')}</strong>
          </div>
        ))}
      </div>

      {editing ? (
        <CardioForm
          initial={editing}
          onCancel={() => setEditing(null)}
          onSave={async (c) => {
            await saveCardio(c)
            setEditing(null)
          }}
          onDelete={
            data.cardio.some((c) => c.id === editing.id)
              ? async () => {
                  if (confirm('Delete this cardio session?')) {
                    await deleteCardio(editing.id)
                    setEditing(null)
                  }
                }
              : undefined
          }
        />
      ) : (
        <button className="btn primary big" onClick={() => setEditing(newCardio())}>+ Add cardio</button>
      )}

      {cardio.map((c) => (
        <div className="card tap" key={c.id} onClick={() => setEditing(c)}>
          <div className="row-between">
            <strong>{formatDate(c.date)}</strong>
            <span className="tag">{c.type}</span>
          </div>
          <div className="muted">
            {[
              c.minutes != null && `${c.minutes} min`,
              c.speedKmh != null && `${c.speedKmh} km/h`,
              c.inclinePct != null && `incline ${c.inclinePct}%`,
              c.distanceKm != null && `${c.distanceKm} km`,
            ].filter(Boolean).join(' · ') || 'No details'}
          </div>
          {c.notes && <div className="comment">{c.notes}</div>}
        </div>
      ))}
    </div>
  )
}

function CardioForm({ initial, onSave, onCancel, onDelete }: { initial: Cardio; onSave: (c: Cardio) => void; onCancel: () => void; onDelete?: () => void }) {
  const [c, setC] = useState(initial)
  const set = (p: Partial<Cardio>) => setC((x) => ({ ...x, ...p }))
  return (
    <div className="card">
      <h2>Cardio session</h2>
      <label className="field"><span>Date</span>
        <input type="date" value={c.date} onChange={(e) => e.target.value && set({ date: e.target.value })} />
      </label>
      <label className="field"><span>Type</span>
        <input list="cardio-types" value={c.type} onChange={(e) => set({ type: e.target.value })} />
        <datalist id="cardio-types">{TYPES.map((t) => <option key={t} value={t} />)}</datalist>
      </label>
      <div className="grid2">
        <label className="field"><span>Duration (min)</span><NumInput value={c.minutes} onChange={(v) => set({ minutes: v })} placeholder="min" /></label>
        <label className="field"><span>Speed (km/h)</span><NumInput value={c.speedKmh} onChange={(v) => set({ speedKmh: v })} placeholder="km/h" /></label>
        <label className="field"><span>Incline (%)</span><NumInput value={c.inclinePct} onChange={(v) => set({ inclinePct: v })} placeholder="%" /></label>
        <label className="field"><span>Distance (km)</span><NumInput value={c.distanceKm} onChange={(v) => set({ distanceKm: v })} placeholder="km" /></label>
      </div>
      <label className="field"><span>Notes</span>
        <textarea rows={2} value={c.notes} onChange={(e) => set({ notes: e.target.value })} />
      </label>
      <div className="row">
        <button className="btn primary" onClick={() => onSave(c)}>Save</button>
        <button className="btn secondary" onClick={onCancel}>Cancel</button>
        {onDelete && <button className="btn ghost danger" onClick={onDelete}>Delete</button>}
      </div>
    </div>
  )
}
