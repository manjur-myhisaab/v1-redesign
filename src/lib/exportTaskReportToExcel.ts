import ExcelJS from 'exceljs'
import rdk, { readItems, ATTENDANCE_SERVER_URL, API_URL } from '@/services/server'
import toast from 'react-hot-toast'

// --- Helper Formatting Functions ---
const formatTime = (timeStr?: string) => {
  if (!timeStr) return '-'
  try {
    const [hours, minutes] = timeStr.split(':')
    const date = new Date()
    date.setHours(parseInt(hours, 10), parseInt(minutes, 10))
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return timeStr
  }
}

const formatDateOnly = (timestamp?: string) => {
  if (!timestamp) return '-'
  try {
    return new Date(timestamp)
      .toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
      .replace(',', '')
  } catch {
    return timestamp
  }
}

const formatTimeOnly = (timestamp?: string) => {
  if (!timestamp) return '-'
  try {
    return new Date(timestamp)
      .toLocaleString('en-GB', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
      .toLowerCase()
  } catch {
    return timestamp
  }
}

const formatDateIso = (d: Date) => d.toISOString().split('T')[0]

export interface ExportTaskReportOptions {
  month?: number | string
  year?: number | string
  customStartDate?: string
  customEndDate?: string
  firmName?: string
  creatorName?: string
  selectedEmployeeIds?: string[]
  selectedTaskIds?: (string | number)[] | null
  statusFilter?: string
  priorityFilter?: string
}

export async function exportTaskReportToExcel(options: ExportTaskReportOptions): Promise<boolean> {
  const {
    month,
    year,
    customStartDate,
    customEndDate,
    firmName = 'Company Tasks',
    selectedEmployeeIds = [],
    selectedTaskIds = null,
    statusFilter = 'all',
    priorityFilter = 'all',
  } = options

  const numericMonth = Number(month)
  const numericYear = Number(year)

  const hasMonthYear =
    month &&
    year &&
    month !== '#' &&
    year !== '#' &&
    month !== 'all' &&
    year !== 'all' &&
    !isNaN(numericMonth) &&
    !isNaN(numericYear)

  let startDate: Date | null = null
  let endDate: Date | null = null
  let monthName = 'All'
  let fileLabel = 'All_Tasks'

  if (hasMonthYear) {
    startDate = new Date(Date.UTC(numericYear, numericMonth - 1, 1))
    endDate = new Date(Date.UTC(numericYear, numericMonth, 0, 23, 59, 59))
    monthName = new Date(`${numericYear}-${String(numericMonth).padStart(2, '0')}-01`).toLocaleString('default', {
      month: 'long',
    })
    fileLabel = `${monthName}_${numericYear}`
  } else if (customStartDate && customEndDate) {
    startDate = new Date(customStartDate)
    endDate = new Date(customEndDate)
    fileLabel = `${customStartDate}_to_${customEndDate}`
  }

  const toastId = toast.loading('Generating Task Excel Report...')

  try {
    // --- 1. Excel Setup ---
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Task Report')

    const headingFont = { bold: true, size: 14 }
    const subheadingFont = { bold: true, size: 12 }

    worksheet.mergeCells('A1:U1')
    worksheet.getCell('A1').value = firmName
    worksheet.getCell('A1').font = headingFont
    worksheet.getCell('A1').alignment = { horizontal: 'center' }

    worksheet.mergeCells('A2:U2')
    worksheet.getCell('A2').value = hasMonthYear
      ? `Task Report - ${monthName} ${numericYear}`
      : customStartDate && customEndDate
      ? `Task Report - ${customStartDate} to ${customEndDate}`
      : `Task Report - All Tasks`
    worksheet.getCell('A2').font = subheadingFont
    worksheet.getCell('A2').alignment = { horizontal: 'center' }

    worksheet.addRow([]) // spacer row

    const headers = [
      'TASK ID',
      'ASSIGNED TO',
      'CATEGORY',
      'TITLE',
      'DESCRIPTION',
      'DUE DATE',
      'DUE TIME',
      'CLIENT NAME',
      'CLIENT PHONE NO',
      'CLIENT ADDRESS',
      'PRIORITY',
      'STATUS',
      'CREATED DATE',
      'CREATED TIME',
      'UPDATED DATE',
      'UPDATED TIME',
      'TASK REPORT REMARKS',
      'TASK SUBMITTED BY',
      'TASK SUBMITTED DATE',
      'TASK SUBMITTED TIME',
      'TASK REPORT IMAGES',
    ]

    const headerRow = worksheet.addRow(headers)

    // Column widths
    const colWidths = [16, 26, 20, 36, 30, 16, 14, 22, 18, 24, 14, 16, 16, 14, 16, 14, 32, 24, 18, 14, 28]
    colWidths.forEach((width, i) => {
      worksheet.getColumn(i + 1).width = width
    })

    headerRow.eachCell((cell) => {
      cell.font = { bold: true }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFCC00' },
      }
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      }
    })

    // --- 2. Fetch Tasks ---
    let tasks: any[] = []

    if (selectedTaskIds && selectedTaskIds.length > 0) {
      // Specific tasks selected
      const response: any = await rdk.request(
        readItems('tasks', {
          filter: { task_id: { _in: selectedTaskIds } },
          fields: [
            '*',
            'assignedTo.*',
            'assignedTo.employee_category_id.*',
            'assignedToOthers.directus_users_id.*',
            'client_id.*',
          ],
          limit: -1,
        }),
      )
      tasks = Array.isArray(response) ? response : response?.data || []
    } else {
      const filterConditions: any[] = []
      if (startDate && endDate) {
        filterConditions.push({
          task_duedate: { _between: [formatDateIso(startDate), formatDateIso(endDate)] },
        })
      }
      if (statusFilter && statusFilter !== 'all') {
        filterConditions.push({ status: { _eq: statusFilter } })
      }
      if (priorityFilter && priorityFilter !== 'all') {
        filterConditions.push({ task_priority: { _eq: priorityFilter } })
      }

      const response: any = await rdk.request(
        readItems('tasks', {
          filter: filterConditions.length > 0 ? { _and: filterConditions } : {},
          fields: [
            '*',
            'assignedTo.*',
            'assignedTo.employee_category_id.*',
            'assignedToOthers.directus_users_id.*',
            'client_id.*',
          ],
          limit: -1,
        }),
      )
      const allTasks = Array.isArray(response) ? response : response?.data || []

      // Filter by selected employees if provided
      if (selectedEmployeeIds && selectedEmployeeIds.length > 0) {
        tasks = allTasks.filter((task: any) => {
          const primaryId =
            typeof task.assignedTo === 'object' && task.assignedTo !== null
              ? String(task.assignedTo.id || '')
              : String(task.assignedTo || '')
          if (selectedEmployeeIds.includes(primaryId)) return true

          if (Array.isArray(task.assignedToOthers)) {
            return task.assignedToOthers.some((other: any) => {
              const otherId =
                typeof other?.directus_users_id === 'object' && other?.directus_users_id !== null
                  ? String(other.directus_users_id.id || '')
                  : String(other?.directus_users_id || '')
              return selectedEmployeeIds.includes(otherId)
            })
          }
          return false
        })
      } else {
        tasks = allTasks
      }
    }

    if (tasks.length === 0) {
      toast.error('No tasks found for the selected criteria.', { id: toastId })
      return false
    }

    // --- 3. Bulk Fetch Task Reports ---
    const reportsMap: Record<string, any[]> = {}
    const taskIds = tasks.map((t) => t.task_id)

    if (taskIds.length > 0) {
      try {
        const allReportsResponse: any = await rdk.request(
          readItems('task_reports', {
            filter: { task_id: { _in: taskIds } },
            fields: ['*', 'task_images.*', 'submitted_by.*', 'task_id.task_id'],
            limit: -1,
          }),
        )
        const allReports = Array.isArray(allReportsResponse)
          ? allReportsResponse
          : allReportsResponse?.data || []

        allReports.forEach((report: any) => {
          const tId = typeof report.task_id === 'object' ? report.task_id.task_id : report.task_id
          if (tId) {
            const key = String(tId)
            if (!reportsMap[key]) reportsMap[key] = []
            reportsMap[key].push(report)
          }
        })
      } catch (err) {
        console.error('Failed to bulk fetch reports for export:', err)
      }
    }

    // --- 4. Write Data to Worksheet ---
    const baseUrl = ATTENDANCE_SERVER_URL || API_URL

    for (const task of tasks) {
      const primaryName =
        typeof task.assignedTo === 'object' && task.assignedTo !== null
          ? `${task.assignedTo.first_name || ''} ${task.assignedTo.last_name || ''}`.trim()
          : '-'
      const categoryName =
        typeof task.assignedTo === 'object' && task.assignedTo?.employee_category_id
          ? typeof task.assignedTo.employee_category_id === 'object'
            ? task.assignedTo.employee_category_id.employee_category_name || '-'
            : '-'
          : '-'

      const clientName =
        typeof task.client_id === 'object' && task.client_id !== null
          ? task.client_id.client_name || '-'
          : '-'
      const clientPhone =
        typeof task.client_id === 'object' && task.client_id !== null
          ? task.client_id.client_phone || '-'
          : '-'
      const clientAddress =
        typeof task.client_id === 'object' && task.client_id !== null
          ? task.client_id.client_address || '-'
          : '-'

      const row = worksheet.addRow([
        task.task_id,
        primaryName,
        categoryName,
        task.task_title || '-',
        task.task_description || '-',
        task.task_duedate ? task.task_duedate.split('T')[0] : '-',
        formatTime(task.task_duetime),
        clientName,
        clientPhone,
        clientAddress,
        task.task_priority || 'medium',
        task.status || 'pending',
        formatDateOnly(task.date_created),
        formatTimeOnly(task.date_created),
        formatDateOnly(task.date_updated),
        formatTimeOnly(task.date_updated),
      ])

      // Task row background
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEEFF' } }
      })

      // Priority color styling
      const priorityCell = row.getCell(11)
      switch ((task.task_priority || '').toLowerCase()) {
        case 'urgent':
        case 'high':
          priorityCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCCCC' } }
          break
        case 'medium':
          priorityCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF99' } }
          break
        case 'low':
          priorityCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCFFCC' } }
          break
      }

      // Status color styling
      const statusCell = row.getCell(12)
      switch ((task.status || '').toLowerCase()) {
        case 'completed':
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } }
          break
        case 'pending':
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } }
          break
        case 'in_progress':
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EDF7' } }
          break
        case 'overdue':
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } }
          break
      }

      // Report Sub-Rows
      const reports = reportsMap[String(task.task_id)] || []
      for (const report of reports) {
        const imageLinksArray = Array.isArray(report.task_images) ? report.task_images : []
        const reporterName = report.submitted_by
          ? `${report.submitted_by.first_name || ''} ${report.submitted_by.last_name || ''}`.trim()
          : 'Staff'

        if (imageLinksArray.length === 0) {
          const reportRow = worksheet.addRow([
            task.task_id,
            '',
            '',
            task.task_title || '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            report.review || '-',
            reporterName,
            formatDateOnly(report.submitted_at),
            formatTimeOnly(report.submitted_at),
            'No photos',
          ])
          reportRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }
          })
        } else {
          for (const img of imageLinksArray) {
            const fileId =
              typeof img.directus_files_id === 'object' && img.directus_files_id !== null
                ? (img.directus_files_id as any)?.id
                : img.directus_files_id

            const imageCellValue = fileId
              ? { text: 'View Photo Link', hyperlink: `${baseUrl}/assets/${fileId}` }
              : 'No file'

            const reportRow = worksheet.addRow([
              task.task_id,
              '',
              '',
              task.task_title || '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              report.review || '-',
              reporterName,
              formatDateOnly(report.submitted_at),
              formatTimeOnly(report.submitted_at),
              imageCellValue,
            ])
            reportRow.eachCell((cell) => {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }
            })
          }
        }
      }
    }

    // Freeze panes on header
    worksheet.views = [{ state: 'frozen', ySplit: 4 }]

    // --- 5. Generate & Download Buffer ---
    const fileName = `Task_Report_${fileLabel}.xlsx`
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)

    toast.success('Task Report Excel downloaded successfully!', { id: toastId })
    return true
  } catch (err: any) {
    console.error('Task Report Export Error:', err)
    toast.error(err?.message || 'Failed to generate task report', { id: toastId })
    return false
  }
}
