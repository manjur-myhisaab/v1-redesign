import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Calendar, Loader2, Save, Tag } from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import rdk, { createItem, updateItem, readItems } from '@/services/server'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'

interface HolidaySheetProps {
  open: boolean
  onClose: () => void
  holidayToEdit?: any | null
  categories?: any[]
  onSuccess?: () => void
}

export const HolidayModal: React.FC<HolidaySheetProps> = ({
  open,
  onClose,
  holidayToEdit,
  categories: passedCategories,
  onSuccess,
}) => {
  const queryClient = useQueryClient()
  const isEdit = Boolean(holidayToEdit?.holiday_id || holidayToEdit?.id)
  const holidayId = holidayToEdit?.holiday_id || holidayToEdit?.id

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])

  // Fetch firm employee categories only if not passed from parent
  const { data: fetchedCategories = [] } = useQuery({
    queryKey: ['employeeCategories'],
    queryFn: async () => {
      const res = await rdk.request(
        readItems('employee_category', { fields: ['*'], limit: -1 })
      )
      if (Array.isArray(res)) return res
      if (Array.isArray((res as any)?.data)) return (res as any).data
      return []
    },
    enabled: (!passedCategories || passedCategories.length === 0) && open,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const categories = passedCategories && passedCategories.length > 0 ? passedCategories : fetchedCategories

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm({
    defaultValues: {
      holiday_name: '',
      holiday_date: '',
    },
  })

  useEffect(() => {
    if (holidayToEdit) {
      reset({
        holiday_name: holidayToEdit.holiday_name || '',
        holiday_date: holidayToEdit.holiday_date || '',
      })

      // Extract existing categories
      if (Array.isArray(holidayToEdit.category_ids)) {
        const catIds = holidayToEdit.category_ids
          .map((c: any) => {
            if (typeof c === 'object' && c !== null) {
              if (typeof c.category_id === 'object' && c.category_id !== null) {
                return String(c.category_id.employee_category_id ?? c.category_id.id ?? '')
              }
              return String(c.category_id ?? c.employee_category_id ?? c.id ?? '')
            }
            return String(c ?? '')
          })
          .filter(Boolean)
        setSelectedCategoryIds(catIds)
      } else {
        setSelectedCategoryIds([])
      }
    } else {
      reset({
        holiday_name: '',
        holiday_date: '',
      })
      setSelectedCategoryIds([])
    }
  }, [holidayToEdit, reset, open])

  const toggleCategory = (catId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    )
  }

  const toggleAllCategories = () => {
    if (selectedCategoryIds.length === categories.length) {
      setSelectedCategoryIds([])
    } else {
      setSelectedCategoryIds(
        categories.map((c: any) => String(c.employee_category_id ?? c.id))
      )
    }
  }

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const payload: Record<string, any> = {
        holiday_name: data.holiday_name.trim(),
        holiday_date: data.holiday_date,
        category_ids: selectedCategoryIds.map((cId) => ({
          category_id: parseInt(cId, 10),
        })),
      }

      if (isEdit) {
        return await rdk.request(updateItem('holiday', holidayId, payload))
      } else {
        return await rdk.request(createItem('holiday', payload))
      }
    },
    onSuccess: async () => {
      sound.success()
      toast.success(isEdit ? 'Holiday updated successfully' : 'Holiday added successfully')
      await queryClient.invalidateQueries({ queryKey: ['holidays'] })
      await queryClient.refetchQueries({ queryKey: ['holidays'] })
      onSuccess?.()
      onClose()
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to save holiday')
    },
  })

  const onSubmit = (data: any) => {
    if (!data.holiday_name.trim()) {
      toast.error('Holiday name is required')
      return
    }
    if (!data.holiday_date) {
      toast.error('Holiday date is required')
      return
    }
    mutation.mutate(data)
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="sm:max-w-md w-full flex flex-col p-0 gap-0 overflow-hidden shadow-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full min-h-0">
          {/* Fixed Header */}
          <SheetHeader className="px-6 py-4 border-b border-border shrink-0 bg-background/95 backdrop-blur-xs">
            <SheetTitle className="flex items-center gap-2 text-base font-semibold">
              <Calendar className="size-4.5 text-primary" />
              {isEdit ? 'Edit Holiday' : 'Add New Holiday'}
            </SheetTitle>
          </SheetHeader>

          {/* Scrollable Form Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 min-h-0">
            <div className="space-y-1.5">
              <Label htmlFor="holiday_name" className="text-xs font-medium">
                Holiday Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="holiday_name"
                {...register('holiday_name', { required: true })}
                placeholder="e.g. Independence Day, Diwali, Eid"
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="holiday_date" className="text-xs font-medium">
                Holiday Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="holiday_date"
                type="date"
                {...register('holiday_date', { required: true })}
                className="h-9 text-xs"
              />
            </div>

            {categories.length > 0 && (
              <div className="rounded-lg border border-border p-3.5 space-y-2.5 bg-muted/20">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Tag className="size-3.5 text-primary" />
                    Applicable Categories
                  </Label>
                  <button
                    type="button"
                    onClick={toggleAllCategories}
                    className="text-[11px] text-primary hover:underline cursor-pointer font-medium"
                  >
                    {selectedCategoryIds.length === categories.length ? 'Clear All' : 'Select All'}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {selectedCategoryIds.length === 0
                    ? 'No category selected — will apply to All Staff.'
                    : `${selectedCategoryIds.length} categories selected.`}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs max-h-52 overflow-y-auto pt-1 border-t border-border/60">
                  {categories.map((cat: any) => {
                    const cId = String(cat.employee_category_id ?? cat.id)
                    const name = cat.employee_category_name || cat.category_name || `Category ${cId}`
                    const isChecked = selectedCategoryIds.includes(cId)
                    return (
                      <label
                        key={cId}
                        className={cn(
                          'flex items-center gap-2 p-1.5 rounded-md border cursor-pointer transition-colors',
                          isChecked
                            ? 'border-primary/40 bg-primary/5 text-foreground'
                            : 'border-border bg-background hover:bg-muted/50 text-muted-foreground'
                        )}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleCategory(cId)}
                        />
                        <span className="truncate text-xs font-medium">{name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Fixed Footer */}
          <SheetFooter className="px-6 py-3.5 border-t border-border bg-muted/20 shrink-0 flex flex-row items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={mutation.isPending}
              className="text-xs h-8 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={mutation.isPending || isSubmitting}
              className="text-xs h-8 gap-1.5 cursor-pointer"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="size-3.5" />
                  <span>{isEdit ? 'Update Holiday' : 'Save Holiday'}</span>
                </>
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export default HolidayModal
