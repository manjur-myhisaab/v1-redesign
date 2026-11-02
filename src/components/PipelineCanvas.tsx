import { useEffect, useState } from 'react'
import { Inbox, Layers, Cpu, CheckCircle2, XCircle, RotateCcw, Zap, Sparkles, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getQueueHealth, simulateQueueLoad, clearQueueDemo, type QueueHealth } from '@/lib/api'

export default function PipelineCanvas() {
  const [h, setH] = useState<QueueHealth | null>(null)
  const [rate, setRate] = useState<number[]>([])
  const [busyBtn, setBusyBtn] = useState(false)

  useEffect(() => {
    let alive = true
    const tick = () =>
      getQueueHealth().then((d) => {
        if (!alive) return
        setH(d)
        setRate((p) => [...p.slice(-49), d.jobsPerSec])
      })
    tick()
    const iv = setInterval(tick, 1000)
    return () => {
      alive = false
      clearInterval(iv)
    }
  }, [])

  const sim = async () => {
    setBusyBtn(true)
    try {
      await simulateQueueLoad(200)
    } finally {
      setBusyBtn(false)
    }
  }
  const clear = async () => {
    setBusyBtn(true)
    try {
      await clearQueueDemo()
    } finally {
      setBusyBtn(false)
    }
  }

  const workers = h?.workers ?? []
  const depth = h?.depth ?? 0
  const flowing = (h?.jobsPerSec ?? 0) > 0 || depth > 0

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0b1020] text-white">
      <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
      <style>{`@keyframes pipeflow { to { stroke-dashoffset: -24; } } @keyframes pulse2 { 0%,100%{opacity:.5} 50%{opacity:1} }`}</style>

      {/* toolbar */}
      <div className="absolute left-3 top-3 z-20 flex flex-wrap items-center gap-2 rounded-lg bg-white/10 px-2.5 py-1.5 text-[12px] text-white/80 backdrop-blur">
        <Layers className="size-3.5" />
        {h ? `${h.jobsPerSec} jobs/s · queue ${depth} · ${h.pool.active} workers (max ${h.pool.max})` : 'connecting…'}
      </div>
      <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60 backdrop-blur">demo</span>
        <button
          onClick={sim}
          disabled={busyBtn}
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-amber-400 px-3 text-[12px] font-medium text-black backdrop-blur transition-colors hover:bg-amber-300 disabled:opacity-60"
        >
          <Zap className="size-3.5" /> Enqueue 200 jobs
        </button>
        <button
          onClick={clear}
          disabled={busyBtn || depth === 0}
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 px-3 text-[12px] font-medium text-white/80 backdrop-blur transition-colors hover:bg-white/20 disabled:opacity-40"
        >
          <Trash2 className="size-3.5" /> Clear queued
        </button>
      </div>

      {/* flow */}
      <div className="absolute inset-0 grid grid-cols-[1fr_1.1fr_1.6fr_1fr] items-center gap-2 px-8 py-20">
        {/* writes in */}
        <Stage icon={Inbox} title="Writes in" accent="#94a3b8">
          <div className="text-3xl font-semibold tabular-nums">{h?.jobsPerSec ?? 0}<span className="text-sm text-white/50"> /s</span></div>
          <div className="text-[11px] text-white/50">payslip PDFs · notifications · exports</div>
        </Stage>

        <Flow active={flowing} color="#38bdf8" qps={h?.jobsPerSec ?? 0} />

        {/* queue */}
        <Stage icon={Layers} title="Queue (outbox)" accent="#38bdf8">
          <div className="text-3xl font-semibold tabular-nums">{depth}</div>
          <div className="mb-1 text-[11px] text-white/50">waiting · {h?.running ?? 0} running</div>
          <div className="flex h-10 items-end gap-0.5">
            {Array.from({ length: Math.min(40, depth) }).map((_, i) => (
              <span key={i} className="w-1 rounded-sm bg-sky-400/70" style={{ height: `${8 + (i % 5) * 6}px` }} />
            ))}
          </div>
        </Stage>

        {/* workers */}
        <Stage icon={Cpu} title="Worker pool" accent="#a78bfa" wide>
          <div className="mb-2 text-[11px] text-white/50">autoscales {h?.pool.min}–{h?.pool.max} with backlog</div>
          <div className="flex flex-wrap gap-2">
            {workers.map((w) => (
              <div
                key={w.id}
                className={cn('flex w-[88px] flex-col items-center rounded-lg border p-2 transition-all duration-300 animate-in zoom-in-50', w.busy ? 'border-violet-400 bg-violet-400/10' : 'border-white/15 bg-white/5')}
                style={w.busy ? { boxShadow: '0 0 16px #a78bfa55' } : undefined}
              >
                <Cpu className={cn('size-4', w.busy ? 'text-violet-300' : 'text-white/40')} />
                <div className="mt-1 text-[10px] font-medium">W{w.id}</div>
                <div className="text-[9px] text-white/50">{w.busy ? w.type : 'idle'}</div>
                <div className="text-[9px] text-white/30">{w.done} done</div>
              </div>
            ))}
            {workers.length === 0 && <div className="text-[12px] text-white/40">no active workers</div>}
          </div>
        </Stage>
      </div>

      {/* outcomes (right edge) */}
      <div className="absolute right-3 top-1/2 z-10 -translate-y-1/2 space-y-2">
        <Outcome icon={CheckCircle2} color="#34d399" label="Done" value={h?.counters.doneTotal ?? 0} />
        <Outcome icon={XCircle} color="#f87171" label="Failed" value={h?.counters.failedTotal ?? 0} />
        <Outcome icon={RotateCcw} color="#fbbf24" label="Retried" value={h?.counters.retried ?? 0} />
      </div>

      {/* throughput sparkline */}
      <div className="absolute bottom-3 left-3 z-20 w-56 rounded-lg bg-white/10 p-2.5 backdrop-blur">
        <div className="mb-1 text-[10px] uppercase tracking-wide text-white/60">Throughput (jobs/s)</div>
        <Sparkline data={rate} />
      </div>

      {/* worker scaling events */}
      {h && h.events.length > 0 && (
        <div className="absolute bottom-3 right-3 z-20 w-60 rounded-lg bg-white/10 p-2.5 backdrop-blur">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-white/60">Worker autoscaling</div>
          <div className="space-y-1">
            {h.events.slice(0, 5).map((e, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px] text-white/80">
                <Sparkles className={cn('size-3', e.type === 'worker-up' ? 'text-emerald-400' : 'text-sky-400')} />
                {e.type === 'worker-up' ? 'Started' : 'Retired'} worker W{e.workerId}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Stage({ icon: Icon, title, accent, wide, children }: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; title: string; accent: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-2xl border border-white/15 bg-white/5 p-4 backdrop-blur', wide && 'min-h-[180px]')}>
      <div className="mb-2 flex items-center gap-1.5">
        <Icon className="size-4" style={{ color: accent }} />
        <span className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: accent }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

function Flow({ active, color }: { active: boolean; color: string; qps: number }) {
  return (
    <svg height={40} className="w-full overflow-visible">
      <line x1="0%" y1="20" x2="100%" y2="20" stroke={color} strokeOpacity={active ? 0.9 : 0.3} strokeWidth={2} strokeDasharray="6 6" style={active ? { animation: 'pipeflow 0.6s linear infinite' } : undefined} />
    </svg>
  )
}

function Outcome({ icon: Icon, color, label, value }: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string; label: string; value: number }) {
  return (
    <div className="flex w-32 items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 backdrop-blur">
      <Icon className="size-4" style={{ color }} />
      <div>
        <div className="text-[15px] font-semibold tabular-nums leading-none">{value.toLocaleString()}</div>
        <div className="text-[10px] text-white/50">{label}</div>
      </div>
    </div>
  )
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return <div className="h-8 text-[11px] text-white/40">gathering…</div>
  const w = 200, h = 32, max = Math.max(1, ...data)
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(' ')
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke="#a78bfa" strokeWidth={1.5} />
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill="#a78bfa" fillOpacity={0.12} />
    </svg>
  )
}
