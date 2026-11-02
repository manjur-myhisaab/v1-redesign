import React, { useState, useRef } from 'react'
import { UploadCloud, FileSpreadsheet, X, AlertCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface ExcelImportModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (file: File) => Promise<void>
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [importFile, setImportFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [isDragOver, setIsDragOver] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        setImportFile(file)
      }
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImportFile(e.target.files[0])
    }
  }

  const handleImportSubmit = async () => {
    if (!importFile) return
    setIsSubmitting(true)
    try {
      await onSubmit(importFile)
      onClose()
      setImportFile(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg w-full p-6">
        <DialogHeader className="border-b border-border pb-3">
          <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
            <UploadCloud className="h-5 w-5 text-primary" />
            Import Excel for Bulk Shift Update
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Upload the edited roster spreadsheet (.xlsx, .xls) to update shifts for all employees at once.
          </p>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx, .xls"
            className="hidden"
          />

          {importFile ? (
            <div className="flex items-center justify-between p-4 border border-emerald-500/30 rounded-xl bg-emerald-500/5">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-8 w-8 text-emerald-600" />
                <div>
                  <p className="font-semibold text-xs text-emerald-800 dark:text-emerald-400">
                    {importFile.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {(importFile.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={() => setImportFile(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl cursor-pointer transition-colors text-center ${
                isDragOver
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-muted/30'
              }`}
            >
              <UploadCloud className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="font-semibold text-xs text-foreground">Click to upload or drag & drop</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Excel spreadsheet format (.xlsx, .xls)
              </p>
            </div>
          )}

          <div className="flex items-start gap-2 p-3 bg-muted/40 rounded-lg text-xs text-muted-foreground border border-border/50">
            <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              Ensure that employee names and dates in the Excel file match your downloaded template. Any date without a shift assignment will remain unchanged.
            </p>
          </div>
        </div>

        {/* Footer with clean gap between buttons */}
        <DialogFooter className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 text-xs h-9 cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={handleImportSubmit}
            disabled={!importFile || isSubmitting}
            className="px-4 text-xs h-9 cursor-pointer"
          >
            {isSubmitting ? 'Processing File...' : 'Upload & Update'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
