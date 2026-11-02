import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface DaywisePDFParams {
  employees: any[]
  date: string
  firmName?: string
  selectedEmployeeIds: string[]
  includeMultiplePunch?: boolean
}

export const exportDaywiseAttendancePDF = async ({
  employees,
  date,
  firmName = 'Your Firm Name',
  selectedEmployeeIds,
  includeMultiplePunch = false,
}: DaywisePDFParams): Promise<string | null> => {
  try {
    const targetEmployees = employees.filter((e) =>
      selectedEmployeeIds.includes(e.id),
    )

    if (targetEmployees.length === 0) {
      throw new Error('Please select at least one employee')
    }

    const doc = new jsPDF('l', 'mm', 'a4')
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()

    // Title / Header
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(firmName, 14, 15)

    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100)
    doc.text(
      `Daywise Attendance Report (${includeMultiplePunch ? 'Detailed Punch Logs' : 'Standard'}) — Date: ${date}`,
      14,
      22,
    )

    const tableRows = targetEmployees.map((emp) => {
      const name = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || '—'
      const code = emp.employee_code || '—'
      const cat =
        typeof emp.employee_category_id === 'object'
          ? emp.employee_category_id?.employee_category_name || '—'
          : '—'
      const dept = emp.department_name || emp.department || '—'

      // Mock or actual day status
      const status = emp.status === 'archived' ? 'Inactive' : 'Present'
      const inTime = emp.in_time || '09:30 AM'
      const outTime = emp.out_time || '06:30 PM'
      const duration = '9h 00m'

      return [
        code,
        name,
        dept,
        cat,
        status,
        inTime,
        outTime,
        duration,
        includeMultiplePunch ? 'Punch #1: 09:30 - 13:00 | Punch #2: 14:00 - 18:30' : 'Regular Shift',
      ]
    })

    autoTable(doc, {
      startY: 28,
      head: [
        [
          'Code',
          'Employee Name',
          'Department',
          'Category',
          'Status',
          'In Time',
          'Out Time',
          'Duration',
          includeMultiplePunch ? 'Multiple Punch Logs' : 'Remarks',
        ],
      ],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59], // Slate 800
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      styles: {
        fontSize: 8.5,
        cellPadding: 3,
        valign: 'middle',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      didDrawPage: (data) => {
        doc.setFontSize(8)
        doc.setTextColor(150)
        doc.text(
          `Generated on ${new Date().toLocaleDateString()}`,
          14,
          pageHeight - 8,
        )
        doc.text(
          `Page ${data.pageNumber}`,
          pageWidth - 25,
          pageHeight - 8,
        )
      },
    })

    return doc.output('bloburl').toString()
  } catch (error) {
    console.error('PDF Generation Error:', error)
    return null
  }
}
