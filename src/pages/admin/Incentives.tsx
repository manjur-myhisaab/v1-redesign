import { useState, useMemo } from 'react'
import {
  TrendingUp,
  Plus,
  Search,
  Calendar,
  IndianRupee,
  Trash2,
  Edit,
  Loader2,
  Users,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import Panel from '@/components/admin/Panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmployeeAvatar } from '@/lib/people'
import rdk, { readItems, createItem, updateItem, deleteItem } from '@/services/server'

interface Incentive {
  incentive_id: string
  incentive_title?: string
  incentive_amount?: number
  incentive_date?: string
  incentive_remarks?: string
  employee_id?: {
    id: string
    first_name: string
    last_name: string
    employee_category_id?: {
      employee_category_name: string
    }
  }
}

interface EmployeeOption {
  id: string
  first_name: string
  last_name: string
}

export default function Incentives() {
  const queryClient = useQueryClient()

  // Date filters
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const todayStr = now.toISOString().slice(0, 10)

  const [startDate, setStartDate] = useState(firstOfMonth)
  const [endDate, setEndDate] = useState(todayStr)
  const [search, setSearch] = useState('')
  const [viewTab, setViewTab] = useState<'all' | 'grouped'>('all')

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editingIncentive, setEditingIncentive] = useState<Incentive | null>(null)
  const [employeeId, setEmployeeId] = useState('')
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState<number | ''>('')
  const [incentiveDate, setIncentiveDate] = useState(todayStr)
  const [remarks, setRemarks] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch incentives
  const { data: incentives = [], isLoading } = useQuery<Incentive[]>({
    queryKey: ['incentives', startDate, endDate],
    queryFn: async () => {
      const res = await rdk.request(
        readItems('incentives', {
          fields: ['*', 'employee_id.*', 'employee_id.employee_category_id.*'],
          filter: {
            incentive_date: {
              _between: [startDate, endDate],
            },
          },
          sort: ['-incentive_date'],
          limit: -1,
        }),
      )
      return Array.isArray(res) ? (res as Incentive[]) : []
    },
  })

  // Fetch employees
  const { data: employees = [] } = useQuery<EmployeeOption[]>({
    queryKey: ['employees_for_incentives'],
    queryFn: async () => {
      const res = await rdk.request(
        readItems('employees', {
          fields: ['id', 'first_name', 'last_name', 'status'],
          filter: { status: { _nin: ['archived', 'suspended'] } },
          limit: -1,
        }),
      )
      const raw = Array.isArray(res) ? (res as any[]) : []
      return raw.filter((u: any) => { const st = (u.status || '').toLowerCase(); return st !== 'archived' && st !== 'suspended'; }) as EmployeeOption[]
    },
    staleTime: 5 * 60 * 1000,
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await rdk.request(deleteItem('incentives', id))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incentives'] })
      toast.success('Incentive deleted successfully')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete incentive')
    },
  })

  // Filtered
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return incentives
    return incentives.filter((i) => {
      const emp = `${i.employee_id?.first_name || ''} ${i.employee_id?.last_name || ''}`.toLowerCase()
      const t = i.incentive_title?.toLowerCase() || ''
      const r = i.incentive_remarks?.toLowerCase() || ''
      return emp.includes(q) || t.includes(q) || r.includes(q)
    })
  }, [incentives, search])

  // Total summary
  const totalAmount = useMemo(() => {
    return filtered.reduce((acc, curr) => acc + (Number(curr.incentive_amount) || 0), 0)
  }, [filtered])

  // Grouped by employee
  const grouped = useMemo(() => {
    const map = new Map<string, { employee: Incentive['employee_id']; total: number; count: number; items: Incentive[] }>()
    filtered.forEach((item) => {
      const empId = item.employee_id?.id || 'unknown'
      const existing = map.get(empId)
      const amt = Number(item.incentive_amount) || 0
      if (existing) {
        existing.total += amt
        existing.count += 1
        existing.items.push(item)
      } else {
        map.set(empId, {
          employee: item.employee_id,
          total: amt,
          count: 1,
          items: [item],
        })
      }
    })
    return Array.from(map.values())
  }, [filtered])

  const openCreate = () => {
    setEditingIncentive(null)
    setEmployeeId('')
    setTitle('')
    setAmount('')
    setIncentiveDate(todayStr)
    setRemarks('')
    setModalOpen(true)
  }

  const openEdit = (i: Incentive) => {
    setEditingIncentive(i)
    setEmployeeId(i.employee_id?.id || '')
    setTitle(i.incentive_title || '')
    setAmount(i.incentive_amount ?? '')
    setIncentiveDate(i.incentive_date || todayStr)
    setRemarks(i.incentive_remarks || '')
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!employeeId) {
      toast.error('Select an employee')
      return
    }
    if (!amount || Number(amount) <= 0) {
      toast.error('Enter a valid amount')
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        employee_id: employeeId,
        incentive_title: title.trim() || 'Performance Incentive',
        incentive_amount: Number(amount),
        incentive_date: incentiveDate,
        incentive_remarks: remarks.trim(),
      }

      if (editingIncentive) {
        await rdk.request(updateItem('incentives', editingIncentive.incentive_id, payload))
        toast.success('Incentive updated')
      } else {
        await rdk.request(createItem('incentives', payload))
        toast.success('Incentive added')
      }

      queryClient.invalidateQueries({ queryKey: ['incentives'] })
      setModalOpen(false)
    } catch (err: any) {
      toast.error(err.message || 'Operation failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Panel className="p-4 md:p-6 flex-1 flex flex-col gap-4 overflow-hidden">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Incentives</h1>
          <p className="text-sm text-muted-foreground">
            Manage performance bonuses, commission rewards, and sales incentives
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={openCreate} className="cursor-pointer gap-2">
            <Plus className="size-4" />
            <span>Add Incentive</span>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-card p-3 flex items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600">
            <IndianRupee className="size-4.5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Disbursed</p>
            <p className="text-lg font-bold text-foreground">
              ₹{totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3 flex items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <TrendingUp className="size-4.5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Payouts</p>
            <p className="text-lg font-bold text-foreground">{filtered.length}</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3 flex items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-500/10 text-blue-600">
            <Users className="size-4.5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Beneficiaries</p>
            <p className="text-lg font-bold text-foreground">{grouped.length}</p>
          </div>
        </div>
      </div>

      {/* Filters & Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border bg-muted p-0.5 text-xs">
            <button
              onClick={() => setViewTab('all')}
              className={`px-3 py-1 font-medium rounded transition-colors ${
                viewTab === 'all'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All Payouts
            </button>
            <button
              onClick={() => setViewTab('grouped')}
              className={`px-3 py-1 font-medium rounded transition-colors ${
                viewTab === 'grouped'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              By Employee
            </button>
          </div>

          <div className="relative max-w-xs flex-1">
            <Search className="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employee, title..."
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-card border border-border rounded-md px-2 py-1">
            <Calendar className="size-3.5" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-foreground outline-none text-xs"
            />
            <span>to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-foreground outline-none text-xs"
            />
          </div>
        </div>
      </div>

      {/* Table view */}
      <div className="flex-1 overflow-auto rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="h-48 flex items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
            <TrendingUp className="size-8 stroke-[1.5]" />
            <p>No incentive records found for selected period</p>
          </div>
        ) : viewTab === 'all' ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Title / Reason</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Remarks</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.incentive_id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <EmployeeAvatar
                        employeeId={item.employee_id?.id || ''}
                        name={`${item.employee_id?.first_name || ''} ${item.employee_id?.last_name || ''}`}
                        className="size-7"
                      />
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {item.employee_id?.first_name} {item.employee_id?.last_name}
                        </span>
                        {item.employee_id?.employee_category_id?.employee_category_name && (
                          <span className="text-[11px] text-muted-foreground">
                            {item.employee_id.employee_category_id.employee_category_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-xs">
                    {item.incentive_title || 'Incentive'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {item.incentive_date || '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                    {item.incentive_remarks || '—'}
                  </TableCell>
                  <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">
                    ₹{Number(item.incentive_amount || 0).toLocaleString('en-IN')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={() => openEdit(item)}
                      >
                        <Edit className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                        onClick={() => {
                          if (confirm('Delete this incentive?')) {
                            deleteMutation.mutate(item.incentive_id)
                          }
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Payout Count</TableHead>
                <TableHead className="text-right">Total Incentive</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grouped.map((g, idx) => (
                <TableRow key={g.employee?.id || idx}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <EmployeeAvatar
                        employeeId={g.employee?.id || ''}
                        name={`${g.employee?.first_name || ''} ${g.employee?.last_name || ''}`}
                        className="size-7"
                      />
                      <span className="font-medium">
                        {g.employee?.first_name} {g.employee?.last_name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{g.count} payouts</Badge>
                  </TableCell>
                  <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">
                    ₹{g.total.toLocaleString('en-IN')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingIncentive ? 'Edit Incentive' : 'Add Employee Incentive'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium">Select Employee *</label>
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                required
                className="h-9 rounded-md border border-border bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Choose an employee...</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.first_name} {e.last_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium">Incentive Title / Reason *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Sales Target Achievement, Diwali Bonus"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium">Amount (₹) *</label>
                <Input
                  type="number"
                  min="1"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="5000"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium">Date *</label>
                <Input
                  type="date"
                  value={incentiveDate}
                  onChange={(e) => setIncentiveDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium">Remarks</label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
                placeholder="Optional notes or reference..."
                className="rounded-md border border-border bg-card p-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <DialogFooter className="mt-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
                {editingIncentive ? 'Update' : 'Add Incentive'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Panel>
  )
}
