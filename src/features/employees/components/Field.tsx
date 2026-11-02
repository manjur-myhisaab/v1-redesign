import * as React from 'react'

interface FieldProps {
  label: string
  children: React.ReactNode
}

export default function Field({ label, children }: FieldProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium">{children}</span>
    </div>
  )
}
