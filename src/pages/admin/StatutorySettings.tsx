import { useEffect, useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sound } from '@/lib/sound'
import { getStatutoryConfig, updateStatutoryConfig, type StatutoryConfig } from '@/lib/api'

interface PtSlab {
  min: number
  max: number
  amount: number
}

// paise <-> rupees, bps <-> percent helpers (UI works in ₹ and %)
const toR = (p: number) => (p / 100).toString()
const fromR = (s: string) => Math.round((Number(s) || 0) * 100)
const toPct = (bps: number) => (bps / 100).toString()
const fromPct = (s: string) => Math.round((Number(s) || 0) * 100)

export default function StatutorySettings({ canEdit }: { canEdit: boolean }) {
  const [cfg, setCfg] = useState<StatutoryConfig | null>(null)
  const [slabs, setSlabs] = useState<PtSlab[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getStatutoryConfig().then((c) => {
      setCfg(c)
      try {
        setSlabs(JSON.parse(c.ptSlabs || '[]'))
      } catch {
        setSlabs([])
      }
    })
  }, [])

  if (!cfg) return <div className="py-10 text-[13px] text-muted-foreground">Loading…</div>

  const set = <K extends keyof StatutoryConfig>(k: K, v: StatutoryConfig[K]) =>
    setCfg((c) => (c ? { ...c, [k]: v } : c))

  const save = async () => {
    if (!cfg || saving) return
    setSaving(true)
    try {
      await updateStatutoryConfig({ ...cfg, ptSlabs: JSON.stringify(slabs) })
      sound.success()
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      {!canEdit && (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-[13px] text-muted-foreground">
          Only the Owner or an Admin can edit statutory configuration.
        </p>
      )}

      {/* EPF */}
      <Card title="Provident Fund (EPF)" desc="12% of Basic+DA, capped at the wage ceiling (₹15,000).">
        <Toggle label="Deduct PF" checked={cfg.pfEnabled} onChange={(v) => set('pfEnabled', v)} disabled={!canEdit} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <NumField label="Wage ceiling (₹)" value={toR(cfg.pfWageCeiling)} onChange={(v) => set('pfWageCeiling', fromR(v))} disabled={!canEdit} />
          <NumField label="Employee %" value={toPct(cfg.pfEmployeeBps)} onChange={(v) => set('pfEmployeeBps', fromPct(v))} disabled={!canEdit} />
          <NumField label="Employer %" value={toPct(cfg.pfEmployerBps)} onChange={(v) => set('pfEmployerBps', fromPct(v))} disabled={!canEdit} />
        </div>
        <Toggle
          label="Restrict PF wage to ceiling"
          checked={cfg.restrictPfToCeiling}
          onChange={(v) => set('restrictPfToCeiling', v)}
          disabled={!canEdit}
        />
      </Card>

      {/* ESI */}
      <Card title="ESI" desc="0.75% employee / 3.25% employer, for gross ≤ threshold.">
        <Toggle label="Deduct ESI" checked={cfg.esiEnabled} onChange={(v) => set('esiEnabled', v)} disabled={!canEdit} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <NumField label="Gross threshold (₹)" value={toR(cfg.esiWageCeiling)} onChange={(v) => set('esiWageCeiling', fromR(v))} disabled={!canEdit} />
          <NumField label="Employee %" value={toPct(cfg.esiEmployeeBps)} onChange={(v) => set('esiEmployeeBps', fromPct(v))} disabled={!canEdit} />
          <NumField label="Employer %" value={toPct(cfg.esiEmployerBps)} onChange={(v) => set('esiEmployerBps', fromPct(v))} disabled={!canEdit} />
        </div>
      </Card>

      {/* Professional Tax */}
      <Card title="Professional Tax (PT)" desc="State-specific monthly slabs on gross salary.">
        <div className="flex flex-wrap items-center gap-3">
          <Toggle label="Deduct PT" checked={cfg.ptEnabled} onChange={(v) => set('ptEnabled', v)} disabled={!canEdit} />
          <label className="flex items-center gap-2 text-[13px]">
            <span className="text-muted-foreground">State</span>
            <input
              value={cfg.ptState}
              onChange={(e) => set('ptState', e.target.value)}
              disabled={!canEdit}
              placeholder="e.g. Karnataka"
              className={inputCls}
            />
          </label>
        </div>
        {cfg.ptEnabled && (
          <div className="space-y-1.5">
            <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-[11px] font-medium text-muted-foreground">
              <span>From gross (₹)</span>
              <span>To gross (₹, 0 = ∞)</span>
              <span>PT / month (₹)</span>
              <span></span>
            </div>
            {slabs.map((s, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                <input value={toR(s.min)} onChange={(e) => setSlabs((a) => a.map((x, j) => (j === i ? { ...x, min: fromR(e.target.value) } : x)))} disabled={!canEdit} className={inputCls} inputMode="decimal" />
                <input value={toR(s.max)} onChange={(e) => setSlabs((a) => a.map((x, j) => (j === i ? { ...x, max: fromR(e.target.value) } : x)))} disabled={!canEdit} className={inputCls} inputMode="decimal" />
                <input value={toR(s.amount)} onChange={(e) => setSlabs((a) => a.map((x, j) => (j === i ? { ...x, amount: fromR(e.target.value) } : x)))} disabled={!canEdit} className={inputCls} inputMode="decimal" />
                {canEdit && (
                  <button onClick={() => setSlabs((a) => a.filter((_, j) => j !== i))} className="grid size-9 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-rose-600">
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
            {canEdit && (
              <button
                onClick={() => setSlabs((a) => [...a, { min: 0, max: 0, amount: 0 }])}
                className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-border bg-card px-2.5 text-[12px] font-medium hover:bg-muted"
              >
                <Plus className="size-3" /> Add slab
              </button>
            )}
          </div>
        )}
      </Card>

      {/* TDS */}
      <Card title="Income Tax (TDS u/s 192)" desc="Annualized income tax. New regime: income up to ₹12L is tax-free, so most MSME staff see ₹0.">
        <Toggle label="Deduct TDS" checked={cfg.tdsEnabled} onChange={(v) => set('tdsEnabled', v)} disabled={!canEdit} />
      </Card>

      {/* Payroll behaviour */}
      <Card title="Payroll behaviour" desc="How loss-of-pay is prorated and the default tax regime.">
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1.5">
            <span className="text-[12px] font-medium text-muted-foreground">LOP divisor</span>
            <select value={cfg.lopDivisor} onChange={(e) => set('lopDivisor', e.target.value)} disabled={!canEdit} className={cn(inputCls, 'w-full')}>
              <option value="calendar">Calendar days (÷ days in month)</option>
              <option value="working_days">Working days</option>
              <option value="fixed_30">Fixed 30</option>
              <option value="fixed_26">Fixed 26</option>
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-[12px] font-medium text-muted-foreground">Default tax regime</span>
            <select value={cfg.defaultTaxRegime} onChange={(e) => set('defaultTaxRegime', e.target.value)} disabled={!canEdit} className={cn(inputCls, 'w-full')}>
              <option value="new">New regime</option>
              <option value="old">Old regime</option>
            </select>
          </label>
        </div>
      </Card>

      {canEdit && (
        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="btn-3d inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-foreground px-4 text-[13px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {saving && <Loader2 className="size-3.5 animate-spin" />}
            Save changes
          </button>
          {saved && <span className="text-[13px] text-emerald-600">Saved</span>}
        </div>
      )}
    </div>
  )
}

const inputCls = 'h-9 rounded-md border border-border bg-card px-2.5 text-[13px] outline-none transition-colors focus:border-ring disabled:opacity-70'

function Card({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mb-3 text-[12px] text-muted-foreground">{desc}</p>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function NumField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <label className="space-y-1.5">
      <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))} disabled={disabled} inputMode="decimal" className={cn(inputCls, 'w-full')} />
    </label>
  )
}

function Toggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      data-no-sound
      className="flex cursor-pointer items-center gap-2.5 text-[13px] disabled:cursor-default"
      disabled={disabled}
    >
      <span className={cn('inline-flex h-5 w-9 items-center rounded-full px-0.5 transition-colors', checked ? 'bg-[#2f63d8]' : 'bg-muted')}>
        <span className={cn('size-4 rounded-full bg-white shadow-sm transition-transform', checked ? 'translate-x-4' : 'translate-x-0')} />
      </span>
      {label}
    </button>
  )
}
