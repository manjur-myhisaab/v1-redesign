import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  variant?: 'black' | 'white'
}

export default function Logo({ className = '', variant = 'black' }: LogoProps) {
  return (
    <Link
      to="/"
      className={cn('flex items-center', className)}
      aria-label="myHisaab home"
    >
      <img
        src={variant === 'white' ? '/logo-big-white.png' : '/logo-big-black.png'}
        alt="myHisaab"
        className="h-[26px] w-auto select-none"
        draggable={false}
      />
    </Link>
  )
}
