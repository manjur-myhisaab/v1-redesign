import { type Employee } from './employees'
import { axiosInstance } from '@/api/axiosInstance'

export type { Employee }

// ─── auth headers (token + active workspace) read from localStorage ───
function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {}
  const token = localStorage.getItem('mh.token')
  const ws = localStorage.getItem('mh.activeWs')
  if (token) h.Authorization = `Bearer ${token}`
  if (ws) h['X-Workspace-Id'] = ws
  return h
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

async function jsonOrThrow(res: Response) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data?.error ?? `Request failed (${res.status})`) as Error & {
      status?: number
      payload?: unknown
    }
    err.status = res.status
    err.payload = data
    throw err
  }
  return data
}

// ─── auth ───
export async function requestOtp(phone: string): Promise<void> {
  await jsonOrThrow(
    await fetch('/api/auth/request-otp', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ phone }),
    }),
  )
}

export interface VerifyResult {
  token: string
  user: { id: string; phone: string; name: string; email?: string; isSuperAdmin?: boolean }
  workspaces: { id: string; name: string; role: string; plan?: string; logo?: string; slug?: string }[]
}

// ─── file uploads (pluggable server-side storage) ───

export interface UploadResponse {
  success?: boolean
  message?: string
  data?: {
    asset?: string
    [key: string]: any
  }
  asset?: string
  url?: string
}

export async function uploadFile(
  file: File | string,
  _prefix?: string,
): Promise<{ data: UploadResponse; url: string; asset: string }> {
  const form = new FormData()
  if (typeof file === 'string') {
    const res = await fetch(file)
    const blob = await res.blob()
    form.append('file', blob, 'file.jpg')
  } else {
    form.append('file', file)
  }
  const res = await axiosInstance.post<UploadResponse>('/upload/image', form, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  const asset = res.data?.data?.asset || res.data?.asset || res.data?.url || ''
  return {
    data: res.data,
    url: asset,
    asset,
  }
}

export async function getImageFile(id: string, accessToken?: string) {
  const cleanId = id.replace(/^.*\/assets\//, '').replace(/^\/?assets\//, '')
  const res = await axiosInstance.get(`/assets/${cleanId}`, {
    responseType: 'blob',
    headers: accessToken
      ? {
        Authorization: `Bearer ${accessToken}`,
      }
      : undefined,
  })
  return res.data
}

// ─── current user profile ───
export interface MeProfile {
  id: string
  phone: string
  name: string
  email: string
  title: string
  timezone: string
  workingHours: string
  avatar: string // JSON-encoded react-nice-avatar config ('' if none)
}

export async function getMe(): Promise<MeProfile> {
  return jsonOrThrow(await fetch('/api/me', { headers: authHeaders() }))
}

export async function updateMe(patch: Partial<Omit<MeProfile, 'id'>>): Promise<MeProfile> {
  return jsonOrThrow(
    await fetch('/api/me', {
      method: 'PATCH',
      headers: { ...JSON_HEADERS, ...authHeaders() },
      body: JSON.stringify(patch),
    }),
  )
}

export async function verifyOtp(phone: string, otp: string): Promise<VerifyResult> {
  return jsonOrThrow(
    await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ phone, otp }),
    }),
  )
}

// ─── workspaces & members ───
export interface WorkspaceRef {
  id: string
  name: string
  role: string
  plan?: string
  logo?: string
  slug?: string
}

export async function createWorkspace(name: string): Promise<WorkspaceRef> {
  return jsonOrThrow(
    await fetch('/api/workspaces', {
      method: 'POST',
      headers: { ...JSON_HEADERS, ...authHeaders() },
      body: JSON.stringify({ name }),
    }),
  )
}

export async function updateWorkspace(
  workspaceId: string,
  patch: { name?: string; logo?: string; slug?: string },
): Promise<WorkspaceRef> {
  return jsonOrThrow(
    await fetch(`/api/workspaces/${workspaceId}`, {
      method: 'PATCH',
      headers: { ...JSON_HEADERS, ...authHeaders() },
      body: JSON.stringify(patch),
    }),
  )
}

export interface Member {
  id: string
  userId: string
  name: string
  phone: string
  role: string
  status?: string
}

export async function listMembers(workspaceId: string): Promise<Member[]> {
  return jsonOrThrow(
    await fetch(`/api/workspaces/${workspaceId}/members`, { headers: authHeaders() }),
  )
}

export async function updateMemberRole(workspaceId: string, membershipId: string, role: string): Promise<void> {
  await jsonOrThrow(
    await fetch(`/api/workspaces/${workspaceId}/members/${membershipId}`, {
      method: 'PATCH', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify({ role }),
    }),
  )
}
export async function removeMember(workspaceId: string, membershipId: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/workspaces/${workspaceId}/members/${membershipId}`, { method: 'DELETE', headers: authHeaders() }))
}

// ─── RBAC roles & permissions ───
export type PermAction = 'view' | 'manage'
export interface PermResource { key: string; label: string }
export interface RoleDef { id?: string; name: string; permissions: Record<string, PermAction[]>; isSystem: boolean }
export interface RolesPayload {
  resources: PermResource[]
  actions: PermAction[]
  builtin: RoleDef[]
  custom: RoleDef[]
}
export async function getRoles(workspaceId: string): Promise<RolesPayload> {
  return jsonOrThrow(await fetch(`/api/workspaces/${workspaceId}/roles`, { headers: authHeaders() }))
}
export async function createRole(workspaceId: string, name: string, permissions: Record<string, PermAction[]>): Promise<RoleDef> {
  return jsonOrThrow(
    await fetch(`/api/workspaces/${workspaceId}/roles`, { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify({ name, permissions }) }),
  )
}
export async function updateRole(workspaceId: string, roleId: string, input: { name?: string; permissions?: Record<string, PermAction[]> }): Promise<void> {
  await jsonOrThrow(
    await fetch(`/api/workspaces/${workspaceId}/roles/${roleId}`, { method: 'PUT', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }),
  )
}
export async function deleteRole(workspaceId: string, roleId: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/workspaces/${workspaceId}/roles/${roleId}`, { method: 'DELETE', headers: authHeaders() }))
}
export async function getMyPermissions(workspaceId: string): Promise<{ role: string; permissions: Record<string, PermAction[]> }> {
  return jsonOrThrow(await fetch(`/api/workspaces/${workspaceId}/my-permissions`, { headers: authHeaders() }))
}

export interface AnnualTier {
  plan: string
  pricePaise: number
  employeeCap: number
  label: string
}

export interface Paywall {
  plan: string
  usedSeats: number
  seatLimit: number
  perMemberPaise: number // Basic per-seat price
  proSeatPaise?: number // Pro per-seat price (includes live tracking)
  annualPaise: number
  annualTiers?: AnnualTier[]
}

// resolves to the new member, or throws an error carrying .status 402 + .payload.paywall
export async function addMember(
  workspaceId: string,
  body: { phone: string; name: string; role: string },
): Promise<Member> {
  return jsonOrThrow(
    await fetch(`/api/workspaces/${workspaceId}/members`, {
      method: 'POST',
      headers: { ...JSON_HEADERS, ...authHeaders() },
      body: JSON.stringify(body),
    }),
  )
}

export interface BillingSummary {
  plan: string
  liveTracking: boolean
  employees: { used: number; cap: number }
  members: { used: number; limit: number }
  seats: { basic: number; pro: number }
  planExpiresAt: string | null // ISO string for annual plans, null otherwise
  daysToExpiry: number | null // integer days until expiry, null when no expiry
  perMemberPaise: number
  proSeatPaise: number
  annualPaise: number
  annualTiers: AnnualTier[]
}

export async function getBillingSummary(workspaceId: string): Promise<BillingSummary> {
  return jsonOrThrow(
    await fetch(`/api/workspaces/${workspaceId}/billing`, { headers: authHeaders() }),
  )
}

export interface Invoice {
  id: string
  description: string
  amountPaise: number
  status: 'pending' | 'paid' | 'failed'
  plan: string
  createdAt: string
  paidAt: string | null
}

export async function getInvoices(workspaceId: string): Promise<Invoice[]> {
  return jsonOrThrow(
    await fetch(`/api/workspaces/${workspaceId}/invoices`, { headers: authHeaders() }),
  )
}

export interface BillingOrder {
  orderId: string
  amount: number
  currency: string
  keyId: string
  plan: string
  basicSeats: number
  proSeats: number
}

// annual: pass just the plan. per-seat: pass { basicSeats, proSeats } (a mix).
export async function createBillingOrder(
  workspaceId: string,
  plan: string, // 'per_member' | 'annual' | 'annual_500' | 'annual_unlimited'
  seats?: { basicSeats?: number; proSeats?: number },
): Promise<BillingOrder> {
  return jsonOrThrow(
    await fetch(`/api/workspaces/${workspaceId}/billing/order`, {
      method: 'POST',
      headers: { ...JSON_HEADERS, ...authHeaders() },
      body: JSON.stringify({
        plan,
        basicSeats: seats?.basicSeats ?? 0,
        proSeats: seats?.proSeats ?? 0,
      }),
    }),
  )
}

// Upgrade N owned Basic seats to Pro, paying only the per-seat price difference.
// Returns a Razorpay order (amount/seat-deltas derived & stored server-side);
// completion goes through verifyBilling, which applies the seat deltas from the
// stored invoice. Throws .status 503 when Razorpay isn't configured.
export async function upgradeSeatsToPro(
  workspaceId: string,
  seats: number,
): Promise<BillingOrder> {
  return jsonOrThrow(
    await fetch(`/api/workspaces/${workspaceId}/billing/order`, {
      method: 'POST',
      headers: { ...JSON_HEADERS, ...authHeaders() },
      body: JSON.stringify({ plan: 'seat_upgrade', upgradeSeats: seats }),
    }),
  )
}

export async function verifyBilling(
  workspaceId: string,
  body: {
    orderId: string
    paymentId: string
    signature: string
    plan: string
    basicSeats?: number
    proSeats?: number
  },
): Promise<{ ok: boolean; plan: string; extraSeats: number; proSeats: number }> {
  return jsonOrThrow(
    await fetch(`/api/workspaces/${workspaceId}/billing/verify`, {
      method: 'POST',
      headers: { ...JSON_HEADERS, ...authHeaders() },
      body: JSON.stringify(body),
    }),
  )
}

// Resume payment for a specific pending invoice — returns a fresh Razorpay order
// (amount/plan derived from the stored invoice on the server). Completion goes
// through verifyBilling, which marks the invoice paid by its orderId.
export async function payInvoice(
  workspaceId: string,
  invoiceId: string,
): Promise<BillingOrder> {
  return jsonOrThrow(
    await fetch(`/api/workspaces/${workspaceId}/invoices/${invoiceId}/pay`, {
      method: 'POST',
      headers: { ...JSON_HEADERS, ...authHeaders() },
    }),
  )
}

// ─── Field-staff live tracking ───
export interface LiveLocation {
  employeeId: string
  name: string
  department: string
  lat: number
  lng: number
  batteryPct: number | null
  accuracyM: number | null
  recordedAt: string
  lastSeenMinutes: number
  stale: boolean
  source: 'ping' | 'attendance'
}
export interface LiveTracking {
  staleMinutes: number
  locations: LiveLocation[]
}

// Throws an error carrying .status 402 + .payload.paywall when the workspace
// plan does not include live tracking (mirrors addMember / employees paywall).
export async function getLiveTracking(): Promise<LiveTracking> {
  return jsonOrThrow(await fetch('/api/tracking/live', { headers: authHeaders() }))
}

export interface JourneyPoint {
  lat: number
  lng: number
  batteryPct: number | null
  accuracyM: number | null
  recordedAt: string
}
export interface EmployeeJourney {
  employeeId: string
  name: string
  department: string
  date: string
  distanceKm: number
  points: JourneyPoint[]
}

// The full breadcrumb trail for one employee on a day (the live-tracking
// journey/timeline). Same Pro gate as getLiveTracking.
export async function getEmployeeJourney(
  employeeId: string,
  date: string,
): Promise<EmployeeJourney> {
  const q = new URLSearchParams({ employeeId, date })
  return jsonOrThrow(await fetch(`/api/tracking/journey?${q}`, { headers: authHeaders() }))
}

interface ApiEmployee {
  id: string
  empCode: string
  name: string
  email: string
  phone: string
  department: string
  role: string
  status: string
  gender: string
  joinedDate: string
  managerId: string | null
  managerUserId: string | null
  shiftId: string | null
  monthlyCtc: number
  payBasis?: string
  trackingEnabled?: boolean
  manager?: { name: string } | null
  managerUser?: { name: string } | null
}

function toEmployee(a: ApiEmployee): Employee {
  return {
    id: a.id,
    empCode: a.empCode,
    name: a.name,
    email: a.email,
    phone: a.phone,
    department: a.department,
    role: a.role,
    gender: a.gender ?? '',
    managerId: a.managerId,
    managerUserId: a.managerUserId,
    shiftId: a.shiftId,
    managerName: a.manager?.name ?? a.managerUser?.name ?? '',
    status: a.status,
    joined: a.joinedDate,
    monthlyCtc: a.monthlyCtc,
    payBasis: a.payBasis ?? 'monthly',
    trackingEnabled: a.trackingEnabled ?? false,
  }
}

// ─── employees (workspace-scoped) ───
export async function listEmployees(): Promise<Employee[]> {
  const data = (await jsonOrThrow(
    await fetch('/api/employees', { headers: authHeaders() }),
  )) as ApiEmployee[]
  return data
    .filter((a) => {
      const st = (a.status || '').toLowerCase()
      return st !== 'archived' && st !== 'suspended'
    })
    .map(toEmployee)
}

export async function createEmployee(): Promise<Employee> {
  const data = (await jsonOrThrow(
    await fetch('/api/employees', {
      method: 'POST',
      headers: { ...JSON_HEADERS, ...authHeaders() },
      body: JSON.stringify({
        name: 'New employee',
        department: 'Unassigned',
        status: 'Probation',
      }),
    }),
  )) as ApiEmployee
  return toEmployee(data)
}

export async function updateEmployee(
  id: string,
  patch: Record<string, unknown>,
): Promise<Employee> {
  const data = (await jsonOrThrow(
    await fetch(`/api/employees/${id}`, {
      method: 'PATCH',
      headers: { ...JSON_HEADERS, ...authHeaders() },
      body: JSON.stringify(patch),
    }),
  )) as ApiEmployee
  return toEmployee(data)
}

export async function setEmployeeSalary(
  id: string,
  input: { amount: number; basis: string; effectivePeriod: string },
): Promise<Employee> {
  const data = (await jsonOrThrow(
    await fetch(`/api/employees/${id}/salary`, {
      method: 'POST',
      headers: { ...JSON_HEADERS, ...authHeaders() },
      body: JSON.stringify(input),
    }),
  )) as ApiEmployee
  return toEmployee(data)
}

export async function deleteEmployee(id: string): Promise<void> {
  await jsonOrThrow(
    await fetch(`/api/employees/${id}`, { method: 'DELETE', headers: authHeaders() }),
  )
}

export interface DashboardStats {
  employees: number
  activeEmployees: number
  presentToday: number
  attendanceRatePct: number
  monthlyPayrollPaise: number
  avgSalaryPaise: number
  maxSalary: { name: string; paise: number } | null
  avgTenureMonths: number
  byDepartment: { department: string; count: number; costPaise: number }[]
  statusCounts: { status: string; count: number }[]
  topSalaries: { name: string; gender?: string; department: string; status: string; paise: number }[]
  payrollTrend: { period: string; netPaise: number }[]
  pendingApprovals: {
    name: string
    gender?: string
    kind: 'Leave' | 'Advance'
    detail: string
    paise: number | null
  }[]
}

export async function getDashboardStats(): Promise<DashboardStats> {
  return jsonOrThrow(await fetch('/api/dashboard/stats', { headers: authHeaders() }))
}

// ─── attendance configuration ───
export interface Shift {
  id?: string
  name: string
  startTime: string
  endTime: string
  lateGraceMin?: number
  earlyLeaveGraceMin?: number
  halfDayAfterMin?: number
  minFullDayMin?: number
  minHalfDayMin?: number
  isDefault?: boolean
  isOvernight?: boolean
  breakMinutes?: number
  color?: string
  [key: string]: any
}

export interface AttendancePolicy {
  workingDays: string // "0,1,..,6" (0=Sun)
  latesForHalfDay: number
  latesForAbsent: number
  earlyLeavesForHalfDay: number
  earlyLeavesForAbsent: number
  countingPeriod: 'week' | 'month'
}

export interface AttendanceConfig {
  shifts: Shift[]
  policy: AttendancePolicy
}

export async function getAttendanceConfig(): Promise<AttendanceConfig> {
  return jsonOrThrow(await fetch('/api/attendance/config', { headers: authHeaders() }))
}

export async function saveAttendanceConfig(
  config: AttendanceConfig,
): Promise<AttendanceConfig> {
  return jsonOrThrow(
    await fetch('/api/attendance/config', {
      method: 'PUT',
      headers: { ...JSON_HEADERS, ...authHeaders() },
      body: JSON.stringify(config),
    }),
  )
}

// ─── Daily register (marking) ───

export type AttendanceStatus =
  | 'present'
  | 'absent'
  | 'leave'
  | 'halfday'
  | 'holiday'
  | 'weekoff'

export interface PunchSession {
  id?: string
  type: 'work' | 'break'
  in: string // HH:MM
  out: string // HH:MM
  shiftId?: string | null // which shift this work session belongs to (work only)
}

export interface DayRecord {
  status: AttendanceStatus
  shiftId: string | null
  checkIn: string | null
  checkOut: string | null
  late: boolean
  earlyOut: boolean
  source: string
  sessions: PunchSession[]
  workedMin: number
  breakMin: number
}

export interface RosterSubject {
  kind: 'employee' | 'member'
  id: string
  employeeId?: string
  userId?: string
  name: string
  gender: string
  avatar: string // JSON config string (members) or '' (derive from name)
  subtitle: string
  department: string
  shiftId: string | null
  rosterShiftId: string | null // shift the roster says applies on this date
  rosterWeekOff: boolean
  record: DayRecord | null
  categoryId?: string
  categoryIds?: string[]
  category?: string
  rawUser?: any
  [key: string]: any
}

export interface AttendanceDay {
  date: string
  subjects: RosterSubject[]
  shifts: Shift[]
  policy: AttendancePolicy
}

export interface MarkEntry {
  employeeId?: string
  userId?: string
  status: AttendanceStatus | 'clear'
  late?: boolean
  earlyOut?: boolean
  sessions?: PunchSession[]
  shiftId?: string | null
}

export async function getAttendanceDay(date: string): Promise<AttendanceDay> {
  return jsonOrThrow(
    await fetch(`/api/attendance/day?date=${encodeURIComponent(date)}`, {
      headers: authHeaders(),
    }),
  )
}

export async function markAttendance(
  date: string,
  entries: MarkEntry[],
): Promise<{ marked: number }> {
  return jsonOrThrow(
    await fetch('/api/attendance/mark', {
      method: 'POST',
      headers: { ...JSON_HEADERS, ...authHeaders() },
      body: JSON.stringify({ date, entries }),
    }),
  )
}

// ─── Rostering ───

export interface RosterCell {
  date: string
  shiftId: string | null
  source: 'roster' | 'assignment' | 'rotation' | 'default' | 'none'
  isWeekOff: boolean
  isHoliday: boolean
}
export interface RosterRow {
  employeeId: string
  name: string
  gender: string
  department: string
  role: string
  cells: RosterCell[]
}
export interface ShiftAssignmentRow {
  id: string
  employeeId: string
  shiftId: string
  startDate: string
  endDate: string | null
  status: string
}
export interface RotationPatternRow {
  id: string
  name: string
  cycleLength: number
  anchorDate: string
  slots: string // JSON (string|null)[]
}
export interface RotationAssignmentRow {
  id: string
  employeeId: string
  patternId: string
  crewOffset: number
  startDate: string
  endDate: string | null
}
export interface RosterGrid {
  from: string
  to: string
  dates: string[]
  shifts: Shift[]
  rows: RosterRow[]
  assignments: ShiftAssignmentRow[]
  rotations: RotationAssignmentRow[]
  patterns: RotationPatternRow[]
}

export interface RosterCellInput {
  employeeId: string
  date: string
  shiftId?: string | null
  off?: boolean
  clear?: boolean
}

export async function getRoster(from: string, to: string): Promise<RosterGrid> {
  return jsonOrThrow(
    await fetch(`/api/roster?from=${from}&to=${to}`, { headers: authHeaders() }),
  )
}
export async function setRosterCells(cells: RosterCellInput[]): Promise<{ updated: number }> {
  return jsonOrThrow(
    await fetch('/api/roster/cells', {
      method: 'POST',
      headers: { ...JSON_HEADERS, ...authHeaders() },
      body: JSON.stringify({ cells }),
    }),
  )
}
export async function copyRosterWeek(
  fromStart: string,
  toStart: string,
  days = 7,
): Promise<{ updated: number }> {
  return jsonOrThrow(
    await fetch('/api/roster/copy-week', {
      method: 'POST',
      headers: { ...JSON_HEADERS, ...authHeaders() },
      body: JSON.stringify({ fromStart, toStart, days }),
    }),
  )
}
export async function createShiftAssignment(input: {
  employeeIds: string[]
  shiftId: string
  startDate: string
  endDate?: string | null
}): Promise<{ created: number }> {
  return jsonOrThrow(
    await fetch('/api/roster/assignments', {
      method: 'POST',
      headers: { ...JSON_HEADERS, ...authHeaders() },
      body: JSON.stringify(input),
    }),
  )
}
export async function deleteShiftAssignment(id: string): Promise<void> {
  await jsonOrThrow(
    await fetch(`/api/roster/assignments/${id}`, { method: 'DELETE', headers: authHeaders() }),
  )
}
export async function createRotationPattern(input: {
  name: string
  cycleLength: number
  anchorDate: string
  slots: (string | null)[]
}): Promise<RotationPatternRow> {
  return jsonOrThrow(
    await fetch('/api/roster/patterns', {
      method: 'POST',
      headers: { ...JSON_HEADERS, ...authHeaders() },
      body: JSON.stringify(input),
    }),
  )
}
export async function deleteRotationPattern(id: string): Promise<void> {
  await jsonOrThrow(
    await fetch(`/api/roster/patterns/${id}`, { method: 'DELETE', headers: authHeaders() }),
  )
}
export async function assignRotation(input: {
  employeeIds: string[]
  patternId: string
  startDate: string
  endDate?: string | null
  crewOffset?: number
}): Promise<{ created: number }> {
  return jsonOrThrow(
    await fetch('/api/roster/rotation-assign', {
      method: 'POST',
      headers: { ...JSON_HEADERS, ...authHeaders() },
      body: JSON.stringify(input),
    }),
  )
}
export async function deleteRotationAssignment(id: string): Promise<void> {
  await jsonOrThrow(
    await fetch(`/api/roster/rotation-assign/${id}`, { method: 'DELETE', headers: authHeaders() }),
  )
}

// ─── Payroll ───

export interface PayLine {
  componentCode: string
  name: string
  type: 'earning' | 'deduction' | 'reimbursement' | 'employer_contribution'
  amount: number
  baseAmount?: number
  rateBps?: number
  sortOrder?: number
}
export interface PaySlipResult {
  employeeId: string
  empName: string
  designation: string
  totalDays: number
  paidDays: number
  lopDays: number
  gross: number
  deductions: number
  employerContrib: number
  net: number
  lines: PayLine[]
  warnings: string[]
}
export interface PayrollPreview {
  period: string
  totalDays: number
  locked: boolean
  finalizedIds: string[]
  slips: PaySlipResult[]
  totals: { gross: number; deductions: number; net: number; employerCost: number; count: number }
}
export interface PayrollRunRow {
  id: string
  period: string
  status: string
  grossTotal: number
  deductionTotal: number
  netTotal: number
  employerCost: number
  lockedAt: string | null
  executedAt: string | null
  _count?: { payslips: number }
}
export interface PayslipDetail {
  id: string
  period: string
  empName: string
  designation: string
  gross: number
  deductions: number
  employerContrib: number
  net: number
  paidDays: number
  lopDays: number
  totalDays: number
  lines: PayLine[]
}
export interface StatutoryConfig {
  pfEnabled: boolean
  pfWageCeiling: number
  pfEmployeeBps: number
  pfEmployerBps: number
  restrictPfToCeiling: boolean
  esiEnabled: boolean
  esiWageCeiling: number
  esiEmployeeBps: number
  esiEmployerBps: number
  ptEnabled: boolean
  ptState: string
  ptSlabs: string
  tdsEnabled: boolean
  lopDivisor: string
  defaultTaxRegime: string
}
export interface Adjustment {
  id: string
  employeeId: string
  period: string
  type: 'earning' | 'deduction'
  label: string
  amount: number
  isTaxable: boolean
  note: string
  payslipId: string | null
}
export interface LoanInstallmentRow {
  id: string
  period: string
  seq: number
  principalPart: number
  interestPart: number
  amount: number
  status: string
}
export interface LoanRow {
  id: string
  employeeId: string
  employeeName: string
  kind: string
  principal: number
  interestType: string
  rateBps: number
  tenureMonths: number
  installment: number
  startPeriod: string
  totalPayable: number
  outstanding: number
  status: string
  note: string
  installments: LoanInstallmentRow[]
}

export async function getPayrollPreview(period: string): Promise<PayrollPreview> {
  return jsonOrThrow(await fetch(`/api/payroll/preview?period=${period}`, { headers: authHeaders() }))
}
export async function finalizePayroll(period: string, employeeIds?: string[]): Promise<{ ok: boolean; count: number }> {
  return jsonOrThrow(
    await fetch('/api/payroll/finalize', {
      method: 'POST',
      headers: { ...JSON_HEADERS, ...authHeaders() },
      body: JSON.stringify({ period, ...(employeeIds?.length ? { employeeIds } : {}) }),
    }),
  )
}
export async function getPayrollRuns(): Promise<PayrollRunRow[]> {
  return jsonOrThrow(await fetch('/api/payroll/runs', { headers: authHeaders() }))
}
export async function getPayrollRun(id: string): Promise<PayrollRunRow & { payslips: PayslipDetail[] }> {
  return jsonOrThrow(await fetch(`/api/payroll/runs/${id}`, { headers: authHeaders() }))
}
export async function getPayslip(id: string): Promise<PayslipDetail> {
  return jsonOrThrow(await fetch(`/api/payroll/payslips/${id}`, { headers: authHeaders() }))
}
export interface StructureLineDef {
  code: string
  name: string
  type: 'earning' | 'deduction'
  calcType: 'flat' | 'percent_of_base' | 'balancing'
  baseCode?: string
  rateBps?: number
  flatAmount?: number
  partOfPfWage?: boolean
  partOfEsiWage?: boolean
  prorateOnLop?: boolean
  sortOrder?: number
}
export interface SalaryStructureRow {
  id: string
  name: string
  description: string
  isDefault: boolean
  lines: string // JSON StructureLineDef[]
}

export async function getSalaryStructures(): Promise<SalaryStructureRow[]> {
  return jsonOrThrow(await fetch('/api/payroll/structures', { headers: authHeaders() }))
}
export async function createSalaryStructure(input: {
  name: string
  description?: string
  isDefault?: boolean
  lines: StructureLineDef[]
}): Promise<SalaryStructureRow> {
  return jsonOrThrow(
    await fetch('/api/payroll/structures', {
      method: 'POST',
      headers: { ...JSON_HEADERS, ...authHeaders() },
      body: JSON.stringify(input),
    }),
  )
}
export async function updateSalaryStructure(
  id: string,
  input: { name?: string; description?: string; isDefault?: boolean; lines?: StructureLineDef[] },
): Promise<void> {
  await jsonOrThrow(
    await fetch(`/api/payroll/structures/${id}`, {
      method: 'PUT',
      headers: { ...JSON_HEADERS, ...authHeaders() },
      body: JSON.stringify(input),
    }),
  )
}
export async function deleteSalaryStructure(id: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/payroll/structures/${id}`, { method: 'DELETE', headers: authHeaders() }))
}

export async function getPayslipPdfBlob(id: string): Promise<Blob> {
  const res = await fetch(`/api/payroll/payslips/${id}/pdf`, { headers: authHeaders() })
  if (!res.ok) throw new Error('Could not generate payslip PDF')
  return res.blob()
}

export async function getStatutoryConfig(): Promise<StatutoryConfig> {
  return jsonOrThrow(await fetch('/api/payroll/config', { headers: authHeaders() }))
}
export async function updateStatutoryConfig(patch: Partial<StatutoryConfig>): Promise<StatutoryConfig> {
  return jsonOrThrow(
    await fetch('/api/payroll/config', {
      method: 'PUT',
      headers: { ...JSON_HEADERS, ...authHeaders() },
      body: JSON.stringify(patch),
    }),
  )
}
export async function listAdjustments(period: string): Promise<Adjustment[]> {
  return jsonOrThrow(await fetch(`/api/payroll/adjustments?period=${period}`, { headers: authHeaders() }))
}
export async function addAdjustment(input: {
  employeeId: string
  period: string
  type: 'earning' | 'deduction'
  label: string
  amount: number
  isTaxable?: boolean
  note?: string
}): Promise<Adjustment> {
  return jsonOrThrow(
    await fetch('/api/payroll/adjustments', {
      method: 'POST',
      headers: { ...JSON_HEADERS, ...authHeaders() },
      body: JSON.stringify(input),
    }),
  )
}
export async function deleteAdjustment(id: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/payroll/adjustments/${id}`, { method: 'DELETE', headers: authHeaders() }))
}
export async function listAdvances(): Promise<LoanRow[]> {
  return jsonOrThrow(await fetch('/api/advances', { headers: authHeaders() }))
}
export async function createAdvance(
  input: {
    employeeId: string
    kind: string
    principal: number
    interestType: string
    rateBps: number
    tenureMonths: number
    startPeriod: string
    note?: string
  },
  idempotencyKey?: string,
): Promise<LoanRow> {
  return jsonOrThrow(
    await fetch('/api/advances', {
      method: 'POST',
      headers: { ...JSON_HEADERS, ...authHeaders(), ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
      body: JSON.stringify(input),
    }),
  )
}
export async function closeAdvance(id: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/advances/${id}/close`, { method: 'POST', headers: authHeaders() }))
}
export async function deleteAdvance(id: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/advances/${id}`, { method: 'DELETE', headers: authHeaders() }))
}

// ─── Platform superadmin ───
export interface PlatformWorkspace {
  id: string
  name: string
  plan: string
  ownerName: string
  ownerPhone: string
  ownerEmail: string
  employees: number
  members: number
  employeeCap: number
  liveTracking: boolean
  revenuePaise: number
  createdAt: string
}
export interface PlatformOverview {
  totals: { workspaces: number; users: number; employees: number; revenuePaise: number; paying: number; byPlan: Record<string, number> }
  workspaces: PlatformWorkspace[]
}
export interface SupportTicketRow {
  id: string
  workspaceId: string
  workspaceName?: string
  createdByName?: string
  subject: string
  message: string
  status: string
  response: string
  createdAt: string
}

export interface DbNodeHealth {
  id: string
  role: 'primary' | 'replica'
  backing: 'live' | 'primary-fallback'
  dynamic: boolean
  draining: boolean
  status: string
  reads: number
  writes: number
  total: number
  qps: number
  avgLatencyMs: number
  lastLatencyMs: number
}
export interface ScaleEvent {
  t: number
  type: 'scale-up' | 'scale-down'
  nodeId: string
  reason: string
}
export interface DbHealth {
  replicasConfigured: number
  autoscale: {
    activeReplicas: number
    baseReplicas: number
    maxDynamic: number
    perReplicaQps: number
    upThreshold: number
    downThreshold: number
    simulating: boolean
  }
  events: ScaleEvent[]
  nodes: DbNodeHealth[]
  totals: { reads: number; writes: number; qps: number }
}
export async function getDbHealth(): Promise<DbHealth> {
  return jsonOrThrow(await fetch('/api/superadmin/db-health', { headers: authHeaders() }))
}
export async function simulateDbLoad(on: boolean): Promise<{ simulating: boolean }> {
  return jsonOrThrow(
    await fetch('/api/superadmin/db-simulate', {
      method: 'POST',
      headers: { ...JSON_HEADERS, ...authHeaders() },
      body: JSON.stringify({ on }),
    }),
  )
}

export interface QueueWorker { id: number; busy: boolean; type: string | null; done: number }
export interface QueueHealth {
  depth: number
  running: number
  workers: QueueWorker[]
  pool: { min: number; max: number; active: number }
  counters: { processed: number; failed: number; retried: number; doneTotal: number; failedTotal: number }
  jobsPerSec: number
  events: { t: number; type: 'worker-up' | 'worker-down'; workerId: number }[]
  recent: { id: string; type: string; status: string; attempts: number; lastError: string; finishedAt: string | null }[]
}
export async function getQueueHealth(): Promise<QueueHealth> {
  return jsonOrThrow(await fetch('/api/superadmin/queue-health', { headers: authHeaders() }))
}
export async function simulateQueueLoad(count: number): Promise<{ enqueued: number }> {
  return jsonOrThrow(
    await fetch('/api/superadmin/queue-simulate', {
      method: 'POST',
      headers: { ...JSON_HEADERS, ...authHeaders() },
      body: JSON.stringify({ count }),
    }),
  )
}
export async function clearQueueDemo(): Promise<{ cleared: number }> {
  return jsonOrThrow(
    await fetch('/api/superadmin/queue-clear', { method: 'POST', headers: authHeaders() }),
  )
}

export async function getPlatformOverview(): Promise<PlatformOverview> {
  return jsonOrThrow(await fetch('/api/superadmin/overview', { headers: authHeaders() }))
}
export async function getPlatformTickets(status?: string): Promise<SupportTicketRow[]> {
  return jsonOrThrow(await fetch(`/api/superadmin/tickets${status ? `?status=${status}` : ''}`, { headers: authHeaders() }))
}
export async function resolveTicket(id: string, response: string): Promise<void> {
  await jsonOrThrow(
    await fetch(`/api/superadmin/tickets/${id}/resolve`, {
      method: 'POST',
      headers: { ...JSON_HEADERS, ...authHeaders() },
      body: JSON.stringify({ response }),
    }),
  )
}
export async function createSupportTicket(subject: string, message: string): Promise<SupportTicketRow> {
  return jsonOrThrow(
    await fetch('/api/support/tickets', {
      method: 'POST',
      headers: { ...JSON_HEADERS, ...authHeaders() },
      body: JSON.stringify({ subject, message }),
    }),
  )
}

// ─── Reports ───
export type ReportFieldType = 'text' | 'number' | 'money' | 'date' | 'bool' | 'enum'
export interface ReportField { key: string; label: string; type: ReportFieldType; enum?: string[] }
export interface ReportDataset { key: string; label: string; ranged: 'none' | 'date' | 'period'; fields: ReportField[] }
export interface ReportFilter { field: string; op: string; value: string }
export interface ReportConfig {
  columns?: string[]
  filters?: ReportFilter[]
  groupBy?: string
  sort?: { field: string; dir: 'asc' | 'desc' }
  period?: string
  dateFrom?: string
  dateTo?: string
}
export interface ReportResult {
  columns: ReportField[]
  rows: Record<string, unknown>[]
  total: number
  grouped: boolean
}
export interface SavedReport {
  id: string
  name: string
  dataset: string
  config: string // JSON ReportConfig
  updatedAt: string
}

export async function getReportDatasets(): Promise<ReportDataset[]> {
  return jsonOrThrow(await fetch('/api/reports/datasets', { headers: authHeaders() }))
}
export async function runReport(dataset: string, config: ReportConfig): Promise<ReportResult> {
  return jsonOrThrow(
    await fetch('/api/reports/run', { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify({ dataset, config }) }),
  )
}
export async function getSavedReports(): Promise<SavedReport[]> {
  return jsonOrThrow(await fetch('/api/reports/saved', { headers: authHeaders() }))
}
export async function saveReport(input: { name: string; dataset: string; config: ReportConfig }): Promise<SavedReport> {
  return jsonOrThrow(
    await fetch('/api/reports/saved', { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }),
  )
}
export async function updateSavedReport(id: string, input: { name?: string; config?: ReportConfig }): Promise<void> {
  await jsonOrThrow(
    await fetch(`/api/reports/saved/${id}`, { method: 'PUT', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }),
  )
}
export async function deleteSavedReport(id: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/reports/saved/${id}`, { method: 'DELETE', headers: authHeaders() }))
}

// ─── Announcements (notice board) ───
export interface Announcement { id: string; title: string; body: string; pinned: boolean; createdAt: string }
export async function getAnnouncements(): Promise<Announcement[]> {
  return jsonOrThrow(await fetch('/api/announcements', { headers: authHeaders() }))
}
export async function postAnnouncement(input: { title: string; body?: string; pinned?: boolean }): Promise<Announcement> {
  return jsonOrThrow(await fetch('/api/announcements', { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }))
}
export async function deleteAnnouncement(id: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/announcements/${id}`, { method: 'DELETE', headers: authHeaders() }))
}

// ─── Audit log ───
export interface AuditEntry { id: string; action: string; entity: string; entityId: string; detail: string; actorName: string; createdAt: string }
export async function getAuditLog(): Promise<AuditEntry[]> {
  return jsonOrThrow(await fetch('/api/audit', { headers: authHeaders() }))
}

// ─── Notifications (in-app bell) ───
export interface Notification {
  id: string
  type: string
  title: string
  body: string
  link: string
  read: boolean
  createdAt: string
}
export async function getNotifications(): Promise<Notification[]> {
  return jsonOrThrow(await fetch('/api/notifications', { headers: authHeaders() }))
}
export async function getUnreadCount(): Promise<number> {
  const r = await jsonOrThrow(await fetch('/api/notifications/unread-count', { headers: authHeaders() }))
  return r.count as number
}
export async function markNotificationRead(id: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/notifications/${id}/read`, { method: 'POST', headers: authHeaders() }))
}
export async function markAllNotificationsRead(): Promise<void> {
  await jsonOrThrow(await fetch('/api/notifications/read-all', { method: 'POST', headers: authHeaders() }))
}

// ─── Messaging (DMs + group channels + inbox) ───
export interface Conversation {
  id: string
  kind: 'dm' | 'group'
  title: string
  otherUserId: string | null
  participantCount: number
  lastMessage: string
  lastMessageAt: string
  unreadCount: number
}
export interface ChatMessage {
  id: string
  senderId: string
  senderName: string
  body: string
  mine: boolean
  createdAt: string
}
export interface MessagePerson {
  userId: string
  name: string
  phone: string
  role: string
}

export async function getConversations(): Promise<Conversation[]> {
  return jsonOrThrow(await fetch('/api/messages/conversations', { headers: authHeaders() }))
}
export async function getMessagePeople(): Promise<MessagePerson[]> {
  return jsonOrThrow(await fetch('/api/messages/people', { headers: authHeaders() }))
}
export async function openDm(userId: string): Promise<{ id: string }> {
  return jsonOrThrow(
    await fetch('/api/messages/conversations/dm', {
      method: 'POST',
      headers: { ...JSON_HEADERS, ...authHeaders() },
      body: JSON.stringify({ userId }),
    }),
  )
}
export async function openDmForEmployee(employeeId: string): Promise<{ id: string }> {
  return jsonOrThrow(
    await fetch('/api/messages/conversations/dm-employee', {
      method: 'POST',
      headers: { ...JSON_HEADERS, ...authHeaders() },
      body: JSON.stringify({ employeeId }),
    }),
  )
}
export async function createGroup(title: string, memberIds: string[]): Promise<{ id: string }> {
  return jsonOrThrow(
    await fetch('/api/messages/conversations/group', {
      method: 'POST',
      headers: { ...JSON_HEADERS, ...authHeaders() },
      body: JSON.stringify({ title, memberIds }),
    }),
  )
}
export async function getMessages(convId: string): Promise<ChatMessage[]> {
  return jsonOrThrow(
    await fetch(`/api/messages/conversations/${convId}/messages`, { headers: authHeaders() }),
  )
}
export async function sendMessage(convId: string, body: string): Promise<{ id: string; createdAt: string }> {
  return jsonOrThrow(
    await fetch(`/api/messages/conversations/${convId}/messages`, {
      method: 'POST',
      headers: { ...JSON_HEADERS, ...authHeaders() },
      body: JSON.stringify({ body }),
    }),
  )
}
export async function markConversationRead(convId: string): Promise<void> {
  await jsonOrThrow(
    await fetch(`/api/messages/conversations/${convId}/read`, { method: 'POST', headers: authHeaders() }),
  )
}

// ─── Sidebar nav counts ───
export interface NavCounts { employees: number; present: number; pendingLeaves: number }
export async function getNavCounts(): Promise<NavCounts> {
  return jsonOrThrow(await fetch('/api/dashboard/nav-counts', { headers: authHeaders() }))
}

// ─── Holidays ───
export interface Holiday { id: string; date: string; name: string; type: string }
export async function getHolidays(year?: string): Promise<Holiday[]> {
  return jsonOrThrow(await fetch(`/api/holidays${year ? `?year=${year}` : ''}`, { headers: authHeaders() }))
}
export async function getUpcomingHolidays(): Promise<Holiday[]> {
  return jsonOrThrow(await fetch('/api/holidays/upcoming', { headers: authHeaders() }))
}
export async function addHoliday(input: { date: string; name: string; type: string }): Promise<Holiday> {
  return jsonOrThrow(await fetch('/api/holidays', { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }))
}
export async function deleteHoliday(id: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/holidays/${id}`, { method: 'DELETE', headers: authHeaders() }))
}

// ─── Leave ───
export interface LeaveType {
  id: string
  name: string
  code: string
  annualDays: number
  paid: boolean
  color: string
  active: boolean
}
export interface LeaveBalanceRow {
  id: string
  leaveTypeId: string
  year: number
  allocated: number
  used: number
  available: number
  typeName: string
  code: string
  color: string
}
export interface LeaveRequestRow {
  id: string
  employeeId: string
  employeeName: string
  leaveTypeId: string
  typeName: string
  fromDate: string
  toDate: string
  days: number
  halfDay: boolean
  status: string
  reason: string
  createdAt: string
}

export async function getLeaveTypes(): Promise<LeaveType[]> {
  return jsonOrThrow(await fetch('/api/leave/types', { headers: authHeaders() }))
}
export async function createLeaveType(input: { name: string; code: string; annualDays: number; paid: boolean; color?: string }): Promise<LeaveType> {
  return jsonOrThrow(
    await fetch('/api/leave/types', { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }),
  )
}
export async function updateLeaveType(id: string, patch: Partial<LeaveType>): Promise<void> {
  await jsonOrThrow(
    await fetch(`/api/leave/types/${id}`, { method: 'PUT', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(patch) }),
  )
}
export async function deleteLeaveType(id: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/leave/types/${id}`, { method: 'DELETE', headers: authHeaders() }))
}
export async function getLeaveBalances(employeeId: string): Promise<LeaveBalanceRow[]> {
  return jsonOrThrow(await fetch(`/api/leave/balances?employeeId=${employeeId}`, { headers: authHeaders() }))
}
export async function getLeaveRequests(status?: string): Promise<LeaveRequestRow[]> {
  return jsonOrThrow(
    await fetch(`/api/leave/requests${status ? `?status=${status}` : ''}`, { headers: authHeaders() }),
  )
}
export async function applyLeave(
  input: { employeeId: string; leaveTypeId: string; fromDate: string; toDate: string; halfDay?: boolean; reason?: string },
  idempotencyKey?: string,
): Promise<LeaveRequestRow> {
  return jsonOrThrow(
    await fetch('/api/leave/requests', {
      method: 'POST',
      headers: { ...JSON_HEADERS, ...authHeaders(), ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
      body: JSON.stringify(input),
    }),
  )
}
export async function approveLeave(id: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/leave/requests/${id}/approve`, { method: 'POST', headers: authHeaders() }))
}
export async function rejectLeave(id: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/leave/requests/${id}/reject`, { method: 'POST', headers: authHeaders() }))
}

export async function assignDepartmentShift(
  department: string,
  shiftId: string | null,
): Promise<{ updated: number }> {
  return jsonOrThrow(
    await fetch('/api/attendance/assign-shift', {
      method: 'POST',
      headers: { ...JSON_HEADERS, ...authHeaders() },
      body: JSON.stringify({ department, shiftId }),
    }),
  )
}

export interface OnboardingStatus {
  workspaceReady: boolean
  employeesAdded: boolean
  teamInvited: boolean
  payrollSetUp: boolean
  payrollRun: boolean
}

export async function getOnboarding(): Promise<OnboardingStatus> {
  return jsonOrThrow(await fetch('/api/onboarding', { headers: authHeaders() }))
}

// ─── Tasks ───
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  assigneeId: string | null
  assigneeName: string
  createdById: string
  dueDate: string
  completedAt: string | null
  createdAt: string
}
export interface TaskComment {
  id: string
  authorId: string
  authorName: string
  body: string
  createdAt: string
}
export interface TaskStats {
  todo: number
  in_progress: number
  done: number
  overdue: number
}
export interface TaskFilters {
  status?: string
  priority?: string
  assigneeId?: string
  q?: string
}

export async function getTasks(filters: TaskFilters = {}): Promise<Task[]> {
  const qs = new URLSearchParams()
  if (filters.status) qs.set('status', filters.status)
  if (filters.priority) qs.set('priority', filters.priority)
  if (filters.assigneeId) qs.set('assigneeId', filters.assigneeId)
  if (filters.q) qs.set('q', filters.q)
  const suffix = qs.toString() ? `?${qs}` : ''
  return jsonOrThrow(await fetch(`/api/tasks${suffix}`, { headers: authHeaders() }))
}
export async function getTaskStats(): Promise<TaskStats> {
  return jsonOrThrow(await fetch('/api/tasks/stats', { headers: authHeaders() }))
}
export async function createTask(input: {
  title: string
  description?: string
  priority?: TaskPriority
  assigneeId?: string | null
  dueDate?: string
}): Promise<Task> {
  return jsonOrThrow(
    await fetch('/api/tasks', { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }),
  )
}
export async function updateTask(
  id: string,
  patch: {
    title?: string
    description?: string
    status?: TaskStatus
    priority?: TaskPriority
    assigneeId?: string | null
    dueDate?: string
  },
): Promise<Task> {
  return jsonOrThrow(
    await fetch(`/api/tasks/${id}`, { method: 'PATCH', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(patch) }),
  )
}
export async function deleteTask(id: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/tasks/${id}`, { method: 'DELETE', headers: authHeaders() }))
}
export async function getTaskComments(id: string): Promise<TaskComment[]> {
  return jsonOrThrow(await fetch(`/api/tasks/${id}/comments`, { headers: authHeaders() }))
}
export async function addTaskComment(id: string, body: string): Promise<TaskComment> {
  return jsonOrThrow(
    await fetch(`/api/tasks/${id}/comments`, { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify({ body }) }),
  )
}

// ─── CRM ───
export type DealStage = 'new' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost'
export type DealSource = '' | 'referral' | 'website' | 'cold' | 'event' | 'other'
export type ActivityType = 'call' | 'email' | 'meeting' | 'note'

export interface Company {
  id: string
  name: string
  industry: string
  website: string
  phone: string
  ownerId: string | null
  ownerName: string
  contactCount: number
  dealCount: number
  createdAt: string
}
export interface Contact {
  id: string
  companyId: string | null
  companyName: string
  name: string
  email: string
  phone: string
  title: string
  ownerId: string | null
  ownerName: string
  createdAt: string
}
export interface Deal {
  id: string
  title: string
  companyId: string | null
  companyName: string
  contactId: string | null
  contactName: string
  ownerId: string | null
  ownerName: string
  stage: DealStage
  valuePaise: number
  source: DealSource
  expectedClose: string
  closedAt: string | null
  createdAt: string
}
export interface Activity {
  id: string
  dealId: string | null
  contactId: string | null
  type: ActivityType
  notes: string
  dueDate: string
  done: boolean
  createdById: string
  createdByName: string
  createdAt: string
}
export interface PipelineStage {
  stage: DealStage
  count: number
  valuePaise: number
  deals: Deal[]
}
export interface Pipeline {
  stages: PipelineStage[]
  summary: {
    openValuePaise: number
    openCount: number
    wonValuePaise: number
    wonCount: number
    totalCount: number
  }
}

// Companies
export async function getCompanies(q?: string): Promise<Company[]> {
  const suffix = q ? `?q=${encodeURIComponent(q)}` : ''
  return jsonOrThrow(await fetch(`/api/crm/companies${suffix}`, { headers: authHeaders() }))
}
export async function createCompany(input: {
  name: string
  industry?: string
  website?: string
  phone?: string
  ownerId?: string | null
}): Promise<Company> {
  return jsonOrThrow(
    await fetch('/api/crm/companies', { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }),
  )
}
export async function updateCompany(
  id: string,
  patch: { name?: string; industry?: string; website?: string; phone?: string; ownerId?: string | null },
): Promise<Company> {
  return jsonOrThrow(
    await fetch(`/api/crm/companies/${id}`, { method: 'PATCH', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(patch) }),
  )
}
export async function deleteCompany(id: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/crm/companies/${id}`, { method: 'DELETE', headers: authHeaders() }))
}

// Contacts
export async function getContacts(filters: { q?: string; companyId?: string } = {}): Promise<Contact[]> {
  const qs = new URLSearchParams()
  if (filters.q) qs.set('q', filters.q)
  if (filters.companyId) qs.set('companyId', filters.companyId)
  const suffix = qs.toString() ? `?${qs}` : ''
  return jsonOrThrow(await fetch(`/api/crm/contacts${suffix}`, { headers: authHeaders() }))
}
export async function createContact(input: {
  name: string
  email?: string
  phone?: string
  title?: string
  companyId?: string | null
  ownerId?: string | null
}): Promise<Contact> {
  return jsonOrThrow(
    await fetch('/api/crm/contacts', { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }),
  )
}
export async function updateContact(
  id: string,
  patch: { name?: string; email?: string; phone?: string; title?: string; companyId?: string | null; ownerId?: string | null },
): Promise<Contact> {
  return jsonOrThrow(
    await fetch(`/api/crm/contacts/${id}`, { method: 'PATCH', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(patch) }),
  )
}
export async function deleteContact(id: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/crm/contacts/${id}`, { method: 'DELETE', headers: authHeaders() }))
}

// Deals
export async function getDeals(filters: { stage?: string; ownerId?: string; q?: string } = {}): Promise<Deal[]> {
  const qs = new URLSearchParams()
  if (filters.stage) qs.set('stage', filters.stage)
  if (filters.ownerId) qs.set('ownerId', filters.ownerId)
  if (filters.q) qs.set('q', filters.q)
  const suffix = qs.toString() ? `?${qs}` : ''
  return jsonOrThrow(await fetch(`/api/crm/deals${suffix}`, { headers: authHeaders() }))
}
export async function getPipeline(): Promise<Pipeline> {
  return jsonOrThrow(await fetch('/api/crm/deals/pipeline', { headers: authHeaders() }))
}
export async function createDeal(input: {
  title: string
  companyId?: string | null
  contactId?: string | null
  ownerId?: string | null
  stage?: DealStage
  valuePaise?: number
  source?: DealSource
  expectedClose?: string
}): Promise<Deal> {
  return jsonOrThrow(
    await fetch('/api/crm/deals', { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }),
  )
}
export async function updateDeal(
  id: string,
  patch: {
    title?: string
    companyId?: string | null
    contactId?: string | null
    ownerId?: string | null
    stage?: DealStage
    valuePaise?: number
    source?: DealSource
    expectedClose?: string
  },
): Promise<Deal> {
  return jsonOrThrow(
    await fetch(`/api/crm/deals/${id}`, { method: 'PATCH', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(patch) }),
  )
}
export async function deleteDeal(id: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/crm/deals/${id}`, { method: 'DELETE', headers: authHeaders() }))
}

// Activities
export async function getActivities(filters: { dealId?: string; contactId?: string }): Promise<Activity[]> {
  const qs = new URLSearchParams()
  if (filters.dealId) qs.set('dealId', filters.dealId)
  if (filters.contactId) qs.set('contactId', filters.contactId)
  return jsonOrThrow(await fetch(`/api/crm/activities?${qs}`, { headers: authHeaders() }))
}
export async function createActivity(input: {
  dealId?: string | null
  contactId?: string | null
  type: ActivityType
  notes?: string
  dueDate?: string
  done?: boolean
}): Promise<Activity> {
  return jsonOrThrow(
    await fetch('/api/crm/activities', { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }),
  )
}
export async function updateActivity(
  id: string,
  patch: { type?: ActivityType; notes?: string; dueDate?: string; done?: boolean },
): Promise<Activity> {
  return jsonOrThrow(
    await fetch(`/api/crm/activities/${id}`, { method: 'PATCH', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(patch) }),
  )
}
export async function deleteActivity(id: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/crm/activities/${id}`, { method: 'DELETE', headers: authHeaders() }))
}

// ─── Sales (products, orders, customer invoices, incentives → payroll) ───
export type OrderStatus = 'draft' | 'confirmed' | 'fulfilled' | 'cancelled'
export type Invoice2Status = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
export type PayoutStatus = 'pending' | 'approved' | 'paid' | 'rejected'

export interface Product {
  id: string
  name: string
  sku: string
  description: string
  pricePaise: number
  taxBps: number
  active: boolean
  createdAt: string
}
export interface SalesOrderItem {
  id: string
  orderId: string
  productId: string | null
  name: string
  qty: number
  unitPricePaise: number
  taxBps: number
  lineTotalPaise: number
}
export interface SalesOrder {
  id: string
  orderNo: number
  companyId: string | null
  companyName: string
  contactId: string | null
  customerName: string
  salespersonId: string | null
  salespersonName: string
  status: OrderStatus
  subtotalPaise: number
  taxPaise: number
  totalPaise: number
  orderDate: string
  note: string
  createdById: string
  createdAt: string
  items?: SalesOrderItem[]
}
export interface Invoice2 {
  id: string
  invoiceNo: number
  orderId: string | null
  customerName: string
  status: Invoice2Status
  subtotalPaise: number
  taxPaise: number
  totalPaise: number
  amountPaidPaise: number
  issueDate: string
  dueDate: string
  createdById: string
  createdAt: string
}
export interface IncentiveRule {
  id: string
  name: string
  rateBps: number
  minOrderPaise: number
  active: boolean
  createdAt: string
}
export interface IncentivePayout {
  id: string
  employeeId: string
  employeeName: string
  orderId: string | null
  ruleId: string | null
  ruleName: string
  period: string
  amountPaise: number
  status: PayoutStatus
  adjustmentId: string | null
  note: string
  createdAt: string
}
export interface IncentiveSummary {
  byStatus: Record<PayoutStatus, { count: number; amountPaise: number }>
  thisMonth: { period: string; pendingPaise: number; pendingCount: number }
}
export interface OrderItemInput {
  productId?: string | null
  name: string
  qty: number
  unitPricePaise: number
  taxBps: number
}

// Products
export async function getProducts(filters: { q?: string; active?: boolean } = {}): Promise<Product[]> {
  const qs = new URLSearchParams()
  if (filters.q) qs.set('q', filters.q)
  if (filters.active !== undefined) qs.set('active', String(filters.active))
  const suffix = qs.toString() ? `?${qs}` : ''
  return jsonOrThrow(await fetch(`/api/sales/products${suffix}`, { headers: authHeaders() }))
}
export async function createProduct(input: {
  name: string
  sku?: string
  description?: string
  pricePaise?: number
  taxBps?: number
  active?: boolean
}): Promise<Product> {
  return jsonOrThrow(
    await fetch('/api/sales/products', { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }),
  )
}
export async function updateProduct(
  id: string,
  patch: { name?: string; sku?: string; description?: string; pricePaise?: number; taxBps?: number; active?: boolean },
): Promise<Product> {
  return jsonOrThrow(
    await fetch(`/api/sales/products/${id}`, { method: 'PATCH', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(patch) }),
  )
}
export async function deleteProduct(id: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/sales/products/${id}`, { method: 'DELETE', headers: authHeaders() }))
}

// Orders
export async function getOrders(filters: { status?: string; salespersonId?: string; q?: string } = {}): Promise<SalesOrder[]> {
  const qs = new URLSearchParams()
  if (filters.status) qs.set('status', filters.status)
  if (filters.salespersonId) qs.set('salespersonId', filters.salespersonId)
  if (filters.q) qs.set('q', filters.q)
  const suffix = qs.toString() ? `?${qs}` : ''
  return jsonOrThrow(await fetch(`/api/sales/orders${suffix}`, { headers: authHeaders() }))
}
export async function getOrder(id: string): Promise<SalesOrder> {
  return jsonOrThrow(await fetch(`/api/sales/orders/${id}`, { headers: authHeaders() }))
}
export async function createOrder(input: {
  companyId?: string | null
  contactId?: string | null
  customerName?: string
  salespersonId?: string | null
  orderDate?: string
  note?: string
  status?: OrderStatus
  items: OrderItemInput[]
}): Promise<SalesOrder> {
  return jsonOrThrow(
    await fetch('/api/sales/orders', { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }),
  )
}
export async function updateOrder(
  id: string,
  patch: {
    companyId?: string | null
    contactId?: string | null
    customerName?: string
    salespersonId?: string | null
    orderDate?: string
    note?: string
    status?: OrderStatus
    items?: OrderItemInput[]
  },
): Promise<SalesOrder> {
  return jsonOrThrow(
    await fetch(`/api/sales/orders/${id}`, { method: 'PATCH', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(patch) }),
  )
}
export async function deleteOrder(id: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/sales/orders/${id}`, { method: 'DELETE', headers: authHeaders() }))
}

// Invoices
export async function getSalesInvoices(status?: string): Promise<Invoice2[]> {
  const suffix = status ? `?status=${status}` : ''
  return jsonOrThrow(await fetch(`/api/sales/invoices${suffix}`, { headers: authHeaders() }))
}
export async function createSalesInvoice(input: {
  orderId?: string
  customerName?: string
  subtotalPaise?: number
  taxPaise?: number
  taxBps?: number
  issueDate?: string
  dueDate?: string
  status?: Invoice2Status
}): Promise<Invoice2> {
  return jsonOrThrow(
    await fetch('/api/sales/invoices', { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }),
  )
}
export async function updateSalesInvoice(
  id: string,
  patch: { customerName?: string; issueDate?: string; dueDate?: string; status?: Invoice2Status; amountPaidPaise?: number },
): Promise<Invoice2> {
  return jsonOrThrow(
    await fetch(`/api/sales/invoices/${id}`, { method: 'PATCH', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(patch) }),
  )
}
export async function deleteSalesInvoice(id: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/sales/invoices/${id}`, { method: 'DELETE', headers: authHeaders() }))
}

// Incentive rules
export async function getIncentiveRules(): Promise<IncentiveRule[]> {
  return jsonOrThrow(await fetch('/api/sales/incentive-rules', { headers: authHeaders() }))
}
export async function createIncentiveRule(input: { name: string; rateBps?: number; minOrderPaise?: number; active?: boolean }): Promise<IncentiveRule> {
  return jsonOrThrow(
    await fetch('/api/sales/incentive-rules', { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }),
  )
}
export async function updateIncentiveRule(
  id: string,
  patch: { name?: string; rateBps?: number; minOrderPaise?: number; active?: boolean },
): Promise<IncentiveRule> {
  return jsonOrThrow(
    await fetch(`/api/sales/incentive-rules/${id}`, { method: 'PATCH', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(patch) }),
  )
}
export async function deleteIncentiveRule(id: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/sales/incentive-rules/${id}`, { method: 'DELETE', headers: authHeaders() }))
}

// Incentive payouts
export async function getIncentives(filters: { status?: string; period?: string; employeeId?: string } = {}): Promise<IncentivePayout[]> {
  const qs = new URLSearchParams()
  if (filters.status) qs.set('status', filters.status)
  if (filters.period) qs.set('period', filters.period)
  if (filters.employeeId) qs.set('employeeId', filters.employeeId)
  const suffix = qs.toString() ? `?${qs}` : ''
  return jsonOrThrow(await fetch(`/api/sales/incentives${suffix}`, { headers: authHeaders() }))
}
export async function getIncentiveSummary(): Promise<IncentiveSummary> {
  return jsonOrThrow(await fetch('/api/sales/incentives/summary', { headers: authHeaders() }))
}
export async function approveIncentive(id: string): Promise<IncentivePayout> {
  return jsonOrThrow(await fetch(`/api/sales/incentives/${id}/approve`, { method: 'POST', headers: authHeaders() }))
}
export async function rejectIncentive(id: string): Promise<IncentivePayout> {
  return jsonOrThrow(await fetch(`/api/sales/incentives/${id}/reject`, { method: 'POST', headers: authHeaders() }))
}

// ─── Expenses / reimbursement claims (approved → reimbursed → payroll earning) ───
export type ExpenseStatus = 'submitted' | 'approved' | 'rejected' | 'reimbursed' | 'cancelled'

export interface ExpenseCategory {
  id: string
  name: string
  active: boolean
  createdAt: string
}
export interface ExpenseClaim {
  id: string
  employeeId: string
  employeeName: string
  title: string
  categoryId: string | null
  categoryName: string
  description: string
  amountPaise: number
  claimDate: string
  status: ExpenseStatus
  receiptUrl: string
  approvedById: string | null
  approvedAt: string | null
  rejectReason: string
  payrollAdjustmentId: string | null
  reimbursedAt: string | null
  createdAt: string
}
export interface ExpenseSummary {
  byStatus: Record<ExpenseStatus, { count: number; amountPaise: number }>
  submittedPaise: number
  submittedCount: number
  approvedAwaitingPaise: number
  approvedAwaitingCount: number
  reimbursedThisMonthPaise: number
  reimbursedThisMonthCount: number
  pendingCount: number
}
export interface ExpenseFilters {
  status?: string
  employeeId?: string
  q?: string
  from?: string
  to?: string
}

export async function getExpenseClaims(filters: ExpenseFilters = {}): Promise<ExpenseClaim[]> {
  const qs = new URLSearchParams()
  if (filters.status) qs.set('status', filters.status)
  if (filters.employeeId) qs.set('employeeId', filters.employeeId)
  if (filters.q) qs.set('q', filters.q)
  if (filters.from) qs.set('from', filters.from)
  if (filters.to) qs.set('to', filters.to)
  const suffix = qs.toString() ? `?${qs}` : ''
  return jsonOrThrow(await fetch(`/api/expenses${suffix}`, { headers: authHeaders() }))
}
export async function getExpenseSummary(): Promise<ExpenseSummary> {
  return jsonOrThrow(await fetch('/api/expenses/summary', { headers: authHeaders() }))
}
export async function createExpenseClaim(input: {
  title: string
  amountPaise: number
  employeeId?: string | null
  categoryId?: string | null
  description?: string
  claimDate?: string
  receiptUrl?: string
}): Promise<ExpenseClaim> {
  return jsonOrThrow(
    await fetch('/api/expenses', { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }),
  )
}
export async function updateExpenseClaim(
  id: string,
  patch: {
    title?: string
    amountPaise?: number
    categoryId?: string | null
    description?: string
    claimDate?: string
    receiptUrl?: string
  },
): Promise<ExpenseClaim> {
  return jsonOrThrow(
    await fetch(`/api/expenses/${id}`, { method: 'PATCH', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(patch) }),
  )
}
export async function approveExpenseClaim(id: string): Promise<ExpenseClaim> {
  return jsonOrThrow(await fetch(`/api/expenses/${id}/approve`, { method: 'POST', headers: authHeaders() }))
}
export async function rejectExpenseClaim(id: string, rejectReason = ''): Promise<ExpenseClaim> {
  return jsonOrThrow(
    await fetch(`/api/expenses/${id}/reject`, { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify({ rejectReason }) }),
  )
}
export async function reimburseExpenseClaim(id: string): Promise<ExpenseClaim> {
  return jsonOrThrow(await fetch(`/api/expenses/${id}/reimburse`, { method: 'POST', headers: authHeaders() }))
}
export async function deleteExpenseClaim(id: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/expenses/${id}`, { method: 'DELETE', headers: authHeaders() }))
}
export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  return jsonOrThrow(await fetch('/api/expenses/categories', { headers: authHeaders() }))
}
export async function createExpenseCategory(input: { name: string; active?: boolean }): Promise<ExpenseCategory> {
  return jsonOrThrow(
    await fetch('/api/expenses/categories', { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }),
  )
}
export async function updateExpenseCategory(id: string, patch: { name?: string; active?: boolean }): Promise<ExpenseCategory> {
  return jsonOrThrow(
    await fetch(`/api/expenses/categories/${id}`, { method: 'PATCH', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(patch) }),
  )
}

// ─── Hiring (Recruitment ATS → Offboarding / Full & Final) ───
export type JobStatus = 'open' | 'on_hold' | 'closed'
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'intern'
export type CandidateSource = '' | 'referral' | 'job_board' | 'website' | 'agency' | 'other'
export type AppStage = 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected'
export type InterviewMode = 'in_person' | 'phone' | 'video'
export type InterviewResult = 'pending' | 'pass' | 'fail'
export type OfferStatus = 'draft' | 'sent' | 'accepted' | 'declined'
export type OffboardType = 'resignation' | 'termination' | 'retirement'
export type OffboardStatus = 'initiated' | 'in_progress' | 'completed'
export type FnfStatus = 'draft' | 'approved' | 'paid'

export interface Job {
  id: string
  title: string
  department: string
  location: string
  employmentType: EmploymentType
  description: string
  openings: number
  status: JobStatus
  hiringManagerId: string | null
  hiringManagerName: string
  applicantCount: number
  createdById: string
  createdAt: string
}
export interface Candidate {
  id: string
  name: string
  email: string
  phone: string
  resumeUrl: string
  source: CandidateSource
  createdAt: string
}
export interface Application {
  id: string
  jobId: string
  candidateId: string
  stage: AppStage
  rating: number
  ownerId: string | null
  ownerName: string
  notes: string
  hiredEmployeeId: string | null
  jobTitle: string
  candidateName: string
  candidateEmail: string
  appliedAt: string
  updatedAt: string
}
export interface BoardStage {
  stage: AppStage
  count: number
  applications: Application[]
}
export interface ApplicationBoard {
  stages: BoardStage[]
  total: number
}
export interface Interview {
  id: string
  applicationId: string
  scheduledAt: string
  interviewerId: string | null
  interviewerName: string
  mode: InterviewMode
  result: InterviewResult
  feedback: string
  createdAt: string
}
export interface Offer {
  id: string
  applicationId: string
  ctcPaise: number
  joiningDate: string
  status: OfferStatus
  createdAt: string
}
export interface Offboarding {
  id: string
  employeeId: string
  employeeName: string
  type: OffboardType
  reason: string
  noticeDate: string
  lastWorkingDay: string
  status: OffboardStatus
  createdById: string
  createdAt: string
}
export interface FnfSettlement {
  id: string
  offboardingId: string
  employeeId: string
  unpaidSalaryPaise: number
  leaveEncashPaise: number
  bonusIncentivePaise: number
  gratuityPaise: number
  otherEarningsPaise: number
  ptPaise: number
  tdsPaise: number
  loanRecoveryPaise: number
  noticeShortfallPaise: number
  otherDeductionsPaise: number
  netPaise: number
  status: FnfStatus
  note: string
  createdAt: string
}
export interface OffboardingDetail extends Offboarding {
  fnf: FnfSettlement | null
}
export interface FnfSuggest {
  unpaidSalaryPaise: number
  leaveEncashPaise: number
  bonusIncentivePaise: number
  gratuityPaise: number
  otherEarningsPaise: number
  ptPaise: number
  tdsPaise: number
  loanRecoveryPaise: number
  noticeShortfallPaise: number
  otherDeductionsPaise: number
  earnings: number
  deductions: number
  netPaise: number
  monthlyCtcPaise: number
  approximate: boolean
}

// Jobs
export async function getJobs(filters: { status?: string; q?: string } = {}): Promise<Job[]> {
  const qs = new URLSearchParams()
  if (filters.status) qs.set('status', filters.status)
  if (filters.q) qs.set('q', filters.q)
  const suffix = qs.toString() ? `?${qs}` : ''
  return jsonOrThrow(await fetch(`/api/hiring/jobs${suffix}`, { headers: authHeaders() }))
}
export async function getJob(id: string): Promise<Job> {
  return jsonOrThrow(await fetch(`/api/hiring/jobs/${id}`, { headers: authHeaders() }))
}
export async function createJob(input: {
  title: string
  department?: string
  location?: string
  employmentType?: EmploymentType
  description?: string
  openings?: number
  status?: JobStatus
  hiringManagerId?: string | null
}): Promise<Job> {
  return jsonOrThrow(await fetch('/api/hiring/jobs', { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }))
}
export async function updateJob(
  id: string,
  patch: {
    title?: string
    department?: string
    location?: string
    employmentType?: EmploymentType
    description?: string
    openings?: number
    status?: JobStatus
    hiringManagerId?: string | null
  },
): Promise<Job> {
  return jsonOrThrow(await fetch(`/api/hiring/jobs/${id}`, { method: 'PATCH', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(patch) }))
}
export async function deleteJob(id: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/hiring/jobs/${id}`, { method: 'DELETE', headers: authHeaders() }))
}

// Candidates
export async function getCandidates(q?: string): Promise<Candidate[]> {
  const suffix = q ? `?q=${encodeURIComponent(q)}` : ''
  return jsonOrThrow(await fetch(`/api/hiring/candidates${suffix}`, { headers: authHeaders() }))
}
export async function createCandidate(input: {
  name: string
  email?: string
  phone?: string
  resumeUrl?: string
  source?: CandidateSource
}): Promise<Candidate> {
  return jsonOrThrow(await fetch('/api/hiring/candidates', { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }))
}
export async function updateCandidate(
  id: string,
  patch: { name?: string; email?: string; phone?: string; resumeUrl?: string; source?: CandidateSource },
): Promise<Candidate> {
  return jsonOrThrow(await fetch(`/api/hiring/candidates/${id}`, { method: 'PATCH', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(patch) }))
}
export async function deleteCandidate(id: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/hiring/candidates/${id}`, { method: 'DELETE', headers: authHeaders() }))
}

// Applications (pipeline)
export async function getApplications(filters: { jobId?: string; stage?: string } = {}): Promise<Application[]> {
  const qs = new URLSearchParams()
  if (filters.jobId) qs.set('jobId', filters.jobId)
  if (filters.stage) qs.set('stage', filters.stage)
  const suffix = qs.toString() ? `?${qs}` : ''
  return jsonOrThrow(await fetch(`/api/hiring/applications${suffix}`, { headers: authHeaders() }))
}
export async function getApplicationBoard(jobId?: string): Promise<ApplicationBoard> {
  const suffix = jobId ? `?jobId=${jobId}` : ''
  return jsonOrThrow(await fetch(`/api/hiring/applications/board${suffix}`, { headers: authHeaders() }))
}
export async function createApplication(input: { jobId: string; candidateId: string; ownerId?: string | null; stage?: AppStage; rating?: number; notes?: string }): Promise<Application> {
  return jsonOrThrow(await fetch('/api/hiring/applications', { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }))
}
export async function updateApplication(
  id: string,
  patch: { stage?: AppStage; rating?: number; notes?: string; ownerId?: string | null },
): Promise<Application> {
  return jsonOrThrow(await fetch(`/api/hiring/applications/${id}`, { method: 'PATCH', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(patch) }))
}
export async function deleteApplication(id: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/hiring/applications/${id}`, { method: 'DELETE', headers: authHeaders() }))
}
export async function hireApplication(id: string): Promise<{ employeeId: string; empCode?: string; alreadyHired?: boolean }> {
  return jsonOrThrow(await fetch(`/api/hiring/applications/${id}/hire`, { method: 'POST', headers: authHeaders() }))
}

// Interviews
export async function getInterviews(applicationId: string): Promise<Interview[]> {
  return jsonOrThrow(await fetch(`/api/hiring/applications/${applicationId}/interviews`, { headers: authHeaders() }))
}
export async function createInterview(
  applicationId: string,
  input: { scheduledAt?: string; interviewerId?: string | null; mode?: InterviewMode; result?: InterviewResult; feedback?: string },
): Promise<Interview> {
  return jsonOrThrow(await fetch(`/api/hiring/applications/${applicationId}/interviews`, { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }))
}
export async function updateInterview(
  id: string,
  patch: { result?: InterviewResult; feedback?: string; scheduledAt?: string; mode?: InterviewMode; interviewerId?: string | null },
): Promise<Interview> {
  return jsonOrThrow(await fetch(`/api/hiring/interviews/${id}`, { method: 'PATCH', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(patch) }))
}
export async function deleteInterview(id: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/hiring/interviews/${id}`, { method: 'DELETE', headers: authHeaders() }))
}

// Offers
export async function getOffers(applicationId: string): Promise<Offer[]> {
  return jsonOrThrow(await fetch(`/api/hiring/applications/${applicationId}/offers`, { headers: authHeaders() }))
}
export async function createOffer(applicationId: string, input: { ctcPaise: number; joiningDate?: string; status?: OfferStatus }): Promise<Offer> {
  return jsonOrThrow(await fetch(`/api/hiring/applications/${applicationId}/offers`, { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }))
}
export async function updateOffer(id: string, patch: { status?: OfferStatus; ctcPaise?: number; joiningDate?: string }): Promise<Offer> {
  return jsonOrThrow(await fetch(`/api/hiring/offers/${id}`, { method: 'PATCH', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(patch) }))
}

// Offboarding
export async function getOffboardings(status?: string): Promise<Offboarding[]> {
  const suffix = status ? `?status=${status}` : ''
  return jsonOrThrow(await fetch(`/api/hiring/offboardings${suffix}`, { headers: authHeaders() }))
}
export async function getOffboarding(id: string): Promise<OffboardingDetail> {
  return jsonOrThrow(await fetch(`/api/hiring/offboardings/${id}`, { headers: authHeaders() }))
}
export async function createOffboarding(input: {
  employeeId: string
  type?: OffboardType
  reason?: string
  noticeDate?: string
  lastWorkingDay?: string
}): Promise<Offboarding> {
  return jsonOrThrow(await fetch('/api/hiring/offboardings', { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }))
}
export async function updateOffboarding(
  id: string,
  patch: { type?: OffboardType; reason?: string; noticeDate?: string; lastWorkingDay?: string; status?: OffboardStatus },
): Promise<Offboarding> {
  return jsonOrThrow(await fetch(`/api/hiring/offboardings/${id}`, { method: 'PATCH', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(patch) }))
}
export async function deleteOffboarding(id: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/hiring/offboardings/${id}`, { method: 'DELETE', headers: authHeaders() }))
}

// Full & Final settlement
export async function suggestFnf(offboardingId: string): Promise<FnfSuggest> {
  return jsonOrThrow(await fetch(`/api/hiring/offboardings/${offboardingId}/fnf/suggest`, { headers: authHeaders() }))
}
export interface FnfComponents {
  unpaidSalaryPaise?: number
  leaveEncashPaise?: number
  bonusIncentivePaise?: number
  gratuityPaise?: number
  otherEarningsPaise?: number
  ptPaise?: number
  tdsPaise?: number
  loanRecoveryPaise?: number
  noticeShortfallPaise?: number
  otherDeductionsPaise?: number
  note?: string
}
export async function saveFnf(offboardingId: string, input: FnfComponents): Promise<FnfSettlement> {
  return jsonOrThrow(await fetch(`/api/hiring/offboardings/${offboardingId}/fnf`, { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }))
}
export async function approveFnf(id: string): Promise<FnfSettlement> {
  return jsonOrThrow(await fetch(`/api/hiring/fnf/${id}/approve`, { method: 'POST', headers: authHeaders() }))
}
export async function markFnfPaid(id: string): Promise<FnfSettlement> {
  return jsonOrThrow(await fetch(`/api/hiring/fnf/${id}/mark-paid`, { method: 'POST', headers: authHeaders() }))
}

// ─── Documents & Letters ─────────────────────────────────────────────────────
export type LetterType = 'offer' | 'appointment' | 'relieving' | 'experience' | 'increment' | 'warning' | 'other'
export type LetterStatus = 'draft' | 'issued'

export interface DocumentCategory {
  id: string
  name: string
  active: boolean
  createdAt: string
}
export interface EmployeeDocument {
  id: string
  employeeId: string
  employeeName: string
  categoryId: string | null
  categoryName: string
  title: string
  fileUrl: string
  fileName: string
  note: string
  expiresOn: string
  uploadedById: string
  createdAt: string
}
export interface LetterTemplate {
  id: string
  name: string
  type: LetterType
  body: string
  active: boolean
  createdAt: string
  updatedAt: string
}
export interface GeneratedLetter {
  id: string
  employeeId: string
  employeeName: string
  templateId: string | null
  templateName: string
  type: LetterType
  title: string
  content: string
  status: LetterStatus
  issuedOn: string
  generatedById: string
  createdAt: string
}
export interface DocumentSummary {
  totalDocs: number
  expiringSoon: number
  lettersIssued: number
  templates: number
}

// Documents
export async function getDocuments(filters: { employeeId?: string; categoryId?: string; q?: string; expiringBefore?: string } = {}): Promise<EmployeeDocument[]> {
  const qs = new URLSearchParams()
  if (filters.employeeId) qs.set('employeeId', filters.employeeId)
  if (filters.categoryId) qs.set('categoryId', filters.categoryId)
  if (filters.q) qs.set('q', filters.q)
  if (filters.expiringBefore) qs.set('expiringBefore', filters.expiringBefore)
  const suffix = qs.toString() ? `?${qs}` : ''
  return jsonOrThrow(await fetch(`/api/documents${suffix}`, { headers: authHeaders() }))
}
export async function getDocumentSummary(): Promise<DocumentSummary> {
  return jsonOrThrow(await fetch('/api/documents/summary', { headers: authHeaders() }))
}
export async function createDocument(input: {
  employeeId: string
  title: string
  categoryId?: string | null
  fileUrl?: string
  fileName?: string
  note?: string
  expiresOn?: string
}): Promise<EmployeeDocument> {
  return jsonOrThrow(
    await fetch('/api/documents', { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }),
  )
}
export async function updateDocument(
  id: string,
  patch: { title?: string; categoryId?: string | null; fileUrl?: string; fileName?: string; note?: string; expiresOn?: string },
): Promise<EmployeeDocument> {
  return jsonOrThrow(
    await fetch(`/api/documents/${id}`, { method: 'PATCH', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(patch) }),
  )
}
export async function deleteDocument(id: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/documents/${id}`, { method: 'DELETE', headers: authHeaders() }))
}
export async function getDocumentCategories(): Promise<DocumentCategory[]> {
  return jsonOrThrow(await fetch('/api/documents/categories', { headers: authHeaders() }))
}
export async function createDocumentCategory(input: { name: string; active?: boolean }): Promise<DocumentCategory> {
  return jsonOrThrow(
    await fetch('/api/documents/categories', { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }),
  )
}
export async function updateDocumentCategory(id: string, patch: { name?: string; active?: boolean }): Promise<DocumentCategory> {
  return jsonOrThrow(
    await fetch(`/api/documents/categories/${id}`, { method: 'PATCH', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(patch) }),
  )
}

// Letter templates
export async function getLetterTemplates(filters: { type?: string } = {}): Promise<LetterTemplate[]> {
  const qs = new URLSearchParams()
  if (filters.type) qs.set('type', filters.type)
  const suffix = qs.toString() ? `?${qs}` : ''
  return jsonOrThrow(await fetch(`/api/documents/templates${suffix}`, { headers: authHeaders() }))
}
export async function createLetterTemplate(input: { name: string; type: LetterType; body?: string; active?: boolean }): Promise<LetterTemplate> {
  return jsonOrThrow(
    await fetch('/api/documents/templates', { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }),
  )
}
export async function updateLetterTemplate(
  id: string,
  patch: { name?: string; type?: LetterType; body?: string; active?: boolean },
): Promise<LetterTemplate> {
  return jsonOrThrow(
    await fetch(`/api/documents/templates/${id}`, { method: 'PATCH', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(patch) }),
  )
}
export async function deleteLetterTemplate(id: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/documents/templates/${id}`, { method: 'DELETE', headers: authHeaders() }))
}

// Generated letters
export async function getLetters(filters: { employeeId?: string; type?: string; status?: string } = {}): Promise<GeneratedLetter[]> {
  const qs = new URLSearchParams()
  if (filters.employeeId) qs.set('employeeId', filters.employeeId)
  if (filters.type) qs.set('type', filters.type)
  if (filters.status) qs.set('status', filters.status)
  const suffix = qs.toString() ? `?${qs}` : ''
  return jsonOrThrow(await fetch(`/api/documents/letters${suffix}`, { headers: authHeaders() }))
}
export async function generateLetter(input: { employeeId: string; templateId: string; overrides?: Record<string, string> }): Promise<GeneratedLetter> {
  return jsonOrThrow(
    await fetch('/api/documents/letters/generate', { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }),
  )
}
export async function issueLetter(id: string): Promise<GeneratedLetter> {
  return jsonOrThrow(await fetch(`/api/documents/letters/${id}/issue`, { method: 'POST', headers: authHeaders() }))
}
export async function deleteLetter(id: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/documents/letters/${id}`, { method: 'DELETE', headers: authHeaders() }))
}

// ─── Asset management (IT / company-property register) ────────────────────────
export type AssetCondition = 'new' | 'good' | 'fair' | 'poor' | 'damaged'
export type AssetStatus = 'available' | 'assigned' | 'in_repair' | 'retired' | 'lost'

export interface AssetCategory {
  id: string
  name: string
  active: boolean
  createdAt: string
}
export interface Asset {
  id: string
  assetCode: string
  name: string
  categoryId: string | null
  categoryName: string
  serialNo: string
  purchaseDate: string
  purchaseCostPaise: number
  condition: AssetCondition
  status: AssetStatus
  currentAssigneeId: string | null
  currentAssigneeName: string
  note: string
  createdAt: string
  updatedAt: string
}
export interface AssetAssignment {
  id: string
  assetId: string
  employeeId: string
  employeeName: string
  assignedById: string
  assignedOn: string
  returnedOn: string
  returnCondition: string
  note: string
  createdAt: string
}
export interface AssetSummary {
  total: number
  available: number
  assigned: number
  inRepair: number
  retired: number
  lost: number
  totalCostPaise: number
}
export interface AssetFilters {
  status?: string
  categoryId?: string
  assigneeId?: string
  q?: string
}

export async function getAssets(filters: AssetFilters = {}): Promise<Asset[]> {
  const qs = new URLSearchParams()
  if (filters.status) qs.set('status', filters.status)
  if (filters.categoryId) qs.set('categoryId', filters.categoryId)
  if (filters.assigneeId) qs.set('assigneeId', filters.assigneeId)
  if (filters.q) qs.set('q', filters.q)
  const suffix = qs.toString() ? `?${qs}` : ''
  return jsonOrThrow(await fetch(`/api/assets${suffix}`, { headers: authHeaders() }))
}
export async function getAssetSummary(): Promise<AssetSummary> {
  return jsonOrThrow(await fetch('/api/assets/summary', { headers: authHeaders() }))
}
export async function createAsset(input: {
  name: string
  assetCode?: string
  categoryId?: string | null
  serialNo?: string
  purchaseDate?: string
  purchaseCostPaise?: number
  condition?: AssetCondition
  note?: string
}): Promise<Asset> {
  return jsonOrThrow(
    await fetch('/api/assets', { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }),
  )
}
export async function updateAsset(
  id: string,
  patch: {
    name?: string
    categoryId?: string | null
    serialNo?: string
    purchaseDate?: string
    purchaseCostPaise?: number
    condition?: AssetCondition
    note?: string
  },
): Promise<Asset> {
  return jsonOrThrow(
    await fetch(`/api/assets/${id}`, { method: 'PATCH', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(patch) }),
  )
}
export async function deleteAsset(id: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/assets/${id}`, { method: 'DELETE', headers: authHeaders() }))
}
export async function assignAsset(id: string, input: { employeeId: string; assignedOn?: string; note?: string }): Promise<Asset> {
  return jsonOrThrow(
    await fetch(`/api/assets/${id}/assign`, { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }),
  )
}
export async function returnAsset(id: string, input: { returnedOn?: string; returnCondition?: string; note?: string } = {}): Promise<Asset> {
  return jsonOrThrow(
    await fetch(`/api/assets/${id}/return`, { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }),
  )
}
export async function setAssetStatus(id: string, status: AssetStatus): Promise<Asset> {
  return jsonOrThrow(
    await fetch(`/api/assets/${id}/status`, { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify({ status }) }),
  )
}
export async function getAssetHistory(id: string): Promise<AssetAssignment[]> {
  return jsonOrThrow(await fetch(`/api/assets/${id}/history`, { headers: authHeaders() }))
}
export async function getAssetCategories(): Promise<AssetCategory[]> {
  return jsonOrThrow(await fetch('/api/assets/categories', { headers: authHeaders() }))
}
export async function createAssetCategory(input: { name: string; active?: boolean }): Promise<AssetCategory> {
  return jsonOrThrow(
    await fetch('/api/assets/categories', { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }),
  )
}
export async function updateAssetCategory(id: string, patch: { name?: string; active?: boolean }): Promise<AssetCategory> {
  return jsonOrThrow(
    await fetch(`/api/assets/categories/${id}`, { method: 'PATCH', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(patch) }),
  )
}

// ─── Helpdesk / Tickets (internal HR/IT employee helpdesk) ────────────────────
export type HelpdeskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type HelpdeskStatus = 'open' | 'in_progress' | 'on_hold' | 'resolved' | 'closed'

export interface HelpdeskCategory {
  id: string
  name: string
  active: boolean
  defaultPriority: HelpdeskPriority
  slaHours: number
  createdAt: string
}
export interface HelpdeskTicket {
  id: string
  ticketNo: string
  subject: string
  description: string
  categoryId: string | null
  categoryName: string
  priority: HelpdeskPriority
  status: HelpdeskStatus
  requesterId: string
  requesterName: string
  assigneeId: string | null
  assigneeName: string
  dueAt: string
  resolvedAt: string | null
  closedAt: string | null
  createdById: string
  createdAt: string
  updatedAt: string
}
export interface HelpdeskComment {
  id: string
  authorId: string
  authorName: string
  body: string
  internal: boolean
  createdAt: string
}
export interface HelpdeskTicketDetail extends HelpdeskTicket {
  comments: HelpdeskComment[]
}
export interface HelpdeskSummary {
  open: number
  in_progress: number
  resolved: number
  overdue: number
  unassigned: number
}
export interface HelpdeskFilters {
  status?: string
  priority?: string
  categoryId?: string
  assigneeId?: string
  requesterId?: string
  mine?: boolean
  q?: string
}

export async function getTickets(filters: HelpdeskFilters = {}): Promise<HelpdeskTicket[]> {
  const qs = new URLSearchParams()
  if (filters.status) qs.set('status', filters.status)
  if (filters.priority) qs.set('priority', filters.priority)
  if (filters.categoryId) qs.set('categoryId', filters.categoryId)
  if (filters.assigneeId) qs.set('assigneeId', filters.assigneeId)
  if (filters.requesterId) qs.set('requesterId', filters.requesterId)
  if (filters.mine) qs.set('mine', '1')
  if (filters.q) qs.set('q', filters.q)
  const suffix = qs.toString() ? `?${qs}` : ''
  return jsonOrThrow(await fetch(`/api/helpdesk${suffix}`, { headers: authHeaders() }))
}
export async function getTicketSummary(): Promise<HelpdeskSummary> {
  return jsonOrThrow(await fetch('/api/helpdesk/summary', { headers: authHeaders() }))
}
export async function getTicket(id: string): Promise<HelpdeskTicketDetail> {
  return jsonOrThrow(await fetch(`/api/helpdesk/${id}`, { headers: authHeaders() }))
}
export async function createTicket(input: {
  subject: string
  description?: string
  categoryId?: string | null
  priority?: HelpdeskPriority
  requesterId?: string
}): Promise<HelpdeskTicket> {
  return jsonOrThrow(
    await fetch('/api/helpdesk', { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }),
  )
}
export async function updateTicket(
  id: string,
  patch: {
    subject?: string
    description?: string
    categoryId?: string | null
    priority?: HelpdeskPriority
    assigneeId?: string | null
    status?: HelpdeskStatus
  },
): Promise<HelpdeskTicket> {
  return jsonOrThrow(
    await fetch(`/api/helpdesk/${id}`, { method: 'PATCH', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(patch) }),
  )
}
export async function setTicketStatus(id: string, status: HelpdeskStatus): Promise<HelpdeskTicket> {
  return jsonOrThrow(
    await fetch(`/api/helpdesk/${id}/status`, { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify({ status }) }),
  )
}
export async function addTicketComment(id: string, input: { body: string; internal?: boolean }): Promise<HelpdeskComment> {
  return jsonOrThrow(
    await fetch(`/api/helpdesk/${id}/comments`, { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }),
  )
}
export async function deleteTicket(id: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/helpdesk/${id}`, { method: 'DELETE', headers: authHeaders() }))
}
export async function getHelpdeskCategories(): Promise<HelpdeskCategory[]> {
  return jsonOrThrow(await fetch('/api/helpdesk/categories', { headers: authHeaders() }))
}
export async function createHelpdeskCategory(input: {
  name: string
  active?: boolean
  defaultPriority?: HelpdeskPriority
  slaHours?: number
}): Promise<HelpdeskCategory> {
  return jsonOrThrow(
    await fetch('/api/helpdesk/categories', { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }),
  )
}
export async function updateHelpdeskCategory(
  id: string,
  patch: { name?: string; active?: boolean; defaultPriority?: HelpdeskPriority; slaHours?: number },
): Promise<HelpdeskCategory> {
  return jsonOrThrow(
    await fetch(`/api/helpdesk/categories/${id}`, { method: 'PATCH', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(patch) }),
  )
}

// ─── Performance: OKRs/goals, review cycles, continuous feedback ───────────────
export type ObjectiveStatus = 'draft' | 'active' | 'completed' | 'cancelled'
export type KrMetricType = 'percent' | 'number' | 'currency' | 'boolean'
export type KrStatus = 'on_track' | 'at_risk' | 'off_track' | 'done'
export type CycleType = 'annual' | 'quarterly' | 'monthly' | 'probation'
export type CycleStatus = 'draft' | 'active' | 'closed'
export type ReviewType = 'self' | 'manager' | 'peer'
export type ReviewStatus = 'pending' | 'submitted' | 'acknowledged'
export type FeedbackKind = 'praise' | 'constructive' | 'general'
export type FeedbackVisibility = 'private' | 'manager' | 'public'

export interface Objective {
  id: string
  ownerId: string
  ownerName: string
  title: string
  description: string
  period: string
  status: ObjectiveStatus
  progress: number
  createdById: string
  createdAt: string
  updatedAt: string
  keyResultCount?: number
}
export interface KeyResult {
  id: string
  objectiveId: string
  title: string
  metricType: KrMetricType
  startValue: number
  targetValue: number
  currentValue: number
  progress: number
  status: KrStatus
  createdAt: string
}
export interface ObjectiveDetail extends Objective {
  keyResults: KeyResult[]
}
export interface ReviewCycle {
  id: string
  name: string
  period: string
  type: CycleType
  startDate: string
  endDate: string
  status: CycleStatus
  createdById: string
  createdAt: string
  reviewCount?: number
}
export interface Review {
  id: string
  cycleId: string
  cycleName: string
  employeeId: string
  employeeName: string
  reviewerId: string
  reviewerName: string
  type: ReviewType
  status: ReviewStatus
  overallRating: number | null
  strengths: string
  improvements: string
  comments: string
  submittedAt: string | null
  acknowledgedAt: string | null
  createdAt: string
}
export interface Feedback {
  id: string
  fromEmployeeId: string
  fromName: string
  toEmployeeId: string
  toName: string
  kind: FeedbackKind
  body: string
  visibility: FeedbackVisibility
  createdAt: string
}
export interface PerformanceSummary {
  activeObjectives: number
  avgObjectiveProgress: number
  pendingReviews: number
  feedbackThisMonth: number
}

// objectives
export async function getObjectives(filters: { ownerId?: string; status?: string; period?: string; mine?: boolean } = {}): Promise<Objective[]> {
  const qs = new URLSearchParams()
  if (filters.ownerId) qs.set('ownerId', filters.ownerId)
  if (filters.status) qs.set('status', filters.status)
  if (filters.period) qs.set('period', filters.period)
  if (filters.mine) qs.set('mine', '1')
  const suffix = qs.toString() ? `?${qs}` : ''
  return jsonOrThrow(await fetch(`/api/performance/objectives${suffix}`, { headers: authHeaders() }))
}
export async function getObjective(id: string): Promise<ObjectiveDetail> {
  return jsonOrThrow(await fetch(`/api/performance/objectives/${id}`, { headers: authHeaders() }))
}
export async function createObjective(input: {
  title: string
  description?: string
  period?: string
  status?: ObjectiveStatus
  ownerId?: string
}): Promise<Objective> {
  return jsonOrThrow(
    await fetch('/api/performance/objectives', { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }),
  )
}
export async function updateObjective(
  id: string,
  patch: { title?: string; description?: string; period?: string; status?: ObjectiveStatus; ownerId?: string },
): Promise<Objective> {
  return jsonOrThrow(
    await fetch(`/api/performance/objectives/${id}`, { method: 'PATCH', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(patch) }),
  )
}
export async function deleteObjective(id: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/performance/objectives/${id}`, { method: 'DELETE', headers: authHeaders() }))
}
export async function addKeyResult(
  objectiveId: string,
  input: { title: string; metricType?: KrMetricType; startValue?: number; targetValue?: number; currentValue?: number; status?: KrStatus },
): Promise<KeyResult> {
  return jsonOrThrow(
    await fetch(`/api/performance/objectives/${objectiveId}/key-results`, { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }),
  )
}
export async function updateKeyResult(
  id: string,
  patch: { title?: string; metricType?: KrMetricType; startValue?: number; targetValue?: number; currentValue?: number; progress?: number; status?: KrStatus },
): Promise<KeyResult & { objectiveProgress: number }> {
  return jsonOrThrow(
    await fetch(`/api/performance/key-results/${id}`, { method: 'PATCH', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(patch) }),
  )
}
export async function deleteKeyResult(id: string): Promise<{ ok: boolean; objectiveProgress: number }> {
  return jsonOrThrow(await fetch(`/api/performance/key-results/${id}`, { method: 'DELETE', headers: authHeaders() }))
}

// cycles
export async function getCycles(): Promise<ReviewCycle[]> {
  return jsonOrThrow(await fetch('/api/performance/cycles', { headers: authHeaders() }))
}
export async function createCycle(input: {
  name: string
  period?: string
  type?: CycleType
  startDate?: string
  endDate?: string
}): Promise<ReviewCycle> {
  return jsonOrThrow(
    await fetch('/api/performance/cycles', { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }),
  )
}
export async function updateCycle(
  id: string,
  patch: { name?: string; period?: string; type?: CycleType; startDate?: string; endDate?: string; status?: CycleStatus },
): Promise<ReviewCycle> {
  return jsonOrThrow(
    await fetch(`/api/performance/cycles/${id}`, { method: 'PATCH', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(patch) }),
  )
}
export async function deleteCycle(id: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/performance/cycles/${id}`, { method: 'DELETE', headers: authHeaders() }))
}
export async function launchCycle(
  id: string,
  input: { employeeIds?: string[]; includeSelf?: boolean; includeManager?: boolean } = {},
): Promise<ReviewCycle & { created: number; reviewCount: number }> {
  return jsonOrThrow(
    await fetch(`/api/performance/cycles/${id}/launch`, { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }),
  )
}

// reviews
export async function getReviews(filters: { cycleId?: string; employeeId?: string; reviewerId?: string; status?: string; mine?: boolean; about?: boolean } = {}): Promise<Review[]> {
  const qs = new URLSearchParams()
  if (filters.cycleId) qs.set('cycleId', filters.cycleId)
  if (filters.employeeId) qs.set('employeeId', filters.employeeId)
  if (filters.reviewerId) qs.set('reviewerId', filters.reviewerId)
  if (filters.status) qs.set('status', filters.status)
  if (filters.mine) qs.set('mine', '1')
  if (filters.about) qs.set('about', '1')
  const suffix = qs.toString() ? `?${qs}` : ''
  return jsonOrThrow(await fetch(`/api/performance/reviews${suffix}`, { headers: authHeaders() }))
}
export async function getReview(id: string): Promise<Review> {
  return jsonOrThrow(await fetch(`/api/performance/reviews/${id}`, { headers: authHeaders() }))
}
export async function updateReview(
  id: string,
  patch: { overallRating?: number | null; strengths?: string; improvements?: string; comments?: string },
): Promise<Review> {
  return jsonOrThrow(
    await fetch(`/api/performance/reviews/${id}`, { method: 'PATCH', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(patch) }),
  )
}
export async function submitReview(
  id: string,
  input: { overallRating: number; strengths?: string; improvements?: string; comments?: string },
): Promise<Review> {
  return jsonOrThrow(
    await fetch(`/api/performance/reviews/${id}/submit`, { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }),
  )
}
export async function acknowledgeReview(id: string): Promise<Review> {
  return jsonOrThrow(
    await fetch(`/api/performance/reviews/${id}/acknowledge`, { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() } }),
  )
}

// feedback
export async function getFeedback(filters: { toEmployeeId?: string; fromEmployeeId?: string; mine?: boolean } = {}): Promise<Feedback[]> {
  const qs = new URLSearchParams()
  if (filters.toEmployeeId) qs.set('toEmployeeId', filters.toEmployeeId)
  if (filters.fromEmployeeId) qs.set('fromEmployeeId', filters.fromEmployeeId)
  if (filters.mine) qs.set('mine', '1')
  const suffix = qs.toString() ? `?${qs}` : ''
  return jsonOrThrow(await fetch(`/api/performance/feedback${suffix}`, { headers: authHeaders() }))
}
export async function createFeedback(input: {
  toEmployeeId: string
  body: string
  kind?: FeedbackKind
  visibility?: FeedbackVisibility
}): Promise<Feedback> {
  return jsonOrThrow(
    await fetch('/api/performance/feedback', { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(input) }),
  )
}
export async function deleteFeedback(id: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/performance/feedback/${id}`, { method: 'DELETE', headers: authHeaders() }))
}

export async function getPerformanceSummary(): Promise<PerformanceSummary> {
  return jsonOrThrow(await fetch('/api/performance/summary', { headers: authHeaders() }))
}

// ─── Employee self-service portal ─────────────────────────────────────────────
// Member-facing API. Reads come from /api/portal/* (self-scoped server-side from
// the caller's identity — never a client employeeId). Self-service writes REUSE
// existing endpoints: the punch/leave/payslip flows hit /api/mobile/* (already
// self-scoped), while file-expense (createExpenseClaim), raise-ticket
// (createTicket / addTicketComment), give-feedback (createFeedback), own-objective
// (createObjective / addKeyResult / updateKeyResult) and review submit/acknowledge
// (submitReview / acknowledgeReview) all default the actor to the caller.

// --- mobile self endpoints (attendance, leave, payslips) ---
export interface MobileMe {
  id: string
  name: string
  empCode: string
  department: string
  role: string
  gender: string
  shift: { name: string; startTime: string; endTime: string } | null
  today: { date: string; status: string | null; checkIn?: string | null; checkOut?: string | null; workedMin?: number; punchedIn: boolean }
  leaveBalances: { type: string; available: number; allocated: number; used: number }[]
}
export interface MobileAttendanceRow {
  date: string
  status: string
  checkIn: string | null
  checkOut: string | null
  workedMin: number
  late: boolean
  earlyOut: boolean
}
export interface PunchResult { action: 'in' | 'out'; at: string; workedMin: number; punchedIn: boolean }
export interface MyLeaveBalance { leaveTypeId: string; type: string; code: string; allocated: number; used: number; available: number }
export interface MyLeaveRequest {
  id: string
  employeeId: string
  leaveTypeId: string
  type: string
  typeName: string
  fromDate: string
  toDate: string
  days: number
  halfDay: boolean
  status: string
  reason: string
  createdAt: string
}
export interface MyPayslip { id: string; period: string; gross: number; deductions: number; net: number; pdfUrl: string | null }
export interface MyPayslipDetail extends MyPayslip {
  empName: string
  designation: string
  paidDays: number
  lopDays: number
  totalDays: number
  employerContrib: number
  lines: { componentCode: string; name: string; type: string; amount: number; sortOrder: number }[]
}

export async function getMobileMe(): Promise<MobileMe> {
  return jsonOrThrow(await fetch('/api/mobile/me', { headers: authHeaders() }))
}
export async function punchAttendance(body: { lat?: number; lng?: number; selfieUrl?: string } = {}): Promise<PunchResult> {
  return jsonOrThrow(
    await fetch('/api/mobile/attendance/punch', { method: 'POST', headers: { ...JSON_HEADERS, ...authHeaders() }, body: JSON.stringify(body) }),
  )
}
export async function getMyAttendance(month?: string): Promise<MobileAttendanceRow[]> {
  const suffix = month ? `?month=${month}` : ''
  return jsonOrThrow(await fetch(`/api/mobile/attendance${suffix}`, { headers: authHeaders() }))
}
export async function getMyLeaveBalances(): Promise<MyLeaveBalance[]> {
  return jsonOrThrow(await fetch('/api/mobile/leave/balances', { headers: authHeaders() }))
}
export async function getMyLeaveRequests(): Promise<MyLeaveRequest[]> {
  return jsonOrThrow(await fetch('/api/mobile/leave/requests', { headers: authHeaders() }))
}
export async function applyMyLeave(
  input: { leaveTypeId: string; fromDate: string; toDate?: string; halfDay?: boolean; reason?: string },
  idempotencyKey?: string,
): Promise<MyLeaveRequest> {
  return jsonOrThrow(
    await fetch('/api/mobile/leave/requests', {
      method: 'POST',
      headers: { ...JSON_HEADERS, ...authHeaders(), ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
      body: JSON.stringify(input),
    }),
  )
}
export async function cancelMyLeave(id: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/mobile/leave/requests/${id}/cancel`, { method: 'POST', headers: authHeaders() }))
}
export async function getMyPayslips(): Promise<MyPayslip[]> {
  return jsonOrThrow(await fetch('/api/mobile/payslips', { headers: authHeaders() }))
}
export async function getMyPayslip(id: string): Promise<MyPayslipDetail> {
  return jsonOrThrow(await fetch(`/api/mobile/payslips/${id}`, { headers: authHeaders() }))
}

// --- portal aggregate reads ---
export interface PortalSummary {
  employee: { id: string; name: string } | null
  leaveBalanceTotal: number
  pendingLeaves: number
  presentDays: number
  latestPayslipNet: number | null
  latestPayslipPeriod: string | null
  openTickets: number
  pendingReviews: number
  activeObjectives: number
  assignedAssets: number
}
export interface MyAssetsPayload {
  assigned: Asset[]
  history: (AssetAssignment & { assetName: string; assetCode: string })[]
}
export interface MyDocumentsPayload {
  documents: EmployeeDocument[]
  letters: GeneratedLetter[]
}
export interface MyTicketsPayload {
  raised: HelpdeskTicket[]
  assigned: HelpdeskTicket[]
}
export interface MyPerformancePayload {
  objectives: (Objective & { keyResults: KeyResult[] })[]
  reviewsToFill: Review[]
  reviewsAboutMe: Review[]
  feedback: Feedback[]
}

export async function getPortalSummary(): Promise<PortalSummary> {
  return jsonOrThrow(await fetch('/api/portal/summary', { headers: authHeaders() }))
}
export async function getMyExpenses(): Promise<ExpenseClaim[]> {
  return jsonOrThrow(await fetch('/api/portal/expenses', { headers: authHeaders() }))
}
export async function getMyDocuments(): Promise<MyDocumentsPayload> {
  return jsonOrThrow(await fetch('/api/portal/documents', { headers: authHeaders() }))
}
export async function getMyAssets(): Promise<MyAssetsPayload> {
  return jsonOrThrow(await fetch('/api/portal/assets', { headers: authHeaders() }))
}
export async function getMyTickets(): Promise<MyTicketsPayload> {
  return jsonOrThrow(await fetch('/api/portal/tickets', { headers: authHeaders() }))
}
export async function getMyPerformance(): Promise<MyPerformancePayload> {
  return jsonOrThrow(await fetch('/api/portal/performance', { headers: authHeaders() }))
}
