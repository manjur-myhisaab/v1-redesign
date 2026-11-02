import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { PanelLeft, Search, ChevronsUpDown, ChevronDown, ChevronRight, Check, AlertCircle, Settings } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import rdk, { customEndpoint, getCurrentUser } from '@/services/server'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/auth/AuthContext'
import { getMe, getNavCounts, getBillingSummary, type NavCounts, type Paywall, type BillingSummary } from '@/lib/api'
import { saveProfile } from '@/lib/profile'
import { sound } from '@/lib/sound'
import LayeredShades from '@/components/LayeredShades'
import { PeopleProvider } from '@/lib/people'
import { NAV_GROUPS, navMeta, NEW_TAB_PATH, type NavGroup, type NavItem } from './nav'
import TabBar from './TabBar'
import GetStartedMenu from './GetStartedMenu'
import UpgradeModal from './UpgradeModal'
import WhatsappCreditsModal from './WhatsappCreditsModal'
import { useUserPermissions } from '@/features/roles/hooks/useUserPermissions'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

const STORAGE_KEY = 'admin.sidebar.collapsed'
const TABS_KEY = 'admin.tabs'
const ACTIVE_KEY = 'admin.activeTab'
const NAV_GROUP_EXPANDED_KEY = 'mh.navGroup.expanded'

function findGroupByPath(path: string, groups: NavGroup[]): string | null {
  for (const group of groups) {
    if (!group.label) continue
    if (group.items.some((item) => path === item.to || path.startsWith(item.to + '/'))) {
      return group.label
    }
  }
  return null
}

interface Tab {
  id: string
  path: string
}

const DEFAULT_TABS: Tab[] = [{ id: 't1', path: '/admin/staff' }]

function loadTabs(): Tab[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(TABS_KEY) ?? '')
    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every(
        (t) => t && typeof t.id === 'string' && typeof t.path === 'string',
      )
    ) {
      return parsed
    }
  } catch {
    /* ignore malformed storage */
  }
  return DEFAULT_TABS
}

function loadActiveId(tabs: Tab[]): string {
  const saved = localStorage.getItem(ACTIVE_KEY)
  return saved && tabs.some((t) => t.id === saved) ? saved : tabs[0].id
}

export default function AppShell() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(STORAGE_KEY) === '1',
  )
  const [tabs, setTabs] = useState<Tab[]>(loadTabs)
  const [activeId, setActiveId] = useState<string>(() => loadActiveId(tabs))
  const idRef = useRef(
    Math.max(0, ...tabs.map((t) => Number(t.id.slice(1)) || 0)),
  )
  const [, setNavCounts] = useState<NavCounts | null>(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [paywall, setPaywall] = useState<Paywall | null>(null)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { activeWorkspace, updateUser, user } = useAuth()
  const [whatsappCreditsOpen, setWhatsappCreditsOpen] = useState(false)
  const availableCredits = (user as any)?.firm_id?.whatsapp_credits_available ?? (user as any)?.whatsapp_credits_available
  const isLowCredits =
    availableCredits !== undefined &&
    availableCredits !== null &&
    Number(availableCredits) < 10
  const { isOwner, canAccessRoute } = useUserPermissions()
  const companyLogo = activeWorkspace?.logo || undefined
  const wsId = activeWorkspace?.id

  // Dynamically filter navigation groups based on user role permissions
  const visibleNavGroups = useMemo<NavGroup[]>(() => {
    if (isOwner) return NAV_GROUPS

    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessRoute(item.to)),
    })).filter((group) => group.items.length > 0)
  }, [isOwner, canAccessRoute])

  const [currentUserData, setCurrentUserData] = useState<any>(() => {
    try {
      const raw = localStorage.getItem('userData')
      if (raw) return JSON.parse(raw)
    } catch {}
    return null
  })

  useEffect(() => {
    getCurrentUser()
      .then((data) => {
        if (data) {
          setCurrentUserData(data)
          try {
            localStorage.setItem('userData', JSON.stringify(data))
          } catch {}
        }
      })
      .catch((err) => {
        console.warn('Could not fetch fresh user data:', err)
      })
  }, [])

  const currentFirmId = useMemo(() => {
    return (
      currentUserData?.firm_id?.firm_id ||
      (typeof currentUserData?.firm_id === 'string' || typeof currentUserData?.firm_id === 'number'
        ? String(currentUserData.firm_id)
        : null) ||
      (typeof user?.firm_id === 'object' ? String((user?.firm_id as any)?.firm_id) : null) ||
      (user?.firm_id ? String(user.firm_id) : null) ||
      activeWorkspace?.id ||
      ''
    )
  }, [currentUserData, user, activeWorkspace])

  const currentFirmName = useMemo(() => {
    return (
      currentUserData?.firm_id?.firm_name ||
      (typeof user?.firm_id === 'object' ? (user?.firm_id as any)?.firm_name : null) ||
      (user?.firm_name && user.firm_name !== 'Workspace' ? user.firm_name : null) ||
      (activeWorkspace?.name && activeWorkspace.name !== 'Workspace' ? activeWorkspace.name : null) ||
      currentUserData?.firm_name ||
      'RRV SOFTECH PVT LTD'
    )
  }, [currentUserData, user, activeWorkspace])

  const firmList = useMemo(() => {
    const rawFirms =
      currentUserData?.all_firms ||
      (user as any)?.all_firms ||
      (user as any)?.allfirms ||
      []

    const list: { firm_id: string; firm_name: string }[] = []
    const seenIds = new Set<string>()

    if (Array.isArray(rawFirms) && rawFirms.length > 0) {
      rawFirms.forEach((f: any) => {
        const fId =
          f?.firm_id?.firm_id ??
          f?.firm_id?.id ??
          f?.firm_id ??
          f?.id
        const fName =
          f?.firm_id?.firm_name ??
          f?.firm_id?.name ??
          f?.firm_name ??
          f?.name ??
          'Organization'

        if (fId !== undefined && fId !== null) {
          const strId = String(fId)
          if (!seenIds.has(strId)) {
            seenIds.add(strId)
            list.push({ firm_id: strId, firm_name: fName })
          }
        }
      })
    }

    if (currentFirmId && !seenIds.has(String(currentFirmId))) {
      list.unshift({ firm_id: String(currentFirmId), firm_name: currentFirmName })
    }

    return list
  }, [currentUserData, user, currentFirmId, currentFirmName])

  // React Query Mutation to update firm - exactly matching CurrentUserLayout.jsx
  const switchFirmMutation = useMutation({
    mutationFn: async (selectedFirmId: string) => {
      const currentUserId = currentUserData?.id || user?.id
      if (!currentUserId) throw new Error('User ID not found')

      return await rdk.request(
        customEndpoint({
          path: `users/${currentUserId}`,
          method: 'PATCH',
          body: JSON.stringify({ firm_id: selectedFirmId }),
        }),
      )
    },
    onSuccess: (_, selectedFirmId) => {
      toast.success('Firm switched successfully! Reloading...', { id: 'firm-switch' })

      try {
        const stored = localStorage.getItem('userData')
        if (stored) {
          const parsed = JSON.parse(stored)
          const targetFirm = firmList.find((f) => f.firm_id === selectedFirmId)
          parsed.firm_id = {
            firm_id: selectedFirmId,
            firm_name: targetFirm?.firm_name || parsed?.firm_id?.firm_name || 'Organization',
          }
          localStorage.setItem('userData', JSON.stringify(parsed))
        }

        localStorage.setItem('mh.activeWs', selectedFirmId)
        const mhUser = localStorage.getItem('mh.user')
        if (mhUser) {
          const parsedMh = JSON.parse(mhUser)
          const targetFirm = firmList.find((f) => f.firm_id === selectedFirmId)
          parsedMh.firm_id = selectedFirmId
          parsedMh.firm_name = targetFirm?.firm_name || parsedMh.firm_name
          localStorage.setItem('mh.user', JSON.stringify(parsedMh))
        }
      } catch (e) {
        console.error('Error syncing localStorage on firm switch:', e)
      }

      setTimeout(() => {
        window.location.reload()
      }, 700)
    },
    onError: (error: any) => {
      console.error('Update Firm Error:', error)
      toast.error('Failed to switch firm. Please try again.', { id: 'firm-switch' })
    },
  })

  const [showSwitchDialog, setShowSwitchDialog] = useState(false)
  const [selectedFirmToSwitch, setSelectedFirmToSwitch] = useState<{ firm_id: string; firm_name: string } | null>(null)

  const handleSwitchConfirm = () => {
    if (selectedFirmToSwitch) {
      toast.loading('Switching firm...', { id: 'firm-switch' })
      switchFirmMutation.mutate(selectedFirmToSwitch.firm_id)
    }
  }

  // subtle click sound on any button/link/toggle press (the gesture also
  // unlocks the AudioContext)
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(
        'button, [role="button"], a[href], summary, label, select, [data-sound]',
      )
      if (!el || el.hasAttribute('data-no-sound')) return
      if ((el as HTMLButtonElement).disabled) return
      const role = el.getAttribute('role')
      const tag = el.tagName.toLowerCase()
      if (tag === 'select' || role === 'checkbox' || role === 'switch') sound.toggle()
      else sound.click()
    }
    document.addEventListener('pointerdown', onDown, { passive: true })
    return () => document.removeEventListener('pointerdown', onDown)
  }, [])

  // hydrate the local profile cache from the server (keeps avatar/name/etc.
  // consistent across devices; localStorage is only a fast cache)
  useEffect(() => {
    getMe()
      .then((me) => {
        updateUser({ name: me.name, email: me.email, phone: me.phone })
        saveProfile(me.id, {
          title: me.title,
          timezone: me.timezone,
          workingHours: me.workingHours,
          avatar: me.avatar ? JSON.parse(me.avatar) : undefined,
        })
      })
      .catch(() => { })
  }, [updateUser])

  // live sidebar badge counts (employees / present today / pending leaves)
  useEffect(() => {
    getNavCounts().then(setNavCounts).catch(() => { })
  }, [pathname])

  // billing context for the Upgrade-to-Pro modal
  const loadPaywall = (id: string) =>
    getBillingSummary(id)
      .then((s: BillingSummary) => {
        setPaywall({
          plan: s.plan,
          usedSeats: s.employees.used,
          seatLimit: s.employees.cap,
          perMemberPaise: s.perMemberPaise,
          proSeatPaise: s.proSeatPaise,
          annualPaise: s.annualPaise,
          annualTiers: s.annualTiers,
        })
      })
      .catch(() => { })
  useEffect(() => {
    if (wsId) loadPaywall(wsId)
  }, [wsId])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  const [expandedGroup, setExpandedGroup] = useState<string | null>(() => {
    const matching = findGroupByPath(pathname, NAV_GROUPS)
    if (matching) return matching
    try {
      const saved = localStorage.getItem(NAV_GROUP_EXPANDED_KEY)
      if (saved) return saved
    } catch {}
    return 'Employees'
  })

  // Keep expanded group in sync when active route changes
  useEffect(() => {
    const matching = findGroupByPath(pathname, visibleNavGroups)
    if (matching) {
      setExpandedGroup(matching)
    }
  }, [pathname, visibleNavGroups])

  // Persist expanded group
  useEffect(() => {
    if (expandedGroup) {
      localStorage.setItem(NAV_GROUP_EXPANDED_KEY, expandedGroup)
    } else {
      localStorage.removeItem(NAV_GROUP_EXPANDED_KEY)
    }
  }, [expandedGroup])

  // Accordion toggle: Only ONE group can be open at a time
  const toggleGroup = (label: string) =>
    setExpandedGroup((prev) => (prev === label ? null : label))

  // persist tabs + active tab across reloads
  useEffect(() => {
    localStorage.setItem(TABS_KEY, JSON.stringify(tabs))
  }, [tabs])
  useEffect(() => {
    localStorage.setItem(ACTIVE_KEY, activeId)
  }, [activeId])

  // navigation (e.g. sidebar click) updates the *active* tab's page,
  // so each tab holds its own current page like a browser tab
  useEffect(() => {
    if (!navMeta(pathname)) return
    setTabs((prev) =>
      prev.map((t) => (t.id === activeId ? { ...t, path: pathname } : t)),
    )
  }, [pathname, activeId])

  const selectTab = (id: string) => {
    const tab = tabs.find((t) => t.id === id)
    if (!tab) return
    setActiveId(id)
    navigate(tab.path)
  }

  const newTab = () => {
    const id = `t${++idRef.current}`
    setTabs((prev) => [...prev, { id, path: NEW_TAB_PATH }])
    setActiveId(id)
    navigate(NEW_TAB_PATH)
  }

  const openTab = (path: string) => {
    const existing = tabs.find((t) => t.path === path)
    if (existing) {
      selectTab(existing.id)
    } else {
      const id = `t${++idRef.current}`
      setTabs((prev) => [...prev, { id, path }])
      setActiveId(id)
      navigate(path)
    }
  }

  const closeTab = (id: string) => {
    if (tabs.length <= 1) return
    const idx = tabs.findIndex((t) => t.id === id)
    const next = tabs.filter((t) => t.id !== id)
    if (id === activeId) {
      const fallback = next[Math.max(0, idx - 1)]
      setActiveId(fallback.id)
      navigate(fallback.path)
    }
    setTabs(next)
  }

  const renderNav = (items: NavItem[]) =>
    items.map(({ to, label, icon: Icon, badge: staticBadge }) => {
      return (
        <NavLink
          key={to}
          to={to}
          title={collapsed ? label : undefined}
          className={({ isActive }) =>
            cn(
              'flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors',
              collapsed && 'justify-center px-0',
              isActive
                ? 'bg-white/70 text-foreground shadow-sm dark:bg-white/10 dark:text-foreground'
                : 'text-muted-foreground hover:bg-white/45 hover:text-foreground dark:hover:bg-white/5',
            )
          }
        >
          <Icon className="size-4 shrink-0" />
          {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
          {!collapsed && staticBadge && (
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-500 tracking-wide uppercase">
              {staticBadge}
            </span>
          )}
        </NavLink>
      )
    })

  return (
    <PeopleProvider>
      <div className="relative flex h-screen overflow-hidden text-foreground">
        <LayeredShades className="absolute inset-0 -z-10" />

        {/* sidebar */}
        <aside
          className={cn(
            'flex shrink-0 flex-col gap-3 px-2.5 py-3 tracking-tight transition-[width] duration-200 ease-out dark:bg-black/100 dark:backdrop-blur-md dark:border-r dark:border-white/5',
            collapsed ? 'w-[56px]' : 'w-60',
          )}
        >
          {/* workspace switcher + collapse toggle */}
          <div className={cn('flex items-center gap-1', collapsed && 'flex-col gap-2')}>
            {firmList.length > 1 ? (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 text-left transition-colors hover:bg-white/45 dark:hover:bg-white/5 cursor-pointer group"
                    title={currentFirmName}
                  >
                    <img
                      src={companyLogo ?? '/payroll-logo-512.png'}
                      alt={currentFirmName}
                      className="size-7 shrink-0 rounded-md object-cover"
                      draggable={false}
                    />
                    {!collapsed && (
                      <>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold group-hover:text-primary transition-colors">
                          {currentFirmName}
                        </span>
                        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
                      </>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-60 p-1.5" align="start" side="bottom">
                  <div className="flex flex-col gap-0.5">
                    <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Switch Firm
                    </p>
                    {firmList.map((f) => {
                      const isCurrent = String(f.firm_id) === String(currentFirmId)
                      return (
                        <button
                          key={f.firm_id}
                          onClick={() => {
                            if (isCurrent || switchFirmMutation.isPending) return
                            setSelectedFirmToSwitch(f)
                            setShowSwitchDialog(true)
                          }}
                          className={cn(
                            'flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-[13px] transition-colors text-left',
                            isCurrent
                              ? 'bg-muted font-medium text-foreground'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                          )}
                        >
                          <span className="truncate">{f.firm_name}</span>
                          {isCurrent && (
                            <Check className="size-3.5 shrink-0 text-emerald-600" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <div
                className="flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 text-left"
                title={currentFirmName}
              >
                <img
                  src={companyLogo ?? '/payroll-logo-512.png'}
                  alt={currentFirmName}
                  className="size-7 shrink-0 rounded-md object-cover"
                  draggable={false}
                />
                {!collapsed && (
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {currentFirmName}
                  </span>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-white/45 hover:text-foreground dark:hover:bg-white/5"
            >
              <PanelLeft className="size-4" />
            </button>
          </div>

          {/* quick actions */}
          {collapsed ? (
            <button
              type="button"
              title="Quick actions"
              className="grid size-8 cursor-pointer place-items-center self-center rounded-md border border-white/50 dark:border-white/10 bg-white/30 dark:bg-white/5 backdrop-blur-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <Search className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-md border border-white/50 dark:border-white/10 bg-white/30 dark:bg-white/5 backdrop-blur-sm px-2.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <Search className="size-3.5 shrink-0" />
              <span className="flex-1 text-left">Quick Actions</span>
              <kbd className="rounded border border-border px-1 text-[11px] leading-tight">
                J
              </kbd>
            </button>
          )}

          {/* navigation */}
          <nav className="flex min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
            {collapsed
              ? // icon-only mode: all items in order, groups separated by a
              // thin divider; no group labels, group-collapse disabled
              visibleNavGroups.map((group, gi) => (
                <div
                  key={group.label || `ungrouped-${gi}`}
                  className={cn(
                    'flex flex-col gap-0.5',
                    gi > 0 && 'mt-2 border-t border-border pt-2',
                  )}
                >
                  {renderNav(group.items)}
                </div>
              ))
              : visibleNavGroups.map((group, gi) => {
                // ungrouped (empty label): render items with no header/chevron
                if (!group.label) {
                  return (
                    <div key={`ungrouped-${gi}`} className="flex flex-col gap-0.5">
                      {renderNav(group.items)}
                    </div>
                  )
                }
                const isExpanded = expandedGroup === group.label
                const Chevron = isExpanded ? ChevronDown : ChevronRight
                return (
                  <div key={group.label} className={cn(gi > 0 && 'mt-3')}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.label)}
                      aria-expanded={isExpanded}
                      className="flex w-full items-center gap-1.5 px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
                    >
                      <Chevron className="size-3 shrink-0 transition-transform" />
                      <span className="flex-1 text-left">{group.label}</span>
                      {group.badge && (
                        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-500 tracking-wide uppercase">
                          {group.badge}
                        </span>
                      )}
                    </button>
                    {isExpanded && (
                      // indent submenus under the group label with a faint
                      // guide line so the hierarchy reads visually
                      <div className="ml-[15px] flex flex-col gap-0.5 border-l border-border/60 pl-2">
                        {renderNav(group.items)}
                      </div>
                    )}
                  </div>
                )
              })}
          </nav>

          {/* footer */}
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <GetStartedMenu collapsed />
              {isLowCredits && (
                <button
                  type="button"
                  title={`Low WhatsApp credits (${availableCredits}). Click to buy more.`}
                  onClick={() => setWhatsappCreditsOpen(true)}
                  className="grid size-8 cursor-pointer place-items-center rounded-md bg-rose-500/15 text-rose-500 transition-colors hover:bg-rose-500/25 animate-pulse"
                >
                  <AlertCircle className="size-4" />
                </button>
              )}
              
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <NavLink
                to="/admin/settings"
                className={cn(
                  'flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors',
                  pathname.startsWith('/admin/settings') || pathname.startsWith('/settings')
                    ? 'bg-muted font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-white/45 hover:text-foreground dark:hover:bg-white/5',
                )}
              >
                <Settings className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 text-left font-medium">Settings</span>
              </NavLink>
              <GetStartedMenu collapsed={false} />
              {isLowCredits && (
                <div
                  onClick={() => setWhatsappCreditsOpen(true)}
                  className="my-1 cursor-pointer rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-rose-600 transition-all hover:bg-rose-500/15 dark:text-rose-400 animate-pulse duration-[3000ms]"
                >
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="size-3.5 text-rose-500 shrink-0" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                      Low WhatsApp Credits
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground leading-snug">
                    Only <strong className="font-semibold text-rose-600 dark:text-rose-400">{Number(availableCredits)}</strong> credits remaining.
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setWhatsappCreditsOpen(true)
                    }}
                    className="mt-2 w-full cursor-pointer rounded bg-rose-600 py-1 text-[11px] font-semibold text-white shadow hover:bg-rose-700 active:scale-[0.98] transition-all uppercase tracking-wide flex items-center justify-center gap-1.5"
                  >
                    <AlertCircle className="size-3" />
                    <span>Buy More Credits</span>
                  </button>
                </div>
              )}
              
            </div>
          )}
        </aside>

        {/* right column: tabs above the content panels */}
        <div className="flex min-w-0 flex-1 flex-col">
          <TabBar
            tabs={tabs}
            activeId={activeId}
            onSelect={selectTab}
            onClose={closeTab}
            onNew={newTab}
          />
          <main className="flex min-h-0 flex-1 gap-2 pb-2 pr-2">
            <Outlet context={{ firstTabActive: tabs[0]?.id === activeId, openTab }} />
          </main>
        </div>

        {/* <BetaModal open={beta} onClose={closeBeta} /> */}

        {upgradeOpen && wsId && paywall && (
          <UpgradeModal
            workspaceId={wsId}
            workspaceName={activeWorkspace?.name}
            paywall={paywall}
            onClose={() => setUpgradeOpen(false)}
            onSuccess={() => {
              setUpgradeOpen(false)
              loadPaywall(wsId)
            }}
          />
        )}

        <WhatsappCreditsModal
          isOpen={whatsappCreditsOpen}
          onClose={() => setWhatsappCreditsOpen(false)}
        />

        <AlertDialog open={showSwitchDialog} onOpenChange={setShowSwitchDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Switch Firm?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to switch to <span className="font-semibold text-foreground">{selectedFirmToSwitch?.firm_name}</span>? This will switch your active firm and refresh the application.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={switchFirmMutation.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleSwitchConfirm} disabled={switchFirmMutation.isPending}>
                {switchFirmMutation.isPending ? 'Switching...' : 'Confirm'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PeopleProvider>
  )
}
