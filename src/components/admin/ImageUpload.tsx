import { useRef, useState } from 'react'
import { ImagePlus, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { uploadFile } from '@/lib/api'

interface ImageUploadProps {
  /** current image URL (server path or data URL) */
  value?: string
  onChange: (url: string) => void
  /** storage sub-folder, e.g. `workspaces/<id>/logo` */
  prefix?: string
  label?: string
  hint?: string
  shape?: 'square' | 'circle'
  size?: number // px
  className?: string
}

// Reusable image picker backed by the pluggable storage system (POST /api/uploads).
// Pick → upload → preview; returns the stored URL via onChange.
export default function ImageUpload({
  value,
  onChange,
  prefix,
  label,
  hint,
  shape = 'square',
  size = 48,
  className,
}: ImageUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const { url } = await uploadFile(file, prefix)
      onChange(url)
    } catch (err) {
      setError((err as Error).message || 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        style={{ width: size, height: size }}
        className={cn(
          'grid shrink-0 cursor-pointer place-items-center overflow-hidden border border-border bg-gradient-to-br from-violet-200 to-blue-200 text-muted-foreground',
          shape === 'circle' ? 'rounded-full' : 'rounded-xl',
        )}
      >
        {busy ? (
          <Loader2 className="size-5 animate-spin text-foreground/50" />
        ) : value ? (
          <img src={value} alt="" className="size-full object-cover" />
        ) : (
          <ImagePlus className="size-5 text-foreground/50" />
        )}
      </button>

      <div className="min-w-0">
        {label && <div className="text-[13px] font-medium">{label}</div>}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="mt-1 cursor-pointer rounded-lg border border-border bg-card px-3 py-1 text-[13px] font-medium transition-colors hover:bg-muted disabled:opacity-50"
        >
          {busy ? 'Uploading…' : value ? 'Change' : 'Choose'}
        </button>
        {error ? (
          <div className="mt-1 text-[11px] text-rose-600">{error}</div>
        ) : (
          hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={pick}
        className="hidden"
      />
    </div>
  )
}
