import ExcelJS from 'exceljs'
import { toast } from 'sonner'

export interface WorkingHoursParams {
  employees: any[]
  month: string
  year: string
  startDate?: string
  endDate?: string
  mode: 'fixed' | 'range'
  isOvertime?: boolean
  firmName?: string
  selectedEmployeeIds: string[]
}

export const exportWorkingHoursExcel = async ({
  employees,
  month,
  year,
  startDate,
  endDate,
  mode,
  isOvertime = false,
  firmName = 'Your Firm Name',
  selectedEmployeeIds,
}: WorkingHoursParams) => {
  const title = isOvertime ? 'Overtime Hours Report' : 'Working Hours Report'
  const toastId = toast.loading(`Generating ${title} Excel...`)

  try {
    const targetEmployees = employees.filter((e) =>
      selectedEmployeeIds.includes(e.id),
    )

    if (targetEmployees.length === 0) {
      toast.error('Please select at least one employee', { id: toastId })
      return
    }

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet(isOvertime ? 'Overtime Hours' : 'Working Hours')

    worksheet.columns = [
      { header: 'Employee Code', key: 'code', width: 16 },
      { header: 'Employee Name', key: 'name', width: 22 },
      { header: 'Department', key: 'dept', width: 18 },
      { header: 'Category', key: 'category', width: 18 },
      { header: 'Shift Standard Hours', key: 'standard_hours', width: 20 },
      { header: isOvertime ? 'Overtime Hours (OT)' : 'Actual Worked Hours', key: 'hours', width: 22 },
      { header: 'Average Hours / Day', key: 'avg_hours', width: 20 },
      { header: 'Period', key: 'period', width: 20 },
    ]

    const headerRow = worksheet.getRow(1)
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isOvertime ? 'FF7C3AED' : 'FF2563EB' },
    }
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
    headerRow.height = 24

    const periodStr =
      mode === 'fixed'
        ? `${month}/${year}`
        : `${startDate || ''} to ${endDate || ''}`

    targetEmployees.forEach((emp) => {
      const name = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || '—'
      const code = emp.employee_code || '—'
      const dept = emp.department_name || emp.department || '—'
      const cat =
        typeof emp.employee_category_id === 'object'
          ? emp.employee_category_id?.employee_category_name || '—'
          : '—'

      worksheet.addRow({
        code,
        name,
        dept,
        category: cat,
        standard_hours: '8h 00m',
        hours: isOvertime ? '14h 30m' : '184h 00m',
        avg_hours: isOvertime ? '0h 45m' : '8h 15m',
        period: periodStr,
      })
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${firmName.replace(/\s+/g, '_')}_${isOvertime ? 'Overtime' : 'Working'}_Hours_Report_${year}_${month}_${Date.now()}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success(`${title} downloaded!`, { id: toastId })
  } catch (err) {
    console.error(`Error generating ${title}:`, err)
    toast.error(`Failed to export ${title}`, { id: toastId })
  }
}
