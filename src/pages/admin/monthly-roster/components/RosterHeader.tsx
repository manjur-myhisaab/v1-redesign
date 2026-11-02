import React from 'react'
import {
  FileSpreadsheet,
  CalendarDays,
  FileDown,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface RosterHeaderProps {
  onOpenImport: () => void
  onOpenBulkUpdate: () => void
  onOpenDownload: () => void
}

export const RosterHeader: React.FC<RosterHeaderProps> = ({
  onOpenImport,
  onOpenBulkUpdate,
  onOpenDownload,
}) => {
  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5 bg-card">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <CalendarDays className="size-5 text-primary" />
            Employee Monthly Roster
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage monthly shift assignments, bulk updates, and excel rosters.
          </p>
        </div>

        {/* Action buttons (Right) */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Button
              variant="default"
              size="sm"
              onClick={onOpenImport}
              className="gap-2 h-8 text-xs cursor-pointer shadow-2xs"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Import Excel for Bulk Update
            </Button>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="end" className="w-80 p-3 text-xs space-y-1.5">
                <p className="font-semibold text-background">Excel Import Guidelines:</p>
                <ol className="list-decimal list-inside space-y-1 opacity-90 text-[11px] italic">
                  <li>First download Roster Report by selecting the target month to get the template.</li>
                  <li>Make changes in the shifts per day.</li>
                  <li>Import the updated file.</li>
                  <li>Before importing, make sure the target month is selected.</li>
                </ol>
              </TooltipContent>
            </Tooltip>
          </div>

          <Button
            variant="default"
            size="sm"
            onClick={onOpenBulkUpdate}
            className="gap-2 h-8 text-xs cursor-pointer shadow-2xs"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Bulk Shift Update
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onOpenDownload}
            className="gap-2 h-8 text-xs cursor-pointer bg-background"
          >
            <FileDown className="h-3.5 w-3.5 text-muted-foreground" />
            Roster Report
          </Button>
        </div>
      </div>
    </TooltipProvider>
  )
}
