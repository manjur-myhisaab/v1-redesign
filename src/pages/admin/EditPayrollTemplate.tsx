import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Layers,
  ArrowLeft,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  Check,
  Percent,
  Coins,
  Gift,
  ShieldAlert,
  Search,
  X,
  SlidersHorizontal,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import Panel from '@/components/admin/Panel'
import { useShell } from '@/components/admin/shell-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import rdk, {
  readItem,
  readItems,
  updateItem,
  deleteItems,
} from '@/services/server'
import PayrollHeadModal from './settings/payroll-configuration/PayrollHeadModal'

interface PayrollHead {
  payroll_head_id: number | string
  payroll_head_name: string
  payroll_type: 'benefit' | 'deduction'
  payroll_value_type?: 'fixed' | 'percentage' | string
  payroll_value?: number | string
  payroll_template_id?: any
  value_based_on?: any[]
  applicable_months?: any[]
  payroll_head_attn?: string
}

export default function EditPayrollTemplate() {
  const { payroll_template_id, id } = useParams()
  const templateId = payroll_template_id || id
  const navigate = useNavigate()
  const shell = useShell()
  const firstTabActive = shell?.firstTabActive ?? false
  const queryClient = useQueryClient()

  const [templateName, setTemplateName] = useState('')
  const [basicSalaryType, setBasicSalaryType] = useState<'percentage' | 'fixed'>('percentage')
  const [basicPercentage, setBasicPercentage] = useState<number | string>(50)
  const [basicFixedAmount, setBasicFixedAmount] = useState<number | string>('')

  const [selectedBenefits, setSelectedBenefits] = useState<number[]>([])
  const [selectedDeductions, setSelectedDeductions] = useState<number[]>([])

  // Search queries for benefits and deductions
  const [searchBenefitQuery, setSearchBenefitQuery] = useState('')
  const [searchDeductionQuery, setSearchDeductionQuery] = useState('')

  // Head Modal States
  const [headModalOpen, setHeadModalOpen] = useState(false)
  const [headModalType, setHeadModalType] = useState<'benefit' | 'deduction'>('benefit')
  const [headToEdit, setHeadToEdit] = useState<PayrollHead | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // 1. Fetch Template Info
  const { data: templateData, isLoading: loadingTemplate } = useQuery({
    queryKey: ['payrollTemplate', templateId],
    queryFn: async () => {
      const res: any = await rdk.request(readItem('payroll_templates', templateId!))
      return res || null
    },
    enabled: !!templateId,
  })

  // 2. Fetch Heads linked to this template
  const { data: linkedHeads = [], isLoading: loadingLinked } = useQuery<any[]>({
    queryKey: ['payrollTemplateHeads', templateId],
    queryFn: async () => {
      const res: any = await rdk.request(
        readItems('payroll_heads', {
          filter: {
            payroll_template_id: {
              _eq: Number(templateId),
            },
          },
          fields: ['payroll_head_id', 'payroll_type'],
          limit: -1,
        }),
      )
      return Array.isArray(res) ? res : res?.data || []
    },
    enabled: !!templateId,
  })

  // 3. Fetch All Benefits
  const { data: allBenefits = [], isLoading: loadingBenefits } = useQuery<PayrollHead[]>({
    queryKey: ['payroll-benefits-for-template'],
    queryFn: async () => {
      const res: any = await rdk.request(
        readItems('payroll_heads', {
          filter: { payroll_type: { _eq: 'benefit' } },
          sort: ['-date_created'],
          fields: ['*', 'payroll_template_id.*', 'value_based_on.*'],
          limit: -1,
        }),
      )
      return Array.isArray(res) ? res : res?.data || []
    },
  })

  // 4. Fetch All Deductions
  const { data: allDeductions = [], isLoading: loadingDeductions } = useQuery<PayrollHead[]>({
    queryKey: ['payroll-deductions-for-template'],
    queryFn: async () => {
      const res: any = await rdk.request(
        readItems('payroll_heads', {
          filter: { payroll_type: { _eq: 'deduction' } },
          sort: ['-date_created'],
          fields: [
            '*',
            'payroll_template_id.*',
            'value_based_on.*',
            'value_based_on.related_payroll_heads_payroll_head_id.*',
          ],
          limit: -1,
        }),
      )
      return Array.isArray(res) ? res : res?.data || []
    },
  })

  // Effective Benefits and Deductions according to v1 logic:
  // Shows heads assigned to this template OR globally unassigned (null template)
  const effectiveBenefits = useMemo(() => {
    return allBenefits.filter((item) => {
      const tId =
        typeof item.payroll_template_id === 'object' && item.payroll_template_id !== null
          ? item.payroll_template_id.payroll_template_id
          : item.payroll_template_id
      return Number(tId) === Number(templateId) || tId === null || tId === undefined
    })
  }, [allBenefits, templateId])

  const effectiveDeductions = useMemo(() => {
    return allDeductions.filter((item) => {
      const tId =
        typeof item.payroll_template_id === 'object' && item.payroll_template_id !== null
          ? item.payroll_template_id.payroll_template_id
          : item.payroll_template_id
      return Number(tId) === Number(templateId) || tId === null || tId === undefined
    })
  }, [allDeductions, templateId])

  // Filtered by Search queries
  const filteredBenefits = useMemo(() => {
    if (!searchBenefitQuery.trim()) return effectiveBenefits
    const q = searchBenefitQuery.toLowerCase().trim()
    return effectiveBenefits.filter((b) =>
      (b.payroll_head_name || '').toLowerCase().includes(q),
    )
  }, [effectiveBenefits, searchBenefitQuery])

  const filteredDeductions = useMemo(() => {
    if (!searchDeductionQuery.trim()) return effectiveDeductions
    const q = searchDeductionQuery.toLowerCase().trim()
    return effectiveDeductions.filter((d) =>
      (d.payroll_head_name || '').toLowerCase().includes(q),
    )
  }, [effectiveDeductions, searchDeductionQuery])

  // Populate state from template
  useEffect(() => {
    if (templateData) {
      setTemplateName(templateData.payroll_template_name || '')
      setBasicSalaryType(templateData.basic_salary_type || 'percentage')
      setBasicPercentage(templateData.basic_salary_percentage ?? 50)
      setBasicFixedAmount(templateData.basic_salary_fixed ?? '')

      const linkedHeadIds = linkedHeads.map((h) => Number(h.payroll_head_id))

      const initialBenefits = allBenefits
        .map((b) => Number(b.payroll_head_id))
        .filter((id) => linkedHeadIds.includes(id))

      const initialDeductions = allDeductions
        .map((d) => Number(d.payroll_head_id))
        .filter((id) => linkedHeadIds.includes(id))

      setSelectedBenefits(initialBenefits)
      setSelectedDeductions(initialDeductions)
    }
  }, [templateData, linkedHeads, allBenefits, allDeductions])

  // Toggle handlers
  const toggleBenefit = (id: number) => {
    setSelectedBenefits((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  const toggleDeduction = (id: number) => {
    setSelectedDeductions((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  // Quick Select All / Deselect All
  const toggleAllBenefits = () => {
    const allFilteredIds = filteredBenefits.map((b) => Number(b.payroll_head_id))
    const allSelected = allFilteredIds.every((id) => selectedBenefits.includes(id))
    if (allSelected) {
      setSelectedBenefits((prev) => prev.filter((id) => !allFilteredIds.includes(id)))
    } else {
      setSelectedBenefits((prev) => Array.from(new Set([...prev, ...allFilteredIds])))
    }
  }

  const toggleAllDeductions = () => {
    const allFilteredIds = filteredDeductions.map((d) => Number(d.payroll_head_id))
    const allSelected = allFilteredIds.every((id) => selectedDeductions.includes(id))
    if (allSelected) {
      setSelectedDeductions((prev) => prev.filter((id) => !allFilteredIds.includes(id)))
    } else {
      setSelectedDeductions((prev) => Array.from(new Set([...prev, ...allFilteredIds])))
    }
  }

  // Delete head mutation
  const deleteHeadMutation = useMutation({
    mutationFn: async (id: number | string) => {
      return await rdk.request(deleteItems('payroll_heads', [id]))
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-benefits-for-template'] })
      queryClient.invalidateQueries({ queryKey: ['payroll-deductions-for-template'] })
      queryClient.invalidateQueries({ queryKey: ['payrollTemplateHeads', templateId] })
      setSelectedBenefits((prev) => prev.filter((id) => id !== Number(deletedId)))
      setSelectedDeductions((prev) => prev.filter((id) => id !== Number(deletedId)))
      toast.success('Payroll component deleted')
    },
    onError: () => toast.error('Failed to delete payroll component'),
  })

  const handleDeleteHead = (e: React.MouseEvent, item: PayrollHead) => {
    e.stopPropagation()
    if (confirm(`Are you sure you want to delete component "${item.payroll_head_name}"?`)) {
      deleteHeadMutation.mutate(item.payroll_head_id)
    }
  }

  const handleOpenAdd = (type: 'benefit' | 'deduction') => {
    setHeadToEdit(null)
    setHeadModalType(type)
    setHeadModalOpen(true)
  }

  const handleOpenEdit = (e: React.MouseEvent, item: PayrollHead) => {
    e.stopPropagation()
    setHeadToEdit(item)
    setHeadModalType(item.payroll_type)
    setHeadModalOpen(true)
  }

  // Save Template Structure & Sync Heads
  const handleSaveStructure = async () => {
    if (!templateName.trim()) {
      toast.error('Template name cannot be empty')
      return
    }

    setIsSaving(true)
    const toastId = toast.loading('Saving payroll template configuration...')

    try {
      const isPercentage = basicSalaryType === 'percentage'
      const templatePayload: Record<string, any> = {
        payroll_template_name: templateName.trim(),
        basic_salary_type: basicSalaryType,
        basic_salary_percentage: isPercentage ? parseFloat(String(basicPercentage)) || 50 : null,
        basic_salary_fixed: !isPercentage ? parseFloat(String(basicFixedAmount)) || 0 : null,
        date_updated: new Date().toISOString(),
      }

      await rdk.request(updateItem('payroll_templates', templateId!, templatePayload))

      // Sync Heads:
      const activeChosenIds = [...selectedBenefits, ...selectedDeductions]
      const currentLinkedIds = linkedHeads.map((h) => Number(h.payroll_head_id))

      // Link newly selected heads
      const toLink = activeChosenIds.filter((id) => !currentLinkedIds.includes(id))
      for (const headId of toLink) {
        await rdk.request(
          updateItem('payroll_heads', headId, {
            payroll_template_id: Number(templateId),
          }),
        )
      }

      // Unlink unselected heads
      const toUnlink = currentLinkedIds.filter((id) => !activeChosenIds.includes(id))
      for (const headId of toUnlink) {
        await rdk.request(
          updateItem('payroll_heads', headId, {
            payroll_template_id: null,
          }),
        )
      }

      toast.success('Payroll template updated successfully', { id: toastId })
      queryClient.invalidateQueries({ queryKey: ['payrollTemplate', templateId] })
      queryClient.invalidateQueries({ queryKey: ['payrollTemplateHeads', templateId] })
      queryClient.invalidateQueries({ queryKey: ['payrollTemplates'] })

      navigate('/admin/templates')
    } catch (err: any) {
      console.error('Save template error:', err)
      toast.error(err?.message || 'Failed to save template', { id: toastId })
    } finally {
      setIsSaving(false)
    }
  }

  const isLoading =
    loadingTemplate || loadingLinked || loadingBenefits || loadingDeductions

  return (
    <Panel
      className={cn(
        'flex min-w-0 flex-1 flex-col h-full overflow-hidden',
        firstTabActive && 'rounded-tl-none',
      )}
    >
      {/* 1. Header Toolbar (Clients Design System) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5 bg-card/60 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/admin/templates')}
            className="size-8 cursor-pointer rounded-lg text-muted-foreground hover:text-foreground"
            title="Back to Templates"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-lg font-semibold tracking-tight text-foreground">
                {templateName || 'Edit Payroll Template'}
              </h1>
              <Badge variant="outline" className="text-xs">
                Template #{templateId}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configure Basic Salary formula, standard allowances, and statutory deduction rules.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/admin/templates')}
            disabled={isSaving}
            className="h-8 text-xs cursor-pointer"
          >
            Cancel
          </Button>

          <Button
            size="sm"
            onClick={handleSaveStructure}
            disabled={isSaving}
            className="h-8 gap-2 cursor-pointer text-xs font-semibold shadow-xs"
          >
            {isSaving ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check className="size-3.5" />
                <span>Save Changes</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 2. Main Body: Full Width Template Settings on Top + 2-Grid Side-by-Side Below */}
      <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-20 gap-2 text-muted-foreground">
            <Loader2 className="size-6 animate-spin text-primary" />
            <span className="text-xs">Loading template configuration...</span>
          </div>
        ) : (
          <>
            {/* ── TOP: FULL WIDTH TEMPLATE SETTINGS CARD ── */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                    <SlidersHorizontal className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-foreground">
                      Template Configuration &amp; Basic Salary Rule
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Define template identity and specify how the baseline wage is calculated for employees.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-end">
                {/* 1. Template Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-foreground">
                    Template Name <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="e.g. Standard Employee Template, Executive Grade"
                    className="h-9 text-xs"
                    required
                  />
                </div>

                {/* 2. Calculation Method */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-foreground">
                    Basic Salary Calculation Method
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-muted/40 rounded-lg border border-border">
                    <button
                      type="button"
                      onClick={() => setBasicSalaryType('percentage')}
                      className={cn(
                        'flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md cursor-pointer transition-all',
                        basicSalaryType === 'percentage'
                          ? 'bg-card text-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <Percent className="size-3.5" />
                      <span>% of CTC</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBasicSalaryType('fixed')}
                      className={cn(
                        'flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md cursor-pointer transition-all',
                        basicSalaryType === 'fixed'
                          ? 'bg-card text-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <Coins className="size-3.5" />
                      <span>Fixed ₹</span>
                    </button>
                  </div>
                </div>

                {/* 3. Value / Rate */}
                <div className="flex flex-col gap-1.5">
                  {basicSalaryType === 'percentage' ? (
                    <>
                      <label className="text-xs font-bold text-foreground">
                        Percentage of CTC (%) <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          step="any"
                          value={basicPercentage}
                          onChange={(e) => setBasicPercentage(e.target.value)}
                          className="pr-10 h-9 text-xs font-semibold"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                          %
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <label className="text-xs font-bold text-foreground">
                        Fixed Basic Salary (₹) <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                          ₹
                        </span>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="e.g. 15000"
                          value={basicFixedAmount}
                          onChange={(e) => setBasicFixedAmount(e.target.value)}
                          className="pl-7 h-9 text-xs font-semibold"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* ── BOTTOM: 2-GRID SYSTEM SIDE BY SIDE (BENEFITS & DEDUCTIONS) ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
              {/* ── CARD 1: ALLOWANCES & BENEFITS ── */}
              <div className="rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col gap-4">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="grid size-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600">
                      <Gift className="size-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-foreground">
                          Earnings &amp; Allowances
                        </h3>
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                          {selectedBenefits.length} of {effectiveBenefits.length} Selected
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Select allowances linked to this template or create custom earnings.
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenAdd('benefit')}
                    className="h-8 gap-1.5 text-xs font-semibold cursor-pointer border-border hover:bg-muted"
                  >
                    <Plus className="size-3.5 text-emerald-600" />
                    <span>Add Allowance</span>
                  </Button>
                </div>

                {/* Search & Bulk Select Toolbar */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search allowances & benefits..."
                      value={searchBenefitQuery}
                      onChange={(e) => setSearchBenefitQuery(e.target.value)}
                      className="h-8 pl-8 pr-7 text-xs bg-muted/30 focus-visible:bg-background rounded-lg"
                    />
                    {searchBenefitQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchBenefitQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={toggleAllBenefits}
                    className="h-8 text-xs cursor-pointer text-muted-foreground hover:text-foreground shrink-0"
                  >
                    {filteredBenefits.every((b) => selectedBenefits.includes(Number(b.payroll_head_id))) &&
                    filteredBenefits.length > 0
                      ? 'Deselect All'
                      : 'Select All'}
                  </Button>
                </div>

                {/* List / Items Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[460px] overflow-y-auto pr-1">
                  {filteredBenefits.length === 0 ? (
                    <div className="col-span-2 text-center py-10 text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                      {searchBenefitQuery
                        ? 'No allowances match your search query.'
                        : 'No allowances available yet. Click "+ Add Allowance" to create one.'}
                    </div>
                  ) : (
                    filteredBenefits.map((b) => {
                      const idNum = Number(b.payroll_head_id)
                      const isChecked = selectedBenefits.includes(idNum)
                      const valDisplay =
                        b.payroll_value_type === 'fixed'
                          ? `₹${Number(b.payroll_value || 0).toLocaleString('en-IN')} Fixed`
                          : `${b.payroll_value}% of Basic`

                      return (
                        <div
                          key={idNum}
                          className={cn(
                            'flex items-center justify-between p-3 rounded-xl border border-border text-xs transition-all bg-card hover:bg-muted/40',
                            isChecked &&
                              'bg-emerald-500/5 border-emerald-500/40 shadow-2xs',
                          )}
                        >
                          <label className="flex items-start gap-2.5 cursor-pointer flex-1 min-w-0 mr-2">
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => toggleBenefit(idNum)}
                              className="mt-0.5"
                            />
                            <div className="min-w-0">
                              <span className="font-semibold text-foreground block truncate">
                                {b.payroll_head_name}
                              </span>
                              <span className="text-[11px] text-muted-foreground block truncate font-medium">
                                {valDisplay}
                              </span>
                            </div>
                          </label>

                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => handleOpenEdit(e, b)}
                              className="size-7 text-muted-foreground hover:text-foreground cursor-pointer rounded-md hover:bg-muted"
                              title="Edit Component"
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => handleDeleteHead(e, b)}
                              className="size-7 text-muted-foreground hover:text-rose-600 cursor-pointer rounded-md hover:bg-rose-500/10"
                              title="Delete Component"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* ── CARD 2: STATUTORY & OTHER DEDUCTIONS ── */}
              <div className="rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col gap-4">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="grid size-8 place-items-center rounded-lg bg-rose-500/10 text-rose-600">
                      <ShieldAlert className="size-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-foreground">
                          Statutory &amp; Deductions
                        </h3>
                        <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-600">
                          {selectedDeductions.length} of {effectiveDeductions.length} Selected
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Select mandatory statutory deductions (PF, ESI, TDS) or custom deductions.
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenAdd('deduction')}
                    className="h-8 gap-1.5 text-xs font-semibold cursor-pointer border-border hover:bg-muted"
                  >
                    <Plus className="size-3.5 text-rose-600" />
                    <span>Add Deduction</span>
                  </Button>
                </div>

                {/* Search & Bulk Select Toolbar */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search deductions & contributions..."
                      value={searchDeductionQuery}
                      onChange={(e) => setSearchDeductionQuery(e.target.value)}
                      className="h-8 pl-8 pr-7 text-xs bg-muted/30 focus-visible:bg-background rounded-lg"
                    />
                    {searchDeductionQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchDeductionQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={toggleAllDeductions}
                    className="h-8 text-xs cursor-pointer text-muted-foreground hover:text-foreground shrink-0"
                  >
                    {filteredDeductions.every((d) => selectedDeductions.includes(Number(d.payroll_head_id))) &&
                    filteredDeductions.length > 0
                      ? 'Deselect All'
                      : 'Select All'}
                  </Button>
                </div>

                {/* List / Items Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[460px] overflow-y-auto pr-1">
                  {filteredDeductions.length === 0 ? (
                    <div className="col-span-2 text-center py-10 text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                      {searchDeductionQuery
                        ? 'No deductions match your search query.'
                        : 'No deductions available yet. Click "+ Add Deduction" to create one.'}
                    </div>
                  ) : (
                    filteredDeductions.map((d) => {
                      const idNum = Number(d.payroll_head_id)
                      const isChecked = selectedDeductions.includes(idNum)
                      const valDisplay =
                        d.payroll_value_type === 'fixed'
                          ? `₹${Number(d.payroll_value || 0).toLocaleString('en-IN')} Fixed`
                          : `${d.payroll_value}% of Basic`

                      return (
                        <div
                          key={idNum}
                          className={cn(
                            'flex items-center justify-between p-3 rounded-xl border border-border text-xs transition-all bg-card hover:bg-muted/40',
                            isChecked &&
                              'bg-rose-500/5 border-rose-500/40 shadow-2xs',
                          )}
                        >
                          <label className="flex items-start gap-2.5 cursor-pointer flex-1 min-w-0 mr-2">
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => toggleDeduction(idNum)}
                              className="mt-0.5"
                            />
                            <div className="min-w-0">
                              <span className="font-semibold text-foreground block truncate">
                                {d.payroll_head_name}
                              </span>
                              <span className="text-[11px] text-muted-foreground block truncate font-medium">
                                {valDisplay}
                              </span>
                            </div>
                          </label>

                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => handleOpenEdit(e, d)}
                              className="size-7 text-muted-foreground hover:text-foreground cursor-pointer rounded-md hover:bg-muted"
                              title="Edit Component"
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => handleDeleteHead(e, d)}
                              className="size-7 text-muted-foreground hover:text-rose-600 cursor-pointer rounded-md hover:bg-rose-500/10"
                              title="Delete Component"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── REUSABLE RICH PAYROLL HEAD DRAWER (Matching v1) ── */}
      <PayrollHeadModal
        open={headModalOpen}
        onClose={() => {
          setHeadModalOpen(false)
          setHeadToEdit(null)
        }}
        type={headModalType}
        headToEdit={headToEdit}
        allHeads={[...allBenefits, ...allDeductions]}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['payroll-benefits-for-template'] })
          queryClient.invalidateQueries({ queryKey: ['payroll-deductions-for-template'] })
          queryClient.invalidateQueries({ queryKey: ['payrollTemplateHeads', templateId] })
        }}
      />
    </Panel>
  )
}
