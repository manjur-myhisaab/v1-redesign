import React, { useMemo } from 'react'
import { Search, X, CheckSquare, Square, MinusSquare, Users } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import type { ReportEmployeeItem } from '../../types'

interface ReportEmployeeSelectorProps {
  employees: ReportEmployeeItem[]
  selectedEmployees: string[]
  onSelectionChange: (selectedIds: string[]) => void
  isLoading?: boolean
  searchQuery: string
  onSearchQueryChange: (query: string) => void
  selectedCategoryIds: string[]
}

export const ReportEmployeeSelector: React.FC<ReportEmployeeSelectorProps> = ({
  employees,
  selectedEmployees,
  onSelectionChange,
  isLoading,
  searchQuery,
  onSearchQueryChange,
  selectedCategoryIds,
}) => {
  // Filter out archived & suspended employees
  const activeEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const st = (emp.status || '').toLowerCase()
      return st !== 'archived' && st !== 'suspended'
    })
  }, [employees])

  // Filter by category selection first
  const categoryFiltered = useMemo(() => {
    if (selectedCategoryIds.length === 0) return activeEmployees
    return activeEmployees.filter((emp) => {
      const catId =
        typeof emp.employee_category_id === 'object'
          ? String(emp.employee_category_id?.employee_category_id || '')
          : String(emp.employee_category_id || '')
      return selectedCategoryIds.includes(catId)
    })
  }, [activeEmployees, selectedCategoryIds])

  // Filter by search query
  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return categoryFiltered
    const q = searchQuery.toLowerCase().trim()
    return categoryFiltered.filter((emp) => {
      const name = `${emp.first_name || ''} ${emp.last_name || ''}`.toLowerCase()
      const code = (emp.employee_code || '').toLowerCase()
      return name.includes(q) || code.includes(q)
    })
  }, [categoryFiltered, searchQuery])

  const allFilteredSelected =
    filteredEmployees.length > 0 &&
    filteredEmployees.every((e) => selectedEmployees.includes(e.id))

  const someFilteredSelected =
    filteredEmployees.some((e) => selectedEmployees.includes(e.id)) &&
    !allFilteredSelected

  const handleToggleAll = () => {
    if (allFilteredSelected) {
      const filteredIds = new Set(filteredEmployees.map((e) => e.id))
      onSelectionChange(selectedEmployees.filter((id) => !filteredIds.has(id)))
    } else {
      const newSelected = new Set(selectedEmployees)
      filteredEmployees.forEach((e) => newSelected.add(e.id))
      onSelectionChange(Array.from(newSelected))
    }
  }

  const handleToggleEmployee = (id: string) => {
    if (selectedEmployees.includes(id)) {
      onSelectionChange(selectedEmployees.filter((item) => item !== id))
    } else {
      onSelectionChange([...selectedEmployees, id])
    }
  }

  return (
    <div className="flex flex-col h-full rounded-lg border border-border/80 bg-card p-3.5 space-y-3 shadow-2xs">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Users className="size-3.5 text-primary" />
          Select Employees
        </label>
        {selectedEmployees.length > 0 && (
          <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
            {selectedEmployees.length} of {categoryFiltered.length} selected
          </span>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search employee by name or code..."
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          className="h-8.5 pl-8 pr-7 text-xs bg-background"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchQueryChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="size-3" />
          </button>
        )}
      </div>

      {/* Select All row */}
      <div className="flex items-center justify-between border-b border-border/60 pb-2 pt-0.5">
        <label
          onClick={handleToggleAll}
          className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer select-none"
        >
          <div className="grid size-4 place-items-center">
            {allFilteredSelected ? (
              <CheckSquare className="size-4 text-primary" />
            ) : someFilteredSelected ? (
              <MinusSquare className="size-4 text-primary" />
            ) : (
              <Square className="size-4 text-muted-foreground" />
            )}
          </div>
          <span>Select All Employees ({filteredEmployees.length})</span>
        </label>
      </div>

      {/* Employee List */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-[260px] max-h-[460px]">
        {isLoading ? (
          <p className="py-12 text-center text-xs text-muted-foreground">
            Loading employees...
          </p>
        ) : filteredEmployees.length === 0 ? (
          <p className="py-12 text-center text-xs text-muted-foreground">
            No employees found
          </p>
        ) : (
          filteredEmployees.map((emp) => {
            const isChecked = selectedEmployees.includes(emp.id)
            const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Unnamed'
            const isInactive = emp.status === 'archived'

            return (
              <label
                key={emp.id}
                className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-xs text-foreground hover:bg-muted/60 cursor-pointer transition-colors select-none"
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => handleToggleEmployee(emp.id)}
                />
                <div className="grid size-6 place-items-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground shrink-0">
                  {fullName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-medium">{fullName}</span>
                    {isInactive && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 font-semibold">
                        Inactive
                      </span>
                    )}
                  </div>
                  {emp.employee_code && (
                    <span className="text-[10px] text-muted-foreground">
                      #{emp.employee_code}
                    </span>
                  )}
                </div>
              </label>
            )
          })
        )}
      </div>
    </div>
  )
}
