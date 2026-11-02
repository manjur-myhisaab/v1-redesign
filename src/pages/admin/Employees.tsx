import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import EmployeesGrid from '@/components/admin/EmployeesGrid'
import Panel from '@/components/admin/Panel'
import UpgradeModal from '@/components/admin/UpgradeModal'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

import { useShell } from '@/components/admin/shell-context'
import { useAuth } from '@/context/auth/AuthContext'
import { cn } from '@/lib/utils'
import { type Employee } from '@/lib/employees'
import { type ManagerOption } from '@/components/admin/EmployeesGrid'
import {
  listMembers,
  openDmForEmployee,
  setEmployeeSalary,
  type Member,
  type Paywall,
} from '@/lib/api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  useEmployeesQuery,
  useUpdateEmployeeMutation,
  useDeleteEmployeeMutation,
  resolveEmployeeRoles,
} from '@/features/employees/hooks/useEmployees'
import { Layers, Tag } from 'lucide-react'
import EmployeesMetrics from '@/features/employees/components/EmployeesMetrics'
import EmployeesToolbar, { type SortKey } from '@/features/employees/components/EmployeesToolbar'
import EmployeePreviewPanel from '@/features/employees/components/EmployeePreviewPanel'
import { useCategoriesQuery } from '@/features/categories/hooks/useCategories'


export default function Employees() {
  const { activeWorkspace } = useAuth()
  const wsId = activeWorkspace?.id ?? ''
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [msgBusy, setMsgBusy] = useState(false)
  const [msgError, setMsgError] = useState('')

  async function handleMessage(employeeId: string) {
    if (msgBusy) return
    setMsgBusy(true)
    setMsgError('')
    try {
      const { id } = await openDmForEmployee(employeeId)
      navigate(`/admin/messages?c=${id}`)
    } catch (e) {
      setMsgError((e as Error).message || 'This employee has no app account yet')
    } finally {
      setMsgBusy(false)
    }
  }

  // TanStack Queries & Mutations
  const { data: employees = [], isLoading } = useEmployeesQuery()
  const updateMutation = useUpdateEmployeeMutation()
  const deleteMutation = useDeleteEmployeeMutation()

  const salaryMutation = useMutation({
    mutationFn: ({ id, monthlyCtc, payBasis, effectivePeriod }: { id: string; monthlyCtc: number; payBasis: string; effectivePeriod: string }) =>
      setEmployeeSalary(id, { amount: monthlyCtc, basis: payBasis, effectivePeriod }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      toast.success('Salary updated successfully.')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update salary.')
    },
  })

  const [members, setMembers] = useState<Member[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Employee[]>([])
  const [clearToken, setClearToken] = useState(0)
  const [active, setActive] = useState<Employee | null>(null)
  const [closing, setClosing] = useState(false)
  const [paywall, setPaywall] = useState<Paywall | null>(null)
  const [paywallTrackId, setPaywallTrackId] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  // category state
  const { data: categories = [] } = useCategoriesQuery()
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<string>('all')

  // view controls
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const { firstTabActive } = useShell()

  // Load members
  useEffect(() => {
    if (wsId) listMembers(wsId).then(setMembers).catch(() => { })
  }, [wsId])

  // clear any prior "Message" error when the selected employee changes
  useEffect(() => {
    setMsgError('')
  }, [active?.id])

  // Helper function to resolve category & subcategory names from IDs and categories master list
  const resolveCategoryAndSubcategory = useCallback((emp: Employee) => {
    const rawU = emp.rawUser || emp.user || emp
    const rawCategories: any[] = Array.isArray(rawU.categories)
      ? rawU.categories
      : Array.isArray(emp.categoryIds)
        ? emp.categoryIds
        : []

    const categoryIdSet = new Set<string>()
    const subcategoryIdSet = new Set<string>()
    const directCatNames: string[] = []
    const directSubNames: string[] = []
    const categoryRulesMap = new Map<string, { category_id: string; sub_category_ids: string[] }>()

    rawCategories.forEach((item) => {
      if (typeof item === 'string' && item) {
        categoryIdSet.add(item)
        if (!categoryRulesMap.has(item)) {
          categoryRulesMap.set(item, { category_id: item, sub_category_ids: [] })
        }
      } else if (item && typeof item === 'object') {
        const cId = String(item.category_id || item.categoryId || item.id || '')
        if (cId) {
          categoryIdSet.add(cId)
          if (!categoryRulesMap.has(cId)) {
            categoryRulesMap.set(cId, { category_id: cId, sub_category_ids: [] })
          }
        }
        if (item.category_name || item.name) {
          directCatNames.push(String(item.category_name || item.name))
        }

        const rawSubs = item.sub_category_id ?? item.subcategory_id ?? item.sub_category_ids ?? item.subcategories
        const currentRuleSubs = cId && categoryRulesMap.get(cId) ? categoryRulesMap.get(cId)!.sub_category_ids : []
        if (Array.isArray(rawSubs)) {
          rawSubs.forEach((s) => {
            if (typeof s === 'string' && s) {
              subcategoryIdSet.add(s)
              if (!currentRuleSubs.includes(s)) currentRuleSubs.push(s)
            } else if (s && typeof s === 'object') {
              const sId = String(s.subcategory_id || s.sub_category_id || s.id || '')
              if (sId) {
                subcategoryIdSet.add(sId)
                if (!currentRuleSubs.includes(sId)) currentRuleSubs.push(sId)
              }
              if (s.subcategory_name || s.name) {
                directSubNames.push(String(s.subcategory_name || s.name))
              }
            }
          })
        } else if (typeof rawSubs === 'string' && rawSubs) {
          subcategoryIdSet.add(rawSubs)
          if (!currentRuleSubs.includes(rawSubs)) currentRuleSubs.push(rawSubs)
        }
      }
    })

    // Single ID fallbacks
    const singleCatId = emp.categoryId || rawU.category_id || rawU.categoryId || rawU.employee_category_id
    if (singleCatId) {
      const cStr = String(singleCatId)
      categoryIdSet.add(cStr)
      if (!categoryRulesMap.has(cStr)) {
        categoryRulesMap.set(cStr, { category_id: cStr, sub_category_ids: [] })
      }
    }

    const singleSubId = emp.subcategoryId || rawU.subcategory_id || rawU.sub_category_id || rawU.subcategoryId
    if (singleSubId) {
      const sStr = String(singleSubId)
      subcategoryIdSet.add(sStr)
      if (singleCatId && categoryRulesMap.has(String(singleCatId))) {
        const subs = categoryRulesMap.get(String(singleCatId))!.sub_category_ids
        if (!subs.includes(sStr)) subs.push(sStr)
      }
    }

    // Match with categories from API
    const matchedCategoryNames: string[] = []
    const matchedSubcategoryNames: string[] = []

    categoryIdSet.forEach((catId) => {
      const matched = categories.find((c) => String(c.category_id || (c as any).id || (c as any)._id) === catId)
      if (matched) {
        const name = matched.category_name || (matched as any).name
        if (name && !matchedCategoryNames.includes(name)) {
          matchedCategoryNames.push(name)
        }
      }
    })

    subcategoryIdSet.forEach((subId) => {
      let foundSubName = ''
      for (const cat of categories) {
        const subs = (cat as any).subCategoryName || (cat as any).subcategories || (cat as any).sub_categories || []
        const matchedSub = subs.find((s: any) => String(s.subcategory_id || s.sub_category_id || s.id || s._id) === subId)
        if (matchedSub) {
          foundSubName = matchedSub.subcategory_name || matchedSub.sub_category_name || matchedSub.name || ''
          break
        }
      }
      if (foundSubName && !matchedSubcategoryNames.includes(foundSubName)) {
        matchedSubcategoryNames.push(foundSubName)
      }
    })

    // Direct name fallbacks
    const fallbackCat = emp.category || rawU.category_name || rawU.category || directCatNames[0] || ''
    const fallbackSub = emp.subcategory || rawU.subcategory_name || rawU.sub_category_name || rawU.subcategory || directSubNames[0] || ''

    const resolvedCategory = matchedCategoryNames.length > 0 ? matchedCategoryNames.join(', ') : fallbackCat
    const resolvedSubcategory = matchedSubcategoryNames.length > 0 ? matchedSubcategoryNames.join(', ') : fallbackSub

    return {
      category: resolvedCategory,
      subcategory: resolvedSubcategory,
      categoryIds: Array.from(categoryIdSet),
      subcategoryIds: Array.from(subcategoryIdSet),
      categoryRules: Array.from(categoryRulesMap.values()),
    }
  }, [categories])

  // Resolve manager names and categories dynamically
  const employeesWithCategory = useMemo(() => {
    return employees.map((e) => {
      let managerName = ''
      if (e.managerId) {
        const mgr = employees.find((m) => m.id === e.managerId)
        if (mgr) {
          managerName = mgr.name
        } else {
          const mem = members.find((m) => m.userId === e.managerId)
          if (mem) {
            managerName = mem.name || mem.phone
          }
        }
      }

      const { category, subcategory, categoryIds, subcategoryIds, categoryRules } = resolveCategoryAndSubcategory(e)
      const role = resolveEmployeeRoles(e.rawFirm || e.firm || e, e.rawUser || e.user || e, e.rawRoles || e.roles) || e.role

      return {
        ...e,
        role,
        managerName,
        category,
        subcategory,
        categoryIds,
        subcategoryIds,
        categoryRules,
        categoryId: categoryIds[0] || e.categoryId,
        subcategoryId: subcategoryIds[0] || e.subcategoryId,
      }
    })
  }, [employees, members, resolveCategoryAndSubcategory])

  const activeEmployee = useMemo(() => {
    if (!active) return null
    return employeesWithCategory.find((e) => e.id === active.id) ?? active
  }, [active, employeesWithCategory])

  // summary metrics computed client-side
  const metrics = useMemo(() => {
    const total = employees.length
    const activeCount = employees.filter((e) => e.status === 'Active').length
    const onNotice = employees.filter((e) => e.status === 'On Notice').length
    const archived = employees.filter((e) => e.status === 'Inactive').length
    return { total, active: activeCount, onNotice, archived }
  }, [employees])

  // distinct department names for the Department combobox
  const departmentOptions = useMemo(
    () => [...new Set(employees.map((e) => e.department).filter(Boolean))].sort(),
    [employees],
  )

  // manager options mapping
  const managerOptions = useMemo<ManagerOption[]>(
    () => [
      ...members.map((m) => ({
        name: m.name || m.phone,
        kind: 'member' as const,
        userId: m.userId,
        role: m.role,
      })),
      ...employees.map((e) => ({
        name: e.name,
        kind: 'employee' as const,
        employeeId: e.id,
      })),
    ],
    [members, employees],
  )

  // Esc closes the side profile panel
  useEffect(() => {
    if (!active || closing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setClosing(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, closing])

  const rows: Employee[] = useMemo(() => {
    const q = query.toLowerCase()
    let base: Employee[] = employeesWithCategory
    let out: Employee[] = base.filter((e) => {
      const matchesQuery =
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.phone.toLowerCase().includes(q) ||
        (e.role && e.role.toLowerCase().includes(q)) ||
        (e.category && e.category.toLowerCase().includes(q)) ||
        (e.subcategory && e.subcategory.toLowerCase().includes(q))

      const matchesStatus = statusFilter.size === 0 || statusFilter.has(e.status)

      const matchesCategory =
        selectedCategoryTab === 'all' ||
        e.categoryId === selectedCategoryTab ||
        e.categoryIds?.includes(selectedCategoryTab) ||
        e.rawUser?.category_id === selectedCategoryTab ||
        (e.category && e.category.toLowerCase() === selectedCategoryTab.toLowerCase()) ||
        (e.category &&
          categories.find((c) => (c.category_id || (c as any).id) === selectedCategoryTab)?.category_name?.toLowerCase() ===
          e.category.toLowerCase())

      return matchesQuery && matchesStatus && matchesCategory
    })

    if (sortKey) {
      const dir = sortDir === 'asc' ? 1 : -1
      out = [...out].sort(
        (a, b) => String(a[sortKey]).localeCompare(String(b[sortKey])) * dir,
      )
    }
    return out
  }, [employeesWithCategory, query, statusFilter, selectedCategoryTab, categories, sortKey, sortDir])

  const handleEdit = (
    id: string,
    field: Exclude<keyof Employee, 'status'>,
    value: string,
  ) => {
    let payload: any = { user_id: id }
    if (field === 'empCode') {
      payload.employee_code = value.trim()
    } else if (field === 'name') {
      const parts = value.trim().split(' ')
      payload.first_name = parts[0] || ''
      payload.last_name = parts.slice(1).join(' ') || ''
    } else if (field === 'email') {
      payload.employee_email_address = value.trim()
    } else if (field === 'phone') {
      payload.mobile_number = value.trim()
    } else if (field === 'department') {
      payload.department_name = value.trim()
    } else if (field === 'role') {
      payload.role = value.split(',').map((r) => r.trim().toUpperCase())
    } else if (field === 'gender') {
      payload.gender = value === 'man' ? 'Male' : value === 'woman' ? 'Female' : ''
    } else if (field === 'joined') {
      const d = new Date(value)
      payload.doj = isNaN(d.getTime()) ? null : d.toISOString()
    }

    updateMutation.mutate(payload)
  }

  const handleCategoryChange = (
    id: string,
    categoriesData: { category_id: string; sub_category_ids: string[] }[]
  ) => {
    const valid = categoriesData.filter((c) => c.category_id)
    const catPayload = valid.map((c) => ({
      category_id: c.category_id,
      sub_category_ids: c.sub_category_ids || [],
      sub_category_id: c.sub_category_ids || [],
    }))

    updateMutation.mutate({
      user_id: id,
      categories: catPayload,
      category_id: catPayload[0]?.category_id || null,
      sub_category_id: catPayload[0]?.sub_category_ids?.[0] || null,
    })
  }

  const handleStatusChange = (id: string, status: string) => {
    updateMutation.mutate({
      user_id: id,
      inactive_date: status === 'Inactive' ? new Date().toISOString() : null,
    })
  }

  const handleTrackingChange = (id: string, next: boolean) => {
    updateMutation.mutate(
      { user_id: id, live_tracking: next },
      {
        onError: (err) => {
          const e = err as Error & { status?: number; payload?: { paywall?: Paywall } }
          if (e.status === 402 && e.payload?.paywall) {
            setPaywallTrackId(id)
            setPaywall(e.payload.paywall)
          }
        },
      }
    )
  }

  const handleManagerChange = (
    id: string,
    { managerId, managerUserId }: { managerId: string | null; managerUserId: string | null },
  ) => {
    const targetManagerId = managerId || managerUserId
    updateMutation.mutate({
      user_id: id,
      supervisor_id: targetManagerId,
    })
  }

  const handleSalaryChange = (
    id: string,
    { monthlyCtc, payBasis, effectivePeriod }: { monthlyCtc: number; payBasis: string; effectivePeriod: string },
  ) => {
    salaryMutation.mutate({ id, monthlyCtc, payBasis, effectivePeriod })
  }

  const handleAddRow = () => {
    navigate('/admin/employees/new')
  }

  const clearSelection = () => {
    setSelected([])
    setClearToken((t) => t + 1)
  }

  const handleBulkDelete = async () => {
    if (bulkBusy || selected.length === 0) return
    setBulkBusy(true)
    const ids = selected.map((e) => e.id)
    try {
      await deleteMutation.mutateAsync(ids)
      if (active && ids.includes(active.id)) setActive(null)
      clearSelection()
    } catch (err) {
      console.error('Failed to delete employees in bulk:', err)
    } finally {
      setBulkBusy(false)
      setDeleteConfirmOpen(false)
    }
  }

  const handleBulkStatus = async (status: string) => {
    if (bulkBusy || selected.length === 0) return
    setBulkBusy(true)
    const ids = selected.map((e) => e.id)
    try {
      await Promise.all(
        ids.map((id) =>
          updateMutation.mutateAsync({
            user_id: id,
            inactive_date: status === 'Inactive' ? new Date().toISOString() : null,
          })
        )
      )
      clearSelection()
    } catch (err) {
      console.error('Failed to update status in bulk:', err)
    } finally {
      setBulkBusy(false)
    }
  }

  const resetView = () => {
    setQuery('')
    setStatusFilter(new Set())
    setSortKey(null)
    setSortDir('asc')
  }

  return (
    <div className="flex min-w-0 flex-1 gap-2">
      {/* center: list */}
      <Panel
        className={cn(
          'flex min-w-0 flex-1 flex-col',
          firstTabActive && 'rounded-tl-none',
        )}
      >
        {/* summary metrics */}
        <EmployeesMetrics metrics={metrics} />

        {/* Category Tabs */}
        {categories.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border px-3 py-2 bg-muted/20 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCategoryTab('all')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer border shrink-0',
                selectedCategoryTab === 'all'
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted/80'
              )}
            >
              <Layers className="size-3.5" />
              <span>All</span>
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                  selectedCategoryTab === 'all'
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {employeesWithCategory.length}
              </span>
            </button>

            {categories.map((cat) => {
              const catId = cat.category_id || (cat as any).id || ''
              const catName = cat.category_name || (cat as any).name || 'Unnamed Category'
              const count = employeesWithCategory.filter(
                (e) =>
                  e.categoryId === catId ||
                  e.categoryIds?.includes(catId) ||
                  e.rawUser?.category_id === catId ||
                  (e.category && e.category.toLowerCase() === catName.toLowerCase())
              ).length
              const isSelected = selectedCategoryTab === catId || selectedCategoryTab.toLowerCase() === catName.toLowerCase()

              return (
                <button
                  key={catId}
                  type="button"
                  onClick={() => setSelectedCategoryTab(catId)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap border shrink-0',
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                      : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted/80'
                  )}
                >
                  <Tag className="size-3" />
                  <span>{catName}</span>
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                      isSelected
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* toolbar — swaps to a bulk-action bar when rows are selected */}
        <EmployeesToolbar
          selectedCount={selected.length}
          totalCount={employees.length}
          query={query}
          setQuery={setQuery}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          sortKey={sortKey}
          setSortKey={setSortKey}
          sortDir={sortDir}
          setSortDir={setSortDir}
          bulkBusy={bulkBusy}
          onBulkStatus={handleBulkStatus}
          onBulkDelete={() => setDeleteConfirmOpen(true)}
          onAddRow={handleAddRow}
          onResetView={resetView}
          clearSelection={clearSelection}
        />

        {/* spreadsheet grid */}
        <div className="min-h-0 flex-1 border-t border-border">
          {isLoading ? (
            <div className="grid h-full place-items-center text-[13px] text-muted-foreground">
              Loading employees…
            </div>
          ) : (
            <EmployeesGrid
              rows={rows}
              categories={categories}
              onEdit={handleEdit}
              onCategoryChange={handleCategoryChange}
              onStatusChange={handleStatusChange}
              onManagerChange={handleManagerChange}
              onSalaryChange={handleSalaryChange}
              managerOptions={managerOptions}
              departmentOptions={departmentOptions}
              onSelectionChange={setSelected}
              clearSelectionToken={clearToken}
              onOpenProfile={(e) => {
                setActive(e)
                setClosing(false)
              }}
              onActiveRowChange={(e) => {
                // follow the active cell's row only while the panel is open
                if (e && active && !closing) setActive(e)
              }}
              onAddRow={handleAddRow}
            />
          )}
        </div>
      </Panel>

      {/* right: preview of selected employee — opens on click */}
      {activeEmployee && (
        <EmployeePreviewPanel
          activeEmployee={activeEmployee}
          closing={closing}
          onClose={() => setClosing(true)}
          onAnimationEnd={() => {
            if (closing) {
              setActive(null)
              setClosing(false)
            }
          }}
          onTrackingChange={handleTrackingChange}
          msgError={msgError}
          msgBusy={msgBusy}
          onMessage={handleMessage}
        />
      )}

      {paywall && (
        <UpgradeModal
          workspaceId={wsId}
          workspaceName={activeWorkspace?.name}
          paywall={paywall}
          onClose={() => {
            setPaywall(null)
            setPaywallTrackId(null)
          }}
          onSuccess={() => {
            setPaywall(null)
            const trackId = paywallTrackId
            setPaywallTrackId(null)
            if (trackId) handleTrackingChange(trackId, true)
            else handleAddRow()
          }}
        />
      )}

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              selected {selected.length} employee(s) and remove their data from
              our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleBulkDelete()
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
