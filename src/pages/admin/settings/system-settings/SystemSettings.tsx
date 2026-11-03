import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  CalendarDays,
  ScanFace,
  Receipt,
  MapPin,
  Calculator,
  History,
  Briefcase,
  ArrowRight,
  Loader2,
  SlidersHorizontal,
} from 'lucide-react'

import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import rdk, { readItems, updateItems } from '@/services/server'
import { sound } from '@/lib/sound'

interface SystemToggleConfig {
  key: string
  title: string
  description: string
  icon: React.ElementType
  hasLocationAction?: boolean
}

const SYSTEM_TOGGLES: SystemToggleConfig[] = [
  {
    key: 'firm_leave_system',
    title: 'Leave System',
    description: 'Enable or disable the leave application and balance tracking system for your workspace staff.',
    icon: CalendarDays,
  },
  {
    key: 'firm_face_attendance',
    title: 'Face Attendance',
    description: 'Enable selfie and face recognition verification when employees clock their attendance.',
    icon: ScanFace,
  },
  {
    key: 'firm_expense_system',
    title: 'Expense System',
    description: 'Allow team members to file expense claims and submit receipts for admin approval.',
    icon: Receipt,
  },
  {
    key: 'firm_geo_fencing_system',
    title: 'Geo Fencing',
    description: 'Restrict clock-in and punch-outs to designated geographic radius boundaries.',
    icon: MapPin,
    hasLocationAction: true,
  },
  {
    key: 'firm_custom_daywise_salary',
    title: 'Custom Daywise Salary',
    description: 'Enable custom daily salary calculations for wage-based employee rosters.',
    icon: Calculator,
  },
  {
    key: 'maintain_salary_payment_history',
    title: 'Maintain Salary Payment History',
    description: 'Store comprehensive historical logs and payout archives for all payroll runs.',
    icon: History,
  },
  {
    key: 'firm_task_visit_management',
    title: 'Task & Visit Management',
    description: 'Assign tasks to field executives and track client site visits with location check-ins.',
    icon: Briefcase,
  },
]

export const SystemSettings: React.FC = () => {
  const queryClient = useQueryClient()

  // Fetch firm record directly via Directus RDK
  const { data: firmDetails, isLoading, error } = useQuery({
    queryKey: ['firm-Details'],
    queryFn: async () => {
      const res = await rdk.request(readItems('firm'))
      if (Array.isArray(res)) return res
      if (Array.isArray((res as any)?.data)) return (res as any).data
      return res ? [res] : []
    },
    refetchOnWindowFocus: false,
  })

  const firm = firmDetails?.[0]
  const firmId = firm?.firm_id || firm?.id

  // Mutation to update toggle field on firm record
  const updateToggleMutation = useMutation({
    mutationFn: async ({ field, value }: { field: string; value: boolean }) => {
      if (!firmId) throw new Error('Firm ID not found')
      return await rdk.request(
        updateItems('firm', [firmId], {
          [field]: value,
        })
      )
    },
    onSuccess: (_, variables) => {
      sound.success()
      toast.success(`${variables.field.replace('firm_', '').replace(/_/g, ' ')} setting updated successfully`)
      queryClient.invalidateQueries({ queryKey: ['firm-Details'] })
      queryClient.invalidateQueries({ queryKey: ['firm'] })
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update system setting')
    },
  })

  const handleToggle = (field: string, checked: boolean) => {
    updateToggleMutation.mutate({ field, value: checked })
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !firm) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center text-sm text-destructive">
        Failed to load system settings. Please verify your connection or try again.
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* 1. Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-3.5 bg-card/60 backdrop-blur-sm shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <SlidersHorizontal className="size-4" />
            </div>
            <h1 className="font-display text-base font-semibold tracking-tight text-foreground">
              System Settings
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Enable or disable core functional modules and features for your workspace.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono font-medium">
            Firm ID: {firmId}
          </Badge>
        </div>
      </div>

      {/* 2. Scrollable Content Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        <div className="max-w-4xl space-y-6">
          {/* Overview Banner */}
          <div className="rounded-xl border border-border bg-card/60 p-4 shadow-2xs backdrop-blur-xs">
            <h2 className="text-sm font-semibold text-foreground">Workspace Feature Modules</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Turn system modules on or off for {firm.firm_name || 'your firm'}. Changes take effect immediately.
            </p>
          </div>

          {/* Grid of Toggle Settings with Switch UI */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SYSTEM_TOGGLES.map((item) => {
          const Icon = item.icon
          const isChecked = Boolean(firm[item.key])
          const isPending = updateToggleMutation.isPending && updateToggleMutation.variables?.field === item.key

          return (
            <div
              key={item.key}
              className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-2xs transition-all hover:border-primary/20 hover:shadow-xs"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-muted text-foreground">
                    <Icon className="size-4" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 pt-0.5">
                  <Switch
                    checked={isChecked}
                    disabled={isPending}
                    onCheckedChange={(val) => handleToggle(item.key, val)}
                    aria-label={`Toggle ${item.title}`}
                  />
                </div>
              </div>

              {item.hasLocationAction && isChecked && (
                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                    <MapPin className="size-3.5" />
                    Geofencing Active
                  </span>
                  <Link to="/attendance/geofence-list">
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 cursor-pointer bg-primary/5 hover:bg-primary/10 text-primary border-primary/20">
                      <span>Geo Fencing Locations</span>
                      <ArrowRight className="size-3" />
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          )
        })}
      </div>
        </div>
      </div>
    </div>
  )
}

export default SystemSettings
