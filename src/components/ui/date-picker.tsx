import { useState } from 'react'
import { Calendar as CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

// "June 26, 2026"
function formatLong(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

interface DatePickerProps {
  value?: Date
  onChange?: (date: Date | undefined) => void
  placeholder?: string
  className?: string
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
  fromYear = 1980,
  toYear = new Date().getFullYear() + 1,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          data-empty={!value}
          className={cn(
            'w-[240px] justify-start text-left font-normal data-[empty=true]:text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="size-4" />
          {value ? formatLong(value) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
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
