import React, { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Clock,
  Loader2,
  Save,
  Moon,
  Coffee,
  AlertTriangle,
  Timer,
  LogIn,
  LogOut,
  CalendarDays,
  ShieldAlert,
} from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import rdk, { createItem, updateItem } from '@/services/server'
import { sound } from '@/lib/sound'

interface ShiftSheetProps {
  open: boolean
  onClose: () => void
  shiftToEdit?: any | null
  onSuccess?: () => void
}

interface ShiftFormValues {
  shift_name: string
  shift_from: string
  shift_to: string
  status: 'active' | 'draft' | 'deleted'
  punch_in_type: 'anytime' | 'limit'
  punch_in_hours_before: string | number
  punch_in_minutes_before: string | number
  late_cutoff_hours: string | number
  late_cutoff_minutes: string | number
  punch_out_type: 'anytime' | 'limit'
  punch_out_hours_after: string | number
  punch_out_minutes_after: string | number
  early_cutoff_hours: string | number
  early_cutoff_minutes: string | number
  applicable_for_overnight: boolean
  applicable_for_break: boolean
  auto_punch_out: boolean
  auto_punch_out_time: string
  applicable_for_minimum_working_hours: boolean
  shift_minimum_working_hours: string | number
  shift_minimum_working_minutes: string | number
  shift_minimum_present_hours: string | number
  shift_minimum_present_minutes: string | number
  lates_counted_as_half_day: string | number
  earlies_counted_as_half_day: string | number
  lates_counted_as_absent: string | number
  early_counted_as_absent: string | number
}

// Convert "09:00:00" to "09:00" for standard HTML time input
const formatTimeForInput = (timeStr?: string | null, fallback = '') => {
  if (!timeStr) return fallback
  const parts = String(timeStr).split(':')
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`
  }
  return timeStr
}

export const ShiftModal: React.FC<ShiftSheetProps> = ({
  open,
  onClose,
  shiftToEdit,
  onSuccess,
}) => {
  const queryClient = useQueryClient()
  const isEdit = Boolean(shiftToEdit?.shift_id || shiftToEdit?.id)
  const shiftId = shiftToEdit?.shift_id || shiftToEdit?.id

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { isSubmitting },
  } = useForm<ShiftFormValues>({
    defaultValues: {
      shift_name: '',
      shift_from: '09:00',
      shift_to: '18:00',
      status: 'active',
      punch_in_type: 'anytime',
      punch_in_hours_before: '',
      punch_in_minutes_before: '',
      late_cutoff_hours: '',
      late_cutoff_minutes: '',
      punch_out_type: 'anytime',
      punch_out_hours_after: '',
      punch_out_minutes_after: '',
      early_cutoff_hours: '',
      early_cutoff_minutes: '',
      applicable_for_overnight: false,
      applicable_for_break: false,
      auto_punch_out: false,
      auto_punch_out_time: '',
      applicable_for_minimum_working_hours: false,
      shift_minimum_working_hours: '',
      shift_minimum_working_minutes: '',
      shift_minimum_present_hours: '',
      shift_minimum_present_minutes: '',
      lates_counted_as_half_day: '',
      earlies_counted_as_half_day: '',
      lates_counted_as_absent: '',
      early_counted_as_absent: '',
    },
  })

  const watchPunchInType = watch('punch_in_type')
  const watchPunchOutType = watch('punch_out_type')
  const watchAutoPunchOut = watch('auto_punch_out')
  const watchMinHours = watch('applicable_for_minimum_working_hours')

  // Reset form when shiftToEdit changes
  useEffect(() => {
    if (shiftToEdit) {
      reset({
        shift_name: shiftToEdit.shift_name || '',
        shift_from: formatTimeForInput(shiftToEdit.shift_from, '09:00'),
        shift_to: formatTimeForInput(shiftToEdit.shift_to, '18:00'),
        status: shiftToEdit.status || 'active',
        punch_in_type: shiftToEdit.punch_in_type || 'anytime',
        punch_in_hours_before:
          shiftToEdit.punch_in_hours_before !== null && shiftToEdit.punch_in_hours_before !== undefined
            ? String(shiftToEdit.punch_in_hours_before)
            : '',
        punch_in_minutes_before:
          shiftToEdit.punch_in_minutes_before !== null && shiftToEdit.punch_in_minutes_before !== undefined
            ? String(shiftToEdit.punch_in_minutes_before)
            : '',
        late_cutoff_hours:
          shiftToEdit.late_cutoff_hours !== null && shiftToEdit.late_cutoff_hours !== undefined
            ? String(shiftToEdit.late_cutoff_hours)
            : '',
        late_cutoff_minutes:
          shiftToEdit.late_cutoff_minutes !== null && shiftToEdit.late_cutoff_minutes !== undefined
            ? String(shiftToEdit.late_cutoff_minutes)
            : '',
        punch_out_type: shiftToEdit.punch_out_type || 'anytime',
        punch_out_hours_after:
          shiftToEdit.punch_out_hours_after !== null && shiftToEdit.punch_out_hours_after !== undefined
            ? String(shiftToEdit.punch_out_hours_after)
            : '',
        punch_out_minutes_after:
          shiftToEdit.punch_out_minutes_after !== null && shiftToEdit.punch_out_minutes_after !== undefined
            ? String(shiftToEdit.punch_out_minutes_after)
            : '',
        early_cutoff_hours:
          shiftToEdit.early_cutoff_hours !== null && shiftToEdit.early_cutoff_hours !== undefined
            ? String(shiftToEdit.early_cutoff_hours)
            : '',
        early_cutoff_minutes:
          shiftToEdit.early_cutoff_minutes !== null && shiftToEdit.early_cutoff_minutes !== undefined
            ? String(shiftToEdit.early_cutoff_minutes)
            : '',
        applicable_for_overnight: Boolean(shiftToEdit.applicable_for_overnight),
        applicable_for_break: Boolean(shiftToEdit.applicable_for_break),
        auto_punch_out: Boolean(shiftToEdit.auto_punch_out),
        auto_punch_out_time: formatTimeForInput(shiftToEdit.auto_punch_out_time, ''),
        applicable_for_minimum_working_hours: Boolean(shiftToEdit.applicable_for_minimum_working_hours),
        shift_minimum_working_hours:
          shiftToEdit.shift_minimum_working_hours !== null && shiftToEdit.shift_minimum_working_hours !== undefined
            ? String(shiftToEdit.shift_minimum_working_hours)
            : '',
        shift_minimum_working_minutes:
          shiftToEdit.shift_minimum_working_minutes !== null && shiftToEdit.shift_minimum_working_minutes !== undefined
            ? String(shiftToEdit.shift_minimum_working_minutes)
            : '',
        shift_minimum_present_hours:
          shiftToEdit.shift_minimum_present_hours !== null && shiftToEdit.shift_minimum_present_hours !== undefined
            ? String(shiftToEdit.shift_minimum_present_hours)
            : '',
        shift_minimum_present_minutes:
          shiftToEdit.shift_minimum_present_minutes !== null && shiftToEdit.shift_minimum_present_minutes !== undefined
            ? String(shiftToEdit.shift_minimum_present_minutes)
            : '',
        lates_counted_as_half_day:
          shiftToEdit.lates_counted_as_half_day !== null && shiftToEdit.lates_counted_as_half_day !== undefined
            ? String(shiftToEdit.lates_counted_as_half_day)
            : '',
        earlies_counted_as_half_day:
          shiftToEdit.earlies_counted_as_half_day !== null && shiftToEdit.earlies_counted_as_half_day !== undefined
            ? String(shiftToEdit.earlies_counted_as_half_day)
            : '',
        lates_counted_as_absent:
          shiftToEdit.lates_counted_as_absent !== null && shiftToEdit.lates_counted_as_absent !== undefined
            ? String(shiftToEdit.lates_counted_as_absent)
            : '',
        early_counted_as_absent:
          shiftToEdit.early_counted_as_absent !== null && shiftToEdit.early_counted_as_absent !== undefined
            ? String(shiftToEdit.early_counted_as_absent)
            : '',
      })
    } else {
      reset({
        shift_name: '',
        shift_from: '09:00',
        shift_to: '18:00',
        status: 'active',
        punch_in_type: 'anytime',
        punch_in_hours_before: '',
        punch_in_minutes_before: '',
        late_cutoff_hours: '',
        late_cutoff_minutes: '',
        punch_out_type: 'anytime',
        punch_out_hours_after: '',
        punch_out_minutes_after: '',
        early_cutoff_hours: '',
        early_cutoff_minutes: '',
        applicable_for_overnight: false,
        applicable_for_break: false,
        auto_punch_out: false,
        auto_punch_out_time: '',
        applicable_for_minimum_working_hours: false,
        shift_minimum_working_hours: '',
        shift_minimum_working_minutes: '',
        shift_minimum_present_hours: '',
        shift_minimum_present_minutes: '',
        lates_counted_as_half_day: '',
        earlies_counted_as_half_day: '',
        lates_counted_as_absent: '',
        early_counted_as_absent: '',
      })
    }
  }, [shiftToEdit, reset, open])

  // Mutation matching v1 logic exactly
  const mutation = useMutation({
    mutationFn: async (values: ShiftFormValues) => {
      const payload: Record<string, any> = {
        shift_name: values.shift_name.trim(),
        shift_from: values.shift_from,
        shift_to: values.shift_to,
        status: values.status || 'active',
        punch_in_type: values.punch_in_type,
        punch_in_hours_before:
          values.punch_in_type === 'limit' && values.punch_in_hours_before !== ''
            ? Number(values.punch_in_hours_before)
            : null,
        punch_in_minutes_before:
          values.punch_in_type === 'limit' && values.punch_in_minutes_before !== ''
            ? Number(values.punch_in_minutes_before)
            : null,
        late_cutoff_hours:
          values.late_cutoff_hours !== '' ? Number(values.late_cutoff_hours) : null,
        late_cutoff_minutes:
          values.late_cutoff_minutes !== '' ? Number(values.late_cutoff_minutes) : null,
        punch_out_type: values.punch_out_type,
        punch_out_hours_after:
          values.punch_out_type === 'limit' && values.punch_out_hours_after !== ''
            ? Number(values.punch_out_hours_after)
            : null,
        punch_out_minutes_after:
          values.punch_out_type === 'limit' && values.punch_out_minutes_after !== ''
            ? Number(values.punch_out_minutes_after)
            : null,
        early_cutoff_hours:
          values.early_cutoff_hours !== '' ? Number(values.early_cutoff_hours) : null,
        early_cutoff_minutes:
          values.early_cutoff_minutes !== '' ? Number(values.early_cutoff_minutes) : null,
        auto_punch_out: Boolean(values.auto_punch_out),
        auto_punch_out_time:
          values.auto_punch_out && values.auto_punch_out_time ? values.auto_punch_out_time : null,
        applicable_for_overnight: Boolean(values.applicable_for_overnight),
        applicable_for_break: Boolean(values.applicable_for_break),
        applicable_for_minimum_working_hours: Boolean(values.applicable_for_minimum_working_hours),
        shift_minimum_working_hours:
          values.applicable_for_minimum_working_hours && values.shift_minimum_working_hours !== ''
            ? Number(values.shift_minimum_working_hours)
            : null,
        shift_minimum_working_minutes:
          values.applicable_for_minimum_working_hours && values.shift_minimum_working_minutes !== ''
            ? Number(values.shift_minimum_working_minutes)
            : null,
        shift_minimum_present_hours:
          values.applicable_for_minimum_working_hours && values.shift_minimum_present_hours !== ''
            ? Number(values.shift_minimum_present_hours)
            : null,
        shift_minimum_present_minutes:
          values.applicable_for_minimum_working_hours && values.shift_minimum_present_minutes !== ''
            ? Number(values.shift_minimum_present_minutes)
            : null,
        lates_counted_as_half_day:
          values.lates_counted_as_half_day !== ''
            ? Number(values.lates_counted_as_half_day)
            : null,
        earlies_counted_as_half_day:
          values.earlies_counted_as_half_day !== ''
            ? Number(values.earlies_counted_as_half_day)
            : null,
        lates_counted_as_absent:
          values.lates_counted_as_absent !== ''
            ? Number(values.lates_counted_as_absent)
            : null,
        early_counted_as_absent:
          values.early_counted_as_absent !== ''
            ? Number(values.early_counted_as_absent)
            : null,
      }

      // Filter out empty/undefined matching v1 cleanData
      const cleanedData = Object.fromEntries(
        Object.entries(payload).filter(
          ([_, value]) =>
            value !== null &&
            value !== undefined &&
            (typeof value !== 'string' || value.trim() !== '')
        )
      )

      if (isEdit) {
        return await rdk.request(updateItem('shift', shiftId, cleanedData))
      } else {
        return await rdk.request(createItem('shift', cleanedData))
      }
    },
    onSuccess: async () => {
      sound.success()
      toast.success(isEdit ? 'Shift updated successfully' : 'Shift created successfully')
      await queryClient.invalidateQueries({ queryKey: ['shifts'] })
      await queryClient.invalidateQueries({ queryKey: ['shiftings'] })
      await queryClient.refetchQueries({ queryKey: ['shifts'] })
      await queryClient.refetchQueries({ queryKey: ['shiftings'] })
      onSuccess?.()
      onClose()
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to save shift')
    },
  })

  const onSubmit = (data: ShiftFormValues) => {
    if (!data.shift_name.trim()) {
      toast.error('Shift name is required')
      return
    }
    if (!data.shift_from) {
      toast.error('Shift start time is required')
      return
    }
    if (!data.shift_to) {
      toast.error('Shift end time is required')
      return
    }
    mutation.mutate(data)
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="sm:max-w-xl md:max-w-2xl w-full flex flex-col p-0 gap-0 overflow-hidden shadow-2xl"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full min-h-0">
          {/* Fixed Header */}
          <SheetHeader className="px-6 py-4 border-b border-border shrink-0 bg-background/95 backdrop-blur-xs">
            <SheetTitle className="flex items-center gap-2 text-base font-semibold">
              <Clock className="size-4.5 text-primary" />
              {isEdit ? 'Edit Company Shift' : 'Add New Company Shift'}
            </SheetTitle>
          </SheetHeader>

          {/* Scrollable Form Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 min-h-0">
            {/* 1. Basic Details */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <CalendarDays className="size-3.5" />
                Basic Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="shift_name" className="text-xs font-medium">
                    Shift Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="shift_name"
                    {...register('shift_name', { required: true })}
                    placeholder="e.g. Regular Day Shift, Morning 9-6"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Status</Label>
                  <Controller
                    name="status"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active" className="text-xs">
                            Active
                          </SelectItem>
                          <SelectItem value="draft" className="text-xs">
                            Draft
                          </SelectItem>
                          <SelectItem value="deleted" className="text-xs">
                            Deleted
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>
            </div>

            {/* 2. Timings & Punch Window */}
            <div className="space-y-3 rounded-lg border border-border/80 bg-muted/15 p-4">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Timer className="size-3.5 text-primary" />
                Shift Timings & Punch Restrictions
              </h3>

              {/* Start & End Times */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <Label htmlFor="shift_from" className="text-xs font-medium">
                    Shift Start Time <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="shift_from"
                    type="time"
                    {...register('shift_from', { required: true })}
                    className="h-9 text-xs bg-background"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="shift_to" className="text-xs font-medium">
                    Shift End Time <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="shift_to"
                    type="time"
                    {...register('shift_to', { required: true })}
                    className="h-9 text-xs bg-background"
                  />
                </div>
              </div>

              {/* Can Punch In Policy */}
              <div className="pt-2 border-t border-border/60 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <LogIn className="size-3.5 text-emerald-600" />
                    Can Punch In
                  </Label>
                  <div className="flex items-center gap-4 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        value="anytime"
                        {...register('punch_in_type')}
                        className="accent-primary"
                      />
                      <span>Anytime</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        value="limit"
                        {...register('punch_in_type')}
                        className="accent-primary"
                      />
                      <span>Add Limit</span>
                    </label>
                  </div>
                </div>

                {watchPunchInType === 'limit' && (
                  <div className="space-y-1.5 bg-background p-2.5 rounded-md border border-border">
                    <Label className="text-[11px] text-muted-foreground">
                      Allow Punch In Before Shift Start Time:
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        min={0}
                        placeholder="Hours"
                        {...register('punch_in_hours_before')}
                        className="h-8 text-xs"
                      />
                      <Input
                        type="number"
                        min={0}
                        max={59}
                        placeholder="Minutes"
                        {...register('punch_in_minutes_before')}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Late Cut Off Time */}
              <div className="space-y-1.5 pt-2 border-t border-border/60">
                <Label className="text-xs font-semibold">Late Cut Off Time (Grace)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    min={0}
                    placeholder="Hours"
                    {...register('late_cutoff_hours')}
                    className="h-8 text-xs bg-background"
                  />
                  <Input
                    type="number"
                    min={0}
                    max={59}
                    placeholder="Minutes"
                    {...register('late_cutoff_minutes')}
                    className="h-8 text-xs bg-background"
                  />
                </div>
              </div>

              {/* Can Punch Out Policy */}
              <div className="pt-2 border-t border-border/60 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <LogOut className="size-3.5 text-amber-600" />
                    Can Punch Out
                  </Label>
                  <div className="flex items-center gap-4 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        value="anytime"
                        {...register('punch_out_type')}
                        className="accent-primary"
                      />
                      <span>Anytime</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        value="limit"
                        {...register('punch_out_type')}
                        className="accent-primary"
                      />
                      <span>Add Limit</span>
                    </label>
                  </div>
                </div>

                {watchPunchOutType === 'limit' && (
                  <div className="space-y-1.5 bg-background p-2.5 rounded-md border border-border">
                    <Label className="text-[11px] text-muted-foreground">
                      Allow Punch Out After Shift End Time:
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        min={0}
                        placeholder="Hours"
                        {...register('punch_out_hours_after')}
                        className="h-8 text-xs"
                      />
                      <Input
                        type="number"
                        min={0}
                        max={59}
                        placeholder="Minutes"
                        {...register('punch_out_minutes_after')}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Early Cut Off Time */}
              <div className="space-y-1.5 pt-2 border-t border-border/60">
                <Label className="text-xs font-semibold">Early Cut Off Time (Grace)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    min={0}
                    placeholder="Hours"
                    {...register('early_cutoff_hours')}
                    className="h-8 text-xs bg-background"
                  />
                  <Input
                    type="number"
                    min={0}
                    max={59}
                    placeholder="Minutes"
                    {...register('early_cutoff_minutes')}
                    className="h-8 text-xs bg-background"
                  />
                </div>
              </div>
            </div>

            {/* 3. Shift Features & Auto Punch-Out */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Shift Settings & Automation
              </h3>

              {/* Overnight */}
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <Moon className="size-3.5 text-indigo-500" />
                    Applicable for Overnight
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    Enable if work hours cross midnight into the next calendar day
                  </p>
                </div>
                <Controller
                  name="applicable_for_overnight"
                  control={control}
                  render={({ field }) => (
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
              </div>

              {/* Applicable for Break */}
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <Coffee className="size-3.5 text-amber-600" />
                    Applicable for Break
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    Allow staff to log scheduled meal or rest intervals during this shift
                  </p>
                </div>
                <Controller
                  name="applicable_for_break"
                  control={control}
                  render={({ field }) => (
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
              </div>

              {/* Auto Punch Out */}
              <div className="rounded-lg border border-border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <LogOut className="size-3.5 text-primary" />
                      Auto Punch Out
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      Automatically clock staff out if they forget to punch out
                    </p>
                  </div>
                  <Controller
                    name="auto_punch_out"
                    control={control}
                    render={({ field }) => (
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    )}
                  />
                </div>

                {watchAutoPunchOut && (
                  <div className="space-y-1.5 pt-2 border-t border-border">
                    <Label htmlFor="auto_punch_out_time" className="text-xs font-medium">
                      Auto Punch Out Time (24h)
                    </Label>
                    <Input
                      id="auto_punch_out_time"
                      type="time"
                      {...register('auto_punch_out_time')}
                      className="h-8.5 text-xs max-w-xs"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* 4. Minimum Working Hours Policy */}
            <div className="rounded-lg border border-border p-3.5 space-y-3 bg-muted/10">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Timer className="size-3.5 text-blue-600" />
                    Minimum Working Hour Policy
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    Evaluate daily attendance as Full Day or Half Day based on active duration
                  </p>
                </div>
                <Controller
                  name="applicable_for_minimum_working_hours"
                  control={control}
                  render={({ field }) => (
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
              </div>

              {watchMinHours && (
                <div className="space-y-3 pt-3 border-t border-border">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      Minimum Shift Duration (Full Day)
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        min={0}
                        placeholder="Hours (e.g. 8)"
                        {...register('shift_minimum_working_hours')}
                        className="h-8.5 text-xs bg-background"
                      />
                      <Input
                        type="number"
                        min={0}
                        max={59}
                        placeholder="Minutes"
                        {...register('shift_minimum_working_minutes')}
                        className="h-8.5 text-xs bg-background"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      Minimum Present Duration (Half Day)
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        min={0}
                        placeholder="Hours (e.g. 4)"
                        {...register('shift_minimum_present_hours')}
                        className="h-8.5 text-xs bg-background"
                      />
                      <Input
                        type="number"
                        min={0}
                        max={59}
                        placeholder="Minutes"
                        {...register('shift_minimum_present_minutes')}
                        className="h-8.5 text-xs bg-background"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 5. Penalty / Attendance Deduction Rules */}
            <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="space-y-0.5">
                <h3 className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="size-3.5" />
                  Late & Early Attendance Penalty Deductions
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Specify how repetitive tardiness or early leaves convert to penalties (enter 0 to disable).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="lates_half" className="text-xs font-medium">
                    Lates Counted as Half Day
                  </Label>
                  <Input
                    id="lates_half"
                    type="number"
                    min={0}
                    placeholder="Enter 0 to disable"
                    {...register('lates_counted_as_half_day')}
                    className="h-8.5 text-xs bg-background"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="earlies_half" className="text-xs font-medium">
                    Earlies Counted as Half Day
                  </Label>
                  <Input
                    id="earlies_half"
                    type="number"
                    min={0}
                    placeholder="Enter 0 to disable"
                    {...register('earlies_counted_as_half_day')}
                    className="h-8.5 text-xs bg-background"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="lates_absent" className="text-xs font-medium">
                    Lates Counted as Absent
                  </Label>
                  <Input
                    id="lates_absent"
                    type="number"
                    min={0}
                    placeholder="Enter 0 to disable"
                    {...register('lates_counted_as_absent')}
                    className="h-8.5 text-xs bg-background"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="earlies_absent" className="text-xs font-medium">
                    Earlies Counted as Absent
                  </Label>
                  <Input
                    id="earlies_absent"
                    type="number"
                    min={0}
                    placeholder="Enter 0 to disable"
                    {...register('early_counted_as_absent')}
                    className="h-8.5 text-xs bg-background"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <SheetFooter className="px-6 py-3.5 border-t border-border bg-muted/20 shrink-0 flex flex-row items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={mutation.isPending}
              className="text-xs h-8 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={mutation.isPending || isSubmitting}
              className="text-xs h-8 gap-1.5 cursor-pointer"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="size-3.5" />
                  <span>{isEdit ? 'Update Shift' : 'Create Shift'}</span>
                </>
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export default ShiftModal
