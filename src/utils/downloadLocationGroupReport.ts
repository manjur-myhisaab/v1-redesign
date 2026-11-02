import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

const formatReportDate = (value?: Date | string | null): string => {
  if (!value) return '-'
  const date = new Date(value)
  if (isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export const downloadLocationGroupReport = async (
  employeeName: string,
  reportDate: Date | string,
  locationGroups: any[],
  firmName?: string,
  totalTimelinePoints: number = 0
) => {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Location Report')

  const effectiveFirmName = firmName && firmName.trim() ? firmName : 'RRV Softech PVT LTD'

  // ----------------------------------------------------
  // FIRM NAME (Top)
  // ----------------------------------------------------
  worksheet.mergeCells('A1', 'G1')
  const firmCell = worksheet.getCell('A1')
  firmCell.value = effectiveFirmName
  firmCell.style = {
    font: { size: 16, bold: true },
    alignment: { horizontal: 'center' },
  }

  // Report title
  worksheet.mergeCells('A2', 'G2')
  const titleCell = worksheet.getCell('A2')
  titleCell.value = `Location Timeline Report - ${employeeName}`
  titleCell.style = {
    font: { size: 14, bold: true },
    alignment: { horizontal: 'center' },
  }

  // Date row
  worksheet.mergeCells('A3', 'G3')
  const dateCell = worksheet.getCell('A3')
  dateCell.value = `Date: ${formatReportDate(reportDate)}`
  dateCell.style = {
    font: { size: 12, bold: false },
    alignment: { horizontal: 'center' },
  }

  worksheet.addRow([])

  // ----------------------------------------------------
  // HEADER
  // ----------------------------------------------------
  const header = [
    'Address',
    'Time',
    'Journey Status',
    'Points', // Replaced "Duration" with "Points"
    'Accuracy',
    'Battery',
    'View Map',
  ]

  const headerRow = worksheet.addRow(header)
  headerRow.eachCell((cell) => {
    cell.style = {
      font: { bold: true },
      alignment: { horizontal: 'center' },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      },
    }
  })

  // ----------------------------------------------------
  // DATA ROWS
  // ----------------------------------------------------
  locationGroups.forEach((group, idx) => {
    const timeString = group.timeRangeString || '-'

    let journeyStatus = 'Transit'
    const isFirst =
      typeof group.isFirst === 'function'
        ? group.isFirst()
        : idx === 0 || group.status === 'start'

    const isLast =
      typeof group.isLast === 'function'
        ? group.isLast(totalTimelinePoints)
        : idx === locationGroups.length - 1 || group.status === 'end'

    const startMs = group.startTime ? new Date(group.startTime).getTime() : 0
    const endMs = group.endTime ? new Date(group.endTime).getTime() : 0
    const isStayed = endMs - startMs >= 60000 || group.status === 'stayed'

    if (isFirst) {
      journeyStatus = 'Start'
    } else if (isLast) {
      journeyStatus = 'End'
    } else if (isStayed) {
      journeyStatus = 'Stayed'
    }

    // Get points count
    const points = group.pointCount ?? group.indices?.length ?? 1

    const lat = group.position?.lat ?? group.lat
    const lng = group.position?.lng ?? group.lng
    const googleMapsUrl = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : null

    // Battery display
    let batteryDisplay = '-'
    const rawBat = group.batteryLevel ?? group.battery_percentage ?? group.batteryPercentage
    if (rawBat !== null && rawBat !== undefined && rawBat !== '') {
      const parsedNum = parseFloat(String(rawBat))
      if (!isNaN(parsedNum)) {
        batteryDisplay = `${parsedNum <= 1 ? Math.round(parsedNum * 100) : Math.round(parsedNum)}%`
      }
    }

    const accuracyVal =
      group.accuracy !== null && group.accuracy !== undefined
        ? typeof group.accuracy === 'number'
          ? Math.round(group.accuracy)
          : group.accuracy
        : '-'

    const row = worksheet.addRow([
      group.address || 'Unknown',
      timeString,
      journeyStatus,
      points,
      accuracyVal,
      batteryDisplay,
      'View Map',
    ])

    if (googleMapsUrl) {
      const cell = row.getCell(7)
      cell.value = {
        text: 'View Map',
        hyperlink: googleMapsUrl,
        tooltip: 'Open in Google Maps',
      }
      cell.font = { color: { argb: 'FF0000FF' }, underline: true }
    }

    row.eachCell((cell) => {
      cell.style = {
        alignment: { vertical: 'middle', horizontal: 'center' },
        border: {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' },
        },
      }
    })

    row.getCell(1).style.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
  })

  // ----------------------------------------------------
  // COLUMN WIDTHS
  // ----------------------------------------------------
  worksheet.getColumn(1).width = 45
  worksheet.getColumn(2).width = 22
  worksheet.getColumn(3).width = 15
  worksheet.getColumn(4).width = 10
  worksheet.getColumn(5).width = 10
  worksheet.getColumn(6).width = 10
  worksheet.getColumn(7).width = 15

  worksheet.views = [{ state: 'frozen', ySplit: 5 }]

  // ----------------------------------------------------
  // DOWNLOAD
  // ----------------------------------------------------
  const buffer = await workbook.xlsx.writeBuffer()
  saveAs(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `Location_Timeline_Report_${employeeName}_${formatReportDate(reportDate)}.xlsx`
  )
}
