import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Layers,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  Percent,
  Coins,
  RefreshCw,
  X,
  Filter,
  ArrowUpDown,
  Check,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import Panel from '@/components/admin/Panel'
import { useShell } from '@/components/admin/shell-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import rdk, { readItems, createItem, deleteItem } from '@/services/server'

interface PayrollTemplate {
  payroll_template_id: number | string
  payroll_template_name: string
  status?: string
  basic_salary_type?: 'percentage' | 'fixed' | string
  basic_salary_percentage?: number | null
  basic_salary_fixed?: number | null
  date_created?: string
  date_updated?: string
}

const formatDate = (date?: string) => {
  if (!date) return '-'
  try {
    const d = new Date(date)
    if (isNaN(d.getTime())) return '-'
    return new Intl.DateTimeFormat('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(d)
  } catch {
    return '-'
  }
}

export default function PayrollTemplates() {
  const navigate = useNavigate()
  const shell = useShell()
  const firstTabActive = shell?.firstTabActive ?? false
  const queryClient = useQueryClient()

  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [sortSelected, setSortSelected] = useState<string>('date desc')
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)
  const [sortPopoverOpen, setSortPopoverOpen] = useState(false)

  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Creation Modal States
  const [newModalOpen, setNewModalOpen] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [basicSalaryType, setBasicSalaryType] = useState<'percentage' | 'fixed'>('percentage')
  const [basicPercentage, setBasicPercentage] = useState<number | string>(50)
  const [basicFixedAmount, setBasicFixedAmount] = useState<number | string>('')
  const [isCreating, setIsCreating] = useState(false)

  // Delete Modal States
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [templateToDelete, setTemplateToDelete] = useState<PayrollTemplate | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // 1. Fetch Templates Query
  const {
    data: templates = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery<PayrollTemplate[]>({
    queryKey: ['payrollTemplates'],
    queryFn: async () => {
      const res: any = await rdk.request(
        readItems('payroll_templates', {
          fields: ['*'],
          sort: ['-date_created'],
          limit: -1,
        }),
      )
      return Array.isArray(res) ? res : res?.data || []
    },
  })

  // Filtered & Sorted Templates
  const filteredTemplates = useMemo(() => {
    let result = [...templates]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter((t) =>
        (t.payroll_template_name || '').toLowerCase().includes(q),
      )
    }

    if (filterStatus !== 'all') {
      result = result.filter(
        (t) => (t.status || 'draft').toLowerCase() === filterStatus.toLowerCase(),
      )
    }

    if (sortSelected === 'name asc') {
      result.sort((a, b) =>
        (a.payroll_template_name || '').localeCompare(b.payroll_template_name || ''),
      )
    } else if (sortSelected === 'name desc') {
      result.sort((a, b) =>
        (b.payroll_template_name || '').localeCompare(a.payroll_template_name || ''),
      )
    } else if (sortSelected === 'date asc') {
      result.sort(
        (a, b) =>
          new Date(a.date_created || 0).getTime() - new Date(b.date_created || 0).getTime(),
      )
    } else {
      // date desc default
      result.sort(
        (a, b) =>
          new Date(b.date_created || 0).getTime() - new Date(a.date_created || 0).getTime(),
      )
    }

    return result
  }, [templates, searchQuery, filterStatus, sortSelected])

  // Pagination
  const totalPages = Math.ceil(filteredTemplates.length / itemsPerPage) || 1
  const paginatedTemplates = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage
    return filteredTemplates.slice(startIdx, startIdx + itemsPerPage)
  }, [filteredTemplates, currentPage, itemsPerPage])

  // Create Template
  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTemplateName.trim()) {
      toast.error('Template name is required')
      return
    }

    setIsCreating(true)
    try {
      const isPercentage = basicSalaryType === 'percentage'
      const payload: Record<string, any> = {
        payroll_template_name: newTemplateName.trim(),
        basic_salary_type: basicSalaryType,
        basic_salary_percentage: isPercentage ? parseFloat(String(basicPercentage)) || 50 : null,
        basic_salary_fixed: !isPercentage ? parseFloat(String(basicFixedAmount)) || 0 : null,
        status: 'draft',
      }

      const res: any = await rdk.request(createItem('payroll_templates', payload))
      toast.success('Payroll template created successfully')
      queryClient.invalidateQueries({ queryKey: ['payrollTemplates'] })

      setNewModalOpen(false)
      setNewTemplateName('')
      setBasicSalaryType('percentage')
      setBasicPercentage(50)
      setBasicFixedAmount('')

      const newId = res?.payroll_template_id || res?.id
      if (newId) {
        navigate(`/admin/templates/${newId}`)
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create payroll template')
    } finally {
      setIsCreating(false)
    }
  }

  // Delete Template
  const deleteMutation = useMutation({
    mutationFn: async (id: number | string) => {
      return await rdk.request(deleteItem('payroll_templates', id))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrollTemplates'] })
      toast.success('Template deleted successfully')
      setDeleteModalOpen(false)
      setTemplateToDelete(null)
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete template')
    },
    onSettled: () => {
      setIsDeleting(false)
    },
  })

  const confirmDelete = () => {
    if (!templateToDelete) return
    setIsDeleting(true)
    deleteMutation.mutate(templateToDelete.payroll_template_id)
  }

  const activeFilterCount = filterStatus !== 'all' ? 1 : 0

  return (
    <Panel
      className={cn(
        'flex min-w-0 flex-1 flex-col h-full overflow-hidden',
        firstTabActive && 'rounded-tl-none',
      )}
    >
      {/* 1. Header Bar (Clients Design System) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5 bg-card/60 backdrop-blur-sm shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <Layers className="size-4" />
            </div>
            <h1 className="font-display text-lg font-semibold tracking-tight text-foreground">
              Payroll Templates
            </h1>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {templates.length} Total
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Define reusable salary structures, basic salary calculation rules, and linked components.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="h-8 gap-1.5 text-xs font-medium cursor-pointer shadow-2xs"
            title="Refresh templates"
          >
            <RefreshCw
              className={cn('size-3.5', isFetching && 'animate-spin text-primary')}
            />
            <span>Refresh</span>
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setNewTemplateName('')
              setBasicSalaryType('percentage')
              setBasicPercentage(50)
              setBasicFixedAmount('')
              setNewModalOpen(true)
            }}
            className="h-8 gap-1.5 text-xs font-semibold cursor-pointer shadow-xs"
          >
            <Plus className="size-3.5" />
            <span>New Template</span>
          </Button>
        </div>
      </div>

      {/* 2. Subheader Toolbar: Search + Filter + Sort */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5 bg-card shrink-0">
        {/* Left Count */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">
            {filteredTemplates.length} {filteredTemplates.length === 1 ? 'template' : 'templates'}
          </span>
        </div>

        {/* Right Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative min-w-[200px] sm:w-64">
            <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search template name..."
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
            <PopoverContent align="end" className="w-56 p-3 space-y-3 shadow-lg">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <p className="text-xs font-bold text-foreground">Filter Templates</p>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterStatus('all')
                      setCurrentPage(1)
                    }}
                    className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground">Status</label>
                <Select
                  value={filterStatus}
                  onValueChange={(val) => {
                    setFilterStatus(val)
                    setCurrentPage(1)
                  }}
                >
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
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
                Sort Templates By
              </div>
              {[
                { key: 'date desc', label: 'Date: Newest First' },
                { key: 'date asc', label: 'Date: Oldest First' },
                { key: 'name asc', label: 'Name: A to Z' },
                { key: 'name desc', label: 'Name: Z to A' },
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

          {/* Quick Refresh Icon */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            className="size-7 cursor-pointer text-muted-foreground hover:text-foreground rounded-md"
            title="Refresh templates"
          >
            <RefreshCw
              className={cn('size-3.5', isFetching && 'animate-spin text-primary')}
            />
          </Button>
        </div>
      </div>

      {/* 3. Main Spreadsheet Table (Full-Width Edge-to-Edge like Clients) */}
      <div className="flex-1 min-h-0 overflow-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-20 gap-2 text-muted-foreground">
            <Loader2 className="size-6 animate-spin text-primary" />
            <span className="text-xs">Loading payroll templates...</span>
          </div>
        ) : (
          <table className="w-full border-separate border-spacing-0 text-left text-xs">
            <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur-xs text-[11px] font-bold uppercase tracking-wider text-muted-foreground select-none">
              <tr className="border-b border-border divide-x divide-border/60">
                <th className="py-2.5 px-3 border-b border-r border-border w-12 text-center">
                  #
                </th>
                <th className="py-2.5 px-3 border-b border-r border-border min-w-[240px]">
                  Template Name
                </th>
                <th className="py-2.5 px-3 border-b border-r border-border min-w-[150px] text-center">
                  Basic Salary Type
                </th>
                <th className="py-2.5 px-3 border-b border-r border-border min-w-[140px] text-right">
                  Calculation Rate
                </th>
                <th className="py-2.5 px-3 border-b border-r border-border min-w-[140px]">
                  Last Updated
                </th>
                <th className="py-2.5 px-3 border-b border-r border-border w-24 text-center">
                  Status
                </th>
                <th className="py-2.5 px-3 border-b border-r border-border w-24 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedTemplates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-16 text-center text-muted-foreground border-b border-border">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <Layers className="size-8 text-muted-foreground/40 mb-1" />
                      <p className="font-semibold text-foreground">No payroll templates found</p>
                      <p className="text-xs text-muted-foreground">
                        {searchQuery || filterStatus !== 'all'
                          ? 'Try adjusting your search query or filters.'
                          : 'Create your first payroll template structure to get started.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedTemplates.map((t, idx) => {
                  const isPercentage = t.basic_salary_type === 'percentage'
                  const rateDisplay = isPercentage
                    ? `${Number(t.basic_salary_percentage || 0).toFixed(2)}% of CTC`
                    : t.basic_salary_fixed
                      ? `₹ ${Number(t.basic_salary_fixed).toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                        })} Fixed`
                      : '₹ 0.00'

                  return (
                    <tr
                      key={t.payroll_template_id}
                      onClick={() => navigate(`/admin/templates/${t.payroll_template_id}`)}
                      className="group transition-colors cursor-pointer hover:bg-muted/40"
                    >
                      {/* # Index */}
                      <td className="py-2.5 px-3 text-center text-muted-foreground border-b border-r border-gray-200 dark:border-border font-medium">
                        {(currentPage - 1) * itemsPerPage + idx + 1}
                      </td>

                      {/* Template Name */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border">
                        <div className="flex items-center gap-2.5">
                          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                            <Layers className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-foreground truncate block group-hover:text-primary transition-colors">
                              {t.payroll_template_name}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              ID: #{t.payroll_template_id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Basic Salary Type */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border text-center">
                        <span
                          className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border',
                            isPercentage
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
                          )}
                        >
                          {isPercentage ? 'Percentage' : 'Fixed'}
                        </span>
                      </td>

                      {/* Calculation Rate */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border text-right font-semibold text-foreground">
                        {rateDisplay}
                      </td>

                      {/* Last Updated */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border text-muted-foreground">
                        {formatDate(t.date_updated || t.date_created)}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 border-b border-r border-gray-200 dark:border-border text-center">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] font-medium px-2 py-0.5',
                            t.status === 'active'
                              ? 'border-emerald-500/30 text-emerald-600 bg-emerald-500/5'
                              : 'border-amber-500/30 text-amber-600 bg-amber-500/5',
                          )}
                        >
                          {t.status ? t.status.charAt(0).toUpperCase() + t.status.slice(1) : 'Draft'}
                        </Badge>
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
                            onClick={() =>
                              navigate(`/admin/templates/${t.payroll_template_id}`)
                            }
                            className="size-7 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="Edit Template"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setTemplateToDelete(t)
                              setDeleteModalOpen(true)
                            }}
                            className="size-7 cursor-pointer text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10"
                            title="Delete Template"
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
        )}
      </div>

      {/* 4. Pagination Bar (Exact Clients Design System) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2.5 bg-card shrink-0 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span>Show</span>
          <Select
            value={String(itemsPerPage)}
            onValueChange={(val) => {
              setItemsPerPage(Number(val))
              setCurrentPage(1)
            }}
          >
            <SelectTrigger className="h-7 w-[68px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="15">15</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <span>per page &bull; {filteredTemplates.length} total templates</span>
        </div>

        <div className="flex items-center gap-2 text-muted-foreground">
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="size-7 cursor-pointer"
          >
            <ChevronLeft className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="size-7 cursor-pointer"
          >
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* ── CREATE TEMPLATE MODAL ── */}
      <Dialog open={newModalOpen} onOpenChange={setNewModalOpen}>
        <DialogContent className="max-w-md p-6 gap-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              <span>Create New Payroll Template</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateTemplate} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-bold text-foreground mb-1.5 block">
                Template Name <span className="text-rose-500">*</span>
              </label>
              <Input
                placeholder="e.g. Standard Employee Template, Executive Grade"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                className="h-9 text-xs"
                required
                autoFocus
              />
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Enter a descriptive name for your payroll template structure.
              </span>
            </div>

            {/* Basic Salary Type: Percentage vs Fixed */}
            <div>
              <label className="text-xs font-bold text-foreground mb-1.5 block">
                Basic Salary Calculation Method
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-muted/40 rounded-xl border border-gray-200 dark:border-border">
                <button
                  type="button"
                  onClick={() => setBasicSalaryType('percentage')}
                  className={cn(
                    'flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg cursor-pointer transition-all',
                    basicSalaryType === 'percentage'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Percent className="size-3.5" />
                  <span>Percentage of CTC</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBasicSalaryType('fixed')}
                  className={cn(
                    'flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg cursor-pointer transition-all',
                    basicSalaryType === 'fixed'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Coins className="size-3.5" />
                  <span>Fixed Amount</span>
                </button>
              </div>
            </div>

            {/* Rate Input */}
            {basicSalaryType === 'percentage' ? (
              <div>
                <label className="text-xs font-bold text-foreground mb-1.5 block">
                  Basic Salary Percentage (% of CTC) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={basicPercentage}
                    onChange={(e) => setBasicPercentage(e.target.value)}
                    placeholder="e.g. 50"
                    className="h-9 text-xs pr-8"
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">
                    %
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground mt-1 block">
                  Standard recommendation is 40% to 50% of monthly CTC.
                </span>
              </div>
            ) : (
              <div>
                <label className="text-xs font-bold text-foreground mb-1.5 block">
                  Fixed Monthly Basic Salary (₹) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">
                    ₹
                  </span>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    value={basicFixedAmount}
                    onChange={(e) => setBasicFixedAmount(e.target.value)}
                    placeholder="e.g. 15000"
                    className="h-9 text-xs pl-7"
                    required
                  />
                </div>
                <span className="text-[11px] text-muted-foreground mt-1 block">
                  Employees assigned to this template will have this fixed base salary.
                </span>
              </div>
            )}

            <DialogFooter className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setNewModalOpen(false)}
                disabled={isCreating}
                className="h-8 text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isCreating || !newTemplateName.trim()}
                className="h-8 text-xs font-semibold gap-1.5 cursor-pointer shadow-xs"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Plus className="size-3.5" />
                    <span>Create Template</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── DELETE CONFIRMATION MODAL ── */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="max-w-md p-6 gap-4">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-rose-600 flex items-center gap-2">
              <Trash2 className="size-4" />
              <span>Delete Payroll Template</span>
            </DialogTitle>
          </DialogHeader>

          <p className="text-xs text-muted-foreground">
            Are you sure you want to delete template{' '}
            <strong className="text-foreground">
              "{templateToDelete?.payroll_template_name}"
            </strong>
            ? Employees linked to this template will remain unaffected, but this template rule will no longer be available.
          </p>

          <DialogFooter className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteModalOpen(false)}
              disabled={isDeleting}
              className="h-8 text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={confirmDelete}
              disabled={isDeleting}
              className="h-8 text-xs font-semibold gap-1.5 cursor-pointer shadow-xs"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="size-3.5" />
                  <span>Delete Template</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Panel>
  )
}
