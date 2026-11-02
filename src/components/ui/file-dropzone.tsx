import { useState, useRef, useEffect, type DragEvent, type ChangeEvent } from 'react'
import {
  UploadCloud,
  FileText,
  FileImage,
  File,
  X,
  Eye,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { Button } from './button'
import { cn } from '@/lib/utils'

export interface ExistingFile {
  id?: string | number
  name?: string
  url?: string
}

export interface FileDropzoneProps {
  files: File[]
  onChange: (files: File[]) => void
  existingFiles?: ExistingFile[]
  onRemoveExisting?: (index: number) => void
  onPreviewImage?: (url: string, name?: string) => void
  accept?: string
  multiple?: boolean
  maxSizeMB?: number
  label?: string
  description?: string
  className?: string
  disabled?: boolean
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function isImageFile(file: File | ExistingFile): boolean {
  if ('type' in file && typeof file.type === 'string') {
    return file.type.startsWith('image/')
  }
  const urlOrName = (('url' in file ? file.url : '') || file.name || '').toLowerCase()
  return /\.(png|jpe?g|gif|webp|svg|bmp)$/.test(urlOrName)
}

function isPdfFile(file: File | ExistingFile): boolean {
  if ('type' in file && typeof file.type === 'string') {
    return file.type === 'application/pdf'
  }
  const urlOrName = (('url' in file ? file.url : '') || file.name || '').toLowerCase()
  return /\.pdf$/.test(urlOrName)
}

export default function FileDropzone({
  files,
  onChange,
  existingFiles = [],
  onRemoveExisting,
  onPreviewImage,
  accept = 'image/*,.pdf',
  multiple = true,
  maxSizeMB = 10,
  label,
  description,
  className,
  disabled = false,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Object URLs for client-side previews (cleaned up on unmount or file list change)
  const [previews, setPreviews] = useState<Map<File, string>>(new Map())

  useEffect(() => {
    const newMap = new Map<File, string>()
    files.forEach((f) => {
      if (isImageFile(f)) {
        try {
          const url = URL.createObjectURL(f)
          newMap.set(f, url)
        } catch {
          // ignore
        }
      }
    })
    setPreviews(newMap)

    return () => {
      newMap.forEach((url) => {
        try {
          URL.revokeObjectURL(url)
        } catch {
          // ignore
        }
      })
    }
  }, [files])

  const validateAndAddFiles = (newFiles: File[]) => {
    setErrorMsg(null)
    const valid: File[] = []
    const maxBytes = maxSizeMB * 1024 * 1024

    for (const file of newFiles) {
      if (file.size > maxBytes) {
        setErrorMsg(`File "${file.name}" exceeds maximum allowed size of ${maxSizeMB}MB`)
        continue
      }
      valid.push(file)
    }

    if (valid.length > 0) {
      if (multiple) {
        // Prevent duplicate files by name and size
        const existingKeys = new Set(files.map((f) => `${f.name}-${f.size}`))
        const deduplicated = valid.filter((f) => !existingKeys.has(`${f.name}-${f.size}`))
        onChange([...files, ...deduplicated])
      } else {
        onChange([valid[0]])
      }
    }
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (disabled) return

    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      validateAndAddFiles(Array.from(e.dataTransfer.files))
    }
  }

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndAddFiles(Array.from(e.target.files))
      // Reset input value so re-selecting the same file triggers change
      e.target.value = ''
    }
  }

  const removeFile = (index: number) => {
    onChange(files.filter((_, i) => i !== index))
  }

  const totalFilesCount = existingFiles.length + files.length

  return (
    <div className={cn('space-y-2.5', className)}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold text-foreground tracking-tight">
            {label}
          </label>
          {totalFilesCount > 0 && (
            <span className="text-[10px] text-muted-foreground font-medium">
              {totalFilesCount} {totalFilesCount === 1 ? 'attachment' : 'attachments'}
            </span>
          )}
        </div>
      )}

      {/* Drop Target */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          if (!disabled) inputRef.current?.click()
        }}
        className={cn(
          'relative border-2 border-dashed rounded-xl p-4 transition-all duration-200 text-center cursor-pointer select-none group',
          isDragging
            ? 'border-primary bg-primary/10 scale-[0.99] ring-2 ring-primary/20'
            : 'border-gray-200 dark:border-border/80 hover:border-primary/60 bg-gray-50/60 dark:bg-card/40 hover:bg-primary/[0.02]',
          disabled && 'opacity-60 cursor-not-allowed hover:border-gray-200'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
          disabled={disabled}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center gap-1.5">
          <div
            className={cn(
              'size-9 rounded-full flex items-center justify-center transition-all duration-200 shadow-2xs',
              isDragging
                ? 'bg-primary text-primary-foreground scale-110'
                : 'bg-background border border-gray-200 dark:border-border text-muted-foreground group-hover:text-primary group-hover:scale-105 group-hover:border-primary/30'
            )}
          >
            <UploadCloud className="size-4.5" />
          </div>

          <div className="space-y-0.5">
            <p className="text-xs text-foreground font-medium">
              <span className="text-primary font-semibold hover:underline">
                Click to upload
              </span>{' '}
              or drag & drop
            </p>
            <p className="text-[11px] text-muted-foreground">
              {description || `PNG, JPG, PDF documents up to ${maxSizeMB}MB`}
            </p>
          </div>
        </div>
      </div>

      {/* Error alert if any */}
      {errorMsg && (
        <div className="flex items-center gap-1.5 p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[11px] text-rose-700 dark:text-rose-300">
          <AlertCircle className="size-3.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* File Previews List */}
      {totalFilesCount > 0 && (
        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          {/* Existing uploaded files */}
          {existingFiles.map((ex, idx) => {
            const isImg = isImageFile(ex)
            const isPdf = isPdfFile(ex)
            const displayName = ex.name || `Attachment #${idx + 1}`

            return (
              <div
                key={`existing-${ex.id || idx}`}
                className="flex items-center justify-between gap-2.5 p-2 rounded-lg border border-gray-200 dark:border-border bg-background hover:bg-muted/30 transition-colors shadow-2xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-8 rounded-md bg-muted/60 flex items-center justify-center shrink-0 overflow-hidden border border-border/50">
                    {isImg && ex.url ? (
                      <img
                        src={ex.url}
                        alt={displayName}
                        className="size-full object-cover"
                      />
                    ) : isPdf ? (
                      <FileText className="size-4 text-rose-600" />
                    ) : (
                      <File className="size-4 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate max-w-[240px]">
                      {displayName}
                    </p>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <CheckCircle2 className="size-2.5 text-emerald-600 inline" />
                      Uploaded
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {isImg && ex.url && onPreviewImage && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onPreviewImage(ex.url!, displayName)}
                      className="size-6 text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Preview Image"
                    >
                      <Eye className="size-3" />
                    </Button>
                  )}
                  {onRemoveExisting && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemoveExisting(idx)}
                      className="size-6 text-muted-foreground hover:text-rose-600 cursor-pointer"
                      title="Remove file"
                    >
                      <X className="size-3" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}

          {/* New files queued for upload */}
          {files.map((file, idx) => {
            const previewUrl = previews.get(file)
            const isImg = isImageFile(file)
            const isPdf = isPdfFile(file)

            return (
              <div
                key={`file-${file.name}-${file.size}-${idx}`}
                className="flex items-center justify-between gap-2.5 p-2 rounded-lg border border-primary/20 bg-primary/[0.02] dark:bg-primary/[0.04] hover:bg-primary/[0.05] transition-colors shadow-2xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-8 rounded-md bg-background flex items-center justify-center shrink-0 overflow-hidden border border-border shadow-2xs">
                    {isImg && previewUrl ? (
                      <img
                        src={previewUrl}
                        alt={file.name}
                        className="size-full object-cover"
                      />
                    ) : isPdf ? (
                      <FileText className="size-4 text-rose-600" />
                    ) : isImg ? (
                      <FileImage className="size-4 text-blue-600" />
                    ) : (
                      <File className="size-4 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate max-w-[220px]">
                      {file.name}
                    </p>
                    <span className="text-[10px] text-muted-foreground">
                      {formatFileSize(file.size)} • Ready to upload
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {isImg && previewUrl && onPreviewImage && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onPreviewImage(previewUrl, file.name)}
                      className="size-6 text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Preview Image"
                    >
                      <Eye className="size-3" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFile(idx)}
                    className="size-6 text-muted-foreground hover:text-rose-600 cursor-pointer"
                    title="Remove file"
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
