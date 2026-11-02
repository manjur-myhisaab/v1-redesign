import { useEffect, useState } from 'react'
import { X, Check, Minus, Plus, ArrowRight, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  createBillingOrder,
  verifyBilling,
  upgradeSeatsToPro,
  getBillingSummary,
  type Paywall,
  type AnnualTier,
  type BillingSummary,
} from '@/lib/api'
import { openCheckout } from '@/lib/razorpay'
import { sound } from '@/lib/sound'

const rupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

const BENEFITS = [
  'Unlimited departments & roles',
  'A.I. Selfie + GPS attendance',
  'Automated payroll & payslips',
  'Advances, loans & reports',
]

// fallback if the server payload predates tiered annual plans
const DEFAULT_ANNUAL_TIERS: AnnualTier[] = [
  { plan: 'annual', pricePaise: 11_800_00, employeeCap: 100, label: 'Up to 100 employees' },
  { plan: 'annual_500', pricePaise: 16_520_00, employeeCap: 500, label: 'Up to 500 employees' },
  { plan: 'annual_unlimited', pricePaise: 24_780_00, employeeCap: 1_000_000, label: '500+ employees' },
]
const DEFAULT_PRO_SEAT_PAISE = 21_53_50 // ₹2,153.50 (₹1,825 + 18% GST)

const tierName = (cap: number) =>
  cap <= 100 ? 'Annual' : cap <= 500 ? 'Annual Plus' : 'Annual Max'

const POPULAR_PLAN = 'annual_500'

type RazorpayCtor = new (opts: Record<string, unknown>) => { open: () => void }
function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as unknown as { Razorpay?: RazorpayCtor }).Razorpay) return resolve(true)
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = () => resolve(true)
    s.onerror = () => resolve(false)
    document.body.appendChild(s)
  })
}

interface UpgradeModalProps {
  workspaceId: string
  workspaceName?: string
  paywall: Paywall
  onClose: () => void
  onSuccess: () => void
}

export default function UpgradeModal({
  workspaceId,
  workspaceName,
  paywall,
  onClose,
  onSuccess,
}: UpgradeModalProps) {
  const annualTiers = paywall.annualTiers?.length ? paywall.annualTiers : DEFAULT_ANNUAL_TIERS
  const basicPaise = paywall.perMemberPaise
  const proPaise = paywall.proSeatPaise ?? DEFAULT_PRO_SEAT_PAISE

  const [plan, setPlan] = useState<string>(annualTiers[0]?.plan ?? 'annual')
  const [basicSeats, setBasicSeats] = useState(1)
  const [proSeats, setProSeats] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // current seat ownership — drives the "upgrade Basic → Pro" path below
  const [summary, setSummary] = useState<BillingSummary | null>(null)
  const [upgradeCount, setUpgradeCount] = useState(1)
  useEffect(() => {
    getBillingSummary(workspaceId)
      .then(setSummary)
      .catch(() => {})
  }, [workspaceId])

  const ownedBasic = summary?.seats.basic ?? 0
  const ownedPro = summary?.seats.pro ?? 0
  const upgradeDiffPaise = Math.max(0, proPaise - basicPaise)
  const clampedUpgrade = Math.min(Math.max(1, upgradeCount), Math.max(1, ownedBasic))
  const upgradeTotal = clampedUpgrade * upgradeDiffPaise

  const upgradeToPro = async () => {
    if (busy || ownedBasic < 1) return
    setBusy(true)
    setError('')
    try {
      const order = await upgradeSeatsToPro(workspaceId, clampedUpgrade)
      const result = await openCheckout(order, {
        name: workspaceName ?? 'myHisaab Payroll',
        description: `Upgrade ${clampedUpgrade} Basic seat(s) to Pro`,
      })
      if (!result) {
        setBusy(false)
        return // user dismissed checkout
      }
      await verifyBilling(workspaceId, {
        orderId: order.orderId,
        paymentId: result.paymentId,
        signature: result.signature,
        plan: order.plan,
        basicSeats: order.basicSeats,
        proSeats: order.proSeats,
      })
      sound.success()
      onSuccess()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  const selectedTier = annualTiers.find((t) => t.plan === plan)
  const isPerMember = plan === 'per_member'
  const perSeatTotal = basicSeats * basicPaise + proSeats * proPaise
  const total = selectedTier ? selectedTier.pricePaise : perSeatTotal
  const canPay = selectedTier ? true : basicSeats + proSeats > 0

  const pay = async () => {
    if (busy || !canPay) return
    setBusy(true)
    setError('')
    try {
      const order = await createBillingOrder(
        workspaceId,
        plan,
        isPerMember ? { basicSeats, proSeats } : undefined,
      )
      if (!(await loadRazorpay())) {
        setError('Could not load Razorpay checkout')
        setBusy(false)
        return
      }
      const Razorpay = (window as unknown as { Razorpay: RazorpayCtor }).Razorpay
      const rzp = new Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: workspaceName ?? 'myHisaab Payroll',
        description: selectedTier
          ? `Annual plan · ${selectedTier.label}`
          : `${basicSeats} Basic + ${proSeats} Pro seat(s)`,
        theme: { color: '#2f63d8' },
        handler: async (resp: {
          razorpay_payment_id: string
          razorpay_signature: string
        }) => {
          try {
            await verifyBilling(workspaceId, {
              orderId: order.orderId,
              paymentId: resp.razorpay_payment_id,
              signature: resp.razorpay_signature,
              plan,
              basicSeats: order.basicSeats,
              proSeats: order.proSeats,
            })
            sound.success()
            onSuccess()
          } catch (err) {
            setError((err as Error).message)
          } finally {
            setBusy(false)
          }
        },
        modal: { ondismiss: () => setBusy(false) },
      })
      rzp.open()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-2xl duration-200 animate-in fade-in zoom-in-95">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 grid size-7 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>

        {/* header */}
        <p className="text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Upgrade
        </p>
        <h2 className="mt-1 text-center font-display text-2xl font-semibold tracking-tight">
          Your team is growing. <span className="text-[#2f63d8]">Go further.</span>
        </h2>
        <p className="mx-auto mt-1.5 max-w-md text-center text-[13px] text-muted-foreground">
          Upgrade for more staff, attendance and automated payroll.
          <br />
          You're using {paywall.usedSeats} of {paywall.seatLimit} included on the{' '}
          {paywall.plan} plan.
        </p>

        {/* benefits */}
        <div className="mx-auto mt-4 grid max-w-md grid-cols-1 gap-2 sm:grid-cols-2">
          {BENEFITS.map((b) => (
            <div key={b} className="flex items-center gap-2 text-[13px]">
              <span className="grid size-4 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                <Check className="size-3" strokeWidth={3} />
              </span>
              {b}
            </div>
          ))}
        </div>

        {/* plans — horizontal row (stacks on mobile) */}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-stretch">
          {annualTiers.map((t) => (
            <button
              key={t.plan}
              type="button"
              onClick={() => setPlan(t.plan)}
              className={cn(
                'relative flex flex-col rounded-xl border p-3 text-left transition-colors sm:min-w-0 sm:flex-1',
                plan === t.plan
                  ? 'border-[#2f63d8] bg-[#2f63d8]/5 ring-1 ring-[#2f63d8]'
                  : 'border-border hover:bg-muted',
              )}
            >
              {t.plan === POPULAR_PLAN && (
                <span className="absolute -top-2 right-3 rounded-full bg-[#f6c243] px-2 py-0.5 text-[10px] font-semibold text-black">
                  Most popular
                </span>
              )}
              <div className="flex items-center justify-between gap-1">
                <span className="text-[13px] font-semibold">{tierName(t.employeeCap)}</span>
                <Radio active={plan === t.plan} />
              </div>
              <div className="mt-1.5 text-xl font-semibold tracking-tight">
                {rupees(t.pricePaise)}
                <span className="text-xs font-normal text-muted-foreground"> / yr</span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                {t.label}
                <br />
                GST incl.
              </p>
            </button>
          ))}

          {/* per-seat (configure Basic/Pro below) */}
          <button
            type="button"
            onClick={() => setPlan('per_member')}
            className={cn(
              'flex flex-col rounded-xl border p-3 text-left transition-colors sm:min-w-0 sm:flex-1',
              isPerMember
                ? 'border-[#2f63d8] bg-[#2f63d8]/5 ring-1 ring-[#2f63d8]'
                : 'border-border hover:bg-muted',
            )}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[13px] font-semibold">Per seat</span>
              <Radio active={isPerMember} />
            </div>
            <div className="mt-1.5 text-xl font-semibold tracking-tight">
              {rupees(basicPaise)}
              <span className="text-xs font-normal text-muted-foreground"> / seat</span>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              Basic or Pro · pay as you grow
            </p>
          </button>
        </div>

        {/* per-seat configurator (Basic + Pro mix) */}
        {isPerMember && (
          <div className="mt-3 space-y-2 rounded-xl border border-border p-3">
            <SeatRow
              title="Basic"
              sub="Attendance, payroll & payslips"
              pricePaise={basicPaise}
              value={basicSeats}
              onChange={setBasicSeats}
            />
            <div className="border-t border-border" />
            <SeatRow
              title="Pro"
              sub="Everything in Basic + live GPS tracking"
              pricePaise={proPaise}
              badge={
                <span className="inline-flex items-center gap-1 rounded-full bg-[#2f63d8]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#2f63d8]">
                  <MapPin className="size-2.5" />
                  Live tracking
                </span>
              }
              value={proSeats}
              onChange={setProSeats}
            />
          </div>
        )}

        {/* upgrade existing Basic seats to Pro (pay only the difference) */}
        {ownedBasic > 0 && (
          <div className="mt-3 rounded-xl border border-[#2f63d8]/30 bg-[#2f63d8]/5 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-semibold">Upgrade Basic seats to Pro</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#2f63d8]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#2f63d8]">
                    <MapPin className="size-2.5" />
                    Live tracking
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  You own {ownedBasic} Basic · {ownedPro} Pro seat
                  {ownedPro === 1 ? '' : 's'}. Pay only the difference (
                  {rupees(upgradeDiffPaise)}/seat) to unlock live GPS tracking.
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setUpgradeCount((n) => Math.max(1, n - 1))}
                  className="grid size-6 cursor-pointer place-items-center rounded-md border border-border bg-background hover:bg-muted"
                >
                  <Minus className="size-3.5" />
                </button>
                <span className="w-6 text-center text-sm font-medium tabular-nums">
                  {clampedUpgrade}
                </span>
                <button
                  type="button"
                  onClick={() => setUpgradeCount((n) => Math.min(ownedBasic, n + 1))}
                  className="grid size-6 cursor-pointer place-items-center rounded-md border border-border bg-background hover:bg-muted"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
            </div>
            <button
              onClick={upgradeToPro}
              disabled={busy}
              className="mt-2.5 inline-flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#2f63d8] bg-background text-[13px] font-medium text-[#2f63d8] transition-colors hover:bg-[#2f63d8]/10 disabled:opacity-60"
            >
              {busy
                ? 'Opening checkout…'
                : `Upgrade ${clampedUpgrade} seat${clampedUpgrade > 1 ? 's' : ''} · ${rupees(upgradeTotal)}`}
            </button>
          </div>
        )}

        {/* total + CTA */}
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total</span>
          <span className="font-semibold">
            {selectedTier ? `${rupees(total)} / yr` : rupees(total)}
          </span>
        </div>

        {error && <p className="mt-2 text-center text-[13px] text-rose-600">{error}</p>}

        <button
          onClick={pay}
          disabled={busy || !canPay}
          className="btn-3d mt-3 inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy ? 'Opening checkout…' : 'Continue to payment'}
          {!busy && <ArrowRight className="size-4" />}
        </button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Secure payment via Razorpay · GST included
        </p>
      </div>
    </div>
  )
}

function SeatRow({
  title,
  sub,
  pricePaise,
  badge,
  value,
  onChange,
}: {
  title: string
  sub: string
  pricePaise: number
  badge?: React.ReactNode
  value: number
  onChange: (n: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-semibold">{title}</span>
          {badge}
        </div>
        <div className="text-[11px] text-muted-foreground">{sub}</div>
        <div className="text-[11px] text-muted-foreground">
          {rupees(pricePaise)} / seat · GST incl.
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="grid size-6 cursor-pointer place-items-center rounded-md border border-border hover:bg-muted"
        >
          <Minus className="size-3.5" />
        </button>
        <span className="w-6 text-center text-sm font-medium tabular-nums">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(999, value + 1))}
          className="grid size-6 cursor-pointer place-items-center rounded-md border border-border hover:bg-muted"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

function Radio({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        'grid size-4 place-items-center rounded-full border',
        active ? 'border-[#2f63d8] bg-[#2f63d8]' : 'border-border',
      )}
    >
      {active && <span className="size-1.5 rounded-full bg-white" />}
    </span>
  )
}
