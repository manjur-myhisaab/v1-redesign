import { useState, useEffect , useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  ArrowLeft,
  Check,
  Upload,
  Trash2,
  FileText,
  User,
  Briefcase,
  Clock,
  Wallet,
  ChevronDown,
  X,
  Eye,
  Download
} from 'lucide-react'

import Panel from '@/components/admin/Panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { useShell } from '@/components/admin/shell-context'
import { cn } from '@/lib/utils'
import PersonAvatar from '@/components/admin/PersonAvatar'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import rdk, { customEndpoint, readItems, API_URL, uploadFiles } from '@/services/server'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import ImageLightbox from '@/components/ui/image-lightbox'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox"

const TABS = [
  { id: 'basic', label: 'Basic Info', icon: User },
  { id: 'employment', label: 'Employment & Bank', icon: Briefcase },
  { id: 'attendance', label: 'Attendance Settings', icon: Clock },
  { id: 'payroll', label: 'Payroll & Overtime', icon: Wallet },
]

const META: Record<string, { title: string; desc: string }> = {
  basic: { title: 'Basic Information', desc: 'Enter the staff member\'s personal details and documents.' },
  employment: { title: 'Employment Details', desc: 'Configure employment, department, and bank information.' },
  attendance: { title: 'Attendance Settings', desc: 'Configure attendance tracking preferences.' },
  payroll: { title: 'Payroll & Overtime', desc: 'Manage CTC, salary basis, and overtime rules.' },
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']
const MARITAL_STATUSES = ['Single', 'Married', 'Divorced', 'Widowed']
const COUNTRIES = ['India', 'United States', 'United Kingdom', 'Canada', 'Australia', 'United Arab Emirates']
const CATEGORIES = ["Sales", "Operations", "HR", "Finance", "Marketing"] as const

// Directus Role UUIDs
export const ROLE_EMPLOYEE = '69a38aea-61ab-4d48-8d3d-1b3a9f78360a'
export const ROLE_ADMIN = 'bb64d3fd-5fde-4493-9cb7-bf6be2031d82'
export const ROLE_MANAGER = '8734320f-991f-479f-bba8-9d4af261856e'

// Zod Schema — Only first_name and mobile_number are required for now
const employeeFormSchema = z
  .object({
    first_name: z.string().min(1, 'First name is required'),
    mobile_number: z.string().min(1, 'Mobile number is required'),
  })
  .passthrough()

type EmployeeFormValues = {
  first_name: string
  mobile_number: string
  [key: string]: any
}

const DEFAULT_VALUES = {
  first_name: '',
  last_name: '',
  mobile_number: '',
  employee_email_address: '',
  employee_address: '',
  employee_birthdate: '',
  employee_blood_group: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  marital_status: '',
  pan_number: '',
  aadhaar_number: '',
  pf_no: '',
  uan: '',
  esi_applicable: false,
  esi_no: '',
  esi_to_deduct_till: '',

  employee_bank_ac_holder_name: '',
  employee_bank_ac_number: '',
  employee_bank_branch_name: '',
  employee_bank_ifsc: '',
  employee_bank_name: '',

  doj: '',
  gender: 'Male',
  employee_code: '',
  department_name: '',
  title: '',
  designation_id: '',
  role: ROLE_EMPLOYEE,
  employee_category_id: null as string | number | null,
  other_category_ids: [] as any[],
  select_category: 'Sales',
  manage_other_categories: [],
  view_other_managers: false,
  can_view_manager: false,
  custom_designation: '',
  super_admin_access: false,
  is_admin: false,
  supervisor_id: '',

  live_tracking: false,
  mobile_attendance: false,
  multiple_attendance: false,
  shiftwise_attendance: false,
  self_odometer_reading: false,
  vehicle_type: '',
  per_km_amount: '',
  ai_selfie_verification: false,
  punch_from: 'Geofence',
  shift_alignment_type: 'Fixed',
  shift_type: 'fixed',
  leave_template: 'none',
  assigned_leave_template: null as string | number | null,
  leaves: [] as any[],

  casual_leaves: 0,
  sick_leaves: 0,
  privilege_leaves: 0,
  emergency_leave: 0,

  salary: '25000.0',
  salary_per_month: '25000.0',
  pay_type: 'Monthly',
  week_off_extra_payment: true,
  week_off_payment: true,
  week_off_as_overtime: false,
  holiday_extra_payment: false,
  holiday_as_overtime: false,
  week_off_day_number: 0,
  week_off_day: 'Sunday',
  applicable_for_overtime: true,
  overtime_hours: '0',
  overtime_minutes: '1',
  overtime_starts_after_hours: '0',
  overtime_starts_after_minutes: '1',
  auto_overtime: true,
  view_self_salary: true,
  can_view_self_salary: true,
  payroll_template: 'none',
  payroll_template_id: null as string | number | null,
  payroll_heads: [] as any[],
  overtime_hourly_rate: '0',
  inactive_date: null as string | null,
  country: null as string | null,
  password: '',
}

interface FormDatePickerProps {
  value: string | null | undefined
  onChange: (val: string | null) => void
  placeholder?: string
  id?: string
}

// Reusable DatePicker component matching the requested design and fully integrated with react-hook-form string state
function FormDatePicker({ value, onChange, placeholder = 'Pick a date', id }: FormDatePickerProps) {
  const dateValue = value ? new Date(value) : undefined
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          data-empty={!dateValue}
          className="w-full justify-between text-left font-normal data-[empty=true]:text-muted-foreground h-9 px-3 cursor-pointer"
        >
          {dateValue && !isNaN(dateValue.getTime()) ? format(dateValue, 'PPP') : <span>{placeholder}</span>}
          <ChevronDown className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto overflow-hidden p-0" align="start">
        <Calendar
          mode="single"
          selected={dateValue}
          captionLayout="dropdown"
          startMonth={new Date(1950, 0)}
          endMonth={new Date(2040, 11)}
          onSelect={(selectedDate) => {
            if (selectedDate) {
              const yyyy = selectedDate.getFullYear()
              const mm = String(selectedDate.getMonth() + 1).padStart(2, '0')
              const dd = String(selectedDate.getDate()).padStart(2, '0')
              onChange(`${yyyy}-${mm}-${dd}`)
            } else {
              onChange(null)
            }
            setOpen(false)
          }}
          defaultMonth={dateValue}
        />
      </PopoverContent>
    </Popover>
  )
}

export default function StaffForm() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEditMode = Boolean(id)
  const queryClient = useQueryClient()
  const { firstTabActive } = useShell()
  const [activeTab, setActiveTab] = useState('basic')
  const manageCategoriesAnchor = useComboboxAnchor()

  // 1. Exact V1 Single Staff Query
  const { data: staffById, isLoading: isLoadingEmployee } = useQuery({
    queryKey: ['staff-by-id', id],
    queryFn: async () => {
      return await rdk.request(
        customEndpoint({
          path: `users/${id}`,
          method: 'GET',
          params: {
            fields: ['*', 'face_images.*', 'shift_ids.*', 'payroll_heads.*', 'documents.*', 'other_category_ids.*'],
          },
        })
      )
    },
    enabled: isEditMode,
    refetchOnWindowFocus: false,
  })

  // Dynamic lookups matching V1 StaffForm
  const { data: dbCategories = [] } = useQuery({
    queryKey: ['employee_categories_list'],
    queryFn: async () => {
      try {
        const res: any = await rdk.request(readItems('employee_category', { fields: ['*'] }))
        const list = Array.isArray(res) ? res : res?.data || []
        return list.map((c: any) => ({
          id: String(c.employee_category_id || c.id),
          name: c.employee_category_name || c.name || String(c),
        }))
      } catch (e) {
        return []
      }
    },
    refetchOnWindowFocus: false,
  })

  const { data: dbDesignations = [] } = useQuery({
    queryKey: ['designations_list'],
    queryFn: async () => {
      try {
        const res: any = await rdk.request(readItems('designations', { fields: ['*'] }))
        const list = Array.isArray(res) ? res : res?.data || []
        return list.map((d: any) => ({
          id: String(d.designation_id || d.id),
          name: d.designation_name || d.name || String(d),
        }))
      } catch (e) {
        return []
      }
    },
    refetchOnWindowFocus: false,
  })

  const { data: dbPayrollTemplates = [] } = useQuery({
    queryKey: ['payroll_templates'],
    queryFn: async () => {
      try {
        const res: any = await rdk.request(readItems('payroll_templates'))
        return Array.isArray(res) ? res : res?.data || []
      } catch (e) {
        console.error('Failed to fetch payroll_templates:', e)
        return []
      }
    },
    refetchOnWindowFocus: false,
  })

  const { data: dbLeaveTemplates = [] } = useQuery({
    queryKey: ['leave_templates_list'],
    queryFn: async () => {
      try {
        const res: any = await rdk.request(readItems('leave_templates', { fields: ['*'] }))
        return Array.isArray(res) ? res : res?.data || []
      } catch (e) {
        return []
      }
    },
    refetchOnWindowFocus: false,
  })

  const { data: dbShifts = [] } = useQuery({
    queryKey: ['shifts_list'],
    queryFn: async () => {
      try {
        const res: any = await rdk.request(readItems('shift', { fields: ['*', 'shift_ids.*'] }))
        return Array.isArray(res) ? res : res?.data || []
      } catch (e) {
        return []
      }
    },
    refetchOnWindowFocus: false,
  })

  const { data: dbBenefits = [] } = useQuery({
    queryKey: ['payroll-benefits'],
    queryFn: async () => {
      try {
        const res: any = await rdk.request(
          readItems('payroll_heads', {
            fields: ['*', 'value_based_on.related_payroll_heads_payroll_head_id.*'],
            filter: { payroll_type: { _eq: 'benefit' } },
          })
        )
        return Array.isArray(res) ? res : res?.data || []
      } catch {
        return []
      }
    },
    refetchOnWindowFocus: false,
  })

  const { data: dbDeductions = [] } = useQuery({
    queryKey: ['payroll-deductions'],
    queryFn: async () => {
      try {
        const res: any = await rdk.request(
          readItems('payroll_heads', {
            fields: ['*', 'value_based_on.related_payroll_heads_payroll_head_id.*'],
            filter: { payroll_type: { _eq: 'deduction' } },
          })
        )
        return Array.isArray(res) ? res : res?.data || []
      } catch {
        return []
      }
    },
    refetchOnWindowFocus: false,
  })

  // Comparison refs for tracking genuinely modified relational fields on edit
  const initialValuesRef = useRef<any>({})
  const initialSelectedShiftIdsRef = useRef<string[]>([])
  const initialWeeklyShiftsRef = useRef<Record<string, string[]>>({
    Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: []
  })
  const initialSelectedHeadIdsRef = useRef<number[]>([])
  const initialAvatarIdRef = useRef<string | null>(null)

  // Local profile pic preview state
  const [profilePic, setProfilePic] = useState<string | null>(null)
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null)
  const [uploadedAvatarAssetId, setUploadedAvatarAssetId] = useState<string | null>(null)

  interface UploadedFileItem {
    id: string
    name: string
    size: string
    url: string
    isImage: boolean
    file?: File
  }

  // Document Uploads State matching the screenshots layout
  const [savedDocuments, setSavedDocuments] = useState<UploadedFileItem[]>([])
  const [tempUploads, setTempUploads] = useState<UploadedFileItem[]>([])
  const [documentsDirty, setDocumentsDirty] = useState(false)

  // Face Images States matching the screenshots layout
  const [savedFaceImages, setSavedFaceImages] = useState<UploadedFileItem[]>([])
  const [tempFaceImages, setTempFaceImages] = useState<UploadedFileItem[]>([])
  const [faceImagesDirty, setFaceImagesDirty] = useState(false)
  const [isDraggingFace, setIsDraggingFace] = useState(false)

  // Payroll configuration accordion and selected checkbox states
  const [benefitsExpanded, setBenefitsExpanded] = useState(false)
  const [deductionsExpanded, setDeductionsExpanded] = useState(false)

  const [benefits, setBenefits] = useState<{ id: any; label: string; helpText?: string; selected: boolean }[]>([])
  const [deductions, setDeductions] = useState<{ id: any; label: string; helpText?: string; selected: boolean }[]>([])

  const selectedBenefitsCount = benefits.filter(b => b.selected).length
  const selectedDeductionsCount = deductions.filter(d => d.selected).length

  // Shift management states
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [shifts, setShifts] = useState<{ id: string; name: string; time: string; selected: boolean }[]>([
    { id: '1', name: 'Morning Shift', time: '(09:00 AM) - (07:00 PM)', selected: true },
    { id: '2', name: 'General Shift', time: '(09:00 AM) - (06:00 PM)', selected: false },
    { id: '3', name: 'Night Shift', time: '(09:00 PM) - (06:00 AM)', selected: false },
  ])
  const selectedShiftsCount = shifts.filter(s => s.selected).length

  // Available shift options for weekly selection
  const ALL_SHIFTS = [
    { id: '1', name: 'Week Off', time: '' },
    ...shifts.map(s => ({ id: s.id, name: s.name, time: s.time }))
  ]
  const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  // Per-day weekly shift selection: dayName -> array of selected shift ids
  const [weeklyShifts, setWeeklyShifts] = useState<Record<string, string[]>>({
    Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: []
  })
  const [activeDaySheet, setActiveDaySheet] = useState<string | null>(null)

  // React Hook Form initialization with Zod Schema
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    getValues,
    reset,
    formState: { errors, dirtyFields },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema) as any,
    defaultValues: DEFAULT_VALUES as any,
    shouldUnregister: false,
  })

  // Exact V1 Staff Data Population
  useEffect(() => {
    if (!staffById) return
    const e = (staffById as any).data || staffById
    const rolesData = e.role || []

    const parseDateStr = (d: string | null | undefined) => {
      if (!d) return ''
      const parsed = new Date(d)
      if (isNaN(parsed.getTime())) return ''
      return parsed.toISOString().slice(0, 10)
    }

    const newValues = {
      first_name: e.first_name || '',
      last_name: e.last_name || '',
      mobile_number: e.mobile_number || (e.email ? e.email.replace('91', '').split('@')[0] : ''),
      employee_email_address: e.employee_email_address || '',
      employee_address: e.employee_address || '',
      employee_birthdate: parseDateStr(e.employee_birthdate),
      employee_blood_group: e.employee_blood_group || '',
      emergency_contact_name: e.emergency_contact_name || '',
      emergency_contact_phone: e.emergency_contact_phone || '',
      marital_status: e.marital_status || '',
      pan_number: e.pan_number || '',
      aadhaar_number: e.aadhaar_number || '',
      pf_no: e.pf_no || '',
      uan: e.uan || '',
      esi_applicable: e.esi_applicable === 'Y' || e.esi_applicable === true,
      esi_no: e.esi_no || '',
      esi_to_deduct_till: parseDateStr(e.esi_to_deduct_till),
      employee_bank_ac_holder_name: e.employee_bank_ac_holder_name || '',
      employee_bank_ac_number: e.employee_bank_ac_number || '',
      employee_bank_branch_name: e.employee_bank_branch_name || '',
      employee_bank_ifsc: e.employee_bank_ifsc || '',
      employee_bank_name: e.employee_bank_name || '',
      doj: parseDateStr(e.doj),
      gender: e.gender || 'Male',
      employee_code: e.employee_code || '',
      department_name: e.department_name || '',
      title: e.title || '',
      designation_id: e.designation_id ? String(e.designation_id) : '',
      role: (Array.isArray(rolesData) && rolesData.length > 0 ? rolesData[0] : rolesData) || ROLE_EMPLOYEE,
      supervisor_id: e.supervisor_id || '',
      country: e.country || null,
      password: '',
      // Attendance
      live_tracking: e.live_tracking ?? false,
      mobile_attendance: e.mobile_attendance ?? false,
      multiple_attendance: e.multiple_attendance ?? false,
      shiftwise_attendance: e.shiftwise_attendance ?? false,
      self_odometer_reading: e.self_odometer_reading ?? false,
      vehicle_type: e.vehicle_type || '',
      per_km_amount: e.per_km_amount != null ? String(e.per_km_amount) : '',
      ai_selfie_verification: e.ai_selfie_verification ?? false,
      punch_from: e.punch_from
        ? e.punch_from.charAt(0).toUpperCase() + e.punch_from.slice(1)
        : 'Geofence',
      shift_alignment_type: e.shift_type
        ? e.shift_type.charAt(0).toUpperCase() + e.shift_type.slice(1)
        : 'Fixed',
      shift_type: (e.shift_type || 'fixed').toLowerCase(),
      // Leaves
      leave_template: e.assigned_leave_template ? String(e.assigned_leave_template) : 'none',
      assigned_leave_template: e.assigned_leave_template ? String(e.assigned_leave_template) : null,
      leaves: e.leaves || [],
      casual_leaves: e.casual_leaves != null ? Number(e.casual_leaves) : 0,
      sick_leaves: e.sick_leaves != null ? Number(e.sick_leaves) : 0,
      privilege_leaves: e.privilege_leaves != null ? Number(e.privilege_leaves) : 0,
      emergency_leave: e.emergency_leave != null ? Number(e.emergency_leave) : 0,
      // Payroll
      salary: `${e.salary_per_month || 0}.${e.salary_per_month_after_decimal || 0}`,
      salary_per_month: `${e.salary_per_month || 0}.${e.salary_per_month_after_decimal || 0}`,
      pay_type: e.pay_type || 'Monthly',
      applicable_for_overtime: e.applicable_for_overtime ?? false,
      auto_overtime: e.auto_overtime ?? false,
      overtime_hourly_rate: e.overtime_hourly_rate ? String(Math.floor(e.overtime_hourly_rate)) : '0',
      overtime_hours: e.overtime_hours ? String(e.overtime_hours) : '0',
      overtime_minutes: e.overtime_minutes ? String(e.overtime_minutes) : '0',
      overtime_starts_after_hours: e.overtime_hours ? String(e.overtime_hours) : '0',
      overtime_starts_after_minutes: e.overtime_minutes ? String(e.overtime_minutes) : '0',
      week_off_extra_payment: e.week_off_payment ?? false,
      week_off_payment: e.week_off_payment ?? false,
      week_off_as_overtime: e.week_off_as_overtime ?? false,
      holiday_extra_payment: e.holiday_extra_payment ?? false,
      holiday_as_overtime: e.holiday_as_overtime ?? false,
      week_off_day_number: e.week_off_day_number ?? 0,
      week_off_day: e.week_off_day_number != null
        ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][e.week_off_day_number] ?? 'Sunday'
        : 'Sunday',
      view_self_salary: e.can_view_self_salary ?? false,
      can_view_self_salary: e.can_view_self_salary ?? false,
      employee_category_id: e.employee_category_id ? String(e.employee_category_id) : '',
      select_category: e.employee_category_id ? String(e.employee_category_id) : 'Sales',
      other_category_ids: (e.other_category_ids || []).map((item: any) => item.employee_category_employee_category_id || item),
      manage_other_categories: (e.other_category_ids || []).map((item: any) => item.employee_category_employee_category_id || item),
      view_other_managers: e.can_view_manager ?? false,
      can_view_manager: e.can_view_manager ?? false,
      custom_designation: '',
      super_admin_access: e.is_admin ?? false,
      is_admin: e.is_admin ?? false,
      payroll_template: e.payroll_template_id ? String(e.payroll_template_id) : 'none',
      payroll_template_id: e.payroll_template_id ? String(e.payroll_template_id) : 'none',
      inactive_date: e.inactive_date ? parseDateStr(e.inactive_date) : null,
      inactive_date: e.inactive_date ? parseDateStr(e.inactive_date) : null,
    }

    reset(newValues)
    initialValuesRef.current = { ...newValues }

    const staffShiftIds = (e?.shift_ids || []).map((item: any) =>
      String(item.shift_shift_id?.shift_id || item.shift_shift_id || item.id || item)
    )
    initialSelectedShiftIdsRef.current = staffShiftIds

    const staffWeekly = e?.weekly_shifts || {
      Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: []
    }
    initialWeeklyShiftsRef.current = staffWeekly
    setWeeklyShifts(staffWeekly)

    const staffHeadIds = (e?.payroll_heads || []).map((item: any) =>
      Number(item.payroll_heads_payroll_head_id?.payroll_head_id || item.payroll_heads_payroll_head_id || item.id || item)
    ).filter(Boolean)
    initialSelectedHeadIdsRef.current = staffHeadIds

    const avatarVal = e?.avatar || e?.profile_image || e?.profile_picture || e?.image
    if (avatarVal) {
      const cleanAvatarId = typeof avatarVal === 'object' ? (avatarVal.id || avatarVal.directus_files_id) : avatarVal
      if (cleanAvatarId) {
        setUploadedAvatarAssetId(cleanAvatarId)
        setProfilePic(`${API_URL}/assets/${cleanAvatarId}`)
        initialAvatarIdRef.current = cleanAvatarId
      }
    } else {
      setUploadedAvatarAssetId(null)
      setProfilePic(null)
      initialAvatarIdRef.current = null
    }

    if (e?.face_images && Array.isArray(e.face_images)) {
      setSavedFaceImages(e.face_images.map((f: any, idx: number) => {
        const rawId = typeof f.directus_files_id === 'object' ? (f.directus_files_id?.id || f.directus_files_id) : (f.directus_files_id || f.id)
        return {
          id: `face-${rawId}`,
          name: `face_${idx + 1}.png`,
          size: '120 KB',
          url: `${API_URL}/assets/${rawId}`,
          isImage: true,
        }
      }))
    }

    if (e?.documents && Array.isArray(e.documents)) {
      setSavedDocuments(e.documents.map((d: any, idx: number) => {
        const rawId = typeof d.directus_files_id === 'object' ? (d.directus_files_id?.id || d.directus_files_id) : (d.directus_files_id || d.id)
        const isImg = d.type?.includes('image') || (d.filename_download && /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(d.filename_download))
        return {
          id: `doc-${rawId}`,
          name: d.title || d.filename_download || `document_${idx + 1}`,
          size: '250 KB',
          url: `${API_URL}/assets/${rawId}`,
          isImage: Boolean(isImg),
        }
      }))
    }
  }, [staffById, reset])

  // Synchronize shifts from dbShifts and staffById
  useEffect(() => {
    if (!dbShifts || dbShifts.length === 0) return
    const staffShiftIds = (staffById?.shift_ids || []).map((item: any) =>
      String(item.shift_shift_id?.shift_id || item.shift_shift_id || item.id || item)
    )
    setShifts(
      dbShifts.map((s: any) => ({
        id: String(s.shift_id || s.id),
        name: s.shift_name || s.name || 'Shift',
        time: s.start_time && s.end_time ? `(${s.start_time}) - (${s.end_time})` : '',
        selected: staffShiftIds.includes(String(s.shift_id || s.id)),
      }))
    )
  }, [dbShifts, staffById])

  // Synchronize benefits from dbBenefits and staffById
  useEffect(() => {
    if (!dbBenefits || dbBenefits.length === 0) return
    const staffHeadIds = (staffById?.payroll_heads || []).map((item: any) =>
      Number(item.payroll_heads_payroll_head_id?.payroll_head_id || item.payroll_heads_payroll_head_id || item.id || item)
    )
    setBenefits(
      dbBenefits.map((b: any) => {
        const headId = Number(b.payroll_head_id || b.id)
        const headName = b.payroll_head_name || b.head_name || b.name || `Head #${headId}`
        const helpText = b.payroll_value_type === 'fixed'
          ? `₹${b.payroll_value} Fixed Amount`
          : b.payroll_value ? `${b.payroll_value}% of ${[
              ...(b.value_based_on?.map((item: any) => item.related_payroll_heads_payroll_head_id?.payroll_head_name) || []),
              ...(b.value_based_on_2?.map((item: any) => item.head_name) || [])
            ].filter(Boolean).join(', ')}` : ''
        return {
          id: headId,
          label: headName,
          helpText,
          selected: staffHeadIds.includes(headId),
        }
      })
    )
  }, [dbBenefits, staffById])

  // Synchronize deductions from dbDeductions and staffById
  useEffect(() => {
    if (!dbDeductions || dbDeductions.length === 0) return
    const staffHeadIds = (staffById?.payroll_heads || []).map((item: any) =>
      Number(item.payroll_heads_payroll_head_id?.payroll_head_id || item.payroll_heads_payroll_head_id || item.id || item)
    )
    setDeductions(
      dbDeductions.map((d: any) => {
        const headId = Number(d.payroll_head_id || d.id)
        const headName = d.payroll_head_name || d.head_name || d.name || `Head #${headId}`
        const helpText = d.payroll_value_type === 'fixed'
          ? `₹${d.payroll_value} Fixed Amount`
          : d.payroll_value ? `${d.payroll_value}% of ${[
              ...(d.value_based_on?.map((item: any) => item.related_payroll_heads_payroll_head_id?.payroll_head_name) || []),
              ...(d.value_based_on_2?.map((item: any) => item.head_name) || [])
            ].filter(Boolean).join(', ')}` : ''
        return {
          id: headId,
          label: headName,
          helpText,
          selected: staffHeadIds.includes(headId),
        }
      })
    )
  }, [dbDeductions, staffById])

  // Watch fields for conditional rendering
  const esiApplicable = watch('esi_applicable')
  const applicableForOvertime = watch('applicable_for_overtime')
  const shiftwiseAttendance = watch('shiftwise_attendance')
  const shiftAlignmentType = watch('shift_alignment_type')
  const inactiveDate = watch('inactive_date')
  const firstName = watch('first_name')
  const lastName = watch('last_name')
  const gender = watch('gender')
  const role = watch('role')
  const aiSelfieVerification = watch('ai_selfie_verification')
  const salaryPerMonth = watch('salary_per_month')
  const weekOffExtraPayment = watch('week_off_extra_payment')
  const autoOvertime = watch('auto_overtime')
  const overtimeStartsAfterHours = watch('overtime_starts_after_hours')
  const overtimeStartsAfterMinutes = watch('overtime_starts_after_minutes')
  const overtimeHourlyRate = watch('overtime_hourly_rate')

  // Exact V1 Staff Mutation Handler
  const addOrEditStaffMutation = useMutation({
    mutationFn: async ({ formData, isPartialEdit = false }: { formData: any; isPartialEdit?: boolean }) => {
      let avatarId = uploadedAvatarAssetId
      let faceImageIds: any = undefined
      let documentIds: any = undefined

      // 1. Avatar upload
      const fileToUpload = selectedImageFile || (formData.avatar instanceof File ? formData.avatar : null)
      if (fileToUpload instanceof File) {
        try {
          const [uploadedId] = await uploadFiles([fileToUpload])
          avatarId = uploadedId
        } catch (error) {
          console.error('Avatar upload failed:', error)
          throw new Error('Failed to upload avatar image')
        }
      }

      // 2. Face images upload
      const existingFaceIds = savedFaceImages
        .filter((f) => !f.id.startsWith('temp-'))
        .map((f) => {
          const rawId = f.id.replace(/^face-/, '')
          return { directus_files_id: rawId }
        })
      const newFaceFiles = tempFaceImages.map((f: any) => f.file).filter(Boolean)

      const isFaceModified = faceImagesDirty || newFaceFiles.length > 0 || savedFaceImages.length !== (staffById?.face_images?.length || 0)
      if (!isPartialEdit || isFaceModified) {
        try {
          let uploadedIds: string[] = []
          if (newFaceFiles.length > 0) {
            uploadedIds = await uploadFiles(newFaceFiles)
          }
          faceImageIds = [
            ...existingFaceIds,
            ...uploadedIds.map((fileId) => ({ directus_files_id: fileId })),
          ]
        } catch (error) {
          console.error('Face images upload failed:', error)
          throw new Error('Failed to upload face images')
        }
      }

      // 3. Documents upload
      const existingDocs = savedDocuments
        .filter((d) => !d.id.startsWith('bulk-doc-'))
        .map((d) => {
          const rawId = d.id.replace(/^doc-/, '')
          return { directus_files_id: rawId }
        })
      const newDocFiles = tempUploads.map((d: any) => d.file).filter(Boolean)

      const isDocsModified = documentsDirty || newDocFiles.length > 0 || savedDocuments.length !== (staffById?.documents?.length || 0)
      if (!isPartialEdit || isDocsModified) {
        try {
          let uploadedIds: string[] = []
          if (newDocFiles.length > 0) {
            uploadedIds = await uploadFiles(newDocFiles)
          }
          documentIds = [
            ...existingDocs,
            ...uploadedIds.map((fileId) => ({ directus_files_id: fileId })),
          ]
        } catch (error) {
          console.error('Document upload failed:', error)
          throw new Error('Failed to upload documents')
        }
      }

      let payload: any = {}

      if (isPartialEdit && id) {
        // --- EDIT MODE: Send ONLY modified/dirty fields ---
        payload = {}

        const currentValues = getValues()
        const initialValues = initialValuesRef.current || {}

        // 1. Process all dirty fields tracked by react-hook-form
        Object.keys(dirtyFields).forEach((key) => {
          const val = currentValues[key] ?? formData[key]
          payload[key] = (val === '' || val === undefined) ? null : val
        })

        // 2. Diff fallback against initial values to guarantee changed fields are always included
        Object.keys(currentValues).forEach((key) => {
          const curVal = currentValues[key]
          const initVal = initialValues[key]
          if (curVal !== initVal && curVal !== undefined) {
            payload[key] = (curVal === '' || curVal === undefined) ? null : curVal
          }
        })

        // Explicit fallback for personal info
        if (currentValues.employee_blood_group !== initialValues.employee_blood_group || dirtyFields.employee_blood_group) {
          payload.employee_blood_group = currentValues.employee_blood_group || null
        }
        if (currentValues.employee_birthdate !== initialValues.employee_birthdate || dirtyFields.employee_birthdate) {
          payload.employee_birthdate = currentValues.employee_birthdate || null
        }
        if (currentValues.emergency_contact_name !== initialValues.emergency_contact_name || dirtyFields.emergency_contact_name) {
          payload.emergency_contact_name = currentValues.emergency_contact_name || null
        }
        if (currentValues.emergency_contact_phone !== initialValues.emergency_contact_phone || dirtyFields.emergency_contact_phone) {
          payload.emergency_contact_phone = currentValues.emergency_contact_phone || null
        }
        if (currentValues.marital_status !== initialValues.marital_status || dirtyFields.marital_status) {
          payload.marital_status = currentValues.marital_status || null
        }

        if (dirtyFields.mobile_number || dirtyFields.email || currentValues.mobile_number !== initialValues.mobile_number) {
          const mob = currentValues.mobile_number || formData.mobile_number || watch('mobile_number')
          payload.email = mob ? `91${mob}@hisaab.reev.group` : null
        }
        delete payload.mobile_number

        if (dirtyFields.salary_per_month || dirtyFields.salary || currentValues.salary_per_month !== initialValues.salary_per_month) {
          const salaryVal = String(watch('salary_per_month') ?? watch('salary') ?? '')
          payload.salary_per_month = salaryVal ? salaryVal.split('.')[0] : null
          payload.salary_per_month_after_decimal = salaryVal ? (salaryVal.split('.')[1] || '0') : null
        }
        delete payload.salary

        if (dirtyFields.role || currentValues.role !== initialValues.role) {
          let r = currentValues.role
          if (r === 'Admin') r = ROLE_ADMIN
          else if (r === 'Manager') r = ROLE_MANAGER
          else if (r === 'Employee') r = ROLE_EMPLOYEE
          payload.role = r
        }

        if (dirtyFields.password) {
          if (formData.password && !formData.password.includes('*') && formData.password.trim() !== '') {
            payload.password = formData.password
          } else {
            delete payload.password
          }
        } else {
          delete payload.password
        }

        if (dirtyFields.status || dirtyFields.inactive_date || currentValues.inactive_date !== initialValues.inactive_date) {
          const inDate = watch('inactive_date')
          const status = inDate ? 'archived' : 'active'
          if (status === 'archived' && (!inDate || String(inDate).trim() === '')) {
            throw new Error('Inactive Date is mandatory when status is archived')
          }
          payload.status = status
          payload.inactive_date = status === 'archived' && inDate ? new Date(inDate).toISOString() : null
        }

        if (dirtyFields.select_category || dirtyFields.employee_category_id || currentValues.employee_category_id !== initialValues.employee_category_id) {
          const catVal = currentValues.employee_category_id || currentValues.select_category
          const matchedCat = dbCategories.find((c: any) => String(c.employee_category_id || c.id) === String(catVal) || (c.employee_category_name || c.name) === catVal)
          payload.employee_category_id = matchedCat ? Number(matchedCat.employee_category_id || matchedCat.id) : (Number(catVal) || null)
        }

        if (dirtyFields.leave_template || dirtyFields.assigned_leave_template || currentValues.assigned_leave_template !== initialValues.assigned_leave_template) {
          const selectedTemplate = currentValues.assigned_leave_template || currentValues.leave_template
          if (!selectedTemplate || selectedTemplate === 'none') {
            payload.assigned_leave_template = null
            payload.leaves = []
          } else {
            const matchedTpl = dbLeaveTemplates.find((t: any) => String(t.leave_template_id || t.id) === String(selectedTemplate) || (t.leave_template_name || t.template_name || t.name) === selectedTemplate)
            payload.assigned_leave_template = matchedTpl ? Number(matchedTpl.leave_template_id || matchedTpl.id) : (Number(selectedTemplate) || null)
            payload.leaves = watch('leaves') || []
          }
        } else if (dirtyFields.leaves) {
          payload.leaves = watch('leaves') || []
        }

        if (dirtyFields.casual_leaves) payload.casual_leaves = Number(watch('casual_leaves')) || 0
        if (dirtyFields.sick_leaves) payload.sick_leaves = Number(watch('sick_leaves')) || 0
        if (dirtyFields.privilege_leaves) payload.privilege_leaves = Number(watch('privilege_leaves')) || 0
        if (dirtyFields.emergency_leave) payload.emergency_leave = Number(watch('emergency_leave')) || 0

        if (dirtyFields.designation_id || currentValues.designation_id !== initialValues.designation_id) {
          const desVal = currentValues.designation_id
          const matchedDes = dbDesignations.find((d: any) => String(d.designation_id || d.id) === String(desVal) || (d.designation_name || d.name) === desVal)
          payload.designation_id = matchedDes ? Number(matchedDes.designation_id || matchedDes.id) : (Number(desVal) || null)
        }

        if (dirtyFields.title || currentValues.title !== initialValues.title) {
          payload.title = currentValues.title || null
        }

        if (dirtyFields.payroll_template || dirtyFields.payroll_template_id || currentValues.payroll_template_id !== initialValues.payroll_template_id) {
          const ptVal = currentValues.payroll_template_id ?? currentValues.payroll_template
          if (!ptVal || ptVal === 'none' || ptVal === '') {
            payload.payroll_template_id = null
          } else {
            const matchedPt = dbPayrollTemplates.find((p: any) => String(p.payroll_template_id || p.id) === String(ptVal) || (p.payroll_template_name || p.template_name || p.name) === ptVal)
            payload.payroll_template_id = matchedPt ? Number(matchedPt.payroll_template_id || matchedPt.id) : (Number(ptVal) || null)
          }
        }

        if (dirtyFields.auto_overtime || currentValues.auto_overtime !== initialValues.auto_overtime) {
          payload.auto_overtime = Boolean(watch('auto_overtime'))
        }
        if (dirtyFields.week_off_payment || dirtyFields.week_off_extra_payment || currentValues.week_off_payment !== initialValues.week_off_payment) {
          payload.week_off_payment = Boolean(watch('week_off_payment') ?? watch('week_off_extra_payment'))
        }
        if (dirtyFields.week_off_as_overtime || currentValues.week_off_as_overtime !== initialValues.week_off_as_overtime) {
          payload.week_off_as_overtime = Boolean(watch('week_off_as_overtime'))
        }
        if (dirtyFields.holiday_extra_payment || currentValues.holiday_extra_payment !== initialValues.holiday_extra_payment) {
          payload.holiday_extra_payment = Boolean(watch('holiday_extra_payment'))
        }
        if (dirtyFields.holiday_as_overtime || currentValues.holiday_as_overtime !== initialValues.holiday_as_overtime) {
          payload.holiday_as_overtime = Boolean(watch('holiday_as_overtime'))
        }
        if (dirtyFields.week_off_day_number || currentValues.week_off_day_number !== initialValues.week_off_day_number) {
          const weekOffNum = watch('week_off_day_number')
          payload.week_off_day_number = (weekOffNum !== '' && weekOffNum != null) ? Number(weekOffNum) : null
        }
        if (dirtyFields.applicable_for_overtime || currentValues.applicable_for_overtime !== initialValues.applicable_for_overtime) {
          payload.applicable_for_overtime = Boolean(watch('applicable_for_overtime'))
        }
        if (dirtyFields.overtime_hours || dirtyFields.overtime_starts_after_hours) {
          payload.overtime_hours = Number(watch('overtime_hours') ?? watch('overtime_starts_after_hours')) || 0
        }
        if (dirtyFields.overtime_minutes || dirtyFields.overtime_starts_after_minutes) {
          payload.overtime_minutes = Number(watch('overtime_minutes') ?? watch('overtime_starts_after_minutes')) || 0
        }
        if (dirtyFields.overtime_hourly_rate || currentValues.overtime_hourly_rate !== initialValues.overtime_hourly_rate) {
          payload.overtime_hourly_rate = Number(watch('overtime_hourly_rate')) || 0
        }
        if (dirtyFields.can_view_self_salary || dirtyFields.view_self_salary || currentValues.can_view_self_salary !== initialValues.can_view_self_salary) {
          payload.can_view_self_salary = Boolean(watch('can_view_self_salary') ?? watch('view_self_salary'))
        }
        if (dirtyFields.self_odometer_reading || currentValues.self_odometer_reading !== initialValues.self_odometer_reading) {
          payload.self_odometer_reading = Boolean(watch('self_odometer_reading'))
        }
        if (dirtyFields.vehicle_type || currentValues.vehicle_type !== initialValues.vehicle_type) {
          payload.vehicle_type = watch('self_odometer_reading') ? (watch('vehicle_type') || null) : null
        }
        if (dirtyFields.per_km_amount || currentValues.per_km_amount !== initialValues.per_km_amount) {
          payload.per_km_amount = watch('self_odometer_reading') && watch('per_km_amount') !== '' && watch('per_km_amount') != null ? Number(watch('per_km_amount')) : null
        }
        if (dirtyFields.can_view_manager || dirtyFields.view_other_managers) {
          payload.can_view_manager = Boolean(watch('can_view_manager') ?? watch('view_other_managers'))
        }
        if (dirtyFields.is_admin || dirtyFields.super_admin_access) {
          payload.is_admin = Boolean(watch('is_admin') ?? watch('super_admin_access'))
        }
        if (dirtyFields.punch_from || currentValues.punch_from !== initialValues.punch_from) {
          payload.punch_from = (watch('punch_from') || '').toLowerCase()
        }
        if (dirtyFields.shift_type || dirtyFields.shift_alignment_type || currentValues.shift_type !== initialValues.shift_type) {
          payload.shift_type = (watch('shift_type') || watch('shift_alignment_type') || '').toLowerCase()
        }
        if (dirtyFields.pay_type || currentValues.pay_type !== initialValues.pay_type) {
          payload.pay_type = watch('pay_type') || 'Monthly'
        }

        if (dirtyFields.manage_other_categories || dirtyFields.other_category_ids || JSON.stringify(currentValues.other_category_ids) !== JSON.stringify(initialValues.other_category_ids)) {
          const otherCats = watch('other_category_ids') || watch('manage_other_categories') || []
          payload.other_category_ids = (Array.isArray(otherCats) ? otherCats : [])
            .map((item: any) => {
              const catId = typeof item === 'object' ? (item.employee_category_employee_category_id?.employee_category_id || item.employee_category_id || item.id) : item
              return { employee_category_employee_category_id: { employee_category_id: Number(catId) } }
            })
            .filter((c: any) => !isNaN(c.employee_category_employee_category_id.employee_category_id) && c.employee_category_employee_category_id.employee_category_id > 0)
        }

        // 2. Complex Relations - only include if modified compared to initial
        const curSelectedShiftIds = shifts.filter(s => s.selected).map(s => String(s.id)).sort()
        const initShiftIds = [...initialSelectedShiftIdsRef.current].map(String).sort()
        if (JSON.stringify(curSelectedShiftIds) !== JSON.stringify(initShiftIds)) {
          payload.shift_ids = curSelectedShiftIds.map(sid => ({ shift_shift_id: { shift_id: Number(sid) } }))
        }

        if (JSON.stringify(weeklyShifts) !== JSON.stringify(initialWeeklyShiftsRef.current)) {
          payload.weekly_shifts = weeklyShifts
        }

        const curSelectedHeadIds = [
          ...benefits.filter(b => b.selected).map(b => Number(b.id)),
          ...deductions.filter(d => d.selected).map(d => Number(d.id)),
        ].filter(Boolean).sort()
        const initHeadIds = [...initialSelectedHeadIdsRef.current].map(Number).filter(Boolean).sort()
        if (JSON.stringify(curSelectedHeadIds) !== JSON.stringify(initHeadIds)) {
          payload.payroll_heads = curSelectedHeadIds.map(hid => ({
            payroll_heads_payroll_head_id: { payroll_head_id: hid }
          }))
        }

        // 3. Media uploads - only if modified
        if (selectedImageFile instanceof File || avatarId !== initialAvatarIdRef.current) {
          payload.avatar = avatarId || null
        }
        if (faceImageIds !== undefined) {
          payload.face_images = faceImageIds
        }
        if (documentIds !== undefined) {
          payload.documents = documentIds
        }

        // 4. Clean up UI helper keys
        delete payload.mobile_number
        delete payload.salary
        delete payload.select_category
        delete payload.leave_template
        delete payload.payroll_template
        delete payload.week_off_extra_payment
        delete payload.week_off_day
        delete payload.view_self_salary
        delete payload.view_other_managers
        delete payload.super_admin_access
        delete payload.shift_alignment_type
        delete payload.manage_other_categories
        delete payload.custom_designation
        delete payload.overtime_starts_after_hours
        delete payload.overtime_starts_after_minutes

        if (payload.role) {
          if (payload.role === 'Admin') payload.role = ROLE_ADMIN
          else if (payload.role === 'Manager') payload.role = ROLE_MANAGER
          else if (payload.role === 'Employee') payload.role = ROLE_EMPLOYEE
        }

        // Check if anything actually changed
        if (Object.keys(payload).length === 0) {
          toast.info('No changes detected to save.')
          return
        }

      } else {
        // --- CREATE MODE: Send FULL payload ---
        const inDate = formData.inactive_date || watch('inactive_date')
        const status = inDate ? 'archived' : (formData.status || 'active')
        if (status === 'archived' && (!inDate || String(inDate).trim() === '')) {
          throw new Error('Inactive Date is mandatory when status is archived')
        }
        const inactiveDateIso = status === 'archived' && inDate ? new Date(inDate).toISOString() : null

        const salaryVal = String(watch('salary_per_month') ?? watch('salary') ?? '')
        const mob = formData.mobile_number || watch('mobile_number')

        const catVal = formData.employee_category_id || formData.select_category
        const matchedCat = dbCategories.find((c: any) => String(c.employee_category_id || c.id) === String(catVal) || (c.employee_category_name || c.name) === catVal)

        const selShiftIds = shifts.filter(s => s.selected).map(s => Number(s.id)).filter(Boolean)
        const selHeadIds = [
          ...benefits.filter(b => b.selected).map(b => Number(b.id)),
          ...deductions.filter(d => d.selected).map(d => Number(d.id)),
        ].filter(Boolean)

        const selectedLeaveTemplate = formData.assigned_leave_template || formData.leave_template
        const matchedTpl = (!selectedLeaveTemplate || selectedLeaveTemplate === 'none') ? null : dbLeaveTemplates.find((t: any) => String(t.leave_template_id || t.id) === String(selectedLeaveTemplate) || (t.leave_template_name || t.template_name || t.name) === selectedLeaveTemplate)

        const ptVal = formData.payroll_template_id || formData.payroll_template
        const matchedPt = (!ptVal || ptVal === 'none') ? null : dbPayrollTemplates.find((p: any) => String(p.payroll_template_id || p.id) === String(ptVal) || (p.payroll_template_name || p.template_name || p.name) === ptVal)

        const desVal = formData.designation_id
        const matchedDes = dbDesignations.find((d: any) => String(d.designation_id || d.id) === String(desVal) || (d.designation_name || d.name) === desVal)

        const odo = Boolean(watch('self_odometer_reading'))
        const weekOffNum = watch('week_off_day_number')

        let createRole = formData.role || ROLE_EMPLOYEE
        if (createRole === 'Admin') createRole = ROLE_ADMIN
        else if (createRole === 'Manager') createRole = ROLE_MANAGER
        else if (createRole === 'Employee') createRole = ROLE_EMPLOYEE

        payload = {
          ...formData,
          email: mob ? `91${mob}@hisaab.reev.group` : null,
          role: createRole,
          status: status,
          inactive_date: inactiveDateIso,
          salary_per_month: salaryVal ? salaryVal.split('.')[0] : null,
          salary_per_month_after_decimal: salaryVal ? (salaryVal.split('.')[1] || '0') : null,
          employee_category_id: matchedCat ? Number(matchedCat.employee_category_id || matchedCat.id) : (Number(catVal) || null),
          designation_id: matchedDes ? Number(matchedDes.designation_id || matchedDes.id) : (Number(desVal) || null),
          title: formData.title || null,
          assigned_leave_template: matchedTpl ? Number(matchedTpl.leave_template_id || matchedTpl.id) : null,
          leaves: matchedTpl ? (watch('leaves') || []) : [],
          payroll_template_id: matchedPt ? Number(matchedPt.payroll_template_id || matchedPt.id) : (Number(ptVal) || null),
          casual_leaves: Number(watch('casual_leaves')) || 0,
          sick_leaves: Number(watch('sick_leaves')) || 0,
          privilege_leaves: Number(watch('privilege_leaves')) || 0,
          emergency_leave: Number(watch('emergency_leave')) || 0,
          week_off_payment: Boolean(watch('week_off_payment') ?? watch('week_off_extra_payment')),
          week_off_as_overtime: Boolean(watch('week_off_as_overtime')),
          holiday_extra_payment: Boolean(watch('holiday_extra_payment')),
          holiday_as_overtime: Boolean(watch('holiday_as_overtime')),
          week_off_day_number: (weekOffNum !== '' && weekOffNum != null) ? Number(weekOffNum) : null,
          applicable_for_overtime: Boolean(watch('applicable_for_overtime')),
          auto_overtime: Boolean(watch('auto_overtime')),
          overtime_hours: Number(watch('overtime_hours') ?? watch('overtime_starts_after_hours')) || 0,
          overtime_minutes: Number(watch('overtime_minutes') ?? watch('overtime_starts_after_minutes')) || 0,
          overtime_hourly_rate: Number(watch('overtime_hourly_rate')) || 0,
          self_odometer_reading: odo,
          vehicle_type: odo ? (watch('vehicle_type') || null) : null,
          per_km_amount: odo && watch('per_km_amount') !== '' && watch('per_km_amount') != null ? Number(watch('per_km_amount')) : null,
          can_view_self_salary: Boolean(watch('can_view_self_salary') ?? watch('view_self_salary')),
          can_view_manager: Boolean(watch('can_view_manager') ?? watch('view_other_managers')),
          is_admin: Boolean(watch('is_admin') ?? watch('super_admin_access')),
          punch_from: (watch('punch_from') || '').toLowerCase(),
          shift_type: (watch('shift_type') || watch('shift_alignment_type') || '').toLowerCase(),
          pay_type: watch('pay_type') || 'Monthly',
          shift_ids: selShiftIds.map(sid => ({ shift_shift_id: { shift_id: sid } })),
          weekly_shifts: weeklyShifts,
          payroll_heads: selHeadIds.map(hid => ({
            payroll_heads_payroll_head_id: { payroll_head_id: hid }
          })),
          documents: documentIds || [],
          face_images: faceImageIds || [],
          avatar: avatarId || formData.avatar || null,
        }

        delete payload.mobile_number
        delete payload.select_category
        delete payload.leave_template
        delete payload.payroll_template
        delete payload.week_off_extra_payment
        delete payload.week_off_day
        delete payload.view_self_salary
        delete payload.view_other_managers
        delete payload.super_admin_access
        delete payload.shift_alignment_type
        delete payload.manage_other_categories
        delete payload.salary
        delete payload.custom_designation
        delete payload.overtime_starts_after_hours
        delete payload.overtime_starts_after_minutes

        if (payload.password && (payload.password.includes('*') || payload.password === '******')) {
          delete payload.password
        }

        payload = Object.fromEntries(
          Object.entries(payload).filter(([_, value]) => value !== null && value !== undefined && value !== '')
        )
      }

      console.log('FINAL PAYLOAD SENT TO DIRECTUS >>>', payload)

      return await rdk.request(
        customEndpoint({
          path: id ? `users/${id}` : `users`,
          method: id ? 'PATCH' : 'POST',
          body: JSON.stringify(payload),
        })
      )
    },

    onSuccess: () => {
      toast.success(id ? 'Staff updated successfully' : 'New staff created successfully')
      queryClient.invalidateQueries({ queryKey: ['staff-by-id', id] })
      queryClient.invalidateQueries({ queryKey: ['staff-list'] })
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      navigate(-1);
    },

    onError: (error: any) => {
      toast.error(error.message || 'Failed to save staff details')
      console.error('Staff mutation error:', error)
    },
  })

  const [isConfirmSaveOpen, setIsConfirmSaveOpen] = useState(false)
  const [pendingFormData, setPendingFormData] = useState<any>(null)

  // Image Lightbox State
  const [lightboxState, setLightboxState] = useState<{
    isOpen: boolean
    src: string | null
    title?: string
  }>({
    isOpen: false,
    src: null,
    title: '',
  })

  const openLightbox = (src: string | null, title?: string) => {
    if (!src) return
    setLightboxState({ isOpen: true, src, title })
  }

  const closeLightbox = () => {
    setLightboxState(prev => ({ ...prev, isOpen: false, src: null }))
  }

  // File download helper for non-image files like PDFs
  const handleDownloadFile = (url: string, filename: string) => {
    try {
      const link = document.createElement('a')
      link.href = url
      link.download = filename || 'document'
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('Download error:', err)
      window.open(url, '_blank')
    }
  }

  // Form Submit Handler
  const onSubmit = async (data: any) => {
    const currentStatus = watch('inactive_date') ? 'archived' : 'active'
    const currentInactiveDate = watch('inactive_date')

    if (currentStatus === 'archived' && (!currentInactiveDate || String(currentInactiveDate).trim() === '')) {
      toast.error('Inactive Date is mandatory when status is archived')
      setActiveTab('basic')
      return
    }

    if (id) {
      setPendingFormData(data)
      setIsConfirmSaveOpen(true)
    } else {
      addOrEditStaffMutation.mutate({ formData: data, isPartialEdit: false })
    }
  }

  // Handle local image file preview
  const handlePhotoPreview = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setSelectedImageFile(file)
      setValue('avatar', file, { shouldDirty: true })
      setProfilePic(URL.createObjectURL(file))
      toast.success('Profile picture preview loaded.')
    }
  }

  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)

  // Explicit Directus upload handler when user clicks "Upload Image"
  const handleUploadProfilePicture = async () => {
    if (!selectedImageFile) {
      toast.error('Please choose a profile picture first')
      return
    }
    const toastId = toast.loading('Uploading profile picture...')
    setIsUploadingPhoto(true)
    try {
      const [uploadedId] = await uploadFiles([selectedImageFile])
      if (!uploadedId) {
        throw new Error('Upload failed')
      }
      setUploadedAvatarAssetId(uploadedId)
      setValue('avatar', uploadedId, { shouldDirty: true })
      if (id) {
        await rdk.request(
          customEndpoint({
            path: `users/${id}`,
            method: 'PATCH',
            body: JSON.stringify({ avatar: uploadedId }),
          })
        )
        queryClient.invalidateQueries({ queryKey: ['staff-by-id', id] })
      }
      setProfilePic(`${API_URL}/assets/${uploadedId}`)
      setSelectedImageFile(null)
      toast.success('Profile picture uploaded successfully', { id: toastId })
    } catch (err: any) {
      console.error('Avatar upload error:', err)
      toast.error(err?.message || 'Failed to upload profile picture', { id: toastId })
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  // Remove profile picture handler
  const handleRemoveProfilePicture = async () => {
    setSelectedImageFile(null)
    setUploadedAvatarAssetId(null)
    setProfilePic(null)
    setValue('avatar', null, { shouldDirty: true })
    if (id) {
      try {
        await rdk.request(
          customEndpoint({
            path: `users/${id}`,
            method: 'PATCH',
            body: JSON.stringify({ avatar: null }),
          })
        )
        queryClient.invalidateQueries({ queryKey: ['staff-by-id', id] })
        toast.success('Profile picture removed')
      } catch (err: any) {
        toast.error('Failed to remove profile picture')
      }
    }
  }

  const [isDragging, setIsDragging] = useState(false)

  const addFilesToTempList = (files: FileList) => {
    const filesArray = Array.from(files)
    const validFiles = filesArray.filter(file => {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      const isImg = file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|svg)$/i.test(file.name)
      if (!isPdf && !isImg) {
        toast.error(`"${file.name}" rejected. Only images and PDF files are allowed.`)
        return false
      }
      return true
    })

    if (validFiles.length === 0) return

    const newItems: UploadedFileItem[] = validFiles.map((file, index) => {
      const sizeStr = file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${(file.size / 1024).toFixed(0)} KB`

      const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|svg)$/i.test(file.name)

      return {
        id: `bulk-doc-${Date.now()}-${index}`,
        name: file.name,
        size: sizeStr,
        url: URL.createObjectURL(file),
        isImage,
        file,
      }
    })

    setTempUploads(prev => [...prev, ...newItems])
    setDocumentsDirty(true)
    toast.success(`${newItems.length} document preview(s) added.`)
  }

  // Handle bulk document uploads (exactly like the screenshot)
  const handleBulkDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToTempList(e.target.files)
    }
  }

  // Handle files drag & drop
  const handleFilesDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToTempList(e.dataTransfer.files)
    }
  }

  const handleRemoveTempUpload = (id: string) => {
    setTempUploads(prev => prev.filter(f => f.id !== id))
    toast.success('Upload preview removed.')
  }

  const handleRemoveSavedDocument = (id: string) => {
    setSavedDocuments(prev => prev.filter(f => f.id !== id))
    setDocumentsDirty(true)
    toast.success('Saved document removed.')
  }

  const addFaceImagesToTempList = (files: FileList) => {
    const filesArray = Array.from(files)
    const newItems: UploadedFileItem[] = filesArray.map((file, index) => {
      const sizeStr = file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${(file.size / 1024).toFixed(0)} KB`

      return {
        id: `face-doc-${Date.now()}-${index}`,
        name: file.name,
        size: sizeStr,
        url: URL.createObjectURL(file),
        isImage: file.type.startsWith('image/'),
        file,
      }
    })

    setTempFaceImages(prev => [...prev, ...newItems])
    setFaceImagesDirty(true)
    toast.success(`${newItems.length} temporary face preview(s) added.`)
  }

  const handleFaceImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFaceImagesToTempList(e.target.files)
    }
  }

  const handleFaceImageDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDraggingFace(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFaceImagesToTempList(e.dataTransfer.files)
    }
  }

  const handleRemoveTempFaceImage = (id: string) => {
    setTempFaceImages(prev => prev.filter(f => f.id !== id))
    toast.success('Temporary face preview removed.')
  }

  const handleRemoveSavedFaceImage = (id: string) => {
    setSavedFaceImages(prev => prev.filter(f => f.id !== id))
    setFaceImagesDirty(true)
    toast.success('Saved face image removed.')
  }

  if (isLoadingEmployee) {
    return (
      <div className="flex bg-white rounded-xl min-w-0 flex-1 items-center justify-center text-[13px] text-muted-foreground">
        Loading employee…
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit, (errs) => {
        console.error('Validation errors:', errs)
        toast.error('Please fill in required fields (First Name & Phone).')
      })}
      className="flex min-w-0 flex-1 gap-2 h-full"
    >
      <Panel
        className={cn(
          'flex min-w-0 flex-1 border-border bg-card overflow-hidden',
          firstTabActive && 'rounded-tl-none',
        )}
      >
        {/* Left Settings Sidebar Nav */}
        <nav className="w-52 shrink-0 overflow-y-auto border-r border-border p-3 bg-muted/10">
          <div className="mb-3">
            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Details
            </p>
            <div className="space-y-0.5">
              {TABS.map((tab) => {
                const TabIcon = tab.icon
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-[13px] transition-colors outline-none',
                      isActive
                        ? 'bg-muted font-semibold text-foreground'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                    )}
                  >
                    <TabIcon className={cn("size-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>
        </nav>

        {/* Right Content Pane */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Section Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-3.5 shrink-0 bg-card">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => navigate(-1)}
                className="size-8 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Back"
              >
                <ArrowLeft className="size-4" />
              </Button>
              <div>
                <h1 className="text-sm font-semibold">{META[activeTab].title}</h1>
                <p className="text-[13px] text-muted-foreground mt-0.5">{META[activeTab].desc}</p>
              </div>
            </div>
            {/* <Button
              type="submit"
              disabled={updateMutation.isPending || createMutation.isPending}
              className="btn-3d flex items-center gap-1.5 bg-primary text-primary-foreground font-medium rounded-lg h-8 px-4 cursor-pointer text-xs disabled:opacity-50"
            >
              <Check className="size-3.5" />
              {updateMutation.isPending || createMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button> */}
          </div>

          {/* Scrollable Form Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* ==================== BASIC INFO TAB ==================== */}
            <div className={cn("space-y-6", activeTab !== 'basic' && "hidden")}>
                {/* Profile Picture */}
                <div>
                  <Label className="text-[13px] font-semibold mb-3 block text-foreground">Change Profile Picture</Label>
                  <div className="flex items-center gap-4">
                    {profilePic ? (
                      <img
                        src={profilePic}
                        alt="Preview"
                        onClick={() => openLightbox(profilePic, `${firstName || 'Staff'} Profile Picture`)}
                        className="size-16 rounded-full object-cover border border-border shadow-xs cursor-pointer hover:opacity-85 transition-opacity"
                        title="Click to view full image"
                      />
                    ) : (
                      <PersonAvatar
                        name={`${firstName || ''} ${lastName || ''}`}
                        sex={String(gender || '').toLowerCase() === 'female' ? 'woman' : 'man'}
                        className="size-16 rounded-full border border-border shadow-inner"
                      />
                    )}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          type="file"
                          id="profile-pic-upload"
                          className="hidden"
                          accept="image/*"
                          onClick={(e: any) => { e.target.value = null }}
                          onChange={handlePhotoPreview}
                        />
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs font-medium cursor-pointer"
                        >
                          <label htmlFor="profile-pic-upload" className="flex items-center gap-1.5 cursor-pointer">
                            <Upload className="size-3.5" />
                            {profilePic ? "Change Picture" : "Choose Picture"}
                          </label>
                        </Button>

                        {selectedImageFile && (
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            disabled={isUploadingPhoto}
                            className="h-8 text-xs font-medium cursor-pointer gap-1.5"
                            onClick={handleUploadProfilePicture}
                          >
                            <Upload className="size-3.5" />
                            {isUploadingPhoto ? 'Uploading...' : 'Upload Now'}
                          </Button>
                        )}

                        {profilePic && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs font-medium text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                            onClick={handleRemoveProfilePicture}
                          >
                            <Trash2 className="size-3.5 mr-1" />
                            Remove
                          </Button>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground block mt-1.5">
                        Allowed formats: JPG, PNG, GIF, WebP
                      </span>
                    </div>
                  </div>
                </div>

                {/* Personal Details Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="first_name" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                      First Name <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="first_name"
                      {...register('first_name')}
                      placeholder="Enter first name"
                    />
                    {errors.first_name && (
                      <p className="text-[11px] font-medium text-rose-500 mt-1">{errors.first_name.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="last_name" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                      Last Name
                    </Label>
                    <Input
                      id="last_name"
                      {...register('last_name')}
                      placeholder="Enter last name"
                    />
                  </div>

                  <div>
                    <Label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                      Change Employee Status
                    </Label>
                    <div className="flex items-center gap-2 h-9">
                      <button
                        type="button"
                        onClick={() => setValue('inactive_date', null)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 h-8 rounded-lg border text-xs font-medium transition-colors cursor-pointer",
                          !inactiveDate
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold"
                            : "border-border hover:bg-muted text-muted-foreground"
                        )}
                      >
                        <span className="size-2 rounded-full bg-emerald-500" />
                        Active
                      </button>
                      <button
                        type="button"
                        onClick={() => setValue('inactive_date', new Date().toISOString() as any)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 h-8 rounded-lg border text-xs font-medium transition-colors cursor-pointer",
                          inactiveDate
                            ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold"
                            : "border-border hover:bg-muted text-muted-foreground"
                        )}
                      >
                        <span className="size-2 rounded-full bg-rose-500" />
                        Archived
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="mobile_number" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                      Phone <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="mobile_number"
                      {...register('mobile_number')}
                      placeholder="Enter phone number"
                    />
                    {errors.mobile_number && (
                      <p className="text-[11px] font-medium text-rose-500 mt-1">{errors.mobile_number.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="country" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                      Select Country
                    </Label>
                    <Controller
                      control={control}
                      name="country"
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <SelectTrigger id="country">
                            <SelectValue placeholder="Select country" />
                          </SelectTrigger>
                          <SelectContent>
                            {COUNTRIES.map(c => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div>
                    <Label htmlFor="password" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                      App Login Password
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      {...register('password')}
                      placeholder={id ? "•••••••• (Leave blank to keep unchanged)" : "Set password for mobile app"}
                    />
                    <span className="text-[10px] text-muted-foreground mt-1.5 block">
                      {id ? "Leave unchanged if you do not want to update password" : "Staff member will use this password to log into mobile app"}
                    </span>
                  </div>

                  <div>
                    <Label htmlFor="employee_email_address" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                      Email Address
                    </Label>
                    <Input
                      id="employee_email_address"
                      type="text"
                      {...register('employee_email_address')}
                      placeholder="Enter email address"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="employee_address" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                    Address
                  </Label>
                  <Textarea
                    id="employee_address"
                    rows={3}
                    {...register('employee_address')}
                    placeholder="Enter postal address"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="employee_birthdate" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                      Birthdate
                    </Label>
                    <Controller
                      control={control}
                      name="employee_birthdate"
                      render={({ field }) => (
                        <FormDatePicker
                          id="employee_birthdate"
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Select birthdate"
                        />
                      )}
                    />
                  </div>

                  <div>
                    <Label htmlFor="employee_blood_group" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                      Blood Group
                    </Label>
                    <Controller
                      control={control}
                      name="employee_blood_group"
                      render={({ field }) => (
                        <Select
                          onValueChange={(val) => field.onChange(val === 'none' ? '' : val)}
                          value={field.value || 'none'}
                        >
                          <SelectTrigger id="employee_blood_group">
                            <SelectValue placeholder="Select blood group" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Select blood group</SelectItem>
                            {BLOOD_GROUPS.map(bg => (
                              <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div>
                    <Label htmlFor="emergency_contact_name" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                      Emergency Contact Name
                    </Label>
                    <Input
                      id="emergency_contact_name"
                      {...register('emergency_contact_name')}
                      placeholder="Enter name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="emergency_contact_phone" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                      Emergency Contact Phone
                    </Label>
                    <Input
                      id="emergency_contact_phone"
                      {...register('emergency_contact_phone')}
                      placeholder="+91..."
                    />
                  </div>

                  <div>
                    <Label htmlFor="marital_status" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                      Marital Status
                    </Label>
                    <Controller
                      control={control}
                      name="marital_status"
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <SelectTrigger id="marital_status">
                            <SelectValue placeholder="Select marital status" />
                          </SelectTrigger>
                          <SelectContent>
                            {MARITAL_STATUSES.map(ms => (
                              <SelectItem key={ms} value={ms}>{ms}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div>
                    <Label htmlFor="pan_number" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                      PAN Card Number
                    </Label>
                    <Input
                      id="pan_number"
                      {...register('pan_number')}
                      placeholder="ABCDE1234F"
                    />
                  </div>

                  <div>
                    <Label htmlFor="aadhaar_number" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                      Aadhaar Number
                    </Label>
                    <Input
                      id="aadhaar_number"
                      {...register('aadhaar_number')}
                      placeholder="123456789012"
                    />
                  </div>

                  <div>
                    <Label htmlFor="pf_no" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                      PF Number
                    </Label>
                    <Input
                      id="pf_no"
                      {...register('pf_no')}
                      placeholder="Enter PF registration number"
                    />
                  </div>

                  <div>
                    <Label htmlFor="uan" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                      UAN
                    </Label>
                    <Input
                      id="uan"
                      {...register('uan')}
                      placeholder="Enter Universal Account Number"
                    />
                  </div>
                </div>

                {/* ESI Group Segment */}
                <div className="p-4 rounded-xl border border-border bg-muted/30">
                  <div className="flex items-center gap-2 mb-4">
                    <Controller
                      control={control}
                      name="esi_applicable"
                      render={({ field }) => (
                        <Switch
                          id="esi_applicable"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                    <Label htmlFor="esi_applicable" className="text-[13px] font-medium text-foreground cursor-pointer select-none">
                      ESI Applicable (check to apply ESI)
                    </Label>
                  </div>

                  {esiApplicable && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="esi_no" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                          ESI Number
                        </Label>
                        <Input
                          id="esi_no"
                          {...register('esi_no')}
                          placeholder="Enter ESI Number"
                        />
                      </div>
                      <div>
                        <Label htmlFor="esi_to_deduct_till" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                          ESI Deduction Till
                        </Label>
                        <Controller
                          control={control}
                          name="esi_to_deduct_till"
                          render={({ field }) => (
                            <FormDatePicker
                              id="esi_to_deduct_till"
                              value={field.value}
                              onChange={field.onChange}
                              placeholder="Select deduction till"
                            />
                          )}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* + Add Document Section */}
                <div className='p-4 rounded-xl border border-border bg-card'>
                  <Label htmlFor="document" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                    + Add Documents
                  </Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div
                      className={cn(
                        "rounded-xl border-2 border-dashed transition-all duration-200 select-none",
                        isDragging
                          ? "border-primary bg-primary/5 scale-[1.01]"
                          : "border-border/60 bg-card hover:border-primary/40 hover:bg-primary/[0.02]"
                      )}
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleFilesDrop}
                    >
                      <input
                        type="file"
                        multiple
                        id="bulk-document-upload"
                        className="hidden"
                        accept="image/*,application/pdf,.pdf"
                        onChange={handleBulkDocumentUpload}
                      />
                      <label
                        htmlFor="bulk-document-upload"
                        className="flex flex-col items-center justify-center gap-3 p-8 cursor-pointer"
                      >
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors",
                          isDragging ? "bg-primary/15" : "bg-muted"
                        )}>
                          <Upload className={cn("size-5 transition-colors", isDragging ? "text-primary" : "text-muted-foreground")} />
                        </div>
                        <div className="text-center space-y-1">
                          <p className={cn("text-[13px] font-semibold transition-colors", isDragging ? "text-primary" : "text-foreground")}>
                            {isDragging ? "Release to upload files" : "Drag & drop files here"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            or{" "}
                            <span className={cn("font-semibold underline underline-offset-2 transition-colors", isDragging ? "text-primary" : "text-primary/80")}>
                              click to browse
                            </span>{" "}
                            from your device
                          </p>
                          <p className="text-[10px] text-muted-foreground/70 pt-1">
                            PDF, JPG, PNG, WEBP supported · Max 10 MB per file
                          </p>
                        </div>
                      </label>

                      {/* Upload Preview rendered directly underneath inside the same card */}
                      {tempUploads.length > 0 && (
                        <div className="mx-4 mb-4 pt-4 border-t border-border/65 space-y-3">
                          <span className="text-[11px] font-bold text-muted-foreground block uppercase tracking-wider">
                            Upload Previews ({tempUploads.length})
                          </span>
                          <div className="space-y-2">
                            {tempUploads.map((doc) => (
                              <div
                                key={doc.id}
                                className="flex items-center justify-between p-2.5 border border-border rounded-xl bg-muted/20 min-h-[60px]"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  {doc.isImage && doc.url ? (
                                    <img
                                      src={doc.url}
                                      alt={doc.name}
                                      onClick={() => openLightbox(doc.url, doc.name)}
                                      className="w-10 h-14 object-cover rounded-md border border-border shrink-0 cursor-pointer hover:opacity-85 transition-opacity"
                                      title="Click to preview image"
                                    />
                                  ) : (
                                    <div
                                      onClick={() => handleDownloadFile(doc.url, doc.name)}
                                      className="w-10 h-14 flex items-center justify-center bg-muted rounded-md border border-border shrink-0 cursor-pointer hover:bg-muted/80 transition-colors"
                                      title="Click to download/open file"
                                    >
                                      <FileText className="size-5 text-muted-foreground" />
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <span
                                      className="text-[12px] font-semibold text-foreground block truncate cursor-pointer hover:underline"
                                      onClick={() => {
                                        if (doc.isImage) openLightbox(doc.url, doc.name)
                                        else handleDownloadFile(doc.url, doc.name)
                                      }}
                                    >
                                      {doc.name}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                                      {doc.size}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {doc.isImage ? (
                                    <button
                                      type="button"
                                      onClick={() => openLightbox(doc.url, doc.name)}
                                      className="text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 p-2 rounded-lg cursor-pointer transition-colors"
                                      title="Preview Image"
                                    >
                                      <Eye className="size-3.5" />
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleDownloadFile(doc.url, doc.name)}
                                      className="text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 p-2 rounded-lg cursor-pointer transition-colors"
                                      title="Download / Open File"
                                    >
                                      <Download className="size-3.5" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveTempUpload(doc.id)}
                                    className="text-rose-500 hover:text-rose-700 bg-rose-500/10 hover:bg-rose-500/20 p-2 rounded-lg cursor-pointer transition-colors"
                                    title="Remove Preview"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Saved Documents Section */}
                    <div className="h-full p-4 rounded-xl border border-border bg-card">
                      <span className="text-[13px] font-semibold text-foreground block mb-3">
                        Documents
                      </span>
                      {savedDocuments.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">No saved documents yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {savedDocuments.map((doc) => (
                            <div
                              key={doc.id}
                              className="flex items-center justify-between p-3 border border-border rounded-xl bg-muted/10 min-h-[70px]"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                {doc.isImage && doc.url ? (
                                  <img
                                    src={doc.url}
                                    alt={doc.name}
                                    onClick={() => openLightbox(doc.url, doc.name)}
                                    className="w-12 h-16 object-cover rounded-md border border-border shrink-0 cursor-pointer hover:opacity-85 transition-opacity"
                                    title="Click to preview image"
                                  />
                                ) : (
                                  <div
                                    onClick={() => handleDownloadFile(doc.url, doc.name)}
                                    className="w-12 h-16 flex items-center justify-center bg-muted rounded-md border border-border shrink-0 cursor-pointer hover:bg-muted/80 transition-colors"
                                    title="Click to download/open file"
                                  >
                                    <FileText className="size-6 text-muted-foreground" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <span
                                    className="text-[13px] font-semibold text-foreground block truncate cursor-pointer hover:underline"
                                    onClick={() => {
                                      if (doc.isImage) openLightbox(doc.url, doc.name)
                                      else handleDownloadFile(doc.url, doc.name)
                                    }}
                                  >
                                    {doc.name}
                                  </span>
                                  <span className="text-[11px] text-muted-foreground block mt-0.5">
                                    {doc.size}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {doc.isImage ? (
                                  <button
                                    type="button"
                                    onClick={() => openLightbox(doc.url, doc.name)}
                                    className="text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 p-2 rounded-lg cursor-pointer transition-colors"
                                    title="Preview Image"
                                  >
                                    <Eye className="size-4" />
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadFile(doc.url, doc.name)}
                                    className="text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 p-2 rounded-lg cursor-pointer transition-colors"
                                    title="Download File"
                                  >
                                    <Download className="size-4" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSavedDocument(doc.id)}
                                  className="text-rose-500 hover:text-rose-700 bg-rose-500/10 hover:bg-rose-500/20 p-2 rounded-lg cursor-pointer transition-colors"
                                  title="Remove Document"
                                >
                                  <Trash2 className="size-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

            </div>

            {/* ==================== EMPLOYMENT & BANK TAB ==================== */}
            <div className={cn("space-y-6", activeTab !== 'employment' && "hidden")}>
                <div className="border border-border rounded-xl p-6 bg-card space-y-6">
                  {/* Basic Employment Info Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="employee_type" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                        Employee Type
                      </Label>
                      <Controller
                        control={control}
                        name="role"
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ROLE_EMPLOYEE}>
                            <SelectTrigger id="employee_type">
                              <SelectValue placeholder="Select employee type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={ROLE_EMPLOYEE}>Employee</SelectItem>
                              <SelectItem value={ROLE_MANAGER}>Manager</SelectItem>
                              <SelectItem value={ROLE_ADMIN}>Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    {(role === ROLE_ADMIN || role === 'Admin') ? (
                      <div className="flex items-center gap-3 pt-5">
                        <Controller
                          control={control}
                          name="super_admin_access"
                          render={({ field }) => (
                            <Switch
                              id="super_admin_access"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          )}
                        />
                        <div>
                          <Label htmlFor="super_admin_access" className="text-[13px] font-medium text-foreground cursor-pointer select-none">
                            Super Admin Access
                          </Label>
                          <span className="text-[10px] text-muted-foreground block mt-0.5">
                            super admin will have all access permissions
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <Label htmlFor="employee_category_id" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                          Select Category
                        </Label>
                        <Controller
                          control={control}
                          name="employee_category_id"
                          render={({ field }) => (
                            <Select
                              onValueChange={(val) => {
                                field.onChange(val)
                                setValue('select_category', val)
                              }}
                              value={field.value ? String(field.value) : ""}
                            >
                              <SelectTrigger id="employee_category_id">
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                              <SelectContent>
                                {dbCategories.map((c: any) => {
                                  const catId = String(c.employee_category_id || c.id)
                                  const catName = c.employee_category_name || c.name || `Category #${catId}`
                                  return (
                                    <SelectItem key={catId} value={catId}>
                                      {catName}
                                    </SelectItem>
                                  )
                                })}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                    )}

                    {/* Dynamic Manager Fields */}
                    {(role === ROLE_MANAGER || role === 'Manager') && (
                      <>
                        <div className="md:col-span-2">
                          <Label htmlFor="manage_other_categories" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                            Manage Other Categories
                          </Label>
                          <Controller
                            control={control}
                            name="manage_other_categories"
                            render={({ field }) => {
                              const anchor = manageCategoriesAnchor
                              const selectedValues = Array.isArray(field.value) ? field.value : []
                              const categoryOptions = dbCategories.map((c: any) => c.name || c.employee_category_name).filter(Boolean)

                              return (
                                <Combobox
                                  multiple
                                  autoHighlight
                                  items={categoryOptions.length > 0 ? categoryOptions : (CATEGORIES as any)}
                                  value={selectedValues}
                                  onValueChange={(vals) => {
                                    field.onChange(vals)
                                    // Also sync other_category_ids with matching category IDs
                                    const matchedIds = (vals || []).map((nameOrId: string) => {
                                      const matched = dbCategories.find((c: any) => (c.name || c.employee_category_name) === nameOrId || String(c.employee_category_id || c.id) === String(nameOrId))
                                      return matched ? Number(matched.employee_category_id || matched.id) : (Number(nameOrId) || null)
                                    }).filter(Boolean)
                                    setValue('other_category_ids', matchedIds)
                                  }}
                                >
                                  <ComboboxChips ref={anchor} className="w-full bg-background border border-input">
                                    <ComboboxValue>
                                      {(values) => (
                                        <>
                                          {values.map((val: string) => (
                                            <ComboboxChip key={val}>{val}</ComboboxChip>
                                          ))}
                                          <ComboboxChipsInput placeholder="Choose categories..." />
                                        </>
                                      )}
                                    </ComboboxValue>
                                  </ComboboxChips>
                                  <ComboboxContent anchor={anchor}>
                                    <ComboboxEmpty>No categories found.</ComboboxEmpty>
                                    <ComboboxList>
                                      {(item) => (
                                        <ComboboxItem key={item} value={item}>
                                          {item}
                                        </ComboboxItem>
                                      )}
                                    </ComboboxList>
                                  </ComboboxContent>
                                </Combobox>
                              )
                            }}
                          />
                        </div>

                        <div className="flex items-center gap-3">
                          <Controller
                            control={control}
                            name="can_view_manager"
                            render={({ field }) => (
                              <Switch
                                id="can_view_manager"
                                checked={field.value}
                                onCheckedChange={(chk) => {
                                  field.onChange(chk)
                                  setValue('view_other_managers', chk)
                                }}
                              />
                            )}
                          />
                          <div>
                            <Label htmlFor="can_view_manager" className="text-[13px] font-medium text-foreground cursor-pointer select-none">
                              View Other Managers
                            </Label>
                            <span className="text-[10px] text-muted-foreground block mt-0.5">
                              Manager can view and manage other managers across categories
                            </span>
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="designation_id_perm" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                            Select Designation (For custom permissions)
                          </Label>
                          <Controller
                            control={control}
                            name="designation_id"
                            render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value ? String(field.value) : "none"}>
                                <SelectTrigger id="designation_id_perm">
                                  <SelectValue placeholder="Select designation" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">None</SelectItem>
                                  {dbDesignations.map((d: any) => {
                                    const desId = String(d.designation_id || d.id)
                                    const desName = d.designation_name || d.name || `Designation #${desId}`
                                    return (
                                      <SelectItem key={desId} value={desId}>
                                        {desName}
                                      </SelectItem>
                                    )
                                  })}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <Label htmlFor="title" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                        Designation Name
                      </Label>
                      <Input
                        id="title"
                        {...register('title')}
                        placeholder="Sales Executive"
                      />
                    </div>

                    <div>
                      <Label htmlFor="department_name" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                        Department
                      </Label>
                      <Input
                        id="department_name"
                        {...register('department_name')}
                        placeholder="Sales"
                      />
                    </div>
                  </div>

                  {/* 3-column Grid for Employee Code, Gender, DOJ */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="employee_code" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                        Employee Code
                      </Label>
                      <Input
                        id="employee_code"
                        {...register('employee_code')}
                        placeholder="MHSB/JPR/25/108"
                      />
                    </div>

                    <div>
                      <Label htmlFor="gender" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                        Gender
                      </Label>
                      <Controller
                        control={control}
                        name="gender"
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <SelectTrigger id="gender">
                              <SelectValue placeholder="Select gender" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Male">Male</SelectItem>
                              <SelectItem value="Female">Female</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    <div>
                      <Label htmlFor="doj" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                        Date of Joining
                      </Label>
                      <Controller
                        control={control}
                        name="doj"
                        render={({ field }) => (
                          <FormDatePicker
                            id="doj"
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Select joining date"
                          />
                        )}
                      />
                    </div>
                  </div>

                  {/* Bank Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border/50">
                    <div>
                      <Label htmlFor="employee_bank_ac_number" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                        Bank Account Number
                      </Label>
                      <Input
                        id="employee_bank_ac_number"
                        {...register('employee_bank_ac_number')}
                        placeholder="Enter bank account number"
                      />
                    </div>

                    <div>
                      <Label htmlFor="employee_bank_ifsc" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                        IFSC Code
                      </Label>
                      <Input
                        id="employee_bank_ifsc"
                        {...register('employee_bank_ifsc')}
                        placeholder="Enter IFSC code"
                      />
                    </div>

                    <div>
                      <Label htmlFor="employee_bank_name" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                        Bank Name
                      </Label>
                      <Input
                        id="employee_bank_name"
                        {...register('employee_bank_name')}
                        placeholder="Enter bank name"
                      />
                    </div>

                    <div>
                      <Label htmlFor="employee_bank_branch_name" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                        Branch Name
                      </Label>
                      <Input
                        id="employee_bank_branch_name"
                        {...register('employee_bank_branch_name')}
                        placeholder="Enter branch name"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <Label htmlFor="employee_bank_ac_holder_name" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                        Bank A/C Holder Name
                      </Label>
                      <Input
                        id="employee_bank_ac_holder_name"
                        {...register('employee_bank_ac_holder_name')}
                        placeholder="Enter account holder name"
                      />
                    </div>
                  </div>
                </div>
            </div>

            {/* ==================== ATTENDANCE SETTINGS TAB ==================== */}
            <div className={cn("space-y-6", activeTab !== 'attendance' && "hidden")}>
                <div className="border border-border rounded-xl p-6 bg-card space-y-6">

                  {/* Row 1: Mobile & Multiple Attendance */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex items-center gap-3">
                      <Controller
                        control={control}
                        name="mobile_attendance"
                        render={({ field }) => (
                          <Switch
                            id="mobile_attendance"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        )}
                      />
                      <div>
                        <Label htmlFor="mobile_attendance" className="text-[13px] font-medium text-foreground cursor-pointer select-none">
                          Mobile Attendance
                        </Label>
                        <span className="text-[10px] text-muted-foreground block mt-0.5">
                          Allow attendance marking from mobile app
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Controller
                        control={control}
                        name="multiple_attendance"
                        render={({ field }) => (
                          <Switch
                            id="multiple_attendance"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        )}
                      />
                      <div>
                        <Label htmlFor="multiple_attendance" className="text-[13px] font-medium text-foreground cursor-pointer select-none">
                          Multiple Attendance
                        </Label>
                        <span className="text-[10px] text-muted-foreground block mt-0.5">
                          Allow multiple attendance entries per day
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Shiftwise Attendance & Odometer */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/50">
                    <div className="flex items-center gap-3">
                      <Controller
                        control={control}
                        name="shiftwise_attendance"
                        render={({ field }) => (
                          <Switch
                            id="shiftwise_attendance"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        )}
                      />
                      <div>
                        <Label htmlFor="shiftwise_attendance" className="text-[13px] font-medium text-foreground cursor-pointer select-none">
                          Shiftwise Attendance
                        </Label>
                        <span className="text-[10px] text-muted-foreground block mt-0.5">
                          Enable shift assignment for this employee
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Controller
                        control={control}
                        name="self_odometer_reading"
                        render={({ field }) => (
                          <Switch
                            id="self_odometer_reading"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        )}
                      />
                      <div>
                        <Label htmlFor="self_odometer_reading" className="text-[13px] font-medium text-foreground cursor-pointer select-none">
                          View Odometer Reading
                        </Label>
                        <span className="text-[10px] text-muted-foreground block mt-0.5">
                          Allow employee to see their odometer readings
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Shift Options */}
                  {shiftwiseAttendance && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/50">
                      <div>
                        <Label htmlFor="shift_alignment_type" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                          Shift Alignment Type
                        </Label>
                        <Controller
                          control={control}
                          name="shift_alignment_type"
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value || ""}>
                              <SelectTrigger id="shift_alignment_type">
                                <SelectValue placeholder="Select alignment" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Fixed">Fixed</SelectItem>
                                <SelectItem value="Weekly">Weekly</SelectItem>
                                <SelectItem value="Flexible">Flexible</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                        <span className="text-[10px] text-muted-foreground mt-1.5 block">
                          Select how shifts are aligned for this employee
                        </span>
                      </div>

                      {shiftAlignmentType === 'Fixed' && (
                        <div className="p-4 rounded-xl border border-border bg-muted/10 flex items-center justify-between">
                          <div>
                            <h4 className="text-[12px] font-bold text-foreground">Overall Assigned Shifts</h4>
                            <p className="text-[10px] text-muted-foreground mt-0.5">This will be applicable everyday</p>
                            <span className="inline-block bg-primary/10 text-primary text-[10px] font-semibold px-2 py-0.5 rounded-md mt-2">
                              {selectedShiftsCount} Shifts Selected
                            </span>
                          </div>

                          {/* Shadcn UI Sheet for Manage Shifts */}
                          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                            <SheetTrigger asChild>
                              <Button type="button" variant="outline" size="sm" className="h-8 text-xs font-semibold cursor-pointer">
                                Change Shifts
                              </Button>
                            </SheetTrigger>
                            <SheetContent className="w-[400px] sm:w-[480px]">
                              <SheetHeader className="flex flex-row items-center justify-between border-b pb-4">
                                <SheetTitle className="text-lg font-bold">Manage Shifts</SheetTitle>

                                {/* Nested Dialog to Add New Shift */}
                                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                                  <DialogTrigger asChild>
                                    <Button size="sm" className="h-8 text-xs font-semibold bg-foreground hover:bg-foreground/90 text-background px-3 cursor-pointer rounded-lg">
                                      Add New Shift
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="sm:max-w-[425px]">
                                    <DialogHeader>
                                      <DialogTitle>Add New Shift</DialogTitle>
                                      <DialogDescription>
                                        Create a new work shift schedule for employees.
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-4">
                                      <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="new_shift_name" className="text-right text-xs">
                                          Shift Name
                                        </Label>
                                        <Input id="new_shift_name" placeholder="Morning Shift B" className="col-span-3 h-8 text-xs bg-background border border-input" />
                                      </div>
                                      <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="new_shift_time" className="text-right text-xs">
                                          Shift Timing
                                        </Label>
                                        <Input id="new_shift_time" placeholder="(09:00 AM) - (06:00 PM)" className="col-span-3 h-8 text-xs bg-background border border-input" />
                                      </div>
                                    </div>
                                    <div className="flex justify-end gap-2">
                                      <Button type="button" variant="outline" size="sm" className="h-8 text-xs cursor-pointer" onClick={() => setIsDialogOpen(false)}>
                                        Cancel
                                      </Button>
                                      <Button type="button" size="sm" className="h-8 text-xs cursor-pointer bg-primary text-primary-foreground font-semibold" onClick={() => {
                                        toast.success("New shift created successfully!");
                                        setIsDialogOpen(false);
                                      }}>
                                        Save Shift
                                      </Button>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              </SheetHeader>

                              <div className="p-4">
                                <span className="text-[11px] font-bold text-muted-foreground block uppercase tracking-wider mb-4">
                                  Select Shift
                                </span>

                                <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
                                  {shifts.map((s) => (
                                    <div key={s.id} className="flex items-start gap-3 p-3 border border-border rounded-xl bg-muted/10">
                                      <Checkbox
                                        id={`shift-checkbox-${s.id}`}
                                        checked={s.selected}
                                        onCheckedChange={(checked) => {
                                          setShifts(prev => prev.map(item => item.id === s.id ? { ...item, selected: !!checked } : item))
                                        }}
                                        className="mt-0.5"
                                      />
                                      <div className="space-y-0.5">
                                        <Label htmlFor={`shift-checkbox-${s.id}`} className="text-xs font-semibold text-foreground cursor-pointer select-none block">
                                          {s.name}
                                        </Label>
                                        <span className="text-[10px] text-muted-foreground block font-mono">
                                          {s.time}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </SheetContent>
                          </Sheet>
                        </div>
                      )}

                      {/* Weekly Shift Assignment */}
                      {shiftAlignmentType === 'Weekly' && (
                        <div className="col-span-full mt-4 space-y-3">
                          <div className="mb-2">
                            <h4 className="text-[12px] font-bold text-foreground">Weekly Shift Assignment</h4>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Assign different shifts for each day of the week</p>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            {WEEK_DAYS.map((day) => {
                              const selected = weeklyShifts[day] || []
                              const selectedNames = selected
                                .map(sid => ALL_SHIFTS.find(s => s.id === sid)?.name)
                                .filter(Boolean)
                                .join(', ')
                              return (
                                <div key={day} className="flex items-center justify-between p-3.5 border border-border rounded-xl bg-muted/10">
                                  <div>
                                    <p className="text-[12px] font-semibold text-foreground">{day} Shifts</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                      {selected.length === 0 ? 'No Shift assigned' : selectedNames}
                                    </p>
                                  </div>
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="h-8 text-xs font-semibold bg-foreground hover:bg-foreground/90 text-background px-4 cursor-pointer rounded-lg"
                                    onClick={() => setActiveDaySheet(day)}
                                  >
                                    Select
                                  </Button>
                                </div>
                              )
                            })}
                          </div>

                          {/* Per-Day Shift Selection Sheet */}
                          <Sheet open={!!activeDaySheet} onOpenChange={(open) => { if (!open) setActiveDaySheet(null) }}>
                            <SheetContent className="w-[400px] sm:w-[480px]">
                              <SheetHeader className="flex flex-row items-center justify-between border-b pb-4">
                                <SheetTitle className="text-lg font-bold">{activeDaySheet} Shifts</SheetTitle>
                              </SheetHeader>

                              <div className="p-4">
                                <span className="text-[11px] font-bold text-muted-foreground block uppercase tracking-wider mb-4">
                                  Select Shifts for {activeDaySheet}
                                </span>

                                <div className="space-y-3 max-h-[75vh] overflow-y-auto pr-2">
                                  {ALL_SHIFTS.map((s) => {
                                    const isSelected = activeDaySheet ? (weeklyShifts[activeDaySheet] || []).includes(s.id) : false
                                    return (
                                      <div key={s.id} className="flex items-start gap-3 p-3 border border-border rounded-xl bg-muted/10">
                                        <Checkbox
                                          id={`weekly-shift-${activeDaySheet}-${s.id}`}
                                          checked={isSelected}
                                          onCheckedChange={(checked) => {
                                            if (!activeDaySheet) return
                                            setWeeklyShifts(prev => {
                                              const current = prev[activeDaySheet] || []
                                              return {
                                                ...prev,
                                                [activeDaySheet]: checked
                                                  ? [...current, s.id]
                                                  : current.filter(id => id !== s.id)
                                              }
                                            })
                                          }}
                                          className="mt-0.5"
                                        />
                                        <div className="space-y-0.5">
                                          <Label
                                            htmlFor={`weekly-shift-${activeDaySheet}-${s.id}`}
                                            className="text-xs font-semibold text-foreground cursor-pointer select-none block"
                                          >
                                            {s.name}
                                          </Label>
                                          {s.time && (
                                            <span className="text-[10px] text-muted-foreground block font-mono">
                                              {s.time}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            </SheetContent>
                          </Sheet>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Row 3: Live Tracking & Punch From */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/50">
                    <div className="flex items-center gap-3">
                      <Controller
                        control={control}
                        name="live_tracking"
                        render={({ field }) => (
                          <Switch
                            id="live_tracking"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        )}
                      />
                      <div>
                        <Label htmlFor="live_tracking" className="text-[13px] font-medium text-foreground cursor-pointer select-none">
                          Live Tracking
                        </Label>
                        <span className="text-[10px] text-muted-foreground block mt-0.5">
                          Enable live location tracking
                        </span>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="punch_from" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                        Punch From
                      </Label>
                      <Controller
                        control={control}
                        name="punch_from"
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <SelectTrigger id="punch_from">
                              <SelectValue placeholder="Select punch boundary" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Geofence">Geofence</SelectItem>
                              <SelectItem value="Anywhere">Anywhere</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                      <span className="text-[10px] text-muted-foreground mt-1.5 block">
                        Choose allowed punch-in location
                      </span>
                    </div>
                  </div>



                  {/* Row 4: AI Selfie Verification */}
                  <div className="pt-4">
                    <div className="flex items-center gap-3">
                      <Controller
                        control={control}
                        name="ai_selfie_verification"
                        render={({ field }) => (
                          <Switch
                            id="ai_selfie_verification"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        )}
                      />
                      <div>
                        <Label htmlFor="ai_selfie_verification" className="text-[13px] font-medium text-foreground cursor-pointer select-none">
                          AI Selfie Verification
                        </Label>
                        <span className="text-[10px] text-muted-foreground block mt-0.5">
                          Enable AI based selfie verification for attendance
                        </span>
                      </div>
                    </div>
                  </div>


                  {/* Dynamic Face Images Upload Section */}
                  {aiSelfieVerification && (
                    <div className='p-4 rounded-xl border border-border bg-card'>
                      <Label htmlFor="face_images" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                        + Add Face Images
                      </Label>
                      <div className="space-y-4 grid md:grid-cols-2 gap-2 pt-4 border-t border-border/50">
                        {/* Drag & Drop Card */}
                        <div
                          className={cn(
                            "h-full rounded-xl border-2 border-dashed transition-all duration-200 select-none",
                            isDraggingFace
                              ? "border-primary bg-primary/5 scale-[1.01]"
                              : "border-border/60 bg-card hover:border-primary/40 hover:bg-primary/[0.02]"
                          )}
                          onDragOver={(e) => { e.preventDefault(); setIsDraggingFace(true); }}
                          onDragLeave={() => setIsDraggingFace(false)}
                          onDrop={handleFaceImageDrop}
                        >
                          <input
                            type="file"
                            multiple
                            id="face-image-upload"
                            className="hidden"
                            accept="image/*"
                            onChange={handleFaceImageUpload}
                          />
                          <label
                            htmlFor="face-image-upload"
                            className="flex flex-col items-center justify-center gap-3 p-8 cursor-pointer"
                          >
                            <div className={cn(
                              "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors",
                              isDraggingFace ? "bg-primary/15" : "bg-muted"
                            )}>
                              <User className={cn("size-5 transition-colors", isDraggingFace ? "text-primary" : "text-muted-foreground")} />
                            </div>
                            <div className="text-center space-y-1">
                              <p className={cn("text-[13px] font-semibold transition-colors", isDraggingFace ? "text-primary" : "text-foreground")}>
                                {isDraggingFace ? "Release to upload image" : "Drag & drop face image here"}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                or{" "}
                                <span className={cn("font-semibold underline underline-offset-2 transition-colors", isDraggingFace ? "text-primary" : "text-primary/80")}>
                                  click to browse
                                </span>{" "}
                                from your device
                              </p>
                              <p className="text-[10px] text-muted-foreground/70 pt-1">
                                JPG, PNG, WEBP supported · Clear face photo required
                              </p>
                            </div>
                          </label>

                          {/* Temp upload previews inside dropzone */}
                          {tempFaceImages.length > 0 && (
                            <div className="mx-4 mb-4 pt-4 border-t border-border/65 space-y-3">
                              <span className="text-[11px] font-bold text-muted-foreground block uppercase tracking-wider">
                                New Face Previews ({tempFaceImages.length})
                              </span>
                              <div className="space-y-2">
                                {tempFaceImages.map((doc) => (
                                  <div
                                    key={doc.id}
                                    className="flex items-center justify-between p-2.5 border border-border rounded-xl bg-muted/20 min-h-[60px]"
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <img
                                        src={doc.url}
                                        alt={doc.name}
                                        onClick={() => openLightbox(doc.url, doc.name)}
                                        className="w-10 h-10 object-cover rounded-full border border-border shrink-0 cursor-pointer hover:opacity-85 transition-opacity"
                                        title="Click to preview face image"
                                      />
                                      <div className="min-w-0">
                                        <span className="text-[12px] font-semibold text-foreground block truncate">
                                          {doc.name}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground block mt-0.5">
                                          {doc.size}
                                        </span>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveTempFaceImage(doc.id)}
                                      className="text-rose-500 hover:text-rose-700 bg-rose-500/10 hover:bg-rose-500/20 p-2 rounded-lg cursor-pointer transition-colors shrink-0"
                                    >
                                      <X className="size-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Saved Face Images Section */}
                        <div className="p-4 rounded-xl border border-border bg-card">
                          <span className="text-[13px] font-semibold text-foreground block mb-3">
                            Face Images
                          </span>
                          {savedFaceImages.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">No face images saved yet.</p>
                          ) : (
                            <div className="flex items-center gap-5 flex-wrap p-2">
                              {savedFaceImages.map((doc) => (
                                <div
                                  key={doc.id}
                                  className="relative size-16 rounded-xl border border-border shadow-xs shrink-0 group"
                                >
                                  <img
                                    src={doc.url}
                                    alt={doc.name}
                                    onClick={() => openLightbox(doc.url, doc.name)}
                                    className="size-full object-cover rounded-xl cursor-pointer hover:opacity-85 transition-opacity"
                                    title="Click to preview face image"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveSavedFaceImage(doc.id)}
                                    className="absolute top-0 right-0 translate-x-1.5 -translate-y-1.5 bg-background hover:bg-rose-50 border border-border rounded-full size-5 flex items-center justify-center cursor-pointer shadow-xs text-rose-500 transition-colors"
                                    title="Delete Face Image"
                                  >
                                    <X className="size-3 text-rose-500" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Leave Template Section */}
                  <div className="pt-6 border-t border-border space-y-4">
                    <div>
                      <h3 className="text-[13px] font-semibold text-foreground">Assigned Leave Template</h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Select a leave template to assign configured leaves to this employee, or select None to specify manual leaves.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="leave_template" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                          Select Leave Template
                        </Label>
                        <Controller
                          control={control}
                          name="leave_template"
                          render={({ field }) => (
                            <Select
                              onValueChange={(val) => {
                                field.onChange(val)
                                setValue('assigned_leave_template', val === 'none' ? null : val)
                                const matched = dbLeaveTemplates.find((t: any) => String(t.leave_template_id || t.id) === String(val))
                                if (matched && Array.isArray(matched.leaves_applicable)) {
                                  setValue('leaves', matched.leaves_applicable.map((l: any) => ({ ...l })))
                                } else {
                                  setValue('leaves', [])
                                }
                              }}
                              value={field.value || "none"}
                            >
                              <SelectTrigger id="leave_template">
                                <SelectValue placeholder="Select leave template" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None (Manual Leaves)</SelectItem>
                                {dbLeaveTemplates.map((tpl: any) => (
                                  <SelectItem key={tpl.leave_template_id || tpl.id} value={String(tpl.leave_template_id || tpl.id)}>
                                    {tpl.leave_template_name || tpl.template_name || tpl.name || `Template #${tpl.leave_template_id || tpl.id}`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                    </div>

                    {/* Manual Leave Fields (Shown only when no template is selected) */}
                    {(!watch('leave_template') || watch('leave_template') === 'none') ? (
                      <div className="space-y-3 pt-2">
                        <Label className="text-[12px] font-semibold text-foreground block">
                          Manual Leave Quotas
                        </Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <Label htmlFor="casual_leaves" className="text-[11px] font-medium text-muted-foreground mb-1 block">
                              No of Casual Leaves
                            </Label>
                            <Input
                              id="casual_leaves"
                              type="number"
                              min="0"
                              placeholder="0"
                              {...register('casual_leaves')}
                              className="h-9 text-xs"
                            />
                          </div>
                          <div>
                            <Label htmlFor="sick_leaves" className="text-[11px] font-medium text-muted-foreground mb-1 block">
                              No of Sick Leaves
                            </Label>
                            <Input
                              id="sick_leaves"
                              type="number"
                              min="0"
                              placeholder="0"
                              {...register('sick_leaves')}
                              className="h-9 text-xs"
                            />
                          </div>
                          <div>
                            <Label htmlFor="privilege_leaves" className="text-[11px] font-medium text-muted-foreground mb-1 block">
                              No of Privilege Leaves
                            </Label>
                            <Input
                              id="privilege_leaves"
                              type="number"
                              min="0"
                              placeholder="0"
                              {...register('privilege_leaves')}
                              className="h-9 text-xs"
                            />
                          </div>
                          <div>
                            <Label htmlFor="emergency_leave" className="text-[11px] font-medium text-muted-foreground mb-1 block">
                              No of Emergency Leaves
                            </Label>
                            <Input
                              id="emergency_leave"
                              type="number"
                              min="0"
                              placeholder="0"
                              {...register('emergency_leave')}
                              className="h-9 text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl border border-border bg-muted/10">
                        <span className="text-[12px] font-semibold text-foreground block">
                          Configured Leave Types for {
                            dbLeaveTemplates.find((t: any) => String(t.leave_template_id || t.id) === String(watch('leave_template')))?.template_name || 'Selected Template'
                          }:
                        </span>
                        <span className="text-[11px] text-muted-foreground mt-1.5 block">
                          Leaves are managed according to the selected leave template rules.
                        </span>
                      </div>
                    )}
                  </div>

                </div>
            </div>

            {/* ==================== PAYROLL & OVERTIME TAB ==================== */}
            <div className={cn("space-y-6", activeTab !== 'payroll' && "hidden")}>
                <div className="border border-border rounded-xl p-6 bg-card space-y-6">

                  {/* Pay Type & Monthly Salary */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="pay_type" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                        Pay Type
                      </Label>
                      <Controller
                        control={control}
                        name="pay_type"
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <SelectTrigger id="pay_type">
                              <SelectValue placeholder="Select pay type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Monthly">Monthly</SelectItem>
                              <SelectItem value="Daily">Daily</SelectItem>
                              <SelectItem value="Hourly">Hourly</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    <div>
                      <Label htmlFor="salary_per_month" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                        Monthly Salary
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">₹</span>
                        <Input
                          id="salary_per_month"
                          className="pl-7"
                          {...register('salary_per_month')}
                          placeholder="Enter salary"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Week-Off Extra Payment, Week-Off as Overtime, and Week-Off Day */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-border/50 items-start">
                    <div className="flex items-start gap-3">
                      <Controller
                        control={control}
                        name="week_off_payment"
                        render={({ field }) => (
                          <Checkbox
                            id="week_off_payment"
                            checked={field.value}
                            onCheckedChange={(chk) => {
                              field.onChange(chk)
                              setValue('week_off_extra_payment', chk)
                            }}
                            className="mt-1"
                          />
                        )}
                      />
                      <div>
                        <Label htmlFor="week_off_payment" className="text-xs font-medium text-foreground cursor-pointer select-none">
                          Week-Off Extra Payment
                        </Label>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Enable extra payment for week-off work
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Controller
                        control={control}
                        name="week_off_as_overtime"
                        render={({ field }) => (
                          <Checkbox
                            id="week_off_as_overtime"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="mt-1"
                          />
                        )}
                      />
                      <div>
                        <Label htmlFor="week_off_as_overtime" className="text-xs font-medium text-foreground cursor-pointer select-none">
                          Week-Off as Overtime
                        </Label>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Count week-off work as overtime
                        </p>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="week_off_day_number" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                        Week-Off Day
                      </Label>
                      <Controller
                        control={control}
                        name="week_off_day_number"
                        render={({ field }) => (
                          <Select
                            onValueChange={(val) => {
                              const numVal = val === "" ? null : Number(val)
                              field.onChange(numVal)
                              const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
                              if (numVal != null && dayNames[numVal]) {
                                setValue('week_off_day', dayNames[numVal])
                              }
                            }}
                            value={field.value !== null && field.value !== undefined ? String(field.value) : "0"}
                          >
                            <SelectTrigger id="week_off_day_number">
                              <SelectValue placeholder="Select day" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">Monday</SelectItem>
                              <SelectItem value="2">Tuesday</SelectItem>
                              <SelectItem value="3">Wednesday</SelectItem>
                              <SelectItem value="4">Thursday</SelectItem>
                              <SelectItem value="5">Friday</SelectItem>
                              <SelectItem value="6">Saturday</SelectItem>
                              <SelectItem value="0">Sunday</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  </div>

                  {/* Holiday Extra Payment & Holiday as Overtime */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/50 items-start">
                    <div className="flex items-start gap-3">
                      <Controller
                        control={control}
                        name="holiday_extra_payment"
                        render={({ field }) => (
                          <Checkbox
                            id="holiday_extra_payment"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="mt-1"
                          />
                        )}
                      />
                      <div>
                        <Label htmlFor="holiday_extra_payment" className="text-xs font-medium text-foreground cursor-pointer select-none">
                          Holiday Extra Payment
                        </Label>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Enable extra payment for holiday work
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Controller
                        control={control}
                        name="holiday_as_overtime"
                        render={({ field }) => (
                          <Checkbox
                            id="holiday_as_overtime"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="mt-1"
                          />
                        )}
                      />
                      <div>
                        <Label htmlFor="holiday_as_overtime" className="text-xs font-medium text-foreground cursor-pointer select-none">
                          Holiday as Overtime
                        </Label>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Count holiday work as overtime
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Applicable for Overtime & Overtime Configuration */}
                  <div className="pt-4 border-t border-border/50 space-y-4">
                    <div className="flex items-start gap-3">
                      <Controller
                        control={control}
                        name="applicable_for_overtime"
                        render={({ field }) => (
                          <Checkbox
                            id="applicable_for_overtime"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="mt-1"
                          />
                        )}
                      />
                      <div>
                        <Label htmlFor="applicable_for_overtime" className="text-xs font-medium text-foreground cursor-pointer select-none">
                          Applicable for Overtime
                        </Label>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Enable overtime calculation for this employee
                        </p>
                      </div>
                    </div>

                    {applicableForOvertime && (
                      <div className="space-y-4 pl-7">
                        <div className="flex items-start gap-3">
                          <Controller
                            control={control}
                            name="auto_overtime"
                            render={({ field }) => (
                              <Checkbox
                                id="auto_overtime"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                className="mt-1"
                              />
                            )}
                          />
                          <div>
                            <Label htmlFor="auto_overtime" className="text-xs font-medium text-foreground cursor-pointer select-none">
                              Auto Overtime
                            </Label>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              Automatically calculate overtime for this employee
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="overtime_hours" className="text-[11px] font-medium text-muted-foreground mb-1 block">
                              Overtime Starts After (Hours)
                            </Label>
                            <Input
                              id="overtime_hours"
                              type="number"
                              min="0"
                              {...register('overtime_hours')}
                              placeholder="0"
                              className="h-9 text-xs"
                            />
                          </div>
                          <div>
                            <Label htmlFor="overtime_minutes" className="text-[11px] font-medium text-muted-foreground mb-1 block">
                              Minutes
                            </Label>
                            <Input
                              id="overtime_minutes"
                              type="number"
                              min="0"
                              max="59"
                              {...register('overtime_minutes')}
                              placeholder="0"
                              className="h-9 text-xs"
                            />
                          </div>
                        </div>

                        {!autoOvertime && (
                          <div>
                            <Label htmlFor="overtime_hourly_rate" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                              Overtime Hourly Rate
                            </Label>
                            <div className="relative">
                              <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">₹</span>
                              <Input
                                id="overtime_hourly_rate"
                                className="pl-7 h-9 text-xs"
                                {...register('overtime_hourly_rate')}
                                placeholder="Enter hourly overtime rate"
                              />
                            </div>
                          </div>
                        )}

                        {/* Overtime Calculation Information Block */}
                        <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-center justify-between">
                          <div className="space-y-1 text-left">
                            <h4 className="text-[13px] font-semibold text-foreground">Overtime Calculation</h4>
                            <p className="text-[11px] text-muted-foreground">Based on ₹{parseFloat(salaryPerMonth) || 0}/month</p>
                            <p className="text-[11px] text-muted-foreground">Overtime Hourly rate:</p>

                            {autoOvertime ? (
                              <span className="text-[10px] text-muted-foreground/80 mt-1 block">**Calculation shown as per current month</span>
                            ) : (
                              <span className="text-[11px] text-muted-foreground mt-1 block">
                                Overtime will be calculated after {watch('overtime_hours') || 0} hours and {watch('overtime_minutes') || 0} minutes of work
                              </span>
                            )}
                          </div>
                          <span className="text-[14px] font-bold text-amber-600 dark:text-amber-500">
                            ₹{autoOvertime
                              ? ((parseFloat(salaryPerMonth) || 0) / (30 * 8)).toFixed(2)
                              : (parseFloat(watch('overtime_hourly_rate')) || 0).toFixed(2)
                            }/hour
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* View Self Salary Checkbox */}
                  <div className="pt-4 border-t border-border/50">
                    <div className="flex items-start gap-3">
                      <Controller
                        control={control}
                        name="can_view_self_salary"
                        render={({ field }) => (
                          <Checkbox
                            id="can_view_self_salary"
                            checked={field.value}
                            onCheckedChange={(chk) => {
                              field.onChange(chk)
                              setValue('view_self_salary', chk)
                            }}
                            className="mt-1"
                          />
                        )}
                      />
                      <div>
                        <Label htmlFor="can_view_self_salary" className="text-xs font-medium text-foreground cursor-pointer select-none">
                          View Self Salary
                        </Label>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Allow employee to view their own salary details
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Select Payroll Template */}
                  <div className="pt-4 border-t border-border/50">
                    <div>
                      <Label htmlFor="payroll_template_id" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                        Select Payroll Template
                      </Label>
                      <Controller
                        control={control}
                        name="payroll_template_id"
                        render={({ field }) => (
                          <Select
                            onValueChange={(val) => {
                              const numericVal = (!val || val === 'none') ? null : Number(val)
                              field.onChange(numericVal)
                              setValue('payroll_template', val)

                              if (numericVal && dbBenefits && dbDeductions) {
                                const templateBenefits = (dbBenefits || [])
                                  .filter((item: any) => {
                                    const headTempId = item.payroll_template_id?.payroll_template_id ?? item.payroll_template_id
                                    return Number(headTempId) === Number(numericVal)
                                  })
                                  .map((item: any) => Number(item.payroll_head_id || item.id))

                                const templateDeductions = (dbDeductions || [])
                                  .filter((item: any) => {
                                    const headTempId = item.payroll_template_id?.payroll_template_id ?? item.payroll_template_id
                                    return Number(headTempId) === Number(numericVal)
                                  })
                                  .map((item: any) => Number(item.payroll_head_id || item.id))

                                setBenefits(prev => prev.map(b => ({
                                  ...b,
                                  selected: templateBenefits.includes(Number(b.id || b.payroll_head_id))
                                })))
                                setDeductions(prev => prev.map(d => ({
                                  ...d,
                                  selected: templateDeductions.includes(Number(d.id || d.payroll_head_id))
                                })))
                              } else if (!numericVal) {
                                setBenefits(prev => prev.map(b => ({ ...b, selected: false })))
                                setDeductions(prev => prev.map(d => ({ ...d, selected: false })))
                              }
                            }}
                            value={field.value !== null && field.value !== undefined && String(field.value) !== '' ? String(field.value) : 'none'}
                          >
                            <SelectTrigger id="payroll_template_id">
                              <SelectValue placeholder="Select payroll template" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Select payroll template</SelectItem>
                              {dbPayrollTemplates.map((t: any) => {
                                const templateId = String(t.payroll_template_id ?? t.id)
                                const templateName = t.payroll_template_name ?? t.name ?? t.template_name ?? `Template #${templateId}`
                                return (
                                  <SelectItem key={templateId} value={templateId}>
                                    {templateName}
                                  </SelectItem>
                                )
                              })}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  </div>

                  {/* Payroll Configuration - Benefits & Deductions Accordion Blocks */}
                  <div className="pt-6 border-t border-border space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-[13px] font-semibold text-foreground">Payroll Configuration</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Add and configure benefits or deductions rules for this payroll.
                        </p>
                      </div>
                      <Button type="button" size="sm" className="h-8 text-xs font-semibold bg-foreground hover:bg-foreground/90 text-background px-4 cursor-pointer" onClick={() => toast.success("Payroll Configuration dialog opened")}>
                        Add Config
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {/* Collapsible Benefits block */}
                      <div className="border border-border rounded-xl bg-card overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setBenefitsExpanded(!benefitsExpanded)}
                          className="w-full flex items-center justify-between p-3.5 hover:bg-muted/10 transition-colors text-left"
                        >
                          <span className="text-[12px] font-semibold text-foreground">
                            Benifits ({selectedBenefitsCount} selected)
                          </span>
                          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform duration-200", benefitsExpanded && "rotate-180")} />
                        </button>

                        {benefitsExpanded && (
                          <div className="p-4 border-t border-border bg-muted/10 space-y-3">
                            {benefits.map((b) => (
                              <div key={b.id} className="flex items-start gap-3">
                                <Checkbox
                                  id={`benefit-${b.id}`}
                                  checked={b.selected}
                                  onCheckedChange={(checked) => {
                                    setBenefits(prev => prev.map(item => item.id === b.id ? { ...item, selected: !!checked } : item))
                                  }}
                                  className="mt-0.5"
                                />
                                <div>
                                  <Label htmlFor={`benefit-${b.id}`} className="text-xs font-medium text-foreground cursor-pointer select-none">
                                    {b.label}
                                  </Label>
                                  {b.helpText && (
                                    <p className="text-[10px] text-muted-foreground mt-0.5">{b.helpText}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Collapsible Deductions block */}
                      <div className="border border-border rounded-xl bg-card overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setDeductionsExpanded(!deductionsExpanded)}
                          className="w-full flex items-center justify-between p-3.5 hover:bg-muted/10 transition-colors text-left"
                        >
                          <span className="text-[12px] font-semibold text-foreground">
                            Deductions ({selectedDeductionsCount} selected)
                          </span>
                          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform duration-200", deductionsExpanded && "rotate-180")} />
                        </button>

                        {deductionsExpanded && (
                          <div className="p-4 border-t border-border bg-muted/10 space-y-3">
                            {deductions.map((d) => (
                              <div key={d.id} className="flex items-start gap-3">
                                <Checkbox
                                  id={`deduction-${d.id}`}
                                  checked={d.selected}
                                  onCheckedChange={(checked) => {
                                    setDeductions(prev => prev.map(item => item.id === d.id ? { ...item, selected: !!checked } : item))
                                  }}
                                  className="mt-0.5"
                                />
                                <div>
                                  <Label htmlFor={`deduction-${d.id}`} className="text-xs font-medium text-foreground cursor-pointer select-none">
                                    {d.label}
                                  </Label>
                                  {d.helpText && (
                                    <p className="text-[10px] text-muted-foreground mt-0.5">{d.helpText}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
            </div>
          </div>

          {/* Bottom Actions Row inside Content Pane */}
          <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4 bg-muted/10 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate('/admin/staff')}
              className="h-8 text-xs font-medium cursor-pointer rounded-lg px-4"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={addOrEditStaffMutation.isPending}
              className="btn-3d flex items-center gap-1.5 bg-primary text-primary-foreground font-medium rounded-lg h-8 px-5 cursor-pointer text-xs disabled:opacity-50"
            >
              <Check className="size-3.5" />
              {addOrEditStaffMutation.isPending
                ? 'Saving...'
                : id
                ? 'Save Changes'
                : 'Create Employee'}
            </Button>
          </div>
        </div>
      </Panel>

      {/* Save Changes Confirmation AlertDialog */}
      <AlertDialog open={isConfirmSaveOpen} onOpenChange={setIsConfirmSaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save Changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to save changes to this staff member's profile? Only the modified fields will be updated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={addOrEditStaffMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={addOrEditStaffMutation.isPending}
              onClick={(e) => {
                e.preventDefault()
                if (pendingFormData) {
                  addOrEditStaffMutation.mutate({ formData: pendingFormData, isPartialEdit: true })
                  setIsConfirmSaveOpen(false)
                }
              }}
            >
              {addOrEditStaffMutation.isPending ? 'Saving...' : 'Save Changes'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image Lightbox for Fullscreen Attachment Previews */}
      <ImageLightbox
        isOpen={lightboxState.isOpen}
        onClose={closeLightbox}
        src={lightboxState.src}
        title={lightboxState.title}
      />
    </form>
  )
}
