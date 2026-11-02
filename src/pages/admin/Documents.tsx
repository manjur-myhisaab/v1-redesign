import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, X, Plus, Trash2, FileText, BadgeCheck, Pencil } from 'lucide-react'
import Panel from '@/components/admin/Panel'
import PageTabs from '@/components/admin/PageTabs'
import MetricCard from '@/components/admin/MetricCard'
import StatusBadge, { type StatusTone } from '@/components/admin/StatusBadge'
import DetailPanel, { Field as PanelField } from '@/components/admin/DetailPanel'
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
  getDocuments,
  getDocumentSummary,
  createDocument,
  updateDocument,
  deleteDocument,
  getDocumentCategories,
  getLetterTemplates,
  createLetterTemplate,
  updateLetterTemplate,
  deleteLetterTemplate,
  getLetters,
  generateLetter,
  issueLetter,
  deleteLetter,
  type EmployeeDocument,
  type DocumentCategory,
  type DocumentSummary,
  type LetterTemplate,
  type GeneratedLetter,
  type LetterType,
  type LetterStatus,
  type Paywall,
} from '@/lib/api'
import { type Employee } from '@/lib/employees'

// ─── shared constants / helpers ───
const LETTER_TYPES: { key: LetterType; label: string }[] = [
  { key: 'offer', label: 'Offer' },
  { key: 'appointment', label: 'Appointment' },
  { key: 'relieving', label: 'Relieving' },
  { key: 'experience', label: 'Experience' },
  { key: 'increment', label: 'Increment' },
  { key: 'warning', label: 'Warning' },
  { key: 'other', label: 'Other' },
]
const TYPE_LABEL: Record<LetterType, string> = LETTER_TYPES.reduce(
  (acc, t) => ({ ...acc, [t.key]: t.label }),
  {} as Record<LetterType, string>,
)

// available template tokens (kept in sync with the server)
const TOKENS = [
  '{{employee_name}}',
  '{{employee_code}}',
  '{{designation}}',
  '{{role}}',
  '{{department}}',
  '{{date_of_joining}}',
  '{{salary}}',
  '{{today}}',
  '{{company_name}}',
]

const rupee = (p: number) => '₹' + Math.round((p ?? 0) / 100).toLocaleString('en-IN')
const fmtDate = (s: string) => {
  if (!s) return '—'
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return s
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}
const today = () => new Date().toISOString().slice(0, 10)
const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)

// expiry tone: rose if past/within 30 days, amber within 60, else gray
function expiryTone(expiresOn: string): BadgeTone {
  if (!expiresOn) return 'gray'
  if (expiresOn <= inDays(30)) return 'rose'
  if (expiresOn <= inDays(60)) return 'amber'
  return 'gray'
}

// client-side token render (mirrors the server) for the generate preview
function buildTokens(emp: Employee | undefined, company: string): Record<string, string> {
  return {
    employee_name: emp?.name ?? '',
    employee_code: emp?.empCode ?? '',
    designation: emp?.role ?? '',
    role: emp?.role ?? '',
    department: emp?.department ?? '',
    date_of_joining: emp?.joined ?? '',
    salary: emp?.monthlyCtc ? rupee(emp.monthlyCtc) : '',
    today: today(),
    company_name: company ?? '',
  }
}
function renderTemplate(body: string, tokens: Record<string, string>): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (raw, key: string) =>
    Object.prototype.hasOwnProperty.call(tokens, key) ? tokens[key] : raw,
  )
}

const inputCls =
  'h-9 w-full rounded-lg border border-border bg-card px-2.5 text-[13px] outline-none transition-colors focus:border-ring'

type Tab = 'documents' | 'letters' | 'templates'

export default function Documents() {
  const { firstTabActive } = useShell()
  const { activeWorkspace } = useAuth()
  const canManage =
    activeWorkspace?.role === 'Owner' || activeWorkspace?.role === 'Admin' || activeWorkspace?.role === 'Manager'

  const [tab, setTab] = useState<Tab>('documents')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [categories, setCategories] = useState<DocumentCategory[]>([])
  const [templates, setTemplates] = useState<LetterTemplate[]>([])
  const [summary, setSummary] = useState<DocumentSummary | null>(null)
  const [paywall, setPaywall] = useState<Paywall | null>(null)

  useEffect(() => {
    listEmployees().then(setEmployees)
  }, [])
  const loadCategories = useCallback(() => {
    getDocumentCategories().then(setCategories)
  }, [])
  const loadTemplates = useCallback(() => {
    getLetterTemplates().then(setTemplates)
  }, [])
  const loadSummary = useCallback(() => {
    getDocumentSummary().then(setSummary)
  }, [])
  useEffect(() => {
    loadCategories()
    loadTemplates()
    loadSummary()
  }, [loadCategories, loadTemplates, loadSummary])

  // shared in-panel header (sub-tabs + metric cards) rendered inside each
  // tab's list Panel so the detail panel can sit beside it as a flex sibling
  const header = (
    <>
      <PageTabs
        tabs={[
          { key: 'documents', label: 'Documents' },
          { key: 'letters', label: 'Letters' },
          { key: 'templates', label: 'Templates' },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="grid shrink-0 grid-cols-2 gap-3 border-b border-border p-4 lg:grid-cols-4">
        <MetricCard label="Documents" value={summary ? String(summary.totalDocs) : '—'} />
        <MetricCard label="Expiring within 30 days" value={summary ? String(summary.expiringSoon) : '—'} />
        <MetricCard label="Letters issued" value={summary ? String(summary.lettersIssued) : '—'} />
        <MetricCard label="Templates" value={summary ? String(summary.templates) : '—'} />
      </div>
    </>
  )

  return (
    <>
      {tab === 'documents' && (
        <DocumentsTab
          header={header}
          firstTabActive={firstTabActive}
          employees={employees}
          categories={categories}
          canManage={canManage}
          onChanged={loadSummary}
        />
      )}
      {tab === 'letters' && (
        <LettersTab
          header={header}
          firstTabActive={firstTabActive}
          employees={employees}
          templates={templates}
          company={activeWorkspace?.name ?? ''}
          canManage={canManage}
          onChanged={loadSummary}
        />
      )}
      {tab === 'templates' && (
        <TemplatesTab
          header={header}
          firstTabActive={firstTabActive}
          templates={templates}
          canManage={canManage}
          onChanged={loadTemplates}
          onPaywall={setPaywall}
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
    </>
  )
}

// ─── Documents tab ───
function DocumentsTab({
  header,
  firstTabActive,
  employees,
  categories,
  canManage,
  onChanged,
}: {
  header: React.ReactNode
  firstTabActive: boolean
  employees: Employee[]
  categories: DocumentCategory[]
  canManage: boolean
  onChanged: () => void
}) {
  const [docs, setDocs] = useState<EmployeeDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    getDocuments({})
      .then(setDocs)
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const lv = useListView({
    rows: docs,
    search: (r) => `${r.employeeName} ${r.title} ${r.categoryName}`,
    filters: [
      {
        id: 'category',
        label: 'Category',
        get: (r) => r.categoryName,
        options: categories.map((c) => ({ value: c.name })),
      },
    ],
    sorts: [
      { key: 'name', label: 'Title', get: (r) => r.title },
      { key: 'employee', label: 'Employee', get: (r) => r.employeeName || '' },
      { key: 'category', label: 'Category', get: (r) => r.categoryName || '' },
      { key: 'expires', label: 'Expires', get: (r) => r.expiresOn || '' },
      { key: 'uploaded', label: 'Uploaded', get: (r) => r.createdAt },
    ],
  })

  const openDoc = docs.find((d) => d.id === openId) ?? null

  const columns: GridColumn<EmployeeDocument>[] = [
    { id: 'employee', title: 'Employee', kind: 'person', width: 180, get: (r) => r.employeeName || '—' },
    { id: 'title', title: 'Title', kind: 'text', width: 220, get: (r) => r.title },
    { id: 'category', title: 'Category', kind: 'badge', width: 150, get: (r) => r.categoryName, badgeTone: () => 'violet' },
    {
      id: 'expires',
      title: 'Expires',
      kind: 'badge',
      width: 140,
      get: (r) => (r.expiresOn ? fmtDate(r.expiresOn) : ''),
      badgeTone: (r) => expiryTone(r.expiresOn),
    },
    { id: 'uploaded', title: 'Uploaded', kind: 'date', width: 130, get: (r) => r.createdAt },
  ]

  return (
    <div className="flex min-w-0 flex-1 gap-2">
      <Panel className={cn('flex min-w-0 flex-1 flex-col', firstTabActive && 'rounded-tl-none')}>
        {header}

        <GridToolbar
          total={docs.length}
          searchPlaceholder="Search documents…"
          {...lv.toolbar}
          primaryAction={canManage ? { label: 'Add document', onClick: () => setCreateOpen(true) } : undefined}
        />

        <div className="min-h-0 flex-1 border-t border-border">
          {loading ? (
            <div className="grid h-full place-items-center text-[13px] text-muted-foreground">Loading…</div>
          ) : docs.length === 0 ? (
            <div className="grid h-full place-items-center px-4 text-center text-[13px] text-muted-foreground">
              No documents yet. {canManage ? 'Click "Add document" to attach one to an employee.' : ''}
            </div>
          ) : (
            <DataGrid
              rows={lv.view}
              columns={columns}
              getRowId={(r) => r.id}
              onRowClick={(r) => setOpenId(r.id)}
              onAddRow={canManage ? () => setCreateOpen(true) : undefined}
              emptyMessage="No documents"
            />
          )}
        </div>

        {createOpen && (
          <DocumentModal
            employees={employees}
            categories={categories}
            onClose={() => setCreateOpen(false)}
            onDone={() => {
              setCreateOpen(false)
              load()
              onChanged()
            }}
          />
        )}
      </Panel>

      <DocumentDetail
        doc={openDoc}
        open={!!openId}
        categories={categories}
        canManage={canManage}
        onClose={() => setOpenId(null)}
        onChanged={() => {
          load()
          onChanged()
        }}
        onDeleted={() => {
          setOpenId(null)
          load()
          onChanged()
        }}
      />
    </div>
  )
}

function DocumentDetail({
  doc,
  open,
  categories,
  canManage,
  onClose,
  onChanged,
  onDeleted,
}: {
  doc: EmployeeDocument | null
  open: boolean
  categories: DocumentCategory[]
  canManage: boolean
  onClose: () => void
  onChanged: () => void
  onDeleted: () => void
}) {
  const [edit, setEdit] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [fileUrl, setFileUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const [note, setNote] = useState('')
  const [expiresOn, setExpiresOn] = useState('')

  // snapshot the last non-null doc so content stays put through the exit animation
  const [cached, setCached] = useState<EmployeeDocument | null>(doc)
  useEffect(() => {
    if (doc) setCached(doc)
  }, [doc])
  const d = doc ?? cached

  // reset transient edit state whenever the open document changes
  useEffect(() => {
    setEdit(false)
    setError('')
  }, [doc?.id])

  const startEdit = () => {
    if (!doc) return
    setTitle(doc.title)
    setCategoryId(doc.categoryId ?? '')
    setFileUrl(doc.fileUrl)
    setFileName(doc.fileName)
    setNote(doc.note)
    setExpiresOn(doc.expiresOn)
    setError('')
    setEdit(true)
  }

  const save = async () => {
    if (!doc) return
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    setBusy(true)
    setError('')
    try {
      await updateDocument(doc.id, { title, categoryId: categoryId || null, fileUrl, fileName, note, expiresOn })
      sound.success()
      setEdit(false)
      onChanged()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!doc) return
    if (!confirm('Delete this document?')) return
    setBusy(true)
    setError('')
    try {
      await deleteDocument(doc.id)
      sound.success()
      onDeleted()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  const footer = d
    ? edit
      ? (
          <>
            <button
              onClick={() => setEdit(false)}
              className="ml-auto inline-flex h-7 cursor-pointer items-center rounded-md border border-border bg-card px-3 text-[13px] font-medium hover:bg-muted"
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
        )
      : (
          <>
            {d.fileUrl && (
              <a
                href={d.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-3 text-[13px] font-medium text-blue-600 hover:bg-muted"
              >
                <FileText className="size-3.5" /> Open file
              </a>
            )}
            {canManage && doc && (
              <button
                onClick={startEdit}
                className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-3 text-[13px] font-medium hover:bg-muted"
              >
                <Pencil className="size-3.5" /> Edit
              </button>
            )}
            {canManage && doc && (
              <button
                onClick={remove}
                disabled={busy}
                className="ml-auto inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-3 text-[13px] font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
              >
                <Trash2 className="size-3.5" /> Delete
              </button>
            )}
          </>
        )
    : undefined

  return (
    <DetailPanel
      open={open}
      onClose={onClose}
      width="w-80"
      title={d?.title ?? ''}
      subtitle={d?.employeeName || undefined}
      avatar={{ name: d?.employeeName ?? '' }}
      footer={footer}
    >
      {d &&
        (edit ? (
          <div className="space-y-3">
            <Field label="Title">
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
            </Field>
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
            <Field label="Expires on">
              <input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} className={inputCls} />
            </Field>
            <Field label="File link (paste a URL)">
              <input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} className={inputCls} placeholder="https://" />
            </Field>
            <Field label="File name (optional)">
              <input value={fileName} onChange={(e) => setFileName(e.target.value)} className={inputCls} placeholder="e.g. aadhaar.pdf" />
            </Field>
            <Field label="Note">
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={cn(inputCls, 'h-auto resize-none py-2')} />
            </Field>
            {error && <p className="text-[13px] text-rose-600">{error}</p>}
          </div>
        ) : (
          <>
            <PanelField label="Employee">{d.employeeName || '—'}</PanelField>
            <PanelField label="Category">
              {d.categoryName ? <StatusBadge tone="violet">{d.categoryName}</StatusBadge> : '—'}
            </PanelField>
            <PanelField label="Expires">
              {d.expiresOn ? (
                <StatusBadge tone={expiryTone(d.expiresOn) as StatusTone}>{fmtDate(d.expiresOn)}</StatusBadge>
              ) : (
                '—'
              )}
            </PanelField>
            <PanelField label="Uploaded">{fmtDate(d.createdAt.slice(0, 10))}</PanelField>
            {d.fileName && <PanelField label="File name">{d.fileName}</PanelField>}
            <PanelField label="File link">
              {d.fileUrl ? (
                <a
                  href={d.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-blue-600 hover:underline"
                >
                  <FileText className="size-3.5" /> Open
                </a>
              ) : (
                '—'
              )}
            </PanelField>
            {d.note && <PanelField label="Note">{d.note}</PanelField>}
            {error && <p className="text-[13px] text-rose-600">{error}</p>}
          </>
        ))}
    </DetailPanel>
  )
}

function DocumentModal({
  employees,
  categories,
  onClose,
  onDone,
}: {
  employees: Employee[]
  categories: DocumentCategory[]
  onClose: () => void
  onDone: () => void
}) {
  const [employeeId, setEmployeeId] = useState('')
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [fileUrl, setFileUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const [expiresOn, setExpiresOn] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const activeCategories = categories.filter((c) => c.active)

  const submit = async () => {
    if (!employeeId) {
      setError('Select an employee')
      return
    }
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    setBusy(true)
    setError('')
    try {
      await createDocument({ employeeId, title, categoryId: categoryId || null, fileUrl, fileName, expiresOn, note })
      sound.success()
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <ModalShell title="Add document" onClose={onClose}>
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
      <Field label="Title">
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="e.g. Aadhaar card" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
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
        <Field label="Expires on (optional)">
          <input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} className={inputCls} />
        </Field>
      </div>
      <Field label="File link">
        <input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} className={inputCls} placeholder="Paste a link to the file (https://…)" />
      </Field>
      <p className="-mt-1.5 text-[12px] text-muted-foreground">No file upload — paste a link (Drive, Dropbox, etc.).</p>
      <Field label="File name (optional)">
        <input value={fileName} onChange={(e) => setFileName(e.target.value)} className={inputCls} placeholder="e.g. aadhaar.pdf" />
      </Field>
      <Field label="Note">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Optional notes…" className={cn(inputCls, 'h-auto resize-none py-2')} />
      </Field>
      {error && <p className="text-[13px] text-rose-600">{error}</p>}
      <ModalActions busy={busy} onClose={onClose} onSubmit={submit} label="Add" />
    </ModalShell>
  )
}

// ─── Letters tab ───
function letterStatusTone(s: LetterStatus): StatusTone {
  return s === 'issued' ? 'green' : 'amber'
}

function LettersTab({
  header,
  firstTabActive,
  employees,
  templates,
  company,
  canManage,
  onChanged,
}: {
  header: React.ReactNode
  firstTabActive: boolean
  employees: Employee[]
  templates: LetterTemplate[]
  company: string
  canManage: boolean
  onChanged: () => void
}) {
  const [letters, setLetters] = useState<GeneratedLetter[]>([])
  const [loading, setLoading] = useState(true)
  const [genOpen, setGenOpen] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    getLetters({})
      .then(setLetters)
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const lv = useListView({
    rows: letters,
    search: (r) => `${r.employeeName} ${r.title} ${TYPE_LABEL[r.type]}`,
    filters: [
      {
        id: 'status',
        label: 'Status',
        get: (r) => r.status,
        options: [
          { value: 'draft', label: 'Draft' },
          { value: 'issued', label: 'Issued' },
        ],
      },
      {
        id: 'type',
        label: 'Type',
        get: (r) => r.type,
        options: LETTER_TYPES.map((t) => ({ value: t.key, label: t.label })),
      },
    ],
    sorts: [
      { key: 'employee', label: 'Employee', get: (r) => r.employeeName || '' },
      { key: 'type', label: 'Type', get: (r) => TYPE_LABEL[r.type] },
      { key: 'title', label: 'Title', get: (r) => r.title },
      { key: 'status', label: 'Status', get: (r) => r.status },
      { key: 'created', label: 'Created', get: (r) => r.createdAt },
    ],
  })

  const openLetter = letters.find((l) => l.id === openId) ?? null

  const columns: GridColumn<GeneratedLetter>[] = [
    { id: 'employee', title: 'Employee', kind: 'person', width: 180, get: (r) => r.employeeName || '—' },
    { id: 'type', title: 'Type', kind: 'badge', width: 130, get: (r) => TYPE_LABEL[r.type], badgeTone: () => 'blue' },
    { id: 'title', title: 'Title', kind: 'text', width: 240, get: (r) => r.title },
    {
      id: 'status',
      title: 'Status',
      kind: 'badge',
      width: 110,
      get: (r) => (r.status === 'issued' ? 'Issued' : 'Draft'),
      badgeTone: (r) => letterStatusTone(r.status) as BadgeTone,
    },
    { id: 'created', title: 'Created', kind: 'date', width: 130, get: (r) => r.createdAt },
  ]

  return (
    <div className="flex min-w-0 flex-1 gap-2">
      <Panel className={cn('flex min-w-0 flex-1 flex-col', firstTabActive && 'rounded-tl-none')}>
        {header}

        <GridToolbar
          total={letters.length}
          searchPlaceholder="Search letters…"
          {...lv.toolbar}
          primaryAction={canManage ? { label: 'Generate letter', onClick: () => setGenOpen(true) } : undefined}
        />

        <div className="min-h-0 flex-1 border-t border-border">
          {loading ? (
            <div className="grid h-full place-items-center text-[13px] text-muted-foreground">Loading…</div>
          ) : letters.length === 0 ? (
            <div className="grid h-full place-items-center px-4 text-center text-[13px] text-muted-foreground">
              No letters yet. {canManage ? 'Click "Generate letter" to create one from a template.' : ''}
            </div>
          ) : (
            <DataGrid
              rows={lv.view}
              columns={columns}
              getRowId={(r) => r.id}
              onRowClick={(r) => setOpenId(r.id)}
              onAddRow={canManage ? () => setGenOpen(true) : undefined}
              emptyMessage="No letters"
            />
          )}
        </div>

        {genOpen && (
          <GenerateLetterModal
            employees={employees}
            templates={templates.filter((t) => t.active)}
            company={company}
            onClose={() => setGenOpen(false)}
            onDone={() => {
              setGenOpen(false)
              load()
              onChanged()
            }}
          />
        )}
      </Panel>

      <LetterDetail
        letter={openLetter}
        open={!!openId}
        canManage={canManage}
        onClose={() => setOpenId(null)}
        onChanged={() => {
          load()
          onChanged()
        }}
        onDeleted={() => {
          setOpenId(null)
          load()
          onChanged()
        }}
      />
    </div>
  )
}

function LetterDetail({
  letter,
  open,
  canManage,
  onClose,
  onChanged,
  onDeleted,
}: {
  letter: GeneratedLetter | null
  open: boolean
  canManage: boolean
  onClose: () => void
  onChanged: () => void
  onDeleted: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cached, setCached] = useState<GeneratedLetter | null>(letter)
  useEffect(() => {
    if (letter) setCached(letter)
  }, [letter])
  const d = letter ?? cached

  useEffect(() => {
    setError('')
  }, [letter?.id])

  const issue = async () => {
    if (!letter) return
    setBusy(true)
    setError('')
    try {
      await issueLetter(letter.id)
      sound.success()
      onChanged()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const remove = async () => {
    if (!letter) return
    if (!confirm('Delete this letter?')) return
    setBusy(true)
    setError('')
    try {
      await deleteLetter(letter.id)
      sound.success()
      onDeleted()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  const footer = d ? (
    <>
      {canManage && letter && d.status === 'draft' && (
        <button
          onClick={issue}
          disabled={busy}
          className="btn-3d inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <BadgeCheck className="size-3.5" />} Issue
        </button>
      )}
      {canManage && letter && (
        <button
          onClick={remove}
          disabled={busy}
          className="ml-auto inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-3 text-[13px] font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
        >
          <Trash2 className="size-3.5" /> Delete
        </button>
      )}
    </>
  ) : undefined

  return (
    <DetailPanel
      open={open}
      onClose={onClose}
      width="w-80"
      title={d?.title ?? ''}
      subtitle={d ? TYPE_LABEL[d.type] : undefined}
      avatar={{ name: d?.employeeName ?? '' }}
      footer={footer}
    >
      {d && (
        <>
          <PanelField label="Employee">{d.employeeName || '—'}</PanelField>
          <PanelField label="Type">
            <StatusBadge tone="blue">{TYPE_LABEL[d.type]}</StatusBadge>
          </PanelField>
          <PanelField label="Title">{d.title}</PanelField>
          <PanelField label="Status">
            <StatusBadge tone={letterStatusTone(d.status)}>
              {d.status === 'issued' ? 'Issued' : 'Draft'}
            </StatusBadge>
          </PanelField>
          <PanelField label="Created">{fmtDate(d.createdAt.slice(0, 10))}</PanelField>
          {d.issuedOn && <PanelField label="Issued on">{fmtDate(d.issuedOn)}</PanelField>}
          <div className="pt-1">
            <div className="mb-1.5 text-[12px] text-muted-foreground">
              {d.templateName ? <>From "{d.templateName}"</> : 'Letter'}
            </div>
            <pre className="whitespace-pre-wrap rounded-lg border border-border bg-card p-3 font-mono text-[12px] leading-relaxed text-foreground/90">
              {d.content || '(empty)'}
            </pre>
          </div>
          {error && <p className="text-[13px] text-rose-600">{error}</p>}
        </>
      )}
    </DetailPanel>
  )
}

function GenerateLetterModal({
  employees,
  templates,
  company,
  onClose,
  onDone,
}: {
  employees: Employee[]
  templates: LetterTemplate[]
  company: string
  onClose: () => void
  onDone: () => void
}) {
  const [employeeId, setEmployeeId] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const emp = employees.find((e) => e.id === employeeId)
  const template = templates.find((t) => t.id === templateId)
  const preview = useMemo(() => {
    if (!template) return ''
    return renderTemplate(template.body, buildTokens(emp, company))
  }, [template, emp, company])

  const submit = async () => {
    if (!employeeId) {
      setError('Select an employee')
      return
    }
    if (!templateId) {
      setError('Select a template')
      return
    }
    setBusy(true)
    setError('')
    try {
      await generateLetter({ employeeId, templateId })
      sound.success()
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <ModalShell title="Generate letter" onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Employee">
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={inputCls} autoFocus>
            <option value="">Select employee…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Template">
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={inputCls}>
            <option value="">Select template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({TYPE_LABEL[t.type]})
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Preview">
        <pre className="max-h-72 min-h-32 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-card p-4 font-mono text-[13px] leading-relaxed text-foreground/90">
          {preview || (template ? '(template body is empty)' : 'Select a template to preview the letter.')}
        </pre>
      </Field>
      {error && <p className="text-[13px] text-rose-600">{error}</p>}
      <ModalActions busy={busy} onClose={onClose} onSubmit={submit} label="Save as draft" />
    </ModalShell>
  )
}

// ─── Templates tab ───
function TemplatesTab({
  header,
  firstTabActive,
  templates,
  canManage,
  onChanged,
  onPaywall,
}: {
  header: React.ReactNode
  firstTabActive: boolean
  templates: LetterTemplate[]
  canManage: boolean
  onChanged: () => void
  onPaywall: (p: Paywall) => void
}) {
  const [editing, setEditing] = useState<LetterTemplate | null>(null)
  const [creating, setCreating] = useState(false)

  const toggle = async (t: LetterTemplate) => {
    try {
      await updateLetterTemplate(t.id, { active: !t.active })
      onChanged()
    } catch (e) {
      alert((e as Error).message)
    }
  }
  const remove = async (t: LetterTemplate) => {
    if (!confirm(`Delete template "${t.name}"?`)) return
    try {
      await deleteLetterTemplate(t.id)
      sound.success()
      onChanged()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  return (
    <div className="flex min-w-0 flex-1 gap-2">
      <Panel className={cn('flex min-w-0 flex-1 flex-col', firstTabActive && 'rounded-tl-none')}>
        {header}
        <div className="min-h-0 flex-1 overflow-auto p-5">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 rounded-xl border border-border bg-muted/40 p-3 text-[12px] text-muted-foreground">
          Available tokens (replaced from the employee record &amp; workspace):{' '}
          <span className="font-mono text-foreground/80">{TOKENS.join('  ')}</span>
        </div>

        {canManage && !creating && !editing && (
          <button
            onClick={() => setCreating(true)}
            className="btn-3d mb-4 inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-foreground px-4 text-[13px] font-medium text-background hover:opacity-90"
          >
            <Plus className="size-4" /> New template
          </button>
        )}

        {(creating || editing) && (
          <TemplateEditor
            template={editing}
            onClose={() => {
              setCreating(false)
              setEditing(null)
            }}
            onPaywall={(p) => {
              setCreating(false)
              setEditing(null)
              onPaywall(p)
            }}
            onDone={() => {
              setCreating(false)
              setEditing(null)
              onChanged()
            }}
          />
        )}

        {templates.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-[13px] text-muted-foreground">
            No templates yet.
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {templates.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-medium">{t.name}</span>
                    <StatusBadge tone="blue">{TYPE_LABEL[t.type]}</StatusBadge>
                    {!t.active && <StatusBadge tone="gray">Inactive</StatusBadge>}
                  </div>
                  {t.body && <div className="mt-0.5 truncate text-[12px] text-muted-foreground">{t.body.slice(0, 100)}</div>}
                </div>
                {canManage && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => setEditing(t)}
                      className="grid size-7 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Edit"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={() => toggle(t)}
                      className="h-7 cursor-pointer rounded-lg border border-border bg-card px-3 text-[12px] font-medium text-muted-foreground hover:bg-muted"
                    >
                      {t.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => remove(t)}
                      className="grid size-7 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-rose-50 hover:text-rose-600"
                      aria-label="Delete"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
        </div>
      </Panel>
    </div>
  )
}

function TemplateEditor({
  template,
  onClose,
  onDone,
  onPaywall,
}: {
  template: LetterTemplate | null
  onClose: () => void
  onDone: () => void
  onPaywall: (p: Paywall) => void
}) {
  const [name, setName] = useState(template?.name ?? '')
  const [type, setType] = useState<LetterType>(template?.type ?? 'offer')
  const [body, setBody] = useState(template?.body ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    setBusy(true)
    setError('')
    try {
      if (template) await updateLetterTemplate(template.id, { name, type, body })
      else await createLetterTemplate({ name, type, body })
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
    <div className="mb-4 space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="text-[13px] font-semibold">{template ? 'Edit template' : 'New template'}</div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. Standard offer letter" autoFocus />
        </Field>
        <Field label="Type">
          <select value={type} onChange={(e) => setType(e.target.value as LetterType)} className={inputCls}>
            {LETTER_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Body">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          className={cn(inputCls, 'h-auto resize-y py-2 font-mono')}
          placeholder={'Dear {{employee_name}},\n\nWe are pleased to offer you the position of {{designation}}…'}
        />
      </Field>
      {error && <p className="text-[13px] text-rose-600">{error}</p>}
      <div className="flex items-center gap-2">
        <button onClick={onClose} className="ml-auto h-9 cursor-pointer rounded-lg border border-border bg-card px-4 text-[13px] font-medium hover:bg-muted">
          Cancel
        </button>
        <button
          onClick={save}
          disabled={busy}
          className="btn-3d inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-foreground px-4 text-[13px] font-medium text-background hover:opacity-90 disabled:opacity-60"
        >
          {busy && <Loader2 className="size-3.5 animate-spin" />} {template ? 'Save' : 'Create'}
        </button>
      </div>
    </div>
  )
}

// ─── shared UI primitives ───
function ModalShell({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={cn('relative w-full overflow-y-auto rounded-2xl border border-border bg-background shadow-2xl duration-200 animate-in fade-in zoom-in-95', wide ? 'max-w-2xl' : 'max-w-md')}>
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
