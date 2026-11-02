import { apiClient } from '@/api/apiClient'
import type { FirmListItem, FirmDetails, SwitchFirmResponse, FirmApiResponse } from './firmApi.types'

export const firmApi = {
  getAllFirms: async (): Promise<FirmApiResponse<FirmListItem[]>> => {
    return apiClient.get('/firm/all')
  },

  getFirmDetails: async (): Promise<FirmApiResponse<FirmDetails>> => {
    return apiClient.get('/firm/details')
  },

  switchFirm: async (firmId: string): Promise<FirmApiResponse<SwitchFirmResponse>> => {
    return apiClient.post('/firm/switch', { firm_id: firmId })
  },

  updateFirm: async (data: Partial<FirmDetails>): Promise<FirmApiResponse<FirmDetails>> => {
    return apiClient.put('/firm/update', data)
  },
}
