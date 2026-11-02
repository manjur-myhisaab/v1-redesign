import { useNavigate } from 'react-router-dom'
import { FileQuestion, ArrowLeft, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/auth/AuthContext'
import { useUserProfileQuery } from '@/features/auth/hooks/useUserProfile'

export default function NotFound() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: profile } = useUserProfileQuery()

  const roles = profile?.roles || user?.roles || []
  const role = profile?.user?.role || user?.role || []
  const isOwner = Array.isArray(role)
    ? role.some((r) => String(r).toUpperCase() === 'OWNER' || String(r).toUpperCase() === 'ADMIN')
    : String(role).toUpperCase() === 'OWNER' || String(role).toUpperCase() === 'ADMIN'
  const hasAdmin = isOwner || (Array.isArray(roles) && roles.length > 0)

  const handleGoHome = () => {
    if (hasAdmin) {
      navigate('/admin/employees')
    } else {
      navigate('/me')
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-background text-foreground select-none relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-md w-full text-center space-y-6 rounded-3xl border border-border bg-card/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="size-20 rounded-2xl bg-muted/60 border border-border/80 flex items-center justify-center mx-auto shadow-inner">
          <FileQuestion className="size-10 text-muted-foreground" />
        </div>

        <div className="space-y-2">
          <div className="inline-block px-3 py-1 rounded-full text-xs font-mono font-bold bg-primary/10 text-primary border border-primary/20 uppercase tracking-widest">
            404 Error
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Page Not Found
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            The page you are looking for does not exist, has been moved, or you do not have permission to view it.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto text-xs h-10 px-4 rounded-xl border-border gap-1.5"
          >
            <ArrowLeft className="size-3.5" />
            <span>Go Back</span>
          </Button>

          <Button
            type="button"
            onClick={handleGoHome}
            className="btn-3d w-full sm:w-auto text-xs h-10 px-5 rounded-xl bg-primary text-primary-foreground font-semibold gap-1.5 shadow-sm"
          >
            <Home className="size-3.5" />
            <span>{hasAdmin ? 'Go to Admin' : 'Go to My Workspace'}</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
