// @ts-nocheck
import ExcelJS from 'exceljs'

/**
 * Downloads Roaster Table in Excel Format
 * Matches 100% of V1's downloadRoasterExcel.js
 * @param users - Filtered list of users
 * @param shifts - List of all available shifts
 * @param month - Selected month index (0-11)
 * @param year - Selected year
 * @param firmName - Name of the firm to display at the top
 */
export const downloadRoasterExcel = async (
  users: any[],
  shifts: any[],
  month: string | number,
  year: number,
  firmName: string = 'MyHisaab'
) => {
  try {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Roaster Report')

    // Calculate total days and prepare day array
    const monthInt = parseInt(String(month), 10)
    const totalDays = new Date(year, monthInt + 1, 0).getDate()
    const daysInMonth = Array.from({ length: totalDays }, (_, i) => i + 1)

    // Updated total columns (System ID [Hidden], Emp ID, Emp Name, Designation, Category, Department, Shift Type = 7)
    const totalColumns = 7 + totalDays
    const monthName = new Date(year, monthInt).toLocaleString('default', { month: 'long' })

    // 1. Setup Firm Name (Row 1: Top Middle)
    worksheet.mergeCells(1, 1, 1, totalColumns)
    const firmNameCell = worksheet.getCell(1, 1)
    firmNameCell.value = firmName
    firmNameCell.font = { name: 'Arial', size: 18, bold: true }
    firmNameCell.alignment = { vertical: 'middle', horizontal: 'center' }

    // 2. Setup Month & Year (Row 2: Below Firm Name, Middle)
    worksheet.mergeCells(2, 1, 2, totalColumns)
    const monthYearCell = worksheet.getCell(2, 1)
    monthYearCell.value = `Roaster Report for ${monthName} - ${year}`
    monthYearCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF4B5563' } }
    monthYearCell.alignment = { vertical: 'middle', horizontal: 'center' }

    // Add an empty row for spacing (Row 3)
    worksheet.addRow([])

    // 3. Setup Headers (Added 'System ID' at the beginning)
    const headerRowData = [
      'System ID',
      'Employee ID',
      'Employee Name',
      'Designation',
      'Category',
      'Department',
      'Shift Type',
    ]

    daysInMonth.forEach((day) => {
      const dateObj = new Date(year, monthInt, day)
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' })

      // Generate Full Date in DD-MM-YYYY format
      const fullDate = `${String(day).padStart(2, '0')}-${String(monthInt + 1).padStart(2, '0')}-${year}`

      // Using \n so Day name comes on top and Full Date below it in the cell
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

    // 4. Populate Data Rows
    const sortedUsers = [...users].sort((a, b) => {
      const deptA = (a.department_name || '').toLowerCase()
      const deptB = (b.department_name || '').toLowerCase()

      if (deptA < deptB) return -1
      if (deptA > deptB) return 1
      return 0
    })

    sortedUsers.forEach((user) => {
      const rowData = []

      // Extracting fields (internal 'id' at start)
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

      // Shift Data per Day
      daysInMonth.forEach((day) => {
        const dateString = `${String(day).padStart(2, '0')}-${String(monthInt + 1).padStart(2, '0')}-${year}`
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

    // 5. Adjust Column Widths & Hide System ID Column
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

    // 6. Generate and Download Excel File
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = window.URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url

    const formattedFirmName = (firmName || 'Firm').replace(/\s+/g, '_')
    link.download = `${formattedFirmName}_Roaster_Report_${monthName}_${year}.xlsx`

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    return true
  } catch (error) {
    console.error('Error exporting to Excel:', error)
    throw error
  }
}
