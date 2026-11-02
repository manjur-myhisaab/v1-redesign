import { useId } from 'react'

interface Point {
  label: string
  value: number
}

interface AreaChartProps {
  data: Point[]
  height?: number
  color?: string
}

const W = 640
const PAD = { top: 16, right: 12, bottom: 28, left: 36 }

// smooth (Catmull-Rom -> bezier) path through the points
function smoothPath(pts: [number, number][]) {
  if (pts.length < 2) return ''
  let d = `M${pts[0][0]} ${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  return d
}

export default function AreaChart({
  data,
  height = 240,
  color = '#2f63d8',
}: AreaChartProps) {
  const gradId = useId()
  const max = Math.max(...data.map((d) => d.value))
  const min = Math.min(...data.map((d) => d.value), 0)
  const range = max - min || 1

  const innerW = W - PAD.left - PAD.right
  const innerH = height - PAD.top - PAD.bottom

  const x = (i: number) =>
    PAD.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW)
  const y = (v: number) => PAD.top + innerH - ((v - min) / range) * innerH

  const pts = data.map((d, i) => [x(i), y(d.value)] as [number, number])
  const line = smoothPath(pts)
  const area = `${line} L${x(data.length - 1)} ${PAD.top + innerH} L${x(0)} ${PAD.top + innerH} Z`

  const gridLines = 4
  const ticks = Array.from({ length: gridLines + 1 }, (_, i) => min + (range * i) / gridLines)

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* horizontal grid + y labels */}
      {ticks.map((t, i) => {
        const yy = y(t)
        return (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={yy}
              y2={yy}
              stroke="currentColor"
              strokeOpacity="0.08"
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={PAD.left - 8}
              y={yy + 3}
              textAnchor="end"
              className="fill-muted-foreground"
              style={{ fontSize: 10 }}
            >
              {Math.round(t)}
            </text>
          </g>
        )
      })}

      {/* area + line */}
      <path d={area} fill={`url(#${gradId})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* x labels */}
      {data.map((d, i) => (
        <text
          key={d.label}
          x={x(i)}
          y={height - 8}
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: 10 }}
        >
          {d.label}
        </text>
      ))}
    </svg>
  )
}
