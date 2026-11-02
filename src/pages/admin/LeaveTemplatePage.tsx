import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarCheck,
  Plus,
  Trash2,
  Check,
  Loader2,
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import Panel from '@/components/admin/Panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import rdk, { readItem, createItem, updateItem } from '@/services/server'

interface LeaveConfigItem {
  leave_type: string
  leave_balance: number
  leave_add_system: 'fixed' | 'monthly'
  monthly_accrual_rate?: number
  carry_forward: boolean
  max_carry_forward?: number
}

const LEAVE_TYPES = [
  { label: 'Casual Leave', value: 'casual' },
  { label: 'Sick Leave', value: 'sick' },
  { label: 'Earned / Privilege Leave', value: 'earned' },
  { label: 'Maternity Leave', value: 'maternity' },
  { label: 'Paternity Leave', value: 'paternity' },
  { label: 'Emergency Leave', value: 'emergency' },
  { label: 'Half Day Leave', value: 'half_day' },
]

export default function LeaveTemplatePage() {
  const { template_id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [templateName, setTemplateName] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [leavesApplicable, setLeavesApplicable] = useState<LeaveConfigItem[]>([
    {
      leave_type: 'casual',
      leave_balance: 12,
      leave_add_system: 'fixed',
      carry_forward: false,
    },
    {
      leave_type: 'sick',
      leave_balance: 6,
      leave_add_system: 'fixed',
      carry_forward: false,
    },
  ])

  // Fetch if editing
  const { data: existingTemplate, isLoading } = useQuery({
    queryKey: ['leave_template_detail', template_id],
    queryFn: async () => {
      if (!template_id || template_id === 'new') return null
      const res = await rdk.request(readItem('leave_templates', template_id))
      return res?.data || res
    },
    enabled: !!template_id && template_id !== 'new',
  })

  useEffect(() => {
    if (existingTemplate) {
      setTemplateName(existingTemplate.template_name || '')
      setDescription(existingTemplate.description || '')
      if (Array.isArray(existingTemplate.leaves_applicable)) {
        setLeavesApplicable(existingTemplate.leaves_applicable)
      }
    }
  }, [existingTemplate])

  const addLeaveType = () => {
    const used = leavesApplicable.map((l) => l.leave_type)
    const nextAvailable = LEAVE_TYPES.find((t) => !used.includes(t.value))
    setLeavesApplicable((prev) => [
      ...prev,
      {
        leave_type: nextAvailable ? nextAvailable.value : 'casual',
        leave_balance: 10,
        leave_add_system: 'fixed',
        carry_forward: false,
      },
    ])
  }

  const removeLeaveType = (index: number) => {
    setLeavesApplicable((prev) => prev.filter((_, idx) => idx !== index))
  }

  const updateLeaveItem = (index: number, patch: Partial<LeaveConfigItem>) => {
    setLeavesApplicable((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)),
    )
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!templateName.trim()) {
      toast.error('Please enter a template name')
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        template_name: templateName.trim(),
        description: description.trim(),
        leaves_applicable: leavesApplicable,
      }

      if (template_id && template_id !== 'new') {
        await rdk.request(updateItem('leave_templates', template_id, payload))
        toast.success('Leave template updated')
      } else {
        await rdk.request(createItem('leave_templates', payload))
        toast.success('Leave template created')
      }

      queryClient.invalidateQueries({ queryKey: ['leave_templates'] })
      navigate('/admin/settings')
    } catch (err: any) {
      toast.error(err.message || 'Failed to save leave template')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <Panel className="p-6 flex-1 flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </Panel>
    )
  }

  return (
    <Panel className="p-4 md:p-6 flex-1 flex flex-col gap-5 overflow-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/admin/settings')}
            className="size-8 cursor-pointer"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {template_id && template_id !== 'new'
                ? 'Edit Leave Policy Template'
                : 'Create Leave Policy Template'}
            </h1>
            <p className="text-xs text-muted-foreground">
              Define annual quotas, accrual systems, and carry-forward rules
            </p>
          </div>
        </div>

        <Button onClick={handleSave} disabled={isSubmitting} className="gap-2 cursor-pointer">
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          <span>Save Leave Policy</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: General Info */}
        <div className="lg:col-span-1 rounded-lg border border-border bg-card p-4 flex flex-col gap-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <CalendarCheck className="size-4 text-primary" />
            General Information
          </h2>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium">Policy Name *</label>
            <Input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g. Standard 18-Day Corporate Policy"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional policy notes or applicability..."
              className="rounded-md border border-border bg-card p-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        {/* Right: Leave Types Config Cards */}
        <div className="lg:col-span-2 rounded-lg border border-border bg-card p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-sm font-semibold">Configured Leave Types</h2>
              <p className="text-xs text-muted-foreground">
                Set allocation quota and rules for each leave category
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={addLeaveType}
              className="gap-1.5 h-8 text-xs cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>Add Leave Type</span>
            </Button>
          </div>

          <div className="flex flex-col gap-3">
            {leavesApplicable.map((leave, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-border bg-muted/20 p-3.5 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Rule #{idx + 1}
                  </span>
                  {leavesApplicable.length > 1 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-6 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                      onClick={() => removeLeaveType(idx)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium">Leave Type</label>
                    <select
                      value={leave.leave_type}
                      onChange={(e) => updateLeaveItem(idx, { leave_type: e.target.value })}
                      className="h-8 rounded border border-border bg-card px-2 text-xs focus:outline-none"
                    >
                      {LEAVE_TYPES.map((lt) => (
                        <option key={lt.value} value={lt.value}>
                          {lt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium">Annual Quota (Days)</label>
                    <Input
                      type="number"
                      min="0"
                      value={leave.leave_balance}
                      onChange={(e) =>
                        updateLeaveItem(idx, {
                          leave_balance: Number(e.target.value) || 0,
                        })
                      }
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium">Accrual Mode</label>
                    <select
                      value={leave.leave_add_system}
                      onChange={(e) =>
                        updateLeaveItem(idx, {
                          leave_add_system: e.target.value as any,
                        })
                      }
                      className="h-8 rounded border border-border bg-card px-2 text-xs focus:outline-none"
                    >
                      <option value="fixed">All Upfront (Annual)</option>
                      <option value="monthly">Accrued Monthly</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={leave.carry_forward}
                      onCheckedChange={(checked) =>
                        updateLeaveItem(idx, { carry_forward: Boolean(checked) })
                      }
                    />
                    <span>Allow Carry Forward to next year</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  )
}
