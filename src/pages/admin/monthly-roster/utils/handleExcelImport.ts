// @ts-nocheck
import * as XLSX from 'xlsx'
import { toast } from 'sonner'

const parseHeaderDate = (headerStr: any): string | null => {
  if (!headerStr) return null
  const str = String(headerStr).trim()

  const matchNum = str.match(/(\d{2})[-/](\d{2})[-/](\d{4})/)
  if (matchNum) {
    return `${matchNum[1]}-${matchNum[2]}-${matchNum[3]}`
  }

  const matchAlpha = str.match(/(\d{2})-([a-zA-Z]{3})-(\d{4})/)
  if (matchAlpha) {
    const [, day, monthStr, year] = matchAlpha
    const monthMap: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    }
    const month = monthMap[monthStr.toLowerCase()] || '01'
    return `${day}-${month}-${year}`
  }
  return null
}

export const handleExcelImportPayload = async (
  file: File,
  allShifts: any[],
  allEmployees: any[]
): Promise<Array<{ employee_id: string; schedule_data: any[]; shift_ids: any[] }> | null> => {
  try {
    const data = await file.arrayBuffer()
    const workbook = XLSX.read(data, { type: 'array' })

    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]

    const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      raw: false,
      dateNF: 'dd-mm-yyyy',
    })

    let headerRowIndex = -1
    for (let i = 0; i < jsonData.length; i++) {
      const rowStr = jsonData[i].map((c: any) => String(c).trim().toLowerCase())
      if (rowStr.includes('employee name')) {
        headerRowIndex = i
        break
      }
    }

    if (headerRowIndex === -1) {
      toast.error('Invalid Excel format: Required columns not found.')
      throw new Error('Could not find Header row.')
    }

    const headers = jsonData[headerRowIndex].map((h: any) => String(h).trim())
    const nameColIndex = headers.findIndex((h: string) => h.toLowerCase() === 'employee name')

    const dateColumns: Array<{ colIndex: number; dateString: string }> = []
    headers.forEach((header: string, index: number) => {
      const dateStr = parseHeaderDate(header)
      if (dateStr) {
        dateColumns.push({ colIndex: index, dateString: dateStr })
      }
    })

    if (dateColumns.length === 0) {
      toast.error('Could not detect any valid dates in the header.')
      return null
    }

    const finalPayload: Array<{
      employee_id: string
      schedule_data: any[]
      shift_ids: any[]
    }> = []

    for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
      const row = jsonData[i]
      if (!row || row.length === 0) continue

      // 1. Excel sheet se ek employee uthao (Full Name)
      const empNameFromExcel = nameColIndex !== -1 ? String(row[nameColIndex]).trim() : 'Unknown'

      if (!empNameFromExcel || empNameFromExcel.toLowerCase() === 'employee name') continue

      let empId: string | null = null

      // 2. allEmployees me se first name aur last name milake compare karo
      if (empNameFromExcel !== 'Unknown') {
        const excelFullName = empNameFromExcel.toLowerCase()

        const matchedEmployee = allEmployees.find((emp: any) => {
          const dbFullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim().toLowerCase()
          return dbFullName && excelFullName.includes(dbFullName)
        })

        if (matchedEmployee) {
          empId = String(matchedEmployee.id)
        }
      }

      if (!empId) {
        console.warn(`Employee skipped (Naam database me nahi mila): ${empNameFromExcel}`)
        continue
      }

      const scheduleData: any[] = []
      const uniqueOverallShifts = new Set<number>()

      for (const { colIndex, dateString } of dateColumns) {
        const cellValue = String(row[colIndex] || '').trim()
        const dailyShiftIds: any[] = []

        if (cellValue && cellValue !== '-') {
          const shiftNamesArray = cellValue.split(',').map((s: string) => s.trim()).filter(Boolean)

          shiftNamesArray.forEach((shiftName: string) => {
            let sId: any = null
            const shiftLower = shiftName.toLowerCase()

            if (shiftLower.includes('week off') || shiftLower === 'wo') {
              sId = 0
            } else {
              const cleanShiftName = shiftLower.replace('3nd', '3rd').replace('1nd', '1st')
              const matchedShift = allShifts.find((s: any) => {
                const dbShiftName = String(s.shift_name || '').toLowerCase().trim()
                return dbShiftName === cleanShiftName || dbShiftName === shiftLower
              })

              if (matchedShift) {
                sId = matchedShift.shift_id ?? matchedShift.id
              }
            }

            if (sId !== null) {
              dailyShiftIds.push({ shift_id: parseInt(String(sId), 10) })
              uniqueOverallShifts.add(parseInt(String(sId), 10))
            }
          })
        }

        scheduleData.push({
          date_string: dateString,
          shift_ids: dailyShiftIds,
        })
      }

      const formattedOverallShiftIds = Array.from(uniqueOverallShifts).map((id) => ({
        shift_shift_id: { shift_id: id },
      }))

      finalPayload.push({
        employee_id: empId,
        schedule_data: scheduleData,
        shift_ids: formattedOverallShiftIds,
      })
    }

    return finalPayload
  } catch (error) {
    console.error('Excel Parsing Error:', error)
    toast.error('Failed to process Excel file.')
    return null
  }
}
