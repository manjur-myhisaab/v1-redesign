import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Tag,
  Plus,
  Pencil,
  Trash2,
  Search,
  Check,
  X,
  Loader2,
  Users,
  RefreshCw,
  FolderPlus,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
} from 'lucide-react'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useResizableColumns, ColumnResizer } from '@/hooks/useResizableColumns'

import rdk, {
  createItem,
  deleteItems,
  readItems,
  updateItem,
  customEndpoint,
} from '@/services/server'
import { useShell } from '@/components/admin/shell-context'
import Panel from '@/components/admin/Panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { cn } from '@/lib/utils'

interface CategoryItem {
  employee_category_id: number | string
  employee_category_name: string
  status?: string
  date_created?: string
  [key: string]: any
}

interface UserSummary {
  id: string
  first_name: string
  last_name: string
  email?: string
  title?: string
  employee_category_id?: {
    employee_category_id: number | string
    employee_category_name: string
  } | number | string | null
  status?: string
}

export default function EmployeeCategoryPage() {
  const { firstTabActive } = useShell()
  const queryClient = useQueryClient()

  // Search & Status filters for Left Table
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'active' | 'draft'>('all')
  const [filterStaffCount, setFilterStaffCount] = useState<'all' | 'with-staff' | 'empty'>('all')
  const [sortSelected, setSortSelected] = useState<string>('name asc')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)
  const [sortPopoverOpen, setSortPopoverOpen] = useState(false)

  // Resizable columns
  const { colWidths, startResizing, isResizing, canSort } = useResizableColumns(
    {
      name: 240,
      status: 120,
      staff: 140,
      actions: 100,
    },
    { storageKey: 'categories_table_widths', minWidth: 80 },
  )

  // Selection state
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false)

  // Selected Category for Right Panel Form
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null)
  const [formCategoryName, setFormCategoryName] = useState('')
  const [formStatus, setFormStatus] = useState<string>('active')
  const [rightPanelTab, setRightPanelTab] = useState<'details' | 'assign'>('details')

  // Assign staff tab state
  const [assignSearch, setAssignSearch] = useState('')
  const [assignedUserIds, setAssignedUserIds] = useState<Set<string>>(new Set())

  // Delete modal state
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryItem | null>(null)

  // 1. Fetch Categories from Directus
  const {
    data: categories = [],
    isLoading: isCategoriesLoading,
    isFetching: isCategoriesFetching,
    refetch: refetchCategories,
  } = useQuery<CategoryItem[]>({
    queryKey: ['employee_categories'],
    queryFn: async () => {
      const res: any = await rdk.request(
        readItems('employee_category', {
          sort: ['employee_category_name'],
          limit: -1,
        }),
      )
      const raw = Array.isArray(res) ? res : res?.data || []
      return raw.filter((u: any) => { const st = (u.status || '').toLowerCase(); return st !== 'archived' && st !== 'suspended'; })
    },
  })

  // 2. Fetch Users to compute staff count per category & for assignment
  const {
    data: users = [],
    isLoading: isUsersLoading,
    refetch: refetchUsers,
  } = useQuery<UserSummary[]>({
    queryKey: ['firm_users_category_counts'],
    queryFn: async () => {
      const res: any = await rdk.request(
        customEndpoint({
          path: 'users',
          method: 'GET',
          params: {
            limit: -1,
            fields: ['id', 'first_name', 'last_name', 'email', 'title', 'employee_category_id.*', 'status'],
          },
        }),
      )
      return Array.isArray(res) ? res : res?.data || []
    },
  })

  // Compute staff count per category
  const categoryStaffCounts = useMemo(() => {
    const map = new Map<string, number>()
    users.forEach((u) => {
      const catId =
        typeof u.employee_category_id === 'object' && u.employee_category_id !== null
          ? String((u.employee_category_id as any).employee_category_id)
          : u.employee_category_id
          ? String(u.employee_category_id)
          : null
      if (catId) {
        map.set(catId, (map.get(catId) || 0) + 1)
      }
    })
    return map
  }, [users])

  // Select category to edit
  const handleSelectCategoryToEdit = (cat: CategoryItem) => {
    setEditingCategory(cat)
    setFormCategoryName(cat.employee_category_name || '')
    setFormStatus(cat.status || 'active')

    // Pre-populate assigned users for this category
    const catIdStr = String(cat.employee_category_id)
    const existingUserIds = new Set<string>()
    users.forEach((u) => {
      const userCatId =
        typeof u.employee_category_id === 'object' && u.employee_category_id !== null
          ? String((u.employee_category_id as any).employee_category_id)
          : u.employee_category_id
          ? String(u.employee_category_id)
          : null
      if (userCatId === catIdStr) {
        existingUserIds.add(u.id)
      }
    })
    setAssignedUserIds(existingUserIds)
  }

  // Reset right form to Create New mode
  const handleResetFormToCreate = () => {
    setEditingCategory(null)
    setFormCategoryName('')
    setFormStatus('active')
    setAssignedUserIds(new Set())
    setRightPanelTab('details')
  }

  // 3. Create Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: { employee_category_name: string; status: string }) => {
      return await rdk.request(createItem('employee_category', payload))
    },
    onSuccess: (newCat: any) => {
      toast.success('Category created successfully')
      queryClient.invalidateQueries({ queryKey: ['employee_categories'] })
      queryClient.invalidateQueries({ queryKey: ['firm_users_category_counts'] })
      handleResetFormToCreate()
      if (newCat) {
        handleSelectCategoryToEdit(newCat)
      }
    },
    onError: (err: any) => {
      console.error('Failed to create category:', err)
      toast.error(err?.message || 'Failed to create category')
    },
  })

  // 4. Update Mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: {
      id: number | string
      employee_category_name: string
      status: string
    }) => {
      return await rdk.request(updateItem('employee_category', id as any, payload))
    },
    onSuccess: () => {
      toast.success('Category updated successfully')
      queryClient.invalidateQueries({ queryKey: ['employee_categories'] })
      queryClient.invalidateQueries({ queryKey: ['firm_users_category_counts'] })
    },
    onError: (err: any) => {
      console.error('Failed to update category:', err)
      toast.error(err?.message || 'Failed to update category')
    },
  })

  // 5. Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number | string) => {
      return await rdk.request(deleteItems('employee_category', [id] as any))
    },
    onSuccess: () => {
      toast.success('Category deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['employee_categories'] })
      queryClient.invalidateQueries({ queryKey: ['firm_users_category_counts'] })
      if (editingCategory?.employee_category_id === categoryToDelete?.employee_category_id) {
        handleResetFormToCreate()
      }
      setCategoryToDelete(null)
    },
    onError: (err: any) => {
      console.error('Failed to delete category:', err)
      toast.error(err?.message || 'Failed to delete category')
    },
  })

  // Bulk Delete Mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return await rdk.request(deleteItems('employee_category', ids as any))
    },
    onSuccess: () => {
      toast.success(`Deleted ${selectedCategoryIds.length} categories successfully`)
      queryClient.invalidateQueries({ queryKey: ['employee_categories'] })
      queryClient.invalidateQueries({ queryKey: ['firm_users_category_counts'] })
      setSelectedCategoryIds([])
      setBulkDeleteModalOpen(false)
      handleResetFormToCreate()
    },
    onError: (err: any) => {
      console.error('Failed to bulk delete categories:', err)
      toast.error(err?.message || 'Failed to delete categories')
    },
  })

  // 6. Assign Staff Mutation
  const assignStaffMutation = useMutation({
    mutationFn: async ({
      targetCategoryId,
      selectedIds,
    }: {
      targetCategoryId: number | string | null
      selectedIds: string[]
    }) => {
      // Find users currently in this category
      const catIdStr = String(targetCategoryId)
      const currentlyAssigned = new Set<string>()
      users.forEach((u) => {
        const userCatId =
          typeof u.employee_category_id === 'object' && u.employee_category_id !== null
            ? String((u.employee_category_id as any).employee_category_id)
            : u.employee_category_id
            ? String(u.employee_category_id)
            : null
        if (userCatId === catIdStr) {
          currentlyAssigned.add(u.id)
        }
      })

      const promises: Promise<any>[] = []

      // 1. Assign selected users
      selectedIds.forEach((id) => {
        if (!currentlyAssigned.has(id)) {
          promises.push(
            rdk.request(
              customEndpoint({
                path: `users/${id}`,
                method: 'PATCH',
                body: JSON.stringify({ employee_category_id: targetCategoryId }),
              }),
            ),
          )
        }
      })

      // 2. Unassign unselected users who were previously assigned
      currentlyAssigned.forEach((id) => {
        if (!selectedIds.includes(id)) {
          promises.push(
            rdk.request(
              customEndpoint({
                path: `users/${id}`,
                method: 'PATCH',
                body: JSON.stringify({ employee_category_id: null }),
              }),
            ),
          )
        }
      })

      return await Promise.all(promises)
    },
    onSuccess: () => {
      toast.success('Staff category assignments updated successfully')
      queryClient.invalidateQueries({ queryKey: ['firm_users_category_counts'] })
    },
    onError: (err: any) => {
      console.error('Failed to assign staff:', err)
      toast.error('Failed to update employee category assignments')
    },
  })

  // Form Submit Handler
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = formCategoryName.trim()
    if (!trimmed) {
      toast.error('Category name is required')
      return
    }

    if (editingCategory) {
      updateMutation.mutate({
        id: editingCategory.employee_category_id,
        employee_category_name: trimmed,
        status: formStatus,
      })
    } else {
      createMutation.mutate({
        employee_category_name: trimmed,
        status: formStatus,
      })
    }
  }

  // Active filter count & reset
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (selectedStatusFilter !== 'all') count++
    if (filterStaffCount !== 'all') count++
    return count
  }, [selectedStatusFilter, filterStaffCount])

  const handleResetFilters = () => {
    setSelectedStatusFilter('all')
    setFilterStaffCount('all')
    setCurrentPage(1)
  }

  // Toggle column sort
  const handleSortToggle = (columnKey: 'name' | 'staff' | 'status') => {
    if (!canSort()) return
    const [currentKey, currentDir] = sortSelected.split(' ')
    if (currentKey === columnKey) {
      setSortSelected(`${columnKey} ${currentDir === 'asc' ? 'desc' : 'asc'}`)
    } else {
      setSortSelected(`${columnKey} asc`)
    }
    setCurrentPage(1)
  }

  // Filtered & Sorted categories for left table
  const filteredAndSortedCategories = useMemo(() => {
    const result = categories.filter((cat) => {
      const matchesSearch =
        !searchQuery ||
        cat.employee_category_name.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus =
        selectedStatusFilter === 'all' ||
        (selectedStatusFilter === 'active' && (cat.status === 'active' || !cat.status)) ||
        (selectedStatusFilter === 'draft' && cat.status === 'draft')

      const staffCount = categoryStaffCounts.get(String(cat.employee_category_id)) || 0
      const matchesStaff =
        filterStaffCount === 'all' ||
        (filterStaffCount === 'with-staff' && staffCount > 0) ||
        (filterStaffCount === 'empty' && staffCount === 0)

      return matchesSearch && matchesStatus && matchesStaff
    })

    const [sortKey, sortDir] = sortSelected.split(' ')
    result.sort((a, b) => {
      if (sortKey === 'name') {
        const nameA = (a.employee_category_name || '').toLowerCase()
        const nameB = (b.employee_category_name || '').toLowerCase()
        return sortDir === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA)
      } else if (sortKey === 'staff') {
        const countA = categoryStaffCounts.get(String(a.employee_category_id)) || 0
        const countB = categoryStaffCounts.get(String(b.employee_category_id)) || 0
        return sortDir === 'asc' ? countA - countB : countB - countA
      } else if (sortKey === 'status') {
        const statA = (a.status || 'active').toLowerCase()
        const statB = (b.status || 'active').toLowerCase()
        return sortDir === 'asc' ? statA.localeCompare(statB) : statB.localeCompare(statA)
      }
      return 0
    })

    return result
  }, [categories, searchQuery, selectedStatusFilter, filterStaffCount, sortSelected, categoryStaffCounts])

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedCategories.length / itemsPerPage) || 1
  const paginatedCategories = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredAndSortedCategories.slice(start, start + itemsPerPage)
  }, [filteredAndSortedCategories, currentPage, itemsPerPage])

  // Bulk Selection Handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCategoryIds(
        filteredAndSortedCategories.map((c) => String(c.employee_category_id)),
      )
    } else {
      setSelectedCategoryIds([])
    }
  }

  const handleToggleSelectOne = (id: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  // Filtered users for Assign Staff tab
  const filteredUsersForAssign = useMemo(() => {
    if (!assignSearch) return users
    const q = assignSearch.toLowerCase()
    return users.filter(
      (u) =>
        `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.title || '').toLowerCase().includes(q),
    )
  }, [users, assignSearch])

  const toggleUserAssignment = (userId: string) => {
    setAssignedUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const isFormSaving = createMutation.isPending || updateMutation.isPending

  return (
    <div className="flex h-full min-w-0 flex-1 gap-2 p-0 overflow-hidden">
      {/* ── LEFT SIDE: Category List & Table ── */}
      <Panel
        className={cn(
          'flex flex-1 flex-col min-w-0 h-full overflow-hidden',
          firstTabActive && 'rounded-tl-none',
        )}
      >
        {/* Header Toolbar */}
        <div className="border-b border-border p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-card/60 backdrop-blur-sm shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                <Tag className="size-4" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Employee Categories
              </h1>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {categories.length} Total
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Organize employees by functional departments, roles, or cost centers.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchCategories()
                refetchUsers()
              }}
              className="h-8 gap-1.5 text-xs cursor-pointer"
              title="Refresh categories"
            >
              <RefreshCw
                className={cn('size-3.5', isCategoriesFetching && 'animate-spin text-primary')}
              />
              <span className="hidden sm:inline">Refresh</span>
            </Button>

            <Button
              size="sm"
              onClick={handleResetFormToCreate}
              className="h-8 gap-1.5 text-xs font-semibold cursor-pointer shadow-xs"
            >
              <Plus className="size-3.5" />
              <span>New Category</span>
            </Button>
          </div>
        </div>

        {/* Toolbar: Bulk Selection Bar OR (Status Tabs + Search + Filter + Sort + Refresh) */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 bg-card shrink-0">
          {selectedCategoryIds.length > 0 ? (
            /* Bulk selection toolbar */
            <div className="flex items-center gap-2 w-full">
              <button
                type="button"
                onClick={() => setSelectedCategoryIds([])}
                className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Clear selection"
              >
                <X className="size-3.5" />
              </button>
              <span className="text-[13px] font-medium text-primary">
                {selectedCategoryIds.length} categories selected
              </span>

              <div className="ml-auto flex items-center gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setBulkDeleteModalOpen(true)}
                  className="h-7 text-xs gap-1.5 cursor-pointer shadow-xs"
                >
                  <Trash2 className="size-3.5" />
                  Delete Selected
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedCategoryIds([])}
                  className="h-7 text-xs cursor-pointer text-muted-foreground hover:text-foreground"
                >
                  Clear
                </Button>
              </div>
            </div>
          ) : (
            /* Normal Toolbar */
            <>
              {/* Status Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                {[
                  { id: 'all', label: 'All', count: categories.length },
                  {
                    id: 'active',
                    label: 'Active',
                    count: categories.filter((c) => c.status === 'active' || !c.status).length,
                  },
                  {
                    id: 'draft',
                    label: 'Draft',
                    count: categories.filter((c) => c.status === 'draft').length,
                  },
                ].map((tab) => {
                  const isSelected = selectedStatusFilter === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setSelectedStatusFilter(tab.id as any)
                        setCurrentPage(1)
                      }}
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer border shrink-0',
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                          : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted/80',
                      )}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={cn(
                          'rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                          isSelected
                            ? 'bg-primary-foreground/20 text-primary-foreground'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {tab.count}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Search, Filter, Sort, Refresh */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[170px] sm:w-52">
                  <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search categories..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setCurrentPage(1)
                    }}
                    className="h-7.5 pl-8 pr-7 text-xs bg-muted/30 focus-visible:bg-background rounded-lg"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>

                {/* Filter Popover */}
                <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-md transition-colors cursor-pointer border border-transparent h-7.5',
                        activeFilterCount > 0 &&
                          'text-primary font-semibold border-primary/20 bg-primary/5',
                      )}
                    >
                      <Filter className="size-3.5" />
                      <span>Filter</span>
                      {activeFilterCount > 0 && (
                        <span className="grid size-4 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                          {activeFilterCount}
                        </span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-68 p-3.5 space-y-3 shadow-lg">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <p className="text-xs font-bold text-foreground">Filter Categories</p>
                      {activeFilterCount > 0 && (
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                        >
                          Reset all
                        </button>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">
                        Status
                      </label>
                      <Select
                        value={selectedStatusFilter}
                        onValueChange={(val: any) => {
                          setSelectedStatusFilter(val)
                          setCurrentPage(1)
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          <SelectItem value="active">Active Only</SelectItem>
                          <SelectItem value="draft">Draft Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">
                        Staff Members
                      </label>
                      <Select
                        value={filterStaffCount}
                        onValueChange={(val: any) => {
                          setFilterStaffCount(val)
                          setCurrentPage(1)
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          <SelectItem value="with-staff">With Staff Members</SelectItem>
                          <SelectItem value="empty">Without Staff (Empty)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Sort Popover */}
                <Popover open={sortPopoverOpen} onOpenChange={setSortPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-md transition-colors cursor-pointer border border-transparent h-7.5"
                    >
                      <ArrowUpDown className="size-3.5 text-muted-foreground" />
                      <span>Sort</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-56 p-1.5 shadow-lg">
                    <div className="p-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      Sort Categories By
                    </div>
                    {[
                      { key: 'name asc', label: 'Category Name: A to Z' },
                      { key: 'name desc', label: 'Category Name: Z to A' },
                      { key: 'staff desc', label: 'Staff Count: High to Low' },
                      { key: 'staff asc', label: 'Staff Count: Low to High' },
                      { key: 'status asc', label: 'Status: Active First' },
                      { key: 'status desc', label: 'Status: Draft First' },
                    ].map((opt) => {
                      const isSelected = sortSelected === opt.key
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => {
                            setSortSelected(opt.key)
                            setSortPopoverOpen(false)
                          }}
                          className={cn(
                            'flex w-full items-center justify-between px-2.5 py-1.5 text-xs rounded-md cursor-pointer transition-colors text-left',
                            isSelected
                              ? 'bg-primary/10 text-primary font-semibold'
                              : 'text-foreground hover:bg-muted',
                          )}
                        >
                          <span>{opt.label}</span>
                          {isSelected && <Check className="size-3.5 text-primary" />}
                        </button>
                      )
                    })}
                  </PopoverContent>
                </Popover>

                {/* Refresh */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    refetchCategories()
                    refetchUsers()
                  }}
                  className="size-7 cursor-pointer text-muted-foreground hover:text-foreground rounded-md"
                  title="Refresh categories"
                >
                  <RefreshCw
                    className={cn('size-3.5', isCategoriesFetching && 'animate-spin text-primary')}
                  />
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Categories Table Container */}
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full border-separate border-spacing-0 text-left text-xs">
            <thead className="sticky top-0 z-20 bg-card shadow-2xs">
              <tr className="text-muted-foreground font-semibold">
                {/* Sticky Checkbox */}
                <th className="sticky left-0 top-0 z-30 bg-card py-2.5 px-3 w-10 text-center border-t border-b border-l border-r border-gray-200 dark:border-border shadow-[1px_0_0_0_rgba(0,0,0,0.06)]">
                  <Checkbox
                    checked={
                      filteredAndSortedCategories.length > 0 &&
                      selectedCategoryIds.length === filteredAndSortedCategories.length
                    }
                    onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
                  />
                </th>
                <th
                  onClick={() => handleSortToggle('name')}
                  style={{ width: colWidths.name, minWidth: colWidths.name }}
                  className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border cursor-pointer select-none hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-1.5 pr-2">
                    <span>CATEGORY NAME</span>
                    {sortSelected.startsWith('name') ? (
                      sortSelected.endsWith('asc') ? (
                        <ArrowUp className="size-3 text-primary" />
                      ) : (
                        <ArrowDown className="size-3 text-primary" />
                      )
                    ) : (
                      <ArrowUpDown className="size-3 text-muted-foreground/40" />
                    )}
                  </div>
                  <ColumnResizer
                    isResizing={isResizing === 'name'}
                    onMouseDown={(e) => startResizing('name', e)}
                  />
                </th>
                <th
                  onClick={() => handleSortToggle('status')}
                  style={{ width: colWidths.status, minWidth: colWidths.status }}
                  className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border cursor-pointer select-none hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-1.5 pr-2">
                    <span>STATUS</span>
                    {sortSelected.startsWith('status') ? (
                      sortSelected.endsWith('asc') ? (
                        <ArrowUp className="size-3 text-primary" />
                      ) : (
                        <ArrowDown className="size-3 text-primary" />
                      )
                    ) : (
                      <ArrowUpDown className="size-3 text-muted-foreground/40" />
                    )}
                  </div>
                  <ColumnResizer
                    isResizing={isResizing === 'status'}
                    onMouseDown={(e) => startResizing('status', e)}
                  />
                </th>
                <th
                  onClick={() => handleSortToggle('staff')}
                  style={{ width: colWidths.staff, minWidth: colWidths.staff }}
                  className="relative py-2.5 px-3 border-t border-b border-r border-gray-200 dark:border-border cursor-pointer select-none hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-1.5 pr-2">
                    <span>STAFF MEMBERS</span>
                    {sortSelected.startsWith('staff') ? (
                      sortSelected.endsWith('asc') ? (
                        <ArrowUp className="size-3 text-primary" />
                      ) : (
                        <ArrowDown className="size-3 text-primary" />
                      )
                    ) : (
                      <ArrowUpDown className="size-3 text-muted-foreground/40" />
                    )}
                  </div>
                  <ColumnResizer
                    isResizing={isResizing === 'staff'}
                    onMouseDown={(e) => startResizing('staff', e)}
                  />
                </th>
                <th
                  style={{ width: colWidths.actions, minWidth: colWidths.actions }}
                  className="py-2.5 px-3 text-right border-t border-b border-r border-gray-200 dark:border-border"
                >
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody>
              {isCategoriesLoading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-16 text-center text-muted-foreground border-b border-l border-r border-gray-200 dark:border-border"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="size-6 animate-spin text-primary" />
                      <p className="text-sm font-medium">Loading categories...</p>
                    </div>
                  </td>
                </tr>
              ) : paginatedCategories.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-16 text-center text-muted-foreground border-b border-l border-r border-gray-200 dark:border-border"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Tag className="size-8 text-muted-foreground/40" />
                      <p className="text-sm font-medium">No categories found</p>
                      <p className="text-xs text-muted-foreground">
                        {searchQuery
                          ? 'Try modifying your search or filter criteria'
                          : 'Create your first category using the form on the right.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedCategories.map((cat) => {
                  const isBeingEdited =
                    editingCategory?.employee_category_id === cat.employee_category_id
                  const isChecked = selectedCategoryIds.includes(String(cat.employee_category_id))
                  const staffCount =
                    categoryStaffCounts.get(String(cat.employee_category_id)) || 0
                  const isDraft = cat.status === 'draft'

                  return (
                    <tr
                      key={cat.employee_category_id}
                      onClick={() => handleSelectCategoryToEdit(cat)}
                      className={cn(
                        'group transition-colors cursor-pointer hover:bg-muted/40',
                        isBeingEdited && 'bg-primary/10',
                        isChecked && 'bg-primary/5',
                      )}
                    >
                      {/* Checkbox (Sticky Left) */}
                      <td
                        className={cn(
                          'sticky left-0 z-10 py-2.5 px-3 text-center border-b border-l border-r border-gray-200 dark:border-border transition-colors shadow-[1px_0_0_0_rgba(0,0,0,0.06)]',
                          isBeingEdited
                            ? 'bg-primary/10'
                            : isChecked
                              ? 'bg-primary/5'
                              : 'bg-card group-hover:bg-muted/40',
                        )}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleSelectOne(String(cat.employee_category_id))
                        }}
                      >
                        <Checkbox checked={isChecked} />
                      </td>

                      {/* Name */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border">
                        <div className="flex items-center gap-2">
                          <Tag
                            className={cn(
                              'size-3.5 shrink-0',
                              isBeingEdited ? 'text-primary' : 'text-muted-foreground',
                            )}
                          />
                          <span className="font-semibold text-foreground">
                            {cat.employee_category_name}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border">
                        {isDraft ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/10 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400 border border-slate-500/20">
                            Draft
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active
                          </span>
                        )}
                      </td>

                      {/* Staff Count */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border">
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground font-medium">
                          <Users className="size-3 text-muted-foreground" />
                          <strong className="text-foreground">{staffCount}</strong> staff
                        </span>
                      </td>

                      {/* Actions */}
                      <td
                        className="py-2.5 px-3 text-right border-b border-r border-gray-200 dark:border-border"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleSelectCategoryToEdit(cat)}
                            className="size-7 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="Edit Category"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setCategoryToDelete(cat)}
                            className="size-7 cursor-pointer text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10"
                            title="Delete Category"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Sticky Pagination Bar */}
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2 text-xs text-muted-foreground bg-card shadow-2xs shrink-0">
          <div className="flex items-center gap-1.5">
            <span>Show</span>
            <Select
              value={String(itemsPerPage)}
              onValueChange={(val) => {
                setItemsPerPage(Number(val))
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="h-6 w-20 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span>per page &middot; {filteredAndSortedCategories.length} categories</span>
          </div>

          <div className="flex items-center gap-2">
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-0.5">
              <Button
                variant="outline"
                size="icon"
                className="size-6 cursor-pointer"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-3" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-6 cursor-pointer"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="size-3" />
              </Button>
            </div>
          </div>
        </div>
      </Panel>

      {/* ── RIGHT SIDE: Create & Update Form Panel ── */}
      <Panel className="w-80 md:w-96 shrink-0 flex flex-col h-full overflow-hidden bg-card border-border">
        {/* Right Panel Header */}
        <div className="border-b border-border p-4 bg-muted/20 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'grid size-7 place-items-center rounded-md text-primary font-semibold',
                  editingCategory ? 'bg-amber-500/10 text-amber-600' : 'bg-primary/10 text-primary',
                )}
              >
                {editingCategory ? <Pencil className="size-3.5" /> : <FolderPlus className="size-3.5" />}
              </div>
              <div>
                <h3 className="font-semibold text-sm text-foreground">
                  {editingCategory ? 'Update Category' : 'Create Category'}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {editingCategory
                    ? `Editing: ${editingCategory.employee_category_name}`
                    : 'Add a new employee department / category'}
                </p>
              </div>
            </div>

            {editingCategory && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFormToCreate}
                className="h-7 text-xs gap-1 cursor-pointer"
                title="Switch back to Create mode"
              >
                <Plus className="size-3" />
                <span>New</span>
              </Button>
            )}
          </div>

          {/* Tab Selector if Editing (Details vs Assign Staff) */}
          {editingCategory && (
            <div className="grid grid-cols-2 gap-1 p-0.5 mt-3 rounded-lg bg-muted/60 text-xs">
              <button
                type="button"
                onClick={() => setRightPanelTab('details')}
                className={cn(
                  'py-1 text-center font-medium rounded-md transition-colors cursor-pointer',
                  rightPanelTab === 'details'
                    ? 'bg-card text-foreground font-semibold shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Category Info
              </button>
              <button
                type="button"
                onClick={() => setRightPanelTab('assign')}
                className={cn(
                  'py-1 text-center font-medium rounded-md transition-colors cursor-pointer flex items-center justify-center gap-1',
                  rightPanelTab === 'assign'
                    ? 'bg-card text-foreground font-semibold shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span>Assign Staff</span>
                <span className="rounded-full bg-primary/10 px-1.5 text-[10px] text-primary">
                  {assignedUserIds.size}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Right Panel Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 text-xs">
          {rightPanelTab === 'details' ? (
            <form onSubmit={handleFormSubmit} className="space-y-4">
              {/* Category Name Input */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground flex items-center justify-between">
                  <span>Category Name</span>
                  <span className="text-[10px] text-rose-500 font-bold">* Required</span>
                </label>
                <Input
                  value={formCategoryName}
                  onChange={(e) => setFormCategoryName(e.target.value)}
                  placeholder="e.g. Sales, Marketing, Operations..."
                  className="text-xs h-8 bg-background"
                  autoFocus
                />
                <p className="text-[11px] text-muted-foreground">
                  Descriptive title used in staff tables, attendance filters, and payroll.
                </p>
              </div>

              {/* Status Select */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Visibility Status</label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active (Visible across all modules)</SelectItem>
                    <SelectItem value="draft">Draft (Hidden from filters)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Save & Reset Actions */}
              <div className="pt-2 flex items-center gap-2">
                <Button
                  type="submit"
                  size="sm"
                  disabled={isFormSaving || !formCategoryName.trim()}
                  className="flex-1 text-xs font-semibold cursor-pointer shadow-xs"
                >
                  {isFormSaving ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin mr-1.5" />
                      Saving...
                    </>
                  ) : editingCategory ? (
                    <>
                      <Check className="size-3.5 mr-1" />
                      Update Category
                    </>
                  ) : (
                    <>
                      <Plus className="size-3.5 mr-1" />
                      Create Category
                    </>
                  )}
                </Button>

                {editingCategory && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleResetFormToCreate}
                    className="text-xs cursor-pointer"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          ) : (
            /* ── Assign Staff Tab (Matching AssignToCategory.jsx) ── */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-foreground">Assign Staff Members</h4>
                  <p className="text-[11px] text-muted-foreground">
                    Check employees to assign to this category.
                  </p>
                </div>
                <span className="text-xs font-semibold text-primary">
                  {assignedUserIds.size} selected
                </span>
              </div>

              {/* Search Employees */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  placeholder="Filter staff by name or email..."
                  className="h-7.5 pl-8 text-xs bg-background"
                />
              </div>

              {/* Employees Checkbox List */}
              <div className="border border-border rounded-lg max-h-[360px] overflow-y-auto divide-y divide-border bg-background">
                {isUsersLoading ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <Loader2 className="size-4 animate-spin mx-auto mb-1 text-primary" />
                    Loading employees...
                  </div>
                ) : filteredUsersForAssign.length === 0 ? (
                  <div className="py-6 text-center text-muted-foreground">
                    No employees matched.
                  </div>
                ) : (
                  filteredUsersForAssign.map((emp) => {
                    const isChecked = assignedUserIds.has(emp.id)
                    const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.email || 'Unnamed Staff'

                    return (
                      <label
                        key={emp.id}
                        className={cn(
                          'flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors',
                          isChecked ? 'bg-primary/5' : 'hover:bg-muted/40',
                        )}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleUserAssignment(emp.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{fullName}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {emp.title || emp.email || 'Employee'}
                          </p>
                        </div>
                        {isChecked && (
                          <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                        )}
                      </label>
                    )
                  })
                )}
              </div>

              {/* Save Assignments Button */}
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (!editingCategory) return
                  assignStaffMutation.mutate({
                    targetCategoryId: editingCategory.employee_category_id,
                    selectedIds: Array.from(assignedUserIds),
                  })
                }}
                disabled={assignStaffMutation.isPending}
                className="w-full text-xs font-semibold cursor-pointer shadow-xs"
              >
                {assignStaffMutation.isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                    Saving Assignments...
                  </>
                ) : (
                  <>
                    <UserCheck className="size-3.5 mr-1" />
                    Save Category Assignments
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </Panel>

      {/* ── DELETE CATEGORY CONFIRMATION MODAL ── */}
      <AlertDialog
        open={Boolean(categoryToDelete)}
        onOpenChange={(open) => !open && setCategoryToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-rose-600">
              <AlertCircle className="size-5" />
              <AlertDialogTitle>Delete Employee Category?</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              Are you sure you want to delete the category{' '}
              <strong className="text-foreground">
                "{categoryToDelete?.employee_category_name}"
              </strong>
              ? Employees assigned to this category will become unassigned. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (categoryToDelete) {
                  deleteMutation.mutate(categoryToDelete.employee_category_id)
                }
              }}
              disabled={deleteMutation.isPending}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Category'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* ── BULK DELETE CONFIRMATION MODAL ── */}
      <AlertDialog
        open={bulkDeleteModalOpen}
        onOpenChange={setBulkDeleteModalOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-rose-600">
              <AlertCircle className="size-5" />
              <AlertDialogTitle>Delete Selected Categories?</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <strong className="text-foreground">
                {selectedCategoryIds.length} selected categories
              </strong>
              ? Employees assigned to these categories will become unassigned. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                bulkDeleteMutation.mutate(selectedCategoryIds)
              }}
              disabled={bulkDeleteMutation.isPending}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              {bulkDeleteMutation.isPending ? 'Deleting...' : `Delete ${selectedCategoryIds.length} Categories`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
