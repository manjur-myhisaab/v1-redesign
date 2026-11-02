import { useCallback, useMemo, useState, useEffect, useRef } from 'react'

import {
  Search,
  ListFilter,
  Filter,
  ArrowUpDown,
  SlidersHorizontal,
  Plus,
  X,
  Trash2,
  Check,
  Users,
  Loader2,
} from 'lucide-react'
import {
  DataEditor,
  GridCellKind,
  CompactSelection,
  type GridCell,
  type GridColumn,
  type Item,
  type EditableGridCell,
  type GridSelection,
  type Theme,
  type CustomCell,
  type CustomRenderer,
  type GridMouseEventArgs,
} from '@glideapps/glide-data-grid'
import '@glideapps/glide-data-grid/dist/index.css'
import { cn } from '@/lib/utils'
import { useTheme } from '@/components/theme-provider'
import { sound } from '@/lib/sound'
import {
  useShiftsQuery,
  useDeleteShiftMutation,
  useUpdateShiftMutation,
  useCreateShiftMutation,
} from '@/features/shifts/hooks/useShifts'
import type { Shift as BackendShift } from '@/features/shifts/api/shiftApi.types'
import ShiftFormModal from '@/features/shifts/components/ShiftFormModal'
import BulkAssignModal from '@/features/shifts/components/BulkAssignModal'

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

const ghostBtn =
  'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/

interface ColMeta {
  id: keyof BackendShift | 'id' | 'startTime' | 'endTime' | 'name' | 'actions'
  title: string
  width: number
  grow?: number
  type: 'text' | 'time' | 'number' | 'bool' | 'actions'
}

type ActionsCellData = {
  kind: 'actions-cell'
  shift: BackendShift
}
type ActionsCell = CustomCell<ActionsCellData>

// Exact Lucide SVG Data URLs for pixel-perfect rendering matching top bar icons
const editSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="%232F63D8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`

const trashSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="%23e11d48" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`

const imgEdit = new Image()
imgEdit.src = editSvg

const imgTrash = new Image()
imgTrash.src = trashSvg

// Custom renderer to draw exact Lucide SVG icons (Edit2, Trash2) in actions column
const actionsCellRenderer: CustomRenderer<ActionsCell> = {
  kind: GridCellKind.Custom,
  isMatch: (c): c is ActionsCell => (c.data as { kind?: string })?.kind === 'actions-cell',
  draw: (args) => {
    const { ctx, rect } = args
    const { x, y, width, height } = rect

    ctx.save()
    const colWidth = width / 2
    const iconSize = 15
    const centerY = y + (height - iconSize) / 2

    if (imgEdit.complete) {
      ctx.drawImage(imgEdit, x + colWidth * 0.5 - iconSize / 2, centerY, iconSize, iconSize)
    }
    if (imgTrash.complete) {
      ctx.drawImage(imgTrash, x + colWidth * 1.5 - iconSize / 2, centerY, iconSize, iconSize)
    }

    ctx.restore()
    return true
  },
  provideEditor: () => ({ editor: () => null }),
  onPaste: (_val, cellData) => cellData,
}

// Columns: Actions icon column right after selection checkbox, followed by Shift Name, Start Time & End Time
const COLUMNS: ColMeta[] = [
  { id: 'actions', title: 'Actions', width: 70, type: 'actions' },
  { id: 'shift_name', title: 'Shift Name', width: 260, grow: 1, type: 'text' },
  { id: 'shift_from', title: 'Shift Start Time', width: 180, type: 'time' },
  { id: 'shift_to', title: 'Shift End Time', width: 180, type: 'time' },
]


type SortKey = 'shift_name' | 'shift_from' | 'shift_to'
const SORT_FIELDS: { key: SortKey; label: string }[] = [
  { key: 'shift_name', label: 'Shift Name' },
  { key: 'shift_from', label: 'Start Time' },
  { key: 'shift_to', label: 'End Time' },
]

interface ShiftsGridProps {
  shifts?: any[]
  onChange?: (shifts: any[]) => void
  canEdit?: boolean
}

export default function ShiftsGrid({ shifts: propShifts, onChange, canEdit = true }: ShiftsGridProps) {
  const { data: apiShifts, isLoading } = useShiftsQuery()
  const deleteMutation = useDeleteShiftMutation()
  const updateMutation = useUpdateShiftMutation()
  const createMutation = useCreateShiftMutation()

  // Inline edit save status state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  // Shadcn AlertDialog delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [shiftsToDelete, setShiftsToDelete] = useState<{ ids: string[]; names: string; origIndices?: number[] } | null>(null)

  // Use API shifts if available (even when empty array), fallback to props only when apiShifts is undefined
  const rawShifts = useMemo(() => {
    if (Array.isArray(apiShifts)) return apiShifts
    return propShifts || []
  }, [apiShifts, propShifts])

  // Form & Bulk modal controls
  const [formModalOpen, setFormModalOpen] = useState(false)
  const [shiftToEdit, setShiftToEdit] = useState<BackendShift | null>(null)
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [bulkShiftId, setBulkShiftId] = useState<string | undefined>()



  const [query, setQuery] = useState('')
  const { theme } = useTheme()
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) ||
    document.documentElement.classList.contains('dark')

  // Theme matching Category section #2F63D8
  const gridTheme = useMemo<Partial<Theme>>(() => {
    if (isDark) {
      return {
        accentColor: '#2F63D8',
        accentLight: 'rgba(47,99,216,0.20)',
        textDark: '#f4f4f5',
        textMedium: '#d4d4d8',
        textLight: '#a1a1aa',
        textHeader: '#a1a1aa',
        bgCell: '#1c1c1f',
        bgHeader: '#27272a',
        bgHeaderHovered: '#3f3f46',
        bgHeaderHasFocus: '#52525b',
        borderColor: 'rgba(255,255,255,0.08)',
        horizontalBorderColor: 'rgba(255,255,255,0.05)',
        headerFontStyle: '600 13px',
        baseFontStyle: '13px',
        fontFamily: 'system-ui, sans-serif',
        cellHorizontalPadding: 12,
      }
    }
    return {
      accentColor: '#2F63D8',
      accentLight: 'rgba(47,99,216,0.12)',
      textDark: '#1a1d23',
      textMedium: '#52525b',
      textLight: '#9ca3af',
      textHeader: '#6b7280',
      bgCell: '#ffffff',
      bgHeader: '#fafafa',
      bgHeaderHovered: '#f4f4f5',
      bgHeaderHasFocus: '#f0f0f0',
      borderColor: 'rgba(20,20,30,0.10)',
      horizontalBorderColor: 'rgba(20,20,30,0.07)',
      headerFontStyle: '600 13px',
      baseFontStyle: '13px',
      fontFamily: "'HSB Sans', system-ui, sans-serif",
      cellHorizontalPadding: 12,
    }
  }, [isDark])

  const [activeOnly, setActiveOnly] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [openMenu, setOpenMenu] = useState<'filter' | 'sort' | 'options' | null>(null)

  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  })

  // Strictly convert Boolean properties to avoid truthy fallbacks
  const normalizedShifts = useMemo(() => {
    return rawShifts.map((s: any) => {
      const id = s.shift_id || s.id || ''
      const shift_name = s.shift_name || s.name || 'General'
      const shift_from = s.shift_from ? s.shift_from.substring(0, 5) : s.startTime || '09:00'
      const shift_to = s.shift_to ? s.shift_to.substring(0, 5) : s.endTime || '18:00'
      const shift_type = s.shift_type || 'FIXED'
      const status = s.status || 'active'

      return {
        ...s,
        shift_id: id,
        shift_name,
        shift_from,
        shift_to,
        shift_type,
        status,
        late_cutoff_minutes: s.late_cutoff_minutes ?? s.lateGraceMin ?? 0,
        early_cutoff_minutes: s.early_cutoff_minutes ?? s.earlyLeaveGraceMin ?? 0,
        applicable_for_overnight: Boolean(s.applicable_for_overnight),
        applicable_for_break: Boolean(s.applicable_for_break),
        auto_punch_out: Boolean(s.auto_punch_out),
        applicable_for_minimum_working_hours: Boolean(s.applicable_for_minimum_working_hours),
        lates_counted_as_half_day: s.lates_counted_as_half_day ?? s.halfDayAfterMin ?? 0,
        earlies_counted_as_half_day: s.earlies_counted_as_half_day ?? 0,
        lates_counted_as_absent: s.lates_counted_as_absent ?? 0,
        early_counted_as_absent: s.early_counted_as_absent ?? 0,
      }
    })
  }, [rawShifts])

  const view = useMemo(() => {
    const q = query.toLowerCase()
    let out = normalizedShifts
      .map((s, idx) => ({ s, idx }))
      .filter(({ s }) => s.shift_name.toLowerCase().includes(q) && (!activeOnly || s.status === 'active'))
    if (sortKey) {
      const dir = sortDir === 'asc' ? 1 : -1
      out = [...out].sort((a, b) => String(a.s[sortKey]).localeCompare(String(b.s[sortKey])) * dir)
    }
    return out
  }, [normalizedShifts, query, activeOnly, sortKey, sortDir])

  const containerRef = useRef<HTMLDivElement | null>(null)
  const userResizedRef = useRef(false)
  const [widths, setWidths] = useState<number[]>(() => COLUMNS.map((c) => c.width))

  const computeDistributedWidths = useCallback((containerWidth: number): number[] => {
    // Subtract checkbox marker width (approx 44px)
    const available = Math.max(500, containerWidth - 44)
    const actionsW = 80
    const rem = Math.max(300, available - actionsW)

    // Distribute remaining width proportionally: Shift Name (46%), Start Time (27%), End Time (27%)
    const shiftNameW = Math.max(220, Math.floor(rem * 0.46))
    const shiftFromW = Math.max(140, Math.floor(rem * 0.27))
    const shiftToW = Math.max(140, rem - shiftNameW - shiftFromW)

    return [actionsW, shiftNameW, shiftFromW, shiftToW]
  }, [])

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width
        if (w > 0 && !userResizedRef.current) {
          setWidths(computeDistributedWidths(w))
        }
      }
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [computeDistributedWidths])

  const columns: GridColumn[] = useMemo(
    () =>
      COLUMNS.map((c, i) => ({
        id: c.id,
        title: c.title,
        width: widths[i],
        grow: c.grow,
      })),
    [widths],
  )


  const getCellContent = useCallback(

    ([col, row]: Item): GridCell => {
      const meta = COLUMNS[col]
      const item = view[row]?.s
      if (!item) return { kind: GridCellKind.Text, data: '', displayData: '', allowOverlay: false }

      if (meta.id === 'actions') {
        return {
          kind: GridCellKind.Custom,
          copyData: '',
          data: { kind: 'actions-cell', shift: item },
          allowOverlay: false,
          readonly: true,
        }
      }

      if (meta.type === 'bool') {
        const val = Boolean(item[meta.id as keyof typeof item])
        return {
          kind: GridCellKind.Boolean,
          data: val,
          allowOverlay: false,
          readonly: !canEdit,
        }
      }

      if (meta.type === 'number') {
        const val = Number(item[meta.id as keyof typeof item] ?? 0)
        return {
          kind: GridCellKind.Number,
          data: val,
          displayData: String(val),
          allowOverlay: canEdit,
          readonly: !canEdit,
          contentAlign: 'left',
        }
      }

      const v = String(item[meta.id as keyof typeof item] ?? '')
      return {
        kind: GridCellKind.Text,
        data: v,
        displayData: v,
        allowOverlay: canEdit,
        readonly: !canEdit,
      }
    },
    [view, canEdit],
  )

  const onCellEdited = useCallback(
    ([col, row]: Item, newValue: EditableGridCell) => {
      const meta = COLUMNS[col]
      const item = view[row]?.s
      if (!item) return

      const origIdx = view[row].idx
      const updatedShift = { ...item }

      if (meta.type === 'bool' && newValue.kind === GridCellKind.Boolean) {
        updatedShift[meta.id as string] = newValue.data === true
      } else if (meta.type === 'number' && newValue.kind === GridCellKind.Number) {
        updatedShift[meta.id as string] = Math.max(0, Math.trunc(newValue.data ?? 0))
      } else if (newValue.kind === GridCellKind.Text) {
        const val = newValue.data
        if (meta.type === 'time' && val && !TIME_REGEX.test(val)) return
        updatedShift[meta.id as string] = val
      }

      // Inline edit: show spinner, play sound, and display Saved badge instead of toast popup
      if (item.shift_id && Array.isArray(apiShifts) && apiShifts.length > 0) {
        setSaveStatus('saving')
        updateMutation.mutate(updatedShift, {
          onSuccess: () => {
            sound.success()
            setSaveStatus('saved')
            setTimeout(() => setSaveStatus('idle'), 2200)
          },
          onError: () => {
            sound.error()
            setSaveStatus('idle')
          },
        })
      } else if (onChange) {
        sound.success()
        const next = rawShifts.map((s: any, i: number) => (i === origIdx ? updatedShift : s))
        onChange(next)
      }
    },
    [view, rawShifts, apiShifts, onChange, updateMutation],
  )

  const onCellClicked = useCallback(
    ([col, row]: Item, event: GridMouseEventArgs) => {
      if (row < 0 || row >= view.length) return
      const meta = COLUMNS[col]
      if (!meta) return

      if (meta.id === 'actions') {
        const item = view[row]?.s
        if (!item) return

        const localX = (event as any).localEventX ?? 0
        const sectionWidth = 70 / 2

        if (localX < sectionWidth) {
          // Edit Action (Lucide Edit2 SVG)
          setShiftToEdit(item)
          setFormModalOpen(true)
        } else {
          // Delete Action (Lucide Trash2 SVG) -> Triggers Shadcn AlertDialog
          const origIdx = view[row].idx
          setShiftsToDelete({
            ids: item.shift_id ? [item.shift_id] : [],
            names: `shift "${item.shift_name}"`,
            origIndices: [origIdx],
          })
          setDeleteConfirmOpen(true)
        }
      }
    },
    [view],
  )



  const clearSelection = () =>
    setSelection({ columns: CompactSelection.empty(), rows: CompactSelection.empty() })

  const selectedCount = selection.rows.length

  const handleBulkDelete = () => {
    const selectedIndices = selection.rows.toArray()
    const idsToDelete: string[] = []
    const origIndices: number[] = []

    selectedIndices.forEach((r) => {
      const s = view[r]?.s
      const idx = view[r]?.idx
      if (s?.shift_id) idsToDelete.push(s.shift_id)
      if (idx !== undefined) origIndices.push(idx)
    })

    if (selectedIndices.length > 0) {
      setShiftsToDelete({
        ids: idsToDelete,
        names: `${selectedIndices.length} selected shift(s)`,
        origIndices,
      })
      setDeleteConfirmOpen(true)
    }
  }

  const handleConfirmDelete = () => {
    if (!shiftsToDelete) return

    if (shiftsToDelete.ids.length > 0 && Array.isArray(apiShifts) && apiShifts.length > 0) {
      deleteMutation.mutate(shiftsToDelete.ids)
    } else if (onChange && shiftsToDelete.origIndices) {
      const origSet = new Set(shiftsToDelete.origIndices)
      onChange(rawShifts.filter((_, i) => !origSet.has(i)))
    }

    setDeleteConfirmOpen(false)
    setShiftsToDelete(null)
    clearSelection()
  }

  const handleCreateNew = () => {
    setShiftToEdit(null)
    setFormModalOpen(true)
  }

  const handleRowAppended = () => {
    const newShiftObj = {
      shift_name: 'General Shift',
      shift_from: '09:00',
      shift_to: '18:00',
      shift_type: 'FIXED',
      status: 'active',
    }
    if (Array.isArray(apiShifts) && apiShifts.length > 0) {
      createMutation.mutate(newShiftObj as any)
    } else if (onChange) {
      onChange([...rawShifts, newShiftObj])
    }
  }

  const resetView = () => {
    setQuery('')
    setActiveOnly(false)
    setSortKey(null)
    setSortDir('asc')
    setOpenMenu(null)
  }

  return (
    <div className="flex h-full w-full flex-col">
      {/* Toolbar */}
      {selectedCount > 0 ? (
        <div className="flex items-center gap-1 bg-primary/5 py-1.5 pl-2.5 pr-1.5 border-b border-border">
          <button
            onClick={clearSelection}
            className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Clear selection"
          >
            <X className="size-3.5" />
          </button>
          <span className="text-[13px] font-medium text-foreground">{selectedCount} selected</span>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={handleBulkDelete}
              className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-rose-600 transition-colors hover:bg-rose-50 dark:hover:bg-rose-950/30"
            >
              <Trash2 className="size-3.5" />
              Delete
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1 py-1.5 pl-2.5 pr-1.5 border-b border-border">
          <button className={ghostBtn}>
            <ListFilter className="size-3.5" />
            All
            <span className="text-muted-foreground">· {normalizedShifts.length}</span>
          </button>

          {/* Inline Edit Status Indicator Badge */}
          {saveStatus === 'saving' && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary animate-in fade-in">
              <Loader2 className="size-3 animate-spin" />
              Saving...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 text-xs font-medium text-emerald-600 animate-in fade-in">
              <Check className="size-3 text-emerald-600" />
              Saved
            </span>
          )}

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

            <Menu
              open={openMenu === 'filter'}
              onOpenChange={(o) => setOpenMenu(o ? 'filter' : null)}
              trigger={
                <button className={cn(ghostBtn, activeOnly && 'text-primary')}>
                  <Filter className="size-3.5" />
                  Filter
                </button>
              }
            >
              <button
                onClick={() => setActiveOnly((v) => !v)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-muted"
              >
                <span
                  className={cn(
                    'grid size-4 place-items-center rounded border',
                    activeOnly ? 'border-primary bg-primary text-white' : 'border-border',
                  )}
                >
                  {activeOnly && <Check className="size-3" strokeWidth={3} />}
                </span>
                Active shifts only
              </button>
            </Menu>

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
                  onClick={() => setSortKey(f.key)}
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
                <span className="text-muted-foreground">{sortDir === 'asc' ? 'A → Z' : 'Z → A'}</span>
              </button>
            </Menu>

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
                onClick={resetView}
                className="w-full rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-muted"
              >
                Reset view
              </button>
            </Menu>

            {/* Bulk Assign Button: Hidden when no shifts exist */}
            {normalizedShifts.length > 0 && (
              <button
                onClick={() => {
                  setBulkShiftId(undefined)
                  setBulkModalOpen(true)
                }}
                className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-xl border border-border px-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
              >
                <Users className="size-3.5" />
                Bulk Assign
              </button>
            )}

            {canEdit && (
              <button
                onClick={handleCreateNew}
                className="btn-3d ml-1 inline-flex h-7 cursor-pointer items-center gap-1 rounded-xl bg-primary px-2.5 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Plus className="size-3.5" />
                New record
              </button>
            )}
          </div>
        </div>
      )}

      {/* Glide Data Editor Grid */}
      <div ref={containerRef} className="min-h-0 flex-1 border-t border-border">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            Loading shifts...
          </div>
        ) : view.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center p-6">
            <p className="text-sm font-semibold text-foreground">No shifts found</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              There are currently no shifts created for your organization. Click "New record" to add a shift.
            </p>
          </div>
        ) : (
          <DataEditor
            className="h-full w-full"
            theme={gridTheme}
            columns={columns}
            rows={view.length}
            getCellContent={getCellContent}
            onCellEdited={onCellEdited}
            onCellClicked={onCellClicked}
            onColumnResize={(_, newSize, colIndex) => {
              userResizedRef.current = true
              setWidths((w) => w.map((x, i) => (i === colIndex ? newSize : x)))
            }}
            customRenderers={[actionsCellRenderer]}

            rowMarkers={canEdit ? 'checkbox-visible' : 'none'}
            rowSelectionMode="multi"
            gridSelection={selection}
            onGridSelectionChange={setSelection}
            getCellsForSelection
            smoothScrollX
            smoothScrollY
            rowHeight={33}
            headerHeight={33}
            onRowAppended={canEdit ? handleRowAppended : undefined}
            trailingRowOptions={canEdit ? { sticky: false, tint: true, hint: 'New shift' } : undefined}
          />

        )}
      </div>

      {/* Shift Form Modal */}
      <ShiftFormModal
        open={formModalOpen}
        onClose={() => {
          setFormModalOpen(false)
          setShiftToEdit(null)
        }}
        shiftToEdit={shiftToEdit}
      />


      {/* Bulk Shift Assignment Modal */}
      <BulkAssignModal
        open={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        initialShiftId={bulkShiftId}
      />

      {/* Shadcn Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete {shiftsToDelete?.names || 'the selected shift'} and remove its configuration from your organization.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmDelete()
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Menu({
  open,
  onOpenChange,
  trigger,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="relative">
      <div onClick={() => onOpenChange(!open)}>{trigger}</div>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => onOpenChange(false)} />
          <div className="absolute right-0 top-9 z-50 min-w-44 rounded-xl border border-border bg-popover p-1 shadow-lg duration-150 animate-in fade-in zoom-in-95">
            {children}
          </div>
        </>
      )}
    </div>
  )
}
