import ExcelJS from 'exceljs'
import { toast } from 'sonner'

export interface DaywiseExcelParams {
  employees: any[]
  date: string
  firmName?: string
  selectedEmployeeIds: string[]
  includeMultiplePunch?: boolean
}

export const exportDaywiseAttendanceExcel = async ({
  employees,
  date,
  firmName = 'Your Firm Name',
  selectedEmployeeIds,
  includeMultiplePunch = false,
}: DaywiseExcelParams) => {
  const toastId = toast.loading('Generating Daywise Attendance Excel...')

  try {
    const targetEmployees = employees.filter((e) =>
      selectedEmployeeIds.includes(e.id),
    )

    if (targetEmployees.length === 0) {
      toast.error('Please select at least one employee', { id: toastId })
      return
    }

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Daywise Attendance')

    worksheet.columns = [
      { header: 'Employee Code', key: 'code', width: 16 },
      { header: 'Employee Name', key: 'name', width: 22 },
      { header: 'Department', key: 'department', width: 18 },
      { header: 'Category', key: 'category', width: 18 },
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'First In Time', key: 'in_time', width: 16 },
      { header: 'Last Out Time', key: 'out_time', width: 16 },
      { header: 'Total Duration', key: 'duration', width: 16 },
      { header: includeMultiplePunch ? 'Multiple Punches' : 'Remarks', key: 'remarks', width: 34 },
    ]

    const headerRow = worksheet.getRow(1)
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    }
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
    headerRow.height = 24

    targetEmployees.forEach((emp) => {
      const name = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || '—'
      const code = emp.employee_code || '—'
      const cat =
        typeof emp.employee_category_id === 'object'
          ? emp.employee_category_id?.employee_category_name || '—'
          : '—'
      const dept = emp.department_name || emp.department || '—'

      worksheet.addRow({
        code,
        name,
        department: dept,
        category: cat,
        date,
        status: emp.status === 'archived' ? 'Inactive' : 'Present',
        in_time: emp.in_time || '09:30 AM',
        out_time: emp.out_time || '06:30 PM',
        duration: '9h 00m',
        remarks: includeMultiplePunch
          ? 'Punch #1: 09:30 - 13:00 | Punch #2: 14:00 - 18:30'
          : 'Regular Shift',
      })
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${firmName.replace(/\s+/g, '_')}_Daywise_Attendance_${date}_${Date.now()}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success('Daywise Attendance Excel downloaded!', { id: toastId })
  } catch (err) {
    console.error('Error exporting daywise attendance excel:', err)
    toast.error('Failed to export Daywise Attendance Excel', { id: toastId })
  }
}
