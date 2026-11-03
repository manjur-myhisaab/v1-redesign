import rdk, {
  readItems,
  createItem,
  updateItem,
  deleteItem,
} from '@/services/server'
import type {
  GeofenceListResponse,
  SingleGeofenceResponse,
  CreateGeofenceRequest,
  UpdateGeofenceRequest,
  GeofenceApiResponse,
} from './geofencingApi.types'

const GEOFENCE_FIELDS = [
  '*',
  'employee_category_id.employee_category_employee_category_id.*',
  'employee_id.*',
]

export const geofencingApi = {
  /**
   * Fetches all geofences from Directus geo_fences collection
   */
  getGeofences: async (): Promise<GeofenceListResponse> => {
    try {
      const res = await rdk.request(
        readItems('geo_fences', {
          fields: GEOFENCE_FIELDS,
          sort: ['-date_created'],
        })
      )
      const list = Array.isArray(res) ? res : Array.isArray((res as any)?.data) ? (res as any).data : []
      return {
        success: true,
        data: list,
        message: 'Geofences fetched successfully',
      }
    } catch (err: any) {
      console.error('Failed to get geofences:', err)
      return {
        success: false,
        data: [],
        message: err?.message || 'Failed to get geofences',
      }
    }
  },

  /**
   * Fetches single geofence by ID
   */
  getGeofenceById: async (id: string): Promise<SingleGeofenceResponse> => {
    try {
      const res = await rdk.request(
        readItems('geo_fences', {
          filter: {
            _or: [
              { geo_fence_id: { _eq: id } },
              { id: { _eq: id } },
            ],
          },
          fields: GEOFENCE_FIELDS,
        })
      )
      const list = Array.isArray(res) ? res : Array.isArray((res as any)?.data) ? (res as any).data : []
      const item = list[0]
      return {
        success: Boolean(item),
        data: item,
        message: item ? 'Geofence found' : 'Geofence not found',
      }
    } catch (err: any) {
      console.error('Failed to get geofence by ID:', err)
      return {
        success: false,
        data: null as any,
        message: err?.message || 'Failed to get geofence',
      }
    }
  },

  /**
   * Creates new geofence record in Directus
   */
  createGeofence: async (data: CreateGeofenceRequest | any): Promise<SingleGeofenceResponse> => {
    try {
      const payload: Record<string, any> = {
        lat: String(data.geo_lat || data.lat),
        long: String(data.geo_long || data.long),
        radius: Number(data.radius || 100),
        geo_fence_address: data.geo_fence_address || data.address || '',
        geo_fence_location_name: data.geo_fence_name || data.geo_fence_location_name || 'Geofence Location',
        status: data.status || 'active',
      }

      if (Array.isArray(data.employee_category_id) && data.employee_category_id.length > 0) {
        payload.employee_category_id = data.employee_category_id.map((catId: any) => ({
          employee_category_employee_category_id: {
            employee_category_id: Number(catId?.category_id || catId),
          },
        }))
      }

      if (Array.isArray(data.employee_id) && data.employee_id.length > 0) {
        payload.employee_id = data.employee_id.map((empId: any) => ({
          directus_users_id: empId?.directus_users_id || empId,
        }))
      }

      const res = await rdk.request(createItem('geo_fences', payload))
      return {
        success: true,
        data: res,
        message: 'Geofence created successfully',
      }
    } catch (err: any) {
      console.error('Failed to create geofence:', err)
      return {
        success: false,
        data: null as any,
        message: err?.message || 'Failed to create geofence',
      }
    }
  },

  /**
   * Updates existing geofence in Directus
   */
  updateGeofence: async (data: UpdateGeofenceRequest | any): Promise<SingleGeofenceResponse> => {
    try {
      const targetId = data.geo_fence_id || data.id

      const payload: Record<string, any> = {
        lat: String(data.geo_lat || data.lat),
        long: String(data.geo_long || data.long),
        radius: Number(data.radius || 100),
        geo_fence_address: data.geo_fence_address || data.address || '',
        geo_fence_location_name: data.geo_fence_name || data.geo_fence_location_name || 'Geofence Location',
        status: data.status || 'active',
      }

      if (Array.isArray(data.employee_category_id)) {
        payload.employee_category_id = data.employee_category_id.map((catId: any) => ({
          employee_category_employee_category_id: {
            employee_category_id: Number(catId?.category_id || catId),
          },
        }))
      }

      if (Array.isArray(data.employee_id)) {
        payload.employee_id = data.employee_id.map((empId: any) => ({
          directus_users_id: empId?.directus_users_id || empId,
        }))
      }

      const res = await rdk.request(updateItem('geo_fences', targetId, payload))
      return {
        success: true,
        data: res,
        message: 'Geofence updated successfully',
      }
    } catch (err: any) {
      console.error('Failed to update geofence:', err)
      return {
        success: false,
        data: null as any,
        message: err?.message || 'Failed to update geofence',
      }
    }
  },

  /**
   * Deletes geofence by ID
   */
  deleteGeofence: async (id: string): Promise<GeofenceApiResponse<any>> => {
    try {
      await rdk.request(deleteItem('geo_fences', id))
      return {
        success: true,
        data: null,
        message: 'Geofence deleted successfully',
      }
    } catch (err: any) {
      console.error('Failed to delete geofence:', err)
      return {
        success: false,
        data: null,
        message: err?.message || 'Failed to delete geofence',
      }
    }
  },
}
