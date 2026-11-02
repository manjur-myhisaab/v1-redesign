import { useMemo, useState } from 'react'
import type { FilterGroup, SortField } from '@/components/admin/GridToolbar'

// ---------------------------------------------------------------------------
// useListView — standard search + multi-select filter + sort state for any
// DataGrid list view. Pairs with <GridToolbar/>: spread `toolbar` onto it.
// ---------------------------------------------------------------------------

export interface ListFilterDef<T> {
  id: string
  label: string
  // distinct option values are derived from the rows unless `options` is given
  options?: { value: string; label?: string }[]
  get: (row: T) => string
}

export interface ListSortDef<T> extends SortField {
  // value used for comparison; strings sort with localeCompare, numbers numerically
  get: (row: T) => string | number
}

export interface UseListViewConfig<T> {
  rows: T[]
  // free-text search predicate source — concatenated lowercased text per row
  search?: (row: T) => string
  filters?: ListFilterDef<T>[]
  sorts?: ListSortDef<T>[]
  // default sort applied until the user picks one
  defaultSortKey?: string
  defaultSortDir?: 'asc' | 'desc'
}

export interface UseListViewResult<T> {
  view: T[]
  query: string
  setQuery: (v: string) => void
  sortKey: string | null
  sortDir: 'asc' | 'desc'
  setSortKey: (k: string) => void
  setSortDir: (d: 'asc' | 'desc') => void
  reset: () => void
  // ready-to-spread onto <GridToolbar/>
  toolbar: {
    query: string
    onQueryChange: (v: string) => void
    filterGroups: FilterGroup[]
    sortFields: SortField[]
    sortKey: string | null
    sortDir: 'asc' | 'desc'
    onSortKey: (k: string) => void
    onSortDir: (d: 'asc' | 'desc') => void
    onReset: () => void
  }
}

export function useListView<T>({
  rows,
  search,
  filters = [],
  sorts = [],
  defaultSortKey = null as unknown as string,
  defaultSortDir = 'asc',
}: UseListViewConfig<T>): UseListViewResult<T> {
  const [query, setQuery] = useState('')
  const [filterState, setFilterState] = useState<Record<string, Set<string>>>(
    {},
  )
  const [sortKey, setSortKeyRaw] = useState<string | null>(
    defaultSortKey || null,
  )
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultSortDir)

  const setSortKey = (k: string) =>
    setSortKeyRaw((prev) => (prev === k ? null : k))

  const toggleFilter = (id: string, value: string) =>
    setFilterState((prev) => {
      const next = { ...prev }
      const set = new Set(next[id] ?? [])
      if (set.has(value)) set.delete(value)
      else set.add(value)
      next[id] = set
      return next
    })

  const reset = () => {
    setQuery('')
    setFilterState({})
    setSortKeyRaw(defaultSortKey || null)
    setSortDir(defaultSortDir)
  }

  // build filter groups (deriving distinct options from data when not supplied)
  const filterGroups: FilterGroup[] = useMemo(
    () =>
      filters.map((f) => {
        const options =
          f.options ??
          [...new Set(rows.map((r) => f.get(r)).filter(Boolean))]
            .sort()
            .map((value) => ({ value }))
        return {
          id: f.id,
          label: f.label,
          options,
          selected: filterState[f.id] ?? new Set<string>(),
          onToggle: (value: string) => toggleFilter(f.id, value),
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters, rows, filterState],
  )

  const sortFields: SortField[] = sorts.map((s) => ({
    key: s.key,
    label: s.label,
  }))

  const view = useMemo(() => {
    const q = query.trim().toLowerCase()
    let out = rows.filter((r) => {
      if (q && search && !search(r).toLowerCase().includes(q)) return false
      for (const f of filters) {
        const sel = filterState[f.id]
        if (sel && sel.size > 0 && !sel.has(f.get(r))) return false
      }
      return true
    })
    if (sortKey) {
      const def = sorts.find((s) => s.key === sortKey)
      if (def) {
        const dir = sortDir === 'asc' ? 1 : -1
        out = [...out].sort((a, b) => {
          const av = def.get(a)
          const bv = def.get(b)
          if (typeof av === 'number' && typeof bv === 'number')
            return (av - bv) * dir
          return String(av).localeCompare(String(bv)) * dir
        })
      }
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query, filterState, sortKey, sortDir])

  return {
    view,
    query,
    setQuery,
    sortKey,
    sortDir,
    setSortKey,
    setSortDir,
    reset,
    toolbar: {
      query,
      onQueryChange: setQuery,
      filterGroups,
      sortFields,
      sortKey,
      sortDir,
      onSortKey: setSortKey,
      onSortDir: setSortDir,
      onReset: reset,
    },
  }
}
