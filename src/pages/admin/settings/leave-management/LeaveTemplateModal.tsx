import React, { useState, useEffect } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  CalendarCheck,
  Plus,
  Trash2,
  Save,
  Loader2,
  X,
  Info,
} from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import rdk, { createItem, updateItem } from '@/services/server'
import { sound } from '@/lib/sound'
import { useAuth } from '@/context/auth/AuthContext'

export const ALL_LEAVE_TYPES = [
  { label: 'Casual Leave', value: 'casual' },
  { label: 'Sick Leave', value: 'sick' },
  { label: 'Earned / Privilege Leave', value: 'earned' },
  { label: 'Maternity Leave', value: 'maternity' },
  { label: 'Paternity Leave', value: 'paternity' },
  { label: 'Emergency Leave', value: 'emergency' },
  { label: 'Half Day Leave', value: 'half_day' },
]

export const LEAVE_TYPE_LABEL_MAP: Record<string, string> = {
  casual: 'Casual',
  sick: 'Sick',
  earned: 'Earned',
  maternity: 'Maternity',
  paternity: 'Paternity',
  emergency: 'Emergency',
  half_day: 'Half Day',
}

interface LeaveApplicableItem {
  leave_type: string
  leave_balance: string
  leave_add_system: string
  required_working_days?: string
  number_of_leave_to_be_added?: string
}

interface LeaveTemplateFormValues {
  leave_template_name: string
  leaves_applicable: LeaveApplicableItem[]
}

interface LeaveTemplateModalProps {
  open: boolean
  onClose: () => void
  templateToEdit?: any | null
  onSuccess?: () => void
}

export const LeaveTemplateModal: React.FC<LeaveTemplateModalProps> = ({
  open,
  onClose,
  templateToEdit,
  onSuccess,
}) => {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const isEdit = Boolean(templateToEdit)

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LeaveTemplateFormValues>({
    defaultValues: {
      leave_template_name: '',
      leaves_applicable: [
        {
          leave_type: 'casual',
          leave_balance: '12',
          leave_add_system: 'fixed',
          number_of_leave_to_be_added: '1',
          required_working_days: '0',
        },
      ],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'leaves_applicable',
  })

  const currentLeaves = watch('leaves_applicable') || []
  const canAddMore = currentLeaves.length < ALL_LEAVE_TYPES.length

  useEffect(() => {
    if (templateToEdit) {
      const existingLeaves = Array.isArray(templateToEdit.leaves_applicable)
        ? templateToEdit.leaves_applicable.map((l: any) => ({
            leave_type: l.leave_type || 'casual',
            leave_balance: String(l.leave_balance ?? '12'),
            leave_add_system: l.leave_add_system || 'fixed',
            number_of_leave_to_be_added: String(l.number_of_leave_to_be_added ?? '1'),
            required_working_days: String(l.required_working_days ?? '0'),
          }))
        : [
            {
              leave_type: 'casual',
              leave_balance: '12',
              leave_add_system: 'fixed',
              number_of_leave_to_be_added: '1',
              required_working_days: '0',
            },
          ]

      reset({
        leave_template_name: templateToEdit.leave_template_name || '',
        leaves_applicable: existingLeaves,
      })
    } else {
      reset({
        leave_template_name: '',
        leaves_applicable: [
          {
            leave_type: 'casual',
            leave_balance: '12',
            leave_add_system: 'fixed',
            number_of_leave_to_be_added: '1',
            required_working_days: '0',
          },
        ],
      })
    }
  }, [templateToEdit, reset])

  const handleAddLeaveType = () => {
    const selectedTypes = currentLeaves.map((l) => l?.leave_type)
    const nextAvailable = ALL_LEAVE_TYPES.find((opt) => !selectedTypes.includes(opt.value))

    if (nextAvailable) {
      append({
        leave_type: nextAvailable.value,
        leave_balance: '12',
        leave_add_system: 'fixed',
        number_of_leave_to_be_added: '1',
        required_working_days: '0',
      })
    }
  }

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      const templateId = templateToEdit?.leave_template_id || templateToEdit?.id
      if (isEdit && templateId) {
        return await rdk.request(updateItem('leave_templates', templateId, payload))
      } else {
        return await rdk.request(createItem('leave_templates', payload))
      }
    },
    onSuccess: () => {
      sound.success()
      toast.success(isEdit ? 'Leave template updated' : 'Leave template created')
      queryClient.invalidateQueries({ queryKey: ['leave_templates'] })
      queryClient.invalidateQueries({ queryKey: ['leave_template'] })
      if (onSuccess) onSuccess()
      onClose()
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to save leave template')
    },
  })

  const onSubmit = (formData: LeaveTemplateFormValues) => {
    if (!formData.leave_template_name.trim()) {
      toast.error('Template name is required')
      return
    }

    if (!formData.leaves_applicable || formData.leaves_applicable.length === 0) {
      toast.error('Please configure at least one leave type')
      return
    }

    const firmId = user?.firm_id?.id || user?.firm_id?.firm_id || user?.firm_id || 8

    const payload: any = {
      leave_template_name: formData.leave_template_name.trim(),
      leaves_applicable: formData.leaves_applicable.map((leave) => {
        const item: any = {
          leave_type: leave.leave_type,
          leave_balance: String(leave.leave_balance ?? '0'),
          leave_add_system: leave.leave_add_system || 'fixed',
        }
        if (leave.number_of_leave_to_be_added !== undefined) {
          item.number_of_leave_to_be_added = String(leave.number_of_leave_to_be_added)
        }
        if (leave.leave_add_system === 'monthly' || leave.required_working_days) {
          item.required_working_days = String(leave.required_working_days || '0')
        }
        return item
      }),
      status: 'published',
    }

    if (!isEdit) {
      payload.firm_id = firmId
    }

    mutation.mutate(payload)
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl p-0 flex flex-col h-full bg-background border-l border-border shadow-2xl"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full min-h-0">
          {/* Fixed Header */}
          <SheetHeader className="px-6 py-4 border-b border-border bg-card/60 shrink-0">
            <div className="flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                <CalendarCheck className="size-4" />
              </div>
              <div>
                <SheetTitle className="text-base font-semibold text-foreground">
                  {isEdit
                    ? `Edit Template: ${templateToEdit?.leave_template_name}`
                    : 'Create New Leave Template'}
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                  Define annual quotas, accrual intervals, and required working days per leave category.
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {/* Scrollable Form Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {/* Template Name */}
            <div className="space-y-1.5 rounded-xl border border-border bg-card p-4 shadow-2xs">
              <Label htmlFor="leave_template_name" className="text-xs font-semibold text-foreground">
                Template Name *
              </Label>
              <Input
                id="leave_template_name"
                placeholder="e.g. Standard Executive Policy, 6 Month Leave"
                {...register('leave_template_name', { required: 'Template name is required' })}
                className="h-9 text-xs"
              />
              {errors.leave_template_name && (
                <p className="text-[11px] text-destructive font-medium">
                  {errors.leave_template_name.message}
                </p>
              )}
            </div>

            {/* Leaves Applicable Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Leaves Applicable</h3>
                  <p className="text-xs text-muted-foreground">
                    Assign entitlement balances and accrual systems for each leave type
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddLeaveType}
                  disabled={!canAddMore}
                  className="h-8 gap-1.5 text-xs font-semibold cursor-pointer shadow-2xs"
                >
                  <Plus className="size-3.5" />
                  <span>Add Leave Type</span>
                </Button>
              </div>

              {/* Dynamic Leave Cards */}
              <div className="space-y-3.5">
                {fields.map((field, index) => {
                  const currentType = watch(`leaves_applicable.${index}.leave_type`)
                  const addSystem = watch(`leaves_applicable.${index}.leave_add_system`) || 'fixed'

                  const selectedInOtherRows = currentLeaves
                    .filter((_, idx) => idx !== index)
                    .map((item) => item?.leave_type)
                    .filter(Boolean)

                  const availableTypeOptions = ALL_LEAVE_TYPES.filter(
                    (opt) => opt.value === currentType || !selectedInOtherRows.includes(opt.value)
                  )

                  return (
                    <div
                      key={field.id}
                      className="rounded-xl border border-border bg-card p-4 shadow-2xs space-y-3.5 transition-all hover:border-border/80"
                    >
                      <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground">
                            Rule #{index + 1}:
                          </span>
                          <Badge variant="outline" className="text-[11px] capitalize font-medium">
                            {LEAVE_TYPE_LABEL_MAP[currentType] || currentType}
                          </Badge>
                        </div>
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(index)}
                            className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 cursor-pointer"
                          >
                            <Trash2 className="size-3.5 mr-1" />
                            Remove
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {/* Leave Type */}
                        <div className="space-y-1">
                          <Label className="text-[11px] font-medium text-muted-foreground">
                            Leave Type
                          </Label>
                          <Controller
                            name={`leaves_applicable.${index}.leave_type`}
                            control={control}
                            rules={{ required: true }}
                            render={({ field }) => (
                              <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger className="h-8 text-xs bg-background">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableTypeOptions.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>

                        {/* Leave Balance */}
                        <div className="space-y-1">
                          <Label className="text-[11px] font-medium text-muted-foreground">
                            Leave Balance (Days)
                          </Label>
                          <Input
                            type="number"
                            step="0.5"
                            min="0"
                            placeholder="e.g. 12"
                            {...register(`leaves_applicable.${index}.leave_balance`, {
                              required: true,
                            })}
                            className="h-8 text-xs bg-background"
                          />
                        </div>

                        {/* Auto Add System */}
                        <div className="space-y-1">
                          <Label className="text-[11px] font-medium text-muted-foreground">
                            Accrual / Auto Add System
                          </Label>
                          <Controller
                            name={`leaves_applicable.${index}.leave_add_system`}
                            control={control}
                            render={({ field }) => (
                              <Select value={field.value || 'fixed'} onValueChange={field.onChange}>
                                <SelectTrigger className="h-8 text-xs bg-background">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="fixed">Fixed</SelectItem>
                                  <SelectItem value="monthly">Monthly</SelectItem>
                                  <SelectItem value="yearly">Yearly</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>

                        {/* Required Working Days (for monthly) */}
                        {addSystem === 'monthly' && (
                          <>
                            <div className="space-y-1">
                              <Label className="text-[11px] font-medium text-muted-foreground">
                                Required Working Days (Monthly)
                              </Label>
                              <Input
                                type="number"
                                min="0"
                                max="31"
                                placeholder="e.g. 20"
                                {...register(`leaves_applicable.${index}.required_working_days`)}
                                className="h-8 text-xs bg-background"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px] font-medium text-muted-foreground">
                                Leaves Added per Month
                              </Label>
                              <Input
                                type="number"
                                step="0.5"
                                min="0.1"
                                placeholder="e.g. 1"
                                {...register(
                                  `leaves_applicable.${index}.number_of_leave_to_be_added`
                                )}
                                className="h-8 text-xs bg-background"
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Fixed Footer with Side-by-Side Buttons */}
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
              className="text-xs h-8 gap-1.5 cursor-pointer font-semibold shadow-xs"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="size-3.5" />
                  <span>{isEdit ? 'Save Changes' : 'Create Template'}</span>
                </>
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export default LeaveTemplateModal
