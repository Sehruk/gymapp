import { useMemo, useState } from 'react'
import { CATALOG } from '../data/catalog'
import { useStore } from '../store'
import type { Exercise } from '../types'

interface Props {
  onPick: (e: Exercise) => void
  onClose: () => void
}

export function ExercisePicker({ onPick, onClose }: Props) {
  const { data, ensureExercise } = useStore()
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()

  const mine = useMemo(
    () => data.exercises.filter((e) => e.name.toLowerCase().includes(query)).sort((a, b) => a.name.localeCompare(b.name)),
    [data.exercises, query],
  )
  const suggestions = useMemo(() => {
    const have = new Set(data.exercises.map((e) => e.name.toLowerCase()))
    return CATALOG.filter((n) => !have.has(n.toLowerCase()) && n.toLowerCase().includes(query)).slice(0, 40)
  }, [data.exercises, query])
  const exact = data.exercises.some((e) => e.name.toLowerCase() === query) || CATALOG.some((n) => n.toLowerCase() === query)

  const pickName = async (name: string) => onPick(await ensureExercise(name))

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <input autoFocus placeholder="Search or type a new exercise…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn ghost" onClick={onClose}>Close</button>
        </div>
        <div className="sheet-body">
          {q.trim() && !exact && (
            <button className="list-item add-new" onClick={() => pickName(q)}>+ Add “{q.trim()}”</button>
          )}
          {mine.length > 0 && <div className="section-label">My exercises</div>}
          {mine.map((e) => (
            <button key={e.id} className="list-item" onClick={() => onPick(e)}>{e.name}</button>
          ))}
          {suggestions.length > 0 && <div className="section-label">Common exercises</div>}
          {suggestions.map((n) => (
            <button key={n} className="list-item" onClick={() => pickName(n)}>{n}</button>
          ))}
        </div>
      </div>
    </div>
  )
}
