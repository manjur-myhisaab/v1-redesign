import * as React from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PublicHolidaysList } from './PublicHolidaysList'
import { FirmHolidaysList } from './FirmHolidaysList'
import {
  usePublicHolidaysQuery,
  useFirmHolidaysQuery,
  useCreateFirmHolidayMutation,
  useCreateBulkFirmHolidaysMutation,
  useUpdateFirmHolidayMutation,
  useDeleteFirmHolidayMutation,
} from '../hooks/useHolidays'
import {
  getHolidayName,
  getHolidayRawDate,
  parseHolidayDate,
} from '../lib/holidayUtils'
import type {
  PublicHoliday,
  CreateFirmHolidayRequest,
  UpdateFirmHolidayRequest,
} from '../api/holidaysApi.types'

interface HolidaysSettingsProps {
  canEdit?: boolean
}

export default function HolidaysSettings({ canEdit = true }: HolidaysSettingsProps) {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = React.useState<number>(currentYear)

  // React queries
  const { data: publicData, isLoading: publicLoading } = usePublicHolidaysQuery(selectedYear)
  const { data: firmHolidays = [], isLoading: firmLoading } = useFirmHolidaysQuery(selectedYear)

  // Mutations
  const createMutation = useCreateFirmHolidayMutation()
  const createBulkMutation = useCreateBulkFirmHolidaysMutation()
  const updateMutation = useUpdateFirmHolidayMutation()
  const deleteMutation = useDeleteFirmHolidayMutation()

  // Modal control
  const [isAddingModalOpen, setIsAddingModalOpen] = React.useState(false)
  const [prefillData, setPrefillData] = React.useState<{
    name: string
    date: string
    type: string
  } | null>(null)

  // Check if a holiday is already registered in the firm list
  const isAlreadyAdded = React.useCallback(
    (name: string, date: string) => {
      const targetDateYmd = parseHolidayDate(date).ymd
      const targetName = name.toLowerCase().trim()

      return firmHolidays.some((fh) => {
        const fhName = getHolidayName(fh).toLowerCase().trim()
        const fhDateYmd = parseHolidayDate(getHolidayRawDate(fh)).ymd
        return (
          (fhDateYmd && targetDateYmd && fhDateYmd === targetDateYmd) ||
          fhName === targetName
        )
      })
    },
    [firmHolidays]
  )

  // Quick prefill from public list into create modal
  const handleAddPublicToFirm = (publicHoliday: PublicHoliday) => {
    const rawDate = getHolidayRawDate(publicHoliday)
    const parsed = parseHolidayDate(rawDate)
    const rawType = publicHoliday.holiday_type || (publicHoliday as any).type || 'PUBLIC_HOLIDAY'
    setPrefillData({
      name: getHolidayName(publicHoliday),
      date: parsed.ymd || rawDate,
      type: rawType.toUpperCase().includes('PUBLIC') ? 'PUBLIC_HOLIDAY' : rawType,
    })
    setIsAddingModalOpen(true)
  }

  // Bulk add public holidays directly to firm
  const handleBulkAddPublicToFirm = async (selectedList: PublicHoliday[]) => {
    const payload: CreateFirmHolidayRequest[] = selectedList.map((ph) => {
      const rawDate = getHolidayRawDate(ph)
      const parsed = parseHolidayDate(rawDate)
      const rawType = ph.holiday_type || (ph as any).type || 'PUBLIC_HOLIDAY'
      const holidayType = String(rawType).toUpperCase().includes('PUBLIC') ? 'PUBLIC_HOLIDAY' : rawType
      return {
        holiday_name: getHolidayName(ph),
        holiday_date: parsed.ymd || rawDate,
        holiday_type: holidayType,
        applicable_categories_for: [],
        applicable_user: [],
      }
    })
    return createBulkMutation.mutateAsync(payload)
  }

  const handleCreateFirmHoliday = async (data: CreateFirmHolidayRequest) => {
    return createMutation.mutateAsync(data)
  }

  const handleUpdateFirmHoliday = async (data: UpdateFirmHolidayRequest) => {
    return updateMutation.mutateAsync(data)
  }

  const handleDeleteFirmHoliday = async (id: string) => {
    return deleteMutation.mutateAsync(id)
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-hidden h-[calc(100vh-140px)] min-h-[600px]">
      {/* Top Bar with Year Selector and Info Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setSelectedYear((y) => y - 1)}
              title="Previous Year"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="px-2 text-sm font-semibold tracking-tight text-foreground">
              {selectedYear}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setSelectedYear((y) => y + 1)}
              title="Next Year"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[12.5px] text-muted-foreground">
            <Info className="size-3.5 text-primary" />
            <span>
              Attendance, leaves, and payroll automatically account for active firm holidays.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-[11.5px] font-medium text-muted-foreground">
            <span className="size-2 rounded-full bg-primary" />
            <span>Public: {publicData?.holidays?.length || 0}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-[11.5px] font-medium text-muted-foreground">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span>Firm: {firmHolidays.length}</span>
          </div>
        </div>
      </div>

      {/* Main 2-Column Split Grid */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Left Side: All Public Holidays */}
        <PublicHolidaysList
          data={publicData ?? null}
          isLoading={publicLoading}
          onAddHolidayToFirm={canEdit ? handleAddPublicToFirm : undefined}
          onBulkAddHolidays={canEdit ? handleBulkAddPublicToFirm : undefined}
          isBulkAdding={createBulkMutation.isPending}
          isAlreadyAdded={isAlreadyAdded}
        />

        {/* Right Side: Firm Holidays */}
        <FirmHolidaysList
          holidays={firmHolidays}
          isLoading={firmLoading}
          canEdit={canEdit}
          year={selectedYear}
          onAddHoliday={handleCreateFirmHoliday}
          onUpdateHoliday={handleUpdateFirmHoliday}
          onDeleteHoliday={handleDeleteFirmHoliday}
          isAddingModalOpen={isAddingModalOpen}
          setIsAddingModalOpen={(open) => {
            setIsAddingModalOpen(open)
            if (!open) setPrefillData(null)
          }}
          initialFormValues={prefillData}
        />
      </div>
    </div>
  )
}
