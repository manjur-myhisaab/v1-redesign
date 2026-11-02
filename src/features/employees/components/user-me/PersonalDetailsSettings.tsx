import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  User,
  Save,
  Upload,
  Calendar as CalendarIcon,
  Loader2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { useAuth } from '@/context/auth/AuthContext'
import {
  useEmployeeByIdQuery,
  useUpdateEmployeeMutation,
} from '@/features/employees/hooks/useEmployees'
import { sound } from '@/lib/sound'
import PersonAvatar from '@/components/admin/PersonAvatar'

const personalDetailsSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().optional().nullable(),
  mobile_number: z
    .string()
    .min(10, 'Mobile number must be at least 10 digits')
    .regex(/^[0-9+ ]+$/, 'Invalid phone number format'),
  pay_type: z.string().optional(),
  salary_per_month: z.any().optional(),
  doj: z.string().optional().nullable(),
  multiple_attendance: z.boolean().optional(),
  live_tracking: z.boolean().optional(),
  mobile_attendance: z.boolean().optional(),
})

type PersonalDetailsFormValues = z.infer<typeof personalDetailsSchema>

export default function PersonalDetailsSettings() {
  const { user } = useAuth()
  const userId = user?.id || ''

  const { data: employeeData, isLoading } = useEmployeeByIdQuery(userId)
  const updateMutation = useUpdateEmployeeMutation()

  const [profilePic, setProfilePic] = useState<string | null>(null)
  const [dojPopoverOpen, setDojPopoverOpen] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<PersonalDetailsFormValues>({
    resolver: zodResolver(personalDetailsSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      mobile_number: '',
      pay_type: 'Monthly',
      salary_per_month: '30000',
      doj: null,
      multiple_attendance: false,
      live_tracking: false,
      mobile_attendance: false,
    },
  })

  const firstName = watch('first_name')
  const lastName = watch('last_name')

  useEffect(() => {
    if (!employeeData) return
    const e = (employeeData as any).data?.user || (employeeData as any).user || (employeeData as any).data || employeeData
    console.log(e, "employeeData");

    const parseDateStr = (d: string | null | undefined) => {
      if (!d) return ''
      const parsed = new Date(d)
      if (isNaN(parsed.getTime())) return ''
      return parsed.toISOString().slice(0, 10)
    }

    reset({
      first_name: e.first_name || user?.name?.split(' ')[0] || '',
      last_name: e.last_name || user?.name?.split(' ').slice(1).join(' ') || '',
      mobile_number: e.mobile_number || user?.phone || '',
      pay_type: e.pay_type
        ? e.pay_type.charAt(0).toUpperCase() + e.pay_type.slice(1).toLowerCase()
        : 'Monthly',
      salary_per_month: e.salary_per_month !== null && e.salary_per_month !== undefined ? String(e.salary_per_month) : '',
      doj: parseDateStr(e.doj) || '',
      multiple_attendance: Boolean(e.multiple_attendance),
      live_tracking: Boolean(e.live_tracking),
      mobile_attendance: Boolean(e.mobile_attendance),
    })
  }, [employeeData, user, reset])

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setProfilePic(URL.createObjectURL(file))
      toast.success('Profile picture preview loaded.')
    }
  }

  const onSubmit = (data: PersonalDetailsFormValues) => {
    if (!userId) {
      toast.error('User ID missing.')
      return
    }

    const payload = {
      user_id: userId,
      first_name: data.first_name,
      last_name: data.last_name || null,
      mobile_number: data.mobile_number,
      pay_type: (data.pay_type || 'monthly').toLowerCase(),
      salary_per_month: parseFloat(data.salary_per_month) || 0,
      doj: data.doj ? new Date(data.doj).toISOString().slice(0, 10) : null,
      multiple_attendance: Boolean(data.multiple_attendance),
      live_tracking: Boolean(data.live_tracking),
      mobile_attendance: Boolean(data.mobile_attendance),
    }

    updateMutation.mutate(payload, {
      onSuccess: () => {
        sound.success()
        toast.success('Personal details updated successfully.')
      },
      onError: (err: any) => {
        sound.error()
        toast.error(err.message || 'Failed to update personal details.')
      },
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-xs text-muted-foreground">
        <Loader2 className="size-4 animate-spin mr-2" />
        Loading personal details...
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
        {/* Card Title */}
        <div className="flex items-center justify-between pb-4 border-b border-border mb-6">
          <div className="flex items-center gap-2">
            <User className="size-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Personal Details</h2>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Main Layout: Left Profile Pic + Right Fields */}
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Left Avatar & Upload */}
            <div className="flex flex-col items-center gap-3 shrink-0">
              {profilePic ? (
                <img
                  src={profilePic}
                  alt="Profile"
                  className="size-28 rounded-full object-cover border-2 border-border shadow-md"
                />
              ) : (
                <PersonAvatar
                  name={`${firstName || ''} ${lastName || ''}`}
                  className="size-28 rounded-full border-2 border-border shadow-md text-2xl"
                />
              )}
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  id="user-me-photo-upload"
                  className="hidden"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                />
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-medium cursor-pointer"
                >
                  <label htmlFor="user-me-photo-upload" className="flex items-center gap-1.5 cursor-pointer">
                    <Upload className="size-3.5" />
                    Choose file
                  </label>
                </Button>
                <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                  No file chosen
                </span>
              </div>
            </div>

            {/* Right Fields Grid */}
            <div className="flex-1 min-w-0 space-y-4 w-full">
              {/* Row 1: First Name, Last Name, Phone Number */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="first_name" className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    First Name <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="first_name"
                    {...register('first_name')}
                    placeholder="Enter first name"
                    className="h-9 text-xs"
                  />
                  {errors.first_name && (
                    <p className="text-[11px] font-medium text-rose-500 mt-1">{errors.first_name.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="last_name" className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Last Name
                  </Label>
                  <Input
                    id="last_name"
                    {...register('last_name')}
                    placeholder="Enter last name"
                    className="h-9 text-xs"
                  />
                </div>

                <div>
                  <Label htmlFor="mobile_number" className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Phone Number <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="mobile_number"
                    {...register('mobile_number')}
                    placeholder="Enter phone number"
                    className="h-9 text-xs"
                  />
                  {errors.mobile_number && (
                    <p className="text-[11px] font-medium text-rose-500 mt-1">{errors.mobile_number.message}</p>
                  )}
                </div>
              </div>

              {/* Row 2: Pay Type, Monthly Salary, Date of Joining */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="pay_type" className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Pay Type
                  </Label>
                  <Controller
                    control={control}
                    name="pay_type"
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value || 'Monthly'}>
                        <SelectTrigger id="pay_type" className="h-9 text-xs">
                          <SelectValue placeholder="Select Pay Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Monthly">Monthly</SelectItem>
                          <SelectItem value="Daily">Daily</SelectItem>
                          <SelectItem value="Hourly">Hourly</SelectItem>
                          <SelectItem value="Weekly">Weekly</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div>
                  <Label htmlFor="salary_per_month" className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Monthly Salary
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                      ₹
                    </span>
                    <Input
                      id="salary_per_month"
                      {...register('salary_per_month')}
                      placeholder="30000"
                      className="h-9 text-xs pl-7"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="doj" className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Date of Joining
                  </Label>
                  <Controller
                    control={control}
                    name="doj"
                    render={({ field }) => {
                      const selectedDate = field.value ? new Date(field.value) : undefined
                      return (
                        <Popover open={dojPopoverOpen} onOpenChange={setDojPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              id="doj"
                              variant="outline"
                              className="w-full justify-between text-left font-normal h-9 text-xs px-3 cursor-pointer"
                            >
                              {selectedDate && !isNaN(selectedDate.getTime()) ? (
                                format(selectedDate, 'dd-MM-yyyy')
                              ) : (
                                <span className="text-muted-foreground">Pick a date</span>
                              )}
                              <CalendarIcon className="size-3.5 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={selectedDate}
                              captionLayout="dropdown"
                              startMonth={new Date(1990, 0)}
                              endMonth={new Date(2040, 11)}
                              onSelect={(date) => {
                                if (date) {
                                  const yyyy = date.getFullYear()
                                  const mm = String(date.getMonth() + 1).padStart(2, '0')
                                  const dd = String(date.getDate()).padStart(2, '0')
                                  field.onChange(`${yyyy}-${mm}-${dd}`)
                                } else {
                                  field.onChange(null)
                                }
                                setDojPopoverOpen(false)
                              }}
                            />
                          </PopoverContent>
                        </Popover>
                      )
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Toggles Row (Replaced Checkboxes with Switches as requested) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-border">
            {/* Multiple Attendance Switch */}
            <div className="flex items-start gap-3 rounded-lg border border-border p-3.5 bg-muted/10">
              <Controller
                control={control}
                name="multiple_attendance"
                render={({ field }) => (
                  <Switch
                    id="multiple_attendance"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="mt-0.5"
                  />
                )}
              />
              <div className="space-y-0.5">
                <Label htmlFor="multiple_attendance" className="text-xs font-semibold text-foreground cursor-pointer">
                  Multiple Attendance
                </Label>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  Allow multiple attendance entries per day
                </p>
              </div>
            </div>

            {/* Live Tracking Switch */}
            <div className="flex items-start gap-3 rounded-lg border border-border p-3.5 bg-muted/10">
              <Controller
                control={control}
                name="live_tracking"
                render={({ field }) => (
                  <Switch
                    id="live_tracking"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="mt-0.5"
                  />
                )}
              />
              <div className="space-y-0.5">
                <Label htmlFor="live_tracking" className="text-xs font-semibold text-foreground cursor-pointer">
                  Live Tracking
                </Label>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  Enable live location tracking
                </p>
              </div>
            </div>

            {/* Mobile Attendance Switch */}
            <div className="flex items-start gap-3 rounded-lg border border-border p-3.5 bg-muted/10">
              <Controller
                control={control}
                name="mobile_attendance"
                render={({ field }) => (
                  <Switch
                    id="mobile_attendance"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="mt-0.5"
                  />
                )}
              />
              <div className="space-y-0.5">
                <Label htmlFor="mobile_attendance" className="text-xs font-semibold text-foreground cursor-pointer">
                  Mobile Attendance
                </Label>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  Allow attendance marking from mobile
                </p>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex justify-start">
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="btn-3d flex items-center gap-2 bg-primary text-primary-foreground font-medium rounded-lg h-9 px-5 text-xs cursor-pointer disabled:opacity-50"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="size-3.5" />
                  Save
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
