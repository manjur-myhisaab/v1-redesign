import { useId } from 'react'

// Sparkle (4-point star) centred at the origin.
const SPARKLE =
  'M0 -6 C0.6 -1.6 1.6 -0.6 6 0 C1.6 0.6 0.6 1.6 0 6 C-0.6 1.6 -1.6 0.6 -6 0 C-1.6 -0.6 -0.6 -1.6 0 -6 Z'

export default function EmptyIllustration({ className }: { className?: string }) {
  const coin = useId()
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="">
      <defs>
        <linearGradient id={coin} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe08a" />
          <stop offset="100%" stopColor="#f4b73c" />
        </linearGradient>
      </defs>

      {/* soft background shapes */}
      <circle cx="90" cy="106" r="74" fill="#e8f0ff" />
      <circle cx="140" cy="64" r="40" fill="#efeaff" />

      {/* payslip card */}
      <g transform="rotate(-8 100 102)">
        <rect
          x="60"
          y="46"
          width="80"
          height="110"
          rx="12"
          fill="#ffffff"
          stroke="#e6e8ee"
          strokeWidth="1.5"
        />
        <rect x="72" y="62" width="34" height="7" rx="3.5" fill="#2f63d8" />
        <rect x="72" y="76" width="56" height="5" rx="2.5" fill="#e6e8ee" />
        <rect x="72" y="96" width="56" height="5" rx="2.5" fill="#eef0f4" />
        <rect x="72" y="108" width="44" height="5" rx="2.5" fill="#eef0f4" />
        <rect x="72" y="120" width="52" height="5" rx="2.5" fill="#eef0f4" />
        <rect x="72" y="136" width="30" height="11" rx="5.5" fill="#e7f0ff" />
      </g>

      {/* gold ₹ coin */}
      <g transform="translate(138 134)">
        <circle r="22" fill={`url(#${coin})`} />
        <circle r="22" fill="none" stroke="#dd9f29" strokeOpacity="0.45" strokeWidth="1.5" />
        <text
          x="0"
          y="8"
          textAnchor="middle"
          style={{ fontSize: 24, fontWeight: 700 }}
          fill="#8a5a08"
        >
          ₹
        </text>
      </g>

      {/* sparkles */}
      <path d={SPARKLE} transform="translate(56 58) scale(1.1)" fill="#f6c243" />
      <path d={SPARKLE} transform="translate(150 110) scale(0.8)" fill="#7c5cff" />
    </svg>
  )
}
