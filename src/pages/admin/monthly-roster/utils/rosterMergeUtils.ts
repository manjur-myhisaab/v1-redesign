// @ts-nocheck
import type { RosterUser, MonthlyShiftItem } from '../types'

/**
 * Helper to Merge Shifts Preserving Past/Existing Month Data
 * Matches 100% logic from V1 myhisaab-v1/src/pages/roaster/Roaster.jsx
 */
export const mergeEmployeeMonthlyShifts = (
  currentUser: RosterUser | undefined,
  newDatesPayload: Array<{ date_string: string; shift_ids: Array<{ shift_id: number }> }>
) => {
  let existingMonthlyShifts: MonthlyShiftItem[] = []
  if (Array.isArray(currentUser?.monthly_shifts)) {
    existingMonthlyShifts = currentUser.monthly_shifts
  } else if (typeof currentUser?.monthly_shifts === 'string') {
    try {
      existingMonthlyShifts = JSON.parse(currentUser.monthly_shifts)
    } catch {
      existingMonthlyShifts = []
    }
  }

  const mergedShiftsMap = new Map<string, any>()

  // 1. Pichle mahino ka jitna bhi data hai (All existing shifts) ko map me rakho
  existingMonthlyShifts.forEach((ms) => {
    if (!ms || !ms.date_string) return
    const cleanShiftIds = (ms.shift_ids || [])
      .map((s: any) => {
        const sId = s.shift_id?.shift_id ?? s.shift_id?.id ?? s.shift_id ?? s
        const parsed = parseInt(String(sId), 10)
        return isNaN(parsed) ? null : { shift_id: parsed }
      })
      .filter(Boolean)

    mergedShiftsMap.set(ms.date_string, {
      date_string: ms.date_string,
      shift_ids: cleanShiftIds,
    })
  })

  // 2. Naye shifts (Current month/date range) ko merge karo - matching dates update hongi, baaki pichla data safe rahega
  ;(newDatesPayload || []).forEach((nms) => {
    if (!nms || !nms.date_string) return
    const cleanShiftIds = (nms.shift_ids || [])
      .map((s: any) => {
        const sId = s.shift_id?.shift_id ?? s.shift_id?.id ?? s.shift_id ?? s
        const parsed = parseInt(String(sId), 10)
        return isNaN(parsed) ? null : { shift_id: parsed }
      })
      .filter(Boolean)

    mergedShiftsMap.set(nms.date_string, {
      date_string: nms.date_string,
      shift_ids: cleanShiftIds,
    })
  })

  const finalMergedMonthlyShifts = Array.from(mergedShiftsMap.values())
  const uniqueOverallShifts = new Set<number>()

  // 3. Pichle aur current sabhi mahino ke shifts ko overall shift_ids me include karo
  finalMergedMonthlyShifts.forEach((day: any) => {
    if (day.shift_ids && day.shift_ids.length > 0) {
      day.shift_ids.forEach((s: any) => {
        const sId = s.shift_id?.shift_id ?? s.shift_id?.id ?? s.shift_id ?? s
        if (sId !== undefined && sId !== null) {
          const parsedId = parseInt(String(sId), 10)
          if (parsedId !== 0 && !isNaN(parsedId)) {
            uniqueOverallShifts.add(parsedId)
          }
        }
      })
    }
  })

  // 4. Employee ke pehle se assigned shift_ids ko bhi preserve karo
  if (currentUser?.shift_ids && Array.isArray(currentUser.shift_ids)) {
    currentUser.shift_ids.forEach((item: any) => {
      const sId =
        item?.shift_shift_id?.shift_id ??
        item?.shift_shift_id?.id ??
        item?.shift_shift_id ??
        item?.shift_id ??
        item
      if (sId !== undefined && sId !== null) {
        const parsedId = parseInt(String(sId), 10)
        if (parsedId !== 0 && !isNaN(parsedId)) {
          uniqueOverallShifts.add(parsedId)
        }
      }
    })
  }

  const formattedOverallShiftIds = Array.from(uniqueOverallShifts)
    .filter((id) => id !== 0 && id !== null && id !== undefined && !isNaN(id))
    .map((id) => ({
      shift_shift_id: { shift_id: id },
    }))

  return {
    schedule_data: finalMergedMonthlyShifts,
    shift_ids: formattedOverallShiftIds,
  }
}
