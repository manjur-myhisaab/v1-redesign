import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  FileText,
  ArrowLeft,
  Plus,
  Trash2,
  Edit,
  Loader2,
  Check,
  Percent,
  ShieldCheck,
  Gift,
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import Panel from '@/components/admin/Panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import rdk, {
  readItem,
  readItems,
  updateItem,
  createItem,
  deleteItem,
} from '@/services/server'

interface PayrollHead {
  payroll_head_id: string
  payroll_head_name: string
  payroll_type: 'benefit' | 'deduction'
  value_type?: 'fixed' | 'percentage'
  value?: number
  payroll_template_id?: any
}

export default function EditPayrollTemplate() {
  const { payroll_template_id, id } = useParams()
  const templateId = payroll_template_id || id
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [templateName, setTemplateName] = useState('')
  const [basicSalaryType, setBasicSalaryType] = useState<'percentage' | 'fixed'>('percentage')
  const [basicPercentage, setBasicPercentage] = useState<number | ''>(50)
  const [basicFixedAmount, setBasicFixedAmount] = useState<number | ''>('')
  const [selectedBenefits, setSelectedBenefits] = useState<string[]>([])
  const [selectedDeductions, setSelectedDeductions] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // Head Modal
  const [headModalOpen, setHeadModalOpen] = useState(false)
  const [headModalType, setHeadModalType] = useState<'benefit' | 'deduction'>('benefit')
  const [editingHead, setEditingHead] = useState<PayrollHead | null>(null)
  const [headName, setHeadName] = useState('')
  const [headValType, setHeadValType] = useState<'fixed' | 'percentage'>('percentage')
  const [headVal, setHeadVal] = useState<number | ''>('')

  // 1. Fetch Template
  const { data: templateData, isLoading: loadingTemplate } = useQuery({
    queryKey: ['payrollTemplate', templateId],
    queryFn: async () => {
      if (!templateId) return null
      return await rdk.request(readItem('payroll_templates', templateId))
    },
    enabled: !!templateId,
  })

  // 2. Fetch Heads
  const { data: allHeads = [] } = useQuery<PayrollHead[]>({
    queryKey: ['payroll_heads_all'],
    queryFn: async () => {
      const res = await rdk.request(
        readItems('payroll_heads', {
          sort: ['payroll_head_name'],
          limit: -1,
        }),
      )
      return Array.isArray(res) ? (res as PayrollHead[]) : []
    },
  })

  // Initialize
  useEffect(() => {
    if (templateData) {
      setTemplateName(templateData.payroll_template_name || '')
      setBasicSalaryType(templateData.basic_salary_type || 'percentage')
      setBasicPercentage(templateData.basic_salary_percentage ?? 50)
      setBasicFixedAmount(templateData.basic_salary_fixed ?? '')
    }
  }, [templateData])

  // Linked heads
  useEffect(() => {
    if (allHeads.length > 0 && templateId) {
      const linked = allHeads.filter(
        (h) =>
          h.payroll_template_id === templateId ||
          h.payroll_template_id?.payroll_template_id === templateId,
      )
      setSelectedBenefits(
        linked.filter((h) => h.payroll_type === 'benefit').map((h) => h.payroll_head_id),
      )
      setSelectedDeductions(
        linked.filter((h) => h.payroll_type === 'deduction').map((h) => h.payroll_head_id),
      )
    }
  }, [allHeads, templateId])

  const benefitsList = useMemo(
    () => allHeads.filter((h) => h.payroll_type === 'benefit'),
    [allHeads],
  )
  const deductionsList = useMemo(
    () => allHeads.filter((h) => h.payroll_type === 'deduction'),
    [allHeads],
  )

  const toggleBenefit = (headId: string) => {
    setSelectedBenefits((prev) =>
      prev.includes(headId) ? prev.filter((id) => id !== headId) : [...prev, headId],
    )
  }

  const toggleDeduction = (headId: string) => {
    setSelectedDeductions((prev) =>
      prev.includes(headId) ? prev.filter((id) => id !== headId) : [...prev, headId],
    )
  }

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      toast.error('Template name is required')
      return
    }

    setIsSaving(true)
    try {
      if (templateId) {
        await rdk.request(
          updateItem('payroll_templates', templateId, {
            payroll_template_name: templateName.trim(),
            basic_salary_type: basicSalaryType,
            basic_salary_percentage:
              basicSalaryType === 'percentage' ? Number(basicPercentage) || null : null,
            basic_salary_fixed:
              basicSalaryType === 'fixed' ? Number(basicFixedAmount) || null : null,
          }),
        )

        // Sync linked heads
        const selectedHeadIds = [...selectedBenefits, ...selectedDeductions]
        for (const head of allHeads) {
          const isSelected = selectedHeadIds.includes(head.payroll_head_id)
          const isCurrentlyLinked =
            head.payroll_template_id === templateId ||
            head.payroll_template_id?.payroll_template_id === templateId

          if (isSelected && !isCurrentlyLinked) {
            await rdk.request(
              updateItem('payroll_heads', head.payroll_head_id, {
                payroll_template_id: templateId,
              }),
            )
          } else if (!isSelected && isCurrentlyLinked) {
            await rdk.request(
              updateItem('payroll_heads', head.payroll_head_id, {
                payroll_template_id: null,
              }),
            )
          }
        }
      }

      toast.success('Payroll template saved successfully')
      queryClient.invalidateQueries({ queryKey: ['payrollTemplate', templateId] })
      queryClient.invalidateQueries({ queryKey: ['payroll_heads_all'] })
    } catch (err: any) {
      toast.error(err.message || 'Failed to save template')
    } finally {
      setIsSaving(false)
    }
  }

  const openAddHead = (type: 'benefit' | 'deduction') => {
    setEditingHead(null)
    setHeadModalType(type)
    setHeadName('')
    setHeadValType('percentage')
    setHeadVal('')
    setHeadModalOpen(true)
  }

  const openEditHead = (head: PayrollHead) => {
    setEditingHead(head)
    setHeadModalType(head.payroll_type)
    setHeadName(head.payroll_head_name)
    setHeadValType(head.value_type || 'percentage')
    setHeadVal(head.value ?? '')
    setHeadModalOpen(true)
  }

  const handleSaveHead = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!headName.trim()) {
      toast.error('Component name is required')
      return
    }

    try {
      const payload: Record<string, any> = {
        payroll_head_name: headName.trim(),
        payroll_type: headModalType,
        value_type: headValType,
        value: Number(headVal) || 0,
        payroll_template_id: templateId,
      }

      if (editingHead) {
        await rdk.request(updateItem('payroll_heads', editingHead.payroll_head_id, payload))
        toast.success('Component updated')
      } else {
        const res: any = await rdk.request(createItem('payroll_heads', payload))
        toast.success('Component added')
        const newId = res?.payroll_head_id || res?.id
        if (newId) {
          if (headModalType === 'benefit') setSelectedBenefits((p) => [...p, newId])
          else setSelectedDeductions((p) => [...p, newId])
        }
      }

      queryClient.invalidateQueries({ queryKey: ['payroll_heads_all'] })
      setHeadModalOpen(false)
    } catch (err: any) {
      toast.error(err.message || 'Failed to save component')
    }
  }

  const handleDeleteHead = async (head: PayrollHead) => {
    if (confirm(`Delete component "${head.payroll_head_name}"?`)) {
      try {
        await rdk.request(deleteItem('payroll_heads', head.payroll_head_id))
        toast.success('Component deleted')
        queryClient.invalidateQueries({ queryKey: ['payroll_heads_all'] })
      } catch (err: any) {
        toast.error(err.message || 'Failed to delete component')
      }
    }
  }

  if (loadingTemplate) {
    return (
      <Panel className="p-6 flex-1 flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </Panel>
    )
  }

  return (
    <Panel className="p-4 md:p-6 flex-1 flex flex-col gap-5 overflow-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/admin/payroll/templates')}
            className="size-8"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {templateName || 'Edit Payroll Template'}
            </h1>
            <p className="text-xs text-muted-foreground">
              Define Basic Salary calculation, standard allowances, and deductions
            </p>
          </div>
        </div>

        <Button onClick={handleSaveTemplate} disabled={isSaving} className="gap-2">
          {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          <span>Save Structure</span>
        </Button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column: Template & Basic Salary */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              General Details
            </h2>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium">Structure Name *</label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. Executive Staff CTC"
              />
            </div>

            <div className="border-t border-border pt-4 flex flex-col gap-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Basic Salary Calculation
              </label>

              <div className="flex items-center gap-3 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="basicType"
                    checked={basicSalaryType === 'percentage'}
                    onChange={() => setBasicSalaryType('percentage')}
                  />
                  <span>% of Monthly CTC</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="basicType"
                    checked={basicSalaryType === 'fixed'}
                    onChange={() => setBasicSalaryType('fixed')}
                  />
                  <span>Fixed Monthly Amount</span>
                </label>
              </div>

              {basicSalaryType === 'percentage' ? (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted-foreground">Basic Percentage</label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={basicPercentage}
                      onChange={(e) =>
                        setBasicPercentage(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      className="pr-8"
                    />
                    <Percent className="size-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted-foreground">Fixed Basic Amount (₹)</label>
                  <Input
                    type="number"
                    min="0"
                    value={basicFixedAmount}
                    onChange={(e) =>
                      setBasicFixedAmount(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    placeholder="25000"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column: Benefits & Deductions Checklists */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* Allowances / Benefits */}
          <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Gift className="size-4 text-emerald-600" />
                Earnings & Allowances ({selectedBenefits.length} active)
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openAddHead('benefit')}
                className="h-8 gap-1 text-xs"
              >
                <Plus className="size-3.5" />
                <span>Add Allowance</span>
              </Button>
            </div>

            <div className="flex flex-col divide-y divide-border/60">
              {benefitsList.map((head) => {
                const isChecked = selectedBenefits.includes(head.payroll_head_id)
                return (
                  <div
                    key={head.payroll_head_id}
                    className="flex items-center justify-between py-2.5 px-2 hover:bg-muted/40 rounded transition-colors"
                  >
                    <label className="flex items-center gap-2.5 cursor-pointer flex-1">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleBenefit(head.payroll_head_id)}
                      />
                      <span className="text-sm font-medium">{head.payroll_head_name}</span>
                      {head.value != null && (
                        <span className="text-xs text-muted-foreground">
                          {head.value_type === 'percentage'
                            ? `(${head.value}% of Basic)`
                            : `(₹${head.value})`}
                        </span>
                      )}
                    </label>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={() => openEditHead(head)}
                      >
                        <Edit className="size-3 text-muted-foreground" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-rose-500 hover:text-rose-600"
                        onClick={() => handleDeleteHead(head)}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Deductions */}
          <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <ShieldCheck className="size-4 text-rose-600" />
                Statutory & Other Deductions ({selectedDeductions.length} active)
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openAddHead('deduction')}
                className="h-8 gap-1 text-xs"
              >
                <Plus className="size-3.5" />
                <span>Add Deduction</span>
              </Button>
            </div>

            <div className="flex flex-col divide-y divide-border/60">
              {deductionsList.map((head) => {
                const isChecked = selectedDeductions.includes(head.payroll_head_id)
                return (
                  <div
                    key={head.payroll_head_id}
                    className="flex items-center justify-between py-2.5 px-2 hover:bg-muted/40 rounded transition-colors"
                  >
                    <label className="flex items-center gap-2.5 cursor-pointer flex-1">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleDeduction(head.payroll_head_id)}
                      />
                      <span className="text-sm font-medium">{head.payroll_head_name}</span>
                      {head.value != null && (
                        <span className="text-xs text-muted-foreground">
                          {head.value_type === 'percentage'
                            ? `(${head.value}% of Basic)`
                            : `(₹${head.value})`}
                        </span>
                      )}
                    </label>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={() => openEditHead(head)}
                      >
                        <Edit className="size-3 text-muted-foreground" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-rose-500 hover:text-rose-600"
                        onClick={() => handleDeleteHead(head)}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Add / Edit Head Dialog */}
      <Dialog open={headModalOpen} onOpenChange={setHeadModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingHead
                ? 'Edit Component'
                : headModalType === 'benefit'
                  ? 'Add Earnings Component'
                  : 'Add Deduction Component'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveHead} className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium">Component Name *</label>
              <Input
                value={headName}
                onChange={(e) => setHeadName(e.target.value)}
                placeholder="e.g. House Rent Allowance, PF Employee Contribution"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium">Calculation Type</label>
                <select
                  value={headValType}
                  onChange={(e) => setHeadValType(e.target.value as any)}
                  className="h-9 rounded-md border border-border bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="percentage">% of Basic</option>
                  <option value="fixed">Fixed Monthly (₹)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium">Value</label>
                <Input
                  type="number"
                  step="0.01"
                  value={headVal}
                  onChange={(e) =>
                    setHeadVal(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  placeholder={headValType === 'percentage' ? '50' : '2000'}
                  required
                />
              </div>
            </div>

            <DialogFooter className="mt-2">
              <Button type="button" variant="outline" onClick={() => setHeadModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Component</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Panel>
  )
}
