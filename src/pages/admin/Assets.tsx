import { useCallback, useEffect, useState } from 'react'
import { Loader2, X, Plus, Trash2, Check, Ban, Pencil, UserPlus, Undo2, Wrench, Laptop } from 'lucide-react'
import Panel from '@/components/admin/Panel'
import PageTabs from '@/components/admin/PageTabs'
import { EmployeeAvatar } from '@/lib/people'
import DetailPanel, { Field as PanelField } from '@/components/admin/DetailPanel'
import MetricCard from '@/components/admin/MetricCard'
import StatusBadge, { type StatusTone } from '@/components/admin/StatusBadge'
import DataGrid, { type GridColumn, type BadgeTone } from '@/components/admin/DataGrid'
import GridToolbar from '@/components/admin/GridToolbar'
import UpgradeModal from '@/components/admin/UpgradeModal'
import { useListView } from '@/lib/useListView'
import { useShell } from '@/components/admin/shell-context'
import { useAuth } from '@/context/auth/AuthContext'
import { cn } from '@/lib/utils'
import { sound } from '@/lib/sound'
import {
  listEmployees,
  getAssets,
  getAssetSummary,
  createAsset,
  updateAsset,
  deleteAsset,
  assignAsset,
  returnAsset,
  setAssetStatus,
  getAssetHistory,
  getAssetCategories,
  createAssetCategory,
  updateAssetCategory,
  type Asset,
  type AssetCategory,
  type AssetSummary,
  type AssetAssignment,
  type AssetStatus,
  type AssetCondition,
  type Paywall,
} from '@/lib/api'
import { type Employee } from '@/lib/employees'

// ─── shared constants / helpers ───
const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: '', label: 'All statuses' },
  { key: 'available', label: 'Available' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'in_repair', label: 'In repair' },
  { key: 'retired', label: 'Retired' },
  { key: 'lost', label: 'Lost' },
]
const STATUS_LABEL: Record<AssetStatus, string> = {
  available: 'Available',
  assigned: 'Assigned',
  in_repair: 'In repair',
  retired: 'Retired',
  lost: 'Lost',
}
function statusTone(s: AssetStatus): StatusTone {
  return s === 'available'
    ? 'green'
    : s === 'assigned'
      ? 'blue'
      : s === 'in_repair'
        ? 'amber'
        : s === 'lost'
          ? 'rose'
          : 'gray'
}
const CONDITIONS: AssetCondition[] = ['new', 'good', 'fair', 'poor', 'damaged']
const CONDITION_LABEL: Record<AssetCondition, string> = {
  new: 'New',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  damaged: 'Damaged',
}
// statuses an admin can set directly (assign/return manage available/assigned)
const SETTABLE_STATUSES: AssetStatus[] = ['available', 'in_repair', 'retired', 'lost']

const rupee = (p: number) => '₹' + Math.round((p ?? 0) / 100).toLocaleString('en-IN')
const fmtDate = (s: string) => {
  if (!s) return '—'
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return s
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}
const today = () => new Date().toISOString().slice(0, 10)

const inputCls =
  'h-9 w-full rounded-lg border border-border bg-card px-2.5 text-[13px] outline-none transition-colors focus:border-ring'

type Tab = 'assets' | 'categories'

export default function Assets() {
  const { firstTabActive } = useShell()
  const { activeWorkspace } = useAuth()
  const canManage =
    activeWorkspace?.role === 'Owner' || activeWorkspace?.role === 'Admin' || activeWorkspace?.role === 'Manager'

  const [tab, setTab] = useState<Tab>('assets')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [categories, setCategories] = useState<AssetCategory[]>([])

  // assets data lifted here so the detail panel can sit beside the list panel
  const [assets, setAssets] = useState<Asset[]>([])
  const [summary, setSummary] = useState<AssetSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [paywall, setPaywall] = useState<Paywall | null>(null)

  useEffect(() => {
    listEmployees().then(setEmployees)
  }, [])
  const loadCategories = useCallback(() => {
    getAssetCategories().then(setCategories)
  }, [])
  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([getAssets({}), getAssetSummary()])
      .then(([a, s]) => {
        setAssets(a)
        setSummary(s)
      })
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const openAsset = assets.find((a) => a.id === openId) ?? null

  return (
    <div className="flex min-w-0 flex-1 gap-2">
      <Panel className={cn('flex min-w-0 flex-1 flex-col', firstTabActive && 'rounded-tl-none')}>
        <PageTabs
          tabs={[
            { key: 'assets', label: 'Assets' },
            { key: 'categories', label: 'Categories' },
          ]}
          active={tab}
          onChange={setTab}
        />

        {tab === 'assets' && (
          <AssetsTab
            assets={assets}
            summary={summary}
            loading={loading}
            categories={categories}
            canManage={canManage}
            onOpen={setOpenId}
            onReload={load}
            onPaywall={setPaywall}
          />
        )}
        {tab === 'categories' && (
          <CategoriesTab categories={categories} canManage={canManage} onChanged={loadCategories} />
        )}
      </Panel>

      {tab === 'assets' && (
        <AssetDetailPanel
          asset={openAsset}
          open={!!openId}
          employees={employees}
          categories={categories}
          canManage={canManage}
          onClose={() => setOpenId(null)}
          onChanged={load}
          onDeleted={() => {
            setOpenId(null)
            load()
          }}
        />
      )}

      {paywall && (
        <UpgradeModal
          workspaceId={activeWorkspace?.id ?? ''}
          workspaceName={activeWorkspace?.name}
          paywall={paywall}
          onClose={() => setPaywall(null)}
          onSuccess={() => setPaywall(null)}
        />
      )}
    </div>
  )
}

// ─── Assets tab ───
function AssetsTab({
  assets,
  summary,
  loading,
  categories,
  canManage,
  onOpen,
  onReload,
  onPaywall,
}: {
  assets: Asset[]
  summary: AssetSummary | null
  loading: boolean
  categories: AssetCategory[]
  canManage: boolean
  onOpen: (id: string) => void
  onReload: () => void
  onPaywall: (p: Paywall) => void
}) {
  const [createOpen, setCreateOpen] = useState(false)

  const lv = useListView({
    rows: assets,
    search: (r) => `${r.assetCode} ${r.name} ${r.serialNo} ${r.categoryName} ${r.currentAssigneeName}`,
    filters: [
      {
        id: 'status',
        label: 'Status',
        get: (r) => r.status,
        options: STATUS_FILTERS.filter((s) => s.key).map((s) => ({ value: s.key, label: s.label })),
      },
      {
        id: 'category',
        label: 'Category',
        get: (r) => r.categoryName,
        options: categories.map((c) => ({ value: c.name })),
      },
    ],
    sorts: [
      { key: 'code', label: 'Code', get: (r) => r.assetCode },
      { key: 'name', label: 'Name', get: (r) => r.name },
      { key: 'status', label: 'Status', get: (r) => STATUS_LABEL[r.status] },
      { key: 'category', label: 'Category', get: (r) => r.categoryName || '' },
      { key: 'assignee', label: 'Assigned to', get: (r) => r.currentAssigneeName || '' },
      { key: 'value', label: 'Value', get: (r) => r.purchaseCostPaise },
    ],
  })

  const columns: GridColumn<Asset>[] = [
    { id: 'code', title: 'Code', kind: 'text', width: 110, get: (r) => r.assetCode },
    { id: 'name', title: 'Name', kind: 'text', width: 200, get: (r) => r.name },
    { id: 'category', title: 'Category', kind: 'badge', width: 140, get: (r) => r.categoryName, badgeTone: () => 'violet' as BadgeTone },
    { id: 'serial', title: 'Serial', kind: 'text', width: 150, get: (r) => r.serialNo },
    {
      id: 'status',
      title: 'Status',
      kind: 'badge',
      width: 120,
      get: (r) => STATUS_LABEL[r.status],
      badgeTone: (r) => statusTone(r.status) as BadgeTone,
    },
    { id: 'assignee', title: 'Assigned to', kind: 'person', width: 170, get: (r) => r.currentAssigneeName || '—' },
    { id: 'value', title: 'Value', kind: 'money', width: 110, get: (r) => r.purchaseCostPaise },
  ]

  return (
    <>
      <div className="grid shrink-0 grid-cols-2 gap-3 border-b border-border p-4 lg:grid-cols-4">
        <MetricCard label="Total assets" value={summary ? String(summary.total) : '—'} />
        <MetricCard label="Available" value={summary ? String(summary.available) : '—'} />
        <MetricCard label="Assigned" value={summary ? String(summary.assigned) : '—'} />
        <MetricCard label="Total value" value={summary ? rupee(summary.totalCostPaise) : '—'} />
      </div>

      <GridToolbar
        total={assets.length}
        searchPlaceholder="Search code, name, serial…"
        {...lv.toolbar}
        primaryAction={canManage ? { label: 'Add asset', onClick: () => setCreateOpen(true) } : undefined}
      />

      <div className="min-h-0 flex-1 border-t border-border">
        {loading ? (
          <div className="grid h-full place-items-center text-[13px] text-muted-foreground">Loading…</div>
        ) : assets.length === 0 ? (
          <div className="grid h-full place-items-center px-4 text-center text-[13px] text-muted-foreground">
            No assets yet. {canManage ? 'Click “Add asset” to register company property.' : ''}
          </div>
        ) : (
          <DataGrid
            rows={lv.view}
            columns={columns}
            getRowId={(r) => r.id}
            onRowClick={(r) => onOpen(r.id)}
            onAddRow={canManage ? () => setCreateOpen(true) : undefined}
            emptyMessage="No assets"
          />
        )}
      </div>

      {createOpen && (
        <AssetModal
          categories={categories}
          onClose={() => setCreateOpen(false)}
          onPaywall={(p) => {
            setCreateOpen(false)
            onPaywall(p)
          }}
          onDone={() => {
            setCreateOpen(false)
            onReload()
          }}
        />
      )}
    </>
  )
}

// Inline right-side detail panel for an asset (replaces the old fixed drawer).
function AssetDetailPanel({
  asset,
  open,
  employees,
  categories,
  canManage,
  onClose,
  onChanged,
  onDeleted,
}: {
  asset: Asset | null
  open: boolean
  employees: Employee[]
  categories: AssetCategory[]
  canManage: boolean
  onClose: () => void
  onChanged: () => void
  onDeleted: () => void
}) {
  const [edit, setEdit] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<AssetAssignment[]>([])
  const [assignOpen, setAssignOpen] = useState(false)

  // edit fields
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [serialNo, setSerialNo] = useState('')
  const [condition, setCondition] = useState<AssetCondition>('good')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [cost, setCost] = useState('')
  const [note, setNote] = useState('')

  // reset edit mode + re-seed the form whenever the open asset changes
  useEffect(() => {
    setEdit(false)
    setError('')
    if (asset) {
      setName(asset.name)
      setCategoryId(asset.categoryId ?? '')
      setSerialNo(asset.serialNo)
      setCondition(asset.condition)
      setPurchaseDate(asset.purchaseDate)
      setCost(asset.purchaseCostPaise ? String(Math.round(asset.purchaseCostPaise / 100)) : '')
      setNote(asset.note)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset?.id])

  const loadHistory = useCallback(() => {
    if (!asset) return
    getAssetHistory(asset.id).then(setHistory).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset?.id])
  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
      sound.success()
      loadHistory()
      onChanged()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!asset) return
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    setBusy(true)
    setError('')
    try {
      await updateAsset(asset.id, {
        name,
        categoryId: categoryId || null,
        serialNo,
        condition,
        purchaseDate,
        purchaseCostPaise: Math.max(0, Math.round(Number(cost) || 0)) * 100,
        note,
      })
      sound.success()
      setEdit(false)
      onChanged()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const doReturn = () => {
    if (!asset) return
    const rc = prompt('Return condition (new/good/fair/poor/damaged) — optional:') ?? ''
    return act(() => returnAsset(asset.id, { returnCondition: CONDITIONS.includes(rc as AssetCondition) ? rc : '' }))
  }
  const changeStatus = (s: AssetStatus) => asset && act(() => setAssetStatus(asset.id, s))

  const remove = async () => {
    if (!asset) return
    if (!confirm('Delete this asset?')) return
    setBusy(true)
    setError('')
    try {
      await deleteAsset(asset.id)
      sound.success()
      onDeleted()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <>
      <DetailPanel
        open={open}
        onClose={onClose}
        width="w-80"
        icon={<Laptop className="size-4" />}
        title={asset?.name ?? ''}
        subtitle={
          asset ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="text-muted-foreground">{asset.assetCode}</span>
              <StatusBadge tone={statusTone(asset.status)}>{STATUS_LABEL[asset.status]}</StatusBadge>
              {asset.categoryName && <StatusBadge tone="violet">{asset.categoryName}</StatusBadge>}
            </span>
          ) : null
        }
        footer={
          asset && canManage ? (
            edit ? (
              <>
                <button
                  onClick={() => setEdit(false)}
                  className="ml-auto h-7 cursor-pointer rounded-md border border-border bg-card px-3 text-[13px] font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={save}
                  disabled={busy}
                  className="btn-3d inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md bg-foreground px-3 text-[13px] font-medium text-background hover:opacity-90 disabled:opacity-60"
                >
                  {busy && <Loader2 className="size-3.5 animate-spin" />} Save
                </button>
              </>
            ) : (
              <>
                {asset.status === 'available' && (
                  <button
                    onClick={() => setAssignOpen(true)}
                    disabled={busy}
                    className="btn-3d inline-flex h-7 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-60"
                  >
                    <UserPlus className="size-3.5" /> Assign
                  </button>
                )}
                {asset.status === 'assigned' && (
                  <button
                    onClick={doReturn}
                    disabled={busy}
                    className="btn-3d inline-flex h-7 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-3 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-60"
                  >
                    <Undo2 className="size-3.5" /> Return
                  </button>
                )}
                <button
                  onClick={() => setEdit(true)}
                  className="inline-flex h-7 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 text-[13px] font-medium hover:bg-muted"
                >
                  <Pencil className="size-3.5" /> Edit
                </button>
                {asset.status !== 'assigned' && (
                  <button
                    onClick={remove}
                    disabled={busy}
                    aria-label="Delete"
                    className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </>
            )
          ) : undefined
        }
      >
        {asset &&
          (edit ? (
            <div className="space-y-3">
              <Field label="Name">
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Category">
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
                    <option value="">—</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Condition">
                  <select value={condition} onChange={(e) => setCondition(e.target.value as AssetCondition)} className={inputCls}>
                    {CONDITIONS.map((c) => (
                      <option key={c} value={c}>
                        {CONDITION_LABEL[c]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Serial no.">
                  <input value={serialNo} onChange={(e) => setSerialNo(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Purchase date">
                  <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Cost (₹)">
                  <input type="number" min={0} value={cost} onChange={(e) => setCost(e.target.value)} className={inputCls} />
                </Field>
              </div>
              <Field label="Note">
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={cn(inputCls, 'h-auto resize-none py-2')} />
              </Field>
              {error && <p className="text-[13px] text-rose-600">{error}</p>}
            </div>
          ) : (
            <>
              <PanelField label="Asset code">{asset.assetCode}</PanelField>
              <PanelField label="Category">{asset.categoryName || '—'}</PanelField>
              <PanelField label="Serial no.">{asset.serialNo || '—'}</PanelField>
              <PanelField label="Condition">{CONDITION_LABEL[asset.condition]}</PanelField>
              <PanelField label="Purchase date">{fmtDate(asset.purchaseDate)}</PanelField>
              <PanelField label="Value">{rupee(asset.purchaseCostPaise)}</PanelField>
              <PanelField label="Assigned to">
                {asset.currentAssigneeName ? (
                  <span className="inline-flex items-center gap-1.5">
                    <EmployeeAvatar name={asset.currentAssigneeName} className="size-5" />
                    {asset.currentAssigneeName}
                  </span>
                ) : (
                  '—'
                )}
              </PanelField>
              <PanelField label="Status">
                <StatusBadge tone={statusTone(asset.status)}>{STATUS_LABEL[asset.status]}</StatusBadge>
              </PanelField>
              {asset.note && (
                <PanelField label="Note">
                  <span className="whitespace-pre-wrap">{asset.note}</span>
                </PanelField>
              )}

              {canManage && asset.status !== 'assigned' && (
                <div className="flex items-center justify-between gap-3 pt-1">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Wrench className="size-3.5" /> Set status
                  </span>
                  <select
                    value={asset.status}
                    onChange={(e) => changeStatus(e.target.value as AssetStatus)}
                    disabled={busy}
                    className={cn(inputCls, 'h-8 w-32')}
                  >
                    {SETTABLE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-2">
                <div className="mb-2 text-[12px] font-medium text-muted-foreground">Assignment history</div>
                {history.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">No assignment history yet.</p>
                ) : (
                  <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                    {history.map((h) => (
                      <li key={h.id} className="px-3 py-2.5 text-[13px]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{h.employeeName || '—'}</span>
                          <StatusBadge tone={h.returnedOn ? 'gray' : 'blue'}>
                            {h.returnedOn ? 'Returned' : 'Held'}
                          </StatusBadge>
                        </div>
                        <div className="mt-1 text-[12px] text-muted-foreground">
                          Issued {fmtDate(h.assignedOn)}
                          {h.returnedOn && <> · returned {fmtDate(h.returnedOn)}</>}
                          {h.returnCondition && <> · {CONDITION_LABEL[h.returnCondition as AssetCondition] ?? h.returnCondition}</>}
                        </div>
                        {h.note && <div className="mt-1 whitespace-pre-wrap text-[12px] text-foreground/80">{h.note}</div>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {error && <p className="pt-1 text-[13px] text-rose-600">{error}</p>}
            </>
          ))}
      </DetailPanel>

      {assignOpen && asset && (
        <AssignModal
          asset={asset}
          employees={employees}
          onClose={() => setAssignOpen(false)}
          onDone={() => {
            setAssignOpen(false)
            loadHistory()
            onChanged()
          }}
        />
      )}
    </>
  )
}

function AssignModal({
  asset,
  employees,
  onClose,
  onDone,
}: {
  asset: Asset
  employees: Employee[]
  onClose: () => void
  onDone: () => void
}) {
  const [employeeId, setEmployeeId] = useState('')
  const [assignedOn, setAssignedOn] = useState(today())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!employeeId) {
      setError('Select an employee')
      return
    }
    setBusy(true)
    setError('')
    try {
      await assignAsset(asset.id, { employeeId, assignedOn, note })
      sound.success()
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <ModalShell title={`Assign ${asset.assetCode}`} onClose={onClose}>
      <Field label="Employee">
        <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={inputCls} autoFocus>
          <option value="">Select employee…</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Assigned on">
        <input type="date" value={assignedOn} onChange={(e) => setAssignedOn(e.target.value)} className={inputCls} />
      </Field>
      <Field label="Note">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Optional notes…" className={cn(inputCls, 'h-auto resize-none py-2')} />
      </Field>
      {error && <p className="text-[13px] text-rose-600">{error}</p>}
      <ModalActions busy={busy} onClose={onClose} onSubmit={submit} label="Assign" />
    </ModalShell>
  )
}

function AssetModal({
  categories,
  onClose,
  onDone,
  onPaywall,
}: {
  categories: AssetCategory[]
  onClose: () => void
  onDone: () => void
  onPaywall: (p: Paywall) => void
}) {
  const [name, setName] = useState('')
  const [assetCode, setAssetCode] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [serialNo, setSerialNo] = useState('')
  const [condition, setCondition] = useState<AssetCondition>('good')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [cost, setCost] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const activeCategories = categories.filter((c) => c.active)

  const submit = async () => {
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    setBusy(true)
    setError('')
    try {
      await createAsset({
        name,
        assetCode: assetCode.trim() || undefined,
        categoryId: categoryId || null,
        serialNo,
        condition,
        purchaseDate,
        purchaseCostPaise: Math.max(0, Math.round(Number(cost) || 0)) * 100,
        note,
      })
      sound.success()
      onDone()
    } catch (e) {
      const err = e as Error & { status?: number; payload?: { paywall?: Paywall } }
      if (err.status === 402 && err.payload?.paywall) {
        onPaywall(err.payload.paywall)
        return
      }
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <ModalShell title="Add asset" onClose={onClose}>
      <Field label="Name">
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. MacBook Pro 14&quot;" autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Asset code (optional)">
          <input value={assetCode} onChange={(e) => setAssetCode(e.target.value)} className={inputCls} placeholder="auto (AST-001)" />
        </Field>
        <Field label="Category">
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
            <option value="">—</option>
            {activeCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Serial no.">
          <input value={serialNo} onChange={(e) => setSerialNo(e.target.value)} className={inputCls} placeholder="Optional" />
        </Field>
        <Field label="Condition">
          <select value={condition} onChange={(e) => setCondition(e.target.value as AssetCondition)} className={inputCls}>
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {CONDITION_LABEL[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Purchase date">
          <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Cost (₹)">
          <input type="number" min={0} value={cost} onChange={(e) => setCost(e.target.value)} className={inputCls} placeholder="0" />
        </Field>
      </div>
      <Field label="Note">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Optional notes…" className={cn(inputCls, 'h-auto resize-none py-2')} />
      </Field>
      {error && <p className="text-[13px] text-rose-600">{error}</p>}
      <ModalActions busy={busy} onClose={onClose} onSubmit={submit} label="Add" />
    </ModalShell>
  )
}

// ─── Categories tab ───
function CategoriesTab({
  categories,
  canManage,
  onChanged,
}: {
  categories: AssetCategory[]
  canManage: boolean
  onChanged: () => void
}) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const add = async () => {
    if (!name.trim()) return
    setBusy(true)
    setError('')
    try {
      await createAssetCategory({ name })
      setName('')
      sound.success()
      onChanged()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (c: AssetCategory) => {
    try {
      await updateAssetCategory(c.id, { active: !c.active })
      onChanged()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto p-5">
      <div className="mx-auto max-w-xl">
        {canManage && (
          <div className="mb-4 flex items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="New category name… (e.g. Laptop, Phone, SIM)"
              className={cn(inputCls, 'flex-1')}
            />
            <button
              onClick={add}
              disabled={busy || !name.trim()}
              className="btn-3d inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-foreground px-4 text-[13px] font-medium text-background hover:opacity-90 disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-4" />} Add
            </button>
          </div>
        )}
        {error && <p className="mb-3 text-[13px] text-rose-600">{error}</p>}

        {categories.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-[13px] text-muted-foreground">
            No categories yet.
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="flex items-center gap-2 text-[13px]">
                  {c.name}
                  {!c.active && <StatusBadge tone="gray">Inactive</StatusBadge>}
                </span>
                {canManage && (
                  <button
                    onClick={() => toggle(c)}
                    className={cn(
                      'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[12px] font-medium transition-colors',
                      c.active
                        ? 'border-border bg-card text-muted-foreground hover:bg-muted'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
                    )}
                  >
                    {c.active ? <Ban className="size-3.5" /> : <Check className="size-3.5" />}
                    {c.active ? 'Deactivate' : 'Activate'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ─── shared UI primitives ───
function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[110] grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-background shadow-2xl duration-200 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid size-7 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-3 p-5">{children}</div>
      </div>
    </div>
  )
}

function ModalActions({
  busy,
  onClose,
  onSubmit,
  label,
}: {
  busy: boolean
  onClose: () => void
  onSubmit: () => void
  label: string
}) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <button onClick={onClose} className="ml-auto h-9 cursor-pointer rounded-lg border border-border bg-card px-4 text-[13px] font-medium hover:bg-muted">
        Cancel
      </button>
      <button
        onClick={onSubmit}
        disabled={busy}
        className="btn-3d inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-foreground px-4 text-[13px] font-medium text-background hover:opacity-90 disabled:opacity-60"
      >
        {busy && <Loader2 className="size-3.5 animate-spin" />} {label}
      </button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
