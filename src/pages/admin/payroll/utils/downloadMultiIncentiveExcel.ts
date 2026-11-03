import ExcelJS from 'exceljs'
import rdk, { readItems } from '@/services/server'

export const downloadMultiIncentiveExcel = async (
  employeeList: any[],
  month: string | number,
  year: string | number,
  firmName: string,
  selectedEmployeeIds: string[] = [],
) => {
  try {
    const numericMonth = Number(month)
    const numericYear = Number(year)
    const startDate = new Date(numericYear, numericMonth - 1, 1)
    const endDate = new Date(numericYear, numericMonth, 0)

    const formatDate = (date: Date) => {
      const yyyy = date.getFullYear()
      const mm = String(date.getMonth() + 1).padStart(2, '0')
      const dd = String(date.getDate()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}`
    }

    const start = formatDate(startDate)
    const end = formatDate(endDate)

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Incentive Report')

    // Styling
    const headingFont = { bold: true, size: 14 }
    const subheadingFont = { bold: true, size: 12 }
    const headerFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFCC00' },
    }

    // Freeze header
    worksheet.views = [{ state: 'frozen', ySplit: 4 }]

    let currentRow = 1

    // --- Main Headings ---
    worksheet.mergeCells(`A${currentRow}:H${currentRow}`)
    worksheet.getCell(`A${currentRow}`).value = firmName || 'My Firm'
    worksheet.getCell(`A${currentRow}`).font = headingFont
    worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center' }
    currentRow++

    worksheet.mergeCells(`A${currentRow}:H${currentRow}`)
    worksheet.getCell(`A${currentRow}`).value = `Incentive Report (${start} to ${end})`
    worksheet.getCell(`A${currentRow}`).font = subheadingFont
    worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center' }
    currentRow++

    currentRow++ // Blank row

    // --- Column Headers ---
    const headers = [
      'EMPLOYEE ID',
      'NAME',
      'DESIGNATION',
      'CATEGORY',
      'DEPARTMENT',
      'DATE',
      'AMOUNT',
      'STATUS',
    ]
    const headerRow = worksheet.getRow(currentRow)
    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1)
      cell.value = header
      cell.font = { bold: true }
      cell.fill = headerFill
      cell.alignment = { horizontal: 'center' }
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      }
    })
    headerRow.commit()
    currentRow++

    // Set column widths
    worksheet.columns = [
      { key: 'empid', width: 20 },
      { key: 'name', width: 25 },
      { key: 'designation', width: 25 },
      { key: 'category', width: 20 },
      { key: 'department', width: 20 },
      { key: 'date', width: 15 },
      { key: 'amount', width: 14 },
      { key: 'status', width: 15 },
    ]

    let listToIterate = employeeList
    if (selectedEmployeeIds.length > 0) {
      listToIterate = employeeList.filter((emp) =>
        selectedEmployeeIds.includes(String(emp.id)),
      )
    }

    // --- Data Rows ---
    for (const emp of listToIterate) {
      const empId = emp.id
      const empCode = emp.employee_code || '-'
      const designation = emp.title || '-'
      const firstName = emp.first_name || ''
      const lastName = emp.last_name || ''
      const category = emp.employee_category_id
      const department = emp.department_name || '-'

      const name = `${firstName} ${lastName}`.trim()
      const categoryName =
        typeof category === 'object' && category !== null
          ? category.employee_category_name || '-'
          : '-'
      const departmentName = department

      const response: any = await rdk.request(
        readItems('incentives', {
          filter: {
            _and: [
              { employee_id: { _eq: empId } },
              { incentive_date: { _between: [start, end] } },
            ],
          },
          sort: ['-incentive_date'],
        }),
      )

      const data = Array.isArray(response) ? response : response?.data || []

      data.forEach((item: any) => {
        const date = item.incentive_date
          ? new Date(item.incentive_date).toLocaleDateString('en-GB')
          : '-'
        const row = worksheet.getRow(currentRow)

        row.getCell(1).value = empCode
        row.getCell(2).value = name
        row.getCell(3).value = designation
        row.getCell(4).value = categoryName
        row.getCell(5).value = departmentName
        row.getCell(6).value = date
        row.getCell(7).value = Number(item.incentive_amount) || 0
        row.getCell(8).value = item.status || 'Active'

        const statusCell = row.getCell(8)
        const status = (item.status || '').toUpperCase()

        if (status === 'APPROVE' || status === 'APPROVED') {
          statusCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFC6EFCE' },
          }
        } else if (status === 'REJECT' || status === 'REJECTED') {
          statusCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFC7CE' },
          }
        } else {
          statusCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFFCC' },
          }
        }

        for (let i = 1; i <= headers.length; i++) {
          row.getCell(i).border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          }
        }

        row.commit()
        currentRow++
      })
    }

    // --- Download Excel ---
    const fileName = `Multi_Incentive_Report_${start}_to_${end}.xlsx`
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = fileName
    link.click()
    URL.revokeObjectURL(link.href)
  } catch (error) {
    console.error('Failed to download incentive report:', error)
    throw error
  }
}
