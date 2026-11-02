import React from 'react'
import { FileSpreadsheet, FileText, FileArchive, ArrowRight, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ReportItemConfig } from '../types'

interface ReportCardProps {
  report: ReportItemConfig
  onSelect: (report: ReportItemConfig) => void
  isLoading?: boolean
}

export const ReportCard: React.FC<ReportCardProps> = ({ report, onSelect, isLoading }) => {
  const Icon = report.icon

  // Category badge colors
  const categoryStyles: Record<string, { bg: string; text: string }> = {
    attendance: { bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', text: 'Attendance' },
    field: { bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', text: 'Field' },
    finance: { bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', text: 'Finance' },
    hr: { bg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400', text: 'HR & Staff' },
  }

  const categoryMeta = categoryStyles[report.category] || {
    bg: 'bg-muted text-muted-foreground',
    text: report.category,
  }

  return (
    <div
      onClick={() => onSelect(report)}
      className="group relative flex flex-col justify-between rounded-xl border border-border/80 bg-card p-4.5 transition-all duration-200 hover:border-primary/40 hover:shadow-md cursor-pointer"
    >
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-105">
              <Icon className="size-5" />
            </div>
            <div>
              <span
                className={cn(
                  'inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full uppercase tracking-wider',
                  categoryMeta.bg,
                )}
              >
                {categoryMeta.text}
              </span>
            </div>
          </div>

          {/* Formats supported */}
          <div className="flex items-center gap-1">
            {report.supportedFormats.map((fmt) => {
              if (fmt === 'excel') {
                return (
                  <span
                    key={fmt}
                    title="Excel (.xlsx) Export"
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  >
                    <FileSpreadsheet className="size-3" />
                    XLS
                  </span>
                )
              }
              if (fmt === 'pdf') {
                return (
                  <span
                    key={fmt}
                    title="PDF Document"
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/10 text-red-700 dark:text-red-400"
                  >
                    <FileText className="size-3" />
                    PDF
                  </span>
                )
              }
              if (fmt === 'zip') {
                return (
                  <span
                    key={fmt}
                    title="ZIP Archive"
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-700 dark:text-purple-400"
                  >
                    <FileArchive className="size-3" />
                    ZIP
                  </span>
                )
              }
              return null
            })}
          </div>
        </div>

        <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
          {report.label}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {report.description}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground font-medium">
          {report.instantDownload ? 'Direct export' : 'Customizable'}
        </span>
        <Button
          size="sm"
          variant={report.instantDownload ? 'outline' : 'default'}
          className="h-7.5 px-3 text-xs gap-1.5 cursor-pointer font-medium"
          onClick={(e) => {
            e.stopPropagation()
            onSelect(report)
          }}
          disabled={isLoading}
        >
          {report.instantDownload ? (
            <>
              <Download className="size-3.5" />
              Download
            </>
          ) : (
            <>
              <span>Generate</span>
              <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
