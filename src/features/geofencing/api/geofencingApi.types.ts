export interface EmployeeCategoryJunction {
  id?: number | string
  employee_category_employee_category_id?: {
    employee_category_id: number | string
    employee_category_name?: string
    [key: string]: any
  }
}

export interface EmployeeJunction {
  id?: number | string
  directus_users_id: string
}

export interface Geofence {
  geo_fence_id?: number | string
  id?: number | string
  lat: string | number
  long: string | number
  radius: number // in meters
  geo_fence_address?: string
  geo_fence_location_name?: string
  status?: string
  employee_category_id?: EmployeeCategoryJunction[]
  employee_id?: EmployeeJunction[]
  date_created?: string
  date_updated?: string
  // Legacy compatibility fallbacks
  geo_lat?: number | string
  geo_long?: number | string
  geo_fence_name?: string
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
  lat: string | number
  long: string | number
  radius: number
  geo_fence_address?: string
  geo_fence_location_name?: string
  status?: string
  employee_category_id?: any[]
  employee_id?: any[]
  // Compatibility fallbacks
  geo_lat?: number | string
  geo_long?: number | string
  geo_fence_name?: string
}

export interface UpdateGeofenceRequest extends CreateGeofenceRequest {
  geo_fence_id?: number | string
  id?: number | string
}
