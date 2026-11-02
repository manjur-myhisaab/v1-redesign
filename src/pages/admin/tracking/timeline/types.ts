export interface ParsedTimelinePoint {
  id: string
  lat: number
  lng: number
  timestamp: Date
  timeFormatted: string
  address: string
  accuracy: number | null
  batteryPercentage: number | null
  speed: number | null
  odometer: number | null
}

export interface TimelineLocationGroup {
  id: string
  position: { lat: number; lng: number }
  address: string
  startIndex: number
  endIndex: number
  pointCount: number
  startTime: Date
  endTime: Date
  durationMinutes: number
  timeRangeString: string
  accuracy: number | null
  batteryPercentage: number | null
  status: 'start' | 'end' | 'stayed' | 'transit'
  hasPoorAccuracy: boolean
}

export interface TimelineEmployee {
  id: string
  first_name: string
  last_name?: string
  full_name: string
  avatar?: string
  department_name?: string
  category_name?: string
  live_tracking?: boolean | string | number
}

export interface TimelineSummary {
  totalPoints: number
  totalGroups: number
  totalDistanceKm: number
  odometerDistanceKm: number
  startTime: Date | null
  endTime: Date | null
  totalDurationFormatted: string
  startBattery: number | null
  endBattery: number | null
}

export type PlaybackSpeed = 1 | 2 | 4 | 8
