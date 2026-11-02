import { useCallback, useEffect, useState, useMemo, useRef } from 'react'
import { Plus, Trash2, ChevronDown, X, Layers, Search } from 'lucide-react'
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
} from '@glideapps/glide-data-grid'
import '@glideapps/glide-data-grid/dist/index.css'
import { type Employee, statusTone, STATUSES, genderSex } from '@/lib/employees'
import { type Category } from '@/features/categories/api/categoriesApi.types'
import { useTheme } from '@/components/theme-provider'
import { avatarImage } from '@/lib/avatarImage'
import { Calendar } from '@/components/ui/calendar'
import { EmployeeAvatar } from '@/lib/people'
import { type StatusTone } from './StatusBadge'
import { cn } from '@/lib/utils'

// set by the mounted grid so the custom cell renderer can request a repaint
// once an avatar image has finished loading
let requestRedraw: () => void = () => { }

// candidate managers ("Report To" options), set by the mounted grid so the
// custom cell editor can list them. A manager can be another employee or a
// workspace member (owner/admin/manager/member).
export interface ManagerOption {
    name: string
    kind: 'employee' | 'member'
    employeeId?: string // when kind === 'employee'
    userId?: string // when kind === 'member'
    role?: string // membership role label (members)
}
let managerOptionsRef: ManagerOption[] = []

// distinct department names, set by the mounted grid for the department combobox
let departmentOptionsRef: string[] = []

// categories reference for the custom category & subcategory cell editors
let categoriesRef: Category[] = []

export interface CategoryRuleAssignment {
    category_id: string
    sub_category_ids: string[]
}

export function getSubcategoriesOfCategory(cat: any): { id: string; name: string }[] {
    if (!cat) return []
    const raw =
        cat.subCategoryName ||
        cat.subcategories ||
        cat.sub_categories ||
        cat.sub_category ||
        []
    if (!Array.isArray(raw)) return []
    return raw
        .map((item: any, idx: number) => {
            if (typeof item === 'string') return { id: item, name: item }
            if (item && typeof item === 'object') {
                const id = String(item.subcategory_id || item.sub_category_id || item.id || item._id || idx)
                const name = String(item.subcategory_name || item.sub_category_name || item.name || id)
                return { id, name }
            }
            return null
        })
        .filter(Boolean) as { id: string; name: string }[]
}

export function extractCategoryRules(emp: Employee): CategoryRuleAssignment[] {
    if (emp.categoryRules && emp.categoryRules.length > 0) {
        return emp.categoryRules
    }
    const rawU = emp.rawUser || emp.user || emp
    const rawCategories = Array.isArray(rawU?.categories)
        ? rawU.categories
        : Array.isArray((emp as any)?.categories)
            ? (emp as any).categories
            : []

    const rules: CategoryRuleAssignment[] = []

    if (Array.isArray(rawCategories) && rawCategories.length > 0) {
        rawCategories.forEach((item) => {
            if (!item) return
            if (typeof item === 'string' && item) {
                rules.push({ category_id: item, sub_category_ids: [] })
            } else if (typeof item === 'object') {
                const cId = String(item.category_id || item.categoryId || item.id || '')
                if (!cId) return
                const rawSubs =
                    item.sub_category_id ?? item.subcategory_id ?? item.sub_category_ids ?? item.subcategories ?? []
                const subIds: string[] = []
                if (Array.isArray(rawSubs)) {
                    rawSubs.forEach((s) => {
                        if (typeof s === 'string' && s) subIds.push(s)
                        else if (s && typeof s === 'object') {
                            const sid = String(s.subcategory_id || s.sub_category_id || s.id || '')
                            if (sid) subIds.push(sid)
                        }
                    })
                } else if (typeof rawSubs === 'string' && rawSubs) {
                    subIds.push(rawSubs)
                }
                rules.push({ category_id: cId, sub_category_ids: subIds })
            }
        })
    }

    if (rules.length === 0) {
        const singleCat = emp.categoryId || rawU?.category_id || rawU?.categoryId || rawU?.employee_category_id
        if (singleCat) {
            const singleSub =
                emp.subcategoryId || rawU?.subcategory_id || rawU?.sub_category_id || rawU?.subcategoryId
            rules.push({
                category_id: String(singleCat),
                sub_category_ids: singleSub ? [String(singleSub)] : [],
            })
        }
    }

    return rules
}

const STATUS_THEME_LIGHT: Record<StatusTone, { bg: string; text: string }> = {
    green: { bg: '#ecfdf5', text: '#047857' },
    amber: { bg: '#fffbeb', text: '#b45309' },
    blue: { bg: '#eff6ff', text: '#1d4ed8' },
    gray: { bg: '#f4f4f5', text: '#52525b' },
    rose: { bg: '#fff1f2', text: '#be123c' },
    violet: { bg: '#f5f3ff', text: '#6d28d9' },
}

const STATUS_THEME_DARK: Record<StatusTone, { bg: string; text: string }> = {
    green: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981' },
    amber: { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b' },
    blue: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6' },
    gray: { bg: 'rgba(156, 163, 175, 0.15)', text: '#9ca3af' },
    rose: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
    violet: { bg: 'rgba(139, 92, 246, 0.15)', text: '#8b5cf6' },
}

// avatar (initials + deterministic color) for the Name chip, drawn on canvas
const AVATAR_COLORS: [string, string][] = [
    ['#ffe4e6', '#be123c'],
    ['#dbeafe', '#1d4ed8'],
    ['#d1fae5', '#047857'],
    ['#fef3c7', '#b45309'],
    ['#ede9fe', '#6d28d9'],
    ['#cffafe', '#0e7490'],
]
function nameInitials(name: string) {
    return name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
}
function nameColors(name: string): [string, string] {
    let h = 0
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
    return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
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

// custom Name cell: draws an avatar + name chip, editable via a text overlay
type NameCell = CustomCell<{
    kind: 'name-cell'
    name: string
    sex?: 'man' | 'woman'
}>

const nameCellRenderer: CustomRenderer<NameCell> = {
    kind: GridCellKind.Custom,
    isMatch: (c): c is NameCell =>
        (c.data as { kind?: string }).kind === 'name-cell',
    draw: (args, cell) => {
        const { ctx, rect, theme } = args
        const name = cell.data.name
        const [bg, fg] = nameColors(name)
        const av = 18
        const padX = 8
        const gap = 6
        const chipH = 24
        const x0 = rect.x + theme.cellHorizontalPadding
        const y0 = rect.y + (rect.height - chipH) / 2

        ctx.font = `${theme.baseFontStyle} ${theme.fontFamily}`
        const tw = ctx.measureText(name).width
        const chipW = padX + av + gap + tw + padX

        // chip
        roundRect(ctx, x0, y0, chipW, chipH, 6)
        ctx.fillStyle = theme.bgHeader
        ctx.fill()
        ctx.lineWidth = 1
        ctx.strokeStyle = theme.borderColor
        ctx.stroke()

        // avatar — react-nice-avatar (rasterized), with an initials circle fallback
        const acx = x0 + padX + av / 2
        const acy = y0 + chipH / 2
        const img = avatarImage(name, cell.data.sex, requestRedraw)
        ctx.save()
        ctx.beginPath()
        ctx.arc(acx, acy, av / 2, 0, Math.PI * 2)
        ctx.closePath()
        ctx.clip()
        if (img) {
            ctx.drawImage(img, acx - av / 2, acy - av / 2, av, av)
        } else {
            ctx.fillStyle = bg
            ctx.fill()
            ctx.fillStyle = fg
            ctx.font = `600 9px ${theme.fontFamily}`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(nameInitials(name), acx, acy + 0.5)
        }
        ctx.restore()

        // name
        ctx.fillStyle = theme.textDark
        ctx.font = `${theme.baseFontStyle} ${theme.fontFamily}`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(name, x0 + padX + av + gap, acy)
        return true
    },
    provideEditor: () => ({
        disablePadding: true,
        editor: (p) => <NameEditor value={p.value as NameCell} onFinishedEditing={p.onFinishedEditing} />,
    }),
    onPaste: (v, d) => ({ ...d, name: v }),
}

function NameEditor({
    value,
    onFinishedEditing,
}: {
    value: NameCell
    onFinishedEditing: (newValue?: NameCell) => void
}) {
    const [name, setName] = useState(value.data.name || '')
    const commit = () => {
        const trimmed = name.trim()
        if (trimmed) {
            onFinishedEditing({ ...value, data: { ...value.data, name: trimmed } })
        } else {
            onFinishedEditing()
        }
    }

    return (
        <div
            className="w-64 p-2.5 bg-popover text-popover-foreground border border-border rounded-xl shadow-2xl z-50 animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
        >
            <label className="mb-1.5 block text-xs font-semibold text-foreground">Employee Name</label>
            <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault()
                        commit()
                    } else if (e.key === 'Escape') {
                        e.preventDefault()
                        onFinishedEditing()
                    }
                }}
                placeholder="Enter full name"
                className="w-full rounded-md border border-input bg-card px-2.5 py-1.5 text-xs outline-none focus:border-ring mb-2.5 text-foreground"
            />
            <div className="flex justify-end gap-1.5">
                <button
                    type="button"
                    onClick={() => onFinishedEditing()}
                    className="px-2.5 py-1 text-xs rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer bg-card"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={commit}
                    className="btn-3d px-3 py-1 text-xs rounded-md bg-primary text-primary-foreground font-medium hover:opacity-95 cursor-pointer"
                >
                    Save
                </button>
            </div>
        </div>
    )
}

// custom Status cell: draws a small badge/pill (not a full-cell fill), and a
// double-click opens a dropdown of statuses.
type StatusCell = CustomCell<{ kind: 'status-cell'; status: string }>

const statusCellRenderer: CustomRenderer<StatusCell> = {
    kind: GridCellKind.Custom,
    isMatch: (c): c is StatusCell =>
        (c.data as { kind?: string }).kind === 'status-cell',
    draw: (args, cell) => {
        const { ctx, rect, theme } = args
        const status = cell.data.status
        const isDarkTheme = theme.bgCell === '#1c1c1f'
        const statusThemes = isDarkTheme ? STATUS_THEME_DARK : STATUS_THEME_LIGHT
        const t = statusThemes[statusTone(status)]
        const padX = 8
        const chipH = 20
        const x0 = rect.x + theme.cellHorizontalPadding
        const y0 = rect.y + (rect.height - chipH) / 2

        ctx.font = `500 12px ${theme.fontFamily}`
        const tw = ctx.measureText(status).width
        const chipW = padX + tw + padX

        roundRect(ctx, x0, y0, chipW, chipH, chipH / 2)
        ctx.fillStyle = t.bg
        ctx.fill()
        ctx.lineWidth = 1
        ctx.strokeStyle = t.text + '33' // thin tonal border (~20% alpha)
        ctx.stroke()

        ctx.fillStyle = t.text
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(status, x0 + padX, y0 + chipH / 2 + 0.5)
        return true
    },
    provideEditor: () => ({
        disablePadding: true,
        editor: (p) => {
            const { value, onFinishedEditing } = p
            const isDarkTheme = p.theme.bgCell === '#1c1c1f'
            const statusThemes = isDarkTheme ? STATUS_THEME_DARK : STATUS_THEME_LIGHT
            return (
                <div className="min-w-40 p-1 bg-popover text-popover-foreground border border-border rounded-lg shadow-md">
                    {STATUSES.map((s) => {
                        const t = statusThemes[statusTone(s)]
                        return (
                            <button
                                key={s}
                                type="button"
                                onClick={() =>
                                    onFinishedEditing({ ...value, data: { ...value.data, status: s } })
                                }
                                className="flex w-full cursor-pointer items-center rounded-md px-2 py-1.5 text-left hover:bg-muted text-foreground bg-transparent border-0"
                            >
                                <span
                                    className="rounded-full border px-2 py-0.5 text-[12px] font-medium"
                                    style={{ backgroundColor: t.bg, color: t.text, borderColor: t.text + '33' }}
                                >
                                    {s}
                                </span>
                            </button>
                        )
                    })}
                </div>
            )
        },
    }),
    onPaste: (v, d) => ({ ...d, status: v }),
}

// "Jan 12, 2024" display format
const DATE_FMT: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
}
function parseDisplay(display: string): Date | undefined {
    if (!display) return undefined
    const d = new Date(display)
    return Number.isNaN(d.getTime()) ? undefined : d
}
function formatDisplay(date: Date): string {
    return date.toLocaleDateString('en-US', DATE_FMT)
}

// custom Joined cell: plain date text, but a double-click opens a shadcn
// Calendar date picker.
type DateCell = CustomCell<{ kind: 'date-cell'; display: string }>

const dateCellRenderer: CustomRenderer<DateCell> = {
    kind: GridCellKind.Custom,
    isMatch: (c): c is DateCell => (c.data as { kind?: string }).kind === 'date-cell',
    draw: (args, cell) => {
        const { ctx, rect, theme } = args
        const text = cell.data.display
        ctx.fillStyle = text ? theme.textDark : theme.textLight
        ctx.font = `${theme.baseFontStyle} ${theme.fontFamily}`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(text || 'Set date', rect.x + theme.cellHorizontalPadding, rect.y + rect.height / 2)
        return true
    },
    provideEditor: () => ({
        disablePadding: true,
        editor: (p) => {
            const { value, onFinishedEditing } = p
            const selected = parseDisplay(value.data.display)
            const thisYear = new Date().getFullYear()
            return (
                <Calendar
                    mode="single"
                    autoFocus
                    captionLayout="dropdown"
                    startMonth={new Date(1980, 0)}
                    endMonth={new Date(thisYear + 1, 11)}
                    defaultMonth={selected}
                    selected={selected}
                    onSelect={(date) => {
                        if (!date) return
                        onFinishedEditing({
                            ...value,
                            data: { ...value.data, display: formatDisplay(date) },
                        })
                    }}
                />
            )
        },
    }),
    onPaste: (v, d) => ({ ...d, display: v }),
}

// custom "Report To" cell: avatar + manager name, double-click opens a
// dropdown of all employees to pick who this person reports to.
type ManagerCell = CustomCell<{
    kind: 'manager-cell'
    selfId: string
    managerId: string | null
    managerUserId: string | null
    name: string
}>

const managerCellRenderer: CustomRenderer<ManagerCell> = {
    kind: GridCellKind.Custom,
    isMatch: (c): c is ManagerCell =>
        (c.data as { kind?: string }).kind === 'manager-cell',
    draw: (args, cell) => {
        const { ctx, rect, theme } = args
        const name = cell.data.name
        const x0 = rect.x + theme.cellHorizontalPadding
        const cy = rect.y + rect.height / 2
        if (!name) {
            ctx.fillStyle = theme.textLight
            ctx.font = `${theme.baseFontStyle} ${theme.fontFamily}`
            ctx.textAlign = 'left'
            ctx.textBaseline = 'middle'
            ctx.fillText('—', x0, cy)
            return true
        }
        const av = 18
        const acx = x0 + av / 2
        const img = avatarImage(name, undefined, requestRedraw)
        ctx.save()
        ctx.beginPath()
        ctx.arc(acx, cy, av / 2, 0, Math.PI * 2)
        ctx.closePath()
        ctx.clip()
        if (img) {
            ctx.drawImage(img, acx - av / 2, cy - av / 2, av, av)
        } else {
            const [bg, fg] = nameColors(name)
            ctx.fillStyle = bg
            ctx.fill()
            ctx.fillStyle = fg
            ctx.font = `600 9px ${theme.fontFamily}`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(nameInitials(name), acx, cy + 0.5)
        }
        ctx.restore()
        ctx.fillStyle = theme.textDark
        ctx.font = `${theme.baseFontStyle} ${theme.fontFamily}`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(name, x0 + av + 8, cy)
        return true
    },
    provideEditor: () => ({
        disablePadding: true,
        editor: (p) => {
            const { value, onFinishedEditing } = p
            const selfId = value.data.selfId
            const employees = managerOptionsRef.filter(
                (o) => o.kind === 'employee' && o.employeeId !== selfId,
            )
            const members = managerOptionsRef.filter((o) => o.kind === 'member')
            const set = (
                data: { managerId: string | null; managerUserId: string | null; name: string },
            ) => onFinishedEditing({ ...value, data: { ...value.data, ...data } })
            return (
                <div className="max-h-72 min-w-56 overflow-y-auto p-1 bg-popover text-popover-foreground border border-border rounded-lg shadow-md">
                    <button
                        type="button"
                        onClick={() => set({ managerId: null, managerUserId: null, name: '' })}
                        className="flex w-full cursor-pointer items-center rounded-md px-2 py-1.5 text-left text-[13px] text-muted-foreground hover:bg-muted bg-transparent border-0"
                    >
                        No manager
                    </button>

                    {members.length > 0 && (
                        <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Members
                        </p>
                    )}
                    {members.map((o) => (
                        <button
                            key={`m:${o.userId}`}
                            type="button"
                            onClick={() =>
                                set({ managerId: null, managerUserId: o.userId!, name: o.name })
                            }
                            className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-muted text-foreground bg-transparent border-0"
                        >
                            <EmployeeAvatar name={o.name} className="size-5" />
                            <span className="min-w-0 flex-1 truncate text-left">{o.name}</span>
                            {o.role && (
                                <span className="shrink-0 text-[11px] text-muted-foreground">{o.role}</span>
                            )}
                        </button>
                    ))}

                    {employees.length > 0 && (
                        <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Employees
                        </p>
                    )}
                    {employees.map((o) => (
                        <button
                            key={`e:${o.employeeId}`}
                            type="button"
                            onClick={() =>
                                set({ managerId: o.employeeId!, managerUserId: null, name: o.name })
                            }
                            className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-muted text-foreground bg-transparent border-0"
                        >
                            <EmployeeAvatar name={o.name} className="size-5" />
                            <span className="truncate text-left">{o.name}</span>
                        </button>
                    ))}
                </div>
            )
        },
    }),
    onPaste: (_v, d) => d,
}

// custom Gender cell: Male / Female text, double-click opens a small dropdown.
const GENDER_OPTIONS = [
    { value: 'man', label: 'Male' },
    { value: 'woman', label: 'Female' },
    { value: '', label: 'Unspecified' },
]
const genderLabel = (g: string) => (g === 'man' ? 'Male' : g === 'woman' ? 'Female' : '')

type GenderCell = CustomCell<{ kind: 'gender-cell'; gender: string }>

const genderCellRenderer: CustomRenderer<GenderCell> = {
    kind: GridCellKind.Custom,
    isMatch: (c): c is GenderCell =>
        (c.data as { kind?: string }).kind === 'gender-cell',
    draw: (args, cell) => {
        const { ctx, rect, theme } = args
        const label = genderLabel(cell.data.gender)
        ctx.fillStyle = label ? theme.textDark : theme.textLight
        ctx.font = `${theme.baseFontStyle} ${theme.fontFamily}`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(label || '—', rect.x + theme.cellHorizontalPadding, rect.y + rect.height / 2)
        return true
    },
    provideEditor: () => ({
        disablePadding: true,
        editor: (p) => {
            const { value, onFinishedEditing } = p
            return (
                <div className="min-w-40 p-1 bg-popover text-popover-foreground border border-border rounded-lg shadow-md">
                    {GENDER_OPTIONS.map((o) => (
                        <button
                            key={o.label}
                            type="button"
                            onClick={() =>
                                onFinishedEditing({ ...value, data: { ...value.data, gender: o.value } })
                            }
                            className="flex w-full cursor-pointer items-center rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-muted text-foreground bg-transparent border-0"
                        >
                            {o.label}
                        </button>
                    ))}
                </div>
            )
        },
    }),
    onPaste: (v, d) => ({ ...d, gender: v }),
}

// custom Department cell: a pill, double-click opens a searchable combobox that
// can create a new department by typing a name not in the list.
type DeptCell = CustomCell<{ kind: 'dept-cell'; department: string }>

interface DeptEditorProps {
    value: DeptCell
    onFinishedEditing: (newValue?: DeptCell) => void
}

function DeptEditor({ value, onFinishedEditing }: DeptEditorProps) {
    const [q, setQ] = useState(value.data.department ?? '')
    const commit = (department: string) =>
        onFinishedEditing({ ...value, data: { ...value.data, department } })

    const ql = q.trim().toLowerCase()
    const options = departmentOptionsRef
    const filtered = ql ? options.filter((o) => o.toLowerCase().includes(ql)) : options
    const exact = options.some((o) => o.toLowerCase() === ql)

    return (
        <div className="w-56 p-1 bg-popover text-popover-foreground border border-border rounded-lg shadow-md">
            <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault()
                        if (q.trim()) commit(q.trim())
                    }
                }}
                placeholder="Search or create…"
                className="mb-1 w-full rounded-md border border-input bg-card px-2 py-1.5 text-[13px] outline-none focus:border-ring"
            />
            <div className="max-h-56 overflow-y-auto">
                {filtered.map((o) => (
                    <button
                        key={o}
                        type="button"
                        onClick={() => commit(o)}
                        className="flex w-full cursor-pointer items-center rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-muted text-foreground bg-transparent border-0"
                    >
                        {o}
                    </button>
                ))}
                {q.trim() && !exact && (
                    <button
                        type="button"
                        onClick={() => commit(q.trim())}
                        className="flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[13px] font-medium text-primary hover:bg-muted bg-transparent border-0"
                    >
                        <Plus className="size-3.5" />
                        Create “{q.trim()}”
                    </button>
                )}
                {filtered.length === 0 && !q.trim() && (
                    <div className="px-2 py-2 text-[13px] text-muted-foreground">No departments</div>
                )}
            </div>
        </div>
    )
}

const departmentCellRenderer: CustomRenderer<DeptCell> = {
    kind: GridCellKind.Custom,
    isMatch: (c): c is DeptCell => (c.data as { kind?: string }).kind === 'dept-cell',
    draw: (args, cell) => {
        const { ctx, rect, theme } = args
        const text = cell.data.department
        if (!text) {
            ctx.fillStyle = theme.textLight
            ctx.font = `${theme.baseFontStyle} ${theme.fontFamily}`
            ctx.textAlign = 'left'
            ctx.textBaseline = 'middle'
            ctx.fillText('—', rect.x + theme.cellHorizontalPadding, rect.y + rect.height / 2)
            return true
        }
        const padX = 8
        const chipH = 20
        const x0 = rect.x + theme.cellHorizontalPadding
        const y0 = rect.y + (rect.height - chipH) / 2
        ctx.font = `500 12px ${theme.fontFamily}`
        const tw = ctx.measureText(text).width
        roundRect(ctx, x0, y0, padX + tw + padX, chipH, 6)
        ctx.fillStyle = theme.bgHeader
        ctx.fill()
        ctx.lineWidth = 1
        ctx.strokeStyle = theme.borderColor
        ctx.stroke()
        ctx.fillStyle = theme.textMedium
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, x0 + padX, y0 + chipH / 2 + 0.5)
        return true
    },
    provideEditor: () => ({
        disablePadding: true,
        editor: (p) => <DeptEditor value={p.value as DeptCell} onFinishedEditing={p.onFinishedEditing} />,
    }),
    onPaste: (v, d) => ({ ...d, department: v }),
}

// custom Salary cell: "₹30,000 / mo" — double-click opens amount + basis editor.
const basisSuffix = (b: string) => (b === 'daily' ? '/ day' : b === 'weekly' ? '/ wk' : '/ mo')
const fmtSalary = (paise: number, basis: string) =>
    paise > 0 ? `₹${Math.round(paise / 100).toLocaleString('en-IN')} ${basisSuffix(basis)}` : ''
const BASIS_OPTIONS = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'daily', label: 'Daily' },
]

type SalaryCell = CustomCell<{ kind: 'salary-cell'; amount: number; basis: string; effectivePeriod?: string }>

const curMonth = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function SalaryEditor({
    value,
    onFinishedEditing,
}: {
    value: SalaryCell
    onFinishedEditing: (newValue?: SalaryCell) => void
}) {
    const [rupees, setRupees] = useState(value.data.amount ? String(value.data.amount / 100) : '')
    const [basis, setBasis] = useState(value.data.basis || 'monthly')
    const [effective, setEffective] = useState(curMonth())
    const commit = () =>
        onFinishedEditing({
            ...value,
            data: { ...value.data, amount: Math.round((Number(rupees) || 0) * 100), basis, effectivePeriod: effective },
        })
    return (
        <div className="w-56 p-2 bg-popover text-popover-foreground border border-border rounded-lg shadow-md">
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Amount (₹)</label>
            <div className="mb-2 flex items-center rounded-md border border-input bg-card px-2">
                <span className="text-[13px] text-muted-foreground">₹</span>
                <input
                    autoFocus
                    value={rupees}
                    onChange={(e) => setRupees(e.target.value.replace(/[^\d.]/g, ''))}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), commit())}
                    inputMode="decimal"
                    className="w-full bg-transparent px-1.5 py-1.5 text-[13px] outline-none"
                />
            </div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Basis</label>
            <div className="mb-2 flex gap-1 rounded-md border border-border bg-card p-0.5">
                {BASIS_OPTIONS.map((o) => (
                    <button
                        key={o.value}
                        type="button"
                        onClick={() => setBasis(o.value)}
                        className={cn(
                            'flex-1 cursor-pointer rounded px-2 py-1 text-[12px] font-medium transition-colors border-0',
                            basis === o.value ? 'bg-[#2f63d8] text-white' : 'text-muted-foreground hover:bg-muted bg-transparent',
                        )}
                    >
                        {o.label}
                    </button>
                ))}
            </div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Effective from</label>
            <input
                type="month"
                value={effective}
                onChange={(e) => e.target.value && setEffective(e.target.value)}
                className="mb-2 w-full rounded-md border border-input bg-card px-2 py-1.5 text-[13px] outline-none focus:border-ring"
            />
            <button
                type="button"
                onClick={commit}
                className="w-full cursor-pointer rounded-md bg-foreground px-2 py-1.5 text-[13px] font-medium text-background hover:opacity-90 border-0"
            >
                Save
            </button>
        </div>
    )
}

const salaryCellRenderer: CustomRenderer<SalaryCell> = {
    kind: GridCellKind.Custom,
    isMatch: (c): c is SalaryCell => (c.data as { kind?: string }).kind === 'salary-cell',
    draw: (args, cell) => {
        const { ctx, rect, theme } = args
        const text = fmtSalary(cell.data.amount, cell.data.basis)
        ctx.fillStyle = text ? theme.textDark : theme.textLight
        ctx.font = `${theme.baseFontStyle} ${theme.fontFamily}`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(text || '—', rect.x + theme.cellHorizontalPadding, rect.y + rect.height / 2)
        return true
    },
    provideEditor: () => ({
        disablePadding: true,
        editor: (p) => <SalaryEditor value={p.value as SalaryCell} onFinishedEditing={p.onFinishedEditing} />,
    }),
    onPaste: (v, d) => ({ ...d, amount: Math.round((Number(v.replace(/[^\d.]/g, '')) || 0) * 100) }),
}

// custom Category cell: draws category chips, double-click opens CategoryEditor
type CategoryCell = CustomCell<{
    kind: 'category-cell'
    categoryNames: string
    rules: CategoryRuleAssignment[]
    employeeId: string
}>

// custom Subcategory cell: draws subcategory chips, double-click opens CategoryEditor
type SubcategoryCell = CustomCell<{
    kind: 'subcategory-cell'
    subcategoryNames: string
    rules: CategoryRuleAssignment[]
    employeeId: string
}>

interface CategoryEditorProps<T extends CategoryCell | SubcategoryCell> {
    value: T
    onFinishedEditing: (newValue?: T) => void
    categories: Category[]
}

function CategoryEditor<T extends CategoryCell | SubcategoryCell>({
    value,
    onFinishedEditing,
    categories,
}: CategoryEditorProps<T>) {
    const [rules, setRules] = useState<CategoryRuleAssignment[]>(() => {
        const initial = value.data.rules || []
        if (initial.length > 0) {
            return initial.map((r) => ({
                category_id: r.category_id,
                sub_category_ids: [...(r.sub_category_ids || [])],
            }))
        }
        const firstCat = categories[0]?.category_id || (categories[0] as any)?.id || ''
        return firstCat ? [{ category_id: firstCat, sub_category_ids: [] }] : []
    })

    const [activeSubDropdown, setActiveSubDropdown] = useState<number | null>(null)
    const [subSearchQuery, setSubSearchQuery] = useState('')

    const handleAddRule = () => {
        const usedCatIds = new Set(rules.map((r) => r.category_id))
        const unused = categories.find((c) => !usedCatIds.has(c.category_id || (c as any).id))
        const nextCat = unused
            ? unused.category_id || (unused as any).id
            : categories[0]?.category_id || (categories[0] as any)?.id || ''
        setRules([...rules, { category_id: nextCat, sub_category_ids: [] }])
    }

    const handleRemoveRule = (index: number) => {
        setRules(rules.filter((_, i) => i !== index))
    }

    const handleCategoryChange = (index: number, newCatId: string) => {
        setRules(
            rules.map((r, i) => (i === index ? { category_id: newCatId, sub_category_ids: [] } : r))
        )
        setActiveSubDropdown(null)
    }

    const handleToggleSub = (index: number, subId: string) => {
        setRules(
            rules.map((r, i) => {
                if (i !== index) return r
                const current = r.sub_category_ids || []
                const exists = current.includes(subId)
                const next = exists ? current.filter((id) => id !== subId) : [...current, subId]
                return { ...r, sub_category_ids: next }
            })
        )
    }

    const handleSelectAllSubs = (index: number, allSubIds: string[]) => {
        setRules(
            rules.map((r, i) => {
                if (i !== index) return r
                const current = r.sub_category_ids || []
                const isAll = current.length === allSubIds.length
                return { ...r, sub_category_ids: isAll ? [] : [...allSubIds] }
            })
        )
    }

    const handleSave = () => {
        const valid = rules.filter((r) => r.category_id)
        onFinishedEditing({
            ...value,
            data: {
                ...value.data,
                rules: valid,
            },
        })
    }

    return (
        <div
            className="w-[380px] max-w-[90vw] rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-2xl z-50 animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="flex items-center justify-between border-b border-border pb-2.5 mb-3">
                <div className="flex items-center gap-1.5">
                    <div className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Layers className="size-3.5" />
                    </div>
                    <div>
                        <h4 className="text-xs font-semibold text-foreground leading-none">
                            Assign Category & Subcategory
                        </h4>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                            Select category first to choose associated subcategories
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => onFinishedEditing()}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer border-0 bg-transparent"
                >
                    <X className="size-3.5" />
                </button>
            </div>

            {categories.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                    No categories found. Please create categories in Settings first.
                </div>
            ) : (
                <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                    {rules.map((rule, idx) => {
                        const currentCat = categories.find(
                            (c) => String(c.category_id || (c as any).id) === rule.category_id
                        )
                        const subs = getSubcategoriesOfCategory(currentCat)
                        const filteredSubs = subSearchQuery.trim()
                            ? subs.filter((s) => s.name.toLowerCase().includes(subSearchQuery.toLowerCase()))
                            : subs
                        const isSubOpen = activeSubDropdown === idx

                        return (
                            <div
                                key={idx}
                                className="rounded-lg border border-border bg-card/60 p-2.5 space-y-2 relative"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                        Rule #{idx + 1}
                                    </span>
                                    {rules.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveRule(idx)}
                                            className="text-rose-500 hover:text-rose-600 p-0.5 rounded hover:bg-rose-500/10 transition-colors cursor-pointer border-0 bg-transparent"
                                            title="Remove this category rule"
                                        >
                                            <Trash2 className="size-3" />
                                        </button>
                                    )}
                                </div>

                                {/* Step 1: Category Selector */}
                                <div>
                                    <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                                        1. Category
                                    </label>
                                    <select
                                        value={rule.category_id}
                                        onChange={(e) => handleCategoryChange(idx, e.target.value)}
                                        className="w-full rounded-md border border-input bg-card px-2.5 py-1.5 text-xs text-foreground font-medium outline-none focus:border-ring cursor-pointer"
                                    >
                                        <option value="" disabled>
                                            Select Category…
                                        </option>
                                        {categories.map((c) => {
                                            const cId = c.category_id || (c as any).id
                                            const cName = c.category_name || (c as any).name || 'Unnamed'
                                            return (
                                                <option key={cId} value={cId}>
                                                    {cName}
                                                </option>
                                            )
                                        })}
                                    </select>
                                </div>

                                {/* Step 2: Subcategory Selector */}
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="block text-[10px] font-medium text-muted-foreground">
                                            2. Subcategories
                                        </label>
                                        {subs.length > 0 && (
                                            <span className="text-[10px] text-muted-foreground font-semibold">
                                                {rule.sub_category_ids.length} / {subs.length} selected
                                            </span>
                                        )}
                                    </div>

                                    {!rule.category_id ? (
                                        <div className="rounded-md border border-dashed border-border px-2.5 py-1.5 text-[11px] text-muted-foreground italic">
                                            Select a category first to view subcategories
                                        </div>
                                    ) : subs.length === 0 ? (
                                        <div className="rounded-md border border-dashed border-border px-2.5 py-1.5 text-[11px] text-muted-foreground italic">
                                            No subcategories available in this category
                                        </div>
                                    ) : (
                                        <div className="space-y-1.5">
                                            {/* Subcategory trigger */}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setActiveSubDropdown(isSubOpen ? null : idx)
                                                    setSubSearchQuery('')
                                                }}
                                                className="w-full flex items-center justify-between rounded-md border border-input bg-card px-2.5 py-1.5 text-xs hover:bg-muted text-foreground transition-colors cursor-pointer"
                                            >
                                                <span className="truncate">
                                                    {rule.sub_category_ids.length === 0
                                                        ? 'Select subcategories…'
                                                        : `${rule.sub_category_ids.length} subcategories selected`}
                                                </span>
                                                <ChevronDown
                                                    className={cn(
                                                        'size-3.5 shrink-0 text-muted-foreground transition-transform',
                                                        isSubOpen && 'rotate-180'
                                                    )}
                                                />
                                            </button>

                                            {/* Selected badges */}
                                            {rule.sub_category_ids.length > 0 && (
                                                <div className="flex flex-wrap gap-1 pt-0.5">
                                                    {rule.sub_category_ids.map((subId) => {
                                                        const subObj = subs.find((s) => s.id === subId)
                                                        return (
                                                            <span
                                                                key={subId}
                                                                className="inline-flex items-center gap-1 rounded-md bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                                                            >
                                                                <span className="truncate max-w-[120px]">
                                                                    {subObj?.name || subId}
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleToggleSub(idx, subId)
                                                                    }}
                                                                    className="text-primary hover:text-rose-500 cursor-pointer border-0 bg-transparent p-0"
                                                                >
                                                                    <X className="size-2.5" />
                                                                </button>
                                                            </span>
                                                        )
                                                    })}
                                                </div>
                                            )}

                                            {/* Subcategory checklist dropdown */}
                                            {isSubOpen && (
                                                <div className="rounded-lg border border-border bg-popover p-2 shadow-lg space-y-1.5 animate-in fade-in-50">
                                                    <div className="flex items-center justify-between gap-1 pb-1 border-b border-border">
                                                        <div className="relative flex-1">
                                                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                                                            <input
                                                                type="text"
                                                                placeholder="Search subcategory…"
                                                                value={subSearchQuery}
                                                                onChange={(e) => setSubSearchQuery(e.target.value)}
                                                                className="w-full bg-card rounded border border-input pl-6 pr-2 py-1 text-[11px] outline-none"
                                                                autoFocus
                                                            />
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                handleSelectAllSubs(
                                                                    idx,
                                                                    subs.map((s) => s.id)
                                                                )
                                                            }
                                                            className="text-[10px] font-semibold text-primary hover:underline px-1.5 py-1 whitespace-nowrap cursor-pointer border-0 bg-transparent"
                                                        >
                                                            {rule.sub_category_ids.length === subs.length
                                                                ? 'Clear All'
                                                                : 'Select All'}
                                                        </button>
                                                    </div>

                                                    <div className="max-h-36 overflow-y-auto space-y-0.5">
                                                        {filteredSubs.map((sub) => {
                                                            const isChecked = rule.sub_category_ids.includes(sub.id)
                                                            return (
                                                                <label
                                                                    key={sub.id}
                                                                    className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted cursor-pointer transition-colors"
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isChecked}
                                                                        onChange={() => handleToggleSub(idx, sub.id)}
                                                                        className="rounded border-input text-primary focus:ring-ring size-3.5"
                                                                    />
                                                                    <span className="truncate flex-1 text-foreground font-normal">
                                                                        {sub.name}
                                                                    </span>
                                                                </label>
                                                            )
                                                        })}
                                                        {filteredSubs.length === 0 && (
                                                            <div className="py-2 text-center text-[11px] text-muted-foreground">
                                                                No matching subcategories
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}

                    {rules.length < categories.length && (
                        <button
                            type="button"
                            onClick={handleAddRule}
                            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs font-semibold text-primary hover:bg-muted/50 transition-colors cursor-pointer bg-transparent"
                        >
                            <Plus className="size-3.5" />
                            <span>Add Another Category</span>
                        </button>
                    )}
                </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-border pt-2.5 mt-3">
                <button
                    type="button"
                    onClick={() => onFinishedEditing()}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer bg-card"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={handleSave}
                    className="btn-3d rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-95 transition-opacity cursor-pointer shadow-xs"
                >
                    Save Changes
                </button>
            </div>
        </div>
    )
}

const categoryCellRenderer: CustomRenderer<CategoryCell> = {
    kind: GridCellKind.Custom,
    isMatch: (c): c is CategoryCell => (c.data as { kind?: string }).kind === 'category-cell',
    draw: (args, cell) => {
        const { ctx, rect, theme } = args
        const names = cell.data.categoryNames
        const x0 = rect.x + theme.cellHorizontalPadding
        const cy = rect.y + rect.height / 2
        if (!names || names === '—') {
            ctx.fillStyle = theme.textLight
            ctx.font = `${theme.baseFontStyle} ${theme.fontFamily}`
            ctx.textAlign = 'left'
            ctx.textBaseline = 'middle'
            ctx.fillText('—', x0, cy)
            return true
        }
        const catList = names.split(',').map((s) => s.trim()).filter(Boolean)
        if (catList.length === 0) {
            ctx.fillStyle = theme.textLight
            ctx.font = `${theme.baseFontStyle} ${theme.fontFamily}`
            ctx.textAlign = 'left'
            ctx.textBaseline = 'middle'
            ctx.fillText('—', x0, cy)
            return true
        }

        const padX = 7
        const chipH = 20
        const y0 = rect.y + (rect.height - chipH) / 2
        ctx.font = `500 11px ${theme.fontFamily}`
        const firstText = catList[0]
        const tw = ctx.measureText(firstText).width
        const chipW = padX + tw + padX

        roundRect(ctx, x0, y0, chipW, chipH, 5)
        ctx.fillStyle = theme.bgHeader
        ctx.fill()
        ctx.lineWidth = 1
        ctx.strokeStyle = theme.borderColor
        ctx.stroke()

        ctx.fillStyle = theme.textDark
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(firstText, x0 + padX, y0 + chipH / 2 + 0.5)

        if (catList.length > 1) {
            const moreText = `+${catList.length - 1}`
            const mtw = ctx.measureText(moreText).width
            const mx0 = x0 + chipW + 4
            const mChipW = 6 + mtw + 6
            roundRect(ctx, mx0, y0, mChipW, chipH, 5)
            ctx.fillStyle = theme.accentLight
            ctx.fill()
            ctx.fillStyle = theme.accentColor
            ctx.fillText(moreText, mx0 + 6, y0 + chipH / 2 + 0.5)
        }
        return true
    },
    provideEditor: () => ({
        disablePadding: true,
        editor: (p) => (
            <CategoryEditor<CategoryCell>
                value={p.value}
                onFinishedEditing={p.onFinishedEditing}
                categories={categoriesRef}
            />
        ),
    }),
    onPaste: (_v, d) => d,
}

const subcategoryCellRenderer: CustomRenderer<SubcategoryCell> = {
    kind: GridCellKind.Custom,
    isMatch: (c): c is SubcategoryCell => (c.data as { kind?: string }).kind === 'subcategory-cell',
    draw: (args, cell) => {
        const { ctx, rect, theme } = args
        const names = cell.data.subcategoryNames
        const x0 = rect.x + theme.cellHorizontalPadding
        const cy = rect.y + rect.height / 2
        if (!names || names === '—') {
            ctx.fillStyle = theme.textLight
            ctx.font = `${theme.baseFontStyle} ${theme.fontFamily}`
            ctx.textAlign = 'left'
            ctx.textBaseline = 'middle'
            ctx.fillText('—', x0, cy)
            return true
        }
        const subList = names.split(',').map((s) => s.trim()).filter(Boolean)
        if (subList.length === 0) {
            ctx.fillStyle = theme.textLight
            ctx.font = `${theme.baseFontStyle} ${theme.fontFamily}`
            ctx.textAlign = 'left'
            ctx.textBaseline = 'middle'
            ctx.fillText('—', x0, cy)
            return true
        }

        const padX = 7
        const chipH = 20
        const y0 = rect.y + (rect.height - chipH) / 2
        ctx.font = `500 11px ${theme.fontFamily}`
        const firstText = subList[0]
        const tw = ctx.measureText(firstText).width
        const chipW = padX + tw + padX

        roundRect(ctx, x0, y0, chipW, chipH, 5)
        ctx.fillStyle = theme.bgHeader
        ctx.fill()
        ctx.lineWidth = 1
        ctx.strokeStyle = theme.borderColor
        ctx.stroke()

        ctx.fillStyle = theme.textDark
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(firstText, x0 + padX, y0 + chipH / 2 + 0.5)

        if (subList.length > 1) {
            const moreText = `+${subList.length - 1}`
            const mtw = ctx.measureText(moreText).width
            const mx0 = x0 + chipW + 4
            const mChipW = 6 + mtw + 6
            roundRect(ctx, mx0, y0, mChipW, chipH, 5)
            ctx.fillStyle = theme.accentLight
            ctx.fill()
            ctx.fillStyle = theme.accentColor
            ctx.fillText(moreText, mx0 + 6, y0 + chipH / 2 + 0.5)
        }
        return true
    },
    provideEditor: () => ({
        disablePadding: true,
        editor: (p) => (
            <CategoryEditor<SubcategoryCell>
                value={p.value}
                onFinishedEditing={p.onFinishedEditing}
                categories={categoriesRef}
            />
        ),
    }),
    onPaste: (_v, d) => d,
}

type Field = Exclude<keyof Employee, 'status'>

interface ColMeta {
    id: Field | 'status'
    title: string
    width: number
    editable: boolean
}

const COLUMNS: ColMeta[] = [
    { id: 'empCode', title: 'ID', width: 100, editable: true },
    { id: 'name', title: 'Name', width: 200, editable: true },
    { id: 'email', title: 'Email', width: 210, editable: true },
    { id: 'phone', title: 'Mobile Number', width: 140, editable: true },
    { id: 'category', title: 'Category', width: 150, editable: true },
    { id: 'subcategory', title: 'Subcategory', width: 160, editable: true },
    // { id: 'department', title: 'Department', width: 150, editable: false },
    { id: 'role', title: 'Role', width: 180, editable: false },
    // { id: 'monthlyCtc', title: 'Salary', width: 150, editable: false },
    { id: 'gender', title: 'Gender', width: 120, editable: false },
    { id: 'managerName', title: 'Report To', width: 170, editable: false },
    { id: 'status', title: 'Status', width: 120, editable: false },
    { id: 'joined', title: 'Joined', width: 130, editable: true },
]

const NAME_INDEX = COLUMNS.findIndex((c) => c.id === 'name')

interface EmployeesGridProps {
    rows: Employee[]
    onEdit: (id: string, field: Field, value: string) => void
    onCategoryChange?: (id: string, categories: CategoryRuleAssignment[]) => void
    onStatusChange?: (id: string, status: string) => void
    onManagerChange?: (
        id: string,
        manager: { managerId: string | null; managerUserId: string | null },
    ) => void
    onSalaryChange?: (id: string, salary: { monthlyCtc: number; payBasis: string; effectivePeriod: string }) => void
    /** candidate managers for the "Report To" dropdown */
    managerOptions?: ManagerOption[]
    /** existing department names for the Department combobox */
    departmentOptions?: string[]
    /** categories for the Category/Subcategory editor */
    categories?: Category[]
    onSelectionChange?: (employees: Employee[]) => void
    onOpenProfile?: (employee: Employee) => void
    onActiveRowChange?: (employee: Employee | null) => void
    onAddRow?: () => void
    /** bump to clear the row selection from the parent */
    clearSelectionToken?: number
}

export default function EmployeesGrid({
    rows,
    onEdit,
    onCategoryChange,
    onStatusChange,
    onManagerChange,
    onSalaryChange,
    managerOptions = [],
    departmentOptions = [],
    categories = [],
    onSelectionChange,
    onOpenProfile,
    onActiveRowChange,
    onAddRow,
    clearSelectionToken,
}: EmployeesGridProps) {
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

    managerOptionsRef = managerOptions
    departmentOptionsRef = departmentOptions
    categoriesRef = categories
    const gridRef = useRef<any>(null)
    const [widths, setWidths] = useState<number[]>(COLUMNS.map((c) => c.width))
    const [tick, setTick] = useState(0)
    const [selection, setSelection] = useState<GridSelection>({
        columns: CompactSelection.empty(),
        rows: CompactSelection.empty(),
    })

    // let the custom cell renderer trigger a repaint when an avatar image loads
    useEffect(() => {
        requestRedraw = () => setTick((t) => t + 1)
        return () => {
            requestRedraw = () => { }
        }
    }, [])

    useEffect(() => {
        if (clearSelectionToken === undefined) return
        setSelection((s) => ({ ...s, rows: CompactSelection.empty() }))
    }, [clearSelectionToken])

    const firstRowId = rows[0]?.id
    const [prevFirstRowId, setPrevFirstRowId] = useState<string | null>(null)

    useEffect(() => {
        if (firstRowId && firstRowId.startsWith('draft-') && firstRowId !== prevFirstRowId) {
            setPrevFirstRowId(firstRowId)
            const phoneColIndex = COLUMNS.findIndex((c) => c.id === 'phone')
            if (phoneColIndex !== -1) {
                setSelection({
                    columns: CompactSelection.empty(),
                    rows: CompactSelection.empty(),
                    current: {
                        cell: [phoneColIndex, 0],
                        range: { x: phoneColIndex, y: 0, width: 1, height: 1 },
                        rangeStack: [{ x: phoneColIndex, y: 0, width: 1, height: 1 }],
                    },
                })
                setTimeout(() => {
                    if (gridRef.current) {
                        gridRef.current.focus()
                        const event = new KeyboardEvent('keydown', {
                            key: 'Enter',
                            code: 'Enter',
                            keyCode: 13,
                            which: 13,
                            bubbles: true,
                            cancelable: true,
                        })
                        const activeEl = document.activeElement
                        if (activeEl) {
                            activeEl.dispatchEvent(event)
                        }
                    }
                }, 50)
            }
        } else if (firstRowId !== prevFirstRowId) {
            setPrevFirstRowId(firstRowId || null)
        }
    }, [firstRowId, prevFirstRowId])

    const columns: GridColumn[] = COLUMNS.map((c, i) => ({
        id: c.id,
        title: c.title,
        width: widths[i],
    }))

    const getCellContent = useCallback(
        ([col, row]: Item): GridCell => {
            const meta = COLUMNS[col]
            const e = rows[row]
            if (meta.id === 'status') {
                return {
                    kind: GridCellKind.Custom,
                    allowOverlay: true,
                    copyData: e.status,
                    data: { kind: 'status-cell', status: e.status },
                } satisfies StatusCell
            }
            if (meta.id === 'name') {
                return {
                    kind: GridCellKind.Custom,
                    allowOverlay: true,
                    copyData: e.name,
                    cursor: 'pointer',
                    data: { kind: 'name-cell', name: e.name, sex: genderSex(e.gender) },
                } satisfies NameCell
            }
            if (meta.id === 'department') {
                return {
                    kind: GridCellKind.Custom,
                    allowOverlay: true,
                    copyData: e.department,
                    data: { kind: 'dept-cell', department: e.department },
                } satisfies DeptCell
            }
            if (meta.id === 'joined') {
                return {
                    kind: GridCellKind.Custom,
                    allowOverlay: true,
                    copyData: e.joined,
                    data: { kind: 'date-cell', display: e.joined },
                } satisfies DateCell
            }
            if (meta.id === 'monthlyCtc') {
                return {
                    kind: GridCellKind.Custom,
                    allowOverlay: true,
                    copyData: fmtSalary(e.monthlyCtc, e.payBasis),
                    data: { kind: 'salary-cell', amount: e.monthlyCtc, basis: e.payBasis },
                } satisfies SalaryCell
            }
            if (meta.id === 'gender') {
                return {
                    kind: GridCellKind.Custom,
                    allowOverlay: true,
                    copyData: e.gender,
                    data: { kind: 'gender-cell', gender: e.gender },
                } satisfies GenderCell
            }
            if (meta.id === 'managerName') {
                return {
                    kind: GridCellKind.Custom,
                    allowOverlay: true,
                    copyData: e.managerName,
                    data: {
                        kind: 'manager-cell',
                        selfId: e.id,
                        managerId: e.managerId,
                        managerUserId: e.managerUserId,
                        name: e.managerName,
                    },
                } satisfies ManagerCell
            }
            if (meta.id === 'category') {
                const rules = e.categoryRules || extractCategoryRules(e)
                const catText = e.category || '—'
                return {
                    kind: GridCellKind.Custom,
                    allowOverlay: true,
                    copyData: catText,
                    data: {
                        kind: 'category-cell',
                        categoryNames: catText,
                        rules,
                        employeeId: e.id,
                    },
                } satisfies CategoryCell
            }
            if (meta.id === 'subcategory') {
                const rules = e.categoryRules || extractCategoryRules(e)
                const subText = e.subcategory || '—'
                return {
                    kind: GridCellKind.Custom,
                    allowOverlay: true,
                    copyData: subText,
                    data: {
                        kind: 'subcategory-cell',
                        subcategoryNames: subText,
                        rules,
                        employeeId: e.id,
                    },
                } satisfies SubcategoryCell
            }
            if (meta.id === 'empCode') {
                const code = e.empCode || ''
                return {
                    kind: GridCellKind.Text,
                    data: code,
                    displayData: code || '—',
                    allowOverlay: true,
                    readonly: false,
                }
            }
            if (meta.id === 'email') {
                const email = e.email || ''
                return {
                    kind: GridCellKind.Text,
                    data: email,
                    displayData: email || '—',
                    allowOverlay: true,
                    readonly: false,
                }
            }
            if (meta.id === 'phone') {
                const phone = e.phone || ''
                return {
                    kind: GridCellKind.Text,
                    data: phone,
                    displayData: phone || '—',
                    allowOverlay: true,
                    readonly: false,
                }
            }
            const value = e[meta.id] !== undefined && e[meta.id] !== null ? String(e[meta.id]) : ''
            return {
                kind: GridCellKind.Text,
                data: value,
                displayData: value || '—',
                allowOverlay: meta.editable,
                readonly: !meta.editable,
            }
        },
        // `tick` is included so the grid repaints when avatar images finish loading
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [rows, tick],
    )

    const onCellEdited = useCallback(
        ([col, row]: Item, newValue: EditableGridCell) => {
            const meta = COLUMNS[col]
            if (meta.id === 'name' && newValue.kind === GridCellKind.Custom) {
                const data = newValue.data as { name: string }
                onEdit(rows[row].id, 'name', data.name)
                return
            }
            if (meta.id === 'empCode' && newValue.kind === GridCellKind.Text) {
                onEdit(rows[row].id, 'empCode', newValue.data)
                return
            }
            if (meta.id === 'email' && newValue.kind === GridCellKind.Text) {
                onEdit(rows[row].id, 'email', newValue.data)
                return
            }
            if (meta.id === 'phone' && newValue.kind === GridCellKind.Text) {
                onEdit(rows[row].id, 'phone', newValue.data)
                return
            }
            if (
                (meta.id === 'category' || meta.id === 'subcategory') &&
                newValue.kind === GridCellKind.Custom
            ) {
                const data = newValue.data as { rules: CategoryRuleAssignment[] }
                if (data?.rules) {
                    onCategoryChange?.(rows[row].id, data.rules)
                }
                return
            }
            if (meta.id === 'status' && newValue.kind === GridCellKind.Custom) {
                const data = newValue.data as { status: string }
                onStatusChange?.(rows[row].id, data.status)
                return
            }
            if (meta.id === 'managerName' && newValue.kind === GridCellKind.Custom) {
                const data = newValue.data as {
                    managerId: string | null
                    managerUserId: string | null
                }
                onManagerChange?.(rows[row].id, {
                    managerId: data.managerId,
                    managerUserId: data.managerUserId,
                })
                return
            }
            if (meta.id === 'joined' && newValue.kind === GridCellKind.Custom) {
                const data = newValue.data as { display: string }
                onEdit(rows[row].id, 'joined', data.display)
                return
            }
            if (meta.id === 'gender' && newValue.kind === GridCellKind.Custom) {
                const data = newValue.data as { gender: string }
                onEdit(rows[row].id, 'gender' as Field, data.gender)
                return
            }
            if (meta.id === 'department' && newValue.kind === GridCellKind.Custom) {
                const data = newValue.data as { department: string }
                onEdit(rows[row].id, 'department', data.department)
                return
            }
            if (meta.id === 'monthlyCtc' && newValue.kind === GridCellKind.Custom) {
                const data = newValue.data as { amount: number; basis: string; effectivePeriod?: string }
                onSalaryChange?.(rows[row].id, {
                    monthlyCtc: data.amount,
                    payBasis: data.basis,
                    effectivePeriod: data.effectivePeriod ?? curMonth(),
                })
                return
            }
            if (!meta.editable || newValue.kind !== GridCellKind.Text) return
            onEdit(rows[row].id, meta.id as Field, newValue.data)
        },
        [rows, onEdit, onCategoryChange, onStatusChange, onManagerChange, onSalaryChange],
    )

    return (
        <div className="h-full w-full">
            <DataEditor
                ref={gridRef}
                className="h-full w-full"
                theme={gridTheme}
                customRenderers={[
                    nameCellRenderer,
                    statusCellRenderer,
                    dateCellRenderer,
                    genderCellRenderer,
                    managerCellRenderer,
                    departmentCellRenderer,
                    salaryCellRenderer,
                    categoryCellRenderer,
                    subcategoryCellRenderer,
                ]}
                columns={columns}
                rows={rows.length}
                getCellContent={getCellContent}
                onCellEdited={onCellEdited}
                onColumnResize={(_, newSize, colIndex) =>
                    setWidths((w) => w.map((x, i) => (i === colIndex ? newSize : x)))
                }
                rowMarkers="checkbox-visible"
                rowSelectionMode="multi"
                gridSelection={selection}
                onGridSelectionChange={(s) => {
                    setSelection(s)
                    const selectedRows = s.rows.toArray().map((i) => rows[i]).filter(Boolean)
                    onSelectionChange?.(selectedRows)
                    const cell = s.current?.cell
                    onActiveRowChange?.(cell ? (rows[cell[1]] ?? null) : null)
                }}
                onCellClicked={([col, row]) => {
                    if (col === NAME_INDEX) onOpenProfile?.(rows[row])
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