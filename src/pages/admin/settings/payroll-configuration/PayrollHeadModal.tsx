import React, { useEffect, useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  CreditCard,
  Loader2,
  Save,
  TrendingUp,
  TrendingDown,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  Percent,
  IndianRupee,
  Clock,
  ShieldAlert,
} from 'lucide-react'

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

interface PayrollHeadSheetProps {
  open: boolean
  onClose: () => void
  type?: 'benefit' | 'deduction'
  headToEdit?: any | null
  allHeads?: any[]
  onSuccess?: () => void
}

interface PayrollHeadFormValues {
  payroll_type: 'benefit' | 'deduction'
  payroll_head_name: string
  payroll_value_type: 'fixed' | 'percentage'
  payroll_value: string | number
  payroll_head_attn: 'on_attendance' | 'flat_rate'
  payroll_head_max_limit: string | number
}

const MONTH_CHOICES = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
]

// System heads exactly matching v1
const HARDCODED_SYSTEM_HEADS = [
  {
    value: 'Basic Salary',
    label: 'Basic Salary',
    helpText: 'System calculated Basic Salary',
  },
  {
    value: 'Monthly CTC',
    label: 'Monthly CTC',
    helpText: 'System calculated Cost To Company',
  },
  {
    value: 'Overtime',
    label: 'Overtime',
    helpText: 'System calculated Overtime Pay',
  },
]

const YEARS = [2024, 2025, 2026, 2027, 2028]

export const PayrollHeadModal: React.FC<PayrollHeadSheetProps> = ({
  open,
  onClose,
  type = 'benefit',
  headToEdit,
  allHeads,
  onSuccess,
}) => {
  const queryClient = useQueryClient()
  const isEditMode = Boolean(headToEdit?.payroll_head_id || headToEdit?.id)
  const headId = headToEdit?.payroll_head_id || headToEdit?.id

  // Fallback query for linking other heads only if allHeads was not passed from parent
  const { data: payrollHeadsApi = [], isLoading: loadingHeads } = useQuery({
    queryKey: ['all-payroll-heads'],
    queryFn: async () => {
      const res = await rdk.request(
        readItems('payroll_heads', { fields: ['*'], limit: -1 }),
      )
      if (Array.isArray(res)) return res
      if (Array.isArray((res as any)?.data)) return (res as any).data
      return []
    },
    enabled: (!allHeads || allHeads.length === 0) && open,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const customHeadChoices = useMemo(() => {
    const list = allHeads && allHeads.length > 0 ? allHeads : payrollHeadsApi
    return list
      .filter(
        (head: any) =>
          String(head.payroll_head_id ?? head.id) !== String(headId),
      )
      .map((head: any) => ({
        value: String(head.payroll_head_id ?? head.id),
        label: head.payroll_head_name,
        helpText: `Type: ${head.payroll_value_type === 'fixed' ? 'Fixed' : 'Percentage'}`,
      }))
  }, [allHeads, payrollHeadsApi, headId])

  // UI state (matching v1)
  const [selectedYear, setSelectedYear] = useState<string>(
    new Date().getFullYear().toString(),
  )
  const [selectedMonths, setSelectedMonths] = useState<string[]>([])
  const [selectedSystemHeads, setSelectedSystemHeads] = useState<string[]>([])
  const [selectedCustomHeads, setSelectedCustomHeads] = useState<string[]>([])
  const [openApplicableHeads, setOpenApplicableHeads] = useState(false)
  const [openMonths, setOpenMonths] = useState(false)

  // React Hook Form with single robust payroll_value field
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { isSubmitting },
  } = useForm<PayrollHeadFormValues>({
    defaultValues: {
      payroll_type: type,
      payroll_head_name: '',
      payroll_value_type: 'fixed',
      payroll_value: '',
      payroll_head_attn: 'on_attendance',
      payroll_head_max_limit: '',
    },
  })

  const entryType = watch('payroll_type')
  const valueType = watch('payroll_value_type')
  const attnType = watch('payroll_head_attn')

  // 3. Initialization Logic matching v1 exactly
  useEffect(() => {
    const sourceData = headToEdit

    if (sourceData) {
      setValue('payroll_type', sourceData.payroll_type || type)
      setValue('payroll_head_name', sourceData.payroll_head_name || '')
      setValue('payroll_value_type', sourceData.payroll_value_type || 'fixed')
      setValue(
        'payroll_value',
        sourceData.payroll_value !== null &&
          sourceData.payroll_value !== undefined
          ? String(sourceData.payroll_value)
          : '',
      )
      setValue(
        'payroll_head_attn',
        sourceData.payroll_head_attn || 'on_attendance',
      )
      setValue(
        'payroll_head_max_limit',
        sourceData.payroll_head_max_limit !== null &&
          sourceData.payroll_head_max_limit !== undefined
          ? String(sourceData.payroll_head_max_limit)
          : '',
      )

      // Applicable months
      if (sourceData.applicable_months?.length > 0) {
        setSelectedMonths(
          sourceData.applicable_months.map((m: any) => String(m.month || m)),
        )
        if (sourceData.applicable_months[0]?.year) {
          setSelectedYear(String(sourceData.applicable_months[0].year))
        }
      } else {
        setSelectedMonths([])
      }

      // System heads
      const sysHeads =
        sourceData.value_based_on_2
          ?.map((item: any) => item.head_name)
          .filter(Boolean) || []
      setSelectedSystemHeads(sysHeads)

      // Custom heads
      const customHeads =
        sourceData.value_based_on
          ?.map((item: any) => {
            const ref =
              item.related_payroll_heads_payroll_head_id?.payroll_head_id ??
              item.related_payroll_heads_payroll_head_id ??
              item.id
            return ref ? String(ref) : null
          })
          .filter(Boolean) || []
      setSelectedCustomHeads(customHeads)
    } else {
      // Add mode defaults matching v1
      reset({
        payroll_type: type,
        payroll_head_name: '',
        payroll_value_type: 'fixed',
        payroll_value: '',
        payroll_head_attn: 'on_attendance',
        payroll_head_max_limit: '',
      })
      setSelectedMonths([])
      setSelectedYear(new Date().getFullYear().toString())
      setSelectedSystemHeads([])
      setSelectedCustomHeads([])
    }
  }, [headToEdit, type, setValue, reset])

  // Helper toggle functions
  const toggleSystemHead = (headName: string) => {
    setSelectedSystemHeads((prev) =>
      prev.includes(headName)
        ? prev.filter((h) => h !== headName)
        : [...prev, headName],
    )
  }

  const toggleCustomHead = (headIdVal: string) => {
    setSelectedCustomHeads((prev) =>
      prev.includes(headIdVal)
        ? prev.filter((id) => id !== headIdVal)
        : [...prev, headIdVal],
    )
  }

  const toggleMonth = (mVal: string) => {
    setSelectedMonths((prev) =>
      prev.includes(mVal) ? prev.filter((m) => m !== mVal) : [...prev, mVal],
    )
  }

  const toggleAllMonths = () => {
    if (selectedMonths.length === MONTH_CHOICES.length) {
      setSelectedMonths([])
    } else {
      setSelectedMonths(MONTH_CHOICES.map((m) => m.value))
    }
  }

  // 4. Mutation matching v1 logic exactly
  const addOrEditMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (isEditMode) {
        return await rdk.request(updateItem('payroll_heads', headId, payload))
      } else {
        return await rdk.request(createItem('payroll_heads', payload))
      }
    },
    onSuccess: async (_savedItem, payload) => {
      sound.success()
      toast.success(
        isEditMode
          ? `${entryType === 'benefit' ? 'Benefit' : 'Deduction'} updated successfully`
          : `${entryType === 'benefit' ? 'Benefit' : 'Deduction'} created successfully`,
      )

      // Instantly update parent table queries in React Query cache so the frontend reflects changes immediately
      if (isEditMode) {
        const patchItem = (item: any) => {
          if (String(item.payroll_head_id ?? item.id) === String(headId)) {
            return {
              ...item,
              ...payload,
              payroll_value: Number(payload.payroll_value),
              value_based_on_2: payload.value_based_on_2 || [],
              value_based_on: (payload.value_based_on || []).map((v: any) => {
                const matched = (allHeads || []).find(
                  (h: any) =>
                    String(h.payroll_head_id ?? h.id) ===
                    String(v.related_payroll_heads_payroll_head_id),
                )
                return {
                  ...v,
                  related_payroll_heads_payroll_head_id: matched || {
                    payroll_head_id: v.related_payroll_heads_payroll_head_id,
                  },
                }
              }),
              applicable_months: payload.applicable_months || [],
            }
          }
          return item
        }

        queryClient.setQueryData(['payroll-benifits'], (old: any) =>
          Array.isArray(old) ? old.map(patchItem) : old,
        )
        queryClient.setQueryData(['payroll-deductions'], (old: any) =>
          Array.isArray(old) ? old.map(patchItem) : old,
        )
      }

      // Remove single head queries from cache to guarantee fresh state
      queryClient.removeQueries({ queryKey: ['payroll-head'] })

      // Background re-sync with Directus
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['payroll-benifits'] }),
        queryClient.invalidateQueries({ queryKey: ['payroll-deductions'] }),
      ])

      onSuccess?.()
      onClose()
    },
    onError: (error: any) => {
      console.error('Failed to save payroll head:', error)
      toast.error(error?.message || 'Failed to save payroll head.')
    },
  })

  // 5. Submit Handler matching v1 logic exactly
  const onSubmit = (data: PayrollHeadFormValues) => {
    if (!data.payroll_head_name || !data.payroll_head_name.trim()) {
      toast.error('Component name is required')
      return
    }

    if (
      data.payroll_value === '' ||
      data.payroll_value === undefined ||
      data.payroll_value === null ||
      isNaN(Number(data.payroll_value))
    ) {
      toast.error(
        data.payroll_value_type === 'fixed'
          ? 'Please enter a valid fixed amount'
          : 'Please enter a valid percentage',
      )
      return
    }

    const payload: Record<string, any> = {
      payroll_type: data.payroll_type,
      payroll_head_name: data.payroll_head_name.trim(),
      payroll_value_type: data.payroll_value_type,
      payroll_head_attn: data.payroll_head_attn || 'on_attendance',
      payroll_value: Number(data.payroll_value),
      payroll_head_max_limit:
        data.payroll_type === 'deduction' &&
        data.payroll_head_max_limit !== '' &&
        data.payroll_head_max_limit !== null &&
        data.payroll_head_max_limit !== undefined
          ? Number(data.payroll_head_max_limit)
          : null,
      applicable_months:
        selectedMonths.length > 0
          ? selectedMonths.map((m) => ({
              month: Number(m),
              year: Number(selectedYear),
            }))
          : [],
      value_based_on_2:
        data.payroll_value_type === 'percentage'
          ? selectedSystemHeads.map((name) => ({ head_name: name }))
          : null,
      value_based_on:
        data.payroll_value_type === 'percentage'
          ? selectedCustomHeads.map((id) => ({
              related_payroll_heads_payroll_head_id: Number(id),
            }))
          : null,
    }

    addOrEditMutation.mutate(payload)
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="sm:max-w-xl md:max-w-2xl w-full flex flex-col p-0 gap-0 overflow-hidden shadow-2xl"
      >
        <form
          onSubmit={handleSubmit(onSubmit, (errors) => {
            console.error('Validation errors:', errors)
            const firstKey = Object.keys(errors)[0]
            const err = (errors as any)[firstKey]
            toast.error(err?.message || `Please check ${firstKey}`)
          })}
          className="flex flex-col h-full min-h-0"
        >
          {/* Fixed Header */}
          <SheetHeader className="px-6 py-4 border-b border-border shrink-0 bg-background/95 backdrop-blur-xs">
            <SheetTitle className="flex items-center gap-2 text-base font-semibold">
              <CreditCard className="size-4.5 text-primary" />
              {isEditMode
                ? `Edit ${entryType === 'benefit' ? 'Benefit' : 'Deduction'}`
                : `Add New ${entryType === 'benefit' ? 'Benefit' : 'Deduction'}`}
            </SheetTitle>
          </SheetHeader>

          {/* Scrollable Form Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 min-h-0">
            {/* 1. Entry Type Switcher */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Entry Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setValue('payroll_type', 'benefit')}
                  className={cn(
                    'flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-semibold cursor-pointer transition-all',
                    entryType === 'benefit'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 shadow-2xs'
                      : 'border-border bg-background hover:bg-muted text-muted-foreground',
                  )}
                >
                  <TrendingUp className="size-3.5" />
                  <span>Benefit / Earning</span>
                </button>

                <button
                  type="button"
                  onClick={() => setValue('payroll_type', 'deduction')}
                  className={cn(
                    'flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-semibold cursor-pointer transition-all',
                    entryType === 'deduction'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400 shadow-2xs'
                      : 'border-border bg-background hover:bg-muted text-muted-foreground',
                  )}
                >
                  <TrendingDown className="size-3.5" />
                  <span>Deduction</span>
                </button>
              </div>
            </div>

            {/* 2. Head / Component Name */}
            <div className="space-y-1.5">
              <Label
                htmlFor="payroll_head_name"
                className="text-xs font-medium"
              >
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="payroll_head_name"
                {...register('payroll_head_name', {
                  required: 'Name is required',
                })}
                placeholder={
                  entryType === 'benefit'
                    ? 'e.g. House Rent Allowance (HRA), Dearness Allowance (DA)'
                    : 'e.g. Provident Fund (PF), Professional Tax (PT), TDS'
                }
                className="h-9 text-xs"
              />
            </div>

            {/* 3. Value Type & Unified Input */}
            <div className="space-y-3 rounded-lg border border-border/80 bg-muted/15 p-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Value Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setValue('payroll_value_type', 'fixed')}
                    className={cn(
                      'flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-semibold cursor-pointer transition-all',
                      valueType === 'fixed'
                        ? 'border-primary bg-primary/10 text-primary shadow-2xs'
                        : 'border-border bg-background hover:bg-muted text-muted-foreground',
                    )}
                  >
                    <IndianRupee className="size-3.5" />
                    <span>Fixed Amount</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setValue('payroll_value_type', 'percentage')}
                    className={cn(
                      'flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-semibold cursor-pointer transition-all',
                      valueType === 'percentage'
                        ? 'border-primary bg-primary/10 text-primary shadow-2xs'
                        : 'border-border bg-background hover:bg-muted text-muted-foreground',
                    )}
                  >
                    <Percent className="size-3.5" />
                    <span>Percentage</span>
                  </button>
                </div>
              </div>

              {/* Amount / Rate Input */}
              <div className="space-y-1.5 pt-1">
                <Label htmlFor="payroll_value" className="text-xs font-medium">
                  {valueType === 'fixed' ? 'Amount (₹) *' : 'Percentage (%) *'}
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                    {valueType === 'fixed' ? '₹' : '%'}
                  </span>
                  <Input
                    id="payroll_value"
                    type="number"
                    step="any"
                    placeholder={
                      valueType === 'fixed' ? 'e.g. 5000' : 'e.g. 12'
                    }
                    {...register('payroll_value', {
                      required: 'Please enter value',
                    })}
                    className="h-9 pl-7 text-xs bg-background"
                  />
                </div>
              </div>

              {/* Maximum Deduction Limit (Only for deductions matching v1) */}
              {entryType === 'deduction' && (
                <div className="space-y-1.5 pt-2 border-t border-border/60">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="max_limit"
                      className="text-xs font-medium flex items-center gap-1.5"
                    >
                      <ShieldAlert className="size-3.5 text-amber-600" />
                      Maximum Deduction Amount in Rs.
                    </Label>
                    <span className="text-[11px] text-muted-foreground">
                      Optional Cap
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                      ₹
                    </span>
                    <Input
                      id="max_limit"
                      type="number"
                      step="any"
                      placeholder="Enter maximum deduction amount"
                      {...register('payroll_head_max_limit')}
                      className="h-8.5 pl-7 text-xs bg-background"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 4. Percentage Logic (Calculate Based On) */}
            {valueType === 'percentage' && (
              <div className="space-y-3 rounded-lg border border-border p-4 bg-muted/10">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Layers className="size-3.5 text-primary" />
                    Calculate Based On (System)
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Select system-calculated components to base this percentage
                    on.
                  </p>
                </div>

                {/* System Heads */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  {HARDCODED_SYSTEM_HEADS.map((sh) => {
                    const isChecked = selectedSystemHeads.includes(sh.value)
                    return (
                      <label
                        key={sh.value}
                        className={cn(
                          'flex flex-col p-2.5 rounded-md border cursor-pointer transition-all',
                          isChecked
                            ? 'border-primary/50 bg-primary/5 text-foreground shadow-2xs'
                            : 'border-border bg-background hover:bg-muted/50 text-muted-foreground',
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => toggleSystemHead(sh.value)}
                          />
                          <span className="text-xs font-semibold">
                            {sh.label}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-0.5 ml-6">
                          {sh.helpText}
                        </span>
                      </label>
                    )
                  })}
                </div>

                {/* Link Other Custom Heads (Collapsible matching v1) */}
                <div className="rounded-lg border border-border overflow-hidden bg-background">
                  <button
                    type="button"
                    onClick={() => setOpenApplicableHeads((v) => !v)}
                    className="flex w-full items-center justify-between p-3 text-xs font-medium bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <span>Link Other Heads ({selectedCustomHeads.length})</span>
                    {openApplicableHeads ? (
                      <ChevronUp className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="size-4 text-muted-foreground" />
                    )}
                  </button>

                  {openApplicableHeads && (
                    <div className="p-3 border-t border-border space-y-2 max-h-48 overflow-y-auto">
                      {loadingHeads ? (
                        <p className="text-xs text-muted-foreground">
                          Loading payroll heads...
                        </p>
                      ) : customHeadChoices.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">
                          No other payroll heads available.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {customHeadChoices.map((ch) => {
                            const isChecked = selectedCustomHeads.includes(
                              ch.value,
                            )
                            return (
                              <label
                                key={ch.value}
                                className={cn(
                                  'flex items-center justify-between p-2 rounded-md border text-xs cursor-pointer transition-colors',
                                  isChecked
                                    ? 'border-primary/50 bg-primary/5 text-foreground'
                                    : 'border-border hover:bg-muted/40 text-muted-foreground',
                                )}
                              >
                                <div className="flex items-center gap-2 truncate pr-1">
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={() =>
                                      toggleCustomHead(ch.value)
                                    }
                                  />
                                  <span className="truncate font-medium">
                                    {ch.label}
                                  </span>
                                </div>
                                <span className="text-[10px] text-muted-foreground shrink-0">
                                  {ch.helpText}
                                </span>
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 5. Attendance Type */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Clock className="size-3.5 text-primary" />
                Attendance Type
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {['on_attendance', 'flat_rate'].map((aType) => (
                  <button
                    key={aType}
                    type="button"
                    onClick={() => setValue('payroll_head_attn', aType as any)}
                    className={cn(
                      'flex items-center justify-center py-2 px-3 rounded-lg border text-xs font-semibold cursor-pointer transition-all',
                      attnType === aType
                        ? 'border-[#6f9ff1] bg-[#6f9ff1]/10 text-orange-700 dark:text-orange-400 shadow-2xs'
                        : 'border-border bg-background hover:bg-muted text-muted-foreground',
                    )}
                  >
                    <span>
                      {aType === 'on_attendance'
                        ? 'On Attendance'
                        : 'Flat Rate'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 6. Applicable Months (Collapsible matching v1) */}
            <div className="rounded-lg border border-border overflow-hidden bg-background">
              <button
                type="button"
                onClick={() => setOpenMonths((v) => !v)}
                className="flex w-full items-center justify-between p-3 text-xs font-medium bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="size-3.5 text-primary" />
                  <span>
                    Applicable Months (
                    {selectedMonths.length === 0
                      ? 'All 12 Months'
                      : `${selectedMonths.length} Months Selected`}
                    )
                  </span>
                </div>
                {openMonths ? (
                  <ChevronUp className="size-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="size-4 text-muted-foreground" />
                )}
              </button>

              {openMonths && (
                <div className="p-3.5 border-t border-border space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs font-medium">Year:</Label>
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        className="h-8 px-2 border rounded-md text-xs bg-background"
                      >
                        {YEARS.map((y) => (
                          <option key={y} value={String(y)}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={toggleAllMonths}
                      className="text-[11px] text-primary hover:underline cursor-pointer font-medium"
                    >
                      {selectedMonths.length === MONTH_CHOICES.length
                        ? 'Clear All'
                        : 'Select All Months'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                    {MONTH_CHOICES.map((m) => {
                      const isChecked = selectedMonths.includes(m.value)
                      return (
                        <label
                          key={m.value}
                          className={cn(
                            'flex items-center gap-2 p-1.5 rounded-md border cursor-pointer transition-colors',
                            isChecked
                              ? 'border-primary/50 bg-primary/5 text-foreground font-medium'
                              : 'border-border hover:bg-muted/40 text-muted-foreground',
                          )}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => toggleMonth(m.value)}
                          />
                          <span>{m.label}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Fixed Footer */}
          <SheetFooter className="px-6 py-3.5 border-t border-border bg-muted/20 shrink-0 flex flex-row items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={addOrEditMutation.isPending}
              className="text-xs h-8 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={addOrEditMutation.isPending || isSubmitting}
              className="text-xs h-8 gap-1.5 cursor-pointer capitalize"
            >
              {addOrEditMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="size-3.5" />
                  <span>
                    {isEditMode ? `Update ${entryType}` : `Add ${entryType}`}
                  </span>
                </>
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export default PayrollHeadModal
