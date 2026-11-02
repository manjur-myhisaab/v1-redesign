import { useEffect, useState } from 'react'
import { Plus, Trash2, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sound } from '@/lib/sound'
import { getHolidays, addHoliday, deleteHoliday, type Holiday } from '@/lib/api'

const TYPES = [
  { v: 'public', label: 'Public', tone: 'bg-emerald-50 text-emerald-700' },
  { v: 'restricted', label: 'Restricted', tone: 'bg-amber-50 text-amber-700' },
  { v: 'company', label: 'Company', tone: 'bg-blue-50 text-blue-700' },
]
const fmt = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export default function HolidaySettings({ canEdit }: { canEdit: boolean }) {
  const year = new Date().getFullYear()
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [date, setDate] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState('public')

  const load = () => getHolidays(String(year)).then(setHolidays).catch(() => {})
  useEffect(() => { load() }, [])

  const add = async () => {
    if (!date || !name.trim()) return
    await addHoliday({ date, name: name.trim(), type })
    sound.success()
    setDate(''); setName('')
    load()
  }
  const remove = async (id: string) => { await deleteHoliday(id); load() }

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-[13px] text-muted-foreground">
        Holidays for {year}. Leave day-counting and attendance skip these dates (and Sundays).
      </p>

      {canEdit && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border p-3">
          <label className="space-y-1"><span className="text-[11px] font-medium text-muted-foreground">Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></label>
          <label className="flex-1 space-y-1"><span className="text-[11px] font-medium text-muted-foreground">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Diwali" className={cn(inputCls, 'w-full')} /></label>
          <label className="space-y-1"><span className="text-[11px] font-medium text-muted-foreground">Type</span>
            <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
              {TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
            </select></label>
          <button onClick={add} disabled={!date || !name.trim()} className="btn-3d inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-foreground px-3 text-[13px] font-medium text-background hover:opacity-90 disabled:opacity-50">
            <Plus className="size-4" /> Add
          </button>
        </div>
      )}

      <div className="divide-y divide-border rounded-xl border border-border">
        {holidays.map((h) => {
          const t = TYPES.find((x) => x.v === h.type) ?? TYPES[0]
          return (
            <div key={h.id} className="flex items-center gap-3 px-4 py-2.5">
              <CalendarDays className="size-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium">{h.name}</div>
                <div className="text-[12px] text-muted-foreground">{fmt(h.date)}</div>
              </div>
              <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-medium', t.tone)}>{t.label}</span>
              {canEdit && (
                <button onClick={() => remove(h.id)} className="grid size-8 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-rose-600"><Trash2 className="size-3.5" /></button>
              )}
            </div>
          )
        })}
        {holidays.length === 0 && <div className="px-4 py-6 text-center text-[13px] text-muted-foreground">No holidays added for {year}.</div>}
      </div>
    </div>
  )
}

const inputCls = 'h-9 rounded-lg border border-border bg-card px-2.5 text-[13px] outline-none transition-colors focus:border-ring'
