import { X, PencilIcon, Eye } from 'lucide-react'
import Panel from '@/components/admin/Panel'
import PersonAvatar from '@/components/admin/PersonAvatar'
import { EmployeeAvatar } from '@/lib/people'
import StatusBadge from '@/components/admin/StatusBadge'
import Field from './Field'
import { genderSex, statusTone, type Employee } from '@/lib/employees'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useNavigate } from 'react-router-dom'

interface EmployeePreviewPanelProps {
  activeEmployee: Employee
  closing: boolean
  onClose: () => void
  onAnimationEnd: () => void
  onTrackingChange: (id: string, next: boolean) => void
  msgError: string
  msgBusy: boolean
  onMessage: (id: string) => void
}

export default function EmployeePreviewPanel({
  activeEmployee,
  closing,
  onClose,
  onAnimationEnd,
  onTrackingChange,
  msgError,
  msgBusy: _msgBusy,
  onMessage: _onMessage,
}: EmployeePreviewPanelProps) {
  const navigate = useNavigate()

  return (
    <Panel
      onAnimationEnd={onAnimationEnd}
      className={cn(
        'flex w-72 shrink-0 flex-col duration-200 ease-out',
        closing
          ? 'animate-out fade-out slide-out-to-right-4'
          : 'animate-in fade-in slide-in-from-right-4',
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-start gap-2.5 border-b border-border p-3.5">
          <PersonAvatar name={activeEmployee.name} sex={genderSex(activeEmployee.gender)} className="size-9" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold tracking-tight">
              {activeEmployee.name}
            </div>
            <div className="truncate text-[13px] text-muted-foreground">
              {activeEmployee.role}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </Button>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-3.5 text-[13px]">
          <Field label="Status">
            <StatusBadge tone={statusTone(activeEmployee.status)}>
              {activeEmployee.status}
            </StatusBadge>
          </Field>
          <Field label="Phone">{activeEmployee.phone}</Field>
          <Field label="Email">{activeEmployee.email}</Field>
          <Field label="Category">{activeEmployee.category || '—'}</Field>
          <Field label="Subcategory">{activeEmployee.subcategory || '—'}</Field>
          <Field label="Department">{activeEmployee.department}</Field>
          <Field label="Manager">
            {activeEmployee.managerName ? (
              <span className="inline-flex items-center gap-1.5">
                <EmployeeAvatar name={activeEmployee.managerName} className="size-5" />
                {activeEmployee.managerName}
              </span>
            ) : (
              '—'
            )}
          </Field>
          <Field label="Employee ID">{activeEmployee.empCode}</Field>
          <Field label="Joined">{activeEmployee.joined}</Field>
          <Field label="Live tracking">
            <span className="inline-flex items-center gap-2">
              <span
                className={cn(
                  'text-[12px] font-medium',
                  activeEmployee.trackingEnabled ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {activeEmployee.trackingEnabled ? 'On' : 'Off'}
              </span>
              <Switch
                checked={activeEmployee.trackingEnabled}
                onCheckedChange={(checked) => onTrackingChange(activeEmployee.id, checked)}
                aria-label="Toggle live tracking"
              />
            </span>
          </Field>
        </div>
        {msgError && (
          <div className="border-t border-border px-3 py-2 text-[12px] text-muted-foreground">
            {msgError}
          </div>
        )}
        <div className="flex items-center gap-2 border-t border-border p-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/admin/employees/${activeEmployee.id}`)}
            className="h-7 flex-1 text-[13px] font-medium transition-opacity hover:opacity-90 cursor-pointer"
          >
            <Eye className="size-3.5" />
            View Details
          </Button>
          <Button
            type="button"
            onClick={() => navigate(`/admin/employees/${activeEmployee.id}/edit`)}
            className="h-7 flex-1 text-[13px] font-medium transition-opacity hover:opacity-90 cursor-pointer"
          >
            <PencilIcon className="size-3.5" />
            Edit Details
          </Button>
        </div>
      </div>
    </Panel>
  )
}
