const KEY = 'gymapp:lastBackup'

export function markBackupDone() {
  localStorage.setItem(KEY, String(Date.now()))
}

export function lastBackupAt(): number | null {
  const v = localStorage.getItem(KEY)
  return v ? Number(v) : null
}

export function daysSinceBackup(): number | null {
  const t = lastBackupAt()
  return t == null ? null : Math.floor((Date.now() - t) / 86400000)
}
