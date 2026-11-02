import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface RosterPaginationProps {
  page: number
  totalPages: number
  itemPerPage: number
  totalItems: number
  onPageChange: (newPage: number) => void
  onItemPerPageChange: (newLimit: number) => void
}

export const RosterPagination: React.FC<RosterPaginationProps> = ({
  page,
  totalPages,
  itemPerPage,
  totalItems,
  onPageChange,
  onItemPerPageChange,
}) => {
  if (totalItems === 0) return null

  return (
    <div className="flex shrink-0 items-center justify-between border-t border-border px-5 py-2.5 bg-background shadow-2xs">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Show</span>
        <Select
          value={String(itemPerPage)}
          onValueChange={(val) => onItemPerPageChange(Number(val))}
        >
          <SelectTrigger className="h-7 w-16 text-xs bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {['10', '25', '50', '100'].map((lim) => (
              <SelectItem key={lim} value={lim} className="text-xs">
                {lim}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          per page · {totalItems} employees
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">
          Page {page} of {totalPages || 1}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="size-7 cursor-pointer bg-background"
          >
            <ChevronLeft className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="size-7 cursor-pointer bg-background"
          >
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
