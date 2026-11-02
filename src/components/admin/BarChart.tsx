interface Bar {
  label: string
  value: number
}

interface BarChartProps {
  data: Bar[]
  height?: number
  color?: string
}

const W = 640
const PAD = { top: 16, right: 12, bottom: 28, left: 36 }

export default function BarChart({
  data,
  height = 240,
  color = '#2f63d8',
}: BarChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1)
  const innerW = W - PAD.left - PAD.right
  const innerH = height - PAD.top - PAD.bottom
  const slot = innerW / data.length
  const barW = Math.min(48, slot * 0.5)

  const gridLines = 4
  const ticks = Array.from({ length: gridLines + 1 }, (_, i) => (max * i) / gridLines)

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
    >
      {ticks.map((t, i) => {
        const y = PAD.top + innerH - (t / max) * innerH
        return (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y}
              y2={y}
              stroke="currentColor"
              strokeOpacity="0.08"
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={PAD.left - 8}
              y={y + 3}
              textAnchor="end"
              className="fill-muted-foreground"
              style={{ fontSize: 10 }}
            >
              {Math.round(t)}
            </text>
          </g>
        )
      })}

      {data.map((d, i) => {
        const cx = PAD.left + slot * i + slot / 2
        const h = (d.value / max) * innerH
        const y = PAD.top + innerH - h
        return (
          <g key={d.label}>
            <rect
              x={cx - barW / 2}
              y={y}
              width={barW}
              height={Math.max(0, h)}
              rx="6"
              fill={color}
              fillOpacity="0.85"
            />
            <text
              x={cx}
              y={height - 8}
              textAnchor="middle"
              className="fill-muted-foreground"
              style={{ fontSize: 10 }}
            >
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
