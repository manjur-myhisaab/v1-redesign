import { type ReactNode, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { AvatarFullConfig } from 'react-nice-avatar'
import Panel from '@/components/admin/Panel'
import { EmployeeAvatar } from '@/lib/people'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Shared right-side detail panel — the Employees "active record" panel
// extracted so every list page opens an identical animated slide-in panel
// (avatar/icon header, scrollable field body, footer actions, Esc to close).
// ---------------------------------------------------------------------------

export interface DetailPanelProps {
  // controlled visibility — pass open={!!activeId}; the panel plays its own
  // slide-out animation before unmounting when this flips to false
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  // header visual: either a person avatar or a custom icon node
  avatar?: { name: string; sex?: 'man' | 'woman'; config?: AvatarFullConfig }
  icon?: ReactNode
  children: ReactNode // field rows (use <Field/>)
  footer?: ReactNode // action buttons row
  width?: string // tailwind width class, default w-72
}

export default function DetailPanel({
  open,
  onClose,
  title,
  subtitle,
  avatar,
  icon,
  children,
  footer,
  width = 'w-72',
}: DetailPanelProps) {
  // keep the panel mounted through its exit animation
  const [render, setRender] = useState(open)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (open) {
      setRender(true)
      setClosing(false)
    } else if (render) {
      setClosing(true) // play slide-out, unmount on animationEnd
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Esc closes (acts like the close button)
  useEffect(() => {
    if (!render || closing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setClosing(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [render, closing])

  if (!render) return null

  const avatarName = avatar?.name?.trim() ?? ''
  const showAvatar = !!avatar && avatarName !== '' && avatarName !== '—'

  return (
    <Panel
      onAnimationEnd={() => {
        if (closing) {
          setRender(false)
          setClosing(false)
          onClose()
        }
      }}
      className={cn(
        'flex shrink-0 flex-col duration-200 ease-out',
        width,
        closing
          ? 'animate-out fade-out slide-out-to-right-4'
          : 'animate-in fade-in slide-in-from-right-4',
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-start gap-2.5 border-b border-border p-3.5">
          {/* only show a person avatar when there's a real name — otherwise fall
              back to an icon (if any), or no media at all for a clean header */}
          {showAvatar ? (
            <EmployeeAvatar
              name={avatar!.name}
              sex={avatar!.sex}
              config={avatar!.config}
              className="size-9"
            />
          ) : icon ? (
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
              {icon}
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold tracking-tight">
              {title}
            </div>
            {subtitle != null && (
              <div className="truncate text-[13px] text-muted-foreground">
                {subtitle}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setClosing(true)}
            aria-label="Close"
            className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-3.5 text-[13px]">
          {children}
        </div>

        {footer && (
          <div className="flex items-center gap-1.5 border-t border-border p-3">
            {footer}
          </div>
        )}
      </div>
    </Panel>
  )
}

// A label/value row for the panel body (matches the Employees panel fields).
export function Field({
  label,
  children,
}: {
  label: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium">{children}</span>
    </div>
  )
}
