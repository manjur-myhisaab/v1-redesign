import { useEffect } from 'react'
import { X } from 'lucide-react'

interface BetaModalProps {
  open: boolean
  onClose: () => void
  onJoin?: () => void
}

export default function BetaModal({ open, onClose, onJoin }: BetaModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center p-4">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm duration-200 animate-in fade-in"
        onClick={onClose}
      />

      {/* card */}
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-background shadow-2xl duration-200 animate-in fade-in zoom-in-95">
        {/* close */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 grid size-7 cursor-pointer place-items-center rounded-full bg-white/40 text-black/70 backdrop-blur-sm transition-colors hover:bg-white/60 hover:text-black"
        >
          <X className="size-4" />
        </button>

        {/* gradient header with a filtered dust overlay */}
        <div className="relative grid h-40 place-items-center overflow-hidden bg-gradient-to-br from-sky-300 via-teal-300 to-emerald-400">
          {/* dust / grain — overlay grain + light speckle */}
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full opacity-70 mix-blend-overlay"
            aria-hidden="true"
          >
            <filter id="beta-dust">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.7"
                numOctaves="4"
                stitchTiles="stitch"
              />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width="100%" height="100%" filter="url(#beta-dust)" />
          </svg>
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full opacity-40 mix-blend-screen"
            aria-hidden="true"
          >
            <filter id="beta-dust-fine">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="1.3"
                numOctaves="2"
                stitchTiles="stitch"
              />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width="100%" height="100%" filter="url(#beta-dust-fine)" />
          </svg>

          <svg
            className="relative h-24 w-64 overflow-visible [filter:drop-shadow(0_3px_6px_rgba(0,0,0,0.22))]"
            role="img"
            aria-label="Cynthia"
          >
            <text
              x="50%"
              y="52%"
              textAnchor="middle"
              dominantBaseline="central"
              fill="#000000"
              stroke="#ffffff"
              strokeWidth="9"
              strokeLinejoin="round"
              strokeLinecap="round"
              paintOrder="stroke"
              style={{
                fontFamily: "'HSB Sans', system-ui, sans-serif",
                fontSize: 48,
                fontWeight: 600,
                letterSpacing: '-3px',
              }}
            >
              Cynthia
            </text>
          </svg>
        </div>

        {/* body */}
        <div className="p-6">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-semibold tracking-tight">
              Unlock AI
            </h2>
            <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-xs font-medium text-rose-600">
              Private Beta
            </span>
          </div>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
            Meet <span className="font-medium text-foreground">Cynthia</span> —
            your AI payroll copilot that runs payroll, answers questions and
            flags issues for you. Enroll in the beta preview to get early access.
          </p>

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={onJoin ?? onClose}
              className="btn-3d cursor-pointer rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Join the beta
            </button>
            <button
              onClick={onClose}
              className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
