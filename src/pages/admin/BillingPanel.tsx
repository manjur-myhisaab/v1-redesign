import { useEffect, useState } from 'react'
import { MapPin, Sparkles, ReceiptText } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getInvoices,
  payInvoice,
  verifyBilling,
  type BillingSummary,
  type Invoice,
} from '@/lib/api'
import { openCheckout } from '@/lib/razorpay'
import { sound } from '@/lib/sound'

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })

const STATUS_PILL: Record<string, string> = {
  paid: 'bg-emerald-50 text-emerald-700',
  pending: 'bg-amber-50 text-amber-700',
  failed: 'bg-rose-50 text-rose-700',
}
const UNLIMITED = 100_000

export function planLabel(summary: BillingSummary): string {
  const { plan, annualTiers } = summary
  if (plan === 'free') return 'Free'
  if (plan === 'per_member') return 'Per-seat'
  const t = annualTiers.find((x) => x.plan === plan)
  return t ? `Annual · ${t.label}` : 'Annual'
}

function Usage({ label, used, max }: { label: string; used: number; max: number }) {
  const unlimited = max >= UNLIMITED
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(1, max)) * 100))
  return (
    <div>
      <div className="flex items-center justify-between text-[13px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">
          {used} / {unlimited ? '∞' : max}
        </span>
      </div>
      {!unlimited && (
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full rounded-full', pct >= 100 ? 'bg-rose-500' : 'bg-primary')}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}

interface BillingPanelProps {
  summary: BillingSummary
  isOwner: boolean
  onUpgrade: () => void
  compact?: boolean
  workspaceId?: string
  reloadKey?: number
  onPaid?: () => void
}

export default function BillingPanel({
  summary,
  isOwner,
  onUpgrade,
  compact,
  workspaceId,
  reloadKey,
  onPaid,
}: BillingPanelProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [payingId, setPayingId] = useState<string | null>(null)
  const [payError, setPayError] = useState('')

  const reloadInvoices = () => {
    if (!workspaceId) return
    getInvoices(workspaceId).then(setInvoices).catch(() => {})
  }

  useEffect(() => {
    if (compact || !workspaceId) return
    getInvoices(workspaceId).then(setInvoices).catch(() => {})
  }, [compact, workspaceId, reloadKey])

  const handlePay = async (inv: Invoice) => {
    if (!workspaceId || payingId) return
    setPayingId(inv.id)
    setPayError('')
    try {
      const order = await payInvoice(workspaceId, inv.id)
      const result = await openCheckout(order, { description: inv.description })
      if (!result) {
        // user dismissed the checkout
        setPayingId(null)
        return
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
      reloadInvoices()
      onPaid?.() // let the parent refresh the billing summary (plan/expiry)
    } catch (err) {
      setPayError((err as Error).message)
    } finally {
      setPayingId(null)
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
    <div className="max-w-2xl rounded-xl border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Current plan
          </p>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="font-display text-lg font-semibold tracking-tight">
              {planLabel(summary)}
            </span>
            {summary.liveTracking && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#2f63d8]/10 px-2 py-0.5 text-[11px] font-medium text-[#2f63d8]">
                <MapPin className="size-3" />
                Live tracking
              </span>
            )}
          </div>
        </div>
        {isOwner && (
          <button
            onClick={onUpgrade}
            className="btn-3d inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Sparkles className="size-4" />
            {summary.plan === 'free' ? 'Upgrade' : 'Change plan'}
          </button>
        )}
      </div>

      {!compact && (
        <>
          <div className="mt-4 space-y-3">
            <Usage label="Employees" used={summary.employees.used} max={summary.employees.cap} />
            <Usage label="Team members" used={summary.members.used} max={summary.members.limit} />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-[12px] text-muted-foreground">
            {(summary.seats.basic > 0 || summary.seats.pro > 0) && (
              <span className="rounded-md bg-muted px-2 py-1">
                Seats: {summary.seats.basic} Basic · {summary.seats.pro} Pro
              </span>
            )}
            <span className="rounded-md bg-muted px-2 py-1">
              Basic seat {rupees(summary.perMemberPaise)} · Pro {rupees(summary.proSeatPaise)}
            </span>
            <span className="rounded-md bg-muted px-2 py-1">
              Annual from {rupees(summary.annualPaise)}/yr
            </span>
          </div>
        </>
      )}
      </div>

      {/* invoices / payment history (full view) */}
      {!compact && (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="flex items-center gap-1.5 border-b border-border px-4 py-2.5 text-sm font-medium">
            <ReceiptText className="size-3.5 text-muted-foreground" />
            Invoices
            <span className="text-muted-foreground">· {invoices.length}</span>
          </div>
          {payError && (
            <p className="border-b border-border bg-rose-50 px-4 py-2 text-[12px] text-rose-600">
              {payError}
            </p>
          )}
          <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-4 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <span>Date</span>
            <span>Description</span>
            <span className="text-right">Amount</span>
            <span className="w-20 text-right">Status</span>
          </div>
          {invoices.map((inv) => (
            <div
              key={inv.id}
              className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-4 border-t border-border px-4 py-2.5 text-[13px]"
            >
              <span className="tabular-nums text-muted-foreground">{fmtDate(inv.createdAt)}</span>
              <span className="min-w-0 truncate">{inv.description}</span>
              <span className="text-right tabular-nums">{rupees(inv.amountPaise)}</span>
              <span className="flex flex-col items-end gap-1">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-medium capitalize',
                    STATUS_PILL[inv.status] ?? 'bg-muted text-muted-foreground',
                  )}
                >
                  {inv.status}
                </span>
                {isOwner && inv.status === 'pending' && (
                  <button
                    onClick={() => handlePay(inv)}
                    disabled={payingId === inv.id}
                    className="inline-flex h-6 cursor-pointer items-center rounded-md bg-primary px-2 text-[11px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {payingId === inv.id ? 'Opening…' : 'Pay now'}
                  </button>
                )}
              </span>
            </div>
          ))}
          {invoices.length === 0 && (
            <div className="border-t border-border px-4 py-6 text-center text-[13px] text-muted-foreground">
              No invoices yet.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
