import React, { useState } from 'react'
import {
  Search,
  Filter,
  ArrowUpDown,
  X,
  Check,
  Building2,
  Briefcase,
  Layers,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface FilterOption {
  label: string
  value: string
}

interface RosterFiltersProps {
  selectedMonth: string
  onMonthChange: (month: string) => void
  monthOptions: FilterOption[]
  selectedCategory: string
  onCategoryChange: (category: string) => void
  tableCategoryOptions: FilterOption[]
  isLoadingCats: boolean
  searchQuery: string
  onSearchChange: (query: string) => void
  sortSelected: string
  onSortChange: (sort: string) => void
  sortOptions: Array<{ label: string; value: string }>
  departmentOptions: FilterOption[]
  selectedDepartments: string[]
  onDepartmentsChange: (departments: string[]) => void
  designationOptions: FilterOption[]
  selectedDesignations: string[]
  onDesignationsChange: (designations: string[]) => void
  categoryOptions: FilterOption[]
  selectedCategories: string[]
  onCategoriesChange: (categories: string[]) => void
  onClearAll: () => void
}

export const RosterFilters: React.FC<RosterFiltersProps> = ({
  selectedMonth,
  onMonthChange,
  monthOptions,
  selectedCategory,
  onCategoryChange,
  tableCategoryOptions,
  isLoadingCats,
  searchQuery,
  onSearchChange,
  sortSelected,
  onSortChange,
  sortOptions,
  departmentOptions,
  selectedDepartments,
  onDepartmentsChange,
  designationOptions,
  selectedDesignations,
  onDesignationsChange,
  categoryOptions,
  selectedCategories,
  onCategoriesChange,
  onClearAll,
}) => {
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)
  const [sortPopoverOpen, setSortPopoverOpen] = useState(false)
  const [activeFilterTab, setActiveFilterTab] = useState<'dept' | 'desig' | 'cat'>('dept')
  const [deptSearch, setDeptSearch] = useState('')
  const [desigSearch, setDesigSearch] = useState('')
  const [catSearch, setCatSearch] = useState('')

  const activeFilterCount =
    selectedDepartments.length + selectedDesignations.length + selectedCategories.length

  const toggleItem = (list: string[], item: string, onChange: (val: string[]) => void) => {
    if (list.includes(item)) {
      onChange(list.filter((x) => x !== item))
    } else {
      onChange([...list, item])
    }
  }

  const filteredDepts = departmentOptions.filter((d) =>
    d.label.toLowerCase().includes(deptSearch.toLowerCase())
  )
  const filteredDesigs = designationOptions.filter((d) =>
    d.label.toLowerCase().includes(desigSearch.toLowerCase())
  )
  const filteredCats = categoryOptions.filter((c) =>
    c.label.toLowerCase().includes(catSearch.toLowerCase())
  )

  const currentSortLabel =
    sortOptions.find((s) => s.value === sortSelected)?.label || 'Sort'

  return (
    <div className="flex shrink-0 flex-col border-b border-border bg-background">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5">
        {/* Left: Month and Category Selectors (matching Table subheader controls) */}
        <div className="flex items-center gap-2">
          <div className="w-[140px]">
            <Select value={selectedMonth} onValueChange={onMonthChange}>
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue placeholder="Select Month" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => (
                  <SelectItem key={m.value} value={m.value} className="text-xs">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-[170px]">
            <Select
              value={selectedCategory}
              onValueChange={onCategoryChange}
              disabled={isLoadingCats}
            >
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                {tableCategoryOptions.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value} className="text-xs">
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Right: Search, Unified Filter Popover, Unified Sort Popover */}
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by name, ID..."
              className="h-8 w-52 sm:w-60 pl-8 pr-7 text-xs bg-muted/30 focus-visible:bg-background rounded-lg"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* Unified Filter Button & Popover */}
          <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-md transition-colors cursor-pointer border border-border/60 bg-background h-8 shadow-2xs',
                  activeFilterCount > 0 &&
                    'text-primary font-semibold border-primary/30 bg-primary/5'
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
            <PopoverContent className="w-80 p-0 overflow-hidden shadow-lg border border-border" align="end">
              <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border bg-muted/30">
                <div className="flex items-center gap-1.5">
                  <Filter className="size-3.5 text-primary" />
                  <span className="text-xs font-semibold text-foreground">Filter Roster</span>
                </div>
                {activeFilterCount > 0 && (
                  <button
                    onClick={() => {
                      onDepartmentsChange([])
                      onDesignationsChange([])
                      onCategoriesChange([])
                    }}
                    className="text-[11px] text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                  >
                    Reset all
                  </button>
                )}
              </div>

              {/* Sub-tabs for Department, Designation, Category */}
              <div className="grid grid-cols-3 border-b border-border p-1 bg-muted/20 gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setActiveFilterTab('dept')}
                  className={cn(
                    'py-1 px-1.5 rounded text-center transition-colors font-medium flex items-center justify-center gap-1 cursor-pointer',
                    activeFilterTab === 'dept'
                      ? 'bg-background shadow-2xs text-primary font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Building2 className="size-3" />
                  <span>Dept</span>
                  {selectedDepartments.length > 0 && (
                    <span className="size-1.5 rounded-full bg-primary" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilterTab('desig')}
                  className={cn(
                    'py-1 px-1.5 rounded text-center transition-colors font-medium flex items-center justify-center gap-1 cursor-pointer',
                    activeFilterTab === 'desig'
                      ? 'bg-background shadow-2xs text-primary font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Briefcase className="size-3" />
                  <span>Desig</span>
                  {selectedDesignations.length > 0 && (
                    <span className="size-1.5 rounded-full bg-primary" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilterTab('cat')}
                  className={cn(
                    'py-1 px-1.5 rounded text-center transition-colors font-medium flex items-center justify-center gap-1 cursor-pointer',
                    activeFilterTab === 'cat'
                      ? 'bg-background shadow-2xs text-primary font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Layers className="size-3" />
                  <span>Category</span>
                  {selectedCategories.length > 0 && (
                    <span className="size-1.5 rounded-full bg-primary" />
                  )}
                </button>
              </div>

              {/* Tab Contents */}
              <div className="p-3">
                {activeFilterTab === 'dept' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Select Departments ({selectedDepartments.length})
                      </span>
                      {selectedDepartments.length > 0 && (
                        <button
                          type="button"
                          onClick={() => onDepartmentsChange([])}
                          className="text-[10px] text-muted-foreground hover:text-primary cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <Input
                      placeholder="Search departments..."
                      value={deptSearch}
                      onChange={(e) => setDeptSearch(e.target.value)}
                      className="h-7 text-xs bg-background"
                    />
                    <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
                      {filteredDepts.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2 text-center">
                          No departments found
                        </p>
                      ) : (
                        filteredDepts.map((d) => (
                          <label
                            key={d.value}
                            className="flex items-center gap-2 p-1.5 hover:bg-muted rounded text-xs cursor-pointer"
                          >
                            <Checkbox
                              checked={selectedDepartments.includes(d.value)}
                              onCheckedChange={() =>
                                toggleItem(selectedDepartments, d.value, onDepartmentsChange)
                              }
                            />
                            <span className="truncate">{d.label}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {activeFilterTab === 'desig' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Select Designations ({selectedDesignations.length})
                      </span>
                      {selectedDesignations.length > 0 && (
                        <button
                          type="button"
                          onClick={() => onDesignationsChange([])}
                          className="text-[10px] text-muted-foreground hover:text-primary cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <Input
                      placeholder="Search designations..."
                      value={desigSearch}
                      onChange={(e) => setDesigSearch(e.target.value)}
                      className="h-7 text-xs bg-background"
                    />
                    <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
                      {filteredDesigs.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2 text-center">
                          No designations found
                        </p>
                      ) : (
                        filteredDesigs.map((d) => (
                          <label
                            key={d.value}
                            className="flex items-center gap-2 p-1.5 hover:bg-muted rounded text-xs cursor-pointer"
                          >
                            <Checkbox
                              checked={selectedDesignations.includes(d.value)}
                              onCheckedChange={() =>
                                toggleItem(selectedDesignations, d.value, onDesignationsChange)
                              }
                            />
                            <span className="truncate">{d.label}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {activeFilterTab === 'cat' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Select Categories ({selectedCategories.length})
                      </span>
                      {selectedCategories.length > 0 && (
                        <button
                          type="button"
                          onClick={() => onCategoriesChange([])}
                          className="text-[10px] text-muted-foreground hover:text-primary cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <Input
                      placeholder="Search categories..."
                      value={catSearch}
                      onChange={(e) => setCatSearch(e.target.value)}
                      className="h-7 text-xs bg-background"
                    />
                    <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
                      {filteredCats.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2 text-center">
                          No categories found
                        </p>
                      ) : (
                        filteredCats.map((c) => (
                          <label
                            key={c.value}
                            className="flex items-center gap-2 p-1.5 hover:bg-muted rounded text-xs cursor-pointer"
                          >
                            <Checkbox
                              checked={selectedCategories.includes(c.value)}
                              onCheckedChange={() =>
                                toggleItem(selectedCategories, c.value, onCategoriesChange)
                              }
                            />
                            <span className="truncate">{c.label}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Unified Sort Button & Popover */}
          <Popover open={sortPopoverOpen} onOpenChange={setSortPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-md transition-colors cursor-pointer border border-border/60 bg-background h-8 shadow-2xs"
              >
                <ArrowUpDown className="size-3.5 text-muted-foreground" />
                <span className="truncate max-w-[120px]">{currentSortLabel}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-1.5 space-y-1" align="end">
              <span className="text-[11px] font-semibold text-muted-foreground px-2 py-1 block border-b border-border/60 pb-1.5">
                Sort Options
              </span>
              {sortOptions.map((opt) => {
                const isSelected = sortSelected === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onSortChange(opt.value)
                      setSortPopoverOpen(false)
                    }}
                    className={cn(
                      'flex items-center justify-between w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer',
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
        </div>
      </div>

      {/* Active Filter Chips / Pills */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-5 pb-2.5 pt-0">
          <span className="text-[11px] text-muted-foreground mr-1">Active filters:</span>

          {selectedDepartments.map((d) => (
            <Badge
              key={`dept-${d}`}
              variant="secondary"
              className="gap-1 pl-2 pr-1 py-0.5 text-[11px] font-normal"
            >
              <span>Dept: {d}</span>
              <button
                type="button"
                onClick={() =>
                  onDepartmentsChange(selectedDepartments.filter((x) => x !== d))
                }
                className="hover:bg-muted rounded p-0.5 cursor-pointer"
              >
                <X className="size-2.5" />
              </button>
            </Badge>
          ))}

          {selectedDesignations.map((d) => (
            <Badge
              key={`desig-${d}`}
              variant="secondary"
              className="gap-1 pl-2 pr-1 py-0.5 text-[11px] font-normal"
            >
              <span>Desig: {d}</span>
              <button
                type="button"
                onClick={() =>
                  onDesignationsChange(selectedDesignations.filter((x) => x !== d))
                }
                className="hover:bg-muted rounded p-0.5 cursor-pointer"
              >
                <X className="size-2.5" />
              </button>
            </Badge>
          ))}

          {selectedCategories.map((c) => (
            <Badge
              key={`cat-${c}`}
              variant="secondary"
              className="gap-1 pl-2 pr-1 py-0.5 text-[11px] font-normal"
            >
              <span>Cat: {c}</span>
              <button
                type="button"
                onClick={() =>
                  onCategoriesChange(selectedCategories.filter((x) => x !== c))
                }
                className="hover:bg-muted rounded p-0.5 cursor-pointer"
              >
                <X className="size-2.5" />
              </button>
            </Badge>
          ))}

          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  )
}
