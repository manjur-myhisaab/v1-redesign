export interface PublicHolidayListRequest {
  country_code: string
  year: number
}

export interface FirmHolidayListRequest {
  year: string
}

export interface PublicHoliday {
  id: string
  holiday_name: string
  holiday_date: string
  end_date: string
  holiday_type: string
}

export interface PublicHolidayData {
  country_code?: string
  country?: string
  year: number
  calendar?: string
  description?: string
  timeZone?: string
  count?: number
  total_holidays?: number
  holidays: PublicHoliday[]
}

export interface PublicHolidayListResponse {
  success: boolean
  message: string
  data: PublicHolidayData
}

export interface ApplicableCategory {
  category_id: string
  sub_category_id: string[]
}

export interface FirmHoliday {
  id?: string
  holiday_id?: string
  _id?: string
  holiday_name?: string
  name?: string
  holiday_date?: string
  date?: string
  start_date?: string
  end_date?: string
  holiday_type?: 'mandatory' | 'optional' | 'restricted' | 'public_holiday' | 'company' | string
  type?: string
  description?: string
  is_half_day?: boolean
  applicable_categories_for?: ApplicableCategory[]
  applicable_user?: string[]
  created_at?: string
  updated_at?: string
}

export interface FirmHolidayDetail extends FirmHoliday {
  users?: Array<{
    id: string
    name?: string
    first_name?: string
    last_name?: string
    email?: string
    avatar?: string
    department?: string
  }>
  categories?: Array<{
    category_id: string
    category_name?: string
    subcategories?: Array<{
      subcategory_id: string
      subcategory_name: string
    }>
  }>
}

export interface FirmHolidayListResponse {
  success: boolean
  message: string
  data: FirmHoliday[]
}

export interface HolidayDetailResponse {
  success: boolean
  message: string
  data: FirmHolidayDetail
}

export interface CreateFirmHolidayRequest {
  holiday_name: string
  holiday_date: string
  holiday_type: 'mandatory' | 'optional' | 'restricted' | 'public_holiday' | string
  applicable_categories_for?: ApplicableCategory[]
  applicable_user?: string[]
}

export interface UpdateFirmHolidayRequest {
  holiday_id: string
  holiday_name: string
  holiday_date: string
  holiday_type: 'mandatory' | 'optional' | 'restricted' | 'public_holiday' | string
  applicable_categories_for?: ApplicableCategory[]
  applicable_user?: string[]
}

