import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileSpreadsheet,
  Plus,
  Search,
  Copy,
  Trash2,
  Edit,
  Layers,
} from 'lucide-react'
import { toast } from 'sonner'
import Panel from '@/components/admin/Panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useReportBuilder } from '@/hooks/useReportBuilder'
import { REPORT_TYPES } from '@/lib/reportColumnDefinitions'

export default function ReportBuilder() {
  const navigate = useNavigate()
  const { templates, deleteTemplate, duplicateTemplate, createBlankTemplate } =
    useReportBuilder()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return templates
    return templates.filter((t) => (t.name || 'Untitled').toLowerCase().includes(q))
  }, [templates, search])

  const handleCreate = () => {
    const blank = createBlankTemplate('attendance_daywise')
    navigate(`/admin/report-builder/${blank.id}`)
  }

  const handleDuplicate = (id: string) => {
    const copy = duplicateTemplate(id)
    if (copy) toast.success('Template duplicated')
  }

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Delete template "${name || 'Untitled'}"?`)) {
      deleteTemplate(id)
      toast.success('Template deleted')
    }
  }

  return (
    <Panel className="p-4 md:p-6 flex-1 flex flex-col gap-4 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Report Builder</h1>
          <p className="text-sm text-muted-foreground">
            Build custom attendance, payroll, and activity reports with personalized columns
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleCreate} className="gap-2 cursor-pointer">
            <Plus className="size-4" />
            <span>New Custom Template</span>
          </Button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search custom report templates..."
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Templates Table */}
      <div className="flex-1 overflow-auto rounded-lg border border-border bg-card">
        {filtered.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
            <Layers className="size-8 stroke-[1.5]" />
            <p>No custom templates configured yet</p>
            <Button variant="outline" size="sm" onClick={handleCreate} className="mt-1">
              Create First Template
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template Name</TableHead>
                <TableHead>Report Type</TableHead>
                <TableHead>Active Columns</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => {
                const typeInfo = REPORT_TYPES.find((rt) => rt.key === t.reportType)
                return (
                  <TableRow
                    key={t.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/admin/report-builder/${t.id}`)}
                  >
                    <TableCell className="font-semibold text-foreground">
                      <div className="flex items-center gap-2.5">
                        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                          <FileSpreadsheet className="size-4" />
                        </div>
                        <span>{t.name || 'Untitled Template'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{typeInfo?.label || t.reportType}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {t.columns.filter((c) => c.visible).length} visible columns
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {t.updatedAt ? new Date(t.updatedAt).toLocaleDateString('en-IN') : '—'}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          title="Edit Template"
                          onClick={() => navigate(`/admin/report-builder/${t.id}`)}
                        >
                          <Edit className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          title="Duplicate"
                          onClick={() => handleDuplicate(t.id)}
                        >
                          <Copy className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                          title="Delete"
                          onClick={() => handleDelete(t.id, t.name)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </Panel>
  )
}
