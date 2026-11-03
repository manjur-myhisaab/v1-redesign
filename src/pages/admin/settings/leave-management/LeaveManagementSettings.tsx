import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  CalendarCheck,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Search,
  X,
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react'

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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useResizableColumns, ColumnResizer } from '@/hooks/useResizableColumns'
import rdk, { readItems, deleteItem } from '@/services/server'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { LeaveTemplateModal, LEAVE_TYPE_LABEL_MAP } from './LeaveTemplateModal'

export const LeaveManagementSettings: React.FC = () => {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [templateToDelete, setTemplateToDelete] = useState<any | null>(null)

  // Resizable columns
  const { colWidths, startResizing, isResizing, canSort } = useResizableColumns(
    {
      name: 240,
      leaves: 420,
      status: 120,
      actions: 100,
    },
    { storageKey: 'leave_templates_table_widths', minWidth: 80 }
  )

  // Search, Sort & Pagination state
  const [search, setSearch] = useState('')
  const [sortSelected, setSortSelected] = useState<string>('name asc')
  const [sortPopoverOpen, setSortPopoverOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Directus RDK query with robust array/data normalization
  const {
    data: templates = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['leave_templates'],
    queryFn: async () => {
      const res: any = await rdk.request(
        readItems('leave_templates', {
          fields: ['*'],
          sort: ['-date_created'],
          limit: -1,
        })
      )
      return Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  })

  // Filter & Sort
  const filteredAndSortedTemplates = useMemo(() => {
    let result = [...templates]

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((item: any) => {
        const name = (item.leave_template_name || '').toLowerCase()
        const id = String(item.leave_template_id || item.id || '').toLowerCase()
        const leaves = Array.isArray(item.leaves_applicable)
          ? item.leaves_applicable.map((l: any) => l.leave_type).join(' ').toLowerCase()
          : ''
        return name.includes(q) || id.includes(q) || leaves.includes(q)
      })
    }

    result.sort((a: any, b: any) => {
      const nameA = (a.leave_template_name || '').toLowerCase()
      const nameB = (b.leave_template_name || '').toLowerCase()
      if (sortSelected === 'name asc') return nameA.localeCompare(nameB)
      if (sortSelected === 'name desc') return nameB.localeCompare(nameA)
      return 0
    })

    return result
  }, [templates, search, sortSelected])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedTemplates.length / itemsPerPage))
  const paginatedTemplates = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredAndSortedTemplates.slice(start, start + itemsPerPage)
  }, [filteredAndSortedTemplates, currentPage, itemsPerPage])

  const deleteMutation = useMutation({
    mutationFn: async (id: number | string) => {
      return await rdk.request(deleteItem('leave_templates', id))
    },
    onSuccess: async () => {
      sound.success()
      toast.success('Leave template deleted successfully')
      await queryClient.invalidateQueries({ queryKey: ['leave_templates'] })
      await queryClient.refetchQueries({ queryKey: ['leave_templates'] })
      refetch()
      setDeleteConfirmOpen(false)
      setTemplateToDelete(null)
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete leave template')
    },
  })

  const handleAdd = () => {
    setSelectedTemplate(null)
    setModalOpen(true)
  }

  const handleEdit = (tmpl: any) => {
    setSelectedTemplate(tmpl)
    setModalOpen(true)
  }

  const handleDeletePrompt = (tmpl: any) => {
    setTemplateToDelete(tmpl)
    setDeleteConfirmOpen(true)
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden h-full">
      {/* 1. Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5 bg-card/60 backdrop-blur-sm shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <CalendarCheck className="size-4" />
            </div>
            <h1 className="font-display text-base font-semibold tracking-tight text-foreground">
              Leave Management
            </h1>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {templates.length} Total
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure leave quotas, types, accrual intervals, and company-wide leave policies.
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
            <RefreshCw className={cn('size-3.5', isFetching && 'animate-spin text-primary')} />
            <span>Refresh</span>
          </Button>

          <Button
            size="sm"
            onClick={handleAdd}
            className="h-8 gap-1.5 text-xs font-semibold cursor-pointer shadow-xs"
          >
            <Plus className="size-3.5" />
            <span>New Leave Template</span>
          </Button>
        </div>
      </div>

      {/* 2. Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5 bg-card shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">
            {filteredAndSortedTemplates.length}{' '}
            {filteredAndSortedTemplates.length === 1 ? 'template' : 'templates'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative min-w-[200px] sm:w-64">
            <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search template name or leave type..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setCurrentPage(1)
              }}
              className="h-7.5 pl-8 pr-7 text-xs bg-muted/30 focus-visible:bg-background rounded-lg"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

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
            <PopoverContent align="end" className="w-52 p-1.5 shadow-lg">
              <div className="p-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Sort Templates By
              </div>
              {[
                { key: 'name asc', label: 'Template Name: A to Z' },
                { key: 'name desc', label: 'Template Name: Z to A' },
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
                        : 'text-foreground hover:bg-muted'
                    )}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <Check className="size-3.5 text-primary" />}
                  </button>
                )
              })}
            </PopoverContent>
          </Popover>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            className="size-7 cursor-pointer text-muted-foreground hover:text-foreground rounded-md"
            title="Refresh"
          >
            <RefreshCw className={cn('size-3.5', isFetching && 'animate-spin text-primary')} />
          </Button>
        </div>
      </div>

      {/* 3. Main Spreadsheet Grid Table with Resizable Columns */}
      <div className="flex-1 min-h-0 overflow-auto bg-card">
        <table className="w-full border-separate border-spacing-0 text-left text-xs">
          <thead className="sticky top-0 z-20 bg-card shadow-2xs">
            <tr className="text-muted-foreground font-semibold">
              {/* Template Name Header (Sticky Frozen Column) */}
              <th
                style={{ width: colWidths.name, minWidth: colWidths.name }}
                className="sticky left-0 top-0 z-30 bg-card py-2.5 px-4 border-t border-b border-l border-r border-gray-200 dark:border-border select-none shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] dark:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.4)]"
              >
                <span className="pr-2">TEMPLATE NAME</span>
                <ColumnResizer
                  isResizing={isResizing === 'name'}
                  onMouseDown={(e) => startResizing('name', e)}
                />
              </th>

              {/* Leaves Configured Header */}
              <th
                style={{ width: colWidths.leaves, minWidth: colWidths.leaves }}
                className="relative py-2.5 px-4 border-t border-b border-r border-gray-200 dark:border-border select-none"
              >
                <span className="pr-2">LEAVES CONFIGURED</span>
                <ColumnResizer
                  isResizing={isResizing === 'leaves'}
                  onMouseDown={(e) => startResizing('leaves', e)}
                />
              </th>

              {/* Status Header */}
              <th
                style={{ width: colWidths.status, minWidth: colWidths.status }}
                className="relative py-2.5 px-4 border-t border-b border-r border-gray-200 dark:border-border select-none"
              >
                <span className="pr-2">STATUS</span>
                <ColumnResizer
                  isResizing={isResizing === 'status'}
                  onMouseDown={(e) => startResizing('status', e)}
                />
              </th>

              {/* Actions Header */}
              <th
                style={{ width: colWidths.actions, minWidth: colWidths.actions }}
                className="relative py-2.5 px-4 text-right border-t border-b border-r border-gray-200 dark:border-border select-none"
              >
                <span className="pr-2">ACTIONS</span>
                <ColumnResizer
                  isResizing={isResizing === 'actions'}
                  onMouseDown={(e) => startResizing('actions', e)}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="sticky left-0 z-10 bg-card py-3 px-4 border-b border-l border-r border-gray-200 dark:border-border shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] dark:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.4)]">
                    <div className="h-4 w-36 bg-muted rounded" />
                  </td>
                  <td className="py-3 px-4 border-b border-r border-gray-200 dark:border-border">
                    <div className="h-5 w-64 bg-muted rounded-full" />
                  </td>
                  <td className="py-3 px-4 border-b border-r border-gray-200 dark:border-border">
                    <div className="h-5 w-16 bg-muted rounded-full" />
                  </td>
                  <td className="py-3 px-4 border-b border-r border-gray-200 dark:border-border text-right">
                    <div className="h-4 w-12 bg-muted rounded ml-auto" />
                  </td>
                </tr>
              ))
            ) : paginatedTemplates.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="py-12 text-center text-muted-foreground border-b border-l border-r border-gray-200 dark:border-border"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <CalendarCheck className="size-8 text-muted-foreground/40" />
                    <p className="text-sm font-medium">No leave templates found</p>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      {search
                        ? 'Try adjusting your search query.'
                        : 'Create your first leave template specifying Casual, Sick, and Earned leaves for staff.'}
                    </p>
                    {!search && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAdd}
                        className="mt-2 h-7 text-xs"
                      >
                        <Plus className="size-3.5 mr-1" />
                        Create First Template
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              paginatedTemplates.map((tmpl: any) => {
                const tmplId = tmpl.leave_template_id || tmpl.id
                const leaves = Array.isArray(tmpl.leaves_applicable) ? tmpl.leaves_applicable : []
                const isPublished = tmpl.status === 'published'

                return (
                  <tr
                    key={tmplId}
                    onClick={() => handleEdit(tmpl)}
                    className="group hover:bg-muted/40 cursor-pointer transition-colors"
                  >
                    {/* Template Name & ID (Sticky Frozen Column) */}
                    <td className="sticky left-0 z-10 bg-card group-hover:bg-muted/50 py-2.5 px-4 border-b border-l border-r border-gray-200 dark:border-border shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] dark:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.4)] transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-xs">
                          {tmpl.leave_template_name || `Template #${tmplId}`}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] font-mono py-0 text-muted-foreground"
                        >
                          #{tmplId}
                        </Badge>
                      </div>
                    </td>

                    {/* Configured Leaves Badges matching v1 exactly */}
                    <td className="py-2.5 px-4 border-b border-r border-gray-200 dark:border-border">
                      {leaves.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {leaves.map((leave: any, idx: number) => {
                            const typeName =
                              LEAVE_TYPE_LABEL_MAP[leave.leave_type] || leave.leave_type || 'Leave'
                            const addSys = leave.leave_add_system || 'fixed'
                            const reqDays =
                              addSys === 'monthly' && leave.required_working_days
                                ? ` · ${leave.required_working_days}d req.`
                                : ''

                            return (
                              <Badge
                                key={idx}
                                variant="secondary"
                                className="text-[11px] font-medium bg-primary/10 text-primary border border-primary/20 py-0.5 px-2"
                              >
                                {`${typeName}: ${leave.leave_balance} Days (${addSys}${reqDays})`}
                              </Badge>
                            )
                          })}
                        </div>
                      ) : (
                        <span className="text-muted-foreground/60 italic text-[11px]">
                          No leaves added
                        </span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-2.5 px-4 border-b border-r border-gray-200 dark:border-border">
                      <Badge
                        variant={isPublished ? 'secondary' : 'outline'}
                        className={`text-[10px] font-medium py-0 px-2 ${
                          isPublished
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {isPublished ? 'Active' : 'Draft'}
                      </Badge>
                    </td>

                    {/* Actions */}
                    <td
                      onClick={(e) => e.stopPropagation()}
                      className="py-2.5 px-4 text-right border-b border-r border-gray-200 dark:border-border"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(tmpl)}
                          className="size-7 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted"
                          title="Edit Template"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeletePrompt(tmpl)}
                          className="size-7 cursor-pointer text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
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
      </div>

      {/* 4. Sticky Pagination Bar */}
      <div className="flex shrink-0 items-center justify-between border-t border-border px-5 py-2.5 bg-background">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Show</span>
          <Select
            value={String(itemsPerPage)}
            onValueChange={(val) => {
              setItemsPerPage(Number(val))
              setCurrentPage(1)
            }}
          >
            <SelectTrigger className="h-7 w-16 text-xs bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            per page • {filteredAndSortedTemplates.length} items
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
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
      </div>

      {/* Slide-out Sheet for Create / Edit Leave Template */}
      {modalOpen && (
        <LeaveTemplateModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          templateToEdit={selectedTemplate}
          onSuccess={() => refetch()}
        />
      )}

      {/* Delete Confirmation Alert Modal */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-semibold">Delete Leave Template</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Are you sure you want to delete <strong className="text-foreground">{templateToDelete?.leave_template_name}</strong>?
              Employees mapped to this template may lose their auto-accrual configurations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending} className="text-xs h-8">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                templateToDelete &&
                deleteMutation.mutate(
                  templateToDelete.leave_template_id || templateToDelete.id
                )
              }
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs h-8"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Template'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default LeaveManagementSettings
