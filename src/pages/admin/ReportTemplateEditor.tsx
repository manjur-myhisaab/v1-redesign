import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  FileSpreadsheet,
} from 'lucide-react'
import { toast } from 'sonner'
import Panel from '@/components/admin/Panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  useReportBuilder,
  type ReportTemplate,
  createBlankTemplate,
} from '@/hooks/useReportBuilder'
import {
  REPORT_TYPES,
  getAllColumns,
  getDefaultColumns,
  type TemplateColumnConfig,
} from '@/lib/reportColumnDefinitions'
import { useAuth } from '@/context/auth/AuthContext'

export default function ReportTemplateEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const u = user as any
  const firmId =
    typeof u?.firm_id === 'object' ? u.firm_id?.firm_id : u?.firm_id || 'default'

  const { templates, saveTemplate } = useReportBuilder()

  const [template, setTemplate] = useState<ReportTemplate>(() => {
    const existing = templates.find((t) => t.id === id)
    return existing || createBlankTemplate(firmId, user?.id, 'attendance_daywise')
  })

  useEffect(() => {
    const existing = templates.find((t) => t.id === id)
    if (existing) {
      setTemplate(existing)
    }
  }, [templates, id])

  const availableMasterColumns = useMemo(
    () => getAllColumns(template.reportType),
    [template.reportType],
  )

  const handleTypeChange = (newType: string) => {
    const newDefaults = getDefaultColumns(newType)
    setTemplate((prev) => ({
      ...prev,
      reportType: newType,
      columns: newDefaults,
    }))
  }

  const toggleColumn = (colKey: string) => {
    setTemplate((prev) => {
      const existing = prev.columns.find((c) => c.key === colKey)
      if (existing) {
        return {
          ...prev,
          columns: prev.columns.map((c) =>
            c.key === colKey ? { ...c, visible: !c.visible } : c,
          ),
        }
      }
      const master = availableMasterColumns.find((c) => c.key === colKey)
      if (!master) return prev
      const newCol: TemplateColumnConfig = {
        ...master,
        visible: true,
        width: master.defaultWidth,
        alignment: 'center',
        sortOrder: prev.columns.length,
      }
      return {
        ...prev,
        columns: [...prev.columns, newCol],
      }
    })
  }

  const handleSave = () => {
    if (!template.name.trim()) {
      toast.error('Please name your template')
      return
    }
    saveTemplate(template)
    toast.success('Report template saved!')
    navigate('/admin/report-builder')
  }

  return (
    <Panel className="p-4 md:p-6 flex-1 flex flex-col gap-4 overflow-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/admin/report-builder')}
            className="size-8 cursor-pointer"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {template.name || 'New Report Template'}
            </h1>
            <p className="text-xs text-muted-foreground">
              Select report type, columns, labels, and export layout
            </p>
          </div>
        </div>

        <Button onClick={handleSave} className="gap-2 cursor-pointer">
          <Check className="size-4" />
          <span>Save Template</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: General Settings */}
        <div className="lg:col-span-1 rounded-lg border border-border bg-card p-4 flex flex-col gap-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <FileSpreadsheet className="size-4 text-primary" />
            Template Settings
          </h2>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium">Template Name *</label>
            <Input
              value={template.name}
              onChange={(e) => setTemplate((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Monthly Staff Attendance Summary"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium">Source Report Type</label>
            <select
              value={template.reportType}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="h-9 rounded-md border border-border bg-card px-3 text-sm focus:outline-none"
            >
              {REPORT_TYPES.map((rt) => (
                <option key={rt.key} value={rt.key}>
                  {rt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground leading-relaxed">
            Customize column order, display names, and visibility on the right. When this template
            is exported, only selected visible columns will appear in the generated Excel/PDF.
          </div>
        </div>

        {/* Right: Columns Checklist */}
        <div className="lg:col-span-2 rounded-lg border border-border bg-card p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-border pb-2.5">
            <h2 className="text-sm font-semibold">Available Columns</h2>
            <span className="text-xs text-muted-foreground">
              {template.columns.filter((c) => c.visible).length} columns active
            </span>
          </div>

          <div className="flex flex-col divide-y divide-border/60 overflow-y-auto max-h-[500px]">
            {availableMasterColumns.map((col) => {
              const current = template.columns.find((c) => c.key === col.key)
              const isChecked = current ? current.visible : false

              return (
                <div
                  key={col.key}
                  className="flex items-center justify-between py-2.5 px-2 hover:bg-muted/40 rounded transition-colors"
                >
                  <label className="flex items-center gap-2.5 cursor-pointer flex-1">
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggleColumn(col.key)}
                    />
                    <span className="text-sm font-medium">{col.label}</span>
                    <Badge variant="secondary" className="text-[10px] uppercase font-normal">
                      {col.category}
                    </Badge>
                  </label>

                  {isChecked && (
                    <div className="flex items-center gap-2">
                      <Input
                        value={current?.customLabel || ''}
                        onChange={(e) =>
                          setTemplate((p) => ({
                            ...p,
                            columns: p.columns.map((c) =>
                              c.key === col.key ? { ...c, customLabel: e.target.value } : c,
                            ),
                          }))
                        }
                        placeholder="Custom title"
                        className="h-7 text-xs w-32"
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Panel>
  )
}
