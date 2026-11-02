import React from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { CalendarDays } from 'lucide-react'
import type { RosterUser, Shift } from '../types'

interface RosterTableProps {
  users: RosterUser[]
  daysInMonth: number[]
  selectedMonth: string
  currentYear: number
  shifts: Shift[]
  isLoading: boolean
  onCellClick: (user: RosterUser, day: number, month: string, year: number) => void
}

export const RosterTable: React.FC<RosterTableProps> = ({
  users,
  daysInMonth,
  selectedMonth,
  currentYear,
  shifts,
  isLoading,
  onCellClick,
}) => {
  const monthInt = parseInt(selectedMonth, 10)

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-3 bg-card h-full min-h-[350px]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-xs text-muted-foreground">Loading employee monthly roster...</p>
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-2 bg-card h-full min-h-[350px] text-center">
        <CalendarDays className="size-8 text-muted-foreground/40 mb-1" />
        <p className="text-sm font-semibold text-foreground">No employees found</p>
        <p className="text-xs text-muted-foreground max-w-sm">
          No employees match your current search and filter criteria. Try adjusting the filters.
        </p>
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="min-h-0 flex-1 overflow-auto bg-card">
        <table className="w-full border-separate border-spacing-0 text-left text-xs">
          <thead className="sticky top-0 z-20 bg-card shadow-2xs">
            <tr className="text-muted-foreground font-semibold">
              {/* Sticky / Freezed First Column: Employee */}
              <th className="sticky left-0 top-0 z-30 bg-card py-2.5 px-3 min-w-[200px] border-t border-b border-l border-r border-gray-200 dark:border-border shadow-[1px_0_0_0_rgba(0,0,0,0.06)] uppercase tracking-wider text-[11px] font-semibold text-muted-foreground">
                EMPLOYEE
              </th>

              <th className="py-2.5 px-3 min-w-[130px] border-t border-b border-r border-gray-200 dark:border-border uppercase tracking-wider text-[11px] font-semibold text-muted-foreground">
                CATEGORY
              </th>

              <th className="py-2.5 px-3 min-w-[130px] border-t border-b border-r border-gray-200 dark:border-border uppercase tracking-wider text-[11px] font-semibold text-muted-foreground">
                DESIGNATION
              </th>

              <th className="py-2.5 px-3 min-w-[130px] border-t border-b border-r border-gray-200 dark:border-border uppercase tracking-wider text-[11px] font-semibold text-muted-foreground">
                DEPARTMENT
              </th>

              <th className="py-2.5 px-3 min-w-[110px] border-t border-b border-r border-gray-200 dark:border-border uppercase tracking-wider text-[11px] font-semibold text-muted-foreground">
                SHIFT TYPE
              </th>

              {daysInMonth.map((day) => {
                const dateObj = new Date(currentYear, monthInt, day)
                const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' })
                const isSunday = dateObj.getDay() === 0

                return (
                  <th
                    key={day}
                    className={`py-2 px-1 text-center min-w-[60px] border-t border-b border-r border-gray-200 dark:border-border select-none ${
                      isSunday ? 'bg-amber-500/10' : ''
                    }`}
                  >
                    <div className="flex flex-col items-center justify-center leading-tight">
                      <span className="text-[10px] text-muted-foreground uppercase font-medium">
                        {dayName}
                      </span>
                      <span className="font-bold text-xs text-foreground">{day}</span>
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody>
            {users.map((user) => {
              const fullName =
                `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Employee'
              const categoryName = user.employee_category_id?.employee_category_name || '-'
              const designationName =
                user.designation_id?.designation_name || user.designation_id?.name || '-'
              const departmentName = user.department_name || '-'
              const isMonthly = user.shift_type === 'monthly'

              return (
                <tr
                  key={String(user.id)}
                  className="hover:bg-muted/40 transition-colors group"
                >
                  {/* Sticky / Freezed Employee Name Cell */}
                  <td className="sticky left-0 z-10 bg-card group-hover:bg-muted/50 transition-colors py-2 px-3 border-b border-l border-r border-gray-200 dark:border-border shadow-[1px_0_0_0_rgba(0,0,0,0.06)] whitespace-nowrap">
                    <div>
                      <p className="font-semibold text-foreground truncate">{fullName}</p>
                      {user.employee_code && (
                        <p className="text-[10px] text-muted-foreground">ID: {user.employee_code}</p>
                      )}
                    </div>
                  </td>

                  <td className="py-2 px-3 border-b border-r border-gray-200 dark:border-border text-muted-foreground whitespace-nowrap">
                    {categoryName}
                  </td>

                  <td className="py-2 px-3 border-b border-r border-gray-200 dark:border-border text-muted-foreground whitespace-nowrap">
                    {designationName}
                  </td>

                  <td className="py-2 px-3 border-b border-r border-gray-200 dark:border-border text-muted-foreground whitespace-nowrap">
                    {departmentName}
                  </td>

                  <td className="py-2 px-3 border-b border-r border-gray-200 dark:border-border whitespace-nowrap">
                    <Badge
                      variant={isMonthly ? 'default' : 'secondary'}
                      className="text-[10px] font-normal"
                    >
                      {user.shift_type
                        ? user.shift_type.charAt(0).toUpperCase() + user.shift_type.slice(1)
                        : 'Not Assigned'}
                    </Badge>
                  </td>

                  {daysInMonth.map((day) => {
                    const dateString = `${String(day).padStart(2, '0')}-${String(monthInt + 1).padStart(2, '0')}-${currentYear}`

                    let monthlyShiftsArr: any[] = []
                    if (Array.isArray(user.monthly_shifts)) {
                      monthlyShiftsArr = user.monthly_shifts
                    } else if (typeof user.monthly_shifts === 'string') {
                      try {
                        monthlyShiftsArr = JSON.parse(user.monthly_shifts)
                      } catch {
                        monthlyShiftsArr = []
                      }
                    }

                    const currentShiftData = monthlyShiftsArr.find(
                      (ms: any) => ms?.date_string === dateString
                    )

                    let shiftNames = '-'
                    let isWeekOff = false

                    if (currentShiftData?.shift_ids?.length > 0) {
                      const names = currentShiftData.shift_ids.map((s: any) => {
                        const sId = s.shift_id?.shift_id ?? s.shift_id?.id ?? s.shift_id ?? s
                        if (String(sId) === '0') {
                          isWeekOff = true
                          return 'Week Off'
                        }
                        const shiftObj = shifts.find(
                          (sh) => String(sh.shift_id ?? sh.id) === String(sId)
                        )
                        return shiftObj ? shiftObj.shift_name || shiftObj.name : 'Shift'
                      })
                      shiftNames = names.join(', ')
                    }

                    const tooltipText = shiftNames === '-' ? 'No Shift' : shiftNames

                    return (
                      <td
                        key={day}
                        className="py-1 px-1 border-b border-r border-gray-200 dark:border-border text-center"
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => onCellClick(user, day, selectedMonth, currentYear)}
                              className={`w-full max-w-[58px] truncate text-center cursor-pointer transition-all hover:underline font-medium rounded px-1.5 py-0.5 block mx-auto text-[11px] ${
                                isWeekOff
                                  ? 'text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 hover:bg-emerald-500/20'
                                  : shiftNames !== '-'
                                  ? 'text-primary font-medium hover:bg-primary/10'
                                  : 'text-muted-foreground/60 hover:text-foreground hover:bg-muted/50'
                              }`}
                            >
                              {shiftNames}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs max-w-xs text-center py-1.5 px-2.5">
                            <p className="font-semibold">{tooltipText}</p>
                            <p className="text-[10px] opacity-80 mt-0.5">
                              {fullName} • {dateString}
                            </p>
                            <p className="text-[9px] opacity-60 italic mt-0.5">Click to edit shift</p>
                          </TooltipContent>
                        </Tooltip>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </TooltipProvider>
  )
}
