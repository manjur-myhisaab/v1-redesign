import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { sound } from '@/lib/sound'
import { shiftsApi } from '../api/shiftsApi'
import type {
  Shift,
  CreateShiftRequest,
  UpdateShiftRequest,
  BulkAssignShiftsRequest,
  SingleShiftData,
} from '../api/shiftApi.types'

export function useShiftsQuery() {
  return useQuery<Shift[]>({
    queryKey: ['shifts'],
    queryFn: async () => {
      const res = await shiftsApi.getShifts()
      if (res && res.success) {
        if (Array.isArray(res.data)) {
          return res.data
        }
        if (res.data && typeof res.data === 'object') {
          if ('shifts' in res.data && Array.isArray((res.data as any).shifts)) {
            return (res.data as any).shifts
          }
        }
      }
      return []
    },
  })
}

export function useShiftDetailsQuery(id: string | undefined) {
  return useQuery<SingleShiftData>({
    queryKey: ['shift', id],
    queryFn: async () => {
      if (!id) throw new Error('No shift ID')
      const res = await shiftsApi.getShiftById(id)
      if (res && res.success && res.data) {
        return res.data
      }
      throw new Error(res?.message || 'Failed to fetch shift details')
    },
    enabled: !!id,
  })
}

export function useCreateShiftMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateShiftRequest) => {
      const res = await shiftsApi.createShift(data)
      if (res && res.success) {
        toast.success(res.message || 'Shift created successfully.')
        return res.data
      }
      throw new Error(res?.message || 'Failed to create shift')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create shift')
    },
    onSuccess: () => {
      sound.success()
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
    },
  })
}

export function useUpdateShiftMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: UpdateShiftRequest) => {
      const res = await shiftsApi.updateShift(data)
      if (res && res.success) {
        return res.data
      }
      throw new Error(res?.message || 'Failed to update shift')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update shift')
    },
    onSuccess: () => {
      toast.success('Shift updated successfully.')
      sound.success()
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
    },
  })
}

export function useDeleteShiftMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.all(ids.map((id) => shiftsApi.deleteShift(id)))
      const successful = results.find((res) => res && res.success)
      if (successful) {
        toast.success(successful.message || 'Shift(s) deleted successfully.')
      } else {
        toast.success('Shift(s) deleted successfully.')
      }
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete shift')
    },
    onSuccess: () => {
      sound.success()
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
    },
  })
}

export function useBulkAssignShiftsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: BulkAssignShiftsRequest) => {
      const res = await shiftsApi.assignShifts(data)
      if (res && res.success) {
        toast.success(res.message || 'Shifts assigned successfully.')
        return res.data
      }
      throw new Error(res?.message || 'Failed to assign shifts')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to assign shifts')
    },
    onSuccess: () => {
      sound.success()
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

