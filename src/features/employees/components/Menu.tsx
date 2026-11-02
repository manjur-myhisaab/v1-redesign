import * as React from 'react'

interface MenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger: React.ReactNode
  children: React.ReactNode
}

export default function Menu({
  open,
  onOpenChange,
  trigger,
  children,
}: MenuProps) {
  return (
    <div className="relative">
      <div onClick={() => onOpenChange(!open)}>{trigger}</div>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => onOpenChange(false)} />
          <div className="absolute right-0 top-9 z-50 min-w-44 rounded-xl border border-border bg-popover p-1 shadow-lg duration-150 animate-in fade-in zoom-in-95">
            {children}
          </div>
        </>
      )}
    </div>
  )
}
