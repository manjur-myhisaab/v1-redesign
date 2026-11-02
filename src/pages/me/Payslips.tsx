import { useEffect, useState } from 'react'
import { Wallet, X, ChevronRight } from 'lucide-react'
import Panel from '@/components/admin/Panel'
import { getMyPayslips, getMyPayslip, type MyPayslip, type MyPayslipDetail } from '@/lib/api'
import { Loading, EmptyState, PageHeader, rupee } from './ui'

const periodLabel = (p: string) => {
  const [y, m] = p.split('-').map(Number)
  if (!y || !m) return p
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export default function Payslips() {
  const [rows, setRows] = useState<MyPayslip[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    getMyPayslips()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Panel className="flex min-w-0 flex-1 flex-col">
      <PageHeader title="Payslips" subtitle="Your finalized payslips" />
      {loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Wallet className="size-6 opacity-40" />}>No payslips yet.</EmptyState>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <ul className="divide-y divide-border">
            {rows.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(p.id)}
                  className="flex w-full cursor-pointer items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="grid size-9 place-items-center rounded-lg bg-muted">
                    <Wallet className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium">{periodLabel(p.period)}</div>
                    <div className="text-[12px] text-muted-foreground">
                      Gross {rupee(p.gross)} · Deductions {rupee(p.deductions)}
                    </div>
                  </div>
                  <span className="text-[15px] font-semibold tabular-nums">{rupee(p.net)}</span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {openId && <PayslipModal id={openId} onClose={() => setOpenId(null)} />}
    </Panel>
  )
}

function PayslipModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [slip, setSlip] = useState<MyPayslipDetail | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getMyPayslip(id)
      .then(setSlip)
      .catch((e) => setError((e as Error).message))
  }, [id])

  const earnings = slip?.lines.filter((l) => l.type === 'earning' || l.type === 'reimbursement') ?? []
  const deductions = slip?.lines.filter((l) => l.type === 'deduction') ?? []

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-background shadow-2xl duration-200 animate-in fade-in zoom-in-95">
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-background px-5 py-4">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            {slip ? periodLabel(slip.period) : 'Payslip'}
          </h2>
          <button onClick={onClose} aria-label="Close" className="grid size-7 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        {error ? (
          <p className="p-5 text-[13px] text-rose-600">{error}</p>
        ) : !slip ? (
          <p className="p-5 text-[13px] text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-5 p-5">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-muted-foreground">{slip.empName} · {slip.designation}</span>
              <span className="text-muted-foreground">{slip.paidDays} paid / {slip.lopDays} LOP</span>
            </div>

            <Section title="Earnings" lines={earnings} />
            <Section title="Deductions" lines={deductions} />

            <div className="flex items-center justify-between rounded-xl bg-muted px-4 py-3">
              <span className="text-[13px] font-semibold">Net pay</span>
              <span className="text-lg font-semibold tabular-nums">{rupee(slip.net)}</span>
            </div>
            {slip.pdfUrl && (
              <a
                href={slip.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-card px-4 text-[13px] font-medium hover:bg-muted"
              >
                Download PDF
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, lines }: { title: string; lines: MyPayslipDetail['lines'] }) {
  if (lines.length === 0) return null
  const total = lines.reduce((s, l) => s + l.amount, 0)
  return (
    <div>
      <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {lines.map((l) => (
          <li key={l.componentCode} className="flex items-center justify-between px-4 py-2 text-[13px]">
            <span>{l.name}</span>
            <span className="tabular-nums">{rupee(l.amount)}</span>
          </li>
        ))}
        <li className="flex items-center justify-between bg-muted/50 px-4 py-2 text-[13px] font-semibold">
          <span>Total {title.toLowerCase()}</span>
          <span className="tabular-nums">{rupee(total)}</span>
        </li>
      </ul>
    </div>
  )
}
