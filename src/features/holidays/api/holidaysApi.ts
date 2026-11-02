import { apiClient } from '@/api/apiClient'
import type {
  PublicHolidayListResponse,
  FirmHolidayListResponse,
  HolidayDetailResponse,
  CreateFirmHolidayRequest,
  UpdateFirmHolidayRequest,
} from './holidaysApi.types'

export const holidaysApi = {
  /**
   * GET /api/v2/firm/holiday/public/list
   * Returns list of public holidays.
   */
  getPublicHolidays: async (): Promise<PublicHolidayListResponse> => {
    return apiClient.get('/firm/holiday/public/list')
  },

  /**
   * POST /api/v2/firm/holiday/all
   * Returns list of firm-specific active holidays for the requested year.
   */
  getFirmHolidays: async (year?: string | number): Promise<FirmHolidayListResponse> => {
    const y = year ? String(year) : String(new Date().getFullYear())
    return apiClient.post('/firm/holiday/all', { year: y })
  },

  /**
   * GET /api/v2/firm/holiday/details/:id
   * Returns details of a specific firm holiday.
   */
  getHolidayDetails: async (id: string): Promise<HolidayDetailResponse> => {
    return apiClient.get(`/firm/holiday/details/${id}`)
  },

  /**
   * POST /api/v2/firm/holiday/create
   * Adds a new custom holiday for the firm.
   */
  createFirmHoliday: async (data: CreateFirmHolidayRequest): Promise<any> => {
    return apiClient.post('/firm/holiday/create', data)
  },

  /**
   * POST /api/v2/firm/holiday/create/bulk
   * Adds multiple holidays in bulk for the firm.
   */
  createBulkFirmHolidays: async (data: CreateFirmHolidayRequest[]): Promise<any> => {
    return apiClient.post('/firm/holiday/create/bulk', data)
  },

  /**
   * PUT /api/v2/firm/holiday/update
   * Updates an existing firm holiday.
   */
  updateFirmHoliday: async (data: UpdateFirmHolidayRequest): Promise<any> => {
    return apiClient.put('/firm/holiday/update', data)
  },

  /**
   * DELETE /api/v2/firm/holiday/delete/:id
   */
  deleteFirmHoliday: async (id: string): Promise<any> => {
    return apiClient.delete(`/firm/holiday/delete/${id}`)
  },
}
