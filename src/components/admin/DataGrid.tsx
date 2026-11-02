import { useCallback, useState, useMemo } from 'react'
import {
  DataEditor,
  GridCellKind,
  CompactSelection,
  type GridCell,
  type GridColumn as GlideColumn,
  type Item,
  type EditableGridCell,
  type GridSelection,
  type Theme,
  type CustomCell,
  type CustomRenderer,
} from '@glideapps/glide-data-grid'
import '@glideapps/glide-data-grid/dist/index.css'
import { useTheme } from '@/components/theme-provider'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type GridColumnKind =
  | 'text'
  | 'number'
  | 'money'
  | 'date'
  | 'badge'
  | 'person'

export type BadgeTone = 'green' | 'amber' | 'blue' | 'gray' | 'rose' | 'violet'

export interface GridColumn<T> {
  id: string
  title: string
  width?: number
  kind?: GridColumnKind // default 'text'
  get: (row: T) => string | number // raw value for the cell
  editable?: boolean // default false
  // for kind 'badge'
  badgeTone?: (row: T) => BadgeTone
}

export interface DataGridProps<T> {
  rows: T[]
  columns: GridColumn<T>[]
  getRowId: (row: T) => string
  onCellEdit?: (rowId: string, columnId: string, value: string) => void
  onRowClick?: (row: T) => void // fire on cell activated/single click of a row
  onSelectionChange?: (rowIds: string[]) => void
  onAddRow?: () => void // if provided, show trailing "+ add row"
  emptyMessage?: string // shown when rows.length === 0
  height?: number | string // default fills parent
}

// ---------------------------------------------------------------------------
// Theme (kept visually consistent with EmployeesGrid)
// ---------------------------------------------------------------------------


const BADGE_THEME: Record<BadgeTone, { bg: string; text: string }> = {
  green: { bg: '#ecfdf5', text: '#047857' },
  amber: { bg: '#fffbeb', text: '#b45309' },
  blue: { bg: '#eff6ff', text: '#1d4ed8' },
  gray: { bg: '#f4f4f5', text: '#52525b' },
  rose: { bg: '#fff1f2', text: '#be123c' },
  violet: { bg: '#f5f3ff', text: '#6d28d9' },
}

// ---------------------------------------------------------------------------
// Value formatting helpers
// ---------------------------------------------------------------------------

function formatMoney(value: string | number): string {
  const paise = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(paise)) return '—'
  return `₹${Math.round(paise / 100).toLocaleString('en-IN')}`
}

const DATE_FMT: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
}
function formatDate(value: string | number): string {
  const s = String(value ?? '').trim()
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString('en-US', DATE_FMT)
}

function displayValue(kind: GridColumnKind, value: string | number): string {
  switch (kind) {
    case 'money':
      return formatMoney(value)
    case 'date':
      return formatDate(value)
    case 'number':
      return String(value ?? '')
    default:
      return String(value ?? '')
  }
}

// ---------------------------------------------------------------------------
// Badge custom cell (small colored pill)
// ---------------------------------------------------------------------------

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

type BadgeCell = CustomCell<{
  kind: 'datagrid-badge'
  label: string
  tone: BadgeTone
}>

const badgeCellRenderer: CustomRenderer<BadgeCell> = {
  kind: GridCellKind.Custom,
  isMatch: (c): c is BadgeCell =>
    (c.data as { kind?: string }).kind === 'datagrid-badge',
  draw: (args, cell) => {
    const { ctx, rect, theme } = args
    const { label, tone } = cell.data
    if (!label) {
      ctx.fillStyle = theme.textLight
      ctx.font = `${theme.baseFontStyle} ${theme.fontFamily}`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText('—', rect.x + theme.cellHorizontalPadding, rect.y + rect.height / 2)
      return true
    }
    const t = BADGE_THEME[tone] ?? BADGE_THEME.gray
    const padX = 8
    const chipH = 20
    const x0 = rect.x + theme.cellHorizontalPadding
    const y0 = rect.y + (rect.height - chipH) / 2

    ctx.font = `500 12px ${theme.fontFamily}`
    const tw = ctx.measureText(label).width
    roundRect(ctx, x0, y0, padX + tw + padX, chipH, chipH / 2)
    ctx.fillStyle = t.bg
    ctx.fill()
    ctx.lineWidth = 1
    ctx.strokeStyle = t.text + '33' // thin tonal border (~20% alpha)
    ctx.stroke()

    ctx.fillStyle = t.text
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, x0 + padX, y0 + chipH / 2 + 0.5)
    return true
  },
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DataGrid<T>({
  rows,
  columns,
  getRowId,
  onCellEdit,
  onRowClick,
  onSelectionChange,
  onAddRow,
  emptyMessage = 'No rows',
  height,
}: DataGridProps<T>) {
  const [widths, setWidths] = useState<Record<string, number>>({})
  
  const { theme } = useTheme()
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) ||
    document.documentElement.classList.contains('dark')

  const gridTheme = useMemo<Partial<Theme>>(() => {
    if (isDark) {
      return {
        accentColor: '#3b82f6',
        accentLight: 'rgba(59,130,246,0.15)',
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
        fontFamily: "system-ui, sans-serif",
        cellHorizontalPadding: 12,
      }
    }
    return {
      accentColor: '#2f63d8',
      accentLight: 'rgba(47,99,216,0.10)',
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
  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  })

  const glideColumns: GlideColumn[] = columns.map((c) => ({
    id: c.id,
    title: c.title,
    width: widths[c.id] ?? c.width ?? 160,
  }))

  const getCellContent = useCallback(
    ([col, row]: Item): GridCell => {
      const column = columns[col]
      const r = rows[row]
      const kind = column.kind ?? 'text'
      const raw = r === undefined ? '' : column.get(r)

      if (kind === 'badge') {
        const label = String(raw ?? '')
        const tone = r !== undefined && column.badgeTone ? column.badgeTone(r) : 'gray'
        return {
          kind: GridCellKind.Custom,
          allowOverlay: false,
          copyData: label,
          data: { kind: 'datagrid-badge', label, tone },
        } satisfies BadgeCell
      }

      if (kind === 'number' || kind === 'money') {
        const display = displayValue(kind, raw)
        return {
          kind: GridCellKind.Number,
          data: typeof raw === 'number' ? raw : Number(raw) || undefined,
          displayData: display,
          allowOverlay: column.editable ?? false,
          readonly: !(column.editable ?? false),
        }
      }

      const display = displayValue(kind, raw)
      return {
        kind: GridCellKind.Text,
        data: String(raw ?? ''),
        displayData: display,
        allowOverlay: column.editable ?? false,
        readonly: !(column.editable ?? false),
      }
    },
    [columns, rows],
  )

  const onCellEdited = useCallback(
    ([col, row]: Item, newValue: EditableGridCell) => {
      const column = columns[col]
      const r = rows[row]
      if (r === undefined || !(column.editable ?? false)) return
      if (
        newValue.kind !== GridCellKind.Text &&
        newValue.kind !== GridCellKind.Number
      )
        return
      onCellEdit?.(getRowId(r), column.id, String(newValue.data ?? ''))
    },
    [columns, rows, getRowId, onCellEdit],
  )

  if (rows.length === 0) {
    return (
      <div
        className="grid h-full w-full place-items-center text-[13px] text-muted-foreground"
        style={height !== undefined ? { height } : undefined}
      >
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="h-full w-full" style={height !== undefined ? { height } : undefined}>
      <DataEditor
        className="h-full w-full"
        theme={gridTheme}
        customRenderers={[badgeCellRenderer]}
        columns={glideColumns}
        rows={rows.length}
        getCellContent={getCellContent}
        onCellEdited={onCellEdited}
        onColumnResize={(column, newSize) =>
          setWidths((w) => ({ ...w, [String(column.id)]: newSize }))
        }
        rowMarkers="checkbox-visible"
        gridSelection={selection}
        onGridSelectionChange={(s) => {
          setSelection(s)
          if (onSelectionChange) {
            const ids = s.rows
              .toArray()
              .map((i) => rows[i])
              .filter((r): r is T => r !== undefined)
              .map(getRowId)
            onSelectionChange(ids)
          }
        }}
        onCellClicked={([col, row]) => {
          // glide fires this for the row-marker (checkbox) column with col < 0;
          // ignore those so toggling selection never opens the detail panel
          if (col < 0) return
          const r = rows[row]
          if (r !== undefined) onRowClick?.(r)
        }}
        getCellsForSelection
        smoothScrollX
        smoothScrollY
        rowHeight={33}
        headerHeight={33}
        onRowAppended={onAddRow}
        trailingRowOptions={
          onAddRow ? { sticky: false, tint: true, hint: '' } : undefined
        }
      />
    </div>
  )
}
