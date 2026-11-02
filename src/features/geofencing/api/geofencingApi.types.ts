export interface GeofenceCategoryAssignment {
  category_id: string
  sub_category_id: string[]
}

export interface Geofence {
  geo_fence_id?: string
  id?: string
  geo_fence_name: string
  geo_fence_address: string
  geo_lat: number
  geo_long: number
  radius: number // in meters
  status: 'active' | 'inactive'
  applicable_user: string[]
  applicable_categories_for: GeofenceCategoryAssignment[]
  created_at?: string
  updated_at?: string
}

export interface GeofenceApiResponse<T> {
  success: boolean
  message: string
  data: T
}

export type GeofenceListResponse = GeofenceApiResponse<Geofence[]>
export type SingleGeofenceResponse = GeofenceApiResponse<Geofence>

export interface CreateGeofenceRequest {
  geo_fence_name: string
  geo_fence_address: string
  geo_lat: number
  geo_long: number
  radius: number
  status: 'active' | 'inactive'
  applicable_user: string[]
  applicable_categories_for: GeofenceCategoryAssignment[]
}

export interface UpdateGeofenceRequest extends CreateGeofenceRequest {
  geo_fence_id?: string
  id?: string
}
