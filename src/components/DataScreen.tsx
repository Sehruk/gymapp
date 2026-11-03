import { useRef, useState } from 'react'
import { addDays, todayStr } from '../lib/dates'
import { lastBackupAt, markBackupDone } from '../lib/backupState'
import { toAiText, toCsv, toXlsx } from '../lib/exporters'
import type { ExportOptions } from '../lib/exporters'
import { makeBackup, parseBackup } from '../lib/importer'
import { download, shareFile } from '../lib/share'
import { useStore } from '../store'

type Preset = '7' | '14' | '30' | '90' | '365' | 'all' | 'custom'
const PRESETS: [Preset, string][] = [['7', '7 days'], ['14', '14 days'], ['30', '30 days'], ['90', '90 days'], ['365', '1 year'], ['all', 'All'], ['custom', 'Custom']]

export function DataScreen() {
  const { data, importData } = useStore()
  const [preset, setPreset] = useState<Preset>('30')
  const [from, setFrom] = useState(addDays(todayStr(), -30))
  const [to, setTo] = useState(todayStr())
  const [what, setWhat] = useState({ workouts: true, cardio: true, steps: true, formNotes: true })
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [, force] = useState(0)

  const range = (): { from: string; to: string } => {
    if (preset === 'all') return { from: '', to: '' }
    if (preset === 'custom') return { from, to }
    return { from: addDays(todayStr(), -Number(preset)), to: todayStr() }
  }
  const opts = (): ExportOptions => ({ ...range(), ...what })

  const deliver = async (file: File, markBackup = false) => {
    setMsg('')
    try {
      const shared = await shareFile(file)
      if (!shared) download(file)
      if (markBackup) {
        markBackupDone()
        force((n) => n + 1)
      }
      setMsg(shared ? `Shared “${file.name}”.` : `Saved “${file.name}” to your Downloads.`)
    } catch (e) {
      setMsg(`Could not export: ${(e as Error).message}`)
    }
  }

  const stamp = todayStr()
  const run = async (kind: 'xlsx' | 'ai' | 'csv' | 'json') => {
    setBusy(true)
    try {
      const o = opts()
      if (kind === 'xlsx') {
        const blob = await toXlsx(data, o)
        await deliver(new File([blob], `gymapp-${stamp}.xlsx`, { type: blob.type }))
      } else if (kind === 'ai') {
        await deliver(new File([toAiText(data, o, stamp)], `gymapp-ai-${stamp}.txt`, { type: 'text/plain' }))
      } else if (kind === 'csv') {
        await deliver(new File(['﻿' + toCsv(data, o)], `gymapp-sets-${stamp}.csv`, { type: 'text/csv' }))
      }
    } finally {
      setBusy(false)
    }
  }

  const backup = () =>
    deliver(new File([JSON.stringify(makeBackup(data), null, 1)], `gymapp-backup-${stamp}.json`, { type: 'application/json' }), true)

  const onImport = async (file: File, mode: 'merge' | 'replace') => {
    try {
      const incoming = parseBackup(await file.text())
      const summary = `${incoming.workouts.length} workouts, ${incoming.cardio.length} cardio, ${incoming.steps.length} step days, ${incoming.exercises.length} exercises`
      const ok = mode === 'replace'
        ? confirm(`This will ERASE all data on this phone and replace it with the backup (${summary}). Continue?`)
        : confirm(`Add the backup (${summary}) to your current data? Items with the same ID are overwritten.`)
      if (!ok) return
      await importData(incoming, mode)
      setMsg(`Imported ${summary}.`)
    } catch (e) {
      setMsg(`Import failed: ${(e as Error).message}`)
    }
  }
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge')

  const last = lastBackupAt()

  return (
    <div className="screen">
      <header className="top"><h1>Data</h1></header>

      <div className="card">
        <h2>Backup</h2>
        <p className="muted">
          Your data lives only on this phone. If the app is deleted or you change phones it is lost — unless you saved a backup file
          (send it to Google Drive or WhatsApp). Last backup: {last ? new Date(last).toLocaleString('en-GB') : 'never'}.
        </p>
        <button className="btn primary big" onClick={backup}>Back up everything (JSON)</button>
      </div>

      <div className="card">
        <h2>Export for analysis</h2>
        <div className="chips">
          {PRESETS.map(([k, label]) => (
            <button key={k} className={'chip' + (preset === k ? ' on' : '')} onClick={() => setPreset(k)}>{label}</button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="grid2">
            <label className="field"><span>From</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="field"><span>To</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          </div>
        )}
        <div className="checks">
          {([['workouts', 'Workouts'], ['cardio', 'Cardio'], ['steps', 'Steps'], ['formNotes', 'Form notes']] as const).map(([k, label]) => (
            <label key={k}><input type="checkbox" checked={what[k]} onChange={(e) => setWhat({ ...what, [k]: e.target.checked })} /> {label}</label>
          ))}
        </div>
        <button className="btn primary" disabled={busy} onClick={() => run('ai')}>AI-readable text (.txt)</button>
        <button className="btn secondary" disabled={busy} onClick={() => run('xlsx')}>Excel (.xlsx)</button>
        <button className="btn secondary" disabled={busy} onClick={() => run('csv')}>CSV – one row per set</button>
        <p className="hint">The file opens your phone's share menu (Drive, WhatsApp, …). If sharing isn't available it is saved to Downloads.</p>
      </div>

      <div className="card">
        <h2>Restore from backup</h2>
        <div className="chips">
          <button className={'chip' + (importMode === 'merge' ? ' on' : '')} onClick={() => setImportMode('merge')}>Add to current data</button>
          <button className={'chip' + (importMode === 'replace' ? ' on' : '')} onClick={() => setImportMode('replace')}>Replace everything</button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onImport(f, importMode)
            e.target.value = ''
          }}
        />
        <button className="btn secondary" onClick={() => fileRef.current?.click()}>Choose backup file…</button>
      </div>

      {msg && <p className="toast">{msg}</p>}
    </div>
  )
}
