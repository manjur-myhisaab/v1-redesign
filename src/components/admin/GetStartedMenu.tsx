import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, ChevronRight, ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getOnboarding, type OnboardingStatus } from '@/lib/api'

interface StepDef {
  key: keyof OnboardingStatus
  label: string
  hint: string
  to?: string
}

const STEPS: StepDef[] = [
  { key: 'workspaceReady', label: 'Create your workspace', hint: 'Workspace is ready' },
  { key: 'employeesAdded', label: 'Add your first employee', hint: 'Build your team directory', to: '/admin/employees' },
  { key: 'teamInvited', label: 'Invite a team member', hint: 'Give admins/managers access', to: '/admin/settings' },
  { key: 'payrollSetUp', label: 'Set up payroll', hint: 'Configure your pay cycle', to: '/admin/payroll' },
  { key: 'payrollRun', label: 'Run your first payroll', hint: 'Generate payslips', to: '/admin/payroll' },
]

function ProgressRing({ pct }: { pct: number }) {
  const r = 9
  const c = 2 * Math.PI * r
  return (
    <svg className="size-6 -rotate-90" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r={r} fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="3" />
      <circle
        cx="12"
        cy="12"
        r={r}
        fill="none"
        stroke="#2f63d8"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
      />
    </svg>
  )
}

export default function GetStartedMenu({ collapsed }: { collapsed: boolean }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<OnboardingStatus | null>(null)
  const navigate = useNavigate()

  // refresh status whenever the panel opens (and once on mount)
  useEffect(() => {
    getOnboarding().then(setStatus).catch(() => {})
  }, [])
  useEffect(() => {
    if (open) getOnboarding().then(setStatus).catch(() => {})
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const done = status ? STEPS.filter((s) => status[s.key]).length : 0
  const pct = done / STEPS.length
  const allDone = done === STEPS.length

  const go = (to?: string) => {
    setOpen(false)
    if (to) navigate(to)
  }

  // once every onboarding step is done, hide the launcher from the sidebar
  if (allDone) return null

  return (
    <div className="relative">
      {collapsed ? (
        <button
          type="button"
          title="Getting Started"
          onClick={() => setOpen((o) => !o)}
          className="grid size-8 cursor-pointer place-items-center rounded-md bg-[#2f63d8] text-white"
        >
          <Sparkles className="size-4 text-[#f6c243]" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-xl bg-[#2f63d8] px-3 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
        >
          <Sparkles className="size-4 shrink-0 text-[#f6c243]" />
          <span className="flex-1 text-left">Getting Started</span>
          {status && (
            <span className="text-xs text-white/80">
              {done}/{STEPS.length}
            </span>
          )}
          <ChevronRight className="size-4 shrink-0" />
        </button>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-0 left-full z-50 ml-3 w-80 overflow-hidden rounded-xl border border-border bg-background text-foreground shadow-2xl duration-150 animate-in fade-in slide-in-from-left-1">
            <div className="flex items-center gap-2.5 px-4 py-3">
              <ProgressRing pct={pct} />
              <span className="text-sm font-semibold tracking-tight">Get Started</span>
              <span className="ml-auto text-[13px] text-muted-foreground">
                {done} of {STEPS.length} Completed
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Collapse"
                className="cursor-pointer text-muted-foreground hover:text-foreground"
              >
                <ChevronDown className="size-4" />
              </button>
            </div>

            <div className="divide-y divide-border border-t border-border">
              {STEPS.map((s) => {
                const complete = status?.[s.key] ?? false
                return (
                  <button
                    key={s.key}
                    type="button"
                    disabled={complete || !s.to}
                    onClick={() => go(s.to)}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
                      complete || !s.to ? 'cursor-default' : 'cursor-pointer hover:bg-muted',
                    )}
                  >
                    {complete ? (
                      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#2f63d8] text-white">
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                    ) : (
                      <span className="size-5 shrink-0 rounded-full border-2 border-border" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'block text-sm',
                          complete && 'text-muted-foreground line-through',
                        )}
                      >
                        {s.label}
                      </span>
                      {!complete && (
                        <span className="block text-xs text-muted-foreground">{s.hint}</span>
                      )}
                    </span>
                    {!complete && s.to && (
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                )
              })}
            </div>

            <div className="bg-muted/60 px-4 py-3 text-center text-[13px] text-muted-foreground">
              {allDone ? "You're all set! 🎉" : 'Nice start, keep going'}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
