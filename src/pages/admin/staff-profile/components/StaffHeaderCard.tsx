import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User,
  Phone,
  Mail,
  Briefcase,
  Building2,
  Tag,
  Pencil,
  Trash2,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import ImageLightbox from '@/components/ui/image-lightbox'
import { ATTENDANCE_SERVER_URL } from '@/services/server'

interface StaffHeaderCardProps {
  staff: any
  onDeleteClick: () => void
}

export default function StaffHeaderCard({ staff, onDeleteClick }: StaffHeaderCardProps) {
  const navigate = useNavigate()
  const [avatarLightboxOpen, setAvatarLightboxOpen] = useState(false)

  const avatarUrl = staff?.avatar
    ? staff.avatar.startsWith('http')
      ? staff.avatar
      : `${ATTENDANCE_SERVER_URL}/assets/${staff.avatar}`
    : null

  const getStatusBadge = (status?: string) => {
    const s = String(status || '').toLowerCase()
    if (s === 'present' || s === 'active' || s === 'in') {
      return (
        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs gap-1 py-0.5">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Active / Present
        </Badge>
      )
    }
    if (s === 'leave' || s === 'on leave') {
      return (
        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs gap-1 py-0.5">
          <Clock className="size-3" />
          On Leave
        </Badge>
      )
    }
    if (s === 'absent') {
      return (
        <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-xs gap-1 py-0.5">
          <span className="size-1.5 rounded-full bg-rose-500" />
          Absent
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="text-xs text-muted-foreground py-0.5">
        {status || 'Offline'}
      </Badge>
    )
  }

  return (
    <>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs relative overflow-hidden">
        {/* Decorative subtle background gradient */}
        <div className="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-primary/5 to-transparent pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative z-10">
          {/* Left: Avatar + Core Info */}
          <div className="flex items-start sm:items-center gap-4">
            {/* Clickable Avatar with Lightbox */}
            <div
              onClick={() => avatarUrl && setAvatarLightboxOpen(true)}
              className={cn(
                'size-20 sm:size-24 rounded-2xl border-2 border-border overflow-hidden shrink-0 shadow-sm relative group bg-muted flex items-center justify-center',
                avatarUrl && 'cursor-pointer hover:border-primary/50 transition-all',
              )}
            >
              {avatarUrl ? (
                <>
                  <img
                    src={avatarUrl}
                    alt={staff?.name || 'Staff avatar'}
                    className="size-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-medium">
                    View
                  </div>
                </>
              ) : (
                <span className="text-2xl sm:text-3xl font-black text-muted-foreground uppercase">
                  {(staff?.name || 'U')[0]}
                </span>
              )}
            </div>

            {/* Employee Name & Meta Pills */}
            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
                  {staff?.name || 'Staff Member'}
                </h1>
                {getStatusBadge(staff?.status)}
              </div>

              {/* Code & Designation */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground font-medium">
                {staff?.employee_code && (
                  <span className="inline-flex items-center gap-1 font-mono font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                    Code: #{staff.employee_code}
                  </span>
                )}
                {staff?.designation && (
                  <span className="inline-flex items-center gap-1 text-foreground">
                    <Briefcase className="size-3.5 text-muted-foreground" />
                    <span>{staff.designation}</span>
                  </span>
                )}
                {staff?.department_name && staff.department_name !== '...' && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Building2 className="size-3.5" />
                    <span>{staff.department_name}</span>
                  </span>
                )}
                {staff?.category && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Tag className="size-3.5" />
                    <span>{staff.category}</span>
                  </span>
                )}
              </div>

              {/* Contact Links */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs pt-1">
                {staff?.phone && (
                  <a
                    href={`tel:${staff.phone}`}
                    className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors group"
                  >
                    <Phone className="size-3 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="font-mono">{staff.phone}</span>
                  </a>
                )}
                {staff?.email && staff.email !== '...' && (
                  <a
                    href={`mailto:${staff.email}`}
                    className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors group truncate max-w-[240px]"
                  >
                    <Mail className="size-3 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="truncate">{staff.email}</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/admin/staff/${staff?.id}/edit`)}
              className="h-8 gap-1.5 text-xs font-semibold cursor-pointer border-border hover:bg-muted shadow-2xs"
            >
              <Pencil className="size-3.5" />
              <span>Edit Profile</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDeleteClick}
              className="h-8 gap-1.5 text-xs font-semibold cursor-pointer text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 border-border shadow-2xs"
            >
              <Trash2 className="size-3.5" />
              <span>Delete</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Lightbox for avatar */}
      {avatarUrl && (
        <ImageLightbox
          open={avatarLightboxOpen}
          src={avatarUrl}
          title={staff?.name}
          onClose={() => setAvatarLightboxOpen(false)}
        />
      )}
    </>
  )
}
