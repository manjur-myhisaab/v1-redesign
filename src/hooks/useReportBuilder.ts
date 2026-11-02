import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@/context/auth/AuthContext'
import {
  getDefaultColumns,
  type TemplateColumnConfig,
} from '@/lib/reportColumnDefinitions'

export interface ReportTemplate {
  id: string
  firmId: string
  createdBy?: string
  createdAt: string
  updatedAt: string
  name: string
  reportType: string
  exportFormat?: string
  columns: TemplateColumnConfig[]
}

const STORAGE_KEY = 'myhisaab_report_templates'

const generateId = () => {
  return 'rt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9)
}

const loadTemplatesFromStorage = (firmId: string): ReportTemplate[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const all = JSON.parse(raw)
    return Array.isArray(all) ? all.filter((t: any) => t.firmId === firmId) : []
  } catch {
    return []
  }
}

const saveTemplatesToStorage = (templates: ReportTemplate[], firmId: string) => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const existing: ReportTemplate[] = raw ? JSON.parse(raw) : []
    const otherFirms = existing.filter((t) => t.firmId !== firmId)
    const merged = [...otherFirms, ...templates]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  } catch (e) {
    console.error('Failed to save templates:', e)
  }
}

export const createBlankTemplate = (
  firmId: string,
  userId?: string,
  reportType = 'attendance_daywise',
): ReportTemplate => {
  const defaultCols = getDefaultColumns(reportType)
  return {
    id: generateId(),
    firmId,
    createdBy: userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    name: '',
    reportType,
    exportFormat: 'pdf',
    columns: defaultCols,
  }
}

export function useReportBuilder() {
  const { user } = useAuth()
  const u = user as any
  const firmId =
    typeof u?.firm_id === 'object' ? u.firm_id?.firm_id : u?.firm_id || 'default'

  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (firmId) {
      setTemplates(loadTemplatesFromStorage(firmId))
      setLoading(false)
    }
  }, [firmId])

  const saveTemplate = useCallback(
    (template: ReportTemplate) => {
      setTemplates((prev) => {
        const exists = prev.some((t) => t.id === template.id)
        const updated = exists
          ? prev.map((t) =>
              t.id === template.id
                ? { ...template, updatedAt: new Date().toISOString() }
                : t,
            )
          : [...prev, { ...template, updatedAt: new Date().toISOString() }]
        saveTemplatesToStorage(updated, firmId)
        return updated
      })
    },
    [firmId],
  )

  const deleteTemplate = useCallback(
    (templateId: string) => {
      setTemplates((prev) => {
        const updated = prev.filter((t) => t.id !== templateId)
        saveTemplatesToStorage(updated, firmId)
        return updated
      })
    },
    [firmId],
  )

  const duplicateTemplate = useCallback(
    (templateId: string) => {
      const src = templates.find((t) => t.id === templateId)
      if (!src) return null
      const copy: ReportTemplate = {
        ...src,
        id: generateId(),
        name: `${src.name || 'Template'} (Copy)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      setTemplates((prev) => {
        const updated = [...prev, copy]
        saveTemplatesToStorage(updated, firmId)
        return updated
      })
      return copy
    },
    [templates, firmId],
  )

  return {
    templates,
    loading,
    saveTemplate,
    deleteTemplate,
    duplicateTemplate,
    createBlankTemplate: (type?: string) =>
      createBlankTemplate(firmId, user?.id, type),
  }
}
