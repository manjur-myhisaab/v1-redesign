import JSZip from 'jszip'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { toast } from 'sonner'

export interface MonthlySummaryZipParams {
  employees: any[]
  month: string
  year: string
  firmName?: string
  selectedEmployeeIds: string[]
  onProgress?: (progress: number, currentEmployeeName: string) => void
}

export const exportMonthlySummaryZip = async ({
  employees,
  month,
  year,
  firmName = 'Your Firm Name',
  selectedEmployeeIds,
  onProgress,
}: MonthlySummaryZipParams) => {
  const targetEmployees = employees.filter((e) =>
    selectedEmployeeIds.includes(e.id),
  )

  if (targetEmployees.length === 0) {
    toast.error('Please select at least one employee')
    return
  }

  const zip = new JSZip()
  const total = targetEmployees.length

  try {
    for (let i = 0; i < total; i++) {
      const emp = targetEmployees[i]
      const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || `Employee_${emp.id}`

      if (onProgress) {
        onProgress(Math.round(((i + 1) / total) * 100), fullName)
      }

      // Generate single employee monthly summary PDF
      const doc = new jsPDF('p', 'mm', 'a4')
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text(firmName, 14, 15)

      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100)
      doc.text(
        `Monthly Attendance Summary — ${fullName} (${emp.employee_code || '—'})`,
        14,
        22,
      )
      doc.text(`Period: ${month}/${year}`, 14, 28)

      autoTable(doc, {
        startY: 34,
        head: [['Day', 'Date', 'Status', 'In Time', 'Out Time', 'Work Hours']],
        body: Array.from({ length: 30 }, (_, d) => [
          String(d + 1),
          `${year}-${String(month).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`,
          (d + 1) % 7 === 0 ? 'Weekly Off' : 'Present',
          (d + 1) % 7 === 0 ? '—' : '09:30 AM',
          (d + 1) % 7 === 0 ? '—' : '06:30 PM',
          (d + 1) % 7 === 0 ? '0h' : '9h 00m',
        ]),
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59] },
        styles: { fontSize: 8.5 },
      })

      const pdfBlob = doc.output('blob')
      zip.file(`${fullName.replace(/\s+/g, '_')}_Monthly_Sheet.pdf`, pdfBlob)
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(zipBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Monthly_Attendance_Sheets_${year}_${month}.zip`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast.success('Monthly attendance sheets ZIP downloaded successfully!')
  } catch (err) {
    console.error('Error generating monthly summary zip:', err)
    toast.error('Failed to generate attendance sheets ZIP')
  }
}
