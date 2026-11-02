import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Search,
  Sparkles,
  ArrowRight,
  X,
  FileText,
  FileSpreadsheet,
} from 'lucide-react'
import Panel from '@/components/admin/Panel'
import { useShell } from '@/components/admin/shell-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/auth/AuthContext'
import axios from 'axios'
import rdk, { readItems, customEndpoint, ATTENDANCE_SERVER_URL } from '@/services/server'

// Reports config & components
import { REPORTS_CONFIG, REPORT_CATEGORIES } from './reports/config/reportsConfig'
import { ReportCard } from './reports/components/ReportCard'
import { ReportConfigModal } from './reports/components/ReportConfigModal'
import { ReportBulkZipProgress } from './reports/components/ReportBulkZipProgress'
import type {
  ReportItemConfig,
  ReportFormat,
  DateSelectionMode,
  EmployeeCategoryItem,
  ReportEmployeeItem,
} from './reports/types'

// Export Engines
import { exportEmployeeMasterSheet } from '@/lib/reports/hr/exportEmployeeMasterSheet'
import { exportVisitsToExcel } from '@/lib/reports/field/exportVisitsToExcel'
import { exportOdometerToExcel } from '@/lib/reports/field/exportOdometerToExcel'
import { exportTaskReportToExcel } from '@/lib/exportTaskReportToExcel'
import { exportExpensesToExcel } from '@/lib/reports/finance/exportExpensesToExcel'
import { exportIncentivesToExcel } from '@/lib/reports/finance/exportIncentivesToExcel'
import { exportAdvancePaymentsToExcel } from '@/lib/reports/finance/exportAdvancePaymentsToExcel'
import { exportPayslipsZip } from '@/lib/reports/finance/exportPayslipsZip'

// V1 Attendance Reports
import {
  downloadOverAllReport,
  downloadOverAllReportWithDateRange,
  downloadHoursReportExcel,
  downloadHoursReportExcelByDateRange,
  downloadOvertimeReportExcel,
  downloadOvertimeReportExcelByDateRange,
  downloadDaywiseAttendanceExcel,
  downloadDaywiseAttendanceExcelByMonth,
  downloadDaywiseAttendanceExcelByDateRange,
  downloadDaywiseAttendanceExcelPunchInOut,
  downloadDaywiseAttendanceExcelPunchInOutByMonth,
  downloadDaywiseAttendanceExcelPunchInOutByDateRange,
  downloadAttendanceTracker,
  downloadAttendanceTrackerWithDateRange,
  downloadAttendanceTrackerPDF,
  downloadAttendanceTrackerPDFWithDateRange,
  downloadDaywiseAttendancePDF,
  downloadDaywiseAttendancePDFByMonth,
  downloadDaywiseAttendancePDFByDateRange,
  downloadDaywiseAttendancePDFPunchInOut,
  downloadDaywiseAttendancePDFPunchInOutByMonth,
  downloadDaywiseAttendancePDFPunchInOutByDateRange,
  downloadEmployeewiseAttedanceReport,
} from '@/lib/reports/attendance'
import JSZip from 'jszip'
import toast from 'react-hot-toast'

export default function Reports() {
  const navigate = useNavigate()
  const { firstTabActive } = useShell()
  const { user } = useAuth()
  const firmName = user?.firm_name || 'MyHisaab'

  // Filter & Search states
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Modal states
  const [activeConfigReport, setActiveConfigReport] = useState<ReportItemConfig | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  // Bulk ZIP progress state
  const [zipModalOpen, setZipModalOpen] = useState(false)
  const [zipProgress, setZipProgress] = useState(0)
  const [zipCurrentEmployee, setZipCurrentEmployee] = useState('')
  const [zipTitle, setZipTitle] = useState('')

  // Category counts
  const categoryCounts = useMemo(() => {
    return {
      all: REPORTS_CONFIG.length,
      attendance: REPORTS_CONFIG.filter((r) => r.category === 'attendance').length,
      field: REPORTS_CONFIG.filter((r) => r.category === 'field').length,
      finance: REPORTS_CONFIG.filter((r) => r.category === 'finance').length,
      hr: REPORTS_CONFIG.filter((r) => r.category === 'hr').length,
    }
  }, [])

  // 1. Fetch Users (Employees)
  const { data: employees = [], isLoading: employeesLoading } = useQuery<ReportEmployeeItem[]>({
    queryKey: ['report-users-list'],
    queryFn: async () => {
      try {
        const res: any = await rdk.request(
          customEndpoint({
            path: 'users',
            method: 'GET',
            params: {
              limit: -1,
              filter: {
                status: { _neq: 'suspended' },
              },
              fields: [
                '*',
                'shift_id.shift_shift_id.*',
                'weekly_shifts.shift_id.*',
                'shift_ids.shift_shift_id.*',
                'other_category_ids.*',
                'supervisor_id.*',
                'employee_category_id.*',
              ],
            },
          }),
        )
        const rawList = Array.isArray(res) ? res : res?.data || []
        return rawList.filter((emp: any) => {
          const st = (emp.status || '').toLowerCase()
          return st !== 'suspended'
        })
      } catch (err) {
        console.error('Failed to fetch employees for reports:', err)
        return []
      }
    },
    staleTime: 60_000,
  })

  // Active employees for modal selectors (excludes archived and suspended)
  const activeEmployees = useMemo(() => {
    return employees.filter((emp: any) => {
      const st = (emp.status || '').toLowerCase()
      return st !== 'archived' && st !== 'suspended'
    })
  }, [employees])

  // 2. Fetch Employee Categories
  const { data: categories = [], isLoading: categoriesLoading } = useQuery<EmployeeCategoryItem[]>({
    queryKey: ['report-employee-categories'],
    queryFn: async () => {
      try {
        const res: any = await rdk.request(
          readItems('employee_category' as any, {
            limit: -1,
            fields: ['employee_category_id', 'employee_category_name'],
          }),
        )
        return Array.isArray(res) ? res : res?.data || []
      } catch (err) {
        console.error('Failed to fetch categories for reports:', err)
        return []
      }
    },
    staleTime: 60_000,
  })

  // 3. Fetch Shifts
  const { data: allShifts = [] } = useQuery({
    queryKey: ['report-all-shifts'],
    queryFn: async () => {
      try {
        const res: any = await rdk.request(
          readItems('shift' as any, {
            fields: ['shift_id', 'shift_name', 'shift_from', 'shift_to'],
          }),
        )
        return Array.isArray(res) ? res : res?.data || []
      } catch (err) {
        console.error('Failed to fetch shifts:', err)
        return []
      }
    },
    staleTime: 300_000,
  })

  // Helper for single date attendance data (fetch paginated chunks)
  const fetchSingleDateEmployeeData = async (fId: string, dStr: string) => {
    let page = 1
    const limit = 100
    let allEmployees: any[] = []
    let allAbsentees: any[] = []

    let dd = ''
    let mm = ''
    let yyyy = ''
    if (dStr.includes('-')) {
      const parts = dStr.split('-')
      if (parts[0].length === 4) {
        yyyy = parts[0]
        mm = parts[1].padStart(2, '0')
        dd = parts[2].padStart(2, '0')
      } else {
        dd = parts[0].padStart(2, '0')
        mm = parts[1].padStart(2, '0')
        yyyy = parts[2]
      }
    } else {
      const dObj = new Date(dStr)
      dd = String(dObj.getDate()).padStart(2, '0')
      mm = String(dObj.getMonth() + 1).padStart(2, '0')
      yyyy = String(dObj.getFullYear())
    }
    const apiDate = `${dd}-${mm}-${yyyy}`

    try {
      while (true) {
        let data: any = null
        try {
          const res: any = await rdk.request(
            customEndpoint({
              path: 'api/fast/staff_attendance_with_time_and_presence_new',
              method: 'POST',
              body: JSON.stringify({
                firm_id: fId,
                date: apiDate,
                limit,
                page,
                fields: ['.*', 'shift_id.*'],
              }),
            }),
          )
          data = res?.data || res || {}
        } catch (rdkErr) {
          if (ATTENDANCE_SERVER_URL) {
            const axiosRes = await axios.post(
              `${ATTENDANCE_SERVER_URL}/api/fast/staff_attendance_with_time_and_presence_new`,
              {
                firm_id: fId,
                date: apiDate,
                limit,
                page,
                fields: ['.*', 'shift_id.*'],
              },
            )
            data = axiosRes?.data || {}
          }
        }

        const emps = data?.employees || []
        const abs = data?.absentees || []
        allEmployees = [...allEmployees, ...emps]
        allAbsentees = [...allAbsentees, ...abs]

        if (emps.length === limit || abs.length === limit) {
          page++
        } else {
          break
        }
      }
    } catch (err) {
      console.warn('fetchSingleDateEmployeeData warning:', err)
    }

    if (allEmployees.length === 0 && employees.length > 0) {
      allEmployees = employees
    }

    return { employees: allEmployees, absentees: allAbsentees }
  }

  // Filter reports by tab & search query
  const filteredReports = useMemo(() => {
    let list = REPORTS_CONFIG

    if (selectedCategoryTab !== 'all') {
      list = list.filter((r) => r.category === selectedCategoryTab)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(
        (r) =>
          r.label.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q),
      )
    }

    return list
  }, [selectedCategoryTab, searchQuery])

  // Handle clicking a report card
  const handleSelectReport = async (report: ReportItemConfig) => {
    if (report.instantDownload && report.key === 'employeeMasterSheet') {
      await exportEmployeeMasterSheet(firmName, employees)
      return
    }
    setActiveConfigReport(report)
  }

  // Handle Report Generation
  const handleGenerateReport = async (params: {
    reportKey: string
    format: ReportFormat
    dateMode: DateSelectionMode
    singleDate: string
    month: string
    year: string
    startDate: string
    endDate: string
    selectedCategoryIds: string[]
    selectedEmployeeIds: string[]
  }) => {
    setIsGenerating(true)

    try {
      const {
        reportKey,
        format,
        dateMode,
        singleDate,
        month,
        year,
        startDate,
        endDate,
        selectedEmployeeIds,
      } = params

      const rawFirm = (user as any)?.firm_id
      const firmId = typeof rawFirm === 'object' ? (rawFirm?.firm_id || '') : (rawFirm || '')
      const activeFirmName = (typeof rawFirm === 'object' ? rawFirm?.firm_name : null) || user?.firm_name || firmName || 'MyHisaab'
      const firmPaidLogo = (typeof rawFirm === 'object' ? rawFirm?.firm_paid_logo : null) || (user as any)?.firm_paid_logo || ''

      const firmDetails = {
        firm_id: firmId,
        firm_name: activeFirmName,
        firm_paid_logo: firmPaidLogo,
      }

      const userObj = {
        ...user,
        firm_id: firmDetails,
      }

      // ── Attendance Reports ──
      if (reportKey === 'attendanceDaily') {
        if (format === 'pdf') {
          const toastId = toast.loading('Generating Daywise Attendance PDF...')
          try {
            let url: any = null
            if (dateMode === 'singleDate') {
              const data = await fetchSingleDateEmployeeData(firmId, singleDate)
              url = await downloadDaywiseAttendancePDF(
                data.employees,
                data.absentees,
                activeFirmName,
                singleDate,
                selectedEmployeeIds,
                allShifts,
                employees,
                firmPaidLogo,
              )
            } else if (dateMode === 'fixed') {
              url = await downloadDaywiseAttendancePDFByMonth(
                firmDetails,
                month,
                year,
                selectedEmployeeIds,
                allShifts,
                employees,
                firmPaidLogo,
              )
            } else if (dateMode === 'range') {
              url = await downloadDaywiseAttendancePDFByDateRange(
                firmDetails,
                { start: startDate, end: endDate },
                selectedEmployeeIds,
                allShifts,
                employees,
                firmPaidLogo,
              )
            }

            if (url) {
              toast.success('Report Generated Successfully', { id: toastId })
              setActiveConfigReport(null)
              navigate('/admin/report-viewer', {
                state: { blobUrl: url, title: 'Daywise Attendance Report' },
              })
            } else {
              toast.error('Failed to generate report', { id: toastId })
            }
          } catch (err) {
            console.error(err)
            toast.error('Failed to generate report', { id: toastId })
          }
        } else {
          // Excel
          const toastId = toast.loading('Generating Daywise Attendance Excel...')
          try {
            let response: any = null
            if (dateMode === 'singleDate') {
              const data = await fetchSingleDateEmployeeData(firmId, singleDate)
              response = await downloadDaywiseAttendanceExcel(
                data.employees,
                data.absentees,
                activeFirmName,
                singleDate,
                selectedEmployeeIds,
                allShifts,
                employees,
                'noncustomized',
                null,
                null,
              )
            } else if (dateMode === 'fixed') {
              response = await downloadDaywiseAttendanceExcelByMonth(
                firmDetails,
                month,
                year,
                selectedEmployeeIds,
                allShifts,
                employees,
              )
            } else if (dateMode === 'range') {
              response = await downloadDaywiseAttendanceExcelByDateRange(
                firmDetails,
                { start: startDate, end: endDate },
                selectedEmployeeIds,
                allShifts,
                employees,
              )
            }

            if (response === null || response === false) {
              toast.error('Failed to generate report', { id: toastId })
            } else {
              toast.success('Download Completed!', { id: toastId })
            }
            setActiveConfigReport(null)
          } catch (err) {
            console.error(err)
            toast.error('Failed to generate report', { id: toastId })
          }
        }
      } else if (reportKey === 'attendanceDailyPunchInOut') {
        if (format === 'pdf') {
          const toastId = toast.loading('Generating Daywise Attendance (Punch In/Out) PDF...')
          try {
            let url: any = null
            if (dateMode === 'singleDate') {
              const data = await fetchSingleDateEmployeeData(firmId, singleDate)
              url = await downloadDaywiseAttendancePDFPunchInOut(
                data.employees?.length > 0 ? data.employees : employees,
                data.absentees,
                activeFirmName,
                singleDate,
                selectedEmployeeIds,
                firmPaidLogo,
                employees,
              )
            } else if (dateMode === 'fixed') {
              url = await downloadDaywiseAttendancePDFPunchInOutByMonth(
                firmDetails,
                month,
                year,
                selectedEmployeeIds,
                firmPaidLogo,
              )
            } else if (dateMode === 'range') {
              url = await downloadDaywiseAttendancePDFPunchInOutByDateRange(
                firmDetails,
                { start: startDate, end: endDate },
                selectedEmployeeIds,
                firmPaidLogo,
              )
            }

            if (url) {
              toast.success('Report Generated Successfully', { id: toastId })
              setActiveConfigReport(null)
              navigate('/admin/report-viewer', {
                state: { blobUrl: url, title: 'Daywise Attendance Punch In/Out Report' },
              })
            } else {
              toast.error('Failed to generate report', { id: toastId })
            }
          } catch (err) {
            console.error(err)
            toast.error('Failed to generate report', { id: toastId })
          }
        } else {
          // Excel
          const toastId = toast.loading('Generating Daywise Attendance (Punch In/Out) Excel...')
          try {
            let response: any = null
            if (dateMode === 'singleDate') {
              const data = await fetchSingleDateEmployeeData(firmId, singleDate)
              response = await downloadDaywiseAttendanceExcelPunchInOut(
                data.employees?.length > 0 ? data.employees : employees,
                data.absentees,
                activeFirmName,
                singleDate,
                selectedEmployeeIds,
                employees,
              )
            } else if (dateMode === 'fixed') {
              response = await downloadDaywiseAttendanceExcelPunchInOutByMonth(
                firmDetails,
                month,
                year,
                selectedEmployeeIds,
              )
            } else if (dateMode === 'range') {
              response = await downloadDaywiseAttendanceExcelPunchInOutByDateRange(
                firmDetails,
                { start: startDate, end: endDate },
                selectedEmployeeIds,
              )
            }

            if (response === null || response === false) {
              toast.error('Failed to generate report', { id: toastId })
            } else {
              toast.success('Download Completed!', { id: toastId })
            }
            setActiveConfigReport(null)
          } catch (err) {
            console.error(err)
            toast.error('Failed to generate report', { id: toastId })
          }
        }
      } else if (reportKey === 'attendance') {
        const toastId = toast.loading('Generating Attendance Excel...')
        try {
          let response: any = null
          if (dateMode === 'fixed') {
            response = await downloadOverAllReport(year, month, employees, firmId, activeFirmName, selectedEmployeeIds)
          } else {
            response = await downloadOverAllReportWithDateRange(startDate, endDate, employees, firmId, activeFirmName, selectedEmployeeIds)
          }
          if (response === null || response === false) {
            toast.error('Failed to generate report', { id: toastId })
          } else {
            toast.success('Download Completed!', { id: toastId })
          }
          setActiveConfigReport(null)
        } catch (err) {
          console.error(err)
          toast.error('Failed to generate report', { id: toastId })
        }
      } else if (reportKey === 'attendanceDetailed') {
        if (format === 'pdf') {
          const toastId = toast.loading('Generating Detailed Attendance PDF...')
          try {
            let url: any = null
            if (dateMode === 'range') {
              url = await downloadAttendanceTrackerPDFWithDateRange(
                userObj,
                startDate,
                endDate,
                employees,
                firmId,
                activeFirmName,
                '',
                '',
                selectedEmployeeIds,
                firmPaidLogo,
              )
            } else {
              url = await downloadAttendanceTrackerPDF(
                userObj,
                year,
                month,
                employees,
                firmId,
                activeFirmName,
                '',
                '',
                selectedEmployeeIds,
                firmPaidLogo,
              )
            }

            if (url) {
              toast.success('Report Generated Successfully', { id: toastId })
              setActiveConfigReport(null)
              navigate('/admin/report-viewer', {
                state: { blobUrl: url, title: 'Detailed Attendance Tracker' },
              })
            } else {
              toast.dismiss(toastId)
            }
          } catch (err) {
            console.error(err)
            toast.error('Failed to generate report', { id: toastId })
          }
        } else {
          // Excel
          const toastId = toast.loading('Generating Detailed Attendance Excel...')
          try {
            let url: any = null
            if (dateMode === 'range') {
              url = await downloadAttendanceTrackerWithDateRange(
                userObj,
                startDate,
                endDate,
                employees,
                firmId,
                activeFirmName,
                '',
                '',
                selectedEmployeeIds,
              )
            } else {
              url = await downloadAttendanceTracker(
                userObj,
                year,
                month,
                employees,
                firmId,
                activeFirmName,
                '',
                '',
                selectedEmployeeIds,
              )
            }

            if (url) {
              toast.success('Download Completed!', { id: toastId })
              setActiveConfigReport(null)
            } else {
              toast.dismiss(toastId)
            }
          } catch (err) {
            console.error(err)
            toast.error('Failed to generate report', { id: toastId })
          }
        }
      } else if (reportKey === 'workingHoursReport') {
        const toastId = toast.loading('Generating Working Hours Report Excel...')
        try {
          let url: any = null
          if (dateMode === 'fixed') {
            url = await downloadHoursReportExcel(year, month, firmId, activeFirmName, selectedEmployeeIds)
          } else {
            url = await downloadHoursReportExcelByDateRange(
              { start: startDate, end: endDate },
              firmId,
              activeFirmName,
              selectedEmployeeIds,
            )
          }
          if (url === null || url === false) {
            toast.error('Failed to generate report', { id: toastId })
          } else {
            toast.success('Download Completed!', { id: toastId })
          }
          setActiveConfigReport(null)
        } catch (err) {
          console.error(err)
          toast.error('Failed to generate report', { id: toastId })
        }
      } else if (reportKey === 'overtimeHoursReport') {
        const toastId = toast.loading('Generating Overtime Hours Report Excel...')
        try {
          let url: any = null
          if (dateMode === 'fixed') {
            url = await downloadOvertimeReportExcel(year, month, firmId, activeFirmName, selectedEmployeeIds)
          } else {
            url = await downloadOvertimeReportExcelByDateRange(
              { start: startDate, end: endDate },
              firmId,
              activeFirmName,
              selectedEmployeeIds,
            )
          }
          if (url === null || url === false) {
            toast.error('Failed to generate report', { id: toastId })
          } else {
            toast.success('Download Completed!', { id: toastId })
          }
          setActiveConfigReport(null)
        } catch (err) {
          console.error(err)
          toast.error('Failed to generate report', { id: toastId })
        }
      } else if (reportKey === 'monthlySummarySheet') {
        setActiveConfigReport(null)
        setZipTitle('Generating Monthly Attendance Sheets ZIP')
        setZipProgress(0)
        setZipModalOpen(true)

        const toastId = toast.loading('Generating Monthly Attendance Sheets...')
        try {
          const isMultiple = selectedEmployeeIds.length > 1
          let zip: any = null
          if (isMultiple) {
            zip = new JSZip()
          }

          const totalCount = selectedEmployeeIds.length
          let currentIndex = 0

          const monthsList = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December',
          ]

          for (const userid of selectedEmployeeIds) {
            const staffData = employees.find((emp) => emp.id === userid) || { name: 'Employee', id: userid }
            const empName = `${(staffData as any).first_name || ''} ${(staffData as any).last_name || ''}`.trim() || (staffData as any).name || 'Employee'
            setZipCurrentEmployee(empName)

            const result: any = await downloadEmployeewiseAttedanceReport(
              firmId,
              userid,
              month,
              year,
              staffData,
              isMultiple,
            )

            if (isMultiple && result && result.blob) {
              zip.file(result.filename, result.blob)
            }

            currentIndex++
            if (isMultiple) {
              const currentProgress = Math.round((currentIndex / totalCount) * 100)
              setZipProgress(currentProgress)
            }
          }

          if (isMultiple && zip) {
            toast.loading('Creating ZIP archive...', { id: toastId })
            const zipBlob = await zip.generateAsync({ type: 'blob' })
            const monthIdx = parseInt(month, 10) - 1
            const monthName = monthsList[monthIdx] || month
            const link = document.createElement('a')
            link.href = URL.createObjectURL(zipBlob)
            link.download = `monthly-attendance-sheets-${monthName}-${year}.zip`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            toast.success('Download Completed!', { id: toastId })
          } else {
            toast.success('Download Completed!', { id: toastId })
          }
        } catch (err) {
          console.error(err)
          toast.error('Failed to generate report', { id: toastId })
        } finally {
          setTimeout(() => setZipModalOpen(false), 1500)
        }
      }

      // ── Field Tracking Reports ──
      else if (reportKey === 'visits') {
        const toastId = toast.loading('Generating Visit Report Excel...')
        try {
          const res = await exportVisitsToExcel(employees, month, year, activeFirmName, firmId, selectedEmployeeIds)
          if (res) toast.success('Download Completed!', { id: toastId })
        } catch (err) {
          console.error(err)
          toast.error('Failed to generate report', { id: toastId })
        }
        setActiveConfigReport(null)
      } else if (reportKey === 'odometer') {
        const toastId = toast.loading('Generating Odometer Report Excel...')
        try {
          const res = await exportOdometerToExcel(employees, month, year, activeFirmName, firmId, selectedEmployeeIds)
          if (res) toast.success('Download Completed!', { id: toastId })
        } catch (err) {
          console.error(err)
          toast.error('Failed to generate report', { id: toastId })
        }
        setActiveConfigReport(null)
      } else if (reportKey === 'tasks') {
        const toastId = toast.loading('Generating Task Report Excel...')
        try {
          const res = await exportTaskReportToExcel({
            month,
            year,
            firmName: activeFirmName,
            creatorName: user?.first_name ? `${user.first_name} ${user.last_name || ''}` : 'Admin',
            selectedEmployeeIds,
          })
          if (res) toast.success('Download Completed!', { id: toastId })
        } catch (err) {
          console.error(err)
          toast.error('Failed to generate report', { id: toastId })
        }
        setActiveConfigReport(null)
      }

      // ── Finance Reports ──
      else if (reportKey === 'expense') {
        const toastId = toast.loading('Generating Expense Report Excel...')
        try {
          const res = await exportExpensesToExcel(employees, month, year, activeFirmName, selectedEmployeeIds)
          if (res) toast.success('Download Completed!', { id: toastId })
        } catch (err) {
          console.error(err)
          toast.error('Failed to generate report', { id: toastId })
        }
        setActiveConfigReport(null)
      } else if (reportKey === 'incentive') {
        const toastId = toast.loading('Generating Incentive Report Excel...')
        try {
          const res = await exportIncentivesToExcel(employees, month, year, activeFirmName, selectedEmployeeIds)
          if (res) toast.success('Download Completed!', { id: toastId })
        } catch (err) {
          console.error(err)
          toast.error('Failed to generate report', { id: toastId })
        }
        setActiveConfigReport(null)
      } else if (reportKey === 'payments') {
        const toastId = toast.loading('Generating Advance Payment Report Excel...')
        try {
          const res = await exportAdvancePaymentsToExcel(employees, month, year, activeFirmName, firmId, selectedEmployeeIds)
          if (res) toast.success('Download Completed!', { id: toastId })
        } catch (err) {
          console.error(err)
          toast.error('Failed to generate report', { id: toastId })
        }
        setActiveConfigReport(null)
      } else if (reportKey === 'payslips') {
        setActiveConfigReport(null)
        setZipTitle('Generating Employee Payslips ZIP')
        setZipProgress(0)
        setZipModalOpen(true)

        await exportPayslipsZip({
          employees,
          month,
          year,
          user,
          firmId,
          firmName: activeFirmName,
          selectedEmployeeIds,
          onProgress: (prog, name) => {
            setZipProgress(prog)
            setZipCurrentEmployee(name)
          },
        })

        setTimeout(() => setZipModalOpen(false), 1500)
      }
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="flex min-w-0 flex-1 gap-2">
      <Panel
        className={cn(
          'flex min-w-0 flex-1 flex-col h-full overflow-hidden bg-background border border-border shadow-2xs',
          firstTabActive && 'rounded-tl-none',
        )}
      >
        {/* 1. Top Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5 bg-background">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <FileSpreadsheet className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold tracking-tight text-foreground">
                  Reports & Analytics
                </h1>
                <span className="grid place-items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  {filteredReports.length} Available
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Export attendance registers, financial summaries, field activity logs, and master spreadsheets
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 pr-7 text-xs bg-muted/40 focus-visible:bg-background rounded-lg"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>

        {/* 2. Sub-Toolbar with Category Pills */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-2.5 bg-background">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {REPORT_CATEGORIES.map((tab) => {
              const isActive = selectedCategoryTab === tab.key
              const count = categoryCounts[tab.key as keyof typeof categoryCounts] ?? 0

              return (
                <button
                  key={tab.key}
                  onClick={() => setSelectedCategoryTab(tab.key)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-2xs'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      'text-[10px] px-1.5 py-0.2 rounded-full font-semibold',
                      isActive
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-muted-foreground/15 text-muted-foreground',
                    )}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 3. Main Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-background">
          {/* Custom Report Designer Banner */}
          <div
            onClick={() => navigate('/admin/report-builder')}
            className="group relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-background p-4.5 transition-all hover:border-primary/60 hover:shadow-xs cursor-pointer"
          >
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-xs">
                <Sparkles className="size-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  Custom Report Designer
                  <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                    PRO
                  </span>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Design custom report templates — pick exact columns, customize headers, reorder fields, and export directly.
                </p>
              </div>
            </div>

            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs font-medium self-start sm:self-auto shrink-0 cursor-pointer shadow-xs"
              onClick={(e) => {
                e.stopPropagation()
                navigate('/admin/report-builder')
              }}
            >
              <span>Open Designer</span>
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </div>

          {/* Report Cards Grid */}
          {filteredReports.length === 0 ? (
            <div className="py-20 text-center">
              <FileText className="mx-auto size-9 text-muted-foreground/60 mb-2.5 stroke-[1.5]" />
              <h3 className="text-sm font-semibold text-foreground">No reports found</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Try adjusting your search query or switching categories.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredReports.map((report) => (
                <ReportCard
                  key={report.key}
                  report={report}
                  onSelect={handleSelectReport}
                  isLoading={isGenerating && activeConfigReport?.key === report.key}
                />
              ))}
            </div>
          )}
        </div>

        {/* Report Configuration Dialog (Spacious 3-Column System) */}
        <ReportConfigModal
          open={Boolean(activeConfigReport)}
          onClose={() => setActiveConfigReport(null)}
          report={activeConfigReport}
          categories={categories}
          categoriesLoading={categoriesLoading}
          employees={activeEmployees}
          employeesLoading={employeesLoading}
          onGenerate={handleGenerateReport}
          isGenerating={isGenerating}
        />

        {/* Bulk ZIP Download Progress Modal */}
        <ReportBulkZipProgress
          open={zipModalOpen}
          title={zipTitle}
          progress={zipProgress}
          currentEmployeeName={zipCurrentEmployee}
          isDone={zipProgress === 100}
        />
      </Panel>
    </div>
  )
}
