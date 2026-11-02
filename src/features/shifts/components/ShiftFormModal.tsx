import React from 'react'
import { useState, useEffect, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Clock,
  Calendar as CalendarIcon,
  CalendarDays,
  CalendarRange,
  Users,
  Sliders,
  Plus,
  Trash2,
  Layers,
  MapPin,
  Search,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { TimePicker } from '@/components/ui/time-picker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type {
  Shift,
  ShiftType,
  CreateShiftRequest,
  UpdateShiftRequest,
} from '../api/shiftApi.types'
import { useCreateShiftMutation, useUpdateShiftMutation, useShiftDetailsQuery } from '../hooks/useShifts'
import { useEmployeesQuery } from '@/features/employees/hooks/useEmployees'
import type { Employee } from '@/lib/employees'
import { useCategoriesQuery } from '@/features/categories/hooks/useCategories'
import { useGeofencing } from '@/features/geofencing/hooks/useGeofencing'
import { Calendar } from '@/components/ui/calendar'

interface ShiftFormModalProps {
  open: boolean
  onClose: () => void
  shiftToEdit?: Shift | null
  shift?: Shift | null
}


const WEEKDAYS = [
  { id: '1', name: 'MON', label: 'Monday' },
  { id: '2', name: 'TUES', label: 'Tuesday' },
  { id: '3', name: 'WED', label: 'Wednesday' },
  { id: '4', name: 'THU', label: 'Thursday' },
  { id: '5', name: 'FRI', label: 'Friday' },
  { id: '6', name: 'SAT', label: 'Saturday' },
  { id: '7', name: 'SUN', label: 'Sunday' },
]

const MONTHS = [
  { id: '1', name: 'jan', label: 'Jan' },
  { id: '2', name: 'feb', label: 'Feb' },
  { id: '3', name: 'mar', label: 'Mar' },
  { id: '4', name: 'apr', label: 'Apr' },
  { id: '5', name: 'may', label: 'May' },
  { id: '6', name: 'jun', label: 'Jun' },
  { id: '7', name: 'jul', label: 'Jul' },
  { id: '8', name: 'aug', label: 'Aug' },
  { id: '9', name: 'sep', label: 'Sep' },
  { id: '10', name: 'oct', label: 'Oct' },
  { id: '11', name: 'nov', label: 'Nov' },
  { id: '12', name: 'dec', label: 'Dec' },
]

// Zod Schema Validation
const shiftFormSchema = z.object({
  shift_name: z.string().min(1, 'Shift name is required'),
  shift_from: z.string().min(1, 'Shift start time is required'),
  shift_to: z.string().min(1, 'Shift end time is required'),
  shift_type: z.enum(['FIXED', 'WEEKLY', 'MONTHLY', 'DATEWISE']).default('FIXED'),
  status: z.string().default('active'),
  punch_in_type: z.string().default('anytime'),
  punch_out_type: z.string().default('anytime'),

  punch_in_hours_before: z.coerce.number().min(0).default(0),
  punch_in_minutes_before: z.coerce.number().min(0).default(0),
  punch_out_hours_after: z.coerce.number().min(0).default(0),
  punch_out_minutes_after: z.coerce.number().min(0).default(0),

  late_cutoff_hours: z.coerce.number().min(0).default(0),
  late_cutoff_minutes: z.coerce.number().min(0).default(0),
  early_cutoff_hours: z.coerce.number().min(0).default(0),
  early_cutoff_minutes: z.coerce.number().min(0).default(0),

  lates_counted_as_half_day: z.coerce.number().min(0).default(0),
  earlies_counted_as_half_day: z.coerce.number().min(0).default(0),
  lates_counted_as_absent: z.coerce.number().min(0).default(0),
  early_counted_as_absent: z.coerce.number().min(0).default(0),

  applicable_for_overnight: z.boolean().default(false),
  applicable_for_break: z.boolean().default(true),
  auto_punch_out: z.boolean().default(false),
  auto_punch_out_time: z.string().nullable().optional(),
  applicable_for_minimum_working_hours: z.boolean().default(false),

  shift_minimum_working_hours: z.coerce.number().min(0).default(0),
  shift_minimum_working_minutes: z.coerce.number().min(0).default(0),
  shift_minimum_present_hours: z.coerce.number().min(0).default(0),
  shift_minimum_present_minutes: z.coerce.number().min(0).default(0),

  applicable_day: z.array(z.union([z.string(), z.number()])).default([]),
  applicable_months: z.array(z.union([z.string(), z.number()])).default([]),
  applicable_date: z.array(z.union([z.string(), z.number()])).default([]),
}).refine(
  (data) => {
    if (data.shift_type === 'DATEWISE') {
      return Array.isArray(data.applicable_date) && data.applicable_date.length > 0
    }
    return true
  },
  {
    message: 'Please select at least one date for Datewise shift.',
    path: ['applicable_date'],
  }
)

type ShiftFormValues = z.infer<typeof shiftFormSchema>
type ActiveTab = 'basic' | 'cutoffs' | 'assignments'

function getCategorySubcategories(cat: any): { id: string; name: string }[] {
  if (!cat) return []
  const list =
    cat.subCategoryName ||
    cat.subcategories ||
    cat.sub_categories ||
    cat.sub_category ||
    cat.subcategory ||
    []
  if (!Array.isArray(list)) return []
  return list
    .map((item: any, idx: number) => {
      if (typeof item === 'string') {
        return { id: item, name: item }
      }
      const id = String(item.subcategory_id || item.sub_category_id || item.id || item._id || idx)
      const name = String(item.subcategory_name || item.sub_category_name || item.name || id)
      return { id, name }
    })
    .filter((s: any) => Boolean(s.id && s.name))
}

function SubcategoryMultiSelect({
  category,
  value,
  onChange,
}: {
  category: any
  value: string[]
  onChange: (val: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const subcategories = useMemo(() => getCategorySubcategories(category), [category])

  const filtered = useMemo(() => {
    if (!search.trim()) return subcategories
    return subcategories.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
  }, [subcategories, search])

  const toggleSub = (subId: string) => {
    if (value.includes(subId)) {
      onChange(value.filter((id) => id !== subId))
    } else {
      onChange([...value, subId])
    }
  }

  const toggleAll = () => {
    if (value.length === subcategories.length) {
      onChange([])
    } else {
      onChange(subcategories.map((s) => s.id))
    }
  }

  if (subcategories.length === 0) {
    return (
      <div className="flex h-9 items-center rounded-lg border border-dashed border-border px-3 text-xs text-muted-foreground bg-muted/10">
        No subcategories found in this category
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="flex flex-wrap items-center gap-1.5 min-h-9 p-1 rounded-lg border border-border bg-background">
        {/* Selected subcategory chips */}
        {value.map((subId) => {
          const subObj = subcategories.find((s) => s.id === subId)
          const name = subObj?.name || subId
          return (
            <span
              key={subId}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-medium border border-primary/20"
            >
              <span className="truncate max-w-[140px]">{name}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleSub(subId)
                }}
                className="size-3.5 rounded-full hover:bg-primary/20 inline-flex items-center justify-center cursor-pointer"
              >
                <X className="size-2.5" />
              </button>
            </span>
          )
        })}

        {/* Popover trigger button */}
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
          >
            <Plus className="size-3" />
            <span>{value.length === 0 ? 'Select subcategories…' : 'Add more…'}</span>
            <span className="ml-1 text-[10px] opacity-70">
              ({value.length}/{subcategories.length})
            </span>
          </button>
        </PopoverTrigger>
      </div>

      <PopoverContent align="start" className="w-64 p-2 z-50 text-foreground bg-card border-border shadow-xl">
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-foreground">Subcategories</span>
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={toggleAll}
              className="text-[11px] h-auto p-0"
            >
              {value.length === subcategories.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-2 size-3 text-muted-foreground" />
            <Input
              placeholder="Filter subcategories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7 h-7 text-xs"
            />
          </div>

          <div className="max-h-48 overflow-y-auto space-y-0.5 rounded-lg border border-border/60 p-1">
            {filtered.length === 0 ? (
              <div className="p-3 text-center text-xs text-muted-foreground">No matching subcategories</div>
            ) : (
              filtered.map((s) => {
                const isSelected = value.includes(s.id)
                return (
                  <label
                    key={s.id}
                    className={cn(
                      'flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-muted/50 cursor-pointer transition-colors',
                      isSelected && 'bg-primary/10 text-primary font-medium',
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSub(s.id)}
                      className="size-3.5 border-[#c4c8d1] data-[state=checked]:bg-[#2F63D8] data-[state=checked]:border-[#2F63D8]"
                    />
                    <span className="truncate flex-1">{s.name}</span>
                  </label>
                )
              })
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default function ShiftFormModal({
  open,
  onClose,
  shiftToEdit: propShiftToEdit,
  shift,
}: ShiftFormModalProps) {
  const shiftToEdit = propShiftToEdit || shift || null
  const createMutation = useCreateShiftMutation()
  const updateMutation = useUpdateShiftMutation()

  const { data: shiftDetails } = useShiftDetailsQuery(shiftToEdit?.shift_id)
  const { data: rawEmployees = [] } = useEmployeesQuery()
  const employees: Employee[] = React.useMemo(
    () =>
      rawEmployees.filter((e: Employee) => {
        const st = (e.status || '').toLowerCase()
        return st !== 'archived' && st !== 'suspended'
      }),
    [rawEmployees],
  )
  const { data: categories = [] } = useCategoriesQuery()

  const [activeTab, setActiveTab] = useState<ActiveTab>('basic')
  const [dateSelectionMode, setDateSelectionMode] = useState<'specific' | 'range'>('specific')
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({})
  // Assignments state
  const { geofences = [], loading: loadingGeofences } = useGeofencing()
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<{ category_id: string; sub_category_ids: string[] }[]>([])
  const [selectedGeofences, setSelectedGeofences] = useState<string[]>([])
  const [assignmentSubTab, setAssignmentSubTab] = useState<'employees' | 'categories' | 'geofences'>('employees')
  const [userSearch, setUserSearch] = useState('')
  const [geofenceSearch, setGeofenceSearch] = useState('')

  // React Hook Form initialization with Zod Schema
  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ShiftFormValues>({
    resolver: zodResolver(shiftFormSchema) as any,
    defaultValues: {
      shift_name: '',
      shift_from: '09:00',
      shift_to: '18:00',
      shift_type: 'FIXED',
      status: 'active',
      punch_in_type: 'anytime',
      punch_out_type: 'anytime',
      punch_in_hours_before: 0,
      punch_in_minutes_before: 0,
      punch_out_hours_after: 0,
      punch_out_minutes_after: 0,
      late_cutoff_hours: 0,
      late_cutoff_minutes: 0,
      early_cutoff_hours: 0,
      early_cutoff_minutes: 0,
      lates_counted_as_half_day: 0,
      earlies_counted_as_half_day: 0,
      lates_counted_as_absent: 0,
      early_counted_as_absent: 0,
      applicable_for_overnight: false,
      applicable_for_break: true,
      auto_punch_out: false,
      auto_punch_out_time: '18:30',
      applicable_for_minimum_working_hours: false,
      shift_minimum_working_hours: 0,
      shift_minimum_working_minutes: 0,
      shift_minimum_present_hours: 0,
      shift_minimum_present_minutes: 0,
      applicable_day: ['1', '2', '3', '4', '5'],
      applicable_months: [],
      applicable_date: [],
    },
  })

  // Watch dynamic fields
  const shiftType = watch('shift_type')
  const punchInType = watch('punch_in_type')
  const punchOutType = watch('punch_out_type')
  const autoPunchOut = watch('auto_punch_out')
  const applicableForMinWorkingHours = watch('applicable_for_minimum_working_hours')
  const applicableDay = watch('applicable_day')
  const applicableMonths = watch('applicable_months')
  const applicableDates = watch('applicable_date')

  useEffect(() => {
    const s = shiftDetails?.shift || shiftToEdit
    if (s) {
      const inType = (s.punch_in_type as any) === 'limit' || (s.punch_in_hours_before || 0) > 0 || (s.punch_in_minutes_before || 0) > 0 ? 'limit' : 'anytime'
      const outType = (s.punch_out_type as any) === 'limit' || (s.punch_out_hours_after || 0) > 0 || (s.punch_out_minutes_after || 0) > 0 ? 'limit' : 'anytime'

      reset({
        shift_name: s.shift_name || '',
        shift_from: s.shift_from?.substring(0, 5) || '09:00',
        shift_to: s.shift_to?.substring(0, 5) || '18:00',
        shift_type: s.shift_type || 'FIXED',
        status: (s.status as 'active' | 'inactive') || 'active',
        punch_in_type: inType,
        punch_out_type: outType,
        punch_in_hours_before: s.punch_in_hours_before || 0,
        punch_in_minutes_before: s.punch_in_minutes_before || 0,
        punch_out_hours_after: s.punch_out_hours_after || 0,
        punch_out_minutes_after: s.punch_out_minutes_after || 0,
        late_cutoff_hours: s.late_cutoff_hours || 0,
        late_cutoff_minutes: s.late_cutoff_minutes || 0,
        early_cutoff_hours: s.early_cutoff_hours || 0,
        early_cutoff_minutes: s.early_cutoff_minutes || 0,
        lates_counted_as_half_day: s.lates_counted_as_half_day || 0,
        earlies_counted_as_half_day: s.earlies_counted_as_half_day || 0,
        lates_counted_as_absent: s.lates_counted_as_absent || 0,
        early_counted_as_absent: s.early_counted_as_absent || 0,
        applicable_for_overnight: !!s.applicable_for_overnight,
        applicable_for_break: s.applicable_for_break !== false,
        auto_punch_out: !!s.auto_punch_out,
        auto_punch_out_time: s.auto_punch_out_time?.substring(0, 5) || '18:30',
        applicable_for_minimum_working_hours: !!s.applicable_for_minimum_working_hours,
        shift_minimum_working_hours: s.shift_minimum_working_hours || 0,
        shift_minimum_working_minutes: s.shift_minimum_working_minutes || 0,
        shift_minimum_present_hours: s.shift_minimum_present_hours || 0,
        shift_minimum_present_minutes: s.shift_minimum_present_minutes || 0,
        applicable_day: s.applicable_day || [],
        applicable_months: s.applicable_months || [],
        applicable_date: s.applicable_date || [],
      })

      let userIds: string[] = []
      const rawUsers =
        (shiftDetails as any)?.applicable_user ??
        (shiftDetails as any)?.applicable_users ??
        (shiftDetails as any)?.users ??
        s.applicable_user ??
        (s as any)?.applicable_users ??
        (s as any)?.users

      if (Array.isArray(rawUsers)) {
        userIds = rawUsers
          .map((u: any) => (typeof u === 'string' ? u : u.user_id || u.id || u.ufid || ''))
          .filter(Boolean)
      } else if (typeof rawUsers === 'string' && rawUsers.trim()) {
        userIds = [rawUsers.trim()]
      }
      setSelectedUsers(userIds)


      let geoFenceIds: string[] = []
      if (Array.isArray(s.geo_fence_id)) {
        geoFenceIds = s.geo_fence_id
          .map((g: any) => (typeof g === 'string' ? g : g.geo_fence_id || g.id || ''))
          .filter(Boolean)
      } else if (typeof (s as any).geo_fence_id === 'string') {
        geoFenceIds = [(s as any).geo_fence_id]
      }
      setSelectedGeofences(geoFenceIds)

      if (s.applicable_categories_for && s.applicable_categories_for.length > 0) {
        const mapped: { category_id: string; sub_category_ids: string[] }[] = []
        s.applicable_categories_for.forEach((catGroup: any) => {
          const cId = Array.isArray(catGroup.category_id)
            ? catGroup.category_id[0] || ''
            : String(catGroup.category_id || '')
          const sIds = Array.isArray(catGroup.sub_category_ids)
            ? catGroup.sub_category_ids
            : Array.isArray(catGroup.sub_category_id)
              ? catGroup.sub_category_id
              : []
          if (cId) {
            mapped.push({ category_id: cId, sub_category_ids: [...sIds] })
          }
        })
        setSelectedCategories(mapped)
      } else {
        setSelectedCategories([])
      }
    } else {
      reset({
        shift_name: '',
        shift_from: '09:00',
        shift_to: '18:00',
        shift_type: 'FIXED',
        status: 'active',
        punch_in_type: 'anytime',
        punch_out_type: 'anytime',
        punch_in_hours_before: 0,
        punch_in_minutes_before: 0,
        punch_out_hours_after: 0,
        punch_out_minutes_after: 0,
        late_cutoff_hours: 0,
        late_cutoff_minutes: 0,
        early_cutoff_hours: 0,
        early_cutoff_minutes: 0,
        lates_counted_as_half_day: 0,
        earlies_counted_as_half_day: 0,
        lates_counted_as_absent: 0,
        early_counted_as_absent: 0,
        applicable_for_overnight: false,
        applicable_for_break: true,
        auto_punch_out: false,
        auto_punch_out_time: '18:30',
        applicable_for_minimum_working_hours: false,
        shift_minimum_working_hours: 0,
        shift_minimum_working_minutes: 0,
        shift_minimum_present_hours: 0,
        shift_minimum_present_minutes: 0,
        applicable_day: ['1', '2', '3', '4', '5'],
        applicable_months: [],
        applicable_date: [],
      })
      setSelectedUsers([])
      setSelectedCategories([])
      setSelectedGeofences([])
    }
    setActiveTab('basic')
  }, [shiftToEdit, shiftDetails, open, reset])

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  const toggleDay = (day: { id: string; name: string }) => {
    const current = applicableDay || []
    const exists = current.includes(day.id) || current.includes(day.name)
    const next = exists ? current.filter((d) => d !== day.id && d !== day.name) : [...current, day.id]
    setValue('applicable_day', next)
  }

  const toggleMonth = (m: { id: string; name: string }) => {
    const current = applicableMonths || []
    const exists = current.includes(m.id) || current.includes(m.name)
    const next = exists ? current.filter((val) => val !== m.id && val !== m.name) : [...current, m.id]
    setValue('applicable_months', next)
  }

  const removeDate = (d: string | number) => {
    const current = applicableDates || []
    const updated = current.filter((date) => String(date) !== String(d))
    setValue('applicable_date', updated as any, { shouldValidate: true, shouldDirty: true })
    setDateRange({})
  }

  const toggleUser = (emp: any) => {
    const candidateIds = [
      String(emp.id || '').trim(),
      String(emp.user_id || '').trim(),
      String(emp.rawUser?.user_id || '').trim(),
      String(emp.rawUser?.ufid || '').trim(),
    ].filter(Boolean)

    setSelectedUsers((prev) => {
      const isAlreadySelected = prev.some((su) => candidateIds.includes(String(su).trim()))
      if (isAlreadySelected) {
        return prev.filter((su) => !candidateIds.includes(String(su).trim()))
      } else {
        const canonicalId = String(emp.id || emp.user_id || emp.rawUser?.user_id || '').trim()
        return [...prev, canonicalId]
      }
    })
  }

  const toggleAllUsers = () => {
    if (selectedUsers.length >= employees.length) {
      setSelectedUsers([])
    } else {
      setSelectedUsers(
        employees.map((e) => String(e.id || e.user_id || e.rawUser?.user_id || '').trim()).filter(Boolean),
      )
    }
  }


  const toggleGeofence = (geofenceId: string) => {
    setSelectedGeofences((prev) =>
      prev.includes(geofenceId) ? prev.filter((id) => id !== geofenceId) : [...prev, geofenceId]
    )
  }

  const toggleAllGeofences = () => {
    const allValidIds = geofences.map((g) => g.geo_fence_id || g.id || '').filter(Boolean)
    if (selectedGeofences.length === allValidIds.length) {
      setSelectedGeofences([])
    } else {
      setSelectedGeofences(allValidIds)
    }
  }

  const handleCategoryChange = (index: number, catId: string) => {
    const next = [...selectedCategories]
    next[index].category_id = catId
    next[index].sub_category_ids = []
    setSelectedCategories(next)
  }

  const handleSubcategoriesChange = (index: number, subIds: string[]) => {
    const next = [...selectedCategories]
    next[index].sub_category_ids = subIds
    setSelectedCategories(next)
  }

  const addCategoryRow = () => {
    const firstCat = categories[0]?.category_id || (categories[0] as any)?.id || ''
    setSelectedCategories([...selectedCategories, { category_id: firstCat, sub_category_ids: [] }])
  }

  const removeCategoryRow = (index: number) => {
    setSelectedCategories(selectedCategories.filter((_, i) => i !== index))
  }

  const onInvalid = (fieldErrors: any) => {
    console.warn('Shift form validation errors:', fieldErrors)
    const errorKeys = Object.keys(fieldErrors)
    if (errorKeys.length > 0) {
      const firstKey = errorKeys[0]
      const msg = fieldErrors[firstKey]?.message || `Please check ${firstKey}`
      toast.error(msg)
      if (
        [
          'shift_name',
          'shift_from',
          'shift_to',
          'shift_type',
          'applicable_date',
          'applicable_day',
          'applicable_months',
        ].includes(firstKey)
      ) {
        setActiveTab('basic')
      } else if (
        firstKey.includes('cutoff') ||
        firstKey.includes('lates') ||
        firstKey.includes('early') ||
        firstKey.includes('shift_minimum')
      ) {
        setActiveTab('cutoffs')
      }
    }
  }

  const onSubmit = async (values: ShiftFormValues) => {
    try {
      if (values.shift_type === 'DATEWISE' && (!values.applicable_date || values.applicable_date.length === 0)) {
        toast.error('Please select at least one date for Datewise shift.')
        setActiveTab('basic')
        return
      }
      let catPayload: any[] = []
      if (selectedCategories.length > 0) {
        const valid = selectedCategories.filter((c) => c.category_id && c.sub_category_ids && c.sub_category_ids.length > 0)
        if (valid.length > 0) {
          catPayload = valid.map((c) => ({
            category_id: c.category_id,
            sub_category_ids: c.sub_category_ids,
            sub_category_id: c.sub_category_ids,
          }))
        }
      }

      const formatTime = (t: string | undefined | null) => {
        if (!t) return t
        return t.length === 5 ? `${t}:00` : t
      }

      const basePayload: CreateShiftRequest = {
        shift_name: values.shift_name,
        shift_from: formatTime(values.shift_from) || '09:00:00',
        shift_to: formatTime(values.shift_to) || '18:00:00',
        status: values.status,
        punch_in_type: values.punch_in_type,
        punch_out_type: values.punch_out_type,
        auto_punch_out: values.auto_punch_out,
        auto_punch_out_time: values.auto_punch_out && values.auto_punch_out_time ? formatTime(values.auto_punch_out_time) : null,
        applicable_for_minimum_working_hours: values.applicable_for_minimum_working_hours,
        applicable_for_break: values.applicable_for_break,
        applicable_for_overnight: values.applicable_for_overnight,
        shift_type: values.shift_type,
        punch_in_hours_before: values.punch_in_type === 'limit' ? Number(values.punch_in_hours_before) || 0 : 0,
        punch_in_minutes_before: values.punch_in_type === 'limit' ? Number(values.punch_in_minutes_before) || 0 : 0,
        punch_out_hours_after: values.punch_out_type === 'limit' ? Number(values.punch_out_hours_after) || 0 : 0,
        punch_out_minutes_after: values.punch_out_type === 'limit' ? Number(values.punch_out_minutes_after) || 0 : 0,
        late_cutoff_hours: Number(values.late_cutoff_hours) || 0,
        late_cutoff_minutes: Number(values.late_cutoff_minutes) || 0,
        early_cutoff_hours: Number(values.early_cutoff_hours) || 0,
        early_cutoff_minutes: Number(values.early_cutoff_minutes) || 0,
        lates_counted_as_half_day: Number(values.lates_counted_as_half_day) || 0,
        earlies_counted_as_half_day: Number(values.earlies_counted_as_half_day) || 0,
        lates_counted_as_absent: Number(values.lates_counted_as_absent) || 0,
        early_counted_as_absent: Number(values.early_counted_as_absent) || 0,
        shift_minimum_working_hours: values.applicable_for_minimum_working_hours ? Number(values.shift_minimum_working_hours) || 0 : 0,
        shift_minimum_working_minutes: values.applicable_for_minimum_working_hours ? Number(values.shift_minimum_working_minutes) || 0 : 0,
        shift_minimum_present_hours: values.applicable_for_minimum_working_hours ? Number(values.shift_minimum_present_hours) || 0 : 0,
        shift_minimum_present_minutes: values.applicable_for_minimum_working_hours ? Number(values.shift_minimum_present_minutes) || 0 : 0,
        ...(values.shift_type === 'WEEKLY' && { applicable_day: (values.applicable_day || []).map(String) }),
        ...(values.shift_type === 'MONTHLY' && { applicable_months: (values.applicable_months || []).map(String) }),
        ...(values.shift_type === 'DATEWISE' && { applicable_date: (values.applicable_date || []).map(String) }),
        ...(catPayload.length > 0 && { applicable_categories_for: catPayload }),
        ...(selectedUsers.length > 0 && { applicable_user: selectedUsers }),
        geo_fence_id: selectedGeofences,
      }

      if (shiftToEdit) {
        const updateData: UpdateShiftRequest = {
          shift_id: shiftToEdit.shift_id,
          ...basePayload,
        }
        await updateMutation.mutateAsync(updateData)
      } else {
        await createMutation.mutateAsync(basePayload)
      }

      onClose()
    } catch (err: any) {
      console.error('Error saving shift:', err)
    }
  }

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      (emp.department && emp.department.toLowerCase().includes(userSearch.toLowerCase())) ||
      (emp.phone && emp.phone.includes(userSearch)),
  )

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl w-full max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-background text-foreground border-border">
        {/* Fixed Header */}
        <DialogHeader className="p-6 border-b border-border bg-muted/20 shrink-0">
          <DialogTitle className="text-lg font-semibold text-foreground">
            {shiftToEdit ? 'Edit Shift Configuration' : 'Add New Shift'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure shift details, punch limits, cutoffs, and employee assignments.
          </DialogDescription>
        </DialogHeader>

        {/* Fixed Navigation Tabs */}
        <div className="flex border-b border-border bg-muted/10 px-6 shrink-0">
          <Button
            variant="ghost"
            onClick={() => setActiveTab('basic')}
            className={cn(
              'rounded-none border-b-2 px-5 py-3 h-auto text-xs font-semibold hover:bg-transparent',
              activeTab === 'basic'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Clock className="size-3.5 mr-2" />
            General & Timings
          </Button>
          <Button
            variant="ghost"
            onClick={() => setActiveTab('cutoffs')}
            className={cn(
              'rounded-none border-b-2 px-5 py-3 h-auto text-xs font-semibold hover:bg-transparent',
              activeTab === 'cutoffs'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Sliders className="size-3.5 mr-2" />
            Cut Offs & Penalties
          </Button>
          <Button
            variant="ghost"
            onClick={() => setActiveTab('assignments')}
            className={cn(
              'rounded-none border-b-2 px-5 py-3 h-auto text-xs font-semibold hover:bg-transparent',
              activeTab === 'assignments'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Users className="size-3.5 mr-2" />
            Assignments
          </Button>
        </div>

        {/* Form Container with Fixed Footer */}
        <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="flex flex-1 flex-col min-h-0 overflow-hidden">
          {/* Scrollable Form Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {activeTab === 'basic' && (
              <div className="space-y-5">
                {/* Shift Name */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Shift Name <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    placeholder="Enter Shift Name"
                    {...register('shift_name')}
                    className="text-xs"
                  />
                  {errors.shift_name && (
                    <p className="text-[11px] font-medium text-rose-500">{errors.shift_name.message}</p>
                  )}
                </div>

                {/* Shift Type Selection */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-foreground">Shift Type</Label>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { type: 'FIXED', label: 'Fixed Daily', icon: Clock },
                      { type: 'WEEKLY', label: 'Weekly', icon: CalendarDays },
                      { type: 'MONTHLY', label: 'Monthly', icon: CalendarRange },
                      { type: 'DATEWISE', label: 'Datewise', icon: CalendarDays },
                    ].map((item) => {
                      const Icon = item.icon
                      const isSelected = shiftType === item.type
                      return (
                        <button
                          key={item.type}
                          type="button"
                          onClick={() => setValue('shift_type', item.type as ShiftType)}
                          className={cn(
                            'flex items-center gap-2 rounded-xl border p-2.5 text-left transition-all',
                            isSelected
                              ? 'border-primary bg-primary/10 text-primary shadow-xs font-semibold'
                              : 'border-border bg-card hover:bg-muted/50 text-muted-foreground',
                          )}
                        >
                          <Icon className={cn('size-4', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                          <span className="text-xs">{item.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Dynamic Schedule Selection based on Shift Type */}
                {shiftType === 'WEEKLY' && (
                  <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
                    <Label className="text-xs font-semibold text-foreground">Applicable Days of Week</Label>
                    <div className="flex flex-wrap gap-2">
                      {WEEKDAYS.map((day) => {
                        const active = (applicableDay || []).includes(day.id) || (applicableDay || []).includes(day.name)
                        return (
                          <Button
                            key={day.id}
                            type="button"
                            variant={active ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => toggleDay(day)}
                            className="text-xs h-8"
                          >
                            {day.label}
                          </Button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {shiftType === 'MONTHLY' && (
                  <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
                    <Label className="text-xs font-semibold text-foreground">Applicable Months</Label>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                      {MONTHS.map((m) => {
                        const active = (applicableMonths || []).includes(m.id) || (applicableMonths || []).includes(m.name)
                        return (
                          <Button
                            key={m.id}
                            type="button"
                            variant={active ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => toggleMonth(m)}
                            className="text-xs h-8"
                          >
                            {m.label}
                          </Button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {shiftType === 'DATEWISE' && (
                  <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-xs animate-in fade-in duration-200">
                    {/* Header with Mode Switcher */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
                      <div>
                        <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <CalendarIcon className="size-4 text-primary" />
                          Select Shift Dates
                        </Label>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Choose mode to pick individual dates or a date range on the calendar.
                        </p>
                      </div>

                      {/* Mode Toggles: Specific Dates vs Date Range */}
                      <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setDateSelectionMode('specific')
                            setDateRange({})
                          }}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                            dateSelectionMode === 'specific'
                              ? 'bg-background text-primary shadow-2xs font-semibold'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          <CalendarDays className="size-3.5" />
                          Specific Dates
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDateSelectionMode('range')
                            setDateRange({})
                          }}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                            dateSelectionMode === 'range'
                              ? 'bg-background text-primary shadow-2xs font-semibold'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          <CalendarRange className="size-3.5" />
                          Date Range
                        </button>
                      </div>
                    </div>

                    {/* Side-by-Side Body: Calendar on Left, Selected Dates on Right */}
                    <div className="flex flex-col md:flex-row gap-5 items-start bg-muted/20 p-4 rounded-xl border border-border">
                      {/* Left Side: Shadcn Calendar Component */}
                      <div className="border border-border rounded-xl bg-background p-2 shadow-2xs shrink-0 mx-auto md:mx-0">
                        {dateSelectionMode === 'specific' ? (
                          <Calendar
                            mode="multiple"
                            selected={(applicableDates || []).map((d) => {
                              const [yr, mo, dy] = String(d).split('-').map(Number)
                              return new Date(yr, mo - 1, dy)
                            })}
                            onSelect={(dates) => {
                              const dateStrs = (dates || [])
                                .map((d) => {
                                  if (!d) return ''
                                  const year = d.getFullYear()
                                  const month = String(d.getMonth() + 1).padStart(2, '0')
                                  const day = String(d.getDate()).padStart(2, '0')
                                  return `${year}-${month}-${day}`
                                })
                                .filter(Boolean)
                              setValue('applicable_date', Array.from(new Set(dateStrs)), { shouldValidate: true, shouldDirty: true })
                            }}
                            className="rounded-md border-0"
                          />
                        ) : (
                          <Calendar
                            mode="range"
                            selected={
                              dateRange.from || dateRange.to
                                ? (dateRange as any)
                                : (applicableDates || []).length > 0
                                  ? {
                                    from: (() => {
                                      const [yr, mo, dy] = String(applicableDates[0]).split('-').map(Number)
                                      return new Date(yr, mo - 1, dy)
                                    })(),
                                    to: (() => {
                                      const [yr, mo, dy] = String(applicableDates[applicableDates.length - 1]).split('-').map(Number)
                                      return new Date(yr, mo - 1, dy)
                                    })(),
                                  }
                                  : undefined
                            }
                            onSelect={(range: any) => {
                              setDateRange(range || {})
                              if (range?.from && range?.to) {
                                const list: string[] = []
                                let curr = new Date(range.from)
                                const end = new Date(range.to)
                                while (curr <= end) {
                                  const year = curr.getFullYear()
                                  const month = String(curr.getMonth() + 1).padStart(2, '0')
                                  const day = String(curr.getDate()).padStart(2, '0')
                                  list.push(`${year}-${month}-${day}`)
                                  curr.setDate(curr.getDate() + 1)
                                }
                                setValue('applicable_date', list, { shouldValidate: true, shouldDirty: true })
                              } else if (range?.from) {
                                const d = range.from
                                const year = d.getFullYear()
                                const month = String(d.getMonth() + 1).padStart(2, '0')
                                const day = String(d.getDate()).padStart(2, '0')
                                setValue('applicable_date', [`${year}-${month}-${day}`], { shouldValidate: true, shouldDirty: true })
                              } else {
                                setValue('applicable_date', [], { shouldValidate: true, shouldDirty: true })
                              }
                            }}
                            className="rounded-md border-0"
                          />
                        )}
                      </div>

                      {/* Right Side: Selected Dates Display Panel */}
                      <div className="flex-1 space-y-3 w-full">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold text-foreground flex items-center gap-2">
                            <span>Selected Dates</span>
                            <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-bold">
                              {(applicableDates || []).length}
                            </span>
                          </Label>
                          {(applicableDates || []).length > 0 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setValue('applicable_date', [])
                                setDateRange({})
                              }}
                              className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 h-6 px-2"
                            >
                              Clear All
                            </Button>
                          )}
                        </div>

                        {(applicableDates || []).length === 0 ? (
                          <div className="p-4 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl bg-background/50">
                            {dateSelectionMode === 'specific'
                              ? 'No dates selected. Click dates on the calendar to select.'
                              : 'No date range selected. Click start and end dates on the calendar.'}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 max-h-64 overflow-y-auto p-2.5 border border-border rounded-xl bg-background">
                            {(applicableDates || []).map((d) => (
                              <span
                                key={d}
                                className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 text-xs font-medium animate-in fade-in"
                              >
                                <CalendarIcon className="size-3 text-primary" />
                                {d}
                                <button
                                  type="button"
                                  onClick={() => removeDate(d)}
                                  className="text-primary/70 hover:text-rose-600 transition-colors ml-0.5"
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                        {errors.applicable_date && (
                          <p className="text-xs font-medium text-rose-500 pt-1">
                            {errors.applicable_date.message}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Start Time & Punch In */}
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground">
                        Shift Start Time <span className="text-rose-500">*</span>
                      </Label>
                      <Controller
                        name="shift_from"
                        control={control}
                        render={({ field }) => (
                          <TimePicker value={field.value} onChange={field.onChange} />
                        )}
                      />
                      {errors.shift_from && (
                        <p className="text-[11px] font-medium text-rose-500">{errors.shift_from.message}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground">Can Punch In</Label>
                      <div className="flex gap-4 pt-2">
                        <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                          <input
                            type="radio"
                            value="anytime"
                            {...register('punch_in_type')}
                            className="accent-primary"
                          />
                          Anytime
                        </label>
                        <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                          <input
                            type="radio"
                            value="limit"
                            {...register('punch_in_type')}
                            className="accent-primary"
                          />
                          Add Limit
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Conditional Punch In Limit Inputs */}
                  {punchInType === 'limit' && (
                    <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2 animate-in fade-in duration-150">
                      <Label className="text-xs font-semibold text-foreground block">
                        Allow Punch In Before Shift Start Time :
                      </Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-[11px] text-muted-foreground block mb-1">Hours</Label>
                          <Input
                            type="number"
                            min="0"
                            placeholder="Hours"
                            {...register('punch_in_hours_before')}
                            className="text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-[11px] text-muted-foreground block mb-1">Minutes</Label>
                          <Input
                            type="number"
                            min="0"
                            placeholder="Minutes"
                            {...register('punch_in_minutes_before')}
                            className="text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* End Time & Punch Out */}
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground">
                        Shift End Time <span className="text-rose-500">*</span>
                      </Label>
                      <Controller
                        name="shift_to"
                        control={control}
                        render={({ field }) => (
                          <TimePicker value={field.value} onChange={field.onChange} />
                        )}
                      />
                      {errors.shift_to && (
                        <p className="text-[11px] font-medium text-rose-500">{errors.shift_to.message}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground">Can Punch Out</Label>
                      <div className="flex gap-4 pt-2">
                        <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                          <input
                            type="radio"
                            value="anytime"
                            {...register('punch_out_type')}
                            className="accent-primary"
                          />
                          Anytime
                        </label>
                        <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                          <input
                            type="radio"
                            value="limit"
                            {...register('punch_out_type')}
                            className="accent-primary"
                          />
                          Add Limit
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Conditional Punch Out Limit Inputs */}
                  {punchOutType === 'limit' && (
                    <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2 animate-in fade-in duration-150">
                      <Label className="text-xs font-semibold text-foreground block">
                        Allow Punch Out After Shift End Time :
                      </Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-[11px] text-muted-foreground block mb-1">Hours</Label>
                          <Input
                            type="number"
                            min="0"
                            placeholder="Hours"
                            {...register('punch_out_hours_after')}
                            className="text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-[11px] text-muted-foreground block mb-1">Minutes</Label>
                          <Input
                            type="number"
                            min="0"
                            placeholder="Minutes"
                            {...register('punch_out_minutes_after')}
                            className="text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Toggles using Shadcn Switch component */}
                <div className="space-y-4 pt-2 border-t border-border/50">
                  <div className="flex items-center justify-between py-1">
                    <Label htmlFor="applicableForOvernight" className="text-xs font-semibold text-foreground cursor-pointer">
                      Applicable for Overnight
                    </Label>
                    <Controller
                      name="applicable_for_overnight"
                      control={control}
                      render={({ field }) => (
                        <Switch
                          id="applicableForOvernight"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <Label htmlFor="applicableForBreak" className="text-xs font-semibold text-foreground cursor-pointer">
                      Applicable for Break
                    </Label>
                    <Controller
                      name="applicable_for_break"
                      control={control}
                      render={({ field }) => (
                        <Switch
                          id="applicableForBreak"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between py-1">
                      <Label htmlFor="autoPunchOut" className="text-xs font-semibold text-foreground cursor-pointer">
                        Auto Punch Out
                      </Label>
                      <Controller
                        name="auto_punch_out"
                        control={control}
                        render={({ field }) => (
                          <Switch
                            id="autoPunchOut"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        )}
                      />
                    </div>

                    {/* Auto Punch Out Time Picker */}
                    {autoPunchOut && (
                      <div className="pl-2 space-y-1.5 animate-in fade-in duration-150 max-w-xs">
                        <Label className="text-xs font-semibold text-foreground">Auto Punch Out Time</Label>
                        <Controller
                          name="auto_punch_out_time"
                          control={control}
                          render={({ field }) => (
                            <TimePicker value={field.value || '18:30'} onChange={field.onChange} />
                          )}
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-1">
                      <Label htmlFor="applicableForMinWorkingHours" className="text-xs font-semibold text-foreground cursor-pointer">
                        Minimum working hour
                      </Label>
                      <Controller
                        name="applicable_for_minimum_working_hours"
                        control={control}
                        render={({ field }) => (
                          <Switch
                            id="applicableForMinWorkingHours"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        )}
                      />
                    </div>

                    {/* Minimum Shift Duration & Minimum Present Duration */}
                    {applicableForMinWorkingHours && (
                      <div className="pl-2 space-y-3 animate-in fade-in duration-150">
                        {/* Minimum Shift Duration (Full Day) */}
                        <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-1.5">
                          <Label className="text-xs font-semibold text-foreground">
                            Minimum Shift Duration (Full Day)
                          </Label>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-[11px] text-muted-foreground block mb-1">Hours</Label>
                              <Input
                                type="number"
                                min="0"
                                placeholder="Hours"
                                {...register('shift_minimum_working_hours')}
                                className="text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-[11px] text-muted-foreground block mb-1">Minutes</Label>
                              <Input
                                type="number"
                                min="0"
                                placeholder="Minutes"
                                {...register('shift_minimum_working_minutes')}
                                className="text-xs"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Minimum Present Duration (Half Day) */}
                        <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-1.5">
                          <Label className="text-xs font-semibold text-foreground">
                            Minimum Present Duration (Half Day)
                          </Label>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-[11px] text-muted-foreground block mb-1">Hours</Label>
                              <Input
                                type="number"
                                min="0"
                                placeholder="Hours"
                                {...register('shift_minimum_present_hours')}
                                className="text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-[11px] text-muted-foreground block mb-1">Minutes</Label>
                              <Input
                                type="number"
                                min="0"
                                placeholder="Minutes"
                                {...register('shift_minimum_present_minutes')}
                                className="text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'cutoffs' && (
              <div className="space-y-4">
                {/* Late Cut Off Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-foreground">Late Cut Off (Hours)</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="Hours"
                      {...register('late_cutoff_hours')}
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-foreground">Late Cut Off (Minutes)</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="Minutes"
                      {...register('late_cutoff_minutes')}
                      className="text-xs"
                    />
                  </div>
                </div>

                {/* Early Cut Off Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-foreground">Early Cut Off (Hours)</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="Hours"
                      {...register('early_cutoff_hours')}
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-foreground">Early Cut Off (Minutes)</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="Minutes"
                      {...register('early_cutoff_minutes')}
                      className="text-xs"
                    />
                  </div>
                </div>

                {/* Half Day & Absent Thresholds */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">
                    Number of Lates Counted as Half Day
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="Enter 0 to disable this feature"
                    {...register('lates_counted_as_half_day')}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">
                    Number of Early Departures Counted as Half Day
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="Enter 0 to disable this feature"
                    {...register('earlies_counted_as_half_day')}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">
                    Number of Lates Counted as Absent
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="Enter 0 to disable this feature"
                    {...register('lates_counted_as_absent')}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">
                    Number of Early Departures Counted as Absent
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="Enter 0 to disable this feature"
                    {...register('early_counted_as_absent')}
                    className="text-xs"
                  />
                </div>
              </div>
            )}

            {activeTab === 'assignments' && (
              <div className="space-y-4">
                {/* Segmented Sub-navigation Tabs */}
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/40 border border-border">
                  <button
                    type="button"
                    onClick={() => setAssignmentSubTab('employees')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none',
                      assignmentSubTab === 'employees'
                        ? 'bg-card text-foreground shadow-xs border border-border'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
                    )}
                  >
                    <Users className="size-3.5" />
                    <span>Employees</span>
                    {selectedUsers.length > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                        {selectedUsers.length}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setAssignmentSubTab('categories')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none',
                      assignmentSubTab === 'categories'
                        ? 'bg-card text-foreground shadow-xs border border-border'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
                    )}
                  >
                    <Layers className="size-3.5" />
                    <span>Categories</span>
                    {selectedCategories.length > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                        {selectedCategories.length}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setAssignmentSubTab('geofences')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none',
                      assignmentSubTab === 'geofences'
                        ? 'bg-card text-foreground shadow-xs border border-border'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
                    )}
                  >
                    <MapPin className="size-3.5 text-rose-500" />
                    <span>Geo Fences</span>
                    {selectedGeofences.length > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                        {selectedGeofences.length}
                      </span>
                    )}
                  </button>
                </div>

                {/* SubTab 1: Individual Employees */}
                {assignmentSubTab === 'employees' && (
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Users className="size-3.5 text-primary" />
                          Target Employees ({selectedUsers.length} selected)
                        </h3>
                        <p className="text-[11px] text-muted-foreground">Select individual employees to assign to this shift</p>
                      </div>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={toggleAllUsers}
                        className="text-xs h-auto p-0"
                      >
                        {selectedUsers.length === employees.length ? 'Deselect All' : 'Select All'}
                      </Button>
                    </div>

                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search employees by name, phone or department..."
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="pl-8 text-xs"
                      />
                    </div>

                    <div className="max-h-60 overflow-y-auto rounded-xl border border-border divide-y divide-border bg-card">
                      {filteredEmployees.length === 0 ? (
                        <div className="p-6 text-center text-xs text-muted-foreground">No employees found.</div>
                      ) : (
                        filteredEmployees.map((emp) => {
                          const isSelected = selectedUsers.some((su) => {
                            const suStr = String(su).trim()
                            const empId = String(emp.id || '').trim()
                            const empUserId = String(emp.user_id || emp.rawUser?.user_id || '').trim()
                            const empUfid = String(emp.rawUser?.ufid || '').trim()
                            return (empId && suStr === empId) || (empUserId && suStr === empUserId) || (empUfid && suStr === empUfid)
                          })
                          return (
                            <label
                              key={emp.id}
                              className={cn(
                                'flex items-center justify-between px-3.5 py-2.5 text-xs hover:bg-muted/40 cursor-pointer transition-colors',
                                isSelected && 'bg-primary/5',
                              )}
                            >
                              <div className="flex items-center gap-2.5">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleUser(emp)}
                                  className="border-[#c4c8d1] data-[state=checked]:bg-[#2F63D8] data-[state=checked]:border-[#2F63D8]"
                                />
                                <div>
                                  <span className="font-semibold text-foreground">{emp.name}</span>
                                  {emp.department && (
                                    <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                      {emp.department}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className="text-[11px] font-mono text-muted-foreground">{emp.phone || emp.empCode || (emp as any).employeeCode}</span>
                            </label>
                          )
                        })

                      )}
                    </div>
                  </div>
                )}

                {/* SubTab 2: Category & Subcategory Assignment */}
                {assignmentSubTab === 'categories' && (
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Layers className="size-3.5 text-primary" />
                          Category & Subcategory Rules ({selectedCategories.length} rules)
                        </h3>
                        <p className="text-[11px] text-muted-foreground">Automatically assign this shift to employees belonging to selected categories</p>
                      </div>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={addCategoryRow}
                        className="text-xs h-auto p-0 gap-1"
                      >
                        <Plus className="size-3" /> Add Category Rule
                      </Button>
                    </div>

                    {selectedCategories.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground space-y-2">
                        <Layers className="size-6 text-muted-foreground mx-auto opacity-50" />
                        <p>No category rules defined for this shift.</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addCategoryRow}
                          className="text-xs gap-1"
                        >
                          <Plus className="size-3" /> Add First Rule
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedCategories.map((item, idx) => (
                          <div key={idx} className="flex items-start gap-2 rounded-xl border border-border p-3 bg-card shadow-xs">
                            <Select
                              value={item.category_id}
                              onValueChange={(val) => handleCategoryChange(idx, val)}
                            >
                              <SelectTrigger className="w-48 shrink-0 text-xs h-9">
                                <SelectValue placeholder="Select Category" />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map((c) => (
                                  <SelectItem key={(c as any).id || c.category_id} value={(c as any).id || c.category_id}>
                                    {(c as any).name || c.category_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <div className="flex-1 min-w-0">
                              <SubcategoryMultiSelect
                                category={categories.find(
                                  (c) => (c.category_id || (c as any).id) === item.category_id,
                                )}
                                value={item.sub_category_ids}
                                onChange={(val) => handleSubcategoriesChange(idx, val)}
                              />
                            </div>

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeCategoryRow(idx)}
                              className="size-9 shrink-0 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                              title="Delete category rule"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* SubTab 3: Geo Fence Assignment List */}
                {assignmentSubTab === 'geofences' && (
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <MapPin className="size-3.5 text-rose-500" />
                          Applicable Geo Fences ({selectedGeofences.length} selected)
                        </h3>
                        <p className="text-[11px] text-muted-foreground">
                          Shift is active and allows punch-in within these selected office/site geofences
                        </p>
                      </div>
                      {geofences.length > 0 && (
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          onClick={toggleAllGeofences}
                          className="text-xs h-auto p-0"
                        >
                          {selectedGeofences.length === geofences.length ? 'Deselect All' : 'Select All'}
                        </Button>
                      )}
                    </div>

                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search geofences by name or address..."
                        value={geofenceSearch}
                        onChange={(e) => setGeofenceSearch(e.target.value)}
                        className="pl-8 text-xs"
                      />
                    </div>

                    <div className="max-h-60 overflow-y-auto rounded-xl border border-border divide-y divide-border bg-card">
                      {loadingGeofences ? (
                        <div className="p-6 text-center text-xs text-muted-foreground">Loading geofences…</div>
                      ) : geofences.length === 0 ? (
                        <div className="p-6 text-center text-xs text-muted-foreground space-y-1">
                          <MapPin className="size-6 text-muted-foreground mx-auto opacity-50 mb-1" />
                          <p className="font-semibold text-foreground">No Geo Fences Found</p>
                          <p className="text-[11px]">Create geofences in the Geofencing module to assign them to shifts.</p>
                        </div>
                      ) : (
                        geofences
                          .filter((g) => {
                            const name = (g.geo_fence_name || '').toLowerCase()
                            const addr = (g.geo_fence_address || '').toLowerCase()
                            const q = geofenceSearch.toLowerCase()
                            return name.includes(q) || addr.includes(q)
                          })
                          .map((g) => {
                            const gId = g.geo_fence_id || g.id || ''
                            const isSelected = selectedGeofences.includes(gId)
                            return (
                              <label
                                key={gId}
                                className={cn(
                                  'flex items-center justify-between p-3 text-xs hover:bg-muted/40 cursor-pointer transition-colors',
                                  isSelected && 'bg-primary/5',
                                )}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleGeofence(gId)}
                                    className="border-[#c4c8d1] data-[state=checked]:bg-[#2F63D8] data-[state=checked]:border-[#2F63D8] shrink-0"
                                  />
                                  <div className="size-7 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                                    <MapPin className="size-3.5" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-foreground truncate">{g.geo_fence_name}</span>
                                      <span
                                        className={cn(
                                          'px-1.5 py-0.2 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0',
                                          g.status === 'active'
                                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                            : 'bg-muted text-muted-foreground',
                                        )}
                                      >
                                        {g.status || 'Active'}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                                      {g.geo_fence_address || 'No address specified'}
                                    </p>
                                  </div>
                                </div>

                                <div className="text-right shrink-0 pl-3">
                                  <span className="inline-block px-2 py-0.5 rounded-md bg-muted text-[10px] font-mono font-medium text-foreground">
                                    {g.radius ? `${g.radius}m radius` : 'Default radius'}
                                  </span>
                                </div>
                              </label>
                            )
                          })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pinned Fixed Footer Actions */}
          <DialogFooter className="shrink-0 border-t border-border bg-muted/20 p-4 px-6 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="text-xs font-semibold"
            >
              {isSubmitting ? 'Saving...' : shiftToEdit ? 'Update Shift' : 'Create Shift'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
