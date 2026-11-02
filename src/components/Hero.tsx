import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import LayeredShades from '@/components/LayeredShades'

export default function Hero() {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden">
      <LayeredShades className="absolute inset-0" />

      <div className="relative mx-auto w-full max-w-7xl px-6 py-12">
        <div className="max-w-2xl text-center lg:text-left">
          <h1
            className="hero-rise font-display text-[44px] font-semibold leading-[0.98] tracking-[-0.03em] text-[#11213f] sm:text-[60px] lg:text-[72px]"
            style={{ animationDelay: '0.15s' }}
          >
            Attendance &amp; Payroll,{' '}
            <span className="text-white [text-shadow:0_2px_16px_rgba(17,33,63,0.45)]">
              handled.
            </span>
          </h1>
          <p
            className="hero-rise mt-6 text-lg text-[#1f3358] sm:text-xl"
            style={{ animationDelay: '0.35s' }}
          >
            Run payroll, track attendance and stay compliant — all from one
            clean dashboard.
          </p>
          <div
            className="hero-rise mt-9 flex flex-wrap items-center justify-center gap-3 lg:justify-start"
            style={{ animationDelay: '0.55s' }}
          >
            <Button asChild>
              <Link to="/login">Get started</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
