import React from 'react'
import {
  Briefcase,
  MapPin,
  Clock,
  Shield,
  Smartphone,
  Navigation,
  ExternalLink,
  IndianRupee,
  Calendar,
  FileCheck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { GOOGLE_MAP_KEY } from '@/services/server'

interface StaffProfileSidebarProps {
  staff: any
}

export default function StaffProfileSidebar({ staff }: StaffProfileSidebarProps) {
  const hasLocation =
    staff?.last_location &&
    staff.last_location !== '...' &&
    staff.last_location !== '-' &&
    staff.last_location.includes(',')

  return (
    <div className="flex flex-col gap-5">
      {/* 1. Employment Details Card */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3">
        <div className="flex items-center gap-2 border-b border-border pb-2.5">
          <Briefcase className="size-4 text-primary" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Employment Details
          </h2>
        </div>

        <div className="divide-y divide-border/60 text-xs">
          <div className="py-2 flex items-center justify-between">
            <span className="text-muted-foreground">Date of Joining</span>
            <span className="font-semibold text-foreground">{staff?.doj || '—'}</span>
          </div>
          <div className="py-2 flex items-center justify-between">
            <span className="text-muted-foreground">Current Salary</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              ₹ {staff?.salary ? Number(staff.salary).toLocaleString('en-IN') : '0.00'}
            </span>
          </div>
          {staff?.previous_salary && (
            <>
              <div className="py-2 flex items-center justify-between">
                <span className="text-muted-foreground">Previous Salary</span>
                <span className="font-medium text-foreground">
                  ₹ {Number(staff.previous_salary).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="py-2 flex items-center justify-between">
                <span className="text-muted-foreground">Increment From</span>
                <span className="font-medium text-foreground">{staff.increment_from}</span>
              </div>
            </>
          )}
          <div className="py-2 flex items-center justify-between">
            <span className="text-muted-foreground">Pay Type</span>
            <span className="capitalize font-semibold text-foreground">
              {staff?.pay_type || 'Monthly'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Current Location & Real-Time Tracking Card */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-border pb-2.5">
          <div className="flex items-center gap-2">
            <MapPin className="size-4 text-emerald-600" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Last Known Location
            </h2>
          </div>
          {hasLocation && (
            <a
              href={`https://www.google.com/maps?q=${staff.last_location}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-1"
            >
              <span>Map</span>
              <ExternalLink className="size-3" />
            </a>
          )}
        </div>

        {hasLocation ? (
          <div className="space-y-2.5">
            <div className="relative rounded-lg overflow-hidden border border-border bg-muted h-28 group">
              <img
                src={`https://maps.googleapis.com/maps/api/staticmap?size=600x300&markers=${staff.last_location}&key=${GOOGLE_MAP_KEY}&zoom=16`}
                alt="Static Location Map"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  // Fallback UI if Google static maps key is missing
                  e.currentTarget.style.display = 'none'
                }}
              />
              <div className="absolute inset-0 bg-primary/10 flex items-center justify-center pointer-events-none">
                <div className="size-6 rounded-full bg-primary/90 text-primary-foreground flex items-center justify-center shadow-md animate-bounce">
                  <MapPin className="size-3.5" />
                </div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-mono text-[11px] truncate text-foreground font-semibold">
                {staff.last_location}
              </p>
              {staff?.last_activity && (
                <p className="text-[10px] text-muted-foreground">
                  <strong>Last active:</strong> {staff.last_activity}
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground py-2 text-center">
            No GPS location recorded recently.
          </p>
        )}
      </div>

      {/* 3. Attendance Settings Card */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3">
        <div className="flex items-center gap-2 border-b border-border pb-2.5">
          <Clock className="size-4 text-primary" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Attendance Settings
          </h2>
        </div>

        <div className="divide-y divide-border/60 text-xs">
          <div className="py-2 flex items-center justify-between">
            <span className="text-muted-foreground">Mobile App Attendance</span>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] font-semibold',
                staff?.mobile_attendance
                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {staff?.mobile_attendance ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
          <div className="py-2 flex items-center justify-between">
            <span className="text-muted-foreground">Multiple Attendance</span>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] font-semibold',
                staff?.multiple_attendance
                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {staff?.multiple_attendance ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
          <div className="py-2 flex items-center justify-between">
            <span className="text-muted-foreground">Live GPS Tracking</span>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] font-semibold',
                staff?.live_tracking
                  ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {staff?.live_tracking ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
        </div>
      </div>

      {/* 4. Statutory & Benefits Information Card */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3">
        <div className="flex items-center gap-2 border-b border-border pb-2.5">
          <Shield className="size-4 text-primary" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Statutory &amp; Benefits
          </h2>
        </div>

        <div className="divide-y divide-border/60 text-xs font-medium">
          <div className="py-2 flex items-center justify-between">
            <span className="text-muted-foreground">PF Number</span>
            <span className="font-mono text-foreground">{staff?.pf_no || '—'}</span>
          </div>
          <div className="py-2 flex items-center justify-between">
            <span className="text-muted-foreground">UAN</span>
            <span className="font-mono text-foreground">{staff?.uan || '—'}</span>
          </div>
          <div className="py-2 flex items-center justify-between">
            <span className="text-muted-foreground">PAN Number</span>
            <span className="font-mono uppercase text-foreground">{staff?.pan || '—'}</span>
          </div>
          <div className="py-2 flex items-center justify-between">
            <span className="text-muted-foreground">ESI Number</span>
            <span className="font-mono text-foreground">{staff?.esi_no || '—'}</span>
          </div>
          <div className="py-2 flex items-center justify-between">
            <span className="text-muted-foreground">ESI Applicable</span>
            <span className="text-foreground">{staff?.esi_applicable || '—'}</span>
          </div>
          {staff?.esi_to_deduct_till && staff.esi_to_deduct_till !== '...' && (
            <div className="py-2 flex items-center justify-between">
              <span className="text-muted-foreground">Deduct Till</span>
              <span className="text-foreground">{staff.esi_to_deduct_till}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
