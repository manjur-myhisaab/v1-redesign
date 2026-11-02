import React from 'react'
import { useState } from 'react'
import { Users, RefreshCw, PlusCircle, Check, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { useShiftsQuery, useBulkAssignShiftsMutation } from '../hooks/useShifts'
import { useEmployeesQuery } from '@/features/employees/hooks/useEmployees'
import type { Employee } from '@/lib/employees'

interface BulkAssignModalProps {
  open: boolean
  onClose: () => void
  initialShiftId?: string
}

export default function BulkAssignModal({ open, onClose, initialShiftId }: BulkAssignModalProps) {
  const { data: shifts = [] } = useShiftsQuery()
  const { data: rawEmployees = [] } = useEmployeesQuery()
  const employees: Employee[] = React.useMemo(
    () =>
      rawEmployees.filter((e: Employee) => {
        const st = (e.status || '').toLowerCase()
        return st !== 'archived' && st !== 'suspended'
      }),
    [rawEmployees],
  )
  const bulkAssignMutation = useBulkAssignShiftsMutation()

  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [selectedShifts, setSelectedShifts] = useState<string[]>(initialShiftId ? [initialShiftId] : [])
  const [mode, setMode] = useState<'delete_and_insert' | 'create_and_insert'>('delete_and_insert')
  const [searchQuery, setSearchQuery] = useState('')

  const isSubmitting = bulkAssignMutation.isPending

  const toggleUser = (userId: string) => {
    setSelectedUsers((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]))
  }

  const toggleAllUsers = () => {
    if (selectedUsers.length === employees.length) {
      setSelectedUsers([])
    } else {
      setSelectedUsers(employees.map((e) => e.id))
    }
  }

  const toggleShift = (shiftId: string) => {
    setSelectedShifts((prev) => (prev.includes(shiftId) ? prev.filter((id) => id !== shiftId) : [...prev, shiftId]))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedUsers.length === 0) {
      alert('Please select at least one employee.')
      return
    }
    if (selectedShifts.length === 0) {
      alert('Please select at least one shift.')
      return
    }

    await bulkAssignMutation.mutateAsync({
      user_ids: selectedUsers,
      shift_ids: selectedShifts,
      mode,
    })

    onClose()
  }

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (emp.department && emp.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (emp.phone && emp.phone.includes(searchQuery)),
  )

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-background text-foreground border-border">
        {/* Header */}
        <DialogHeader className="p-6 border-b border-border bg-muted/20">
          <DialogTitle className="text-lg font-semibold flex items-center gap-2 text-foreground">
            <Users className="size-5 text-primary" />
            Bulk Assign Shifts
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Assign shifts to multiple employees in bulk with replace or append mode.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto p-6 space-y-6">
          {/* Assignment Mode Selector */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground">Assignment Mode</Label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setMode('delete_and_insert')}
                className={cn(
                  'flex items-start gap-3 rounded-xl border p-3 text-left transition-all',
                  mode === 'delete_and_insert'
                    ? 'border-primary bg-primary/10 text-primary shadow-xs'
                    : 'border-border bg-card hover:bg-muted/50 text-muted-foreground',
                )}
              >
                <RefreshCw className="size-4 mt-0.5 shrink-0" />
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    Replace Existing Shifts
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    `delete_and_insert`: Replaces existing shift assignments for the selected users.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode('create_and_insert')}
                className={cn(
                  'flex items-start gap-3 rounded-xl border p-3 text-left transition-all',
                  mode === 'create_and_insert'
                    ? 'border-primary bg-primary/10 text-primary shadow-xs'
                    : 'border-border bg-card hover:bg-muted/50 text-muted-foreground',
                )}
              >
                <PlusCircle className="size-4 mt-0.5 shrink-0" />
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    Add to Existing Shifts
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    `create_and_insert`: Appends new shifts alongside user's current shifts.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Select Shifts */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground">
              Select Target Shifts ({selectedShifts.length} selected)
            </Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 max-h-36 overflow-y-auto p-1.5 border border-border rounded-xl bg-card">
              {shifts.map((s) => {
                const isSelected = selectedShifts.includes(s.shift_id)
                return (
                  <button
                    key={s.shift_id}
                    type="button"
                    onClick={() => toggleShift(s.shift_id)}
                    className={cn(
                      'flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-all',
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary font-medium'
                        : 'border-border bg-background hover:bg-muted text-foreground',
                    )}
                  >
                    <div className="truncate">
                      <span className="text-xs font-semibold block truncate">{s.shift_name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {s.shift_from?.substring(0, 5)} - {s.shift_to?.substring(0, 5)} ({s.shift_type})
                      </span>
                    </div>
                    {isSelected && <Check className="size-4 text-primary shrink-0 ml-2" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Select Employees */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground">
                Select Employees ({selectedUsers.length} selected)
              </Label>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={toggleAllUsers}
                className="text-xs h-auto p-0"
              >
                {selectedUsers.length === employees.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs"
              />
            </div>

            <div className="max-h-48 overflow-y-auto rounded-xl border border-border divide-y divide-border bg-card">
              {filteredEmployees.map((emp) => {
                const isSelected = selectedUsers.includes(emp.id)
                return (
                  <label
                    key={emp.id}
                    className="flex items-center justify-between px-3 py-2 text-xs hover:bg-muted/40 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleUser(emp.id)}
                        className="border-[#c4c8d1] data-[state=checked]:bg-[#2F63D8] data-[state=checked]:border-[#2F63D8]"
                      />
                      <div>
                        <span className="font-medium text-foreground">{emp.name}</span>
                        {emp.department && (
                          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {emp.department}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{emp.phone || emp.empCode || (emp as any).employeeCode}</span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Footer Actions */}
          <DialogFooter className="mt-auto border-t border-border pt-4 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="text-xs font-semibold"
            >
              {isSubmitting ? 'Assigning...' : 'Confirm Bulk Assign'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
