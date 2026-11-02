import * as React from 'react'
import {
  Building2,
  Plus,
  Trash2,
  CalendarDays,
  Search,
  Eye,
  Tag,
  Users,
  Pencil,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { CreateHolidayModal } from './CreateHolidayModal'
import { HolidayDetailsModal } from './HolidayDetailsModal'
import {
  getHolidayId,
  getHolidayName,
  getHolidayRawDate,
  parseHolidayDate,
  getHolidayTypeConfig,
  HOLIDAY_TYPES,
} from '../lib/holidayUtils'
import type {
  FirmHoliday,
  CreateFirmHolidayRequest,
  UpdateFirmHolidayRequest,
} from '../api/holidaysApi.types'

interface FirmHolidaysListProps {
  holidays: FirmHoliday[]
  isLoading: boolean
  canEdit?: boolean
  year: number
  onAddHoliday: (data: CreateFirmHolidayRequest) => Promise<any>
  onUpdateHoliday?: (data: UpdateFirmHolidayRequest) => Promise<any>
  onDeleteHoliday: (id: string) => Promise<any>
  isAddingModalOpen: boolean
  setIsAddingModalOpen: (open: boolean) => void
  initialFormValues?: (FirmHoliday & { name?: string; date?: string; type?: string }) | null
}

export function FirmHolidaysList({
  holidays,
  isLoading,
  canEdit = true,
  year: _year,
  onAddHoliday,
  onUpdateHoliday,
  onDeleteHoliday,
  isAddingModalOpen,
  setIsAddingModalOpen,
  initialFormValues,
}: FirmHolidaysListProps) {
  const [searchQuery, setSearchQuery] = React.useState('')
  const [selectedType, setSelectedType] = React.useState<string>('all')

  // Details Modal State
  const [selectedHolidayForDetails, setSelectedHolidayForDetails] = React.useState<FirmHoliday | null>(null)

  // Edit Modal State
  const [holidayToEdit, setHolidayToEdit] = React.useState<FirmHoliday | null>(null)

  // Delete Confirmation State
  const [holidayToDelete, setHolidayToDelete] = React.useState<FirmHoliday | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const handleConfirmDelete = async () => {
    if (!holidayToDelete) return
    const targetId = getHolidayId(holidayToDelete)
    if (!targetId) return

    try {
      setIsDeleting(true)
      await onDeleteHoliday(targetId)
      setHolidayToDelete(null)
    } catch (err) {
      console.error('Failed to delete holiday:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleOpenAdd = () => {
    setHolidayToEdit(null)
    setIsAddingModalOpen(true)
  }

  const handleOpenEdit = (holiday: FirmHoliday) => {
    setHolidayToEdit(holiday)
    setIsAddingModalOpen(true)
  }

  const filteredHolidays = React.useMemo(() => {
    return holidays.filter((h) => {
      const name = getHolidayName(h)
      const rawDate = getHolidayRawDate(h)
      const matchesSearch =
        name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rawDate.includes(searchQuery)

      if (!matchesSearch) return false

      if (selectedType !== 'all') {
        const hType = (h.holiday_type || h.type || 'mandatory').toLowerCase()
        return hType === selectedType.toLowerCase()
      }
      return true
    })
  }, [holidays, searchQuery, selectedType])

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
      {/* Header Banner */}
      <div className="border-b border-border bg-muted/40 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold tracking-tight text-foreground">
                  Firm Holidays
                </h3>
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-semibold tracking-wider">
                  Active
                </Badge>
              </div>
              <p className="text-[12px] text-muted-foreground">
                Applicable company calendar • ({holidays.length} Total)
              </p>
            </div>
          </div>
          {canEdit && (
            <Button
              onClick={handleOpenAdd}
              size="sm"
              className="btn-3d h-8 gap-1.5 rounded-lg bg-foreground px-3 text-[12.5px] font-medium text-background hover:opacity-90 cursor-pointer"
            >
              <Plus className="size-3.5" />
              Add Holiday
            </Button>
          )}
        </div>

        {/* Search & Type Filter */}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search firm holidays..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8.5 bg-background pl-8 text-[13px]"
            />
          </div>
          <div className="w-44">
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="h-8.5 bg-background text-[12px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="all" className="text-[12px]">
                  All Types
                </SelectItem>
                {HOLIDAY_TYPES.map((t) => (
                  <SelectItem key={t.id} value={t.id} className="text-[12px]">
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Firm Holidays List */}
      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
            <span className="text-[13px]">Loading firm holidays...</span>
          </div>
        ) : filteredHolidays.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-center text-muted-foreground p-6">
            <div className="rounded-full bg-muted/60 p-3">
              <CalendarDays className="size-8 opacity-40" />
            </div>
            <div>
              <p className="text-[13.5px] font-medium text-foreground">No firm holidays configured</p>
              <p className="mt-1 text-[12px] text-muted-foreground max-w-sm">
                You can add public holidays directly from the left panel or click &ldquo;Add Holiday&rdquo; to create custom mandatory, optional, or category-specific holidays.
              </p>
            </div>
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenAdd}
                className="mt-1 h-8 gap-1.5 text-[12px]"
              >
                <Plus className="size-3.5" />
                Add First Holiday
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredHolidays.map((holiday, idx) => {
              const holidayId = getHolidayId(holiday) || `firm-hol-${idx}`
              const holidayName = getHolidayName(holiday)
              const rawDate = getHolidayRawDate(holiday)
              const dt = parseHolidayDate(rawDate)
              const typeConfig = getHolidayTypeConfig(holiday.holiday_type || holiday.type)

              const hasCategories =
                holiday.applicable_categories_for &&
                holiday.applicable_categories_for.length > 0
              const hasUsers =
                holiday.applicable_user && holiday.applicable_user.length > 0

              return (
                <div
                  key={holidayId}
                  onClick={() => setSelectedHolidayForDetails(holiday)}
                  className="group relative flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-background/60 p-3 transition-all hover:border-primary/40 hover:bg-muted/30 cursor-pointer"
                >
                  {/* Left Date Block & Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-muted/60 font-semibold shadow-xs">
                      <span className="text-[9px] uppercase tracking-wider text-primary font-bold">
                        {dt.month}
                      </span>
                      <span className="text-sm leading-none font-bold text-foreground">
                        {dt.day}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="truncate text-[13px] font-medium text-foreground">
                          {holidayName}
                        </h4>
                        <span className={cn('rounded-md border px-1.5 py-0.5 text-[10px] font-medium', typeConfig.tone)}>
                          {typeConfig.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 pt-0.5 text-[11.5px] text-muted-foreground flex-wrap">
                        <span>{dt.weekday ? `${dt.weekday}, ` : ''}{dt.full}</span>
                        {hasCategories && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 gap-0.5 text-muted-foreground">
                            <Tag className="size-2.5" />
                            {holiday.applicable_categories_for?.length} categories
                          </Badge>
                        )}
                        {hasUsers && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 gap-0.5 text-muted-foreground">
                            <Users className="size-2.5" />
                            {holiday.applicable_user?.length} users
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="shrink-0 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedHolidayForDetails(holiday)
                      }}
                      className="grid size-8 cursor-pointer place-items-center rounded-md text-muted-foreground opacity-70 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100"
                      title="View Details"
                    >
                      <Eye className="size-3.5" />
                    </button>

                    {canEdit && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenEdit(holiday)
                        }}
                        className="grid size-8 cursor-pointer place-items-center rounded-md text-muted-foreground opacity-70 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100"
                        title="Edit Holiday"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    )}

                    {canEdit && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setHolidayToDelete(holiday)
                        }}
                        className="grid size-8 cursor-pointer place-items-center rounded-md text-muted-foreground opacity-70 transition-all hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 group-hover:opacity-100"
                        title="Delete holiday"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Holiday Modal */}
      <CreateHolidayModal
        open={isAddingModalOpen}
        onClose={() => {
          setIsAddingModalOpen(false)
          setHolidayToEdit(null)
        }}
        onSubmit={onAddHoliday}
        onUpdate={onUpdateHoliday}
        initialValues={holidayToEdit || initialFormValues}
      />

      {/* Holiday Details Modal */}
      <HolidayDetailsModal
        holidayId={getHolidayId(selectedHolidayForDetails)}
        holidayFallback={selectedHolidayForDetails}
        open={!!selectedHolidayForDetails}
        onClose={() => setSelectedHolidayForDetails(null)}
        onEdit={handleOpenEdit}
        canEdit={canEdit}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!holidayToDelete}
        onOpenChange={(open) => !open && setHolidayToDelete(null)}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Delete Holiday
            </DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-muted-foreground pt-1">
            Are you sure you want to remove{' '}
            <span className="font-semibold text-foreground">
              {getHolidayName(holidayToDelete)}
            </span>
            ? This action cannot be undone.
          </p>
          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setHolidayToDelete(null)}
              className="h-8.5 text-[12.5px]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              className="btn-3d h-8.5 bg-rose-600 hover:bg-rose-700 text-white text-[12.5px] cursor-pointer"
            >
              {isDeleting ? 'Deleting...' : 'Delete Holiday'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
