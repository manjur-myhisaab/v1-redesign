import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, Download, AlertCircle } from 'lucide-react'
import { ReportDateSelector } from './selectors/ReportDateSelector'
import { ReportCategorySelector } from './selectors/ReportCategorySelector'
import { ReportEmployeeSelector } from './selectors/ReportEmployeeSelector'
import { ReportFormatSelector } from './selectors/ReportFormatSelector'
import type {
  ReportItemConfig,
  ReportFormat,
  DateSelectionMode,
  EmployeeCategoryItem,
  ReportEmployeeItem,
} from '../types'

interface ReportConfigModalProps {
  open: boolean
  onClose: () => void
  report: ReportItemConfig | null
  categories: EmployeeCategoryItem[]
  categoriesLoading?: boolean
  employees: ReportEmployeeItem[]
  employeesLoading?: boolean
  onGenerate: (params: {
    reportKey: string
    format: ReportFormat
    dateMode: DateSelectionMode
    singleDate: string
    month: string
    year: string
    startDate: string
    endDate: string
    selectedCategoryIds: string[]
    selectedEmployeeIds: string[]
  }) => Promise<void>
  isGenerating?: boolean
}

export const ReportConfigModal: React.FC<ReportConfigModalProps> = ({
  open,
  onClose,
  report,
  categories,
  categoriesLoading,
  employees,
  employeesLoading,
  onGenerate,
  isGenerating,
}) => {
  if (!report) return null

  // Date States
  const [dateMode, setDateMode] = useState<DateSelectionMode>(
    report.defaultDateMode || 'fixed',
  )
  const todayStr = new Date().toISOString().slice(0, 10)
  const [singleDate, setSingleDate] = useState<string>(todayStr)

  const currentMonthNum = String(new Date().getMonth() + 1)
  const currentYearNum = String(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthNum)
  const [selectedYear, setSelectedYear] = useState<string>(currentYearNum)

  const [startDate, setStartDate] = useState<string>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10),
  )
  const [endDate, setEndDate] = useState<string>(todayStr)

  // Format State
  const [selectedFormat, setSelectedFormat] = useState<ReportFormat>(
    report.defaultFormat || 'excel',
  )

  // Selection States
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([])

  // Search queries
  const [categorySearchQuery, setCategorySearchQuery] = useState('')
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('')

  // Sync defaults when report changes
  useEffect(() => {
    if (report) {
      setDateMode(report.defaultDateMode || report.supportedDateModes[0] || 'fixed')
      setSelectedFormat(report.defaultFormat || report.supportedFormats[0] || 'excel')
      setSelectedCategoryIds([])
      setSelectedEmployeeIds([])
      setCategorySearchQuery('')
      setEmployeeSearchQuery('')
    }
  }, [report])

  // Validation
  const canGenerate = () => {
    if (isGenerating) return false
    if (report.needsEmployeeSelection && selectedEmployeeIds.length === 0) {
      return false
    }
    if (dateMode === 'singleDate' && !singleDate) return false
    if (dateMode === 'fixed' && (!selectedMonth || !selectedYear)) return false
    if (dateMode === 'range' && (!startDate || !endDate)) return false
    return true
  }

  const handleGenerateClick = async () => {
    if (!canGenerate()) return
    await onGenerate({
      reportKey: report.key,
      format: selectedFormat,
      dateMode,
      singleDate,
      month: selectedMonth,
      year: selectedYear,
      startDate,
      endDate,
      selectedCategoryIds,
      selectedEmployeeIds,
    })
  }

  const Icon = report.icon

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[96vw] sm:max-w-[96vw] md:max-w-6xl lg:max-w-7xl xl:max-w-7xl !max-w-7xl p-5 h-[90vh] max-h-[90vh] flex flex-col">
        <DialogHeader className="border-b border-border pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                {report.label}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {report.description}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Modal Body: 3-COLUMN SYSTEM */}
        <div className="flex-1 overflow-y-auto py-3 pr-1">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4.5 items-start">
            {/* Column 1: Period Selection & Format */}
            <div className="space-y-3.5 flex flex-col">
              {report.supportedDateModes.length > 0 && (
                <ReportDateSelector
                  supportedModes={report.supportedDateModes}
                  currentMode={dateMode}
                  onModeChange={setDateMode}
                  singleDate={singleDate}
                  onSingleDateChange={setSingleDate}
                  selectedMonth={selectedMonth}
                  onSelectedMonthChange={setSelectedMonth}
                  selectedYear={selectedYear}
                  onSelectedYearChange={setSelectedYear}
                  startDate={startDate}
                  endDate={endDate}
                  onRangeChange={(start, end) => {
                    setStartDate(start)
                    setEndDate(end)
                  }}
                />
              )}

              <ReportFormatSelector
                supportedFormats={report.supportedFormats}
                selectedFormat={selectedFormat}
                onFormatChange={setSelectedFormat}
              />

              {/* Selection Summary Block */}
              <div className="rounded-lg bg-muted/40 p-3.5 border border-border/70 text-xs text-muted-foreground space-y-2">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <AlertCircle className="size-3.5 text-primary" />
                  <span>Report Configuration</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/50">
                  <div>
                    <span className="block text-[10px] text-muted-foreground uppercase tracking-wider">Format</span>
                    <span className="font-semibold text-foreground uppercase">{selectedFormat}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-muted-foreground uppercase tracking-wider">Employees</span>
                    <span className="font-semibold text-foreground">{selectedEmployeeIds.length} Selected</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-muted-foreground uppercase tracking-wider">Date Mode</span>
                    <span className="font-semibold text-foreground capitalize">{dateMode}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-muted-foreground uppercase tracking-wider">Categories</span>
                    <span className="font-semibold text-foreground">
                      {selectedCategoryIds.length > 0 ? `${selectedCategoryIds.length} Selected` : 'All'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 2: Filter by Category */}
            <div className="h-full">
              {report.needsCategorySelection ? (
                <ReportCategorySelector
                  categories={categories}
                  selectedCategories={selectedCategoryIds}
                  onSelectionChange={setSelectedCategoryIds}
                  isLoading={categoriesLoading}
                  searchQuery={categorySearchQuery}
                  onSearchQueryChange={setCategorySearchQuery}
                />
              ) : (
                <div className="h-full rounded-lg border border-dashed border-border/80 p-6 flex flex-col items-center justify-center text-center text-xs text-muted-foreground">
                  <p>Category selection is not required for this report type.</p>
                </div>
              )}
            </div>

            {/* Column 3: Select Employees */}
            <div className="h-full">
              {report.needsEmployeeSelection ? (
                <ReportEmployeeSelector
                  employees={employees}
                  selectedEmployees={selectedEmployeeIds}
                  onSelectionChange={setSelectedEmployeeIds}
                  isLoading={employeesLoading}
                  searchQuery={employeeSearchQuery}
                  onSearchQueryChange={setEmployeeSearchQuery}
                  selectedCategoryIds={selectedCategoryIds}
                />
              ) : (
                <div className="h-full rounded-lg border border-dashed border-border/80 p-6 flex flex-col items-center justify-center text-center text-xs text-muted-foreground">
                  <p>Employee selection is not required for this report type.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <DialogFooter className="border-t border-border pt-3 flex items-center justify-between gap-3 sm:justify-between shrink-0">
          <div className="text-xs text-muted-foreground">
            {report.needsEmployeeSelection && selectedEmployeeIds.length === 0 && (
              <span className="text-amber-600 font-medium">
                * Please select at least one employee from Column 3
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isGenerating}
              className="h-8 text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleGenerateClick}
              disabled={!canGenerate()}
              className="h-8 gap-1.5 text-xs font-medium cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Download className="size-3.5" />
                  <span>Generate Report</span>
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
