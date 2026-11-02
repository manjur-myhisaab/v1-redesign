import { useEffect, useState } from 'react'
import { Plus, X, Loader2, Receipt } from 'lucide-react'
import Panel from '@/components/admin/Panel'
import { sound } from '@/lib/sound'
import {
  getMyExpenses,
  createExpenseClaim,
  getExpenseCategories,
  type ExpenseClaim,
  type ExpenseCategory,
} from '@/lib/api'
import { Loading, EmptyState, PrimaryButton, GhostButton, Field, inputCls, StatusPill, rupee, fmtDate } from './ui'

export default function Expenses() {
  const [rows, setRows] = useState<ExpenseClaim[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  const load = () => {
    setLoading(true)
    getMyExpenses()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  return (
    <Panel className="flex min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h1 className="font-display text-base font-semibold tracking-tight">Expenses</h1>
          <p className="text-[12px] text-muted-foreground">Your reimbursement claims</p>
        </div>
        <PrimaryButton onClick={() => setOpen(true)}>
          <Plus className="size-4" /> File claim
        </PrimaryButton>
      </div>

      {loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Receipt className="size-6 opacity-40" />}>No expense claims yet.</EmptyState>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <ul className="divide-y divide-border">
            {rows.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium">{c.title}</span>
                    <StatusPill status={c.status} />
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    {fmtDate(c.claimDate)}
                    {c.categoryName && ` · ${c.categoryName}`}
                    {c.rejectReason && ` · ${c.rejectReason}`}
                  </div>
                </div>
                {c.receiptUrl && (
                  <a href={c.receiptUrl} target="_blank" rel="noreferrer" className="text-[12px] text-blue-600 hover:underline">
                    Receipt
                  </a>
                )}
                <span className="text-[14px] font-semibold tabular-nums">{rupee(c.amountPaise)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {open && (
        <FileClaimModal
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false)
            load()
          }}
        />
      )}
    </Panel>
  )
}

function FileClaimModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [cats, setCats] = useState<ExpenseCategory[]>([])
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [claimDate, setClaimDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [receiptUrl, setReceiptUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getExpenseCategories()
      .then((c) => setCats(c.filter((x) => x.active)))
      .catch(() => {})
  }, [])

  const submit = async () => {
    const amt = Math.round(Number(amount) * 100)
    if (!title.trim() || !amt) {
      setError('Enter a title and amount')
      return
    }
    setBusy(true)
    setError('')
    try {
      // employeeId omitted → server files for the caller's own employee record
      await createExpenseClaim({ title: title.trim(), amountPaise: amt, categoryId: categoryId || null, claimDate, description, receiptUrl })
      sound.success()
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-background shadow-2xl duration-200 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-lg font-semibold tracking-tight">File expense claim</h2>
          <button onClick={onClose} aria-label="Close" className="grid size-7 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-3 p-5">
          <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="e.g. Client lunch" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (₹)"><input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} /></Field>
            <Field label="Date"><input type="date" value={claimDate} onChange={(e) => setClaimDate(e.target.value)} className={inputCls} /></Field>
          </div>
          <Field label="Category">
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
              <option value="">— None —</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Description (optional)"><input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} /></Field>
          <Field label="Receipt URL (optional)"><input value={receiptUrl} onChange={(e) => setReceiptUrl(e.target.value)} className={inputCls} placeholder="https://…" /></Field>
          {error && <p className="text-[13px] text-rose-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <GhostButton onClick={onClose}>Cancel</GhostButton>
            <PrimaryButton onClick={submit} disabled={busy}>
              {busy && <Loader2 className="size-3.5 animate-spin" />} Submit
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  )
}
