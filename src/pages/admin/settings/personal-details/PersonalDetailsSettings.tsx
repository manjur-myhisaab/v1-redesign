import React, { useEffect, useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  User,
  IndianRupee,
  Save,
  Loader2,
  Camera,
  Navigation,
  Clock,
  Smartphone,
  ShieldAlert,
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
  ATTENDANCE_SERVER_URL,
  customEndpoint,
  getCurrentUser,
  readMe,
  uploadFiles,
} from '@/services/server'
import { sound } from '@/lib/sound'

// Exact fields corresponding to v1 EmployeeForm.jsx
interface EmployeeFormValues {
  first_name: string
  last_name: string
  phone: string
  pay_type: string
  salary_per_month: string
  doj: string
  multiple_attendance: boolean
  live_tracking: boolean
  mobile_attendance: boolean
}

export const PersonalDetailsSettings: React.FC = () => {
  const { user, updateUser } = useAuth()
  const queryClient = useQueryClient()

  // Avatar upload & preview states
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarImgError, setAvatarImgError] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)

  // Fetch full user profile from Directus RDK to get live avatar and all fields
  const { data: profileUser, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['current-user-full-profile'],
    queryFn: async () => {
      try {
        const u = await getCurrentUser()
        if (u) return u
      } catch (err) {
        console.warn('getCurrentUser failed, falling back to readMe:', err)
      }
      return await rdk.request(
        readMe({
          fields: ['*', 'firm_id.*'],
        }),
      )
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  // Combine auth session and live profile data
  const currentUser = profileUser || user
  const effectiveUserId = currentUser?.id || currentUser?.user_id

  // v1 Role / Plan restrictions:
  // If user is employee (role '8734320f-991f-479f-bba8-9d4af261856e') or on trial plan,
  // payroll & attendance configuration fields are disabled.
  const isRestricted =
    currentUser?.firm_id?.subscription_plan === 'trial' ||
    currentUser?.role === '8734320f-991f-479f-bba8-9d4af261856e'

  // Extract phone number from v1 email format ('919876543210@hisaab.reev.group' -> '9876543210')
  const extractPhoneNumber = (emailStr?: string | null): string => {
    if (!emailStr) return ''
    const clean = emailStr.replace(/^91/, '').split('@')[0]
    return clean || ''
  }

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { isSubmitting },
  } = useForm<EmployeeFormValues>({
    defaultValues: {
      first_name: '',
      last_name: '',
      phone: '',
      pay_type: '',
      salary_per_month: '',
      doj: '',
      multiple_attendance: false,
      live_tracking: false,
      mobile_attendance: true,
    },
  })

  const currentPayType = watch('pay_type')

  // Prefill form with user data exactly like v1 EmployeeForm.jsx
  useEffect(() => {
    if (currentUser) {
      const phone = extractPhoneNumber(currentUser.email || currentUser.phone)
      setValue(
        'first_name',
        currentUser.first_name || currentUser.name?.split(' ')[0] || '',
      )
      setValue(
        'last_name',
        currentUser.last_name ||
          currentUser.name?.split(' ').slice(1).join(' ') ||
          '',
      )
      setValue('phone', phone)
      setValue('pay_type', currentUser.pay_type || '')
      setValue(
        'salary_per_month',
        currentUser.salary_per_month
          ? String(currentUser.salary_per_month)
          : '',
      )
      setValue('doj', currentUser.doj || '')
      setValue('multiple_attendance', Boolean(currentUser.multiple_attendance))
      setValue('live_tracking', Boolean(currentUser.live_tracking))
      setValue('mobile_attendance', currentUser.mobile_attendance ?? true)

      // Set avatar preview if avatar ID exists on user
      if (currentUser.avatar) {
        setAvatarPreview(
          `${ATTENDANCE_SERVER_URL}/assets/${currentUser.avatar}`,
        )
        setAvatarImgError(false)
      }
    }
  }, [currentUser, setValue])

  // Direct avatar file change & immediate upload to Directus assets
  const handleAvatarFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0]
    if (!file || !effectiveUserId) return

    // Show instant local preview
    const localUrl = URL.createObjectURL(file)
    setAvatarPreview(localUrl)
    setAvatarImgError(false)

    setIsUploadingAvatar(true)
    try {
      // 1. Upload file to Directus assets
      const fileIds = await uploadFiles([file])
      if (fileIds && fileIds.length > 0) {
        const newAvatarId = fileIds[0]

        // 2. Patch user record with new avatar ID
        await rdk.request(
          customEndpoint({
            path: `users/${effectiveUserId}`,
            method: 'PATCH',
            body: JSON.stringify({ avatar: newAvatarId }),
          }),
        )

        sound.success()
        toast.success('Avatar photo updated successfully')

        // 3. Update auth state & cache
        updateUser({ avatar: newAvatarId })
        setAvatarPreview(`${ATTENDANCE_SERVER_URL}/assets/${newAvatarId}`)
        queryClient.invalidateQueries({
          queryKey: ['current-user-full-profile'],
        })
        queryClient.invalidateQueries({ queryKey: ['me'] })
        queryClient.invalidateQueries({ queryKey: ['current-user'] })
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload avatar photo')
      // Revert to original profile avatar on error
      if (currentUser?.avatar) {
        setAvatarPreview(
          `${ATTENDANCE_SERVER_URL}/assets/${currentUser.avatar}`,
        )
      } else {
        setAvatarPreview(null)
      }
    } finally {
      setIsUploadingAvatar(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  // Exact removeNullValues function from v1 EmployeeForm.jsx
  const removeNullValues = (obj: Record<string, any>) => {
    return Object.fromEntries(
      Object.entries(obj).filter(
        ([_, value]) => value !== null && value !== undefined,
      ),
    )
  }

  // Exact updateStaffMutation from v1 EmployeeForm.jsx
  const updateStaffMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      if (!effectiveUserId) throw new Error('User ID is missing')

      return await rdk.request(
        customEndpoint({
          path: `users/${effectiveUserId}`,
          method: 'PATCH',
          body: JSON.stringify(data),
        }),
      )
    },
    onSuccess: (_, variables) => {
      sound.success()
      toast.success('Profile edited successfully')

      // Sync navbar & sidebar state
      const fullName =
        `${variables.first_name || ''} ${variables.last_name || ''}`.trim()
      updateUser({
        first_name: variables.first_name,
        last_name: variables.last_name,
        name: fullName || user?.name,
      })

      queryClient.invalidateQueries({ queryKey: ['current-user-full-profile'] })
      queryClient.invalidateQueries({ queryKey: ['me'] })
      queryClient.invalidateQueries({ queryKey: ['current-user'] })
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to save profile')
    },
  })

  // Exact onSubmit logic from v1 EmployeeForm.jsx
  const onSubmit = (formData: EmployeeFormValues) => {
    const phone = formData.phone?.trim()
    const finalData: Record<string, any> = {
      first_name: formData.first_name?.trim(),
      last_name: formData.last_name?.trim() || null,
    }

    if (!isRestricted) {
      finalData.email = phone
        ? `91${phone.replace(/\D/g, '')}@hisaab.reev.group`
        : null
      finalData.pay_type = formData.pay_type || ''
      finalData.salary_per_month = formData.salary_per_month
        ? Number(formData.salary_per_month)
        : null
      finalData.doj = formData.doj || null
      finalData.multiple_attendance = Boolean(formData.multiple_attendance)
      finalData.live_tracking = Boolean(formData.live_tracking)
      finalData.mobile_attendance = Boolean(formData.mobile_attendance)
    }

    const cleanedData = removeNullValues(finalData)
    updateStaffMutation.mutate(cleanedData)
  }

  if (isLoadingProfile && !currentUser) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
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
              <User className="size-4" />
            </div>
            <h1 className="font-display text-base font-semibold tracking-tight text-foreground">
              Personal Details
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your administrator profile, contact info, and tracking parameters.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="submit"
            form="personal-details-form"
            disabled={updateStaffMutation.isPending || isSubmitting || isUploadingAvatar}
            className="h-8 gap-1.5 px-4 text-xs font-semibold cursor-pointer shadow-xs"
          >
            {updateStaffMutation.isPending || isUploadingAvatar ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="size-3.5" />
                <span>Save Changes</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 2. Scrollable Form Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        <form id="personal-details-form" onSubmit={handleSubmit(onSubmit)} className="max-w-4xl space-y-6">
      {/* Hidden File Input for Avatar Selection */}
      <input
        type="file"
        ref={avatarInputRef}
        onChange={handleAvatarFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* Profile Avatar & Header Card */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-5">
          <div className="flex items-center gap-4">
            {/* Avatar Circle with Camera Overlay */}
            <div className="relative group">
              <div
                onClick={() => avatarInputRef.current?.click()}
                className="size-20 rounded-full border-2 border-border bg-muted/60 overflow-hidden grid place-items-center shadow-xs cursor-pointer hover:opacity-90 transition-opacity"
                title="Click to change avatar photo"
              >
                {avatarPreview && !avatarImgError ? (
                  <img
                    src={avatarPreview}
                    alt="User Avatar"
                    className="size-full object-cover"
                    onError={() => setAvatarImgError(true)}
                  />
                ) : (
                  <User className="size-10 text-muted-foreground/60" />
                )}

                {isUploadingAvatar && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-xs flex items-center justify-center">
                    <Loader2 className="size-6 animate-spin text-primary" />
                  </div>
                )}
              </div>

              {/* Floating Camera Button on Avatar */}
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={isUploadingAvatar}
                title="Change Avatar Photo"
                className="absolute -bottom-1 -right-1 size-7 rounded-full bg-primary text-primary-foreground shadow-md grid place-items-center hover:scale-110 active:scale-95 transition-all cursor-pointer border-2 border-card"
              >
                <Camera className="size-3.5" />
              </button>
            </div>

            {/* User Identity Details & Change Photo Action */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">
                  {currentUser?.first_name
                    ? `${currentUser.first_name} ${currentUser.last_name || ''}`
                    : currentUser?.name || 'Administrator'}
                </h2>
                {isRestricted ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-normal bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                  >
                    Employee
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-normal bg-primary/10 text-primary border-primary/20"
                  >
                    Firm Admin
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                {currentUser?.email || 'Logged In Account'}
              </p>
              {isUploadingAvatar && (
                <>
                  <Loader2 className="size-3 animate-spin text-primary" />
                  <span>Uploading...</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Informational banner when restricted (matching v1 EmployeeForm permissions) */}
        {isRestricted && (
          <div className="flex items-center gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
            <ShieldAlert className="size-4 shrink-0" />
            <span>
              Payroll & tracking settings are managed by your firm administrator
              and locked for employee accounts.
            </span>
          </div>
        )}

        {/* Personal Details Form Layout (matching v1 EmployeeForm) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* First Name */}
          <div className="space-y-1.5">
            <Label htmlFor="first_name" className="text-xs font-medium">
              First Name *
            </Label>
            <Input
              id="first_name"
              {...register('first_name', { required: true })}
              placeholder="First Name"
              className="h-9 text-xs"
            />
          </div>

          {/* Last Name */}
          <div className="space-y-1.5">
            <Label htmlFor="last_name" className="text-xs font-medium">
              Last Name
            </Label>
            <Input
              id="last_name"
              {...register('last_name')}
              placeholder="Last Name"
              className="h-9 text-xs"
            />
          </div>

          {/* Phone Number */}
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-xs font-medium">
              Phone Number
            </Label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground select-none">
                +91
              </span>
              <Input
                id="phone"
                {...register('phone')}
                disabled={isRestricted}
                placeholder="10-digit mobile number"
                className="h-9 text-xs pl-10"
              />
            </div>
          </div>

          {/* Date of Joining */}
          <div className="space-y-1.5">
            <Label htmlFor="doj" className="text-xs font-medium">
              Date of Joining
            </Label>
            <Input
              id="doj"
              type="date"
              {...register('doj')}
              disabled={isRestricted}
              className="h-9 text-xs"
            />
          </div>

          {/* Pay Type */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Pay Type</Label>
            <Controller
              name="pay_type"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || ''}
                  onValueChange={field.onChange}
                  disabled={isRestricted}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select pay type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Monthly" className="text-xs">
                      Monthly
                    </SelectItem>
                    <SelectItem value="Daily" className="text-xs">
                      Daily
                    </SelectItem>
                    <SelectItem value="Hourly" className="text-xs">
                      Hourly
                    </SelectItem>
                    <SelectItem value="Custom" className="text-xs">
                      Custom
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Salary (dynamic label from v1: watch('pay_type') ? `${watch('pay_type')} Salary` : "Salary") */}
          <div className="space-y-1.5">
            <Label htmlFor="salary_per_month" className="text-xs font-medium">
              {currentPayType ? `${currentPayType} Salary` : 'Salary'}
            </Label>
            <div className="relative">
              <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                id="salary_per_month"
                type="number"
                {...register('salary_per_month')}
                disabled={isRestricted}
                placeholder="e.g. 50000"
                className="h-9 text-xs pl-8"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Attendance & Live Tracking Toggles (matching v1 EmployeeForm.jsx checkboxes) */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-2xs space-y-4">
        <div className="border-b border-border pb-3">
          <h3 className="text-sm font-semibold text-foreground">
            Punch & Tracking Configurations
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Control employee attendance marking permissions and location
            tracking
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Mobile Attendance */}
          <div className="flex items-center justify-between rounded-lg border border-border p-3.5">
            <div className="space-y-0.5">
              <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Smartphone className="size-3.5 text-primary" />
                Mobile Attendance
              </span>
              <p className="text-[11px] text-muted-foreground">
                Allow attendance marking from mobile
              </p>
            </div>
            <Controller
              name="mobile_attendance"
              control={control}
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isRestricted}
                />
              )}
            />
          </div>

          {/* Multiple Attendance */}
          <div className="flex items-center justify-between rounded-lg border border-border p-3.5">
            <div className="space-y-0.5">
              <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Clock className="size-3.5 text-blue-500" />
                Multiple Attendance
              </span>
              <p className="text-[11px] text-muted-foreground">
                Allow multiple attendance entries per day
              </p>
            </div>
            <Controller
              name="multiple_attendance"
              control={control}
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isRestricted}
                />
              )}
            />
          </div>

          {/* Live Tracking */}
          <div className="flex items-center justify-between rounded-lg border border-border p-3.5">
            <div className="space-y-0.5">
              <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Navigation className="size-3.5 text-emerald-500" />
                Live Tracking
              </span>
              <p className="text-[11px] text-muted-foreground">
                Enable live location tracking
              </p>
            </div>
            <Controller
              name="live_tracking"
              control={control}
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isRestricted}
                />
              )}
            />
          </div>
        </div>
      </div>
        </form>
      </div>
    </div>
  )
}

export default PersonalDetailsSettings
