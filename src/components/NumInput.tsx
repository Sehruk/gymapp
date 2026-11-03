import { useState } from 'react'

export function parseNum(s: string): number | undefined {
  const t = s.trim().replace(',', '.')
  if (t === '') return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

interface Props {
  value: number | undefined
  onChange: (v: number | undefined) => void
  placeholder?: string
  label?: string
  integer?: boolean
}

/** Numeric text input that accepts "27,5" or "27.5" and keeps partial typing like "27.". */
export function NumInput({ value, onChange, placeholder, label, integer }: Props) {
  const [text, setText] = useState(value == null ? '' : String(value))
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    if (parseNum(text) !== value) setText(value == null ? '' : String(value))
  }
  return (
    <input
      className="num"
      inputMode={integer ? 'numeric' : 'decimal'}
      placeholder={placeholder}
      aria-label={label ?? placeholder}
      value={text}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        const s = e.target.value
        if (!/^[0-9]*[.,]?[0-9]*$/.test(s)) return
        setText(s)
        const n = parseNum(s)
        setLastValue(n)
        onChange(n)
      }}
    />
  )
}
