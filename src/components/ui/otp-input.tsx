import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'

interface OtpInputProps {
  value: string
  onChange: (value: string) => void
  length?: number
  autoFocus?: boolean
  className?: string
}

export default function OtpInput({
  value,
  onChange,
  length = 6,
  autoFocus = false,
  className,
}: OtpInputProps) {
  const inputs = useRef<Array<HTMLInputElement | null>>([])

  // fixed-length view of the current value, so each box maps to one position
  const digits = Array.from({ length }, (_, i) => value[i] ?? '')

  const focusBox = (i: number) => {
    const el = inputs.current[i]
    if (el) {
      el.focus()
      el.select()
    }
  }

  const commit = (next: string[]) => onChange(next.join('').slice(0, length))

  const handleChange = (i: number, raw: string) => {
    const onlyDigits = raw.replace(/\D/g, '')
    if (!onlyDigits) return
    const next = [...digits]
    next[i] = onlyDigits[onlyDigits.length - 1] // last char typed
    commit(next)
    if (i < length - 1) focusBox(i + 1)
  }

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      const next = [...digits]
      if (next[i]) {
        next[i] = ''
        commit(next)
      } else if (i > 0) {
        next[i - 1] = ''
        commit(next)
        focusBox(i - 1)
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      e.preventDefault()
      focusBox(i - 1)
    } else if (e.key === 'ArrowRight' && i < length - 1) {
      e.preventDefault()
      focusBox(i + 1)
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!pasted) return
    onChange(pasted)
    focusBox(Math.min(pasted.length, length - 1))
  }

  return (
    <div className={cn('flex gap-2', className)}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            inputs.current[i] = el
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          autoFocus={autoFocus && i === 0}
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          aria-label={`Digit ${i + 1}`}
          className="aspect-square w-full min-w-0 rounded-xl border border-input bg-card text-center text-lg font-semibold outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
      ))}
    </div>
  )
}
