import { useState } from 'react'
import {
  ShieldCheck,
  Plus,
  Search,
  Pencil,
  Trash2,
  UserPlus,
  Loader2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
import {
  useRolesQuery,
  useDeleteRoleMutation,
} from '../hooks/useRoles'
import type { RolePermission } from '../api/rolesApi.types'
import RoleFormModal from './RoleFormModal'
import AssignRoleModal from './AssignRoleModal'
import { sound } from '@/lib/sound'

export default function RolesList() {
  const { data: roles = [], isLoading, error } = useRolesQuery()
  const deleteMutation = useDeleteRoleMutation()

  const [searchQuery, setSearchQuery] = useState('')

  // Modals state
  const [roleFormOpen, setRoleFormOpen] = useState(false)
  const [roleToEdit, setRoleToEdit] = useState<RolePermission | null>(null)

  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [roleToAssign, setRoleToAssign] = useState<RolePermission | null>(null)

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [roleToDelete, setRoleToDelete] = useState<RolePermission | null>(null)

  const filteredRoles = roles.filter((r) =>
    r.role_name.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleCreateNew = () => {
    setRoleToEdit(null)
    setRoleFormOpen(true)
  }

  const handleEdit = (role: RolePermission) => {
    setRoleToEdit(role)
    setRoleFormOpen(true)
  }

  const handleAssign = (role: RolePermission) => {
    setRoleToAssign(role)
    setAssignModalOpen(true)
  }

  const handleDeletePrompt = (role: RolePermission) => {
    setRoleToDelete(role)
    setDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = () => {
    if (!roleToDelete) return
    deleteMutation.mutate(roleToDelete.role_id, {
      onSuccess: () => {
        sound.success()
        setDeleteConfirmOpen(false)
        setRoleToDelete(null)
      },
    })
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Top Header Card */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border mb-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              Roles &amp; Permissions Management
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Create custom roles, assign granular module permissions, and map employees to roles.
            </p>
          </div>
          <Button
            onClick={handleCreateNew}
            className="btn-3d flex items-center gap-1.5 bg-primary text-primary-foreground font-medium rounded-lg h-9 px-4 text-xs cursor-pointer shrink-0"
          >
            <Plus className="size-3.5" />
            Add New Role
          </Button>
        </div>

        {/* Search & Stats Bar */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search roles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-xs pl-8"
            />
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            Total Roles: <span className="text-foreground font-semibold">{roles.length}</span>
          </span>
        </div>

        {/* Roles Table */}
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          {isLoading ? (
            <div className="flex items-center justify-center p-12 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin mr-2" />
              Loading roles &amp; permissions...
            </div>
          ) : error ? (
            <div className="p-8 text-center text-xs text-rose-500">
              Failed to load roles. Please try again.
            </div>
          ) : filteredRoles.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted-foreground space-y-3">
              <ShieldCheck className="size-8 mx-auto opacity-30 text-muted-foreground" />
              <p>No roles found. Create your first role to get started.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCreateNew}
                className="h-8 text-xs gap-1.5"
              >
                <Plus className="size-3.5" /> Create Role
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="px-4 py-3">Role Name</th>
                    <th className="px-4 py-3">Active Permissions</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRoles.map((role) => {
                    const activePermsCount = Array.isArray(role.permissions)
                      ? role.permissions.filter(
                          (p) =>
                            p.can_read ||
                            p.can_write ||
                            p.can_edit ||
                            p.can_delete,
                        ).length
                      : 0

                    return (
                      <tr
                        key={role.role_id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        {/* Role Name */}
                        <td className="px-4 py-3 font-semibold text-foreground align-top">
                          <div className="flex items-center gap-2">
                            <span>{role.role_name}</span>
                            <Badge variant="outline" className="text-[10px] font-normal py-0 px-1.5">
                              {activePermsCount} modules
                            </Badge>
                          </div>
                        </td>

                        {/* Permissions Badges */}
                        <td className="px-4 py-3 align-top">
                          {Array.isArray(role.permissions) &&
                          role.permissions.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-md">
                              {role.permissions.map((p) => {
                                const activeActions: string[] = []
                                if (p.can_read) activeActions.push('Read')
                                if (p.can_write) activeActions.push('Write')
                                if (p.can_edit) activeActions.push('Edit')
                                if (p.can_delete) activeActions.push('Delete')

                                if (activeActions.length === 0) return null

                                return (
                                  <Badge
                                    key={p.permission_table}
                                    variant="secondary"
                                    className="text-[10px] py-0 px-1.5 bg-muted text-muted-foreground font-normal border border-border"
                                  >
                                    <span className="capitalize font-medium text-foreground mr-1">
                                      {p.permission_table}:
                                    </span>
                                    {activeActions.join(', ')}
                                  </Badge>
                                )
                              })}
                              {role.permissions.every(
                                (p) =>
                                  !p.can_read &&
                                  !p.can_write &&
                                  !p.can_edit &&
                                  !p.can_delete,
                              ) && (
                                <span className="text-[11px] text-muted-foreground italic">
                                  No permissions enabled
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground italic">
                              No permissions configured
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right align-top whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Assign Role Button */}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleAssign(role)}
                              className="h-7 text-[11px] gap-1 px-2 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                              title="Assign role to employees"
                            >
                              <UserPlus className="size-3" />
                              Assign
                            </Button>

                            {/* Edit Button */}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(role)}
                              className="size-7 text-muted-foreground hover:text-foreground"
                              title="Edit role permissions"
                            >
                              <Pencil className="size-3.5" />
                            </Button>

                            {/* Delete Button */}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeletePrompt(role)}
                              className="size-7 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                              title="Delete role"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Role Create/Edit Modal */}
      <RoleFormModal
        open={roleFormOpen}
        onClose={() => setRoleFormOpen(false)}
        roleToEdit={roleToEdit}
      />

      {/* Assign Role Modal */}
      <AssignRoleModal
        open={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        role={roleToAssign}
      />

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the role{' '}
              <strong className="text-foreground font-semibold">
                "{roleToDelete?.role_name}"
              </strong>{' '}
              and remove its permissions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmDelete()
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Role'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
