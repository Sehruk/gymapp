export function download(file: File) {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

export function canShareFiles(file: File): boolean {
  return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
}

/** Opens the Android share sheet (Drive, WhatsApp, ...). Returns false if not supported. */
export async function shareFile(file: File): Promise<boolean> {
  if (!canShareFiles(file)) return false
  try {
    await navigator.share({ files: [file], title: file.name })
  } catch (e) {
    if ((e as DOMException).name !== 'AbortError') throw e
  }
  return true
}
