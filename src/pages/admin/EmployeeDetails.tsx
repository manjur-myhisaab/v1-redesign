import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Pencil,
  Trash2,
  User,
  Briefcase,
  Clock,
  Wallet,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Heart,
  FileText,
  ShieldCheck,
  Building,
  CreditCard,
  XCircle,
  Eye,
  Sparkles,
  Award,
  Layers,
  ChevronRight,
  Check,
  AlertTriangle,
} from 'lucide-react'

import Panel from '@/components/admin/Panel'
import { Button } from '@/components/ui/button'
import StatusBadge from '@/components/admin/StatusBadge'
import PersonAvatar from '@/components/admin/PersonAvatar'
import { useShell } from '@/components/admin/shell-context'
import { cn } from '@/lib/utils'
import { genderSex } from '@/lib/employees'
import {
  useEmployeeByIdQuery,
  useDeleteEmployeeMutation,
  toEmployee,
} from '@/features/employees/hooks/useEmployees'
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

const TABS = [
  { id: 'basic', label: 'Basic Info', icon: User, desc: 'Personal info, statutory IDs & documents' },
  { id: 'employment', label: 'Employment & Bank', icon: Briefcase, desc: 'Role, department, hierarchy & banking' },
  { id: 'attendance', label: 'Attendance Settings', icon: Clock, desc: 'Tracking preferences, shifts & AI selfie' },
  { id: 'payroll', label: 'Payroll & Overtime', icon: Wallet, desc: 'Salary structure, overtime & deductions' },
]

export default function EmployeeDetails() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { firstTabActive } = useShell()
  const [activeTab, setActiveTab] = useState('basic')
  const [deleteOpen, setDeleteOpen] = useState(false)

  // Lightbox state
  const [lightboxData, setLightboxData] = useState<{
    src: string
    title?: string
    description?: string
  } | null>(null)

  const { data: rawEmployeeData, isLoading } = useEmployeeByIdQuery(id)
  const deleteMutation = useDeleteEmployeeMutation()

  // Sample initial documents for demo if none stored in backend raw json
  const sampleDocuments = [
    {
      id: 'doc-aadhaar',
      name: 'Aadhaar_Card.png',
      type: 'Aadhaar Card',
      size: '540 KB',
      url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
      isImage: true,
    },
    {
      id: 'doc-pan',
      name: 'PAN_Card.png',
      type: 'PAN Card',
      size: '320 KB',
      url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80',
      isImage: true,
    },
    {
      id: 'doc-salary',
      name: 'Salary_Slip_June.pdf',
      type: 'Salary Slip',
      size: '210 KB',
      url: '',
      isImage: false,
    },
  ]

  // Sample registered face images for selfie verification demo
  const sampleFaceImages = [
    {
      id: 'face-1',
      name: 'Registration Face (Front)',
      url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80',
      date: 'Primary Face Bio',
    },
    {
      id: 'face-2',
      name: 'Registration Face (Angled)',
      url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80',
      date: 'Secondary Face Bio',
    },
  ]

  if (isLoading) {
    return (
      <Panel
        className={cn(
          'flex min-w-0 flex-1 items-center justify-center border-border bg-card',
          firstTabActive && 'rounded-tl-none',
        )}
      >
        <div className="flex flex-col items-center gap-2 text-muted-foreground text-sm">
          <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Loading employee details…
        </div>
      </Panel>
    )
  }

  // Normalize employee object
  const employee = rawEmployeeData ? toEmployee(rawEmployeeData) : null
  const user = employee?.user || (rawEmployeeData as any)?.user || rawEmployeeData || {}
  const firm = employee?.firm || (rawEmployeeData as any)?.firm || {}

  if (!employee && !rawEmployeeData) {
    return (
      <Panel
        className={cn(
          'flex min-w-0 flex-1 flex-col items-center justify-center border-border bg-card p-6 text-center',
          firstTabActive && 'rounded-tl-none',
        )}
      >
        <div className="size-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mb-3">
          <XCircle className="size-6" />
        </div>
        <h2 className="text-base font-semibold">Employee not found</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          The requested employee record could not be loaded or has been deleted.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/admin/employees')}
          className="mt-4 cursor-pointer"
        >
          <ArrowLeft className="size-3.5 mr-1.5" /> Back to Employees
        </Button>
      </Panel>
    )
  }

  const firstName = user.first_name || ''
  const lastName = user.last_name || ''
  const fullName = `${firstName} ${lastName}`.trim() || employee?.name || user.mobile_number || 'Unnamed Staff'
  const isArchived = Boolean(user.inactive_date)
  const employeeRole = (Array.isArray(user.role) ? user.role[0] : user.role) || employee?.role || 'Employee'
  const employeeCode = user.employee_code || employee?.empCode || '—'
  const departmentName = user.department_name || employee?.department || '—'
  const designationName = user.designation_id || '—'
  const phone = user.mobile_number || employee?.phone || '—'
  const email = user.employee_email_address || employee?.email || '—'
  const gender = user.gender || employee?.gender || ''
  const bloodGroup = user.employee_blood_group || '—'
  const birthdate = user.employee_birthdate || '—'
  const address = user.employee_address || '—'
  const country = user.country || 'India'
  const maritalStatus = user.marital_status || '—'
  const emergencyName = user.emergency_contact_name || '—'
  const emergencyPhone = user.emergency_contact_phone || '—'
  const panNumber = user.pan_number || '—'
  const aadhaarNumber = user.aadhaar_number || '—'
  const pfNo = user.pf_no || '—'
  const uan = user.uan || '—'
  const esiApplicable = Boolean(user.esi_applicable)
  const esiNo = user.esi_no || '—'
  const esiDeductTill = user.esi_to_deduct_till || '—'

  // Bank Info
  const bankAcNumber = user.employee_bank_ac_number || '—'
  const bankIfsc = user.employee_bank_ifsc || '—'
  const bankName = user.employee_bank_name || '—'
  const bankBranch = user.employee_bank_branch_name || '—'
  const bankHolderName = user.employee_bank_ac_holder_name || fullName
  const upiId = user.employee_upi || '—'

  // Attendance & Settings
  const mobileAttendance = user.mobile_attendance ?? true
  const multipleAttendance = user.multiple_attendance ?? true
  const shiftwiseAttendance = user.shiftwise_attendance ?? true
  const liveTracking = user.live_tracking ?? false
  const punchFrom = user.punch_from || 'Geofence'
  const aiSelfie = user.ai_selfie_verification ?? true
  const selfOdometer = user.self_odometer_reading ?? false
  const shiftAlignment = user.shift_type || 'Fixed'
  const leaveTemplate = 'Standard Leave Policy'

  // Payroll & Overtime
  const salaryPerMonth = user.salary_per_month || user.basic_salary || 25000
  const payType = user.pay_type || 'Monthly'
  const applicableForOvertime = user.applicable_for_overtime ?? true
  const autoOvertime = user.auto_overtime ?? true
  const overtimeHours = user.overtime_hours || 0
  const overtimeMinutes = user.overtime_minutes || 1
  const overtimeRate = user.overtime_hourly_rate || (autoOvertime ? ((Number(salaryPerMonth) || 0) * 2).toFixed(1) : '0')
  const weekOffPayment = user.week_off_payment ?? true
  const weekOffDay = 'Sunday'

  const handleDelete = () => {
    if (!id) return
    deleteMutation.mutate([id], {
      onSuccess: () => {
        setDeleteOpen(false)
        navigate('/admin/employees')
      },
    })
  }

  const handleOpenEdit = () => {
    if (id) {
      navigate(`/admin/employees/${id}/edit`)
    }
  }

  return (
    <Panel
      className={cn(
        'flex min-w-0 flex-1 border-border bg-card overflow-hidden h-full',
        firstTabActive && 'rounded-tl-none',
      )}
    >
      {/* Left Navigation Sidebar */}
      <nav className="w-56 shrink-0 overflow-y-auto border-r border-border p-3 bg-muted/10 flex flex-col justify-between">
        <div>
          {/* Quick Profile Widget */}
          <div className="p-3 mb-4 rounded-xl border border-border bg-card shadow-xs flex items-center gap-3">
            <PersonAvatar
              name={fullName}
              sex={genderSex(gender)}
              className="size-10 shrink-0 border border-border shadow-xs"
            />
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-xs text-foreground truncate">{fullName}</h3>
              <p className="text-[11px] text-muted-foreground truncate">{employeeRole}</p>
              <div className="mt-1">
                <StatusBadge tone={isArchived ? 'gray' : 'green'}>
                  {isArchived ? 'Archived' : 'Active'}
                </StatusBadge>
              </div>
            </div>
          </div>

          <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Employee Profile
          </p>
          <div className="space-y-1">
            {TABS.map((tab) => {
              const TabIcon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-[13px] transition-all outline-none text-left',
                    isActive
                      ? 'bg-muted font-semibold text-foreground shadow-xs'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <TabIcon
                      className={cn(
                        'size-4 shrink-0 transition-colors',
                        isActive ? 'text-primary' : 'text-muted-foreground',
                      )}
                    />
                    <span className="truncate">{tab.label}</span>
                  </div>
                  {isActive && <ChevronRight className="size-3.5 text-primary shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Bottom Quick Info */}
        <div className="p-3 rounded-lg bg-muted/40 border border-border text-[11px] text-muted-foreground space-y-1">
          <div className="flex justify-between">
            <span>Emp ID:</span>
            <span className="font-mono font-medium text-foreground">{employeeCode}</span>
          </div>
          <div className="flex justify-between">
            <span>Joined:</span>
            <span className="font-medium text-foreground">{employee?.joined || '—'}</span>
          </div>
        </div>
      </nav>

      {/* Right Content Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between border-b border-border px-6 py-3.5 shrink-0 bg-card">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => navigate('/admin/employees')}
              className="size-8 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
              aria-label="Back to employees"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold truncate text-foreground">{fullName}</h1>
                <StatusBadge tone={isArchived ? 'gray' : 'green'}>
                  {isArchived ? 'Archived' : 'Active'}
                </StatusBadge>
              </div>
              <p className="text-[12px] text-muted-foreground truncate">
                {TABS.find((t) => t.id === activeTab)?.desc}
              </p>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(true)}
              className="h-8 text-xs font-medium border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/50 cursor-pointer rounded-lg px-3 transition-colors"
            >
              <Trash2 className="size-3.5 mr-1.5" />
              Delete Employee
            </Button>
            <Button
              type="button"
              onClick={handleOpenEdit}
              className="btn-3d flex items-center gap-1.5 bg-primary text-primary-foreground font-medium rounded-lg h-8 px-4 cursor-pointer text-xs transition-opacity hover:opacity-90"
            >
              <Pencil className="size-3.5" />
              Edit Employee
            </Button>
          </div>
        </div>

        {/* Scrollable Details Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ==================== TAB 1: BASIC INFO ==================== */}
          {activeTab === 'basic' && (
            <div className="space-y-6 max-w-5xl">
              {/* Profile Overview Card */}
              <div className="p-5 rounded-2xl border border-border bg-card shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
                <div className="flex items-center gap-4 min-w-0">
                  <PersonAvatar
                    name={fullName}
                    sex={genderSex(gender)}
                    className="size-16 rounded-2xl border-2 border-primary/20 shadow-md shrink-0"
                  />
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-foreground truncate">{fullName}</h2>
                    <p className="text-xs text-muted-foreground font-medium mt-0.5 truncate">
                      {designationName !== '—' ? designationName : employeeRole} · {departmentName}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-muted text-foreground border border-border">
                        Code: {employeeCode}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium">
                        {country}
                      </span>
                    </div>
                  </div>
                </div>

                
              </div>

              {/* Personal Information Grid */}
              <div className="border border-border rounded-2xl p-5 bg-card space-y-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <User className="size-4 text-primary" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    Personal Information
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <DetailItem label="First Name" value={firstName || '—'} />
                  <DetailItem label="Last Name" value={lastName || '—'} />
                  <DetailItem label="Phone Number" value={phone} icon={Phone} copyable />
                  <DetailItem label="Email Address" value={email} icon={Mail} copyable />
                  <DetailItem label="Country" value={country} />
                  <DetailItem label="Date of Birth" value={birthdate} icon={Calendar} />
                  <DetailItem label="Blood Group" value={bloodGroup} icon={Heart} />
                  <DetailItem label="Marital Status" value={maritalStatus} />
                  <DetailItem label="Gender" value={gender || 'Not Specified'} />
                </div>

                <div className="pt-2">
                  <DetailItem label="Residential Address" value={address} icon={MapPin} fullWidth />
                </div>
              </div>

              {/* Emergency Contacts & Identification */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Emergency Contact */}
                <div className="border border-border rounded-2xl p-5 bg-card space-y-4 shadow-xs">
                  <div className="flex items-center gap-2 pb-2 border-b border-border">
                    <Phone className="size-4 text-amber-500" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                      Emergency Contact
                    </h3>
                  </div>
                  <div className="space-y-3">
                    <DetailItem label="Contact Person Name" value={emergencyName} />
                    <DetailItem label="Emergency Phone" value={emergencyPhone} copyable />
                  </div>
                </div>

                {/* Statutory IDs */}
                <div className="border border-border rounded-2xl p-5 bg-card space-y-4 shadow-xs">
                  <div className="flex items-center gap-2 pb-2 border-b border-border">
                    <ShieldCheck className="size-4 text-emerald-500" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                      Government Identification
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <DetailItem label="PAN Number" value={panNumber} fontMono />
                    <DetailItem label="Aadhaar Number" value={aadhaarNumber} fontMono />
                    <DetailItem label="PF Number" value={pfNo} fontMono />
                    <DetailItem label="UAN" value={uan} fontMono />
                  </div>
                </div>
              </div>

              {/* ESI Statutory Block */}
              <div className="border border-border rounded-2xl p-5 bg-card space-y-3 shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-primary" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                      ESI (Employee State Insurance)
                    </h3>
                  </div>
                  <span
                    className={cn(
                      'text-[11px] font-semibold px-2.5 py-0.5 rounded-full',
                      esiApplicable
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {esiApplicable ? 'Applicable' : 'Not Applicable'}
                  </span>
                </div>
                {esiApplicable ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    <DetailItem label="ESI Number" value={esiNo} fontMono />
                    <DetailItem label="ESI Deduction Till" value={esiDeductTill} icon={Calendar} />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">ESI is currently not applied for this employee.</p>
                )}
              </div>

              {/* Document Attachments Section with Lightbox */}
              <div className="border border-border rounded-2xl p-5 bg-card space-y-4 shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-primary" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                      Saved Documents & Proofs ({sampleDocuments.length})
                    </h3>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Click document image to view full lightbox
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {sampleDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="group border border-border hover:border-primary/50 rounded-xl p-3 bg-muted/10 hover:bg-muted/30 transition-all flex items-center justify-between gap-3 shadow-2xs overflow-hidden"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {doc.isImage && doc.url ? (
                          <div
                            className="relative w-12 h-12 rounded-lg overflow-hidden border border-border shrink-0 cursor-pointer bg-muted"
                            onClick={() =>
                              setLightboxData({
                                src: doc.url,
                                title: doc.name,
                                description: `${doc.type} · ${doc.size}`,
                              })
                            }
                            title="Click to view image"
                          >
                            <img
                              src={doc.url}
                              alt={doc.name}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                              <Eye className="size-3.5" />
                            </div>
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center border border-border shrink-0">
                            <FileText className="size-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <h4 className="text-xs font-semibold text-foreground truncate">{doc.name}</h4>
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{doc.type} · {doc.size}</p>
                        </div>
                      </div>

                      {doc.isImage && doc.url && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() =>
                            setLightboxData({
                              src: doc.url,
                              title: doc.name,
                              description: `${doc.type} · ${doc.size}`,
                            })
                          }
                          className="text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg shrink-0 cursor-pointer"
                          title="View in Lightbox"
                        >
                          <Eye className="size-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB 2: EMPLOYMENT & BANK ==================== */}
          {activeTab === 'employment' && (
            <div className="space-y-6 max-w-5xl">
              {/* Employment Profile */}
              <div className="border border-border rounded-2xl p-5 bg-card space-y-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <Briefcase className="size-4 text-primary" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    Employment & Role Details
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <DetailItem label="Employee Type / Role" value={employeeRole} highlight />
                  <DetailItem label="Department" value={departmentName} />
                  <DetailItem label="Designation" value={designationName} />
                  <DetailItem label="Employee Code" value={employeeCode} fontMono />
                  <DetailItem label="Date of Joining" value={employee?.joined || '—'} icon={Calendar} />
                  <DetailItem label="Super Admin Access" value={user.is_admin ? 'Enabled' : 'Disabled'} />
                </div>
              </div>

              {/* Manager & Organizational Hierarchy */}
              <div className="border border-border rounded-2xl p-5 bg-card space-y-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <Layers className="size-4 text-primary" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    Management & Category
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <DetailItem
                    label="Assigned Supervisor / Manager"
                    value={employee?.managerName || 'No manager assigned'}
                  />
                  <DetailItem
                    label="Primary Category"
                    value={user.select_category || 'Sales'}
                  />
                  <DetailItem
                    label="Cross-Category View Permission"
                    value={user.view_other_managers ? 'Allowed to view other managers' : 'Restricted to own team'}
                  />
                  <DetailItem
                    label="Firm Name"
                    value={firm.firm_name || 'Primary Workspace'}
                  />
                </div>
              </div>

              {/* Bank Account Details */}
              <div className="border border-border rounded-2xl p-5 bg-card space-y-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <CreditCard className="size-4 text-emerald-500" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    Bank & Payout Information
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <DetailItem label="Bank A/C Holder Name" value={bankHolderName} />
                  <DetailItem label="Bank Account Number" value={bankAcNumber} fontMono copyable />
                  <DetailItem label="IFSC Code" value={bankIfsc} fontMono copyable />
                  <DetailItem label="Bank Name" value={bankName} icon={Building} />
                  <DetailItem label="Branch Name" value={bankBranch} />
                  <DetailItem label="UPI ID" value={upiId} copyable />
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB 3: ATTENDANCE SETTINGS ==================== */}
          {activeTab === 'attendance' && (
            <div className="space-y-6 max-w-5xl">
              {/* Attendance Rules & Permissions */}
              <div className="border border-border rounded-2xl p-5 bg-card space-y-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <Clock className="size-4 text-primary" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    Attendance Modes & Permissions
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <StatusToggleCard
                    title="Mobile Attendance"
                    desc="Mark punch from mobile application"
                    enabled={mobileAttendance}
                  />
                  <StatusToggleCard
                    title="Multiple Attendance"
                    desc="Allows multiple punch-ins per day"
                    enabled={multipleAttendance}
                  />
                  <StatusToggleCard
                    title="Shiftwise Attendance"
                    desc="Enforces designated work shift schedules"
                    enabled={shiftwiseAttendance}
                  />
                  <StatusToggleCard
                    title="Live Tracking"
                    desc="Real-time GPS coordinate tracking"
                    enabled={liveTracking}
                  />
                  <StatusToggleCard
                    title="AI Selfie Verification"
                    desc="Face matching on every punch"
                    enabled={aiSelfie}
                  />
                  <StatusToggleCard
                    title="Odometer Reading"
                    desc="Employee can view travel odometer"
                    enabled={selfOdometer}
                  />
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-muted-foreground block">Punch Location Boundary:</span>
                    <span className="text-sm font-semibold text-foreground">{punchFrom}</span>
                  </div>
                  <span className="text-[11px] px-2.5 py-1 rounded-md bg-muted font-medium text-foreground">
                    {punchFrom === 'Geofence' ? 'Requires Geofence Area' : 'Mark from anywhere'}
                  </span>
                </div>
              </div>

              {/* Registered AI Face Images with Lightbox */}
              <div className="border border-border rounded-2xl p-5 bg-card space-y-4 shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-amber-500" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                      Registered AI Face Images ({sampleFaceImages.length})
                    </h3>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Click any photo to open full-resolution lightbox
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {sampleFaceImages.map((face) => (
                    <div
                      key={face.id}
                      className="group border border-border hover:border-primary/50 rounded-xl p-3 bg-muted/10 hover:bg-muted/30 transition-all flex items-center gap-3.5 cursor-pointer shadow-2xs overflow-hidden"
                      onClick={() =>
                        setLightboxData({
                          src: face.url,
                          title: face.name,
                          description: `${fullName} · ${face.date}`,
                        })
                      }
                    >
                      <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-border shrink-0 bg-muted">
                        <img
                          src={face.url}
                          alt={face.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                          <Eye className="size-4" />
                        </div>
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-semibold text-foreground truncate">{face.name}</h4>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{face.date}</p>
                        <span className="inline-block text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                          Verified Bio
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Shift Schedule & Leave Template */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="border border-border rounded-2xl p-5 bg-card space-y-3 shadow-xs">
                  <div className="flex items-center gap-2 pb-2 border-b border-border">
                    <Clock className="size-4 text-primary" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                      Shift Alignment
                    </h3>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">Alignment Type:</span>
                      <span className="font-semibold text-foreground">{shiftAlignment}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">Standard Timing:</span>
                      <span className="font-mono text-foreground">10:00 AM - 06:30 PM</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">Grace Period:</span>
                      <span className="text-foreground">15 mins</span>
                    </div>
                  </div>
                </div>

                <div className="border border-border rounded-2xl p-5 bg-card space-y-3 shadow-xs">
                  <div className="flex items-center gap-2 pb-2 border-b border-border">
                    <Award className="size-4 text-primary" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                      Leave Policy & Balances
                    </h3>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">Assigned Template:</span>
                      <span className="font-semibold text-foreground">{leaveTemplate}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">Casual Leaves:</span>
                      <span className="font-medium text-foreground">{user.casual_leaves ?? 12} days</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">Sick Leaves:</span>
                      <span className="font-medium text-foreground">{user.sick_leaves ?? 8} days</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB 4: PAYROLL & OVERTIME ==================== */}
          {activeTab === 'payroll' && (
            <div className="space-y-6 max-w-5xl">
              {/* Salary & CTC Overview */}
              <div className="p-5 rounded-2xl border border-border bg-card shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Monthly Remuneration ({payType})
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-bold text-foreground">
                      ₹{Number(salaryPerMonth).toLocaleString('en-IN')}
                    </span>
                    <span className="text-xs text-muted-foreground">/ month</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-xs border border-emerald-500/20">
                    Annual CTC: ₹{(Number(salaryPerMonth) * 12).toLocaleString('en-IN')}
                  </span>
                  <span className="px-3 py-1 rounded-lg bg-muted text-foreground text-xs font-medium border border-border">
                    Pay Basis: {payType}
                  </span>
                </div>
              </div>

              {/* Overtime Policies */}
              <div className="border border-border rounded-2xl p-5 bg-card space-y-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <Wallet className="size-4 text-primary" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    Overtime Calculation & Rules
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <StatusToggleCard
                    title="Overtime Applicable"
                    desc="Entitled to overtime calculation"
                    enabled={applicableForOvertime}
                  />
                  <StatusToggleCard
                    title="Auto Overtime"
                    desc="Calculated automatically per pay cycle"
                    enabled={autoOvertime}
                  />
                  <StatusToggleCard
                    title="Week-Off Extra Pay"
                    desc={`Extra pay for work on ${weekOffDay}`}
                    enabled={weekOffPayment}
                  />
                </div>

                {applicableForOvertime && (
                  <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-foreground">Overtime Hourly Rate:</h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Triggered after {overtimeHours} hours and {overtimeMinutes} minutes
                      </p>
                    </div>
                    <span className="text-sm font-bold text-amber-600 dark:text-amber-500">
                      ₹{overtimeRate}/hour
                    </span>
                  </div>
                )}
              </div>

              {/* Benefits & Deductions Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Benefits */}
                <div className="border border-border rounded-2xl p-5 bg-card space-y-3 shadow-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                      Configured Benefits
                    </h3>
                    <span className="text-[11px] text-emerald-600 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <BenefitRow label="Basic Salary" value={`₹${(Number(salaryPerMonth) * 0.5).toLocaleString('en-IN')}`} />
                    <BenefitRow label="House Rent Allowance (HRA)" value={`₹${(Number(salaryPerMonth) * 0.3).toLocaleString('en-IN')}`} />
                    <BenefitRow label="Special Allowance" value={`₹${(Number(salaryPerMonth) * 0.2).toLocaleString('en-IN')}`} />
                  </div>
                </div>

                {/* Deductions */}
                <div className="border border-border rounded-2xl p-5 bg-card space-y-3 shadow-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                      Configured Deductions
                    </h3>
                    <span className="text-[11px] text-rose-600 font-semibold bg-rose-500/10 px-2 py-0.5 rounded-full">
                      Statutory
                    </span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <BenefitRow label="Provident Fund (PF)" value="12% of Basic" isDeduction />
                    <BenefitRow label="Employee State Insurance (ESI)" value={esiApplicable ? '0.75% Gross' : 'Exempt'} isDeduction />
                    <BenefitRow label="Professional Tax (PT)" value="₹200 / month" isDeduction />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Employee Confirmation AlertDialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="size-5" />
              Delete Employee Record?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to permanently delete <strong>{fullName}</strong> ({employeeCode})?
              This will remove all associated profile details, attendance logs, and payroll settings.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs cursor-pointer"
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Yes, Delete Employee'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Interactive Image Lightbox */}
      <ImageLightbox
        src={lightboxData?.src || null}
        title={lightboxData?.title}
        description={lightboxData?.description}
        isOpen={Boolean(lightboxData)}
        onClose={() => setLightboxData(null)}
      />
    </Panel>
  )
}

/* Helper Micro-Components */

interface DetailItemProps {
  label: string
  value: string | number
  icon?: any
  fontMono?: boolean
  copyable?: boolean
  highlight?: boolean
  fullWidth?: boolean
}

function DetailItem({
  label,
  value,
  icon: Icon,
  fontMono,
  copyable,
  highlight,
  fullWidth,
}: DetailItemProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (value && value !== '—') {
      navigator.clipboard.writeText(String(value))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <div className={cn('p-3 rounded-xl border border-border/70 bg-muted/10', fullWidth && 'col-span-full')}>
      <span className="text-[11px] font-medium text-muted-foreground block">{label}</span>
      <div className="flex items-center justify-between gap-2 mt-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {Icon && <Icon className="size-3.5 text-muted-foreground shrink-0" />}
          <span
            className={cn(
              'text-[13px] font-medium truncate text-foreground',
              fontMono && 'font-mono text-xs',
              highlight && 'text-primary font-semibold',
            )}
          >
            {value}
          </span>
        </div>

        {copyable && value !== '—' && (
          <button
            type="button"
            onClick={handleCopy}
            className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded-md hover:bg-muted transition-colors cursor-pointer shrink-0"
            title="Copy to clipboard"
          >
            {copied ? <Check className="size-3 text-emerald-500" /> : 'Copy'}
          </button>
        )}
      </div>
    </div>
  )
}

function StatusToggleCard({
  title,
  desc,
  enabled,
}: {
  title: string
  desc: string
  enabled: boolean
}) {
  return (
    <div className="p-3.5 rounded-xl border border-border/80 bg-muted/10 flex items-start justify-between gap-3">
      <div>
        <h4 className="text-xs font-semibold text-foreground">{title}</h4>
        <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <span
        className={cn(
          'text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 uppercase tracking-wider',
          enabled
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : 'bg-muted text-muted-foreground',
        )}
      >
        {enabled ? 'On' : 'Off'}
      </span>
    </div>
  )
}

function BenefitRow({
  label,
  value,
  isDeduction,
}: {
  label: string
  value: string
  isDeduction?: boolean
}) {
  return (
    <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/20 border border-border/50">
      <span className="text-muted-foreground font-medium">{label}</span>
      <span
        className={cn(
          'font-semibold',
          isDeduction ? 'text-rose-600 dark:text-rose-400' : 'text-foreground',
        )}
      >
        {value}
      </span>
    </div>
  )
}
