import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, ShieldCheck, CheckSquare, Square } from 'lucide-react'

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
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  STATIC_PERMISSION_MODULES,
  type RolePermission,
  type RolePermissionItem,
} from '../api/rolesApi.types'
import {
  useCreateRoleMutation,
  useUpdateRoleMutation,
} from '../hooks/useRoles'
import { sound } from '@/lib/sound'

const roleSchema = z.object({
  role_name: z.string().min(1, 'Role name is required'),
})

type RoleFormValues = z.infer<typeof roleSchema>

interface RoleFormModalProps {
  open: boolean
  onClose: () => void
  roleToEdit: RolePermission | null
}

export default function RoleFormModal({
  open,
  onClose,
  roleToEdit,
}: RoleFormModalProps) {
  const createMutation = useCreateRoleMutation()
  const updateMutation = useUpdateRoleMutation()

  const [permissionsState, setPermissionsState] = useState<
    Record<
      string,
      {
        can_read: boolean
        can_write: boolean
        can_edit: boolean
        can_delete: boolean
      }
    >
  >({})

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      role_name: '',
    },
  })

  // Initialize form & matrix when modal opens / roleToEdit changes
  useEffect(() => {
    if (!open) return

    const initialMap: Record<
      string,
      {
        can_read: boolean
        can_write: boolean
        can_edit: boolean
        can_delete: boolean
      }
    > = {}

    STATIC_PERMISSION_MODULES.forEach((mod) => {
      initialMap[mod.id] = {
        can_read: false,
        can_write: false,
        can_edit: false,
        can_delete: false,
      }
    })

    if (roleToEdit) {
      reset({
        role_name: roleToEdit.role_name || '',
      })

      if (Array.isArray(roleToEdit.permissions)) {
        roleToEdit.permissions.forEach((perm: RolePermissionItem) => {
          const modKey = perm.permission_table
          if (modKey) {
            initialMap[modKey] = {
              can_read: Boolean(perm.can_read),
              can_write: Boolean(perm.can_write),
              can_edit: Boolean(perm.can_edit),
              can_delete: Boolean(perm.can_delete),
            }
          }
        })
      }
    } else {
      reset({
        role_name: '',
      })
    }

    setPermissionsState(initialMap)
  }, [open, roleToEdit, reset])

  const togglePermission = (
    moduleKey: string,
    field: 'can_read' | 'can_write' | 'can_edit' | 'can_delete',
  ) => {
    setPermissionsState((prev) => {
      const current = prev[moduleKey] || {
        can_read: false,
        can_write: false,
        can_edit: false,
        can_delete: false,
      }
      return {
        ...prev,
        [moduleKey]: {
          ...current,
          [field]: !current[field],
        },
      }
    })
  }

  const toggleModuleRowAll = (moduleKey: string) => {
    setPermissionsState((prev) => {
      const current = prev[moduleKey] || {
        can_read: false,
        can_write: false,
        can_edit: false,
        can_delete: false,
      }
      const isAllChecked =
        current.can_read &&
        current.can_write &&
        current.can_edit &&
        current.can_delete

      const nextVal = !isAllChecked
      return {
        ...prev,
        [moduleKey]: {
          can_read: nextVal,
          can_write: nextVal,
          can_edit: nextVal,
          can_delete: nextVal,
        },
      }
    })
  }

  const toggleGlobalAll = (select: boolean) => {
    const nextMap: typeof permissionsState = {}
    STATIC_PERMISSION_MODULES.forEach((mod) => {
      nextMap[mod.id] = {
        can_read: select,
        can_write: select,
        can_edit: select,
        can_delete: select,
      }
    })
    setPermissionsState(nextMap)
  }

  const onSubmit = (values: RoleFormValues) => {
    const formattedPermissions = Object.entries(permissionsState).map(
      ([key, perm]) => ({
        permission_table: key,
        can_read: perm.can_read,
        can_write: perm.can_write,
        can_edit: perm.can_edit,
        can_delete: perm.can_delete,
      }),
    )

    if (roleToEdit) {
      updateMutation.mutate(
        {
          role_id: roleToEdit.role_id,
          role_name: values.role_name,
          permissions: formattedPermissions,
        },
        {
          onSuccess: () => {
            sound.success()
            onClose()
          },
        },
      )
    } else {
      createMutation.mutate(
        {
          role_name: values.role_name,
          permissions: formattedPermissions,
        },
        {
          onSuccess: () => {
            sound.success()
            onClose()
          },
        },
      )
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-background text-foreground border-border">
        {/* Header */}
        <DialogHeader className="p-6 border-b border-border bg-muted/20 shrink-0">
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" />
            {roleToEdit ? 'Edit Role & Permissions' : 'Create New Role'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure access rules and module permissions for this role.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Form Body */}
        <form
          id="role-form"
          onSubmit={handleSubmit(onSubmit)}
          className="flex-1 overflow-y-auto p-6 space-y-6"
        >
          {/* Role Name */}
          <div>
            <Label
              htmlFor="role_name"
              className="text-xs font-semibold text-foreground mb-1.5 block"
            >
              Role Name <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="role_name"
              {...register('role_name')}
              placeholder="e.g. Manager, HR Admin, Supervisor"
              className="h-9 text-xs"
            />
            {errors.role_name && (
              <p className="text-[11px] font-medium text-rose-500 mt-1">
                {errors.role_name.message}
              </p>
            )}
          </div>

          {/* Matrix Header + Global Toggles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-foreground">
                  Module Permissions
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Select permissions for each feature table.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => toggleGlobalAll(true)}
                  className="h-7 text-[11px] px-2.5"
                >
                  Select All
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => toggleGlobalAll(false)}
                  className="h-7 text-[11px] px-2.5 text-muted-foreground"
                >
                  Deselect All
                </Button>
              </div>
            </div>

            {/* Matrix Table */}
            <div className="rounded-xl border border-border overflow-hidden divide-y divide-border bg-card">
              <div className="grid grid-cols-6 gap-2 bg-muted/40 px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <div className="col-span-2">Module</div>
                <div className="text-center">Read (View)</div>
                <div className="text-center">Write (Add)</div>
                <div className="text-center">Edit</div>
                <div className="text-center">Delete</div>
              </div>

              {STATIC_PERMISSION_MODULES.map((mod) => {
                const perm = permissionsState[mod.id] || {
                  can_read: false,
                  can_write: false,
                  can_edit: false,
                  can_delete: false,
                }
                const isRowAll =
                  perm.can_read &&
                  perm.can_write &&
                  perm.can_edit &&
                  perm.can_delete

                return (
                  <div
                    key={mod.id}
                    className="grid grid-cols-6 gap-2 px-4 py-3 items-center hover:bg-muted/30 transition-colors text-xs"
                  >
                    {/* Module Name & Quick Row Select */}
                    <div className="col-span-2 flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleModuleRowAll(mod.id)}
                        className="size-6 p-0 text-muted-foreground hover:text-foreground"
                        title={isRowAll ? 'Deselect module' : 'Select all for module'}
                      >
                        {isRowAll ? (
                          <CheckSquare className="size-3.5 text-primary" />
                        ) : (
                          <Square className="size-3.5" />
                        )}
                      </Button>
                      <span className="font-medium text-foreground capitalize">
                        {mod.label}
                      </span>
                    </div>

                    {/* Read */}
                    <div className="flex justify-center">
                      <Checkbox
                        checked={perm.can_read}
                        onCheckedChange={() =>
                          togglePermission(mod.id, 'can_read')
                        }
                        className="border-[#c4c8d1] data-[state=checked]:bg-[#2F63D8] data-[state=checked]:border-[#2F63D8]"
                      />
                    </div>

                    {/* Write */}
                    <div className="flex justify-center">
                      <Checkbox
                        checked={perm.can_write}
                        onCheckedChange={() =>
                          togglePermission(mod.id, 'can_write')
                        }
                        className="border-[#c4c8d1] data-[state=checked]:bg-[#2F63D8] data-[state=checked]:border-[#2F63D8]"
                      />
                    </div>

                    {/* Edit */}
                    <div className="flex justify-center">
                      <Checkbox
                        checked={perm.can_edit}
                        onCheckedChange={() =>
                          togglePermission(mod.id, 'can_edit')
                        }
                        className="border-[#c4c8d1] data-[state=checked]:bg-[#2F63D8] data-[state=checked]:border-[#2F63D8]"
                      />
                    </div>

                    {/* Delete */}
                    <div className="flex justify-center">
                      <Checkbox
                        checked={perm.can_delete}
                        onCheckedChange={() =>
                          togglePermission(mod.id, 'can_delete')
                        }
                        className="border-[#c4c8d1] data-[state=checked]:bg-[#2F63D8] data-[state=checked]:border-[#2F63D8]"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </form>

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
            type="submit"
            form="role-form"
            disabled={isSubmitting}
            className="btn-3d h-8 text-xs bg-primary text-primary-foreground font-medium"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin mr-1.5" />
                Saving...
              </>
            ) : roleToEdit ? (
              'Save Changes'
            ) : (
              'Create Role'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
