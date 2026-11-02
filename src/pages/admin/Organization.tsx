import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Search, ChevronDown, Minus, Plus, Download, RotateCcw } from 'lucide-react'
import MetricCard from '@/components/admin/MetricCard'
import Panel from '@/components/admin/Panel'
import PersonAvatar from '@/components/admin/PersonAvatar'
import { useShell } from '@/components/admin/shell-context'
import { useAuth } from '@/context/auth/AuthContext'
import { cn } from '@/lib/utils'
import { listEmployees, listMembers, type Member } from '@/lib/api'
import { genderSex, type Employee } from '@/lib/employees'

interface OrgNode {
  id: string // 'e:'+employeeId or 'm:'+userId
  name: string
  role: string
  department: string
  sex?: 'man' | 'woman'
  kind: 'employee' | 'member'
  children: OrgNode[]
}

const ROLE_RANK: Record<string, number> = { Owner: 0, Admin: 1, Manager: 2, Member: 3 }

// build a forest where an employee reports to either another employee
// (managerId) or a workspace member (managerUserId). ALL workspace members
// (owner + others) appear as top-level nodes; members who are also employees
// (matched by phone) are shown once as the employee.
function buildForest(emps: Employee[], members: Member[]): OrgNode[] {
  const empPhones = new Set(emps.map((e) => e.phone).filter(Boolean))
  const nodes = new Map<string, OrgNode>()
  const memberNodeIds: string[] = []

  for (const e of emps) {
    nodes.set(`e:${e.id}`, {
      id: `e:${e.id}`,
      name: e.name,
      role: e.role,
      department: e.department,
      sex: genderSex(e.gender),
      kind: 'employee',
      children: [],
    })
  }
  for (const m of members) {
    if (m.phone && empPhones.has(m.phone)) continue // already shown as an employee
    nodes.set(`m:${m.userId}`, {
      id: `m:${m.userId}`,
      name: m.name || m.phone || 'Member',
      role: m.role || 'Member',
      department: '',
      kind: 'member',
      children: [],
    })
    memberNodeIds.push(`m:${m.userId}`)
  }

  const roots: OrgNode[] = []
  for (const e of emps) {
    const node = nodes.get(`e:${e.id}`)!
    const parent = e.managerId
      ? nodes.get(`e:${e.managerId}`)
      : e.managerUserId
        ? nodes.get(`m:${e.managerUserId}`)
        : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  for (const id of memberNodeIds) roots.push(nodes.get(id)!)

  // sort children by name everywhere
  const sortKids = (ns: OrgNode[]) =>
    ns.forEach((n) => {
      n.children.sort((a, b) => a.name.localeCompare(b.name))
      sortKids(n.children)
    })
  sortKids(roots)
  // roots: members first (Owner → Admin → Manager → Member), then employees
  roots.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'member' ? -1 : 1
    if (a.kind === 'member')
      return (
        (ROLE_RANK[a.role] ?? 9) - (ROLE_RANK[b.role] ?? 9) || a.name.localeCompare(b.name)
      )
    return a.name.localeCompare(b.name)
  })
  return roots
}

// keep nodes matching the predicate plus their ancestor chain
function prune(nodes: OrgNode[], match: (n: OrgNode) => boolean): OrgNode[] {
  const out: OrgNode[] = []
  for (const n of nodes) {
    const kids = prune(n.children, match)
    if (match(n) || kids.length) out.push({ ...n, children: kids })
  }
  return out
}

export default function Organization() {
  const { firstTabActive } = useShell()
  const { activeWorkspace } = useAuth()
  const wsId = activeWorkspace?.id ?? ''
  const [emps, setEmps] = useState<Employee[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [dept, setDept] = useState('all')
  const ZOOM_KEY = 'mh.orgZoom'
  const [zoom, setZoom] = useState(() => {
    const n = parseFloat(localStorage.getItem(ZOOM_KEY) ?? '')
    return Number.isFinite(n) && n > 0 ? n : 1
  })
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  // persist the zoom level across reloads / navigation
  useEffect(() => {
    localStorage.setItem(ZOOM_KEY, String(zoom))
  }, [zoom])

  // Figma-style pan (drag the canvas)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [grabbing, setGrabbing] = useState(false)
  const drag = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [recenterToken, setRecenterToken] = useState(0)

  // center the hierarchy in the canvas (horizontally always; vertically when it
  // fits, otherwise pin near the top). Runs on load and on Reset.
  useLayoutEffect(() => {
    const c = canvasRef.current
    const t = contentRef.current
    if (!c || !t) return
    const cr = c.getBoundingClientRect()
    const tr = t.getBoundingClientRect()
    const dx = cr.left + cr.width / 2 - (tr.left + tr.width / 2)
    const dy =
      tr.height <= cr.height - 64
        ? cr.top + cr.height / 2 - (tr.top + tr.height / 2)
        : cr.top + 32 - tr.top
    setPan((p) => ({ x: Math.round(p.x + dx), y: Math.round(p.y + dy) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterToken])

  const onPointerDown = (e: React.PointerEvent) => {
    // let interactive controls (collapse badges etc.) handle their own clicks
    if ((e.target as HTMLElement).closest('button, select, input, a')) return
    drag.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y }
    setGrabbing(true)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    setPan({
      x: drag.current.px + (e.clientX - drag.current.sx),
      y: drag.current.py + (e.clientY - drag.current.sy),
    })
  }
  const endPan = () => {
    drag.current = null
    setGrabbing(false)
  }
  // Reset = fit the whole hierarchy into the canvas, then center
  const resetView = () => {
    const c = canvasRef.current
    const t = contentRef.current
    if (c && t && t.offsetWidth && t.offsetHeight) {
      const fit = Math.min(
        (c.clientWidth - 80) / t.offsetWidth,
        (c.clientHeight - 80) / t.offsetHeight,
        1,
      )
      setZoom(Math.max(0.2, +fit.toFixed(2)))
    }
    setRecenterToken((tok) => tok + 1)
  }

  useEffect(() => {
    listEmployees()
      .then(setEmps)
      .finally(() => {
        setLoading(false)
        setRecenterToken((t) => t + 1)
      })
  }, [])

  useEffect(() => {
    if (!wsId) return
    listMembers(wsId)
      .then((m) => {
        setMembers(m)
        setRecenterToken((t) => t + 1)
      })
      .catch(() => {})
  }, [wsId])

  const departments = useMemo(
    () => [...new Set(emps.map((e) => e.department).filter(Boolean))].sort(),
    [emps],
  )

  // summary metrics from the loaded org data (employees + their reporting links)
  const metrics = useMemo(() => {
    const managerIds = new Set<string>()
    let reports = 0
    for (const e of emps) {
      if (e.managerId) {
        reports++
        managerIds.add(`e:${e.managerId}`)
      } else if (e.managerUserId) {
        reports++
        managerIds.add(`m:${e.managerUserId}`)
      }
    }
    const managers = managerIds.size
    const avgSpan = managers ? (reports / managers).toFixed(1) : '—'
    return { departments: departments.length, employees: emps.length, managers, avgSpan }
  }, [emps, departments])

  const filtering = query.trim().length > 0 || dept !== 'all'
  const forest = useMemo(() => {
    const full = buildForest(emps, members)
    if (!filtering) return full
    const q = query.toLowerCase()
    return prune(
      full,
      (n) =>
        (dept === 'all' || n.department === dept) &&
        (q === '' ||
          n.name.toLowerCase().includes(q) ||
          n.role.toLowerCase().includes(q) ||
          n.department.toLowerCase().includes(q)),
    )
  }, [emps, members, query, dept, filtering])

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const exportCsv = () => {
    const byId = new Map(emps.map((e) => [e.id, e]))
    const memberByUser = new Map(members.map((m) => [m.userId, m]))
    const managerName = (e: Employee) =>
      e.managerId
        ? (byId.get(e.managerId)?.name ?? '')
        : e.managerUserId
          ? (memberByUser.get(e.managerUserId)?.name ?? '')
          : ''
    const rows = [
      ['Name', 'Role', 'Department', 'Reports To', 'Status'],
      ...emps.map((e) => [e.name, e.role, e.department, managerName(e), e.status]),
    ]
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'org-chart.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const matchesQuery = (n: OrgNode) => {
    const q = query.trim().toLowerCase()
    return q !== '' && n.name.toLowerCase().includes(q)
  }

  return (
    <Panel
      className={cn(
        'flex min-w-0 flex-1 flex-col overflow-hidden',
        firstTabActive && 'rounded-tl-none',
      )}
    >
      {/* summary metrics */}
      <div className="grid shrink-0 grid-cols-2 gap-3 border-b border-border p-4 lg:grid-cols-4">
        <MetricCard label="Departments" value={String(metrics.departments)} />
        <MetricCard label="Employees" value={String(metrics.employees)} />
        <MetricCard label="Managers" value={String(metrics.managers)} />
        <MetricCard label="Avg span of control" value={metrics.avgSpan} />
      </div>

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <div className="flex h-9 w-60 items-center gap-1.5 rounded-md border border-input bg-card px-2.5 text-[13px]">
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for employee…"
            className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <select
              value={dept}
              onChange={(e) => setDept(e.target.value)}
              className="h-9 cursor-pointer appearance-none rounded-md border border-input bg-card pl-3 pr-8 text-[13px] outline-none focus:border-ring"
            >
              <option value="all">All departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>
          <button
            onClick={exportCsv}
            className="btn-3d inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Download className="size-3.5" />
            Export
          </button>
        </div>
      </div>

      {/* chart canvas — Figma-style pannable, dotted background */}
      <div
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPan}
        onPointerLeave={endPan}
        onPointerCancel={endPan}
        className="relative min-h-0 flex-1 select-none overflow-hidden bg-muted/30"
        style={{
          cursor: forest.length ? (grabbing ? 'grabbing' : 'grab') : 'default',
          backgroundImage:
            'radial-gradient(circle, rgba(20,20,30,0.16) 1px, transparent 1px)',
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      >
        {loading ? (
          <div className="grid h-full place-items-center text-[13px] text-muted-foreground">
            Loading organization…
          </div>
        ) : forest.length === 0 ? (
          <div className="grid h-full place-items-center text-[13px] text-muted-foreground">
            {emps.length === 0 ? 'No employees yet' : 'No matches'}
          </div>
        ) : (
          <div
            ref={contentRef}
            className="absolute left-1/2 top-0"
            style={{
              transform: `translate(calc(-50% + ${pan.x}px), ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'top center',
            }}
          >
            <div className="orgtree">
              <ul>
                {forest.map((n) => (
                  <TreeNode
                    key={n.id}
                    node={n}
                    collapsed={collapsed}
                    onToggle={toggle}
                    forceExpand={filtering}
                    highlight={matchesQuery}
                  />
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* zoom controls — pinned bottom-right */}
        <div className="absolute bottom-4 right-4 z-20 flex w-fit items-center gap-1 rounded-full border border-border bg-background/90 px-2 py-1 shadow-sm backdrop-blur">
          <button
            onClick={resetView}
            className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full px-2 text-[12px] text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3.5" />
            Reset
          </button>
          <span className="mx-1 h-4 w-px bg-border" />
          <button
            onClick={() => setZoom((z) => Math.max(0.2, +(z - 0.1).toFixed(2)))}
            className="grid size-7 cursor-pointer place-items-center rounded-full hover:bg-muted"
          >
            <Minus className="size-3.5" />
          </button>
          <span className="w-10 text-center text-[12px] tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))}
            className="grid size-7 cursor-pointer place-items-center rounded-full hover:bg-muted"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
      </div>
    </Panel>
  )
}

function TreeNode({
  node,
  collapsed,
  onToggle,
  forceExpand,
  highlight,
}: {
  node: OrgNode
  collapsed: Set<string>
  onToggle: (id: string) => void
  forceExpand: boolean
  highlight: (n: OrgNode) => boolean
}) {
  const hasChildren = node.children.length > 0
  const isCollapsed = !forceExpand && collapsed.has(node.id)
  const showChildren = hasChildren && !isCollapsed

  return (
    <li>
      <div
        className={cn(
          'relative w-56 rounded-xl border bg-card p-3 text-left shadow-sm transition-shadow',
          highlight(node) ? 'border-[#2f63d8] ring-2 ring-[#2f63d8]/30' : 'border-border',
        )}
      >
        <div className="flex items-start gap-2.5">
          <PersonAvatar name={node.name} sex={node.sex} className="size-9" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[13px] font-semibold tracking-tight">
                {node.name}
              </span>
              {node.kind === 'member' && (
                <span className="shrink-0 rounded-full bg-[#2f63d8]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#2f63d8]">
                  {node.role}
                </span>
              )}
            </div>
            <div className="truncate text-[12px] text-muted-foreground">
              {node.kind === 'member' ? 'Workspace member' : node.role || '—'}
            </div>
            {node.department && (
              <div className="truncate text-[11px] text-muted-foreground">
                {node.department}
              </div>
            )}
          </div>
        </div>

        {hasChildren && (
          <button
            onClick={() => onToggle(node.id)}
            disabled={forceExpand}
            title={isCollapsed ? 'Expand' : 'Collapse'}
            className={cn(
              'absolute -bottom-3 left-1/2 grid size-6 -translate-x-1/2 cursor-pointer place-items-center rounded-full text-[11px] font-semibold tabular-nums shadow-sm transition-colors',
              isCollapsed
                ? 'bg-muted text-foreground hover:bg-muted/80'
                : 'bg-foreground text-background',
              forceExpand && 'cursor-default',
            )}
          >
            {node.children.length}
          </button>
        )}
      </div>

      {showChildren && (
        <ul>
          {node.children.map((c) => (
            <TreeNode
              key={c.id}
              node={c}
              collapsed={collapsed}
              onToggle={onToggle}
              forceExpand={forceExpand}
              highlight={highlight}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
