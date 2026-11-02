import { cn } from '@/lib/utils'

type Point = [number, number]

// Catmull-Rom spline through points -> smooth, closed cubic-bezier path.
function smoothClosed(pts: Point[]) {
  const n = pts.length
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)} `
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += `C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)} `
  }
  return `${d}Z`
}

// A full circle whose radius wobbles around the edge — jiggly, not clean.
function wobblyCircle(
  cx: number,
  cy: number,
  r: number,
  amp: number,
  lobes: number,
  phase: number,
) {
  const steps = lobes * 6 // ~6 samples per lobe; the spline rounds them off
  const pts: Point[] = []
  for (let i = 0; i < steps; i++) {
    const t = i / steps
    const ang = 2 * Math.PI * t
    const rr = r + amp * Math.sin(lobes * 2 * Math.PI * t + phase)
    pts.push([cx + rr * Math.cos(ang), cy + rr * Math.sin(ang)])
  }
  return smoothClosed(pts)
}

type Band = {
  r: number
  amp: number
  lobes: number
  phase: number
  fill: string
  dur: number
  reverse: boolean
}

// [radius, wobble-amp, lobes, phase, fill, spin-duration(s), reverse]
const BANDS: Band[] = [
  { r: 1250, amp: 30, lobes: 22, phase: 0.6, fill: '#cfe0fb', dur: 150, reverse: false },
  { r: 980, amp: 26, lobes: 26, phase: 2.1, fill: '#a7c5f6', dur: 122, reverse: true },
  { r: 720, amp: 24, lobes: 20, phase: 4.0, fill: '#6f9ff1', dur: 98, reverse: false },
  { r: 460, amp: 18, lobes: 16, phase: 1.0, fill: '#2f63d8', dur: 82, reverse: true },
]

interface LayeredShadesProps {
  className?: string
  // center of the bands in viewBox units (default: top-right corner)
  cx?: number
  cy?: number
}

// Layered shades of blue centred on a corner. Each band is a full wobbly circle,
// so only one quarter shows; the slow rotation keeps the corner covered and never
// opens a gap at the edges.
export default function LayeredShades({
  className,
  cx = 1440,
  cy = 0,
}: LayeredShadesProps) {
  return (
    <svg
      className={cn('pointer-events-none h-full w-full', className)}
      viewBox="0 0 1440 1440"
      preserveAspectRatio="xMaxYMin slice"
      aria-hidden="true"
    >
      <rect x="-720" y="-720" width="2880" height="2880" fill="#eef4fe" />
      {BANDS.map((b) => (
        <path
          key={b.fill}
          className="material-band"
          style={{
            animationDuration: `${b.dur}s`,
            animationDirection: b.reverse ? 'reverse' : 'normal',
          }}
          d={wobblyCircle(cx, cy, b.r, b.amp, b.lobes, b.phase)}
          fill={b.fill}
        />
      ))}
    </svg>
  )
}
