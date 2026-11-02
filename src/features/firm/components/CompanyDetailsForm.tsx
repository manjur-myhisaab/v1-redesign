import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Building2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useFirmDetailsQuery, useUpdateFirmMutation } from '../hooks/useFirm'
import type { FirmDetails } from '../api/firmApi.types'

const companyDetailsSchema = z.object({
  firm_name: z.string().min(1, 'Company Name is required'),
  firm_gstin: z.string().optional().nullable(),
  firm_address: z.string().optional().nullable(),
  firm_phone: z.string().optional().nullable(),
  firm_email: z.union([z.string().email('Invalid email address'), z.string().length(0)]).optional().nullable(),
  pay_period: z.string().min(1, 'Pay Period is required'),
  pay_cycle_enabled: z.boolean().default(false),
  pay_cycle_from: z.string().optional().nullable(),
  pay_cycle_to: z.string().optional().nullable(),
  face_recognition_method: z.string().min(1, 'Face Recognition Method is required'),
  attendance_marking_method: z.string().min(1, 'Attendance Marking Method is required'),
  applicable_for_sandwich_policy: z.boolean().default(false),
  shiftwise_incentive: z.boolean().default(false),
  comp_off: z.boolean().default(false),
  applicable_comp_off: z.string().optional().nullable(),
  comp_off_validity: z.string().optional().nullable(),
})

type CompanyDetailsFormValues = z.infer<typeof companyDetailsSchema>

export default function CompanyDetailsForm() {
  const { data: detailsData, isLoading } = useFirmDetailsQuery()
  const updateMutation = useUpdateFirmMutation()
  const [originalDetails, setOriginalDetails] = useState<FirmDetails | null>(null)

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<CompanyDetailsFormValues>({
    resolver: zodResolver(companyDetailsSchema) as any,
    defaultValues: {
      firm_name: '',
      firm_gstin: '',
      firm_address: '',
      firm_phone: '',
      firm_email: '',
      pay_period: 'calendar_with_week_off',
      pay_cycle_enabled: false,
      pay_cycle_from: '1',
      pay_cycle_to: '30',
      face_recognition_method: 'server',
      attendance_marking_method: 'online',
      applicable_for_sandwich_policy: false,
      shiftwise_incentive: false,
      comp_off: false,
      applicable_comp_off: '',
      comp_off_validity: '',
    },
  })

  const watchPayCycleEnabled = watch('pay_cycle_enabled')
  const watchCompOff = watch('comp_off')

  useEffect(() => {
    if (detailsData) {
      const firm = detailsData
      setOriginalDetails(firm)

      let validityVal = ''
      if (firm.comp_off_validity) {
        const parsed = parseInt(firm.comp_off_validity)
        if (!isNaN(parsed)) validityVal = String(parsed)
      }

      reset({
        firm_name: firm.firm_name || '',
        firm_gstin: firm.firm_gstin || '',
        firm_address: firm.firm_address || '',
        firm_phone: firm.firm_phone || '',
        firm_email: firm.firm_email || '',
        pay_period: firm.pay_period || 'calendar_with_week_off',
        pay_cycle_enabled: !!firm.pay_cycle_enabled,
        pay_cycle_from: firm.pay_cycle_from ? String(firm.pay_cycle_from) : '1',
        pay_cycle_to: firm.pay_cycle_to ? String(firm.pay_cycle_to) : '30',
        face_recognition_method: firm.face_recognition_method || 'server',
        attendance_marking_method: firm.attendance_marking_method || 'online',
        applicable_for_sandwich_policy: !!firm.applicable_for_sandwich_policy,
        shiftwise_incentive: !!firm.shiftwise_incentive,
        comp_off: !!firm.comp_off,
        applicable_comp_off: firm.applicable_comp_off || '',
        comp_off_validity: validityVal,
      })
    }
  }, [detailsData, reset])

  const onSubmit = (data: CompanyDetailsFormValues) => {
    if (!originalDetails) return

    let validityStr: string | null = null
    if (data.comp_off && data.comp_off_validity) {
      validityStr = `${data.comp_off_validity}_days`
    }

    const payload: Partial<FirmDetails> = {
      ...originalDetails,
      firm_name: data.firm_name,
      firm_gstin: data.firm_gstin || '',
      firm_address: data.firm_address || '',
      firm_phone: data.firm_phone || '',
      firm_email: data.firm_email || '',
      pay_period: data.pay_period,
      pay_cycle_enabled: data.pay_cycle_enabled,
      pay_cycle_from: data.pay_cycle_enabled ? Number(data.pay_cycle_from) : originalDetails.pay_cycle_from,
      pay_cycle_to: data.pay_cycle_enabled ? Number(data.pay_cycle_to) : originalDetails.pay_cycle_to,
      face_recognition_method: data.face_recognition_method,
      attendance_marking_method: data.attendance_marking_method,
      applicable_for_sandwich_policy: data.applicable_for_sandwich_policy,
      shiftwise_incentive: data.shiftwise_incentive,
      comp_off: data.comp_off,
      applicable_comp_off: data.comp_off ? (data.applicable_comp_off || null) : null,
      comp_off_validity: validityStr,
    }

    updateMutation.mutate(payload)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-xs text-muted-foreground">
        <Loader2 className="size-4 animate-spin mr-2" />
        Loading company details...
      </div>
    )
  }

  const daysArray = Array.from({ length: 31 }, (_, i) => String(i + 1))

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
        {/* Card Title */}
        <div className="flex items-center justify-between pb-4 border-b border-border mb-6">
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Company Details</h2>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firm_name" className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Company Name <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="firm_name"
                {...register('firm_name')}
                placeholder="Enter company name"
                className="h-9 text-xs"
              />
              {errors.firm_name && (
                <p className="text-[11px] font-medium text-rose-500 mt-1">{errors.firm_name.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="firm_gstin" className="text-xs font-medium text-muted-foreground mb-1.5 block">
                GSTIN
              </Label>
              <Input
                id="firm_gstin"
                {...register('firm_gstin')}
                placeholder="Enter GSTIN"
                className="h-9 text-xs"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="firm_address" className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Address
            </Label>
            <Input
              id="firm_address"
              {...register('firm_address')}
              placeholder="Enter company address"
              className="h-9 text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firm_phone" className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Phone Number
              </Label>
              <Input
                id="firm_phone"
                {...register('firm_phone')}
                placeholder="Enter phone number"
                className="h-9 text-xs"
              />
            </div>

            <div>
              <Label htmlFor="firm_email" className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Email
              </Label>
              <Input
                id="firm_email"
                {...register('firm_email')}
                placeholder="Enter email address"
                className="h-9 text-xs"
              />
              {errors.firm_email && (
                <p className="text-[11px] font-medium text-rose-500 mt-1">{errors.firm_email.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            <div>
              <Label htmlFor="pay_period" className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Pay Period
              </Label>
              <Controller
                control={control}
                name="pay_period"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="pay_period" className="h-9 text-xs bg-card">
                      <SelectValue placeholder="Select Pay Period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="calendar_with_week_off">Calendar Days (Week-offs Paid)</SelectItem>
                      <SelectItem value="calendar_days">Calendar Days</SelectItem>
                      <SelectItem value="fixed_30_days">Fixed 30 Days</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Daily rate = Monthly salary ÷ Total calendar days. WeekOff days are paid (30/31).
              </p>
            </div>

            <div className="flex items-start gap-2.5 pt-6">
              <Controller
                control={control}
                name="pay_cycle_enabled"
                render={({ field }) => (
                  <Checkbox
                    id="pay_cycle_enabled"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="mt-0.5"
                  />
                )}
              />
              <div className="space-y-0.5">
                <Label htmlFor="pay_cycle_enabled" className="text-xs font-semibold text-foreground cursor-pointer">
                  Enable Payroll Cycle
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Toggle to enable a custom monthly pay cycle range.
                </p>
              </div>
            </div>
          </div>

          {watchPayCycleEnabled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pay_cycle_from" className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Pay Cycle Start Day
                </Label>
                <Controller
                  control={control}
                  name="pay_cycle_from"
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value || '1'}>
                      <SelectTrigger id="pay_cycle_from" className="h-9 text-xs bg-card">
                        <SelectValue placeholder="Select Start Day" />
                      </SelectTrigger>
                      <SelectContent>
                        {daysArray.map((d) => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div>
                <Label htmlFor="pay_cycle_to" className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Pay Cycle End Day
                </Label>
                <Controller
                  control={control}
                  name="pay_cycle_to"
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value || '30'}>
                      <SelectTrigger id="pay_cycle_to" className="h-9 text-xs bg-card">
                        <SelectValue placeholder="Select End Day" />
                      </SelectTrigger>
                      <SelectContent>
                        {daysArray.map((d) => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="face_recognition_method" className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Face Recognition Method
              </Label>
              <Controller
                control={control}
                name="face_recognition_method"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="face_recognition_method" className="h-9 text-xs bg-card">
                      <SelectValue placeholder="Select Method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="server">Server</SelectItem>
                      <SelectItem value="device">Device</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div>
              <Label htmlFor="attendance_marking_method" className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Attendance Marking Method
              </Label>
              <Controller
                control={control}
                name="attendance_marking_method"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="attendance_marking_method" className="h-9 text-xs bg-card">
                      <SelectValue placeholder="Select Method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="offline">Offline</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-start gap-2.5">
              <Controller
                control={control}
                name="applicable_for_sandwich_policy"
                render={({ field }) => (
                  <Checkbox
                    id="applicable_for_sandwich_policy"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="mt-0.5"
                  />
                )}
              />
              <div className="space-y-0.5">
                <Label htmlFor="applicable_for_sandwich_policy" className="text-xs font-semibold text-foreground cursor-pointer">
                  Applicable for Sandwich Policy
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Toggle to enable the pay cycle settings for sandwich policy calculations.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Controller
                control={control}
                name="shiftwise_incentive"
                render={({ field }) => (
                  <Checkbox
                    id="shiftwise_incentive"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="mt-0.5"
                  />
                )}
              />
              <div className="space-y-0.5">
                <Label htmlFor="shiftwise_incentive" className="text-xs font-semibold text-foreground cursor-pointer">
                  Enable Shift-wise incentives
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Toggle to enable shift-wise incentive calculations.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Controller
                control={control}
                name="comp_off"
                render={({ field }) => (
                  <Checkbox
                    id="comp_off"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="mt-0.5"
                  />
                )}
              />
              <div className="space-y-0.5">
                <Label htmlFor="comp_off" className="text-xs font-semibold text-foreground cursor-pointer">
                  Compensatory Off
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Enable compensatory off settings for your company.
                </p>
              </div>
            </div>
          </div>

          {watchCompOff && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-4 border-l-2 border-primary/20 pt-2">
              <div>
                <Label htmlFor="applicable_comp_off" className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Applicable Comp Off
                </Label>
                <Controller
                  control={control}
                  name="applicable_comp_off"
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <SelectTrigger id="applicable_comp_off" className="h-9 text-xs bg-card">
                        <SelectValue placeholder="Select Option" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Employees</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div>
                <Label htmlFor="comp_off_validity" className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Valid for number of days
                </Label>
                <Input
                  id="comp_off_validity"
                  {...register('comp_off_validity')}
                  placeholder="e.g. 30"
                  className="h-9 text-xs"
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="btn-3d h-9 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/95"
            >
              {updateMutation.isPending && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
              Update
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
