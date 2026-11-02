import { useEffect, useRef, useState, useCallback } from 'react'
import { Database, HardDriveDownload, Server, Maximize2, ArrowUpDown, Zap, TrendingUp, TrendingDown, Sparkles } from 'lucide-react'
import { getDbHealth, simulateDbLoad, type DbHealth, type DbNodeHealth, type ScaleEvent } from '@/lib/api'
import { cn } from '@/lib/utils'

// logical canvas layout — replicas sit in a single horizontal row, spaced by
// (node width + gap) so they never overlap however many are autoscaled.
type Box = { x: number; y: number; w: number; h: number }
const REPW = 190
const REPH = 96
const GAP = 40
function layout(n: number) {
  const firstX = 120
  const step = REPW + GAP
  const count = Math.max(1, n)
  const reps: Box[] = Array.from({ length: count }, (_, i) => ({ x: firstX + i * step, y: 380, w: REPW, h: REPH }))
  const rowW = (count - 1) * step + REPW
  const centerX = firstX + rowW / 2
  return {
    reps,
    app: { x: centerX - 100, y: 10, w: 200, h: 70 } as Box,
    primary: { x: centerX - 100, y: 180, w: 200, h: 96 } as Box,
    contentW: firstX * 2 + rowW,
    contentH: 510,
  }
}

const center = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 })

export default function DbCanvas() {
  const [health, setHealth] = useState<DbHealth | null>(null)
  const [qpsHistory, setQpsHistory] = useState<number[]>([])
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 })
  const [sim, setSim] = useState(false)
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)
  const wrap = useRef<HTMLDivElement>(null)

  const toggleSim = async () => {
    const r = await simulateDbLoad(!sim)
    setSim(r.simulating)
  }

  const nodes = health?.nodes ?? []
  const replicas = nodes.filter((n) => n.role === 'replica')
  const primary = nodes.find((n) => n.role === 'primary')
  const maxQps = Math.max(1, ...nodes.map((n) => n.qps))
  const L = layout(replicas.length || 2)
  const dimRef = useRef(L)
  dimRef.current = L

  useEffect(() => {
    let alive = true
    const tick = () =>
      getDbHealth().then((h) => {
        if (!alive) return
        setHealth(h)
        setSim(h.autoscale.simulating)
        setQpsHistory((prev) => [...prev.slice(-49), h.totals.qps])
      })
    tick()
    const iv = setInterval(tick, 1200)
    return () => {
      alive = false
      clearInterval(iv)
    }
  }, [])

  // fit-to-view (re-runs when the replica count — and thus content width — changes)
  const fit = useCallback(() => {
    const el = wrap.current
    if (!el) return
    const cw = dimRef.current.contentW
    const ch = dimRef.current.contentH
    const scale = Math.min((el.clientWidth - 24) / cw, (el.clientHeight - 24) / ch, 1.1)
    setView({ x: (el.clientWidth - cw * scale) / 2, y: (el.clientHeight - ch * scale) / 2, scale })
  }, [])
  useEffect(() => {
    fit()
  }, [fit, replicas.length])

  const onDown = (e: React.MouseEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }
  }
  const onMove = (e: React.MouseEvent) => {
    if (!drag.current) return
    setView((v) => ({ ...v, x: drag.current!.vx + (e.clientX - drag.current!.x), y: drag.current!.vy + (e.clientY - drag.current!.y) }))
  }
  const onUp = () => (drag.current = null)
  const onWheel = (e: React.WheelEvent) => {
    const factor = e.deltaY < 0 ? 1.08 : 0.93
    setView((v) => ({ ...v, scale: Math.max(0.4, Math.min(2, v.scale * factor)) }))
  }

  return (
    <div ref={wrap} className="relative h-full w-full overflow-hidden bg-[#0b1020]">
      {/* dotted canvas bg */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />
      <style>{`@keyframes dbflow { to { stroke-dashoffset: -24; } }`}</style>

      {/* toolbar */}
      <div className="absolute left-3 top-3 z-20 flex flex-wrap items-center gap-2 rounded-lg bg-white/10 px-2.5 py-1.5 text-[12px] text-white/80 backdrop-blur">
        <Database className="size-3.5" />
        {health ? `${health.totals.qps} qps · ${health.totals.reads.toLocaleString()} reads · ${health.totals.writes.toLocaleString()} writes` : 'connecting…'}
        {health && (
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px]">
            {health.autoscale.activeReplicas} replicas · {health.autoscale.perReplicaQps} qps/replica
          </span>
        )}
        {health && health.replicasConfigured === 0 && (
          <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] text-amber-300">replicas simulated</span>
        )}
      </div>
      <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
        <button
          onClick={toggleSim}
          className={cn(
            'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium backdrop-blur transition-colors',
            sim ? 'bg-amber-400 text-black hover:bg-amber-300' : 'bg-white/10 text-white/80 hover:bg-white/20',
          )}
        >
          <Zap className="size-3.5" /> {sim ? 'Stop load' : 'Simulate load'}
        </button>
        <button onClick={fit} className="grid size-8 cursor-pointer place-items-center rounded-lg bg-white/10 text-white/80 backdrop-blur hover:bg-white/20" aria-label="Fit">
          <Maximize2 className="size-3.5" />
        </button>
      </div>

      {/* scaling events feed */}
      {health && health.events.length > 0 && (
        <div className="absolute bottom-3 right-3 z-20 max-h-40 w-64 overflow-hidden rounded-lg bg-white/10 p-2.5 backdrop-blur">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-white/60">Autoscaling events</div>
          <div className="space-y-1">
            {health.events.slice(0, 5).map((e: ScaleEvent, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[11px] text-white/80">
                {e.type === 'scale-up' ? <TrendingUp className="mt-0.5 size-3 shrink-0 text-emerald-400" /> : <TrendingDown className="mt-0.5 size-3 shrink-0 text-sky-400" />}
                <span>
                  <span className="font-medium">{e.type === 'scale-up' ? 'Added' : 'Removed'} {e.nodeId}</span>
                  <span className="block text-white/45">{e.reason}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* live QPS sparkline */}
      <div className="absolute bottom-3 left-3 z-20 w-56 rounded-lg bg-white/10 p-2.5 backdrop-blur">
        <div className="mb-1 text-[10px] uppercase tracking-wide text-white/60">Live throughput (qps)</div>
        <Sparkline data={qpsHistory} />
      </div>

      <div
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={onUp}
        onWheel={onWheel}
      >
        <div className="absolute origin-top-left" style={{ transform: `translate(${view.x}px,${view.y}px) scale(${view.scale})` }}>
          {/* connectors */}
          <svg width={L.contentW} height={L.contentH} className="absolute left-0 top-0 overflow-visible">
            {primary && <Connector from={center(L.app)} to={center(L.primary)} color="#f59e0b" qps={primary.qps} label="writes" />}
            {replicas.map((r, i) => (
              <Connector key={`a${r.id}`} from={center(L.app)} to={center(L.reps[i])} color="#38bdf8" qps={r.qps} label="reads" />
            ))}
            {replicas.map((r, i) => (
              <Connector key={`rep${r.id}`} from={center(L.primary)} to={center(L.reps[i])} color="#a78bfa" qps={Math.max(1, r.qps)} dashed label="replication" />
            ))}
          </svg>

          {/* App node */}
          <NodeBox box={L.app} title="Application" sub="API server" icon={HardDriveDownload} />

          {/* Primary */}
          {primary && <DbNodeBox box={L.primary} node={primary} maxQps={maxQps} />}

          {/* Replicas */}
          {replicas.map((r, i) => (
            <DbNodeBox key={r.id} box={L.reps[i]} node={r} maxQps={maxQps} />
          ))}
        </div>
      </div>
    </div>
  )
}

function Connector({ from, to, color, qps, dashed, label }: { from: { x: number; y: number }; to: { x: number; y: number }; color: string; qps: number; dashed?: boolean; label: string }) {
  const active = qps > 0
  const dur = Math.max(0.35, 2.2 - Math.min(qps, 18) * 0.1)
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
  return (
    <g>
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={color} strokeOpacity={active ? 0.9 : 0.25} strokeWidth={2}
        strokeDasharray={dashed ? '2 6' : '6 6'}
        style={active ? { animation: `dbflow ${dur}s linear infinite` } : undefined} />
      <text x={mid.x} y={mid.y - 6} fill={color} fillOpacity={0.7} fontSize={10} textAnchor="middle">{label}{active ? ` · ${qps}/s` : ''}</text>
    </g>
  )
}

function NodeBox({ box, title, sub, icon: Icon }: { box: { x: number; y: number; w: number; h: number }; title: string; sub: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="absolute rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white backdrop-blur" style={{ left: box.x, top: box.y, width: box.w, height: box.h }}>
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-white/70" />
        <span className="text-[13px] font-semibold">{title}</span>
      </div>
      <div className="mt-1 text-[11px] text-white/50">{sub}</div>
    </div>
  )
}

function DbNodeBox({ box, node, maxQps }: { box: { x: number; y: number; w: number; h: number }; node: DbNodeHealth; maxQps: number }) {
  const isPrimary = node.role === 'primary'
  const accent = isPrimary ? '#f59e0b' : '#38bdf8'
  const load = Math.min(1, node.qps / maxQps)
  return (
    <div
      className={cn(
        'absolute rounded-xl border bg-white/5 p-3 text-white backdrop-blur transition-all duration-300',
        node.dynamic && 'animate-in zoom-in-50 fade-in',
        node.draining && 'opacity-40 grayscale',
      )}
      style={{
        left: box.x, top: box.y, width: box.w, height: box.h,
        borderColor: node.draining ? '#f87171' : node.qps > 0 ? accent : 'rgba(255,255,255,0.15)',
        boxShadow: node.qps > 0 && !node.draining ? `0 0 ${12 + load * 28}px ${accent}55` : 'none',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {isPrimary ? <Database className="size-4" style={{ color: accent }} /> : <Server className="size-4" style={{ color: accent }} />}
          <span className="text-[13px] font-semibold">{isPrimary ? 'Primary' : node.id.replace('replica-', 'Replica ')}</span>
          {node.dynamic && (
            <span className="inline-flex items-center gap-0.5 rounded bg-emerald-400/20 px-1 py-0.5 text-[8px] font-semibold text-emerald-300">
              <Sparkles className="size-2" /> AUTO
            </span>
          )}
        </div>
        <span className="rounded px-1.5 py-0.5 text-[9px] font-medium" style={{ background: `${accent}22`, color: accent }}>
          {node.draining ? 'draining…' : isPrimary ? 'read · write' : 'read-only'}
        </span>
      </div>
      <div className="mt-1.5 grid grid-cols-3 gap-1 text-center">
        <Stat label="qps" value={String(node.qps)} />
        <Stat label="latency" value={`${node.avgLatencyMs}ms`} />
        <Stat label={isPrimary ? 'writes' : 'reads'} value={(isPrimary ? node.writes : node.reads).toLocaleString()} />
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full transition-all" style={{ width: `${load * 100}%`, background: accent }} />
      </div>
      {node.backing === 'primary-fallback' && (
        <div className="mt-1 flex items-center gap-1 text-[9px] text-amber-300/80"><ArrowUpDown className="size-2.5" /> served by primary (no replica URL)</div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[13px] font-semibold tabular-nums leading-tight">{value}</div>
      <div className="text-[9px] uppercase tracking-wide text-white/45">{label}</div>
    </div>
  )
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return <div className="h-8 text-[11px] text-white/40">gathering…</div>
  const w = 200
  const h = 32
  const max = Math.max(1, ...data)
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(' ')
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke="#38bdf8" strokeWidth={1.5} />
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill="#38bdf8" fillOpacity={0.12} />
    </svg>
  )
}
