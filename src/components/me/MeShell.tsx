import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Home,
  CalendarClock,
  CalendarDays,
  Wallet,
  Receipt,
  FileText,
  Laptop,
  LifeBuoy,
  Target,
  UserRound,
  ArrowLeft,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/auth/AuthContext'
import { getMe } from '@/lib/api'
import { loadProfile, saveProfile } from '@/lib/profile'
import LayeredShades from '@/components/LayeredShades'
// import NotificationBell from '@/components/admin/NotificationBell'
import NetworkStatusIndicator from '@/components/NetworkStatusIndicator'
import PersonAvatar from '@/components/admin/PersonAvatar'
import { type AvatarFullConfig } from 'react-nice-avatar'

const NAV: { to: string; label: string; icon: typeof Home }[] = [
  { to: '/me', label: 'Home', icon: Home },
  { to: '/me/attendance', label: 'Attendance', icon: CalendarClock },
  { to: '/me/leave', label: 'Leave', icon: CalendarDays },
  { to: '/me/payslips', label: 'Payslips', icon: Wallet },
  { to: '/me/expenses', label: 'Expenses', icon: Receipt },
  { to: '/me/documents', label: 'Documents', icon: FileText },
  { to: '/me/assets', label: 'Assets', icon: Laptop },
  { to: '/me/helpdesk', label: 'Helpdesk', icon: LifeBuoy },
  { to: '/me/performance', label: 'Performance', icon: Target },
  { to: '/me/profile', label: 'Profile', icon: UserRound },
]

import { useUserProfileQuery } from '@/features/auth/hooks/useUserProfile'
import { useUserPermissions } from '@/features/roles/hooks/useUserPermissions'
import BreakMask from './BreakMask'

export default function MeShell() {
  const { user, activeWorkspace, logout } = useAuth()
  const { data: profile } = useUserProfileQuery()
  const { hasAdminAccess } = useUserPermissions()
  const navigate = useNavigate()
  const [avatar, setAvatar] = useState<AvatarFullConfig | undefined>(
    () => (user ? loadProfile(user.id).avatar : undefined),
  )

  const firmName =
    profile?.firm?.firm_name ||
    profile?.user?.firm_name ||
    user?.firm_name ||
    activeWorkspace?.name ||
    'My Workspace'

  const hasAdmin = hasAdminAccess

  // hydrate profile (avatar) from the server, same as the admin shell
  useEffect(() => {
    getMe()
      .then((me) => {
        const cfg = me.avatar ? (JSON.parse(me.avatar) as AvatarFullConfig) : undefined
        setAvatar(cfg)
        saveProfile(me.id, {
          title: me.title,
          timezone: me.timezone,
          workingHours: me.workingHours,
          avatar: cfg,
        })
      })
      .catch(() => { })
  }, [])

  const onLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="relative flex h-screen overflow-hidden text-foreground">
      <LayeredShades className="absolute inset-0 -z-10" />

      {/* Break Mask when on Break */}
      <BreakMask />

      {/* sidebar */}
      <aside className="flex w-60 shrink-0 flex-col gap-3 px-2.5 py-3 tracking-tight dark:bg-black/70 dark:backdrop-blur-md dark:border-r dark:border-white/5">
        {/* workspace identity */}
        <div className="flex items-center gap-2 rounded-md p-1">
          <img
            src={activeWorkspace?.logo || '/payroll-logo-512.png'}
            alt={firmName}
            className="size-7 shrink-0 rounded-md object-cover"
            draggable={false}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{firmName}</div>
            <div className="text-[11px] text-muted-foreground">Self-service</div>
          </div>
        </div>

        {/* nav */}
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/me'}
              className={({ isActive }) =>
                cn(
                  'flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors',
                  isActive
                    ? 'bg-white/70 text-foreground shadow-sm dark:bg-white/10 dark:text-foreground'
                    : 'text-muted-foreground hover:bg-white/45 hover:text-foreground dark:hover:bg-white/5',
                )
              }
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1 truncate">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* footer: back to admin (only for admin) + logout */}
        <div className="flex flex-col gap-0.5">
          {hasAdmin && (
            <NavLink
              to="/admin"
              className="flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-white/45 hover:text-foreground dark:hover:bg-white/5"
            >
              <ArrowLeft className="size-4 shrink-0" />
              <span className="flex-1 truncate">Back to admin</span>
            </NavLink>
          )}
          <button
            type="button"
            onClick={onLogout}
            className="flex h-8 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-white/45 hover:text-foreground dark:hover:bg-white/5"
          >
            <LogOut className="size-4 shrink-0" />
            <span className="flex-1 truncate text-left">Log out</span>
          </button>
        </div>
      </aside>

      {/* right column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* top bar */}
        <header className="flex h-12 shrink-0 items-center justify-end gap-3 px-3">
          <NetworkStatusIndicator />
          {/* <NotificationBell /> */}
          <div className="flex items-center gap-2">
            <PersonAvatar name={user?.name ?? 'Me'} config={avatar} className="size-7" />
            <span className="text-[13px] font-medium text-white drop-shadow-sm">{user?.name ?? 'Me'}</span>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 gap-2 pb-2 pr-2">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
