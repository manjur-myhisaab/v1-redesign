import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Building2,
  Calendar,
  ShieldCheck,
  Save,
  Loader2,
  Info,
  Sparkles,
  MessageSquare,
  Users,
  Camera,
  MapPin,
  Upload,
} from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/context/auth/AuthContext'
import rdk, {
  readItems,
  updateItems,
  uploadFiles,
  ATTENDANCE_SERVER_URL,
} from '@/services/server'
import { sound } from '@/lib/sound'

const PAY_PERIOD_OPTIONS = [
  { label: '30 Days (Fixed)', value: '30_days' },
  { label: 'Calendar Days (Week-offs Unpaid)', value: 'calendar_without_week_off' },
  { label: 'Calendar Days (Week-offs Paid)', value: 'calendar_with_week_off' },
]

const COMP_OFF_OPTIONS = [
  { label: 'Select Option', value: 'none' },
  { label: 'Holiday', value: 'holiday' },
  { label: 'Week Off', value: 'week_off' },
  { label: 'Both', value: 'both' },
]

interface CompanyFormValues {
  firm_name: string
  firm_company_code?: string
  firm_gstin: string
  firm_address: string
  firm_phone: string
  firm_email: string
  pay_period: string
  pay_cycle_enabled: boolean
  pay_cycle_from: string
  pay_cycle_to: string
  face_recognition_method: string
  attendance_marking_method: string
  applicable_for_sandwich_policy: boolean
  shiftwise_incentive: boolean
  comp_off: boolean
  applicable_comp_off: string
  comp_off_validity: string
  allow_auto_punch?: boolean
  late_cut_off?: string
  firm_early?: string
}

export const CompanyDetailsSettings: React.FC = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  // Image upload states & input refs
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [isUploadingBanner, setIsUploadingBanner] = useState(false)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [logoError, setLogoError] = useState(false)
  const [bannerError, setBannerError] = useState(false)

  // 1 to 31 day options for pay cycle
  const dayOptions = useMemo(() => {
    return Array.from({ length: 31 }, (_, i) => ({
      label: String(i + 1),
      value: String(i + 1),
    }))
  }, [])

  // Direct Directus RDK query with robust response normalization
  const { data: firmList, isLoading, error } = useQuery({
    queryKey: ['firm-Details'],
    queryFn: async () => {
      const res = await rdk.request(readItems('firm'))
      if (Array.isArray(res)) return res
      if (Array.isArray((res as any)?.data)) return (res as any).data
      return res ? [res] : []
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const firm = firmList?.[0]
  const firmId = firm?.firm_id || firm?.id

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { isSubmitting },
  } = useForm<CompanyFormValues>({
    defaultValues: {
      firm_name: '',
      firm_company_code: '',
      firm_gstin: '',
      firm_address: '',
      firm_phone: '',
      firm_email: '',
      pay_period: 'calendar_with_week_off',
      pay_cycle_enabled: true,
      pay_cycle_from: '1',
      pay_cycle_to: '30',
      face_recognition_method: 'device',
      attendance_marking_method: 'offline_sync',
      applicable_for_sandwich_policy: false,
      shiftwise_incentive: false,
      comp_off: false,
      applicable_comp_off: 'none',
      comp_off_validity: '',
      allow_auto_punch: false,
      late_cut_off: '',
      firm_early: '',
    },
  })

  const watchPayPeriod = watch('pay_period')
  const isPayCycleEnabled = watch('pay_cycle_enabled')
  const isCompOffEnabled = watch('comp_off')

  // Populate data when firm is loaded
  useEffect(() => {
    if (firm) {
      setValue('firm_name', firm.firm_name || '')
      setValue('firm_company_code', firm.firm_company_code || '')
      setValue('firm_gstin', firm.firm_gstin && firm.firm_gstin !== '-' ? firm.firm_gstin : '')
      setValue('firm_address', firm.firm_address || '')
      setValue('firm_phone', firm.firm_phone || '')
      setValue('firm_email', firm.firm_email || '')
      setValue('pay_period', firm.pay_period || 'calendar_with_week_off')
      setValue('pay_cycle_enabled', firm.pay_cycle_enabled ?? true)
      setValue('pay_cycle_from', String(firm.pay_cycle_from ?? 1))
      setValue('pay_cycle_to', String(firm.pay_cycle_to ?? 30))
      setValue('face_recognition_method', firm.face_recognition_method || 'device')
      setValue('attendance_marking_method', firm.attendance_marking_method || 'offline_sync')
      setValue('applicable_for_sandwich_policy', !!firm.applicable_for_sandwich_policy)
      setValue('shiftwise_incentive', !!firm.shiftwise_incentive)
      setValue('comp_off', !!firm.comp_off)
      setValue('applicable_comp_off', firm.applicable_comp_off || 'none')
      setValue('comp_off_validity', firm.comp_off_validity != null ? String(firm.comp_off_validity) : '')
      setValue('late_cut_off', firm.late_cut_off || '')
      setValue('firm_early', firm.firm_early || '')
      if (Number(firmId) === 11271) {
        setValue('allow_auto_punch', !!firm.allow_auto_punch)
      }
    }
  }, [firm, firmId, setValue])

  // Update Cover Image Handler
  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !firmId) return

    setIsUploadingBanner(true)
    try {
      const fileIds = await uploadFiles([file])
      if (fileIds && fileIds.length > 0) {
        const newBannerId = fileIds[0]
        await rdk.request(
          updateItems('firm', [firmId], {
            firm_banner_image: newBannerId,
          })
        )
        sound.success()
        toast.success('Company cover banner updated successfully')
        setBannerError(false)
        queryClient.invalidateQueries({ queryKey: ['firm-Details'] })
        queryClient.invalidateQueries({ queryKey: ['firm'] })
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload cover image')
    } finally {
      setIsUploadingBanner(false)
      if (bannerInputRef.current) bannerInputRef.current.value = ''
    }
  }

  // Update Profile Logo Handler
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !firmId) return

    setIsUploadingLogo(true)
    try {
      const fileIds = await uploadFiles([file])
      if (fileIds && fileIds.length > 0) {
        const newLogoId = fileIds[0]
        await rdk.request(
          updateItems('firm', [firmId], {
            firm_paid_logo: newLogoId,
          })
        )
        sound.success()
        toast.success('Company logo updated successfully')
        setLogoError(false)
        queryClient.invalidateQueries({ queryKey: ['firm-Details'] })
        queryClient.invalidateQueries({ queryKey: ['firm'] })
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload company logo')
    } finally {
      setIsUploadingLogo(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  const updateMutation = useMutation({
    mutationFn: async (data: CompanyFormValues) => {
      if (!firmId) throw new Error('Firm ID missing')

      const payload: Record<string, any> = {
        firm_name: data.firm_name?.trim(),
        firm_gstin: data.firm_gstin?.trim() || '-',
        firm_address: data.firm_address?.trim() || null,
        firm_phone: data.firm_phone?.trim() || null,
        firm_email: data.firm_email?.trim() || null,
        pay_period: data.pay_period,
        pay_cycle_enabled: data.pay_cycle_enabled,
        pay_cycle_from: Number(data.pay_cycle_from),
        pay_cycle_to: Number(data.pay_cycle_to),
        face_recognition_method: data.face_recognition_method,
        attendance_marking_method: data.attendance_marking_method,
        applicable_for_sandwich_policy: data.applicable_for_sandwich_policy,
        shiftwise_incentive: data.shiftwise_incentive,
        comp_off: data.comp_off,
        applicable_comp_off: data.comp_off && data.applicable_comp_off !== 'none' ? data.applicable_comp_off : null,
        comp_off_validity: data.comp_off && data.comp_off_validity ? Number(data.comp_off_validity) : null,
      }

      if (data.late_cut_off) payload.late_cut_off = data.late_cut_off
      if (data.firm_early) payload.firm_early = data.firm_early

      if (Number(firmId) === 11271) {
        payload.allow_auto_punch = data.allow_auto_punch
      }

      return await rdk.request(updateItems('firm', [firmId], payload))
    },
    onSuccess: () => {
      sound.success()
      toast.success('Company Details updated successfully')
      queryClient.invalidateQueries({ queryKey: ['firm-Details'] })
      queryClient.invalidateQueries({ queryKey: ['firm'] })
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update company details')
    },
  })

  const onSubmit = (values: CompanyFormValues) => {
    updateMutation.mutate(values)
  }

  const bannerUrl = firm?.firm_banner_image ? `${ATTENDANCE_SERVER_URL}/assets/${firm.firm_banner_image}` : null
  const logoUrl = firm?.firm_paid_logo ? `${ATTENDANCE_SERVER_URL}/assets/${firm.firm_paid_logo}` : null

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
        Failed to load company details. Please try again.
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* 1. Header Bar with Pinned Save Button on Right */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-3.5 bg-card/60 backdrop-blur-sm shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="size-4" />
            </div>
            <h1 className="font-display text-base font-semibold tracking-tight text-foreground">
              Company Details
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your organization profile, GSTIN, pay cycle, and attendance policies.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="submit"
            form="company-details-form"
            disabled={updateMutation.isPending || isSubmitting}
            className="h-8 gap-1.5 px-4 text-xs font-semibold cursor-pointer shadow-xs"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                <Save className="size-3.5" />
                <span>Save Company Details</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 2. Scrollable Form Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        <form id="company-details-form" onSubmit={handleSubmit(onSubmit)} className="max-w-4xl space-y-6">
      {/* Hidden File Inputs for Banner & Logo Upload */}
      <input
        type="file"
        ref={bannerInputRef}
        onChange={handleBannerUpload}
        accept="image/*"
        className="hidden"
      />
      <input
        type="file"
        ref={logoInputRef}
        onChange={handleLogoUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Social / Profile Header Card: Cover Image & Profile Avatar */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xs">
        {/* Cover Photo Banner */}
        <div className="relative h-48 sm:h-60 w-full bg-linear-to-r from-slate-900 via-indigo-950 to-blue-900 overflow-hidden">
          {bannerUrl && !bannerError ? (
            <img
              src={bannerUrl}
              alt="Company Cover Banner"
              className="size-full object-cover"
              onError={() => setBannerError(true)}
            />
          ) : (
            <div className="size-full flex flex-col items-center justify-center text-white/30 p-4">
              <Building2 className="size-16 stroke-1 opacity-40 mb-1" />
              <span className="text-xs font-medium tracking-wider uppercase opacity-60">Company Workspace Banner</span>
            </div>
          )}

          {/* Bottom subtle shadow overlay for contrast */}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />

          {/* Edit Cover Photo Action Button */}
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => bannerInputRef.current?.click()}
              disabled={isUploadingBanner}
              className="h-8 gap-1.5 text-xs font-medium bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/20 shadow-md cursor-pointer transition-colors"
            >
              {isUploadingBanner ? (
                <>
                  <Loader2 className="size-3.5 animate-spin text-white" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Camera className="size-3.5" />
                  <span>Edit Cover</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Profile Avatar & Info Row (Clean Modern Social/Org Header) */}
        <div className="px-6 pb-6 pt-0 relative">
          {/* Top Row: Avatar overlapping bottom of banner + Plan & Metric Badges on right */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            {/* Avatar Frame with Camera Edit Pill */}
            <div className="-mt-14 sm:-mt-16 relative shrink-0 self-start">
              <div className="size-28 sm:size-32 rounded-full border-4 border-card bg-card shadow-lg overflow-hidden grid place-items-center p-1.5 bg-background">
                {logoUrl && !logoError ? (
                  <img
                    src={logoUrl}
                    alt="Company Logo"
                    className="size-full object-contain rounded-full"
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <div className="grid place-items-center size-full rounded-full bg-primary/10 text-primary">
                    <Building2 className="size-12" />
                  </div>
                )}

                {isUploadingLogo && (
                  <div className="absolute inset-0 bg-background/70 backdrop-blur-xs flex items-center justify-center">
                    <Loader2 className="size-6 animate-spin text-primary" />
                  </div>
                )}
              </div>

              {/* Floating Camera Button on Avatar */}
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={isUploadingLogo}
                title="Change Company Logo"
                className="absolute bottom-1 right-1 size-8 rounded-full bg-primary text-primary-foreground shadow-md grid place-items-center hover:scale-105 active:scale-95 transition-all cursor-pointer border-2 border-card"
              >
                <Camera className="size-4" />
              </button>
            </div>

            {/* Quick Metrics & Plan Badges (Sitting cleanly in the card body) */}
            <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0 pb-1">
              {firm.subscription_plan && (
                <Badge variant="secondary" className="gap-1.5 text-xs py-1 px-3 capitalize bg-primary/10 text-primary border border-primary/20">
                  <Sparkles className="size-3.5" />
                  <span>{firm.subscription_plan} Plan</span>
                </Badge>
              )}
              {firm.whatsapp_credits_available && (
                <Badge variant="outline" className="gap-1.5 text-xs py-1 px-2.5">
                  <MessageSquare className="size-3 text-emerald-600" />
                  <span>{firm.whatsapp_credits_available} WA Credits</span>
                </Badge>
              )}
              {firm.firm_employee_limit && (
                <Badge variant="outline" className="gap-1.5 text-xs py-1 px-2.5">
                  <Users className="size-3 text-blue-500" />
                  <span>Limit: {firm.firm_employee_limit} Staff</span>
                </Badge>
              )}
            </div>
          </div>

          {/* Title & Organization Identity: Firm Name, Code, and Address cleanly in the card */}
          <div className="mt-3 space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                {firm.firm_name}
              </h1>
              {firm.firm_company_code && (
                <Badge variant="outline" className="font-mono text-xs font-semibold bg-primary/5 text-primary border-primary/20">
                  {firm.firm_company_code}
                </Badge>
              )}
            </div>
            {firm.firm_address && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 max-w-2xl">
                <MapPin className="size-3.5 text-muted-foreground shrink-0" />
                <span>{firm.firm_address}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Basic Company Info */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-2xs space-y-5">
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="size-4.5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Organization Information</h2>
            <p className="text-xs text-muted-foreground">General identification and contact parameters for this firm</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="firm_name" className="text-xs font-medium">Company Name *</Label>
            <Input
              id="firm_name"
              {...register('firm_name', { required: true })}
              placeholder="e.g. RRV Softech PVT LTD"
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="firm_company_code" className="text-xs font-medium">Company Short Code</Label>
            <Input
              id="firm_company_code"
              {...register('firm_company_code')}
              disabled
              title="Company code is assigned automatically"
              placeholder="e.g. RRVSOFT"
              className="h-9 text-xs bg-muted/30 font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="firm_gstin" className="text-xs font-medium">GSTIN</Label>
            <Input
              id="firm_gstin"
              {...register('firm_gstin')}
              placeholder="e.g. 07AAAAA0000A1Z5"
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="firm_phone" className="text-xs font-medium">Company Phone</Label>
            <Input
              id="firm_phone"
              {...register('firm_phone')}
              placeholder="e.g. 8696770077"
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="firm_email" className="text-xs font-medium">Company Email</Label>
            <Input
              id="firm_email"
              type="email"
              {...register('firm_email')}
              placeholder="e.g. office@myhisaab.com"
              className="h-9 text-xs"
            />
          </div>

          {firm.week_off_day && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Standard Week Off Day</Label>
              <div className="h-9 flex items-center px-3 rounded-md border border-border bg-muted/20 text-xs text-foreground font-medium">
                {firm.week_off_day} {firm.week_off_payment ? '(Paid)' : '(Unpaid)'}
              </div>
            </div>
          )}

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="firm_address" className="text-xs font-medium">Office / Registered Address</Label>
            <Input
              id="firm_address"
              {...register('firm_address')}
              placeholder="Street, City, State, PIN"
              className="h-9 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Pay Cycle & Salary Calculations */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-2xs space-y-5">
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <div className="grid size-9 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600">
            <Calendar className="size-4.5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Pay Cycle & Salary Calculations</h2>
            <p className="text-xs text-muted-foreground">Configure salary period, billing cycles and monthly date cutoffs</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Pay Period Basis</Label>
            <Controller
              name="pay_period"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select Pay Period" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAY_PERIOD_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {/* Descriptive Calculation Formula Explanation matching v1 */}
            <p className="text-[11px] text-muted-foreground leading-normal mt-1 flex items-start gap-1">
              <Info className="size-3 text-primary shrink-0 mt-0.5" />
              <span>
                {watchPayPeriod === '30_days'
                  ? 'Daily rate = Monthly salary ÷ 30 (fixed for all months).'
                  : watchPayPeriod === 'calendar_with_week_off'
                  ? 'Daily rate = Monthly salary ÷ Total calendar days. WeekOff days are paid (30/31).'
                  : 'Daily rate = Monthly salary ÷ (Total calendar days - Week-offs). WeekOff days are unpaid (26/27).'}
              </span>
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="space-y-0.5">
              <span className="text-xs font-medium text-foreground">Custom Pay Cycle</span>
              <p className="text-[11px] text-muted-foreground">Enable custom monthly cycle date range</p>
            </div>
            <Controller
              name="pay_cycle_enabled"
              control={control}
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>

          {isPayCycleEnabled && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Pay Cycle Start Day</Label>
                <Controller
                  name="pay_cycle_from"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Day 21" />
                      </SelectTrigger>
                      <SelectContent>
                        {dayOptions.map((d) => (
                          <SelectItem key={d.value} value={d.value} className="text-xs">
                            Day {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Pay Cycle End Day</Label>
                <Controller
                  name="pay_cycle_to"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Day 20" />
                      </SelectTrigger>
                      <SelectContent>
                        {dayOptions.map((d) => (
                          <SelectItem key={d.value} value={d.value} className="text-xs">
                            Day {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Attendance & Policies */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-2xs space-y-5">
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <div className="grid size-9 place-items-center rounded-lg bg-blue-500/10 text-blue-600">
            <ShieldCheck className="size-4.5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Attendance & Compensatory Policies</h2>
            <p className="text-xs text-muted-foreground">Verification mechanisms, sandwich rule and compensatory off</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Face Recognition Verification</Label>
            <Controller
              name="face_recognition_method"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="device" className="text-xs">On Device Verification</SelectItem>
                    <SelectItem value="server" className="text-xs">Server-side AI Recognition</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Attendance Marking Method</Label>
            <Controller
              name="attendance_marking_method"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online" className="text-xs">Online Sync Only</SelectItem>
                    <SelectItem value="offline_sync" className="text-xs">Offline with Sync</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="space-y-0.5">
              <span className="text-xs font-medium text-foreground">Sandwich Policy</span>
              <p className="text-[11px] text-muted-foreground">Treat absent days sandwiching holidays as absent</p>
            </div>
            <Controller
              name="applicable_for_sandwich_policy"
              control={control}
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="space-y-0.5">
              <span className="text-xs font-medium text-foreground">Shiftwise Incentive</span>
              <p className="text-[11px] text-muted-foreground">Calculate incentives based on active shift completion</p>
            </div>
            <Controller
              name="shiftwise_incentive"
              control={control}
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3 md:col-span-2">
            <div className="space-y-0.5">
              <span className="text-xs font-medium text-foreground">Compensatory Off (Comp-Off)</span>
              <p className="text-[11px] text-muted-foreground">Allow employees to earn comp-off for working on off-days</p>
            </div>
            <Controller
              name="comp_off"
              control={control}
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>

          {isCompOffEnabled && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Comp-Off Applicable On</Label>
                <Controller
                  name="applicable_comp_off"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {COMP_OFF_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="comp_off_validity" className="text-xs font-medium">Comp-Off Validity (Days)</Label>
                <Input
                  id="comp_off_validity"
                  type="number"
                  min={1}
                  {...register('comp_off_validity')}
                  placeholder="e.g. 60 days"
                  className="h-9 text-xs"
                />
              </div>
            </>
          )}

          {Number(firmId) === 11271 && (
            <div className="flex items-center justify-between rounded-lg border border-border p-3 md:col-span-2 bg-amber-500/5 border-amber-500/20">
              <div className="space-y-0.5">
                <span className="text-xs font-medium text-foreground">Allow Auto Punch</span>
                <p className="text-[11px] text-muted-foreground">Automatically punch in staff on geo-arrival</p>
              </div>
              <Controller
                name="allow_auto_punch"
                control={control}
                render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
            </div>
          )}
        </div>
      </div>
        </form>
      </div>
    </div>
  )
}

export default CompanyDetailsSettings
