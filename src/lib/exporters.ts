import type { AppData, Cardio, ExerciseEntry, SetEntry, Workout } from '../types'
import { weekday } from './dates'

export interface ExportOptions {
  from: string // YYYY-MM-DD, inclusive ('' = no lower bound)
  to: string // inclusive ('' = no upper bound)
  workouts: boolean
  cardio: boolean
  steps: boolean
  formNotes: boolean
}

const inRange = (d: string, o: ExportOptions) => (!o.from || d >= o.from) && (!o.to || d <= o.to)

function byDate<T extends { date: string }>(a: T, b: T) {
  return a.date < b.date ? -1 : a.date > b.date ? 1 : 0
}

export function filterData(data: AppData, o: ExportOptions): AppData {
  return {
    exercises: data.exercises,
    workouts: o.workouts ? data.workouts.filter((w) => inRange(w.date, o)).sort(byDate) : [],
    cardio: o.cardio ? data.cardio.filter((c) => inRange(c.date, o)).sort(byDate) : [],
    steps: o.steps ? data.steps.filter((s) => inRange(s.date, o)).sort(byDate) : [],
  }
}

const num = (n: number) => String(Math.round(n * 100) / 100)

export function formatSet(s: SetEntry): string {
  let core: string
  if (s.durationSec != null && s.reps == null) {
    core = `${num(s.durationSec)}s` + (s.weight != null ? ` x ${num(s.weight)}kg` : '')
  } else {
    const reps = s.reps != null ? num(s.reps) : '?'
    core = s.weight != null ? `${reps} x ${num(s.weight)}kg` : `${reps} reps`
    if (s.durationSec != null) core += ` (${num(s.durationSec)}s)`
  }
  const extra: string[] = []
  if (s.rpe != null) extra.push(`RPE ${num(s.rpe)}`)
  if (s.restSec != null) extra.push(`rest ${num(s.restSec)}s`)
  return extra.length ? `${core} [${extra.join(', ')}]` : core
}

function describeCardio(c: Cardio): string {
  const p: string[] = []
  if (c.minutes != null) p.push(`${num(c.minutes)} min`)
  if (c.speedKmh != null) p.push(`${num(c.speedKmh)} km/h`)
  if (c.inclinePct != null) p.push(`incline ${num(c.inclinePct)}%`)
  if (c.distanceKm != null) p.push(`${num(c.distanceKm)} km`)
  if (c.notes) p.push(`note: ${c.notes}`)
  return `${c.type}${p.length ? ': ' + p.join(', ') : ''}`
}

function describeEntry(e: ExerciseEntry, name: string): string[] {
  const lines: string[] = []
  const sets = e.sets.map(formatSet).join(', ')
  lines.push(`- ${name}${e.goal ? ` (goal ${e.goal})` : ''}: ${sets || 'no sets'}`)
  if (e.comment) lines.push(`  note: ${e.comment}`)
  return lines
}

/** Human/AI readable Markdown log. */
export function toAiText(data: AppData, o: ExportOptions, today: string): string {
  const f = filterData(data, o)
  const names = new Map(data.exercises.map((e) => [e.id, e.name]))
  const nameOf = (id: string) => names.get(id) ?? '(unknown exercise)'
  const out: string[] = []
  out.push('# Training log')
  out.push(`Period: ${o.from || 'beginning'} to ${o.to || 'latest'} | Exported: ${today}`)
  out.push('Units: weights in kg, speed in km/h, distance in km, incline in %. Sets are written "reps x kg".')
  const parts = [
    o.workouts ? `${f.workouts.length} workouts` : '',
    o.cardio ? `${f.cardio.length} cardio sessions` : '',
    o.steps ? `${f.steps.length} step days` : '',
  ].filter(Boolean)
  out.push(`Contents: ${parts.join(', ') || 'nothing selected'}`)

  if (o.workouts) {
    out.push('', '## Workouts')
    if (!f.workouts.length) out.push('(none in this period)')
    for (const w of f.workouts) {
      out.push('', `### ${w.date} (${weekday(w.date)})${w.title ? ' - ' + w.title : ''}`)
      if (w.comment) out.push(`Day comment: ${w.comment}`)
      for (const e of w.entries) out.push(...describeEntry(e, nameOf(e.exerciseId)))
    }
  }
  if (o.cardio) {
    out.push('', '## Cardio')
    if (!f.cardio.length) out.push('(none in this period)')
    for (const c of f.cardio) out.push(`- ${c.date}: ${describeCardio(c)}`)
  }
  if (o.steps) {
    out.push('', '## Daily steps')
    if (!f.steps.length) out.push('(none in this period)')
    for (const s of f.steps) out.push(`- ${s.date}: ${s.steps}`)
    if (f.steps.length) {
      const avg = Math.round(f.steps.reduce((a, s) => a + s.steps, 0) / f.steps.length)
      out.push(`Average over logged days: ${avg}`)
    }
  }
  if (o.formNotes) {
    const used = new Set(f.workouts.flatMap((w) => w.entries.map((e) => e.exerciseId)))
    const notes = data.exercises.filter((e) => e.formNote && (used.size === 0 || used.has(e.id)))
    if (notes.length) {
      out.push('', '## Form notes per exercise')
      for (const e of notes) out.push(`- ${e.name}: ${e.formNote}`)
    }
  }
  return out.join('\n') + '\n'
}

export type Row = (string | number | null)[]

export function setRows(data: AppData, o: ExportOptions): { header: string[]; rows: Row[] } {
  const f = filterData(data, o)
  const names = new Map(data.exercises.map((e) => [e.id, e.name]))
  const header = [
    'Date', 'Weekday', 'Workout', 'Exercise', 'Goal', 'Set', 'Reps', 'Weight (kg)',
    'Duration (s)', 'Rest (s)', 'RPE', 'Exercise note', 'Day comment',
  ]
  const rows: Row[] = []
  for (const w of f.workouts) {
    for (const e of w.entries) {
      const sets: SetEntry[] = e.sets.length ? e.sets : [{}]
      sets.forEach((s, i) =>
        rows.push([
          w.date, weekday(w.date), w.title, names.get(e.exerciseId) ?? '', e.goal ?? '', i + 1,
          s.reps ?? null, s.weight ?? null, s.durationSec ?? null, s.restSec ?? null, s.rpe ?? null,
          e.comment, w.comment,
        ]),
      )
    }
  }
  return { header, rows }
}

function csvCell(v: string | number | null): string {
  if (v == null) return ''
  const s = String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(data: AppData, o: ExportOptions): string {
  const { header, rows } = setRows(data, o)
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

export async function toXlsx(data: AppData, o: ExportOptions): Promise<Blob> {
  const ExcelJS = (await import('exceljs')).default
  const f = filterData(data, o)
  const wb = new ExcelJS.Workbook()
  const addSheet = (name: string, header: string[], rows: Row[]) => {
    const ws = wb.addWorksheet(name)
    ws.addRow(header).font = { bold: true }
    for (const r of rows) ws.addRow(r)
    ws.columns.forEach((c) => (c.width = 16))
    ws.views = [{ state: 'frozen', ySplit: 1 }]
  }
  if (o.workouts) {
    const s = setRows(data, o)
    addSheet('Sets', s.header, s.rows)
    addSheet(
      'Workouts',
      ['Date', 'Weekday', 'Title', 'Day comment', 'Exercises'],
      f.workouts.map((w: Workout) => [w.date, weekday(w.date), w.title, w.comment, w.entries.length]),
    )
  }
  if (o.cardio)
    addSheet(
      'Cardio',
      ['Date', 'Type', 'Minutes', 'Speed (km/h)', 'Incline (%)', 'Distance (km)', 'Notes'],
      f.cardio.map((c) => [c.date, c.type, c.minutes ?? null, c.speedKmh ?? null, c.inclinePct ?? null, c.distanceKm ?? null, c.notes]),
    )
  if (o.steps) addSheet('Steps', ['Date', 'Steps'], f.steps.map((s) => [s.date, s.steps]))
  if (o.formNotes) addSheet('Form notes', ['Exercise', 'Form note'], data.exercises.map((e) => [e.name, e.formNote]))
  if (!wb.worksheets.length) addSheet('Empty', ['Nothing selected'], [])
  const buf = await wb.xlsx.writeBuffer()
  return new Blob([buf as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}
