interface GaugeChartProps {
  value: number // 0-100
  caption?: string
  color?: string
}

const R = 80
const STROKE = 14
const W = 2 * R + STROKE
const H = R + STROKE
const CX = W / 2
const CY = R + STROKE / 2

function point(frac: number) {
  const a = Math.PI - Math.PI * frac // radians, 180deg -> 0deg
  return [CX + R * Math.cos(a), CY - R * Math.sin(a)] as const
}

export default function GaugeChart({
  value,
  caption,
  color = '#2f63d8',
}: GaugeChartProps) {
  const frac = Math.max(0, Math.min(1, value / 100))
  const [ex, ey] = point(frac)
  const bg = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`
  const fg = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${ex.toFixed(1)} ${ey.toFixed(1)}`

  return (
    <svg viewBox={`0 0 ${W} ${H + 8}`} className="w-full" style={{ maxHeight: 150 }}>
      <path
        d={bg}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.1"
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      <path
        d={fg}
        fill="none"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      <text
        x={CX}
        y={CY - 6}
        textAnchor="middle"
        className="fill-foreground"
        style={{ fontSize: 30, fontWeight: 600 }}
      >
        {Math.round(value)}%
      </text>
      {caption && (
        <text
          x={CX}
          y={CY + 14}
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: 11 }}
        >
          {caption}
        </text>
      )}
    </svg>
  )
}
