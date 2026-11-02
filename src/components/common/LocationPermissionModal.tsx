import { useState } from 'react'
import {
  MapPin,
  Compass,
  Loader2,
  CheckCircle2,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { getCurrentBrowserCoordinates } from '@/features/attendance/hooks/useAttendance'
import { toast } from 'sonner'
import { sound } from '@/lib/sound'

interface LocationPermissionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLocationObtained?: (coords: { latitude: number; longitude: number }) => void
  actionLabel?: string
  title?: string
  description?: string
}

export default function LocationPermissionModal({
  open,
  onOpenChange,
  onLocationObtained,
  actionLabel = 'Verify & Punch Attendance',
  title = 'Location Access Required',
  description = 'Your profile requires location verification for attendance punching.',
}: LocationPermissionModalProps) {
  const [loading, setLoading] = useState(false)

  const handleRetryLocation = async () => {
    try {
      setLoading(true)
      const res = await getCurrentBrowserCoordinates()

      if (res.latitude !== null && res.longitude !== null) {
        sound.success()
        toast.success(`Location detected successfully! (${res.latitude}, ${res.longitude})`)
        onOpenChange(false)
        onLocationObtained?.({ latitude: res.latitude, longitude: res.longitude })
      } else {
        sound.error()
        const errMsg =
          res.errorCode === 1
            ? 'Location is blocked! Please click the 🔒 Lock/Tune icon in the browser address bar and set Location to "Allow".'
            : res.errorCode === 2
            ? 'Device location service is OFF. Please turn ON location.'
            : res.error || 'Unable to retrieve location. Please check browser permission.'
        toast.error(errMsg, { duration: 6000 })
      }
    } catch (err: any) {
      sound.error()
      toast.error(err?.message || 'Failed to detect location')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 rounded-2xl border border-border shadow-2xl bg-card">
        <DialogHeader className="space-y-2.5">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-primary/10 text-primary grid place-items-center shadow-inner shrink-0">
              <MapPin className="size-6 animate-pulse" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                {title}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-2 text-xs my-2">
          <div className="font-semibold text-foreground flex items-center gap-1.5">
            <CheckCircle2 className="size-4 text-primary" />
            <span>How to enable location:</span>
          </div>
          <ul className="space-y-1.5 pl-5 text-muted-foreground list-disc text-[11px] leading-relaxed">
            <li>
              Click the <strong className="text-foreground">🔒 Lock</strong> or <strong className="text-foreground">Tune / Sliders ⚙️</strong> icon in the address bar next to the URL.
            </li>
            <li>
              Set <strong className="text-foreground">Location</strong> permission to <strong className="text-emerald-600 dark:text-emerald-400">Allow</strong>.
            </li>
            <li>
              Click the button below to verify and complete punch.
            </li>
          </ul>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2 border-t border-border/80">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto h-9 text-xs"
          >
            Close
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={loading}
            onClick={handleRetryLocation}
            className="btn-3d w-full sm:w-auto h-9 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Compass className="size-3.5" />
            )}
            <span>{actionLabel}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

