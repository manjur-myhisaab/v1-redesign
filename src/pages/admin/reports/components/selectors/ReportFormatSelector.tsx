import React from 'react'
import { FileSpreadsheet, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReportFormat } from '../../types'

interface ReportFormatSelectorProps {
  supportedFormats: ReportFormat[]
  selectedFormat: ReportFormat
  onFormatChange: (format: ReportFormat) => void
}

export const ReportFormatSelector: React.FC<ReportFormatSelectorProps> = ({
  supportedFormats,
  selectedFormat,
  onFormatChange,
}) => {
  // If only 1 format supported (or zip), don't show toggle
  if (supportedFormats.length <= 1 || supportedFormats.includes('zip')) {
    return null
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-border/70 bg-card p-3">
      <div>
        <label className="text-xs font-semibold text-foreground">Export Format</label>
        <p className="text-[11px] text-muted-foreground">Select preferred document type</p>
      </div>

      <div className="flex items-center rounded-lg bg-muted p-0.5 text-xs">
        {supportedFormats.includes('pdf') && (
          <button
            type="button"
            onClick={() => onFormatChange('pdf')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer',
              selectedFormat === 'pdf'
                ? 'bg-background text-red-600 dark:text-red-400 shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <FileText className="size-3.5" />
            PDF Document
          </button>
        )}

        {supportedFormats.includes('excel') && (
          <button
            type="button"
            onClick={() => onFormatChange('excel')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer',
              selectedFormat === 'excel'
                ? 'bg-background text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <FileSpreadsheet className="size-3.5" />
            Excel (.xlsx)
          </button>
        )}
      </div>
    </div>
  )
}
