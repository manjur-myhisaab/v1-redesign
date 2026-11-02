import {
  CalendarDays,
  Tag,
  Users,
  Loader2,
  Calendar,
  CheckCircle2,
  Layers,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { useHolidayDetailsQuery } from '../hooks/useHolidays'
import { useCategoriesQuery } from '@/features/categories/hooks/useCategories'
import { cn } from '@/lib/utils'
import {
  getHolidayName,
  getHolidayRawDate,
  parseHolidayDate,
  getHolidayTypeConfig,
} from '../lib/holidayUtils'
import { Button } from '@/components/ui/button'
import { Pencil } from 'lucide-react'
import type { FirmHoliday } from '../api/holidaysApi.types'

interface HolidayDetailsModalProps {
  holidayId: string | null
  holidayFallback?: FirmHoliday | null
  open: boolean
  onClose: () => void
  onEdit?: (holiday: FirmHoliday) => void
  canEdit?: boolean
}

export function HolidayDetailsModal({
  holidayId,
  holidayFallback,
  open,
  onClose,
  onEdit,
  canEdit = true,
}: HolidayDetailsModalProps) {
  const { data: detailData, isLoading } = useHolidayDetailsQuery(holidayId || undefined)
  const { data: allCategories = [] } = useCategoriesQuery()

  const holiday = detailData || holidayFallback

  if (!open) return null

  const typeConfig = getHolidayTypeConfig(holiday?.holiday_type || (holiday as any)?.type)

  const holidayName = getHolidayName(holiday)
  const rawDate = getHolidayRawDate(holiday)
  const dt = parseHolidayDate(rawDate)

  // Map category IDs to readable names
  const categoryMap = new Map(
    allCategories.map((c) => [
      c.category_id,
      {
        name: c.category_name,
        subcategories: new Map(
          (c.subcategories || c.subCategoryName || []).map((s) => [
            s.subcategory_id || s.subcategory_name,
            s.subcategory_name,
          ])
        ),
      },
    ])
  )

  const applicableCategories = holiday?.applicable_categories_for || []
  const applicableUsers = holiday?.applicable_user || []

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="flex flex-col max-h-[85vh] sm:max-w-[540px] p-0 overflow-hidden">
        {/* Fixed Header */}
        <DialogHeader className="border-b border-border px-6 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarDays className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Holiday Details
              </DialogTitle>
              <p className="text-[12px] text-muted-foreground">
                View policy scope and assigned applicability
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {isLoading ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="size-6 animate-spin text-primary" />
              <span className="text-[13px]">Fetching holiday details...</span>
            </div>
          ) : !holiday ? (
            <div className="py-8 text-center text-[13px] text-muted-foreground">
              No holiday details found.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Primary Details Card */}
              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">
                      {holidayName}
                    </h3>
                    <div className="mt-1 flex items-center gap-2 text-[13px] text-muted-foreground">
                      <Calendar className="size-4 text-primary" />
                      <span>{dt.weekday ? `${dt.weekday}, ` : ''}{dt.full}</span>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'rounded-md border px-2.5 py-1 text-[11.5px] font-medium tracking-wide uppercase',
                      typeConfig.tone
                    )}
                  >
                    {typeConfig.label}
                  </span>
                </div>

                {holiday.description && (
                  <p className="text-[12.5px] text-muted-foreground border-t border-border/60 pt-2.5">
                    {holiday.description}
                  </p>
                )}
              </div>

              {/* Applicable Categories & Subcategories */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Tag className="size-3.5" />
                  <span>Applicable Categories ({applicableCategories.length})</span>
                </div>

                {applicableCategories.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-3 text-[12.5px] text-muted-foreground bg-muted/10">
                    Applicable to all categories across the firm.
                  </div>
                ) : (
                  <div className="space-y-2 rounded-xl border border-border p-3 bg-card">
                    {applicableCategories.map((item, idx) => {
                      const catInfo = categoryMap.get(item.category_id)
                      const categoryName = catInfo?.name || `Category ${item.category_id.slice(0, 8)}`

                      return (
                        <div
                          key={idx}
                          className="rounded-lg border border-border/80 bg-background/50 p-2.5 text-[12.5px]"
                        >
                          <div className="font-medium text-foreground flex items-center gap-1.5">
                            <Layers className="size-3.5 text-primary" />
                            <span>{categoryName}</span>
                          </div>

                          {item.sub_category_id && item.sub_category_id.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5 pl-5">
                              {item.sub_category_id.map((subId) => {
                                const subName =
                                  catInfo?.subcategories.get(subId) || `Sub: ${subId.slice(0, 8)}`
                                return (
                                  <Badge
                                    key={subId}
                                    variant="secondary"
                                    className="text-[11px] font-normal"
                                  >
                                    {subName}
                                  </Badge>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Applicable Users */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Users className="size-3.5" />
                  <span>Assigned Employees ({applicableUsers.length})</span>
                </div>

                {applicableUsers.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-3 text-[12.5px] text-muted-foreground bg-muted/10">
                    Applicable to all firm members.
                  </div>
                ) : (
                  <div className="max-h-36 overflow-y-auto rounded-xl border border-border p-2 space-y-1 bg-card">
                    {applicableUsers.map((uid, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-md bg-muted/40 px-2.5 py-1.5 text-[12px]"
                      >
                        <span className="font-mono text-muted-foreground">{uid}</span>
                        <CheckCircle2 className="size-3.5 text-emerald-500" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Fixed Footer */}
        <DialogFooter className="border-t border-border bg-muted/20 px-6 py-3.5 shrink-0 flex items-center justify-between">
          <div className="text-[11px] text-muted-foreground">
            {holiday?.created_at && (
              <span>Created: {new Date(holiday.created_at).toLocaleDateString()}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {canEdit && onEdit && holiday && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose()
                  onEdit(holiday)
                }}
                className="h-8 gap-1.5 text-[12px] cursor-pointer"
              >
                <Pencil className="size-3.5" />
                Edit
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={onClose}
              className="h-8 text-[12px] cursor-pointer"
            >
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
