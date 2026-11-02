import React from 'react'
import { Loader2, FileArchive, CheckCircle2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ReportBulkZipProgressProps {
  open: boolean
  title: string
  progress: number // 0 to 100
  currentEmployeeName?: string
  isDone?: boolean
}

export const ReportBulkZipProgress: React.FC<ReportBulkZipProgressProps> = ({
  open,
  title,
  progress,
  currentEmployeeName,
  isDone,
}) => {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-base font-semibold">
            {isDone ? (
              <CheckCircle2 className="size-5 text-emerald-600" />
            ) : (
              <FileArchive className="size-5 text-primary animate-pulse" />
            )}
            <span>{title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>
              {isDone
                ? 'Archive generated successfully!'
                : currentEmployeeName
                ? `Processing: ${currentEmployeeName}`
                : 'Preparing documents...'}
            </span>
            <span className="font-semibold text-foreground">{progress}%</span>
          </div>

          {/* Progress bar container */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {!isDone && (
            <div className="flex items-center justify-center gap-2 pt-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin text-primary" />
              <span>Packaging files into ZIP archive. Please wait...</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
