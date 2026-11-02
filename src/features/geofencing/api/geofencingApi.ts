import { apiClient } from '@/api/apiClient'
import type {
  GeofenceListResponse,
  SingleGeofenceResponse,
  CreateGeofenceRequest,
  UpdateGeofenceRequest,
  GeofenceApiResponse,
} from './geofencingApi.types'

export const geofencingApi = {
  /**
   * GET /api/v2/firm/geo-fence/all
   * Fetches all geofences for current firm
   */
  getGeofences: async (): Promise<GeofenceListResponse> => {
    return apiClient.get('/firm/geo-fence/all')
  },

  /**
   * GET /api/v2/firm/geo-fence/details/:id
   */
  getGeofenceById: async (id: string): Promise<SingleGeofenceResponse> => {
    return apiClient.get(`/firm/geo-fence/details/${id}`)
  },

  /**
   * POST /api/v2/firm/geo-fence/create
   */
  createGeofence: async (data: CreateGeofenceRequest): Promise<SingleGeofenceResponse> => {
    return apiClient.post('/firm/geo-fence/create', data)
  },

  /**
   * PUT /api/v2/firm/geo-fence/update
   */
  updateGeofence: async (data: UpdateGeofenceRequest): Promise<SingleGeofenceResponse> => {
    return apiClient.put('/firm/geo-fence/update', data)
  },

  /**
   * DELETE /api/v2/firm/geo-fence/delete/:id
   */
  deleteGeofence: async (id: string): Promise<GeofenceApiResponse<any>> => {
    return apiClient.delete(`/firm/geo-fence/delete/${id}`)
  },
}
