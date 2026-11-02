import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, X, Plus, Trash2, Check, Ban, Receipt } from 'lucide-react'
import Panel from '@/components/admin/Panel'
import PageTabs from '@/components/admin/PageTabs'
import StatusBadge, { type StatusTone } from '@/components/admin/StatusBadge'
import DataGrid, { type GridColumn, type BadgeTone } from '@/components/admin/DataGrid'
import GridToolbar from '@/components/admin/GridToolbar'
import DetailPanel, { Field as PanelField } from '@/components/admin/DetailPanel'
import { useListView } from '@/lib/useListView'
import { useShell } from '@/components/admin/shell-context'
import { useAuth } from '@/context/auth/AuthContext'
import { cn } from '@/lib/utils'
import { sound } from '@/lib/sound'
import {
  listEmployees,
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getOrders,
  getOrder,
  createOrder,
  updateOrder,
  deleteOrder,
  getSalesInvoices,
  createSalesInvoice,
  updateSalesInvoice,
  deleteSalesInvoice,
  getIncentiveRules,
  createIncentiveRule,
  updateIncentiveRule,
  deleteIncentiveRule,
  getIncentives,
  getIncentiveSummary,
  approveIncentive,
  rejectIncentive,
  type Product,
  type SalesOrder,
  type OrderStatus,
  type OrderItemInput,
  type Invoice2,
  type Invoice2Status,
  type IncentiveRule,
  type IncentivePayout,
  type IncentiveSummary,
  type PayoutStatus,
} from '@/lib/api'
import { type Employee } from '@/lib/employees'

// ─── shared helpers ───
const rupee = (p: number) => '₹' + Math.round(p / 100).toLocaleString('en-IN')
const fmtDate = (s: string) => {
  if (!s) return '—'
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return s
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}
const inputCls =
  'h-9 w-full rounded-lg border border-border bg-card px-2.5 text-[13px] outline-none transition-colors focus:border-ring'

const ORDER_STATUSES: OrderStatus[] = ['draft', 'confirmed', 'fulfilled', 'cancelled']
const INVOICE_STATUSES: Invoice2Status[] = ['draft', 'sent', 'paid', 'overdue', 'cancelled']
const PAYOUT_STATUSES: PayoutStatus[] = ['pending', 'approved', 'paid', 'rejected']

function orderTone(s: OrderStatus): StatusTone {
  return s === 'fulfilled' ? 'green' : s === 'confirmed' ? 'blue' : s === 'cancelled' ? 'rose' : 'gray'
}
function invoiceTone(s: Invoice2Status): StatusTone {
  return s === 'paid' ? 'green' : s === 'sent' ? 'blue' : s === 'overdue' ? 'rose' : s === 'cancelled' ? 'gray' : 'amber'
}
function payoutTone(s: PayoutStatus): StatusTone {
  return s === 'approved' ? 'blue' : s === 'paid' ? 'green' : s === 'rejected' ? 'rose' : 'amber'
}

type Tab = 'orders' | 'products' | 'invoices' | 'incentives'

interface TabNav {
  tabs: { key: Tab; label: string }[]
  tab: Tab
  onTab: (t: Tab) => void
  firstTabActive: boolean
}

// Shared list shell: the list Panel (with PageTabs) on the left and an optional
// inline detail panel as its right-side sibling — the same flex-row layout the
// Employees page uses (no dark overlay backdrop).
function PageShell({ nav, detail, children }: { nav: TabNav; detail?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 gap-2">
      <Panel className={cn('flex min-w-0 flex-1 flex-col', nav.firstTabActive && 'rounded-tl-none')}>
        <PageTabs tabs={nav.tabs} active={nav.tab} onChange={nav.onTab} />
        {children}
      </Panel>
      {detail}
    </div>
  )
}

export default function Sales() {
  const { firstTabActive } = useShell()
  const { activeWorkspace } = useAuth()
  const role = activeWorkspace?.role
  const canManage = role === 'Owner' || role === 'Admin' || role === 'Manager'
  const canApprove = role === 'Owner' || role === 'Admin'

  const [tab, setTab] = useState<Tab>('orders')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    listEmployees().then(setEmployees)
  }, [])
  const loadProducts = useCallback(() => {
    getProducts().then(setProducts)
  }, [])
  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'orders', label: 'Orders' },
    { key: 'products', label: 'Products' },
    { key: 'invoices', label: 'Invoices' },
    { key: 'incentives', label: 'Incentives' },
  ]
  const nav: TabNav = { tabs, tab, onTab: setTab, firstTabActive }

  return (
    <>
      {tab === 'orders' && <OrdersTab nav={nav} employees={employees} products={products} canManage={canManage} />}
      {tab === 'products' && <ProductsTab nav={nav} canManage={canManage} onChanged={loadProducts} />}
      {tab === 'invoices' && <InvoicesTab nav={nav} canManage={canManage} />}
      {tab === 'incentives' && <IncentivesTab nav={nav} employees={employees} canApprove={canApprove} />}
    </>
  )
}

// ─── Orders tab ───
function OrdersTab({ nav, employees, products, canManage }: { nav: TabNav; employees: Employee[]; products: Product[]; canManage: boolean }) {
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    getOrders()
      .then(setOrders)
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const lv = useListView({
    rows: orders,
    search: (o) => `#${o.orderNo} ${o.customerName} ${o.companyName} ${o.salespersonName}`,
    filters: [
      { id: 'status', label: 'Status', options: ORDER_STATUSES.map((s) => ({ value: s })), get: (o) => o.status },
      { id: 'salesperson', label: 'Salesperson', get: (o) => o.salespersonName || '' },
    ],
    sorts: [
      { key: 'orderNo', label: 'Order #', get: (o) => o.orderNo },
      { key: 'customer', label: 'Customer', get: (o) => o.customerName || o.companyName || '' },
      { key: 'date', label: 'Order date', get: (o) => o.orderDate },
      { key: 'total', label: 'Total', get: (o) => o.totalPaise },
    ],
  })

  const columns: GridColumn<SalesOrder>[] = [
    { id: 'orderNo', title: 'Order', kind: 'text', width: 90, get: (o) => `#${o.orderNo}` },
    { id: 'customer', title: 'Customer', kind: 'text', width: 200, get: (o) => o.customerName || o.companyName || '—' },
    { id: 'salesperson', title: 'Salesperson', kind: 'person', width: 170, get: (o) => o.salespersonName || '—' },
    { id: 'status', title: 'Status', kind: 'badge', width: 120, get: (o) => o.status, badgeTone: (o) => orderTone(o.status) as BadgeTone },
    { id: 'total', title: 'Total', kind: 'money', width: 120, get: (o) => o.totalPaise },
    { id: 'date', title: 'Date', kind: 'date', width: 140, get: (o) => o.orderDate },
  ]

  return (
    <PageShell
      nav={nav}
      detail={
        <OrderDetail
          openId={openId}
          employees={employees}
          canManage={canManage}
          onClose={() => setOpenId(null)}
          onChanged={load}
          onDeleted={() => {
            setOpenId(null)
            load()
          }}
        />
      }
    >
      <GridToolbar
        total={orders.length}
        {...lv.toolbar}
        searchPlaceholder="Search orders…"
        primaryAction={{ label: 'New order', onClick: () => setCreateOpen(true) }}
      />
      <div className="min-h-0 flex-1 border-t border-border">
        {loading ? (
          <div className="grid h-full place-items-center text-[13px] text-muted-foreground">Loading…</div>
        ) : (
          <DataGrid
            rows={lv.view}
            columns={columns}
            getRowId={(o) => o.id}
            onRowClick={(o) => setOpenId(o.id)}
            onAddRow={() => setCreateOpen(true)}
            emptyMessage="No orders yet"
          />
        )}
      </div>

      {createOpen && (
        <OrderModal
          employees={employees}
          products={products}
          onClose={() => setCreateOpen(false)}
          onDone={() => {
            setCreateOpen(false)
            load()
          }}
        />
      )}
    </PageShell>
  )
}

interface DraftLine {
  productId: string
  name: string
  qty: string
  unitPrice: string // rupees
  taxBps: string
}
const emptyLine = (): DraftLine => ({ productId: '', name: '', qty: '1', unitPrice: '', taxBps: '1800' })

function linesToItems(lines: DraftLine[]): OrderItemInput[] {
  return lines
    .filter((l) => l.name.trim())
    .map((l) => ({
      productId: l.productId || null,
      name: l.name.trim(),
      qty: Math.max(1, Math.round(Number(l.qty) || 1)),
      unitPricePaise: Math.max(0, Math.round(Number(l.unitPrice) || 0)) * 100,
      taxBps: Math.max(0, Math.round(Number(l.taxBps) || 0)),
    }))
}

function computeTotals(items: OrderItemInput[]) {
  const subtotal = items.reduce((s, i) => s + i.qty * i.unitPricePaise, 0)
  const taxP = items.reduce((s, i) => s + Math.round((i.qty * i.unitPricePaise * i.taxBps) / 10000), 0)
  return { subtotal, taxP, total: subtotal + taxP }
}

function OrderModal({
  employees,
  products,
  onClose,
  onDone,
}: {
  employees: Employee[]
  products: Product[]
  onClose: () => void
  onDone: () => void
}) {
  const [customerName, setCustomerName] = useState('')
  const [salespersonId, setSalespersonId] = useState('')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10))
  const [status, setStatus] = useState<OrderStatus>('draft')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const items = useMemo(() => linesToItems(lines), [lines])
  const totals = useMemo(() => computeTotals(items), [items])

  const setLine = (idx: number, patch: Partial<DraftLine>) =>
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))

  const pickProduct = (idx: number, productId: string) => {
    const p = products.find((x) => x.id === productId)
    if (p) setLine(idx, { productId, name: p.name, unitPrice: String(Math.round(p.pricePaise / 100)), taxBps: String(p.taxBps) })
    else setLine(idx, { productId: '' })
  }

  const submit = async () => {
    if (items.length === 0) {
      setError('Add at least one line item with a name')
      return
    }
    setBusy(true)
    setError('')
    try {
      await createOrder({
        customerName,
        salespersonId: salespersonId || null,
        orderDate,
        status,
        note,
        items,
      })
      sound.success()
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <ModalShell title="New order" wide onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Customer">
          <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={inputCls} placeholder="Customer name" autoFocus />
        </Field>
        <Field label="Salesperson">
          <select value={salespersonId} onChange={(e) => setSalespersonId(e.target.value)} className={inputCls}>
            <option value="">Unassigned</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Order date">
          <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)} className={cn(inputCls, 'capitalize')}>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-medium text-muted-foreground">Line items</span>
          <button onClick={() => setLines((p) => [...p, emptyLine()])} className="inline-flex cursor-pointer items-center gap-1 text-[12px] font-medium text-foreground hover:opacity-70">
            <Plus className="size-3.5" /> Add line
          </button>
        </div>
        <div className="space-y-2">
          {lines.map((l, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_3.5rem_5rem_4rem_auto] items-center gap-2 rounded-lg border border-border bg-muted/30 p-2">
              <div className="space-y-1">
                {products.length > 0 && (
                  <select value={l.productId} onChange={(e) => pickProduct(idx, e.target.value)} className={cn(inputCls, 'h-8')}>
                    <option value="">Custom item…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
                <input value={l.name} onChange={(e) => setLine(idx, { name: e.target.value })} className={cn(inputCls, 'h-8')} placeholder="Item name" />
              </div>
              <input type="number" min={1} value={l.qty} onChange={(e) => setLine(idx, { qty: e.target.value })} className={cn(inputCls, 'h-8')} placeholder="Qty" title="Qty" />
              <input type="number" min={0} value={l.unitPrice} onChange={(e) => setLine(idx, { unitPrice: e.target.value })} className={cn(inputCls, 'h-8')} placeholder="₹ price" title="Unit price (₹)" />
              <input type="number" min={0} value={l.taxBps} onChange={(e) => setLine(idx, { taxBps: e.target.value })} className={cn(inputCls, 'h-8')} placeholder="GST bps" title="GST (basis points, 1800 = 18%)" />
              <button
                onClick={() => setLines((p) => (p.length > 1 ? p.filter((_, i) => i !== idx) : p))}
                aria-label="Remove line"
                className="grid size-7 cursor-pointer place-items-center rounded text-muted-foreground hover:text-rose-600"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-end gap-0.5 pt-1 text-[13px] tabular-nums">
          <div className="text-muted-foreground">Subtotal: <span className="font-medium text-foreground">{rupee(totals.subtotal)}</span></div>
          <div className="text-muted-foreground">Tax: <span className="font-medium text-foreground">{rupee(totals.taxP)}</span></div>
          <div className="text-[15px] font-semibold">Total: {rupee(totals.total)}</div>
        </div>
      </div>

      <Field label="Note">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={cn(inputCls, 'h-auto resize-none py-2')} placeholder="Optional note" />
      </Field>

      {error && <p className="text-[13px] text-rose-600">{error}</p>}
      <ModalActions busy={busy} onClose={onClose} onSubmit={submit} label="Create order" />
    </ModalShell>
  )
}

function OrderDetail({
  openId,
  employees,
  canManage,
  onClose,
  onChanged,
  onDeleted,
}: {
  openId: string | null
  employees: Employee[]
  canManage: boolean
  onClose: () => void
  onChanged: () => void
  onDeleted: () => void
}) {
  const [order, setOrder] = useState<SalesOrder | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (openId) getOrder(openId).then(setOrder)
  }, [openId])

  const patch = async (data: Parameters<typeof updateOrder>[1]) => {
    if (!order) return
    setBusy(true)
    try {
      const upd = await updateOrder(order.id, data)
      setOrder(upd)
      onChanged()
      sound.success()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!order || !confirm(`Delete order #${order.orderNo}? Pending incentives will be removed.`)) return
    setBusy(true)
    try {
      await deleteOrder(order.id)
      sound.success()
      onDeleted()
    } catch (e) {
      alert((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <DetailPanel
      open={!!openId}
      onClose={onClose}
      width="w-80"
      title={order ? `Order #${order.orderNo}` : 'Order'}
      subtitle={order ? order.customerName || order.companyName || 'No customer' : undefined}
      avatar={{ name: order?.salespersonName || order?.customerName || order?.companyName || '' }}
      footer={
        canManage && order ? (
          <button
            onClick={remove}
            disabled={busy}
            className="inline-flex h-7 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border bg-card text-[13px] font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
          >
            <Trash2 className="size-3.5" /> Delete order
          </button>
        ) : undefined
      }
    >
      {!order ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : (
        <>
          <PanelField label="Order #">#{order.orderNo}</PanelField>
          <PanelField label="Customer">{order.customerName || order.companyName || '—'}</PanelField>
          <PanelField label="Salesperson">
            <select
              value={order.salespersonId ?? ''}
              onChange={(e) => patch({ salespersonId: e.target.value || null })}
              disabled={busy}
              className={cn(inputCls, 'h-8 w-auto')}
            >
              <option value="">Unassigned</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </PanelField>
          <PanelField label="Status">
            <select
              value={order.status}
              onChange={(e) => patch({ status: e.target.value as OrderStatus })}
              disabled={busy}
              className={cn(inputCls, 'h-8 w-auto capitalize')}
            >
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </PanelField>
          <PanelField label="Total">{rupee(order.totalPaise)}</PanelField>
          <PanelField label="Date">{fmtDate(order.orderDate)}</PanelField>

          <div className="pt-1">
            <div className="mb-1 text-[12px] font-medium text-muted-foreground">Line items</div>
            <div className="space-y-1">
              {(order.items ?? []).map((it) => (
                <div key={it.id} className="flex items-center justify-between gap-3 tabular-nums">
                  <span className="min-w-0 truncate text-foreground/90">
                    {it.name} <span className="text-muted-foreground">× {it.qty}</span>
                  </span>
                  <span className="shrink-0 font-medium">{rupee(it.lineTotalPaise)}</span>
                </div>
              ))}
              {(order.items ?? []).length === 0 && <div className="text-muted-foreground">No items</div>}
            </div>
          </div>

          <p className="pt-1 text-[12px] text-muted-foreground">
            Setting status to <span className="font-medium">confirmed</span> or{' '}
            <span className="font-medium">fulfilled</span> generates sales incentives for the salesperson.
          </p>
          {order.note && (
            <p className="whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-2 text-[12px] text-foreground/90">
              {order.note}
            </p>
          )}
        </>
      )}
    </DetailPanel>
  )
}

// ─── Products tab ───
function ProductsTab({ nav, canManage, onChanged }: { nav: TabNav; canManage: boolean; onChanged: () => void }) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ product: Product | null } | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    getProducts()
      .then(setProducts)
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const lv = useListView({
    rows: products,
    search: (p) => `${p.name} ${p.sku}`,
    filters: [
      {
        id: 'active',
        label: 'Status',
        options: [
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
        ],
        get: (p) => (p.active ? 'active' : 'inactive'),
      },
    ],
    sorts: [
      { key: 'name', label: 'Name', get: (p) => p.name },
      { key: 'price', label: 'Price', get: (p) => p.pricePaise },
      { key: 'sku', label: 'SKU', get: (p) => p.sku },
    ],
  })

  const columns: GridColumn<Product>[] = [
    { id: 'name', title: 'Name', kind: 'text', width: 240, get: (p) => p.name },
    { id: 'sku', title: 'SKU', kind: 'text', width: 140, get: (p) => p.sku || '—' },
    { id: 'price', title: 'Price', kind: 'money', width: 120, get: (p) => p.pricePaise },
    { id: 'gst', title: 'GST', kind: 'text', width: 90, get: (p) => `${(p.taxBps / 100).toFixed(p.taxBps % 100 ? 2 : 0)}%` },
    {
      id: 'status',
      title: 'Status',
      kind: 'badge',
      width: 110,
      get: (p) => (p.active ? 'active' : 'inactive'),
      badgeTone: (p) => (p.active ? 'green' : 'gray') as BadgeTone,
    },
  ]

  return (
    <PageShell nav={nav}>
      <GridToolbar
        total={products.length}
        {...lv.toolbar}
        searchPlaceholder="Search products…"
        primaryAction={{ label: 'New product', onClick: () => setModal({ product: null }) }}
      />
      <div className="min-h-0 flex-1 border-t border-border">
        {loading ? (
          <div className="grid h-full place-items-center text-[13px] text-muted-foreground">Loading…</div>
        ) : (
          <DataGrid
            rows={lv.view}
            columns={columns}
            getRowId={(p) => p.id}
            onRowClick={(p) => setModal({ product: p })}
            onAddRow={() => setModal({ product: null })}
            emptyMessage="No products yet"
          />
        )}
      </div>

      {modal && (
        <ProductModal
          product={modal.product}
          canManage={canManage}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null)
            load()
            onChanged()
          }}
        />
      )}
    </PageShell>
  )
}

function ProductModal({ product, canManage, onClose, onDone }: { product: Product | null; canManage: boolean; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(product?.name ?? '')
  const [sku, setSku] = useState(product?.sku ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [price, setPrice] = useState(product ? String(Math.round(product.pricePaise / 100)) : '')
  const [taxBps, setTaxBps] = useState(String(product?.taxBps ?? 1800))
  const [active, setActive] = useState(product?.active ?? true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    setBusy(true)
    setError('')
    try {
      const payload = {
        name,
        sku,
        description,
        pricePaise: Math.max(0, Math.round(Number(price) || 0)) * 100,
        taxBps: Math.max(0, Math.round(Number(taxBps) || 0)),
        active,
      }
      if (product) await updateProduct(product.id, payload)
      else await createProduct(payload)
      sound.success()
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!product || !confirm('Delete this product?')) return
    setBusy(true)
    try {
      await deleteProduct(product.id)
      sound.success()
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <ModalShell title={product ? 'Edit product' : 'New product'} onClose={onClose}>
      <Field label="Name">
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="SKU">
          <input value={sku} onChange={(e) => setSku(e.target.value)} className={inputCls} placeholder="optional" />
        </Field>
        <Field label="Price (₹)">
          <input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} placeholder="0" />
        </Field>
        <Field label="GST (basis points)">
          <input type="number" min={0} value={taxBps} onChange={(e) => setTaxBps(e.target.value)} className={inputCls} placeholder="1800 = 18%" />
        </Field>
        <Field label="Active">
          <select value={active ? 'yes' : 'no'} onChange={(e) => setActive(e.target.value === 'yes')} className={inputCls}>
            <option value="yes">Active</option>
            <option value="no">Inactive</option>
          </select>
        </Field>
      </div>
      <Field label="Description">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={cn(inputCls, 'h-auto resize-none py-2')} />
      </Field>
      {error && <p className="text-[13px] text-rose-600">{error}</p>}
      <ModalActions busy={busy} onClose={onClose} onSubmit={submit} label={product ? 'Save' : 'Create'} onDelete={product && canManage ? remove : undefined} />
    </ModalShell>
  )
}

// ─── Invoices tab ───
function InvoicesTab({ nav, canManage }: { nav: TabNav; canManage: boolean }) {
  const [invoices, setInvoices] = useState<Invoice2[]>([])
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    getSalesInvoices()
      .then(setInvoices)
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => {
    load()
  }, [load])
  useEffect(() => {
    getOrders().then(setOrders)
  }, [])

  const openInvoice = invoices.find((i) => i.id === openId) ?? null

  const lv = useListView({
    rows: invoices,
    search: (i) => `#${i.invoiceNo} ${i.customerName}`,
    filters: [
      { id: 'status', label: 'Status', options: INVOICE_STATUSES.map((s) => ({ value: s })), get: (i) => i.status },
    ],
    sorts: [
      { key: 'invoiceNo', label: 'Invoice #', get: (i) => i.invoiceNo },
      { key: 'date', label: 'Due date', get: (i) => i.dueDate },
      { key: 'total', label: 'Total', get: (i) => i.totalPaise },
      { key: 'status', label: 'Status', get: (i) => i.status },
    ],
  })

  const columns: GridColumn<Invoice2>[] = [
    { id: 'invoiceNo', title: 'Invoice', kind: 'text', width: 100, get: (i) => `#${i.invoiceNo}` },
    { id: 'customer', title: 'Customer', kind: 'text', width: 200, get: (i) => i.customerName || '—' },
    { id: 'status', title: 'Status', kind: 'badge', width: 120, get: (i) => i.status, badgeTone: (i) => invoiceTone(i.status) as BadgeTone },
    { id: 'total', title: 'Total', kind: 'money', width: 120, get: (i) => i.totalPaise },
    { id: 'paid', title: 'Paid', kind: 'money', width: 120, get: (i) => i.amountPaidPaise },
    { id: 'due', title: 'Due', kind: 'date', width: 140, get: (i) => i.dueDate },
  ]

  return (
    <PageShell
      nav={nav}
      detail={
        <InvoiceDetail
          invoice={openInvoice}
          open={!!openId}
          canManage={canManage}
          onClose={() => setOpenId(null)}
          onChanged={load}
          onDeleted={() => {
            setOpenId(null)
            load()
          }}
        />
      }
    >
      <GridToolbar
        total={invoices.length}
        {...lv.toolbar}
        searchPlaceholder="Search invoices…"
        primaryAction={{ label: 'New invoice', onClick: () => setCreateOpen(true) }}
      />
      <div className="min-h-0 flex-1 border-t border-border">
        {loading ? (
          <div className="grid h-full place-items-center text-[13px] text-muted-foreground">Loading…</div>
        ) : (
          <DataGrid
            rows={lv.view}
            columns={columns}
            getRowId={(i) => i.id}
            onRowClick={(i) => setOpenId(i.id)}
            onAddRow={() => setCreateOpen(true)}
            emptyMessage="No invoices yet"
          />
        )}
      </div>

      {createOpen && (
        <InvoiceModal
          orders={orders}
          onClose={() => setCreateOpen(false)}
          onDone={() => {
            setCreateOpen(false)
            load()
          }}
        />
      )}
    </PageShell>
  )
}

function InvoiceDetail({
  invoice,
  open,
  canManage,
  onClose,
  onChanged,
  onDeleted,
}: {
  invoice: Invoice2 | null
  open: boolean
  canManage: boolean
  onClose: () => void
  onChanged: () => void
  onDeleted: () => void
}) {
  const [busy, setBusy] = useState(false)
  // keep the last shown invoice so content stays put through the exit animation
  const [cached, setCached] = useState<Invoice2 | null>(invoice)
  useEffect(() => {
    if (invoice) setCached(invoice)
  }, [invoice])
  const inv = invoice ?? cached

  const markPaid = async () => {
    if (!inv) return
    setBusy(true)
    try {
      await updateSalesInvoice(inv.id, { amountPaidPaise: inv.totalPaise, status: 'paid' })
      sound.success()
      onChanged()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!inv || !confirm(`Delete invoice #${inv.invoiceNo}?`)) return
    setBusy(true)
    try {
      await deleteSalesInvoice(inv.id)
      sound.success()
      onDeleted()
    } catch (e) {
      alert((e as Error).message)
      setBusy(false)
    }
  }

  const canPay = !!inv && inv.status !== 'paid' && inv.status !== 'cancelled'
  const showFooter = !!inv && (canPay || canManage)

  return (
    <DetailPanel
      open={open}
      onClose={onClose}
      title={inv ? `Invoice #${inv.invoiceNo}` : 'Invoice'}
      subtitle={inv?.customerName || undefined}
      icon={<Receipt className="size-4" />}
      footer={
        showFooter ? (
          <>
            {canPay && (
              <button
                onClick={markPaid}
                disabled={busy}
                className="inline-flex h-7 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-emerald-600 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Mark paid
              </button>
            )}
            {canManage && (
              <button
                onClick={remove}
                disabled={busy}
                className="inline-flex h-7 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border bg-card text-[13px] font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
              >
                <Trash2 className="size-3.5" /> Delete
              </button>
            )}
          </>
        ) : undefined
      }
    >
      {inv && (
        <>
          <PanelField label="Invoice #">#{inv.invoiceNo}</PanelField>
          <PanelField label="Customer">{inv.customerName || '—'}</PanelField>
          <PanelField label="Status">
            <StatusBadge tone={invoiceTone(inv.status)}>{inv.status}</StatusBadge>
          </PanelField>
          <PanelField label="Total">{rupee(inv.totalPaise)}</PanelField>
          <PanelField label="Paid">{rupee(inv.amountPaidPaise)}</PanelField>
          <PanelField label="Due">{fmtDate(inv.dueDate)}</PanelField>
        </>
      )}
    </DetailPanel>
  )
}

function InvoiceModal({ orders, onClose, onDone }: { orders: SalesOrder[]; onClose: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<'order' | 'standalone'>(orders.length ? 'order' : 'standalone')
  const [orderId, setOrderId] = useState(orders[0]?.id ?? '')
  const [customerName, setCustomerName] = useState('')
  const [subtotal, setSubtotal] = useState('')
  const [taxBps, setTaxBps] = useState('1800')
  const [dueDate, setDueDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      if (mode === 'order') {
        if (!orderId) {
          setError('Pick an order')
          setBusy(false)
          return
        }
        await createSalesInvoice({ orderId, dueDate })
      } else {
        await createSalesInvoice({
          customerName,
          subtotalPaise: Math.max(0, Math.round(Number(subtotal) || 0)) * 100,
          taxBps: Math.max(0, Math.round(Number(taxBps) || 0)),
          dueDate,
        })
      }
      sound.success()
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <ModalShell title="New invoice" onClose={onClose}>
      <div className="flex gap-1 rounded-lg border border-border p-1">
        {(['order', 'standalone'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            disabled={m === 'order' && orders.length === 0}
            className={cn(
              'flex-1 cursor-pointer rounded-md px-3 py-1.5 text-[12px] font-medium capitalize transition-colors disabled:opacity-40',
              mode === m ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {m === 'order' ? 'From order' : 'Standalone'}
          </button>
        ))}
      </div>

      {mode === 'order' ? (
        <Field label="Order">
          <select value={orderId} onChange={(e) => setOrderId(e.target.value)} className={inputCls}>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                #{o.orderNo} — {o.customerName || o.companyName || 'No customer'} ({rupee(o.totalPaise)})
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <>
          <Field label="Customer">
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={inputCls} placeholder="Customer name" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Subtotal (₹)">
              <input type="number" min={0} value={subtotal} onChange={(e) => setSubtotal(e.target.value)} className={inputCls} placeholder="0" />
            </Field>
            <Field label="GST (basis points)">
              <input type="number" min={0} value={taxBps} onChange={(e) => setTaxBps(e.target.value)} className={inputCls} placeholder="1800 = 18%" />
            </Field>
          </div>
        </>
      )}
      <Field label="Due date">
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
      </Field>
      {error && <p className="text-[13px] text-rose-600">{error}</p>}
      <ModalActions busy={busy} onClose={onClose} onSubmit={submit} label="Create" />
    </ModalShell>
  )
}

// ─── Incentives tab ───
function IncentivesTab({ nav, employees, canApprove }: { nav: TabNav; employees: Employee[]; canApprove: boolean }) {
  const [rules, setRules] = useState<IncentiveRule[]>([])
  const [payouts, setPayouts] = useState<IncentivePayout[]>([])
  const [summary, setSummary] = useState<IncentiveSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [ruleModal, setRuleModal] = useState<{ rule: IncentiveRule | null } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  const empName = useMemo(() => new Map(employees.map((e) => [e.id, e.name])), [employees])

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      getIncentiveRules(),
      getIncentives({}),
      getIncentiveSummary(),
    ])
      .then(([r, p, s]) => {
        setRules(r)
        setPayouts(p)
        setSummary(s)
      })
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const lv = useListView({
    rows: payouts,
    search: (p) => `${p.employeeName || empName.get(p.employeeId) || ''} ${p.ruleName} ${p.note}`,
    filters: [
      { id: 'status', label: 'Status', options: PAYOUT_STATUSES.map((s) => ({ value: s })), get: (p) => p.status },
    ],
    sorts: [
      { key: 'employee', label: 'Salesperson', get: (p) => p.employeeName || empName.get(p.employeeId) || '' },
      { key: 'amount', label: 'Amount', get: (p) => p.amountPaise },
    ],
  })

  const payoutColumns: GridColumn<IncentivePayout>[] = [
    { id: 'employee', title: 'Salesperson', kind: 'person', width: 180, get: (p) => p.employeeName || empName.get(p.employeeId) || '—' },
    { id: 'rule', title: 'Rule', kind: 'text', width: 180, get: (p) => p.ruleName || p.note || '—' },
    { id: 'period', title: 'Period', kind: 'text', width: 120, get: (p) => p.period },
    { id: 'amount', title: 'Amount', kind: 'money', width: 120, get: (p) => p.amountPaise },
    { id: 'status', title: 'Status', kind: 'badge', width: 120, get: (p) => p.status, badgeTone: (p) => payoutTone(p.status) as BadgeTone },
  ]

  const openPayout = payouts.find((p) => p.id === openId) ?? null

  const act = async (id: string, fn: (id: string) => Promise<unknown>) => {
    setBusyId(id)
    try {
      await fn(id)
      sound.success()
      load()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusyId(null)
    }
  }
  const removeRule = async (id: string) => {
    if (!confirm('Delete this incentive rule?')) return
    try {
      await deleteIncentiveRule(id)
      sound.success()
      load()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  return (
    <PageShell
      nav={nav}
      detail={
        <PayoutDetail
          payout={openPayout}
          name={openPayout ? openPayout.employeeName || empName.get(openPayout.employeeId) || '—' : '—'}
          open={!!openId}
          canApprove={canApprove}
          busy={!!openPayout && busyId === openPayout.id}
          onApprove={() => openPayout && act(openPayout.id, approveIncentive)}
          onReject={() => openPayout && act(openPayout.id, rejectIncentive)}
          onClose={() => setOpenId(null)}
        />
      }
    >
    <div className="min-h-0 flex-1 overflow-auto">
      {/* summary cards */}
      <div className="grid grid-cols-2 gap-3 border-b border-border p-4 sm:grid-cols-4">
        <StatCard label="Pending" value={summary ? rupee(summary.byStatus.pending.amountPaise) : undefined} />
        <StatCard label="Approved" value={summary ? rupee(summary.byStatus.approved.amountPaise) : undefined} accent />
        <StatCard label="Paid" value={summary ? rupee(summary.byStatus.paid.amountPaise) : undefined} />
        <StatCard
          label={`Pending this month${summary ? ` (${summary.thisMonth.period})` : ''}`}
          value={summary ? rupee(summary.thisMonth.pendingPaise) : undefined}
        />
      </div>
      <div className="border-b border-border bg-amber-50/60 px-4 py-2 text-[12px] text-amber-800">
        Approving a payout adds a taxable payroll <span className="font-medium">earning</span> for the salesperson in that month — the payroll engine picks it up automatically on the next run.
      </div>

      {/* rules */}
      <div className="border-b border-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold">Incentive rules</h3>
          {canApprove && (
            <button onClick={() => setRuleModal({ rule: null })} className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-border bg-card px-3 text-[12px] font-medium hover:bg-muted">
              <Plus className="size-3.5" /> New rule
            </button>
          )}
        </div>
        {rules.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No rules yet. Add a rule so confirmed orders generate incentives.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {rules.map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-2 rounded-xl border border-border bg-card p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-medium">{r.name}</span>
                    <StatusBadge tone={r.active ? 'green' : 'gray'}>{r.active ? 'active' : 'off'}</StatusBadge>
                  </div>
                  <div className="mt-1 text-[12px] text-muted-foreground">
                    {(r.rateBps / 100).toFixed(r.rateBps % 100 ? 2 : 0)}% of subtotal
                    {r.minOrderPaise > 0 && ` · min ${rupee(r.minOrderPaise)}`}
                  </div>
                </div>
                {canApprove && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button onClick={() => setRuleModal({ rule: r })} className="cursor-pointer rounded px-1.5 py-0.5 text-[12px] text-muted-foreground hover:text-foreground">Edit</button>
                    <button onClick={() => removeRule(r.id)} aria-label="Delete rule" className="grid size-6 cursor-pointer place-items-center rounded text-muted-foreground hover:text-rose-600">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* payouts */}
      <div className="p-4">
        <h3 className="mb-3 text-[13px] font-semibold">Payouts</h3>
        <div className="overflow-hidden rounded-xl border border-border">
          <GridToolbar total={payouts.length} {...lv.toolbar} searchPlaceholder="Search payouts…" />
          <div className="border-t border-border">
            {loading ? (
              <div className="grid h-[420px] place-items-center text-[13px] text-muted-foreground">Loading…</div>
            ) : (
              <DataGrid
                rows={lv.view}
                columns={payoutColumns}
                getRowId={(p) => p.id}
                onRowClick={(p) => setOpenId(p.id)}
                emptyMessage="No payouts yet"
                height={420}
              />
            )}
          </div>
        </div>
      </div>

      {ruleModal && (
        <RuleModal
          rule={ruleModal.rule}
          onClose={() => setRuleModal(null)}
          onDone={() => {
            setRuleModal(null)
            load()
          }}
        />
      )}
    </div>
    </PageShell>
  )
}

function PayoutDetail({
  payout,
  name,
  open,
  canApprove,
  busy,
  onApprove,
  onReject,
  onClose,
}: {
  payout: IncentivePayout | null
  name: string
  open: boolean
  canApprove: boolean
  busy: boolean
  onApprove: () => void
  onReject: () => void
  onClose: () => void
}) {
  // snapshot the payout + name so content stays put through the exit animation
  const [snap, setSnap] = useState<{ payout: IncentivePayout; name: string } | null>(
    payout ? { payout, name } : null,
  )
  useEffect(() => {
    if (payout) setSnap({ payout, name })
  }, [payout, name])
  const p = payout ?? snap?.payout ?? null
  const displayName = (payout ? name : snap?.name) ?? '—'

  return (
    <DetailPanel
      open={open}
      onClose={onClose}
      title="Incentive payout"
      subtitle={p ? rupee(p.amountPaise) : undefined}
      avatar={{ name: displayName }}
      footer={
        canApprove && p?.status === 'pending' ? (
          <>
            <button
              onClick={onApprove}
              disabled={busy}
              className="inline-flex h-7 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-emerald-600 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Approve
            </button>
            <button
              onClick={onReject}
              disabled={busy}
              className="inline-flex h-7 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border bg-card text-[13px] font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-60"
            >
              <Ban className="size-3.5" /> Reject
            </button>
          </>
        ) : undefined
      }
    >
      {p && (
        <>
          <PanelField label="Salesperson">{displayName}</PanelField>
          <PanelField label="Rule">{p.ruleName || p.note || '—'}</PanelField>
          <PanelField label="Period">{p.period}</PanelField>
          <PanelField label="Amount">{rupee(p.amountPaise)}</PanelField>
          <PanelField label="Status">
            <StatusBadge tone={payoutTone(p.status)}>{p.status}</StatusBadge>
          </PanelField>
          {p.status === 'approved' && p.adjustmentId && (
            <p className="pt-1 text-[12px] text-emerald-700">
              Added as a taxable payroll earning for the salesperson in {p.period}.
            </p>
          )}
        </>
      )}
    </DetailPanel>
  )
}

function RuleModal({ rule, onClose, onDone }: { rule: IncentiveRule | null; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(rule?.name ?? '')
  const [ratePct, setRatePct] = useState(rule ? String(rule.rateBps / 100) : '')
  const [minOrder, setMinOrder] = useState(rule ? String(Math.round(rule.minOrderPaise / 100)) : '')
  const [active, setActive] = useState(rule?.active ?? true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    setBusy(true)
    setError('')
    try {
      const payload = {
        name,
        rateBps: Math.max(0, Math.round(Number(ratePct) * 100 || 0)),
        minOrderPaise: Math.max(0, Math.round(Number(minOrder) || 0)) * 100,
        active,
      }
      if (rule) await updateIncentiveRule(rule.id, payload)
      else await createIncentiveRule(payload)
      sound.success()
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <ModalShell title={rule ? 'Edit rule' : 'New incentive rule'} onClose={onClose}>
      <Field label="Name">
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} autoFocus placeholder="e.g. Standard commission" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Rate (%)">
          <input type="number" min={0} step="0.01" value={ratePct} onChange={(e) => setRatePct(e.target.value)} className={inputCls} placeholder="e.g. 5" />
        </Field>
        <Field label="Min order (₹)">
          <input type="number" min={0} value={minOrder} onChange={(e) => setMinOrder(e.target.value)} className={inputCls} placeholder="0" />
        </Field>
      </div>
      <Field label="Active">
        <select value={active ? 'yes' : 'no'} onChange={(e) => setActive(e.target.value === 'yes')} className={inputCls}>
          <option value="yes">Active</option>
          <option value="no">Inactive</option>
        </select>
      </Field>
      <p className="text-[11px] text-muted-foreground">Incentive = rate × order subtotal (pre-tax), generated when an order is confirmed/fulfilled.</p>
      {error && <p className="text-[13px] text-rose-600">{error}</p>}
      <ModalActions busy={busy} onClose={onClose} onSubmit={submit} label={rule ? 'Save' : 'Create'} />
    </ModalShell>
  )
}

// ─── shared UI primitives ───
function StatCard({ label, value, accent }: { label: string; value?: string | number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className={cn('mt-1 text-2xl font-semibold tabular-nums', accent && 'text-emerald-600')}>{value ?? '—'}</div>
    </div>
  )
}

function ModalShell({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={cn('relative max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-border bg-background shadow-2xl duration-200 animate-in fade-in zoom-in-95', wide ? 'max-w-2xl' : 'max-w-md')}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid size-7 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-3 p-5">{children}</div>
      </div>
    </div>
  )
}

function ModalActions({ busy, onClose, onSubmit, label, onDelete }: { busy: boolean; onClose: () => void; onSubmit: () => void; label: string; onDelete?: () => void }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      {onDelete && (
        <button onClick={onDelete} disabled={busy} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[13px] font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-60">
          <Trash2 className="size-4" /> Delete
        </button>
      )}
      <button onClick={onClose} className="ml-auto h-9 cursor-pointer rounded-lg border border-border bg-card px-4 text-[13px] font-medium hover:bg-muted">
        Cancel
      </button>
      <button onClick={onSubmit} disabled={busy} className="btn-3d inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-foreground px-4 text-[13px] font-medium text-background hover:opacity-90 disabled:opacity-60">
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
