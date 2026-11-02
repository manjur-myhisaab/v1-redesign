import { useState, useEffect } from 'react'
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
  X
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
import {
  useEmployeeByIdQuery,
  useUpdateEmployeeMutation,
  useCreateEmployeeMutation,
} from '@/features/employees/hooks/useEmployees'
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
import { uploadFile, getImageFile } from '@/lib/api'

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
  designation_id: '',
  role: 'Employee',
  select_category: 'Sales',
  manage_other_categories: [],
  view_other_managers: false,
  custom_designation: '',
  super_admin_access: false,
  supervisor_id: '',

  live_tracking: false,
  mobile_attendance: false,
  multiple_attendance: false,
  shiftwise_attendance: false,
  self_odometer_reading: false,
  ai_selfie_verification: false,
  punch_from: 'Geofence',
  shift_alignment_type: 'Fixed',
  leave_template: 'test saqib',

  salary_per_month: '25000.0',
  pay_type: 'Monthly',
  week_off_extra_payment: true,
  week_off_day: 'Sunday',
  applicable_for_overtime: true,
  overtime_starts_after_hours: '0',
  overtime_starts_after_minutes: '1',
  auto_overtime: true,
  view_self_salary: true,
  payroll_template: 'HELLO 123',
  overtime_hourly_rate: '0',
  inactive_date: null as string | null,
  country: null as string | null,
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

export default function EmployeeForm() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { firstTabActive } = useShell()
  const [activeTab, setActiveTab] = useState('basic')
  const manageCategoriesAnchor = useComboboxAnchor()

  // Fetch employee data & mutations
  const { data: employeeData, isLoading: isLoadingEmployee } = useEmployeeByIdQuery(id)
  const createMutation = useCreateEmployeeMutation()
  const updateMutation = useUpdateEmployeeMutation()

  // Local profile pic preview state
  const [profilePic, setProfilePic] = useState<string | null>(null)
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null)
  const [uploadedAvatarAssetId, setUploadedAvatarAssetId] = useState<string | null>(null)

  const loadAvatarAsBlob = async (avatarStr?: string | null) => {
    if (!avatarStr) return null
    if (avatarStr.startsWith('blob:') || avatarStr.startsWith('data:')) {
      return avatarStr
    }
    try {
      const cleanId = avatarStr.replace(/^.*\/assets\//, '').replace(/^\/?assets\//, '')
      const blob = await getImageFile(cleanId)
      if (blob && blob.size > 0) {
        return URL.createObjectURL(blob)
      }
    } catch (err) {
      console.error('Failed to load avatar blob:', err)
    }
    return null
  }

  interface UploadedFileItem {
    id: string
    name: string
    size: string
    url: string
    isImage: boolean
  }

  // Document Uploads State matching the screenshots layout
  const [savedDocuments, setSavedDocuments] = useState<UploadedFileItem[]>([
    {
      id: 'doc-1',
      name: 'Salary_Slip_June.png',
      size: '420 KB',
      url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=60',
      isImage: true,
    }
  ])
  const [tempUploads, setTempUploads] = useState<UploadedFileItem[]>([])

  // Face Images States matching the screenshots layout
  const [savedFaceImages, setSavedFaceImages] = useState<UploadedFileItem[]>([
    {
      id: 'face-1',
      name: 'face_primary.png',
      size: '120 KB',
      url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
      isImage: true,
    },
    {
      id: 'face-2',
      name: 'face_secondary.png',
      size: '95 KB',
      url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
      isImage: true,
    }
  ])
  const [tempFaceImages, setTempFaceImages] = useState<UploadedFileItem[]>([])
  const [isDraggingFace, setIsDraggingFace] = useState(false)

  // Payroll configuration accordion and selected checkbox states
  const [benefitsExpanded, setBenefitsExpanded] = useState(false)
  const [deductionsExpanded, setDeductionsExpanded] = useState(false)

  const [benefits, setBenefits] = useState([
    { id: 'basic', label: 'Basic Salary', selected: true },
    { id: 'hra', label: 'HRA (House Rent Allowance)', selected: true },
    { id: 'special', label: 'Special Allowance', selected: true },
    { id: 'conveyance', label: 'Conveyance Allowance', selected: false },
    { id: 'medical', label: 'Medical Allowance', selected: false }
  ])

  const [deductions, setDeductions] = useState([
    { id: 'pf', label: 'Provident Fund (PF)', selected: true },
    { id: 'esi', label: 'Employee State Insurance (ESI)', selected: true },
    { id: 'pt', label: 'Professional Tax', selected: false },
    { id: 'tds', label: 'Tax Deducted at Source (TDS)', selected: false }
  ])

  const selectedBenefitsCount = benefits.filter(b => b.selected).length
  const selectedDeductionsCount = deductions.filter(d => d.selected).length

  // Shift management states
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [shifts, setShifts] = useState([
    { id: '1', name: 'Xyz', time: '(10:00 AM) - (06:30 PM)', selected: false },
    { id: '2', name: 'Morning Shift', time: '(09:00 AM) - (07:00 PM)', selected: true },
    { id: '3', name: 'Day Dhift Kuch Bhi', time: '(11:30 AM) - (10:30 PM)', selected: true },
    { id: '4', name: 'General Shift', time: '(09:00 AM) - (09:00 PM)', selected: true },
    { id: '5', name: 'Anywhere Shift', time: '(10:00 PM) - (10:00 PM)', selected: true },
    { id: '6', name: 'Sales', time: '(09:00 PM) - (07:00 PM)', selected: true },
    { id: '7', name: 'Night Shift', time: '(09:00 PM) - (09:00 AM)', selected: true },
    { id: '8', name: 'General Shift (Evening)', time: '(09:00 PM) - (09:00 AM)', selected: true },
  ])
  const selectedShiftsCount = shifts.filter(s => s.selected).length

  // Available shift options for weekly selection
  const ALL_SHIFTS = [
    { id: '1', name: 'Week Off', time: '' },
    { id: '2', name: 'Xyz', time: '(10:00 AM) - (06:30 PM)' },
    { id: '3', name: 'Morning Shift', time: '(09:00 AM) - (07:00 PM)' },
    { id: '4', name: 'Day Dhift Kuch Bhi', time: '(11:30 AM) - (10:30 PM)' },
    { id: '5', name: 'General Shift', time: '(09:00 AM) - (09:00 PM)' },
    { id: '6', name: 'Anywhere Shift', time: '(10:00 PM) - (10:00 PM)' },
    { id: '7', name: 'Sales', time: '(09:00 PM) - (07:00 PM)' },
    { id: '8', name: 'Night Shift', time: '(09:00 PM) - (09:00 AM)' },
    { id: '9', name: 'Design', time: '(10:00 PM) - (09:00 PM)' },
    { id: '10', name: 'Operation Shift', time: '(08:00 PM) - (07:20 PM)' },
    { id: '11', name: 'Peon', time: '(07:21 PM) - (09:21 PM)' },
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
    reset,
    formState: { errors },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema) as any,
    defaultValues: DEFAULT_VALUES as any,
  })

  // Populate form when employee data is loaded
  useEffect(() => {
    if (!employeeData) return
    const e = (employeeData as any).user || employeeData
    const rolesData = (employeeData as any).roles || e.role || []

    // Parse DOJ date to YYYY-MM-DD
    const parseDateStr = (d: string | null | undefined) => {
      if (!d) return ''
      const parsed = new Date(d)
      if (isNaN(parsed.getTime())) return ''
      return parsed.toISOString().slice(0, 10)
    }

    reset({
      first_name: e.first_name || '',
      last_name: e.last_name || '',
      mobile_number: e.mobile_number || '',
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
      esi_applicable: e.esi_applicable === 'Y',
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
      designation_id: e.designation_id || '',
      role: (Array.isArray(rolesData) && rolesData.length > 0 ? rolesData[0] : rolesData) || 'MEMBER',
      supervisor_id: e.supervisor_id || '',
      country: e.country || null,
      // Attendance
      live_tracking: e.live_tracking ?? false,
      mobile_attendance: e.mobile_attendance ?? false,
      multiple_attendance: e.multiple_attendance ?? false,
      shiftwise_attendance: e.shiftwise_attendance ?? false,
      self_odometer_reading: e.self_odometer_reading ?? false,
      ai_selfie_verification: e.ai_selfie_verification ?? false,
      punch_from: e.punch_from
        ? e.punch_from.charAt(0).toUpperCase() + e.punch_from.slice(1)
        : 'Anywhere',
      shift_alignment_type: e.shift_type
        ? e.shift_type.charAt(0).toUpperCase() + e.shift_type.slice(1)
        : 'Fixed',
      // Payroll
      salary_per_month: e.salary_per_month ? String(e.salary_per_month) : '0',
      pay_type: e.pay_type
        ? e.pay_type.charAt(0).toUpperCase() + e.pay_type.slice(1)
        : 'Monthly',
      applicable_for_overtime: e.applicable_for_overtime ?? false,
      auto_overtime: e.auto_overtime ?? false,
      overtime_hourly_rate: e.overtime_hourly_rate ? String(e.overtime_hourly_rate) : '0',
      overtime_starts_after_hours: e.overtime_hours ? String(e.overtime_hours) : '0',
      overtime_starts_after_minutes: e.overtime_minutes ? String(e.overtime_minutes) : '0',
      week_off_extra_payment: e.week_off_payment ?? false,
      week_off_day: e.week_off_day_number != null
        ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][e.week_off_day_number] ?? 'Sunday'
        : 'Sunday',
      view_self_salary: e.can_view_self_salary ?? false,
      // keep UI-only fields at defaults
      select_category: 'Sales',
      manage_other_categories: [],
      view_other_managers: false,
      custom_designation: '',
      super_admin_access: e.is_admin ?? false,
      leave_template: '',
      payroll_template: e.payroll_template_id || '',
      inactive_date: e.inactive_date || null,
    })

    const avatarVal = e?.avatar || e?.profile_image || e?.profile_picture || e?.image
    if (avatarVal) {
      setUploadedAvatarAssetId(avatarVal)
      if (avatarVal.startsWith('blob:') || avatarVal.startsWith('data:')) {
        setProfilePic(avatarVal)
      } else {
        loadAvatarAsBlob(avatarVal).then((blobUrl) => {
          if (blobUrl) setProfilePic(blobUrl)
        })
      }
    }

  }, [employeeData, reset])

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

  // Form Submit Handler — builds employee payload and calls create/update API
  const onSubmit = (data: any) => {
    const dayNameToNumber: Record<string, number> = {
      Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
      Thursday: 4, Friday: 5, Saturday: 6,
    }

    const payload: any = {
      first_name: data.first_name,
      last_name: data.last_name || null,
      mobile_number: data.mobile_number,
      employee_email_address: data.employee_email_address || null,
      employee_address: data.employee_address || null,
      employee_birthdate: data.employee_birthdate || null,
      employee_blood_group: data.employee_blood_group || null,
      emergency_contact_name: data.emergency_contact_name || null,
      emergency_contact_phone: data.emergency_contact_phone || null,
      marital_status: data.marital_status || null,
      pan_number: data.pan_number || null,
      aadhaar_number: data.aadhaar_number || null,
      pf_no: data.pf_no || null,
      uan: data.uan || null,
      esi_applicable: data.esi_applicable ? 'Y' : 'N',
      esi_no: data.esi_no || null,
      esi_to_deduct_till: data.esi_to_deduct_till || null,
      employee_bank_ac_holder_name: data.employee_bank_ac_holder_name || null,
      employee_bank_ac_number: data.employee_bank_ac_number || null,
      employee_bank_branch_name: data.employee_bank_branch_name || null,
      employee_bank_ifsc: data.employee_bank_ifsc || null,
      employee_bank_name: data.employee_bank_name || null,
      doj: data.doj ? new Date(data.doj).toISOString().slice(0, 10) : null,
      gender: data.gender || null,
      employee_code: data.employee_code || null,
      department_name: data.department_name || null,
      designation_id: data.designation_id || null,
      role: Array.isArray(data.role)
        ? data.role.map((r: any) => String(r).toUpperCase())
        : typeof data.role === 'string' && data.role
          ? [data.role.toUpperCase()]
          : ['MEMBER'],
      supervisor_id: data.supervisor_id || null,
      country: data.country || null,
      // Attendance
      live_tracking: data.live_tracking ?? false,
      mobile_attendance: data.mobile_attendance ?? false,
      multiple_attendance: data.multiple_attendance ?? false,
      shiftwise_attendance: data.shiftwise_attendance ?? false,
      self_odometer_reading: data.self_odometer_reading ?? false,
      ai_selfie_verification: data.ai_selfie_verification ?? false,
      punch_from: typeof data.punch_from === 'string' ? data.punch_from.toLowerCase() : 'anywhere',
      shift_type: typeof data.shift_alignment_type === 'string' ? data.shift_alignment_type.toLowerCase() : 'fixed',
      // Payroll
      salary_per_month: parseFloat(data.salary_per_month) || 0,
      pay_type: typeof data.pay_type === 'string' ? data.pay_type.toLowerCase() : 'monthly',
      applicable_for_overtime: data.applicable_for_overtime ?? false,
      auto_overtime: data.auto_overtime ?? false,
      overtime_hourly_rate: data.overtime_hourly_rate ? Number(data.overtime_hourly_rate) : 0,
      overtime_hours: parseInt(data.overtime_starts_after_hours) || 0,
      overtime_minutes: parseInt(data.overtime_starts_after_minutes) || 0,
      week_off_payment: data.week_off_extra_payment ?? false,
      week_off_day_number: data.week_off_day ? (dayNameToNumber[data.week_off_day] ?? 0) : null,
      can_view_self_salary: data.view_self_salary ?? false,
      is_admin: data.super_admin_access ?? false,
      payroll_template_id: data.payroll_template || null,
      inactive_date: data.inactive_date || null,
      avatar: uploadedAvatarAssetId || null,
    }

    if (id) {
      payload.user_id = id
      updateMutation.mutate(payload, {
        onSuccess: () => navigate('/admin/employees'),
      })
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => navigate('/admin/employees'),
      })
    }
  }

  // Handle local image file preview
  const handlePhotoPreview = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setSelectedImageFile(file)
      setProfilePic(URL.createObjectURL(file))
      toast.success('Profile picture preview loaded.')
    }
  }

  const [isDragging, setIsDragging] = useState(false)

  const addFilesToTempList = (files: FileList) => {
    const filesArray = Array.from(files)
    const newItems: UploadedFileItem[] = filesArray.map((file, index) => {
      const sizeStr = file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${(file.size / 1024).toFixed(0)} KB`

      return {
        id: `bulk-doc-${Date.now()}-${index}`,
        name: file.name,
        size: sizeStr,
        url: URL.createObjectURL(file),
        isImage: file.type.startsWith('image/'),
      }
    })

    setTempUploads(prev => [...prev, ...newItems])
    toast.success(`${newItems.length} temporary preview(s) added.`)
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
      }
    })

    setTempFaceImages(prev => [...prev, ...newItems])
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
                onClick={() => navigate('/admin/employees')}
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
            {activeTab === 'basic' && (
              <div className="space-y-6">
                {/* Profile Picture */}
                <div>
                  <Label className="text-[13px] font-semibold mb-3 block text-foreground">Change Profile Picture</Label>
                  <div className="flex items-center gap-4">
                    {profilePic ? (
                      <img
                        src={profilePic}
                        alt="Preview"
                        className="size-16 rounded-full object-cover border border-border"
                      />
                    ) : (
                      <PersonAvatar
                        name={`${firstName || ''} ${lastName || ''}`}
                        sex={String(gender || '').toLowerCase() === 'female' ? 'woman' : 'man'}
                        className="size-16 rounded-full border border-border shadow-inner"
                      />
                    )}
                    <div>
                      <div className="relative">
                        <input
                          type="file"
                          id="profile-pic-upload"
                          className="hidden"
                          accept="image/*"
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
                            {profilePic ? "Change Profile Picture" : "Choose Profile Picture"}
                          </label>
                        </Button>
                        {selectedImageFile && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 ms-2 text-xs font-medium cursor-pointer gap-1.5"
                            onClick={async () => {
                              const fileToUpload = selectedImageFile || profilePic
                              if (!fileToUpload) {
                                toast.error("Please choose a profile picture first")
                                return
                              }
                              const toastId = toast.loading("Uploading profile picture...")
                              try {
                                const res = await uploadFile(fileToUpload)
                                if (!res?.data?.success && !res?.asset && !res?.url) {
                                  throw new Error(res?.data?.message || "File upload failed")
                                }
                                const assetId = res?.data?.data?.asset || res?.asset || res?.url || ''
                                if (assetId) {
                                  setUploadedAvatarAssetId(assetId)
                                  if (id) {
                                    await updateMutation.mutateAsync({
                                      user_id: id,
                                      avatar: assetId,
                                    })
                                  }
                                  const blobUrl = await loadAvatarAsBlob(assetId)
                                  if (blobUrl) {
                                    setProfilePic(blobUrl)
                                  }
                                }
                                setSelectedImageFile(null)
                                toast.success("Profile picture uploaded successfully", { id: toastId })
                              } catch (error: any) {
                                console.error("Upload Error:", error)
                                toast.error(error?.message || "Failed to upload profile picture", { id: toastId })
                              }
                            }}
                          >
                            <Upload className="size-3.5" />
                            Upload Image
                          </Button>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground block mt-1.5">
                        Allowed formats: JPG, PNG, GIF
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
                    <Label htmlFor="password_dummy" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                      Password
                    </Label>
                    <Input
                      id="password_dummy"
                      type="password"
                      placeholder="••••••••"
                      disabled
                    />
                    <span className="text-[10px] text-muted-foreground mt-1.5 block">
                      Leave unchanged if you do not want to update password
                    </span>
                  </div>

                  <div>
                    <Label htmlFor="employee_email_address" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                      Email Address
                    </Label>
                    <Input
                      id="employee_email_address"
                      type="email"
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
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <SelectTrigger id="employee_blood_group">
                            <SelectValue placeholder="Select blood group" />
                          </SelectTrigger>
                          <SelectContent>
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
                            PDF, DOCX, JPG, PNG supported · Max 10 MB per file
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
                                      className="w-10 h-14 object-cover rounded-md border border-border shrink-0"
                                    />
                                  ) : (
                                    <div className="w-10 h-14 flex items-center justify-center bg-muted rounded-md border border-border shrink-0">
                                      <FileText className="size-5 text-muted-foreground" />
                                    </div>
                                  )}
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
                                  onClick={() => handleRemoveTempUpload(doc.id)}
                                  className="text-rose-500 hover:text-rose-700 bg-rose-500/10 hover:bg-rose-500/20 p-2 rounded-lg cursor-pointer transition-colors shrink-0"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
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
                                    className="w-12 h-16 object-cover rounded-md border border-border shrink-0"
                                  />
                                ) : (
                                  <div className="w-12 h-16 flex items-center justify-center bg-muted rounded-md border border-border shrink-0">
                                    <FileText className="size-6 text-muted-foreground" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <span className="text-[13px] font-semibold text-foreground block truncate">
                                    {doc.name}
                                  </span>
                                  <span className="text-[11px] text-muted-foreground block mt-0.5">
                                    {doc.size}
                                  </span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveSavedDocument(doc.id)}
                                className="text-rose-500 hover:text-rose-700 bg-rose-500/10 hover:bg-rose-500/20 p-2 rounded-lg cursor-pointer transition-colors shrink-0"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>



              </div>
            )}

            {/* ==================== EMPLOYMENT & BANK TAB ==================== */}
            {activeTab === 'employment' && (
              <div className="space-y-6">
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
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <SelectTrigger id="employee_type">
                              <SelectValue placeholder="Select employee type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Employee">Employee</SelectItem>
                              <SelectItem value="Manager">Manager</SelectItem>
                              <SelectItem value="Admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    {role === 'Admin' ? (
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
                        <Label htmlFor="select_category" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                          Select Category
                        </Label>
                        <Controller
                          control={control}
                          name="select_category"
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value || ""}>
                              <SelectTrigger id="select_category">
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Sales">Sales</SelectItem>
                                <SelectItem value="Operations">Operations</SelectItem>
                                <SelectItem value="HR">HR</SelectItem>
                                <SelectItem value="Finance">Finance</SelectItem>
                                <SelectItem value="Marketing">Marketing</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                    )}

                    {/* Dynamic Manager Fields */}
                    {role === 'Manager' && (
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

                              return (
                                <Combobox
                                  multiple
                                  autoHighlight
                                  items={CATEGORIES}
                                  value={selectedValues}
                                  onValueChange={field.onChange}
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
                            name="view_other_managers"
                            render={({ field }) => (
                              <Switch
                                id="view_other_managers"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            )}
                          />
                          <div>
                            <Label htmlFor="view_other_managers" className="text-[13px] font-medium text-foreground cursor-pointer select-none">
                              View Other Managers
                            </Label>
                            <span className="text-[10px] text-muted-foreground block mt-0.5">
                              Manager can view and manage other managers accross categories
                            </span>
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="custom_designation" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                            Select Designation (For custom permissions)
                          </Label>
                          <Controller
                            control={control}
                            name="custom_designation"
                            render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value || ""}>
                                <SelectTrigger id="custom_designation">
                                  <SelectValue placeholder="Select designation" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Sales Executive">Sales Executive</SelectItem>
                                  <SelectItem value="Supervisor">Supervisor</SelectItem>
                                  <SelectItem value="Director">Director</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <Label htmlFor="designation_id" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                        Designation Name
                      </Label>
                      <Input
                        id="designation_id"
                        {...register('designation_id')}
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
            )}

            {/* ==================== ATTENDANCE SETTINGS TAB ==================== */}
            {activeTab === 'attendance' && (
              <div className="space-y-6">
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
                                        className="w-10 h-10 object-cover rounded-full border border-border shrink-0"
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
                                    className="size-full object-cover rounded-xl"
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
                        Select a leave template to assign configured leaves to this employee.
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
                            <Select onValueChange={field.onChange} value={field.value || ""}>
                              <SelectTrigger id="leave_template">
                                <SelectValue placeholder="Select leave template" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="test saqib">test saqib</SelectItem>
                                <SelectItem value="General Template">General Template</SelectItem>
                                <SelectItem value="Casual Leaves Only">Casual Leaves Only</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-border bg-muted/10">
                      <span className="text-[12px] font-semibold text-foreground block">
                        Configured Leave Types for test saqib:
                      </span>
                      <span className="text-[11px] text-muted-foreground mt-1.5 block">
                        No leave rules configured in this template.
                      </span>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* ==================== PAYROLL & OVERTIME TAB ==================== */}
            {activeTab === 'payroll' && (
              <div className="space-y-6">
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

                  {/* Week-Off Extra Payment & Week-Off Day */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/50">
                    <div className="flex items-center gap-3">
                      <Controller
                        control={control}
                        name="week_off_extra_payment"
                        render={({ field }) => (
                          <Switch
                            id="week_off_extra_payment"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        )}
                      />
                      <div>
                        <Label htmlFor="week_off_extra_payment" className="text-[13px] font-medium text-foreground cursor-pointer select-none">
                          Week-Off Extra Payment
                        </Label>
                        <span className="text-[10px] text-muted-foreground block mt-0.5">
                          Enable extra payment for week-off work
                        </span>
                      </div>
                    </div>

                    {weekOffExtraPayment && (
                      <div>
                        <Label htmlFor="week_off_day" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                          Week-Off Day
                        </Label>
                        <Controller
                          control={control}
                          name="week_off_day"
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value || ""}>
                              <SelectTrigger id="week_off_day">
                                <SelectValue placeholder="Select day" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Sunday">Sunday</SelectItem>
                                <SelectItem value="Saturday">Saturday</SelectItem>
                                <SelectItem value="Friday">Friday</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                    )}
                  </div>

                  {/* Applicable for Overtime & Overtime Starts After */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/50">
                    <div className="flex items-center gap-3">
                      <Controller
                        control={control}
                        name="applicable_for_overtime"
                        render={({ field }) => (
                          <Switch
                            id="applicable_for_overtime"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        )}
                      />
                      <div>
                        <Label htmlFor="applicable_for_overtime" className="text-[13px] font-medium text-foreground cursor-pointer select-none">
                          Applicable for Overtime
                        </Label>
                        <span className="text-[10px] text-muted-foreground block mt-0.5">
                          Enable overtime calculation for this employee
                        </span>
                      </div>
                    </div>

                    {applicableForOvertime && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="overtime_starts_after_hours" className="text-[11px] font-medium text-muted-foreground mb-1 block">
                            Overtime Starts After (Hours)
                          </Label>
                          <Input
                            id="overtime_starts_after_hours"
                            type="number"
                            {...register('overtime_starts_after_hours')}
                          />
                        </div>
                        <div>
                          <Label htmlFor="overtime_starts_after_minutes" className="text-[11px] font-medium text-muted-foreground mb-1 block">
                            Minutes
                          </Label>
                          <Input
                            id="overtime_starts_after_minutes"
                            type="number"
                            {...register('overtime_starts_after_minutes')}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Overtime Hourly Rate (ONLY if applicableForOvertime is enabled AND autoOvertime is OFF) */}
                  {applicableForOvertime && !autoOvertime && (
                    <div className="pt-4 border-t border-border/50">
                      <Label htmlFor="overtime_hourly_rate" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                        Overtime Hourly Rate
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">₹</span>
                        <Input
                          id="overtime_hourly_rate"
                          className="pl-7"
                          {...register('overtime_hourly_rate')}
                          placeholder="Enter hourly overtime rate"
                        />
                      </div>
                    </div>
                  )}

                  {/* Auto Overtime Switch & Dynamic Overtime Calculation Card */}
                  {applicableForOvertime && (
                    <div className="space-y-4 pt-4 border-t border-border/50">
                      <div className="flex items-center gap-3">
                        <Controller
                          control={control}
                          name="auto_overtime"
                          render={({ field }) => (
                            <Switch
                              id="auto_overtime"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          )}
                        />
                        <div>
                          <Label htmlFor="auto_overtime" className="text-[13px] font-medium text-foreground cursor-pointer select-none">
                            Auto Overtime
                          </Label>
                          <span className="text-[10px] text-muted-foreground block mt-0.5">
                            Automatically calculate overtime for this employee
                          </span>
                        </div>
                      </div>

                      {/* Overtime Calculation Information Block */}
                      <div className="bg-amber-500/5 border border-amber-500/15 p-4 rounded-xl flex items-center justify-between">
                        <div className="space-y-1 text-left">
                          <h4 className="text-[13px] font-semibold text-foreground">Overtime Calculation</h4>
                          <p className="text-[10px] text-muted-foreground">Based on ₹{parseFloat(salaryPerMonth) || 0}/month</p>
                          <p className="text-[10px] text-muted-foreground">Overtime Hourly rate:</p>

                          {autoOvertime ? (
                            <span className="text-[9px] text-muted-foreground/80 mt-2 block">**Calculation shown as per current month</span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground mt-2 block">
                              Overtime will be calculated after {overtimeStartsAfterHours || 0} hours and {overtimeStartsAfterMinutes || 0} minutes of work
                            </span>
                          )}
                        </div>
                        <span className="text-[13px] font-bold text-amber-600 dark:text-amber-500">
                          ₹{autoOvertime
                            ? ((parseFloat(salaryPerMonth) || 0) * 2).toFixed(1)
                            : (parseFloat(overtimeHourlyRate) || 0).toFixed(1)
                          }/hour
                        </span>
                      </div>
                    </div>
                  )}

                  {/* View Self Salary & Self Odometer Reading Switches */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/50">
                    <div className="flex items-center gap-3">
                      <Controller
                        control={control}
                        name="view_self_salary"
                        render={({ field }) => (
                          <Switch
                            id="view_self_salary"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        )}
                      />
                      <div>
                        <Label htmlFor="view_self_salary" className="text-[13px] font-medium text-foreground cursor-pointer select-none">
                          View Self Salary
                        </Label>
                        <span className="text-[10px] text-muted-foreground block mt-0.5">
                          Allow employee to view their own salary details
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Controller
                        control={control}
                        name="self_odometer_reading"
                        render={({ field }) => (
                          <Switch
                            id="self_odometer_reading_payroll"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        )}
                      />
                      <div>
                        <Label htmlFor="self_odometer_reading_payroll" className="text-[13px] font-medium text-foreground cursor-pointer select-none">
                          Self Odometer Reading
                        </Label>
                        <span className="text-[10px] text-muted-foreground block mt-0.5">
                          Allow employee to enter their own odometer reading
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Select Payroll Template */}
                  <div className="pt-4 border-t border-border/50">
                    <div>
                      <Label htmlFor="payroll_template" className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                        Select Payroll Template
                      </Label>
                      <Controller
                        control={control}
                        name="payroll_template"
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <SelectTrigger id="payroll_template">
                              <SelectValue placeholder="Select template" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="HELLO 123">HELLO 123</SelectItem>
                              <SelectItem value="Standard Template">Standard Template</SelectItem>
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
                              <div key={b.id} className="flex items-center gap-3">
                                <Checkbox
                                  id={`benefit-${b.id}`}
                                  checked={b.selected}
                                  onCheckedChange={(checked) => {
                                    setBenefits(prev => prev.map(item => item.id === b.id ? { ...item, selected: !!checked } : item))
                                  }}
                                  className="mt-0.5"
                                />
                                <Label htmlFor={`benefit-${b.id}`} className="text-xs text-foreground cursor-pointer select-none">
                                  {b.label}
                                </Label>
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
                              <div key={d.id} className="flex items-center gap-3">
                                <Checkbox
                                  id={`deduction-${d.id}`}
                                  checked={d.selected}
                                  onCheckedChange={(checked) => {
                                    setDeductions(prev => prev.map(item => item.id === d.id ? { ...item, selected: !!checked } : item))
                                  }}
                                  className="mt-0.5"
                                />
                                <Label htmlFor={`deduction-${d.id}`} className="text-xs text-foreground cursor-pointer select-none">
                                  {d.label}
                                </Label>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>

          {/* Bottom Actions Row inside Content Pane */}
          <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4 bg-muted/10 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate('/admin/employees')}
              className="h-8 text-xs font-medium cursor-pointer rounded-lg px-4"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateMutation.isPending || createMutation.isPending}
              className="btn-3d flex items-center gap-1.5 bg-primary text-primary-foreground font-medium rounded-lg h-8 px-5 cursor-pointer text-xs disabled:opacity-50"
            >
              <Check className="size-3.5" />
              {updateMutation.isPending || createMutation.isPending
                ? 'Saving...'
                : id
                ? 'Save Changes'
                : 'Create Employee'}
            </Button>
          </div>
        </div>
      </Panel>
    </form>
  )
}
