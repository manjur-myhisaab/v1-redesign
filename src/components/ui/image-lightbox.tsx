import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react'
import { Button } from './button'

export interface ImageLightboxProps {
  src: string | null
  images?: string[]
  currentIndex?: number
  onIndexChange?: (index: number) => void
  alt?: string
  title?: string
  description?: string
  isOpen: boolean
  onClose: () => void
}

export default function ImageLightbox({
  src,
  images = [],
  currentIndex = 0,
  onIndexChange,
  alt = 'Attachment preview',
  title,
  description,
  isOpen,
  onClose,
}: ImageLightboxProps) {
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)

  // Resolve current active image: either from images array or single src
  const activeSrc =
    images.length > 0 && images[currentIndex] ? images[currentIndex] : src

  // Reset transform when opened with a new image or index changes
  useEffect(() => {
    if (isOpen) {
      setZoom(1)
      setRotation(0)
    }
  }, [isOpen, activeSrc, currentIndex])

  const hasPrev = images.length > 1 && currentIndex > 0
  const hasNext = images.length > 1 && currentIndex < images.length - 1

  const handlePrev = useCallback(() => {
    if (hasPrev && onIndexChange) {
      onIndexChange(currentIndex - 1)
      setZoom(1)
      setRotation(0)
    }
  }, [hasPrev, onIndexChange, currentIndex])

  const handleNext = useCallback(() => {
    if (hasNext && onIndexChange) {
      onIndexChange(currentIndex + 1)
      setZoom(1)
      setRotation(0)
    }
  }, [hasNext, onIndexChange, currentIndex])

  // Keyboard shortcut listener (Escape, +, -, 0, ArrowLeft, ArrowRight, R)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === '+' || e.key === '=') {
        setZoom((prev) => Math.min(prev + 0.25, 3))
      } else if (e.key === '-') {
        setZoom((prev) => Math.max(prev - 0.25, 0.5))
      } else if (e.key === '0') {
        setZoom(1)
        setRotation(0)
      } else if (e.key === 'r' || e.key === 'R') {
        setRotation((prev) => (prev + 90) % 360)
      } else if (e.key === 'ArrowLeft') {
        handlePrev()
      } else if (e.key === 'ArrowRight') {
        handleNext()
      }
    },
    [isOpen, onClose, handlePrev, handleNext]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!isOpen || !activeSrc) return null

  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = activeSrc
    a.download = alt || `attachment-${currentIndex + 1}`
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const lightboxContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || alt}
      className="fixed inset-0 z-[99999] pointer-events-auto flex items-center justify-center bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Top Controls Bar */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent z-10 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-white min-w-0 pr-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold truncate">
              {title || `Attachment ${images.length > 1 ? `#${currentIndex + 1}` : ''}`}
            </h3>
            {images.length > 1 && (
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-medium text-white/90">
                {currentIndex + 1} of {images.length}
              </span>
            )}
          </div>
          {description && <p className="text-xs text-white/70 truncate mt-0.5">{description}</p>}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setZoom((prev) => Math.min(prev + 0.25, 3))}
            className="text-white hover:bg-white/20 size-8 rounded-lg cursor-pointer"
            title="Zoom In (+)"
          >
            <ZoomIn className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setZoom((prev) => Math.max(prev - 0.25, 0.5))}
            className="text-white hover:bg-white/20 size-8 rounded-lg cursor-pointer"
            title="Zoom Out (-)"
          >
            <ZoomOut className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              setZoom(1)
              setRotation(0)
            }}
            className="text-white hover:bg-white/20 size-8 rounded-lg cursor-pointer"
            title="Reset (0)"
          >
            <Maximize2 className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setRotation((prev) => (prev + 90) % 360)}
            className="text-white hover:bg-white/20 size-8 rounded-lg cursor-pointer"
            title="Rotate (R)"
          >
            <RotateCw className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            className="text-white hover:bg-white/20 size-8 rounded-lg cursor-pointer"
            title="Download / Open"
          >
            <Download className="size-4" />
          </Button>
          <a
            href={activeSrc}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center text-white hover:bg-white/20 size-8 rounded-lg cursor-pointer transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="size-4" />
          </a>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-rose-500 size-8 rounded-lg cursor-pointer ml-2 bg-white/10"
            title="Close (Esc)"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Side Arrow Navigation (if multiple images) */}
      {hasPrev && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            handlePrev()
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 grid size-10 place-items-center rounded-full bg-black/60 text-white hover:bg-black/85 backdrop-blur-xs transition-colors cursor-pointer border border-white/10"
          title="Previous (Left Arrow)"
        >
          <ChevronLeft className="size-6" />
        </button>
      )}

      {hasNext && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            handleNext()
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 grid size-10 place-items-center rounded-full bg-black/60 text-white hover:bg-black/85 backdrop-blur-xs transition-colors cursor-pointer border border-white/10"
          title="Next (Right Arrow)"
        >
          <ChevronRight className="size-6" />
        </button>
      )}

      {/* Main Image Container */}
      <div
        className="relative flex items-center justify-center p-6 max-h-[85vh] max-w-[90vw] select-none"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={activeSrc}
          alt={alt}
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
            transition: 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)',
          }}
          className="max-h-[80vh] max-w-[85vw] object-contain rounded-lg shadow-2xl drop-shadow-2xl"
          draggable={false}
        />
      </div>

      {/* Bottom status indicator */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full bg-black/60 backdrop-blur-sm text-white/90 text-[11px] font-mono pointer-events-none border border-white/10">
        {Math.round(zoom * 100)}% {rotation !== 0 ? `· ${rotation}°` : ''}{' '}
        {images.length > 1 ? `· ${currentIndex + 1}/${images.length}` : ''}
      </div>
    </div>
  )

  if (typeof document === 'undefined') return lightboxContent
  return createPortal(lightboxContent, document.body)
}
