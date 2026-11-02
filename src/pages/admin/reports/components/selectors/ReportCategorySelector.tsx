import React, { useMemo } from 'react'
import { Search, X, CheckSquare, Square, MinusSquare, Layers } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import type { EmployeeCategoryItem } from '../../types'

interface ReportCategorySelectorProps {
  categories: EmployeeCategoryItem[]
  selectedCategories: string[]
  onSelectionChange: (selectedIds: string[]) => void
  isLoading?: boolean
  searchQuery: string
  onSearchQueryChange: (query: string) => void
}

export const ReportCategorySelector: React.FC<ReportCategorySelectorProps> = ({
  categories,
  selectedCategories,
  onSelectionChange,
  isLoading,
  searchQuery,
  onSearchQueryChange,
}) => {
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories
    const q = searchQuery.toLowerCase().trim()
    return categories.filter((c) =>
      c.employee_category_name.toLowerCase().includes(q),
    )
  }, [categories, searchQuery])

  const allFilteredSelected =
    filteredCategories.length > 0 &&
    filteredCategories.every((c) =>
      selectedCategories.includes(String(c.employee_category_id)),
    )

  const someFilteredSelected =
    filteredCategories.some((c) =>
      selectedCategories.includes(String(c.employee_category_id)),
    ) && !allFilteredSelected

  const handleToggleAll = () => {
    if (allFilteredSelected) {
      const filteredIds = new Set(
        filteredCategories.map((c) => String(c.employee_category_id)),
      )
      onSelectionChange(selectedCategories.filter((id) => !filteredIds.has(id)))
    } else {
      const newSelected = new Set(selectedCategories)
      filteredCategories.forEach((c) =>
        newSelected.add(String(c.employee_category_id)),
      )
      onSelectionChange(Array.from(newSelected))
    }
  }

  const handleToggleCategory = (id: string) => {
    if (selectedCategories.includes(id)) {
      onSelectionChange(selectedCategories.filter((item) => item !== id))
    } else {
      onSelectionChange([...selectedCategories, id])
    }
  }

  return (
    <div className="flex flex-col h-full rounded-lg border border-border/80 bg-card p-3.5 space-y-3 shadow-2xs">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Layers className="size-3.5 text-primary" />
          Filter by Category
        </label>
        {selectedCategories.length > 0 && (
          <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
            {selectedCategories.length} selected
          </span>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search categories..."
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
          <span>Select All Categories ({filteredCategories.length})</span>
        </label>
      </div>

      {/* Categories List */}
      <div className="flex-1 overflow-y-auto space-y-1 pr-1 min-h-[260px] max-h-[460px]">
        {isLoading ? (
          <p className="py-12 text-center text-xs text-muted-foreground">
            Loading categories...
          </p>
        ) : filteredCategories.length === 0 ? (
          <p className="py-12 text-center text-xs text-muted-foreground">
            No categories found
          </p>
        ) : (
          filteredCategories.map((cat) => {
            const cid = String(cat.employee_category_id)
            const isChecked = selectedCategories.includes(cid)
            return (
              <label
                key={cid}
                className="flex items-center gap-2 rounded-md px-2.5 py-2 text-xs text-foreground hover:bg-muted/60 cursor-pointer transition-colors select-none"
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => handleToggleCategory(cid)}
                />
                <span className="flex-1 truncate font-medium">
                  {cat.employee_category_name}
                </span>
              </label>
            )
          })
        )}
      </div>
    </div>
  )
}
