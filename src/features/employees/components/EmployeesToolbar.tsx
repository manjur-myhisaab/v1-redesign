import * as React from 'react'
import {
  Search,
  ChevronDown,
  ArrowUpDown,
  Filter,
  ListFilter,
  SlidersHorizontal,
  Plus,
  Trash2,
  Check,
  X,
} from 'lucide-react'
import Menu from './Menu'
import StatusBadge from '@/components/admin/StatusBadge'
import { STATUSES, statusTone } from '@/lib/employees'
import { cn } from '@/lib/utils'

const ghostBtn =
  'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'

export type SortKey = 'empCode' | 'name' | 'department' | 'status' | 'joined'

const SORT_FIELDS: { key: SortKey; label: string }[] = [
  { key: 'empCode', label: 'Employee ID' },
  { key: 'name', label: 'Name' },
  { key: 'department', label: 'Department' },
  { key: 'status', label: 'Status' },
  { key: 'joined', label: 'Joined' },
]

interface EmployeesToolbarProps {
  selectedCount: number
  totalCount: number
  query: string
  setQuery: (q: string) => void
  statusFilter: Set<string>
  setStatusFilter: React.Dispatch<React.SetStateAction<Set<string>>>
  sortKey: SortKey | null
  setSortKey: (k: SortKey | null) => void
  sortDir: 'asc' | 'desc'
  setSortDir: React.Dispatch<React.SetStateAction<'asc' | 'desc'>>
  bulkBusy: boolean
  onBulkStatus: (status: string) => void
  onBulkDelete: () => void
  onAddRow: () => void
  onResetView: () => void
  clearSelection: () => void
}

export default function EmployeesToolbar({
  selectedCount,
  totalCount,
  query,
  setQuery,
  statusFilter,
  setStatusFilter,
  sortKey,
  setSortKey,
  sortDir,
  setSortDir,
  bulkBusy,
  onBulkStatus,
  onBulkDelete,
  onAddRow,
  onResetView,
  clearSelection,
}: EmployeesToolbarProps) {
  const [openMenu, setOpenMenu] = React.useState<'filter' | 'sort' | 'options' | 'bulk' | null>(null)

  return (
    <>
      {selectedCount > 0 ? (
        <div className="flex items-center gap-1 bg-primary/5 py-1.5 pl-2.5 pr-1.5">
          <button
            onClick={clearSelection}
            className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Clear selection"
          >
            <X className="size-3.5" />
          </button>
          <span className="text-[13px] font-medium">
            {selectedCount} selected
          </span>

          <div className="ml-auto flex items-center gap-0.5">
            {/* bulk edit: set status */}
            <Menu
              open={openMenu === 'bulk'}
              onOpenChange={(o) => setOpenMenu(o ? 'bulk' : null)}
              trigger={
                <button className={ghostBtn} disabled={bulkBusy}>
                  <SlidersHorizontal className="size-3.5" />
                  Set status
                  <ChevronDown className="size-3.5" />
                </button>
              }
            >
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    onBulkStatus(s)
                    setOpenMenu(null)
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-muted"
                >
                  <StatusBadge tone={statusTone(s)}>{s}</StatusBadge>
                </button>
              ))}
            </Menu>
            <button
              onClick={onBulkDelete}
              disabled={bulkBusy}
              className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
            >
              <Trash2 className="size-3.5" />
              Delete
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1 py-1.5 pl-2.5 pr-1.5">
          <button className={ghostBtn}>
            <ListFilter className="size-3.5" />
            All
            <span className="text-muted-foreground">· {totalCount}</span>
          </button>

          <div className="ml-auto flex items-center gap-0.5">
            <div className="flex h-7 w-40 items-center gap-1.5 rounded-md px-2 text-[13px]">
              <Search className="size-3.5 shrink-0 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
              />
            </div>

            {/* Filter */}
            <Menu
              open={openMenu === 'filter'}
              onOpenChange={(o) => setOpenMenu(o ? 'filter' : null)}
              trigger={
                <button className={cn(ghostBtn, statusFilter.size > 0 && 'text-primary')}>
                  <Filter className="size-3.5" />
                  Filter
                  {statusFilter.size > 0 && (
                    <span className="rounded bg-primary/10 px-1 text-[11px] text-primary">
                      {statusFilter.size}
                    </span>
                  )}
                </button>
              }
            >
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Status
              </p>
              {STATUSES.map((s) => {
                const on = statusFilter.has(s)
                return (
                  <button
                    key={s}
                    onClick={() =>
                      setStatusFilter((prev) => {
                        const next = new Set(prev)
                        if (next.has(s)) next.delete(s)
                        else next.add(s)
                        return next
                      })
                    }
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-muted"
                  >
                    <span
                      className={cn(
                        'grid size-4 place-items-center rounded border',
                        on ? 'border-primary bg-primary text-white' : 'border-border',
                      )}
                    >
                      {on && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    {s}
                  </button>
                )
              })}
              {statusFilter.size > 0 && (
                <button
                  onClick={() => setStatusFilter(new Set())}
                  className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-[13px] text-muted-foreground hover:bg-muted"
                >
                  Clear filter
                </button>
              )}
            </Menu>

            {/* Sort */}
            <Menu
              open={openMenu === 'sort'}
              onOpenChange={(o) => setOpenMenu(o ? 'sort' : null)}
              trigger={
                <button className={cn(ghostBtn, sortKey && 'text-primary')}>
                  <ArrowUpDown className="size-3.5" />
                  Sort
                </button>
              }
            >
              {SORT_FIELDS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => {
                    setSortKey(f.key)
                    setOpenMenu(null)
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-muted"
                >
                  {f.label}
                  {sortKey === f.key && <Check className="size-3.5 text-primary" />}
                </button>
              ))}
              <div className="my-1 border-t border-border" />
              <button
                onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-muted"
              >
                Direction
                <span className="text-muted-foreground">
                  {sortDir === 'asc' ? 'A → Z' : 'Z → A'}
                </span>
              </button>
            </Menu>

            {/* Options */}
            <Menu
              open={openMenu === 'options'}
              onOpenChange={(o) => setOpenMenu(o ? 'options' : null)}
              trigger={
                <button className={ghostBtn}>
                  <SlidersHorizontal className="size-3.5" />
                  Options
                </button>
              }
            >
              <button
                onClick={() => {
                  onResetView()
                  setOpenMenu(null)
                }}
                className="w-full rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-muted"
              >
                Reset view
              </button>
            </Menu>

            <button
              onClick={onAddRow}
              className="btn-3d ml-1 inline-flex h-7 cursor-pointer items-center gap-1 rounded-xl bg-primary px-2.5 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="size-3.5" />
              New record
            </button>
          </div>
        </div>
      )}
    </>
  )
}
