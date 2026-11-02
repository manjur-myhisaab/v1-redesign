import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { sound } from '@/lib/sound'
import { holidaysApi } from '../api/holidaysApi'
import { FALLBACK_PUBLIC_HOLIDAYS_2026 } from '../api/mockPublicHolidays'
import type {
  PublicHolidayData,
  FirmHoliday,
  CreateFirmHolidayRequest,
  UpdateFirmHolidayRequest,
} from '../api/holidaysApi.types'

export function usePublicHolidaysQuery(
  year: number = new Date().getFullYear(),
  countryCode: string = 'IN'
) {
  return useQuery<PublicHolidayData | null>({
    queryKey: ['public-holidays', year, countryCode],
    queryFn: async () => {
      try {
        const res = await holidaysApi.getPublicHolidays()
        if (res && res.success && res.data) {
          if (Array.isArray((res.data as any).holidays) && (res.data as any).holidays.length > 0) {
            return res.data
          }
          if (Array.isArray(res.data) && res.data.length > 0) {
            return {
              country: countryCode,
              year,
              total_holidays: res.data.length,
              holidays: res.data,
            }
          }
        }
      } catch (err) {
        console.warn('Public holidays API unavailable, falling back to cached public holiday list:', err)
      }
      return year === 2026 ? FALLBACK_PUBLIC_HOLIDAYS_2026 : null
    },
  })
}

export function useFirmHolidaysQuery(year: number = new Date().getFullYear()) {
  return useQuery<FirmHoliday[]>({
    queryKey: ['firm-holidays', year],
    queryFn: async () => {
      try {
        const res = await holidaysApi.getFirmHolidays(year)
        if (res && res.success) {
          if (Array.isArray(res.data)) return res.data
          if (Array.isArray((res.data as any)?.holidays)) return (res.data as any).holidays
        }
        return []
      } catch (err) {
        console.error('Failed to load firm holidays from API:', err)
        return []
      }
    },
  })
}

export function useHolidayDetailsQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['holiday-details', id],
    queryFn: async () => {
      if (!id) return null
      const res = await holidaysApi.getHolidayDetails(id)
      if (res && res.success && res.data) {
        return res.data
      }
      return null
    },
    enabled: !!id,
  })
}

export function useCreateFirmHolidayMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateFirmHolidayRequest) => {
      const res = await holidaysApi.createFirmHoliday(data)
      if (res && res.success) {
        toast.success(res.message || 'Holiday added successfully.')
        return res.data
      }
      throw new Error(res?.message || 'Failed to add holiday')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to add holiday')
    },
    onSuccess: () => {
      sound.success()
      queryClient.invalidateQueries({ queryKey: ['firm-holidays'] })
    },
  })
}

export function useCreateBulkFirmHolidaysMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateFirmHolidayRequest[]) => {
      const res = await holidaysApi.createBulkFirmHolidays(data)
      if (res && (res.success || res.status === 200 || res.status === 201 || Array.isArray(res.data) || res.data)) {
        toast.success(res.message || `${data.length} holidays added successfully.`)
        return res.data
      }
      throw new Error(res?.message || 'Failed to bulk add holidays')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to bulk add holidays')
    },
    onSuccess: () => {
      sound.success()
      queryClient.invalidateQueries({ queryKey: ['firm-holidays'] })
    },
  })
}

export function useUpdateFirmHolidayMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: UpdateFirmHolidayRequest) => {
      const res = await holidaysApi.updateFirmHoliday(data)
      if (res && res.success) {
        toast.success(res.message || 'Holiday updated successfully.')
        return res.data
      }
      throw new Error(res?.message || 'Failed to update holiday')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update holiday')
    },
    onSuccess: (_data, variables) => {
      sound.success()
      queryClient.invalidateQueries({ queryKey: ['firm-holidays'] })
      if (variables?.holiday_id) {
        queryClient.invalidateQueries({ queryKey: ['holiday-details', variables.holiday_id] })
      }
    },
  })
}

export function useDeleteFirmHolidayMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await holidaysApi.deleteFirmHoliday(id)
      if (res && res.success) {
        toast.success(res.message || 'Holiday removed successfully.')
        return res.data
      }
      throw new Error(res?.message || 'Failed to remove holiday')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to remove holiday')
    },
    onSuccess: () => {
      sound.success()
      queryClient.invalidateQueries({ queryKey: ['firm-holidays'] })
    },
  })
}
