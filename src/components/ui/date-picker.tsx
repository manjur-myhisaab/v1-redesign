import { useState } from 'react'
import { Calendar as CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

// "October 28, 2026"
function formatLong(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

// "28 Oct 2026"
function formatMedium(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// "28/10/2026"
function formatShort(date: Date): string {
  return date.toLocaleDateString('en-GB')
}

export interface DatePickerProps {
  value?: Date
  onChange?: (date: Date | undefined) => void
  placeholder?: string
  className?: string
  format?: 'long' | 'medium' | 'short'
  /** earliest selectable year (default 1980) */
  fromYear?: number
  /** latest selectable year (default current year + 1) */
  toYear?: number
}

// shadcn date picker: Popover + Button trigger + Calendar (month/year dropdowns).
export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  className,
  format = 'medium',
  fromYear = 1980,
  toYear = new Date().getFullYear() + 1,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)

  const formattedDate = value
    ? format === 'long'
      ? formatLong(value)
      : format === 'short'
        ? formatShort(value)
        : formatMedium(value)
    : null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          data-empty={!value}
          className={cn(
            'min-w-0 justify-start text-left font-normal truncate px-2.5 data-[empty=true]:text-muted-foreground',
            !className?.includes('w-') && 'w-auto sm:w-[200px]',
            className,
          )}
        >
          <CalendarIcon className="size-3.5 shrink-0 text-muted-foreground mr-1.5" />
          <span className="truncate flex-1">{formattedDate || placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          autoFocus
          captionLayout="dropdown"
          startMonth={new Date(fromYear, 0)}
          endMonth={new Date(toYear, 11)}
          defaultMonth={value}
          selected={value}
          onSelect={(date) => {
            onChange?.(date)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
