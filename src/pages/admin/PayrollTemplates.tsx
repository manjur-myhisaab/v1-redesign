import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText,
  Plus,
  Trash2,
  Edit,
  Loader2,
  Layers,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import Panel from '@/components/admin/Panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import rdk, { readItems, createItem, deleteItem } from '@/services/server'

interface PayrollTemplate {
  payroll_template_id: string
  payroll_template_name: string
  status?: string
  date_created?: string
}

export default function PayrollTemplates() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [status, setStatus] = useState('active')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch templates
  const { data: templates = [], isLoading } = useQuery<PayrollTemplate[]>({
    queryKey: ['payrollTemplates'],
    queryFn: async () => {
      const res = await rdk.request(
        readItems('payroll_templates', {
          sort: ['-date_created'],
          limit: -1,
        }),
      )
      return Array.isArray(res) ? (res as PayrollTemplate[]) : []
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await rdk.request(deleteItem('payroll_templates', id))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrollTemplates'] })
      toast.success('Template deleted successfully')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete template')
    },
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!templateName.trim()) {
      toast.error('Template name is required')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await rdk.request(
        createItem('payroll_templates', {
          payroll_template_name: templateName.trim(),
          status: status,
        }),
      )
      toast.success('Template created successfully')
      queryClient.invalidateQueries({ queryKey: ['payrollTemplates'] })
      setModalOpen(false)
      setTemplateName('')

      const newId = (res as any)?.payroll_template_id || (res as any)?.id
      if (newId) {
        navigate(`/admin/payroll/templates/${newId}`)
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create template')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Panel className="p-4 md:p-6 flex-1 flex flex-col gap-4 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Payroll Templates</h1>
          <p className="text-sm text-muted-foreground">
            Configure salary structures, allowances, deductions, and calculation rules
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setModalOpen(true)} className="cursor-pointer gap-2">
            <Plus className="size-4" />
            <span>New Template</span>
          </Button>
        </div>
      </div>

      {/* Templates List */}
      <div className="flex-1 overflow-auto rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="h-48 flex items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
            <Layers className="size-8 stroke-[1.5]" />
            <p>No payroll templates found</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((tpl) => (
                <TableRow
                  key={tpl.payroll_template_id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/admin/payroll/templates/${tpl.payroll_template_id}`)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2.5">
                      <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                        <FileText className="size-4" />
                      </div>
                      <span className="font-semibold text-foreground truncate">
                        {tpl.payroll_template_name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={tpl.status === 'active' ? 'default' : 'secondary'}>
                      {tpl.status || 'Active'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {tpl.date_created ? new Date(tpl.date_created).toLocaleDateString('en-IN') : '—'}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        title="Configure"
                        onClick={() => navigate(`/admin/payroll/templates/${tpl.payroll_template_id}`)}
                      >
                        <Edit className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                        title="Delete"
                        onClick={() => {
                          if (confirm(`Delete template "${tpl.payroll_template_name}"?`)) {
                            deleteMutation.mutate(tpl.payroll_template_id)
                          }
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Payroll Template</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium">Template Name *</label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. Standard Full-time CTC"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-9 rounded-md border border-border bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="active">Active</option>
                <option value="draft">Draft</option>
              </select>
            </div>

            <DialogFooter className="mt-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
                Create & Configure
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Panel>
  )
}
