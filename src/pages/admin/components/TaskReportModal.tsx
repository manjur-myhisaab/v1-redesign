import { useState, useMemo, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
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
import { Badge } from '@/components/ui/badge'
import { EmployeeAvatar } from '@/lib/people'
import { exportTaskReportToExcel } from '@/lib/exportTaskReportToExcel'
import {
  FileSpreadsheet,
  Search,
  Users,
  CheckSquare,
  Square,
  Calendar,
  Loader2,
  CheckCircle2,
  ListTodo,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TaskItem, TaskAssignee, EmployeeCategory } from '../Tasks'

const MONTHS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
]

const YEARS = ['2024', '2025', '2026', '2027']

interface TaskReportModalProps {
  isOpen: boolean
  onClose: () => void
  firmName?: string
  creatorName?: string
  firmEmployees: TaskAssignee[]
  categories: EmployeeCategory[]
  allTasks: TaskItem[]
}

export default function TaskReportModal({
  isOpen,
  onClose,
  firmName = 'Company Tasks',
  creatorName = 'Admin',
  firmEmployees,
  categories,
  allTasks,
}: TaskReportModalProps) {
  const currentDate = new Date()
  const currentMonth = String(currentDate.getMonth() + 1)
  const currentYear = String(currentDate.getFullYear())

  // --- Filter states ---
  const [dateScope, setDateScope] = useState<'all' | 'month' | 'custom'>('month')
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth)
  const [selectedYear, setSelectedYear] = useState<string>(currentYear)
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')

  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')

  // Employee filter states
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [employeeSearch, setEmployeeSearch] = useState<string>('')
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([])

  // Specific task selection states (from v1)
  const [taskSearch, setTaskSearch] = useState<string>('')
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
  const [isExporting, setIsExporting] = useState<boolean>(false)

  // Reset/initialize when opened
  useEffect(() => {
    if (isOpen) {
      setSelectedEmployeeIds([])
      setSelectedTaskIds([])
      setEmployeeSearch('')
      setTaskSearch('')
      setSelectedCategory('all')
    }
  }, [isOpen])

  // --- 1. Filtered Employees for selection ---
  const filteredEmployees = useMemo(() => {
    return firmEmployees.filter((emp) => {
      if (emp.status === 'archived') return false

      // Category filter
      if (selectedCategory !== 'all') {
        const catObj = emp.employee_category_id
        const catId =
          typeof catObj === 'object' && catObj !== null
            ? String(catObj.employee_category_id ?? '')
            : String(catObj ?? '')
        if (catId !== selectedCategory) return false
      }

      // Search filter
      if (employeeSearch.trim()) {
        const q = employeeSearch.trim().toLowerCase()
        const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.toLowerCase()
        const email = (emp.email || '').toLowerCase()
        const title = (emp.title || '').toLowerCase()
        return fullName.includes(q) || email.includes(q) || title.includes(q)
      }

      return true
    })
  }, [firmEmployees, selectedCategory, employeeSearch])

  const filteredEmpIds = useMemo(() => filteredEmployees.map((e) => String(e.id)), [filteredEmployees])
  const isAllEmployeesSelected =
    filteredEmpIds.length > 0 && filteredEmpIds.every((id) => selectedEmployeeIds.includes(id))

  const handleToggleSelectAllEmployees = () => {
    if (isAllEmployeesSelected) {
      setSelectedEmployeeIds((prev) => prev.filter((id) => !filteredEmpIds.includes(id)))
    } else {
      setSelectedEmployeeIds((prev) => Array.from(new Set([...prev, ...filteredEmpIds])))
    }
  }

  const handleToggleEmployee = (id: string) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  // --- 2. Filtered Tasks for Task-wise selection ---
  const matchingTasks = useMemo(() => {
    let result = [...allTasks]

    // Timeframe filter
    if (dateScope === 'month' && selectedMonth && selectedYear) {
      const m = Number(selectedMonth)
      const y = Number(selectedYear)
      const startIso = new Date(Date.UTC(y, m - 1, 1)).toISOString().split('T')[0]
      const endIso = new Date(Date.UTC(y, m, 0)).toISOString().split('T')[0]
      result = result.filter((t) => {
        if (!t.task_duedate) return false
        const due = t.task_duedate.split('T')[0]
        return due >= startIso && due <= endIso
      })
    } else if (dateScope === 'custom' && customStartDate && customEndDate) {
      result = result.filter((t) => {
        if (!t.task_duedate) return false
        const due = t.task_duedate.split('T')[0]
        return due >= customStartDate && due <= customEndDate
      })
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((t) => (t.status || 'pending') === statusFilter)
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      result = result.filter((t) => (t.task_priority || 'medium') === priorityFilter)
    }

    // Employee filter (if any selected)
    if (selectedEmployeeIds.length > 0) {
      result = result.filter((task) => {
        const primaryId =
          typeof task.assignedTo === 'object' && task.assignedTo !== null
            ? String(task.assignedTo.id || '')
            : String(task.assignedTo || '')
        if (selectedEmployeeIds.includes(primaryId)) return true

        if (Array.isArray(task.assignedToOthers)) {
          return task.assignedToOthers.some((other) => {
            const otherId =
              typeof other?.directus_users_id === 'object' && other?.directus_users_id !== null
                ? String(other.directus_users_id.id || '')
                : String(other?.directus_users_id || '')
            return selectedEmployeeIds.includes(otherId)
          })
        }
        return false
      })
    }

    // Search filter
    if (taskSearch.trim()) {
      const q = taskSearch.trim().toLowerCase()
      result = result.filter((t) => {
        const title = (t.task_title || '').toLowerCase()
        const desc = (t.task_description || '').toLowerCase()
        return title.includes(q) || desc.includes(q)
      })
    }

    return result
  }, [
    allTasks,
    dateScope,
    selectedMonth,
    selectedYear,
    customStartDate,
    customEndDate,
    statusFilter,
    priorityFilter,
    selectedEmployeeIds,
    taskSearch,
  ])

  const matchingTaskIds = useMemo(() => matchingTasks.map((t) => String(t.task_id)), [matchingTasks])
  const isAllTasksSelected =
    matchingTaskIds.length > 0 && matchingTaskIds.every((id) => selectedTaskIds.includes(id))

  const handleToggleSelectAllTasks = () => {
    if (isAllTasksSelected) {
      setSelectedTaskIds((prev) => prev.filter((id) => !matchingTaskIds.includes(id)))
    } else {
      setSelectedTaskIds((prev) => Array.from(new Set([...prev, ...matchingTaskIds])))
    }
  }

  const handleToggleTask = (id: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  // --- 3. Execute Report Generation ---
  const handleGenerateReport = async () => {
    setIsExporting(true)
    try {
      const success = await exportTaskReportToExcel({
        month: dateScope === 'month' ? selectedMonth : undefined,
        year: dateScope === 'month' ? selectedYear : undefined,
        customStartDate: dateScope === 'custom' ? customStartDate : undefined,
        customEndDate: dateScope === 'custom' ? customEndDate : undefined,
        firmName,
        creatorName,
        selectedEmployeeIds: selectedEmployeeIds.length > 0 ? selectedEmployeeIds : undefined,
        selectedTaskIds: selectedTaskIds.length > 0 ? selectedTaskIds : undefined,
        statusFilter,
        priorityFilter,
      })

      if (success) {
        onClose()
      }
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[96vw] sm:max-w-[95vw] md:max-w-5xl lg:max-w-6xl xl:max-w-7xl !max-w-7xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-background rounded-2xl shadow-2xl border border-border">
        {/* Header */}
        <DialogHeader className="p-5 border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 grid place-items-center shrink-0">
              <FileSpreadsheet className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-foreground tracking-tight">
                Generate Task Report
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Export comprehensive task logs, assignee breakdown, completion reports, and photo attachments to Excel (.xlsx).
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Modal Body: Extra wide responsive layout */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Top Controls: Timeframe, Status & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl border border-border bg-card shadow-2xs">
            {/* 1. Timeframe Scope */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Calendar className="size-3.5 text-primary" />
                <span>Timeframe Scope</span>
              </label>
              <Select
                value={dateScope}
                onValueChange={(val: 'all' | 'month' | 'custom') => setDateScope(val)}
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Specific Month & Year</SelectItem>
                  <SelectItem value="custom">Custom Date Range</SelectItem>
                  <SelectItem value="all">All Tasks (All Months)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 2. Month/Year or Custom Date Pickers */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                {dateScope === 'month'
                  ? 'Select Month & Year'
                  : dateScope === 'custom'
                  ? 'Select From & To Date'
                  : 'Timeframe'}
              </label>

              {dateScope === 'month' ? (
                <div className="grid grid-cols-2 gap-2">
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {YEARS.map((y) => (
                        <SelectItem key={y} value={y}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : dateScope === 'custom' ? (
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="h-8 text-xs bg-background"
                  />
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="h-8 text-xs bg-background"
                  />
                </div>
              ) : (
                <div className="h-8 px-3 rounded-md border border-border bg-muted/40 text-xs flex items-center text-muted-foreground font-medium">
                  All recorded tasks included
                </div>
              )}
            </div>

            {/* 3. Status Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Status Filter</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending Only</SelectItem>
                  <SelectItem value="in_progress">In Progress Only</SelectItem>
                  <SelectItem value="completed">Completed Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 4. Priority Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Priority Filter</label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Bottom Grid: Extra wide 2-column view */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Column: Employee & Category Selection (5 cols) */}
            <div className="lg:col-span-5 border border-border rounded-xl p-4 space-y-3 bg-card flex flex-col shadow-2xs">
              <div className="flex items-center justify-between pb-1 border-b border-border/60">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Users className="size-3.5 text-primary" />
                  <span>Filter by Staff / Assignee</span>
                </label>
                <span className="text-[11px] font-medium text-muted-foreground">
                  {selectedEmployeeIds.length > 0
                    ? `${selectedEmployeeIds.length} staff selected`
                    : 'All staff included'}
                </span>
              </div>

              {/* Category pills */}
              {categories.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Categories
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('all')}
                      className={cn(
                        'px-2.5 py-1 text-[11px] rounded-md font-medium border shrink-0 transition-colors cursor-pointer',
                        selectedCategory === 'all'
                          ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                          : 'bg-background hover:bg-muted text-muted-foreground border-border',
                      )}
                    >
                      All
                    </button>
                    {categories.map((cat) => {
                      const cid = String(cat.employee_category_id || '')
                      const isSel = selectedCategory === cid
                      return (
                        <button
                          key={cid}
                          type="button"
                          onClick={() => setSelectedCategory(isSel ? 'all' : cid)}
                          className={cn(
                            'px-2.5 py-1 text-[11px] rounded-md font-medium border shrink-0 transition-colors cursor-pointer',
                            isSel
                              ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                              : 'bg-background hover:bg-muted text-muted-foreground border-border',
                          )}
                        >
                          {cat.employee_category_name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Employee search bar & Select All */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search staff by name or designation..."
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    className="h-8 pl-8 text-xs bg-background"
                  />
                </div>
                {filteredEmpIds.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleToggleSelectAllEmployees}
                    className="h-8 px-2 text-xs font-semibold shrink-0 cursor-pointer text-primary hover:bg-primary/10"
                  >
                    {isAllEmployeesSelected ? (
                      <CheckSquare className="size-3.5 mr-1 text-primary" />
                    ) : (
                      <Square className="size-3.5 mr-1 text-muted-foreground" />
                    )}
                    Select All ({filteredEmpIds.length})
                  </Button>
                )}
              </div>

              {/* Scrollable employee checkbox list */}
              <div className="border border-border rounded-lg max-h-80 overflow-y-auto divide-y divide-border/60 bg-muted/10 flex-1">
                {filteredEmployees.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-12">No staff found</p>
                ) : (
                  filteredEmployees.map((emp) => {
                    const id = String(emp.id)
                    const isChecked = selectedEmployeeIds.includes(id)
                    const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Staff'
                    const catName =
                      typeof emp.employee_category_id === 'object' && emp.employee_category_id !== null
                        ? (emp.employee_category_id as any).employee_category_name
                        : ''

                    return (
                      <div
                        key={id}
                        onClick={() => handleToggleEmployee(id)}
                        className={cn(
                          'flex items-center justify-between px-3 py-2 text-xs transition-colors cursor-pointer hover:bg-muted/50',
                          isChecked && 'bg-primary/5',
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => handleToggleEmployee(id)}
                            onClick={(e) => e.stopPropagation()}
                            className="size-4 shrink-0"
                          />
                          <EmployeeAvatar
                            name={fullName}
                            employeeId={id}
                            avatar={emp.avatar}
                            className="size-7 text-[10px] shrink-0"
                          />
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="font-medium text-foreground truncate">{fullName}</span>
                            {emp.title && (
                              <span className="text-[10px] text-muted-foreground truncate">
                                {emp.title}
                              </span>
                            )}
                          </div>
                        </div>
                        {catName && (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-normal text-muted-foreground shrink-0 ml-2"
                          >
                            {catName}
                          </Badge>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Right Column: Task Selection (Task-wise Report) (7 cols) */}
            <div className="lg:col-span-7 border border-border rounded-xl p-4 space-y-3 bg-card flex flex-col shadow-2xs">
              <div className="flex items-center justify-between pb-1 border-b border-border/60">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <ListTodo className="size-3.5 text-primary" />
                  <span>Select Specific Tasks</span>
                </label>
                <span className="text-[11px] font-medium text-muted-foreground">
                  {selectedTaskIds.length > 0
                    ? `${selectedTaskIds.length} tasks selected`
                    : `All ${matchingTasks.length} matching tasks included`}
                </span>
              </div>

              {/* Task search & Select All */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search matching tasks by title or description..."
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                    className="h-8 pl-8 text-xs bg-background"
                  />
                </div>
                {matchingTaskIds.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleToggleSelectAllTasks}
                    className="h-8 px-2 text-xs font-semibold shrink-0 cursor-pointer text-primary hover:bg-primary/10"
                  >
                    {isAllTasksSelected ? (
                      <CheckSquare className="size-3.5 mr-1 text-primary" />
                    ) : (
                      <Square className="size-3.5 mr-1 text-muted-foreground" />
                    )}
                    Select All ({matchingTaskIds.length})
                  </Button>
                )}
              </div>

              {/* Scrollable tasks checkbox list */}
              <div className="border border-border rounded-lg max-h-80 overflow-y-auto divide-y divide-border/60 bg-muted/10 flex-1">
                {matchingTasks.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-12">
                    No tasks found matching the selected timeframe & filters
                  </p>
                ) : (
                  matchingTasks.map((t) => {
                    const id = String(t.task_id)
                    const isChecked = selectedTaskIds.includes(id)
                    const assigneeName =
                      typeof t.assignedTo === 'object' && t.assignedTo !== null
                        ? `${t.assignedTo.first_name || ''} ${t.assignedTo.last_name || ''}`.trim()
                        : 'Unassigned'

                    return (
                      <div
                        key={id}
                        onClick={() => handleToggleTask(id)}
                        className={cn(
                          'flex items-center justify-between gap-3 px-3 py-2.5 text-xs transition-colors cursor-pointer hover:bg-muted/50',
                          isChecked && 'bg-primary/5',
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => handleToggleTask(id)}
                            onClick={(e) => e.stopPropagation()}
                            className="size-4 shrink-0"
                          />
                          <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                            #{t.task_id}
                          </Badge>
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="font-medium text-foreground truncate">
                              {t.task_title}
                            </span>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              <span className="truncate max-w-[130px] font-medium text-foreground/80">
                                {assigneeName}
                              </span>
                              {t.task_duedate && <span>• Due: {t.task_duedate.split('T')[0]}</span>}
                              {t.task_duetime && <span>({t.task_duetime})</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {t.task_priority && (
                            <Badge
                              variant="secondary"
                              className={cn(
                                'text-[9px] uppercase font-semibold h-4.5 px-1.5',
                                t.task_priority === 'urgent' && 'text-rose-600 bg-rose-50 dark:bg-rose-950/40',
                                t.task_priority === 'high' && 'text-orange-600 bg-orange-50 dark:bg-orange-950/40',
                                t.task_priority === 'medium' && 'text-sky-600 bg-sky-50 dark:bg-sky-950/40',
                                t.task_priority === 'low' && 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40',
                              )}
                            >
                              {t.task_priority}
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className="text-[9px] uppercase font-semibold h-4.5 px-1.5"
                          >
                            {(t.status || 'pending').replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-border bg-muted/20 flex sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="size-4 text-emerald-600" />
            <span>
              {selectedTaskIds.length > 0
                ? `Will export ${selectedTaskIds.length} individually selected tasks`
                : `Will export all ${matchingTasks.length} matching tasks`}
              {selectedEmployeeIds.length > 0
                ? ` for ${selectedEmployeeIds.length} staff member(s)`
                : ''}
              .
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isExporting}
              className="h-8 text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleGenerateReport}
              disabled={isExporting || (matchingTasks.length === 0 && selectedTaskIds.length === 0)}
              className="h-8 text-xs cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1.5 shadow-2xs"
            >
              {isExporting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="size-3.5" />
                  Download Excel Report
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
