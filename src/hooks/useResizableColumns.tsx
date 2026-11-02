import React, { useState, useCallback, useRef } from 'react'

export interface ColumnWidthConfig {
  [key: string]: number
}

interface UseResizableColumnsOptions {
  storageKey?: string
  minWidth?: number
}

export function useResizableColumns(
  initialWidths: ColumnWidthConfig,
  options?: UseResizableColumnsOptions,
) {
  const { storageKey, minWidth = 60 } = options || {}

  const [colWidths, setColWidths] = useState<ColumnWidthConfig>(() => {
    if (storageKey) {
      try {
        const saved = localStorage.getItem(`col_widths_${storageKey}`)
        if (saved) {
          const parsed = JSON.parse(saved)
          return { ...initialWidths, ...parsed }
        }
      } catch {}
    }
    return initialWidths
  })

  const [isResizing, setIsResizing] = useState<string | null>(null)
  const activeColRef = useRef<string | null>(null)
  const startXRef = useRef<number>(0)
  const startWidthRef = useRef<number>(0)
  const colWidthsRef = useRef(colWidths)
  colWidthsRef.current = colWidths
  const justResizedRef = useRef<boolean>(false)

  const canSort = useCallback(() => {
    return !justResizedRef.current && !activeColRef.current
  }, [])

  const startResizing = useCallback(
    (columnKey: string, e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      justResizedRef.current = true
      activeColRef.current = columnKey
      startXRef.current = e.clientX
      startWidthRef.current = colWidthsRef.current[columnKey] || initialWidths[columnKey] || 150
      setIsResizing(columnKey)

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!activeColRef.current) return
        const delta = moveEvent.clientX - startXRef.current
        const newWidth = Math.max(minWidth, startWidthRef.current + delta)

        setColWidths((prev) => {
          const updated = {
            ...prev,
            [activeColRef.current!]: newWidth,
          }
          colWidthsRef.current = updated
          return updated
        })
      }

      const handleMouseUp = (upEvent?: Event) => {
        if (upEvent) {
          upEvent.stopPropagation()
        }
        if (storageKey && activeColRef.current) {
          try {
            localStorage.setItem(
              `col_widths_${storageKey}`,
              JSON.stringify(colWidthsRef.current),
            )
          } catch {}
        }
        activeColRef.current = null
        setIsResizing(null)
        setTimeout(() => {
          justResizedRef.current = false
        }, 250)
        window.removeEventListener('mousemove', handleMouseMove, true)
        window.removeEventListener('mouseup', handleMouseUp, true)
        window.removeEventListener('blur', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      window.addEventListener('mousemove', handleMouseMove, true)
      window.addEventListener('mouseup', handleMouseUp, true)
      window.addEventListener('blur', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [initialWidths, minWidth, storageKey],
  )

  const resetWidths = useCallback(() => {
    setColWidths(initialWidths)
    if (storageKey) {
      try {
        localStorage.removeItem(`col_widths_${storageKey}`)
      } catch {}
    }
  }, [initialWidths, storageKey])

  return {
    colWidths,
    startResizing,
    isResizing,
    resetWidths,
    canSort,
  }
}

export function ColumnResizer({
  onMouseDown,
  isResizing,
}: {
  onMouseDown: (e: React.MouseEvent) => void
  isResizing?: boolean
}) {
  return (
    <div
      onMouseDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onMouseDown(e)
      }}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      className={`absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize select-none touch-none z-10 flex items-center justify-center transition-colors group/resizer ${
        isResizing ? 'bg-primary/20' : 'hover:bg-primary/10'
      }`}
      title="Drag to resize column"
    >
      <div
        className={`h-4 w-[2px] rounded-full transition-colors ${
          isResizing ? 'bg-primary' : 'bg-border group-hover/resizer:bg-primary/60'
        }`}
      />
    </div>
  )
}
