import React from 'react'
import {
  History,
  FileSpreadsheet,
  RotateCw,
  Maximize2,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { TimelineEmployee } from '../types'

interface TimelineHeaderProps {
  employees: TimelineEmployee[]
  selectedEmployeeId: string
  onSelectEmployee: (id: string) => void
  selectedDate: Date
  onSelectDate: (d: Date) => void
  isLoadingEmployees: boolean
  isLoadingTimeline: boolean
  hasData: boolean
  onLoadTimeline: () => void
  onExportReport: () => void
  onFitMap: () => void
}

export const TimelineHeader: React.FC<TimelineHeaderProps> = ({
  employees,
  selectedEmployeeId,
  onSelectEmployee,
  selectedDate,
  onSelectDate,
  isLoadingEmployees,
  isLoadingTimeline,
  hasData,
  onLoadTimeline,
  onExportReport,
  onFitMap,
}) => {
  const setDateToday = () => {
    onSelectDate(new Date())
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5 bg-card shadow-2xs">
      {/* Title & Description */}
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <History className="size-5 text-primary" />
            Timeline & Route Playback
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Step-by-step route playback, stop duration analysis, battery telemetry, and journey reports.
          </p>
        </div>
      </div>

      {/* Control Actions & Selectors */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Employee Selector (Shadcn Select) */}
        <div className="w-56 sm:w-64">
          <Select
            value={selectedEmployeeId}
            onValueChange={onSelectEmployee}
            disabled={isLoadingEmployees || employees.length === 0}
          >
            <SelectTrigger className="h-8.5 text-xs bg-background">
              <Users className="size-3.5 mr-1.5 text-muted-foreground shrink-0" />
              <SelectValue placeholder="Select Staff Member..." />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {employees.map((emp) => (
                <SelectItem key={emp.id} value={emp.id} className="text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{emp.full_name}</span>
                    {emp.department_name && (
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {emp.department_name}
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date Selector (Shadcn DatePicker + Popover + Calendar) */}
        <div className="flex items-center gap-1.5">
          <DatePicker
            value={selectedDate}
            onChange={(date) => date && onSelectDate(date)}
            className="h-8.5 w-44 text-xs bg-background font-normal"
            placeholder="Select date"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={setDateToday}
            className="h-8.5 text-xs px-2.5 font-medium cursor-pointer"
            title="Set Date to Today"
          >
            Today
          </Button>
        </div>

        {/* Load Journey Button */}
        <Button
          variant="default"
          size="sm"
          onClick={onLoadTimeline}
          disabled={!selectedEmployeeId || isLoadingTimeline}
          className="h-8.5 text-xs px-3.5 font-semibold gap-1.5 cursor-pointer shadow-2xs"
        >
          {isLoadingTimeline ? (
            <>
              <RotateCw className="size-3.5 animate-spin" />
              <span>Loading Route...</span>
            </>
          ) : (
            <>
              <RotateCw className="size-3.5" />
              <span>Load Journey</span>
            </>
          )}
        </Button>

        {/* Fit Bounds Button */}
        {hasData && (
          <Button
            variant="outline"
            size="sm"
            onClick={onFitMap}
            title="Fit map to show full route"
            className="h-8.5 text-xs px-2.5 gap-1.5 cursor-pointer"
          >
            <Maximize2 className="size-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">Fit Route</span>
          </Button>
        )}

        {/* Excel Report Download Button */}
        {hasData && (
          <Button
            variant="outline"
            size="sm"
            onClick={onExportReport}
            title="Download detailed Excel timeline report"
            className="h-8.5 text-xs px-3 gap-1.5 cursor-pointer bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
          >
            <FileSpreadsheet className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Export Report</span>
          </Button>
        )}
      </div>
    </div>
  )
}
