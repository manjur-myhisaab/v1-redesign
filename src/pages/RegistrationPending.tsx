import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/auth/AuthContext'

export default function RegistrationPending() {
  const { user, logout, activeWorkspace } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const status = (user as any)?.firm_id?.status || activeWorkspace?.role
    if (status === 'active' || status === 'Owner' || status === 'Admin') {
      navigate('/admin/staff')
    }
  }, [user, activeWorkspace, navigate])

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background text-foreground">
      <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-lg p-6 md:p-8 flex flex-col items-center text-center">
        <div className="size-16 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4">
          <Clock className="size-8" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight mb-2">Registration Under Review</h1>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          Your organization account is currently undergoing verification by our compliance team.
          You will receive an automated notification as soon as access is granted.
        </p>

        <div className="w-full rounded-xl bg-muted/40 border border-border p-3 text-xs text-left mb-6 flex flex-col gap-1.5">
          <span className="text-muted-foreground">Account Holder:</span>
          <span className="font-semibold text-foreground">{user?.name || user?.phone}</span>
          <span className="text-muted-foreground mt-1">Firm:</span>
          <span className="font-semibold text-foreground">
            {typeof (user as any)?.firm_id === 'object' ? (user as any).firm_id?.firm_name : (user as any)?.firm_name || 'My Firm'}
          </span>
        </div>

        <div className="flex w-full flex-col gap-2">
          <Button
            variant="outline"
            className="w-full gap-2 cursor-pointer"
            onClick={() => window.location.reload()}
          >
            Check Status Again
          </Button>
          <Button
            variant="ghost"
            className="w-full gap-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
            onClick={async () => {
              await logout()
              navigate('/login')
            }}
          >
            <LogOut className="size-4" />
            <span>Sign Out</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
