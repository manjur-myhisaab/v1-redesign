// @ts-nocheck
import ExcelJS from 'exceljs'

/**
 * Downloads Roaster Table in Excel Format based on a Date Range
 * Matches 100% of V1's downloadRoasterExcelByDateRange.js
 * @param users - Filtered list of users
 * @param shifts - List of all available shifts
 * @param startDate - Selected start date
 * @param endDate - Selected end date
 * @param firmName - Name of the firm
 */
export const downloadRoasterExcelByDateRange = async (
  users: any[],
  shifts: any[],
  startDate: Date,
  endDate: Date,
  firmName: string = 'MyHisaab'
) => {
  try {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Roaster Range Report')

    // 1. Calculate all dates in the range
    const datesInRange: Date[] = []
    let currentDate = new Date(startDate)
    const end = new Date(endDate)

    while (currentDate <= end) {
      datesInRange.push(new Date(currentDate))
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Total columns (System ID [Hidden], Emp ID, Emp Name, Designation, Category, Department, Shift Type = 7)
    const totalColumns = 7 + datesInRange.length

    // Formatting dates for the header text
    const formatDateText = (d: Date) =>
      `${String(d.getDate()).padStart(2, '0')}-${d.toLocaleString('default', { month: 'short' })}-${d.getFullYear()}`
    const rangeText = `${formatDateText(startDate)} to ${formatDateText(endDate)}`

    // 2. Setup Firm Name (Row 1: Top Middle)
    worksheet.mergeCells(1, 1, 1, totalColumns)
    const firmNameCell = worksheet.getCell(1, 1)
    firmNameCell.value = firmName
    firmNameCell.font = { name: 'Arial', size: 18, bold: true }
    firmNameCell.alignment = { vertical: 'middle', horizontal: 'center' }

    // 3. Setup Date Range (Row 2: Below Firm Name, Middle)
    worksheet.mergeCells(2, 1, 2, totalColumns)
    const rangeCell = worksheet.getCell(2, 1)
    rangeCell.value = `Roaster Report: ${rangeText}`
    rangeCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF4B5563' } }
    rangeCell.alignment = { vertical: 'middle', horizontal: 'center' }

    // Add an empty row for spacing (Row 3)
    worksheet.addRow([])

    // 4. Setup Headers (Added 'System ID' at the beginning)
    const headerRowData = [
      'System ID',
      'Employee ID',
      'Employee Name',
      'Designation',
      'Category',
      'Department',
      'Shift Type',
    ]

    datesInRange.forEach((date) => {
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })

      // Generate Full Date in DD-MM-YYYY format
      const dayNum = String(date.getDate()).padStart(2, '0')
      const monthNum = String(date.getMonth() + 1).padStart(2, '0')
      const yr = date.getFullYear()
      const fullDate = `${dayNum}-${monthNum}-${yr}`

      headerRowData.push(`${dayName}\n${fullDate}`)
    })

    const headerRow = worksheet.addRow(headerRowData)
    headerRow.height = 30
    headerRow.eachCell((cell) => {
      cell.font = { bold: true }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' },
      }
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      }
    })

    // 5. Populate Data Rows
    const sortedUsers = [...users].sort((a, b) => {
      const deptA = (a.department_name || '').toLowerCase()
      const deptB = (b.department_name || '').toLowerCase()

      if (deptA < deptB) return -1
      if (deptA > deptB) return 1
      return 0
    })

    sortedUsers.forEach((user) => {
      const rowData = []

      const internalId = String(user.id || '')
      const employeeId = user.employee_code || '-'
      const employeeName = `${user.first_name || ''} ${user.last_name || ''}`.trim()
      const designation = user.designation_id?.designation_name || user.designation_id?.name || '-'
      const category = user.employee_category_id?.employee_category_name || '-'
      const department = user.department_name || '-'
      const shiftType = user.shift_type
        ? user.shift_type.charAt(0).toUpperCase() + user.shift_type.slice(1)
        : 'Not Assigned'

      rowData.push(internalId, employeeId, employeeName, designation, category, department, shiftType)

      // Shift Data per Date in Range
      datesInRange.forEach((date) => {
        const d = String(date.getDate()).padStart(2, '0')
        const m = String(date.getMonth() + 1).padStart(2, '0')
        const y = date.getFullYear()
        const dateString = `${d}-${m}-${y}`

        const currentShiftData = user.monthly_shifts?.find((ms: any) => ms.date_string === dateString)

        let shiftNames = '-'
        if (currentShiftData?.shift_ids?.length > 0) {
          const names = currentShiftData.shift_ids.map((s: any) => {
            const sId = s.shift_id?.shift_id ?? s.shift_id?.id ?? s.shift_id ?? s
            if (String(sId) === '0') return 'Week Off'

            const shiftObj = shifts.find((sh: any) => String(sh.shift_id ?? sh.id) === String(sId))
            return shiftObj ? shiftObj.shift_name || shiftObj.name : 'Unknown'
          })
          shiftNames = names.join(', ')
        }
        rowData.push(shiftNames)
      })

      const dataRow = worksheet.addRow(rowData)

      // Styling Data Cells
      dataRow.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        }

        if (colNumber > 7) {
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
          if (cell.value && String(cell.value).includes('Week Off')) {
            cell.font = { color: { argb: 'FF16A34A' }, bold: true }
          }
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' }
          if (colNumber === 3) cell.font = { bold: true }
        }
      })
    })

    // 6. Adjust Column Widths & Hide System ID Column
    worksheet.columns.forEach((column, index) => {
      if (index === 0) {
        column.hidden = true
        column.width = 15
      } else if (index === 1) column.width = 15
      else if (index === 2) column.width = 25
      else if (index === 3) column.width = 20
      else if (index === 4) column.width = 20
      else if (index === 5) column.width = 20
      else if (index === 6) column.width = 15
      else column.width = 15
    })

    // 7. Generate and Download Excel File
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = window.URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url

    const formattedFirmName = (firmName || 'Firm').replace(/\s+/g, '_')
    const sDate = `${String(startDate.getDate()).padStart(2, '0')}${startDate.toLocaleString('default', { month: 'short' })}`
    const eDate = `${String(endDate.getDate()).padStart(2, '0')}${endDate.toLocaleString('default', { month: 'short' })}`

    link.download = `${formattedFirmName}_Roaster_${sDate}_to_${eDate}.xlsx`

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    return true
  } catch (error) {
    console.error('Error exporting range to Excel:', error)
    throw error
  }
}
