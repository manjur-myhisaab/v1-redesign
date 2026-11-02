export type ConnectionStatus = 'connecting' | 'connected' | 'error' | 'disconnected'

export interface EmployeeCategory {
  id?: string | number
  employee_category_id?: string | number
  name?: string
  category_name?: string
  employee_category_name?: string
}

export interface TrackingEmployee {
  id: string | number
  first_name?: string
  last_name?: string
  avatar?: string | null
  email?: string
  role?: string
  title?: string
  department_name?: string
  live_tracking?: boolean
  punch_status?: string
  employee_category_id?: any
  category_id?: string | number
  category_name?: string
  firm_id?: any

  // Geolocation & Realtime state
  last_lat?: number | string | null
  last_long?: number | string | null
  last_loc_time?: number | string | null
  last_geo_address?: string | null

  current_lat?: number | string | null
  current_long?: number | string | null
  current_last_seen?: number | string | null
  is_realtime_active?: boolean

  battery_percentage?: number | string | null
  is_moving?: boolean | null
  speed?: number | string | null
  accuracy?: number | string | null
  device_timestamp?: number | string | null
}

export interface FirebaseRealtimeItem {
  last_lat?: number | string
  last_long?: number | string
  geo_lat?: number | string
  geo_long?: number | string
  latitude?: number | string
  longitude?: number | string
  timestamp?: number | string
  deviceTimestamp?: number | string
  last_loc_time?: number | string
  battery_percentage?: number | string
  battery_level?: number | string
  is_moving?: boolean
  speed?: number | string
  accuracy?: number | string
  address?: string
  [key: string]: any
}
