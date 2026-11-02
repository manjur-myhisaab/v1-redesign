import * as React from 'react'
import {
  CalendarDays,
  Search,
  ChevronDown,
  ChevronRight,
  Pencil,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCategoriesQuery } from '@/features/categories/hooks/useCategories'
import { listEmployees, type Employee } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  getHolidayId,
  getHolidayName,
  getHolidayRawDate,
  parseHolidayDate,
  HOLIDAY_TYPES,
} from '../lib/holidayUtils'
import type {
  FirmHoliday,
  CreateFirmHolidayRequest,
  UpdateFirmHolidayRequest,
  ApplicableCategory,
} from '../api/holidaysApi.types'

interface CreateHolidayModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: CreateFirmHolidayRequest) => Promise<any>
  onUpdate?: (data: UpdateFirmHolidayRequest) => Promise<any>
  initialValues?: (FirmHoliday & { name?: string; date?: string; type?: string }) | null
}

export function CreateHolidayModal({
  open,
  onClose,
  onSubmit,
  onUpdate,
  initialValues,
}: CreateHolidayModalProps) {
  // Check if we are in Edit mode
  const editHolidayId = getHolidayId(initialValues)
  const isEditMode = Boolean(editHolidayId)

  // Form fields
  const [name, setName] = React.useState('')
  const [date, setDate] = React.useState('')
  const [holidayType, setHolidayType] = React.useState('PUBLIC_HOLIDAY')

  // Applicability Mode: 'categories' | 'users'
  const [applicabilityTab, setApplicabilityTab] = React.useState<'categories' | 'users'>('categories')

  // Selected Categories & Subcategories map: category_id -> Set of subcategory_ids
  const [selectedCategories, setSelectedCategories] = React.useState<Map<string, Set<string>>>(new Map())
  const [expandedCategories, setExpandedCategories] = React.useState<Set<string>>(new Set())

  // Selected Users
  const [selectedUsers, setSelectedUsers] = React.useState<Set<string>>(new Set())
  const [userSearchQuery, setUserSearchQuery] = React.useState('')
  const [employees, setEmployees] = React.useState<Employee[]>([])
  const [loadingEmployees, setLoadingEmployees] = React.useState(false)

  // Queries
  const { data: categories = [], isLoading: loadingCategories } = useCategoriesQuery()
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // Fetch employees list
  React.useEffect(() => {
    if (open) {
      setLoadingEmployees(true)
      listEmployees()
        .then((data) => setEmployees(data || []))
        .catch(() => setEmployees([]))
        .finally(() => setLoadingEmployees(false))
    }
  }, [open])

  // Reset or prefill on open
  React.useEffect(() => {
    if (open) {
      if (initialValues) {
        setName(getHolidayName(initialValues))
        const parsed = parseHolidayDate(getHolidayRawDate(initialValues))
        setDate(parsed.ymd || '')
        const rawType = initialValues.holiday_type || initialValues.type || 'PUBLIC_HOLIDAY'
        const normalized = String(rawType).toUpperCase().replace(/\s+/g, '_')
        const matched = HOLIDAY_TYPES.find(
          (t) => t.id === normalized || t.id.replace(/_/g, '') === normalized.replace(/_/g, '')
        )
        setHolidayType(matched ? matched.id : normalized.includes('PUBLIC') ? 'PUBLIC_HOLIDAY' : rawType)

        // Prefill categories
        if (initialValues.applicable_categories_for && initialValues.applicable_categories_for.length > 0) {
          const catMap = new Map<string, Set<string>>()
          const expanded = new Set<string>()
          initialValues.applicable_categories_for.forEach((cat) => {
            catMap.set(cat.category_id, new Set(cat.sub_category_id || []))
            if (cat.sub_category_id && cat.sub_category_id.length > 0) {
              expanded.add(cat.category_id)
            }
          })
          setSelectedCategories(catMap)
          setExpandedCategories(expanded)
        } else {
          setSelectedCategories(new Map())
          setExpandedCategories(new Set())
        }

        // Prefill users
        if (initialValues.applicable_user && initialValues.applicable_user.length > 0) {
          setSelectedUsers(new Set(initialValues.applicable_user))
          if (!initialValues.applicable_categories_for?.length) {
            setApplicabilityTab('users')
          }
        } else {
          setSelectedUsers(new Set())
        }
      } else {
        setName('')
        setDate('')
        setHolidayType('PUBLIC_HOLIDAY')
        setSelectedCategories(new Map())
        setExpandedCategories(new Set())
        setSelectedUsers(new Set())
        setApplicabilityTab('categories')
      }
      setUserSearchQuery('')
    }
  }, [open, initialValues])

  // Category selection helpers
  const toggleCategorySelection = (categoryId: string) => {
    const next = new Map(selectedCategories)
    if (next.has(categoryId)) {
      next.delete(categoryId)
    } else {
      // Select category with all its subcategories by default
      const category = categories.find((c) => c.category_id === categoryId)
      const subIds = (category?.subcategories || category?.subCategoryName || [])
        .map((s) => s.subcategory_id || s.subcategory_name)
        .filter(Boolean) as string[]
      next.set(categoryId, new Set(subIds))
    }
    setSelectedCategories(next)
  }

  const toggleSubcategorySelection = (categoryId: string, subId: string) => {
    const next = new Map(selectedCategories)
    const existing = next.get(categoryId) || new Set<string>()
    const updatedSub = new Set(existing)
    if (updatedSub.has(subId)) {
      updatedSub.delete(subId)
    } else {
      updatedSub.add(subId)
    }
    if (updatedSub.size === 0) {
      next.delete(categoryId)
    } else {
      next.set(categoryId, updatedSub)
    }
    setSelectedCategories(next)
  }

  const toggleCategoryExpanded = (categoryId: string) => {
    const next = new Set(expandedCategories)
    if (next.has(categoryId)) {
      next.delete(categoryId)
    } else {
      next.add(categoryId)
    }
    setExpandedCategories(next)
  }

  // User selection helpers
  const toggleUserSelection = (userId: string) => {
    const next = new Set(selectedUsers)
    if (next.has(userId)) {
      next.delete(userId)
    } else {
      next.add(userId)
    }
    setSelectedUsers(next)
  }

  const filteredEmployees = React.useMemo(() => {
    return employees.filter((emp) => {
      const fullName = `${emp.name || ''} ${(emp as any).firstName || ''} ${(emp as any).lastName || ''}`.toLowerCase()
      const email = (emp.email || '').toLowerCase()
      const dept = (emp.department || '').toLowerCase()
      const q = userSearchQuery.toLowerCase()
      return fullName.includes(q) || email.includes(q) || dept.includes(q)
    })
  }, [employees, userSearchQuery])

  // Form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !date) return

    // Build applicable_categories_for array
    const applicableCategories: ApplicableCategory[] = []
    selectedCategories.forEach((subs, catId) => {
      applicableCategories.push({
        category_id: catId,
        sub_category_id: Array.from(subs),
      })
    })

    const parsed = parseHolidayDate(date)
    const validDate = parsed.ymd || date

    try {
      setIsSubmitting(true)
      if (isEditMode && onUpdate && editHolidayId) {
        const updatePayload: UpdateFirmHolidayRequest = {
          holiday_id: editHolidayId,
          holiday_name: name.trim(),
          holiday_date: validDate,
          holiday_type: holidayType,
          applicable_categories_for: applicableCategories,
          applicable_user: Array.from(selectedUsers),
        }
        await onUpdate(updatePayload)
      } else {
        const createPayload: CreateFirmHolidayRequest = {
          holiday_name: name.trim(),
          holiday_date: validDate,
          holiday_type: holidayType,
          applicable_categories_for: applicableCategories,
          applicable_user: Array.from(selectedUsers),
        }
        await onSubmit(createPayload)
      }
      onClose()
    } catch (err) {
      console.error('Failed to save holiday:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="flex flex-col max-h-[85vh] sm:max-w-[560px] p-0 overflow-hidden">
        {/* Fixed Header */}
        <DialogHeader className="border-b border-border px-6 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {isEditMode ? <Pencil className="size-5" /> : <CalendarDays className="size-5" />}
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                {isEditMode ? 'Edit Firm Holiday' : 'Create Firm Holiday'}
              </DialogTitle>
              <p className="text-[12px] text-muted-foreground">
                {isEditMode
                  ? 'Update holiday details and scope'
                  : 'Set up a company, mandatory, or optional holiday'}
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Scrollable Body Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Basic Fields */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-foreground">
                  Holiday Name <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Diwali, Company Annual Off..."
                  required
                  className="h-9 text-[13px]"
                />
              </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-foreground">
                  Holiday Date <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="h-9 text-[13px]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-foreground">
                  Holiday Type
                </label>
                <Select value={holidayType} onValueChange={setHolidayType}>
                  <SelectTrigger className="h-9 w-full bg-card text-[13px]">
                    <SelectValue placeholder="Select holiday type" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {HOLIDAY_TYPES.map((t) => (
                      <SelectItem key={t.id} value={t.id} className="text-[12.5px] cursor-pointer">
                        <div className="flex items-center gap-2">
                          <span className={cn('rounded px-1.5 py-0.2 text-[10.5px] font-medium border', t.tone)}>
                            {t.name}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Applicability Targeting Section */}
          <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-3">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[12.5px] font-semibold text-foreground">
                  Applicability & Scope
                </span>
              </div>
              <div className="flex items-center rounded-lg bg-muted p-0.5 text-[11.5px] font-medium">
                <button
                  type="button"
                  onClick={() => setApplicabilityTab('categories')}
                  className={cn(
                    'rounded-md px-2.5 py-1 transition-colors cursor-pointer',
                    applicabilityTab === 'categories'
                      ? 'bg-background text-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Categories ({selectedCategories.size})
                </button>
                <button
                  type="button"
                  onClick={() => setApplicabilityTab('users')}
                  className={cn(
                    'rounded-md px-2.5 py-1 transition-colors cursor-pointer',
                    applicabilityTab === 'users'
                      ? 'bg-background text-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Specific Users ({selectedUsers.size})
                </button>
              </div>
            </div>

            {/* Categories & Subcategories Tab */}
            {applicabilityTab === 'categories' && (
              <div className="space-y-2">
                <p className="text-[11.5px] text-muted-foreground">
                  Select applicable categories & subcategories (leave unselected for firm-wide holiday):
                </p>

                {loadingCategories ? (
                  <div className="py-4 text-center text-[12px] text-muted-foreground">
                    Loading categories...
                  </div>
                ) : categories.length === 0 ? (
                  <div className="py-4 text-center text-[12px] text-muted-foreground">
                    No categories found.
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-lg border border-border bg-card p-2">
                    {categories.map((category) => {
                      const isCatSelected = selectedCategories.has(category.category_id)
                      const isExpanded = expandedCategories.has(category.category_id)
                      const subcategories = category.subcategories || category.subCategoryName || []
                      const selectedSubCount = selectedCategories.get(category.category_id)?.size || 0

                      return (
                        <div
                          key={category.category_id}
                          className="rounded-md border border-border/60 bg-background/50 p-2 text-[12.5px]"
                        >
                          <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <Checkbox
                                checked={isCatSelected}
                                onCheckedChange={() => toggleCategorySelection(category.category_id)}
                              />
                              <span className="font-medium text-foreground">
                                {category.category_name}
                              </span>
                              {subcategories.length > 0 && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0">
                                  {selectedSubCount}/{subcategories.length} subs
                                </Badge>
                              )}
                            </label>

                            {subcategories.length > 0 && (
                              <button
                                type="button"
                                onClick={() => toggleCategoryExpanded(category.category_id)}
                                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="size-3.5" />
                                ) : (
                                  <ChevronRight className="size-3.5" />
                                )}
                              </button>
                            )}
                          </div>

                          {/* Subcategories list */}
                          {isExpanded && subcategories.length > 0 && (
                            <div className="mt-2 pl-6 space-y-1 border-t border-border/40 pt-1.5">
                              {subcategories.map((sub, idx) => {
                                const subId = sub.subcategory_id || sub.subcategory_name
                                const isSubSelected =
                                  selectedCategories.get(category.category_id)?.has(subId) || false

                                return (
                                  <label
                                    key={subId || idx}
                                    className="flex items-center gap-2 text-[12px] text-muted-foreground hover:text-foreground cursor-pointer"
                                  >
                                    <Checkbox
                                      checked={isSubSelected}
                                      onCheckedChange={() =>
                                        toggleSubcategorySelection(category.category_id, subId)
                                      }
                                    />
                                    <span>{sub.subcategory_name}</span>
                                  </label>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Users Tab */}
            {applicabilityTab === 'users' && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search employees by name, email, department..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="h-8 pl-8 text-[12px]"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-border bg-card p-2">
                  {loadingEmployees ? (
                    <div className="py-4 text-center text-[12px] text-muted-foreground">
                      Loading employees...
                    </div>
                  ) : filteredEmployees.length === 0 ? (
                    <div className="py-4 text-center text-[12px] text-muted-foreground">
                      No employees match your search.
                    </div>
                  ) : (
                    filteredEmployees.map((emp) => {
                      const empId = emp.id || (emp as any).user_id
                      const isSelected = selectedUsers.has(empId)
                      const displayName = emp.name || `${(emp as any).firstName || ''} ${(emp as any).lastName || ''}`.trim() || 'Employee'

                      return (
                        <label
                          key={empId}
                          className="flex items-center justify-between rounded-md p-1.5 hover:bg-muted/40 cursor-pointer text-[12px]"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleUserSelection(empId)}
                            />
                            <span className="font-medium text-foreground truncate">
                              {displayName}
                            </span>
                            {emp.department && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                {emp.department}
                              </Badge>
                            )}
                          </div>
                        </label>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Fixed Footer */}
          <DialogFooter className="border-t border-border bg-muted/20 px-6 py-3.5 shrink-0 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-8.5 text-[12.5px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !name.trim() || !date}
              className="btn-3d h-8.5 bg-foreground text-background text-[12.5px] cursor-pointer"
            >
              {isSubmitting
                ? isEditMode
                  ? 'Updating Holiday...'
                  : 'Creating Holiday...'
                : isEditMode
                ? 'Update Holiday'
                : 'Create Holiday'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
