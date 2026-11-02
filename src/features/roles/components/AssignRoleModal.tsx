import { useState, useEffect, useMemo } from 'react'
import { Loader2, UserPlus, Search, Users, Trash2, UserCheck, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { type RolePermission, type RoleAssignMode } from '../api/rolesApi.types'
import {
  useAssignRoleToUsersMutation,
  useUserRolesQuery,
  useDeleteUserRoleMutation,
} from '../hooks/useRoles'
import { useEmployeesQuery } from '@/features/employees/hooks/useEmployees'
import type { Employee } from '@/lib/employees'
import { sound } from '@/lib/sound'

interface AssignRoleModalProps {
  open: boolean
  onClose: () => void
  role: RolePermission | null
}

export default function AssignRoleModal({
  open,
  onClose,
  role,
}: AssignRoleModalProps) {
  const assignRoleMutation = useAssignRoleToUsersMutation()
  const deleteMutation = useDeleteUserRoleMutation()

  const { data: rawEmployees = [], isLoading: loadingEmployees } = useEmployeesQuery()
  const employees: Employee[] = useMemo(
    () =>
      rawEmployees.filter((e: Employee) => {
        const st = (e.status || '').toLowerCase()
        return st !== 'archived' && st !== 'suspended'
      }),
    [rawEmployees],
  )
  const { data: userRoles = [], isLoading: loadingUserRoles } = useUserRolesQuery()

  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Assignment Mode Prompt State
  const [modePromptOpen, setModePromptOpen] = useState(false)
  const [selectedMode, setSelectedMode] = useState<RoleAssignMode>('delete_and_insert')

  // Reset selection on open/close
  useEffect(() => {
    if (!open) {
      setSelectedUserIds([])
      setSearchQuery('')
      setModePromptOpen(false)
      setSelectedMode('delete_and_insert')
    }
  }, [open])

  // Get currently assigned employee objects for TOP section
  const assignedEmployees = employees.filter((emp) => {
    if (!role) return false
    const empUserId = emp.user_id || emp.id
    const empRoles = emp.roles || emp.rawRoles || []
    const hasInEmpRoles = empRoles.some(
      (r: any) =>
        (typeof r === 'string' && (r === role.role_id || r === role.role_name)) ||
        (r && (r.role_id === role.role_id || r.role_name === role.role_name))
    )
    const hasInUserRoles = userRoles.some(
      (ur) => ur.user_id === empUserId && ur.role_id === role.role_id
    )
    return hasInEmpRoles || hasInUserRoles
  })

  // Remove role handler — deletes strictly by user_role_id
  const handleRemoveRole = async (empUserId: string) => {
    if (!role) return
    const emp = employees.find((e) => (e.user_id || e.id) === empUserId)
    const empRoles = emp?.roles || emp?.rawRoles || []

    const empUserIds = [
      empUserId,
      emp?.user_id,
      emp?.id,
      emp?.user?.user_id,
      emp?.rawUser?.user_id,
    ]
      .filter(Boolean)
      .map((s) => String(s).trim())

    // 1. Search in userRoles list (/firm/user-roles/all) by user_id and role_id
    const matchInUserRoles = userRoles.find(
      (ur) =>
        empUserIds.includes(String(ur.user_id).trim()) &&
        String(ur.role_id).trim() === String(role.role_id).trim()
    )

    // 2. Search in emp.roles array by role_id or role_name
    const matchInEmpRoles = empRoles.find((r: any) => {
      if (!r || typeof r !== 'object') return false
      return (
        String(r.role_id || '').trim() === String(role.role_id).trim() ||
        String(r.role_name || '').trim() === String(role.role_name).trim()
      )
    })

    const userRoleId =
      matchInUserRoles?.user_role_id ||
      (matchInUserRoles as any)?.id ||
      matchInEmpRoles?.user_role_id ||
      matchInEmpRoles?.id

    if (!userRoleId) {
      toast.error('Unable to find user_role_id for deletion.')
      return
    }

    setDeletingId(empUserId)
    deleteMutation.mutate(userRoleId, {
      onSuccess: () => {
        sound.success()
        setSelectedUserIds((prev) => prev.filter((id) => id !== empUserId))
        setDeletingId(null)
      },
      onError: () => {
        sound.error()
        setDeletingId(null)
      },
    })
  }

  const assignedEmpIds = new Set(assignedEmployees.map((e) => e.user_id || e.id))

  const filteredEmployees = employees.filter((emp) => {
    const empUserId = emp.user_id || emp.id
    // Exclude employees who already have this role assigned (they are in the top section)
    if (assignedEmpIds.has(empUserId)) return false

    const q = searchQuery.toLowerCase()
    return (
      emp.name.toLowerCase().includes(q) ||
      (emp.department && emp.department.toLowerCase().includes(q)) ||
      (emp.phone && emp.phone.includes(q))
    )
  })

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    )
  }

  const toggleAll = () => {
    if (selectedUserIds.length === filteredEmployees.length) {
      setSelectedUserIds([])
    } else {
      setSelectedUserIds(filteredEmployees.map((e) => e.user_id || e.id))
    }
  }

  // Trigger Mode Selection Prompt on Submit click
  const handleStartSubmit = () => {
    if (!role) return
    if (selectedUserIds.length === 0) {
      toast.error('Please select at least one employee to assign.')
      return
    }
    setModePromptOpen(true)
  }

  // Execute API payload with chosen mode
  const handleConfirmAssignment = async () => {
    if (!role) return
    const payload = {
      user_ids: selectedUserIds,
      role_ids: [role.role_id],
      mode: selectedMode,
    }

    try {
      await assignRoleMutation.mutateAsync(payload)
      sound.success()
      setSelectedUserIds([])
      setModePromptOpen(false)
    } catch {
      sound.error()
    }
  }

  if (!role) return null

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-background text-foreground border-border">
          {/* Header */}
          <DialogHeader className="p-5 border-b border-border bg-muted/20 shrink-0">
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <UserPlus className="size-4 text-primary" />
              Manage Role: <span className="text-primary">{role.role_name}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              View assigned employees or select employees to assign the {role.role_name} role.
            </DialogDescription>
          </DialogHeader>

          {/* Body */}
          <div className="p-5 flex-1 overflow-y-auto space-y-5">
            {/* TOP SECTION: Currently Assigned Employees */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <UserCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  Assigned Employees ({assignedEmployees.length})
                </h3>
                {assignedEmployees.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    Active role holders
                  </span>
                )}
              </div>

              <div className="max-h-40 overflow-y-auto rounded-xl border border-border divide-y divide-border bg-muted/10">
                {loadingEmployees || loadingUserRoles ? (
                  <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="size-3.5 animate-spin" />
                    Loading assigned employees...
                  </div>
                ) : assignedEmployees.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    No employees currently assigned to this role.
                  </div>
                ) : (
                  assignedEmployees.map((emp) => {
                    const empUserId = emp.user_id || emp.id
                    const isDeletingThis = deletingId === empUserId
                    return (
                      <div
                        key={empUserId}
                        className="flex items-center justify-between px-3.5 py-2 text-xs hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-semibold">
                            {emp.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-foreground">
                              {emp.name}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {emp.phone || emp.department || 'Employee'}
                            </div>
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isDeletingThis}
                          onClick={() => handleRemoveRole(empUserId)}
                          className="h-7 text-xs px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 gap-1"
                        >
                          {isDeletingThis ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Trash2 className="size-3" />
                          )}
                          Remove Role
                        </Button>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <hr className="border-border" />

            {/* BOTTOM SECTION: Assign / Select Employees */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Users className="size-3.5 text-primary" />
                  Select Employees to Assign
                </h3>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={toggleAll}
                  className="text-xs h-auto p-0 shrink-0"
                >
                  {selectedUserIds.length === filteredEmployees.length &&
                  filteredEmployees.length > 0
                    ? 'Deselect All'
                    : 'Select All'}
                </Button>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search employees by name, phone or dept..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 text-xs pl-8"
                />
              </div>

              {/* Selection List */}
              <div className="max-h-48 overflow-y-auto rounded-xl border border-border divide-y divide-border bg-card">
                {loadingEmployees ? (
                  <div className="p-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    Loading employees...
                  </div>
                ) : filteredEmployees.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    No employees found.
                  </div>
                ) : (
                  filteredEmployees.map((emp) => {
                    const targetId = emp.user_id || emp.id
                    const isSelected = selectedUserIds.includes(targetId)
                    return (
                      <label
                        key={targetId}
                        className="flex items-center justify-between px-3.5 py-2.5 text-xs hover:bg-muted/40 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleUser(targetId)}
                            className="border-[#c4c8d1] data-[state=checked]:bg-[#2F63D8] data-[state=checked]:border-[#2F63D8]"
                          />
                          <div className="font-medium text-foreground">
                            {emp.name}
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {emp.phone || emp.department}
                        </span>
                      </label>
                    )
                  })
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {selectedUserIds.length} employee(s) selected
              </p>
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="p-4 border-t border-border bg-muted/10 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleStartSubmit}
              disabled={assignRoleMutation.isPending || selectedUserIds.length === 0}
              className="btn-3d h-8 text-xs bg-primary text-primary-foreground font-medium"
            >
              {assignRoleMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Assigning...
                </>
              ) : (
                `Assign to ${selectedUserIds.length} Employee(s)`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODE SELECTION DIALOG (Prompted after Save / Assign click) ── */}
      <AlertDialog open={modePromptOpen} onOpenChange={setModePromptOpen}>
        <AlertDialogContent className="max-w-md bg-background border-border text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-semibold flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              Select Role Assignment Mode
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Choose how the role <strong className="text-foreground">{role.role_name}</strong> should be applied to {selectedUserIds.length} selected employee(s).
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3 py-2">
            {/* Mode Option 1: delete_and_insert */}
            <div
              onClick={() => setSelectedMode('delete_and_insert')}
              className={cn(
                'flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all',
                selectedMode === 'delete_and_insert'
                  ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-xs'
                  : 'border-border bg-card hover:bg-muted/30'
              )}
            >
              <input
                type="radio"
                name="assign_mode"
                checked={selectedMode === 'delete_and_insert'}
                onChange={() => setSelectedMode('delete_and_insert')}
                className="mt-0.5 accent-primary cursor-pointer"
              />
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  Replace Existing Roles
                  <span className="font-mono text-[10px] text-muted-foreground font-normal">
                    (delete_and_insert)
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Deletes all previous roles assigned to selected employees and sets this role as their new role.
                </p>
              </div>
            </div>

            {/* Mode Option 2: create_and_insert */}
            <div
              onClick={() => setSelectedMode('create_and_insert')}
              className={cn(
                'flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all',
                selectedMode === 'create_and_insert'
                  ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-xs'
                  : 'border-border bg-card hover:bg-muted/30'
              )}
            >
              <input
                type="radio"
                name="assign_mode"
                checked={selectedMode === 'create_and_insert'}
                onChange={() => setSelectedMode('create_and_insert')}
                className="mt-0.5 accent-primary cursor-pointer"
              />
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  Add / Append Roles
                  <span className="font-mono text-[10px] text-muted-foreground font-normal">
                    (create_and_insert)
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Keeps existing roles assigned to selected employees and adds this role alongside them.
                </p>
              </div>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs h-8">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmAssignment()
              }}
              disabled={assignRoleMutation.isPending}
              className="btn-3d text-xs h-8 bg-primary text-primary-foreground font-medium"
            >
              {assignRoleMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Assigning...
                </>
              ) : (
                'Confirm & Assign'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
