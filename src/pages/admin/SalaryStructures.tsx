import { useEffect, useState } from 'react'
import { Loader2, Plus, Trash2, X, Pencil, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sound } from '@/lib/sound'
import {
  getSalaryStructures,
  createSalaryStructure,
  updateSalaryStructure,
  deleteSalaryStructure,
  type SalaryStructureRow,
  type StructureLineDef,
} from '@/lib/api'

const DEFAULT_LINES: StructureLineDef[] = [
  { code: 'BASIC', name: 'Basic', type: 'earning', calcType: 'percent_of_base', baseCode: 'GROSS', rateBps: 5000, partOfPfWage: true, partOfEsiWage: true, prorateOnLop: true, sortOrder: 1 },
  { code: 'HRA', name: 'HRA', type: 'earning', calcType: 'percent_of_base', baseCode: 'BASIC', rateBps: 4000, partOfEsiWage: true, prorateOnLop: true, sortOrder: 2 },
  { code: 'SPECIAL', name: 'Special Allowance', type: 'earning', calcType: 'balancing', partOfEsiWage: true, prorateOnLop: true, sortOrder: 3 },
]

const codeFromName = (name: string) =>
  name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 16) || 'COMP'

export default function SalaryStructures({ canEdit }: { canEdit: boolean }) {
  const [rows, setRows] = useState<SalaryStructureRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<SalaryStructureRow | 'new' | null>(null)

  const load = () => {
    setLoading(true)
    getSalaryStructures()
      .then(setRows)
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const del = async (id: string) => {
    if (!confirm('Delete this structure?')) return
    await deleteSalaryStructure(id)
    sound.click()
    load()
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-muted-foreground">
          Reusable salary breakups. Without one, payroll derives Basic 50% / HRA 40% / Special
          (balancing) from each employee's monthly salary.
        </p>
        {canEdit && (
          <button
            onClick={() => setEditing('new')}
            className="btn-3d inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-foreground px-4 text-[13px] font-medium text-background transition-opacity hover:opacity-90"
          >
            <Plus className="size-4" /> New structure
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-10 text-[13px] text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-10 text-center text-[13px] text-muted-foreground">
          No custom structures yet — the default breakup is in effect.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            let lines: StructureLineDef[] = []
            try {
              lines = JSON.parse(r.lines || '[]')
            } catch {
              lines = []
            }
            return (
              <div key={r.id} className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium">{r.name}</span>
                    {r.isDefault && (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                        <Star className="size-2.5" /> Default
                      </span>
                    )}
                  </div>
                  <div className="truncate text-[12px] text-muted-foreground">
                    {lines.map((l) => l.name).join(' · ') || 'No components'}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => setEditing(r)} className="grid size-8 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                      <Pencil className="size-3.5" />
                    </button>
                    <button onClick={() => del(r.id)} className="grid size-8 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-rose-600">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {editing && (
        <StructureEditor
          row={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function StructureEditor({
  row,
  onClose,
  onSaved,
}: {
  row: SalaryStructureRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(row?.name ?? '')
  const [isDefault, setIsDefault] = useState(row?.isDefault ?? false)
  const [lines, setLines] = useState<StructureLineDef[]>(() => {
    if (!row) return DEFAULT_LINES
    try {
      return JSON.parse(row.lines || '[]')
    } catch {
      return DEFAULT_LINES
    }
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const setLine = (i: number, patch: Partial<StructureLineDef>) =>
    setLines((a) => a.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  const addLine = () =>
    setLines((a) => [
      ...a,
      { code: '', name: '', type: 'earning', calcType: 'flat', flatAmount: 0, prorateOnLop: true, partOfEsiWage: true, sortOrder: a.length + 1 },
    ])
  const removeLine = (i: number) => setLines((a) => a.filter((_, j) => j !== i))

  const earningCodes = ['GROSS', ...lines.filter((l) => l.type === 'earning' && l.code).map((l) => l.code)]

  const submit = async () => {
    if (!name.trim()) {
      setError('Name the structure')
      return
    }
    // finalize codes from names where blank
    const clean = lines.map((l, i) => ({ ...l, code: l.code || codeFromName(l.name || `COMP${i}`), name: l.name || l.code, sortOrder: i + 1 }))
    setBusy(true)
    setError('')
    try {
      if (row) await updateSalaryStructure(row.id, { name: name.trim(), isDefault, lines: clean })
      else await createSalaryStructure({ name: name.trim(), isDefault, lines: clean })
      sound.success()
      onSaved()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-background shadow-2xl duration-200 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            {row ? 'Edit structure' : 'New salary structure'}
          </h2>
          <button onClick={onClose} aria-label="Close" className="grid size-7 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex items-end gap-3">
            <label className="flex-1 space-y-1.5">
              <span className="text-[12px] font-medium text-muted-foreground">Structure name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard staff" className={inputCls} />
            </label>
            <button
              type="button"
              onClick={() => setIsDefault((v) => !v)}
              className={cn('inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium', isDefault ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-border bg-card text-muted-foreground hover:bg-muted')}
            >
              <Star className="size-3.5" /> Default
            </button>
          </div>

          <div className="space-y-2">
            <div className="text-[12px] font-medium text-muted-foreground">Components (top to bottom = calc order)</div>
            {lines.map((l, i) => (
              <div key={i} className="rounded-lg border border-border p-2.5">
                <div className="flex items-center gap-2">
                  <input
                    value={l.name}
                    onChange={(e) => setLine(i, { name: e.target.value, code: l.code || codeFromName(e.target.value) })}
                    placeholder="Component name"
                    className={cn(inputCls, 'flex-1')}
                  />
                  <select value={l.type} onChange={(e) => setLine(i, { type: e.target.value as 'earning' | 'deduction' })} className={inputCls}>
                    <option value="earning">Earning</option>
                    <option value="deduction">Deduction</option>
                  </select>
                  <button onClick={() => removeLine(i)} className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-rose-600">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select value={l.calcType} onChange={(e) => setLine(i, { calcType: e.target.value as StructureLineDef['calcType'] })} className={inputCls}>
                    <option value="flat">Flat ₹</option>
                    <option value="percent_of_base">% of</option>
                    <option value="balancing">Balancing</option>
                  </select>
                  {l.calcType === 'flat' && (
                    <input
                      value={l.flatAmount ? (l.flatAmount / 100).toString() : ''}
                      onChange={(e) => setLine(i, { flatAmount: Math.round((Number(e.target.value) || 0) * 100) })}
                      placeholder="Amount ₹"
                      inputMode="decimal"
                      className={cn(inputCls, 'w-28')}
                    />
                  )}
                  {l.calcType === 'percent_of_base' && (
                    <>
                      <input
                        value={l.rateBps ? (l.rateBps / 100).toString() : ''}
                        onChange={(e) => setLine(i, { rateBps: Math.round((Number(e.target.value) || 0) * 100) })}
                        placeholder="%"
                        inputMode="decimal"
                        className={cn(inputCls, 'w-16')}
                      />
                      <select value={l.baseCode ?? 'GROSS'} onChange={(e) => setLine(i, { baseCode: e.target.value })} className={inputCls}>
                        {earningCodes.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                  {l.calcType === 'balancing' && <span className="text-[12px] text-muted-foreground">= remainder of gross</span>}

                  {l.type === 'earning' && (
                    <div className="ml-auto flex items-center gap-2 text-[12px]">
                      <Check label="PF" checked={!!l.partOfPfWage} onChange={(v) => setLine(i, { partOfPfWage: v })} />
                      <Check label="ESI" checked={!!l.partOfEsiWage} onChange={(v) => setLine(i, { partOfEsiWage: v })} />
                      <Check label="LOP" checked={l.prorateOnLop !== false} onChange={(v) => setLine(i, { prorateOnLop: v })} />
                    </div>
                  )}
                </div>
              </div>
            ))}
            <button onClick={addLine} className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-border bg-card px-2.5 text-[12px] font-medium hover:bg-muted">
              <Plus className="size-3" /> Add component
            </button>
          </div>

          {error && <p className="text-[13px] text-rose-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="h-9 cursor-pointer rounded-lg border border-border bg-card px-4 text-[13px] font-medium hover:bg-muted">
              Cancel
            </button>
            <button onClick={submit} disabled={busy} className="btn-3d inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-foreground px-4 text-[13px] font-medium text-background hover:opacity-90 disabled:opacity-60">
              {busy && <Loader2 className="size-3.5 animate-spin" />}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const inputCls = 'h-9 rounded-md border border-border bg-card px-2.5 text-[13px] outline-none transition-colors focus:border-ring'

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-1 text-muted-foreground">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-3.5 cursor-pointer accent-[#2f63d8]" />
      {label}
    </label>
  )
}
