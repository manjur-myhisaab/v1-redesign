import { apiClient } from '@/api/apiClient'
import type {
  ShiftApiResponse,
  SingleShiftData,
  Shift,
  CreateShiftRequest,
  UpdateShiftRequest,
  BulkAssignShiftsRequest,
} from './shiftApi.types'

export const shiftsApi = {
  getShifts: async (): Promise<ShiftApiResponse<Shift[] | { shifts: Shift[] }>> => {
    return apiClient.get('/firm/shift/all')
  },

  getShiftById: async (id: string): Promise<ShiftApiResponse<SingleShiftData>> => {
    return apiClient.get(`/firm/shift/details/${id}`)
  },

  createShift: async (data: CreateShiftRequest): Promise<ShiftApiResponse<SingleShiftData>> => {
    return apiClient.post('/firm/shift/create', data)
  },

  updateShift: async (data: UpdateShiftRequest): Promise<ShiftApiResponse<SingleShiftData>> => {
    return apiClient.put('/firm/shift/update', data)
  },

  deleteShift: async (id: string): Promise<ShiftApiResponse<any>> => {
    return apiClient.delete(`/firm/shift/delete/${id}`)
  },

  assignShifts: async (data: BulkAssignShiftsRequest): Promise<ShiftApiResponse<any>> => {
    return apiClient.post('/firm/shift/assign', data)
  },
}
