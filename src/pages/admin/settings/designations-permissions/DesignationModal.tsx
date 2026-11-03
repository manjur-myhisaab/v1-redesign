import React, { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ShieldCheck, Loader2, Save } from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useAuth } from '@/context/auth/AuthContext'
import rdk, { createItem, updateItem } from '@/services/server'
import { sound } from '@/lib/sound'

interface DesignationSheetProps {
  open: boolean
  onClose: () => void
  designationToEdit?: any | null
  onSuccess?: () => void
}

export const AVAILABLE_MODULES = [
  'attendance',
  'salary',
  'incentive',
  'expense',
  'loan',
  'employee',
  'shift',
  'payroll Config',
  'geoFencing',
]

interface ModulePermission {
  module: string
  view: boolean
  add: boolean
  edit: boolean
  delete: boolean
}

export const DesignationModal: React.FC<DesignationSheetProps> = ({
  open,
  onClose,
  designationToEdit,
  onSuccess,
}) => {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const isEdit = Boolean(designationToEdit?.designation_id || designationToEdit?.id)
  const desigId = designationToEdit?.designation_id || designationToEdit?.id

  const [designationName, setDesignationName] = useState('')
  const [permissions, setPermissions] = useState<ModulePermission[]>([])

  const getEmptyPermissions = (): ModulePermission[] => {
    return AVAILABLE_MODULES.map((m) => ({
      module: m,
      view: false,
      add: false,
      edit: false,
      delete: false,
    }))
  }

  const getMergedPermissions = (existing: any[]): ModulePermission[] => {
    const map = new Map<string, any>(existing.map((p) => [p.module, p]))
    return AVAILABLE_MODULES.map((m) => {
      const found = map.get(m)
      return {
        module: m,
        view: Boolean(found?.view),
        add: Boolean(found?.add),
        edit: Boolean(found?.edit),
        delete: Boolean(found?.delete),
      }
    })
  }

  useEffect(() => {
    if (designationToEdit) {
      setDesignationName(designationToEdit.designation_name || '')
      setPermissions(getMergedPermissions(designationToEdit.designation_permissions || []))
    } else {
      setDesignationName('')
      setPermissions(getEmptyPermissions())
    }
  }, [designationToEdit, open])

  const togglePermission = (index: number, action: 'view' | 'add' | 'edit' | 'delete') => {
    setPermissions((prev) => {
      const copy = [...prev]
      copy[index] = {
        ...copy[index],
        [action]: !copy[index][action],
      }
      return copy
    })
  }

  const toggleAllInRow = (index: number) => {
    setPermissions((prev) => {
      const copy = [...prev]
      const current = copy[index]
      const allEnabled = current.view && current.add && current.edit && current.delete
      copy[index] = {
        ...current,
        view: !allEnabled,
        add: !allEnabled,
        edit: !allEnabled,
        delete: !allEnabled,
      }
      return copy
    })
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (!designationName.trim()) {
        throw new Error('Designation title is required')
      }

      const firmId = (user as any)?.firm_id?.firm_id || (user as any)?.firm_id || 8
      const validPermissions = permissions.filter(
        (p) => p.view || p.add || p.edit || p.delete
      )

      const payload = {
        designation_name: designationName.trim(),
        designation_permissions: validPermissions,
        firm_id: Number(firmId) || 8,
      }

      if (isEdit) {
        return await rdk.request(updateItem('designations', desigId, payload))
      } else {
        return await rdk.request(createItem('designations', payload))
      }
    },
    onSuccess: async () => {
      sound.success()
      toast.success(isEdit ? 'Designation updated successfully' : 'Designation created successfully')
      
      await queryClient.invalidateQueries({ queryKey: ['designations'] })
      await queryClient.refetchQueries({ queryKey: ['designations'] })
      
      onSuccess?.()
      onClose()
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to save designation')
    },
  })

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="sm:max-w-xl md:max-w-2xl w-full flex flex-col p-0 gap-0 overflow-hidden shadow-2xl">
        {/* Fixed Header */}
        <SheetHeader className="px-6 py-4 border-b border-border shrink-0 bg-background/95 backdrop-blur-xs">
          <SheetTitle className="flex items-center gap-2 text-base font-semibold">
            <ShieldCheck className="size-5 text-primary" />
            {isEdit ? 'Edit Designation & Permissions' : 'Create New Designation'}
          </SheetTitle>
        </SheetHeader>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 min-h-0">
          <div className="space-y-1.5">
            <Label htmlFor="designation_name" className="text-xs font-medium">Designation Title *</Label>
            <Input
              id="designation_name"
              value={designationName}
              onChange={(e) => setDesignationName(e.target.value)}
              placeholder="e.g. Supervisor 1, Branch Manager, HR Associate"
              className="h-9 text-xs"
            />
          </div>

          {/* Module Permission Matrix Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground">Module Access Permissions</Label>
              <span className="text-[11px] text-muted-foreground">Select actions allowed for this designation</span>
            </div>

            <div className="rounded-xl border border-border overflow-hidden bg-card shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/60 text-muted-foreground border-b border-border text-[11px] font-semibold uppercase tracking-wider sticky top-0 z-10 backdrop-blur-xs">
                  <tr>
                    <th className="py-2.5 px-4 font-medium">Module</th>
                    <th className="py-2.5 px-3 text-center font-medium">View</th>
                    <th className="py-2.5 px-3 text-center font-medium">Add</th>
                    <th className="py-2.5 px-3 text-center font-medium">Edit</th>
                    <th className="py-2.5 px-3 text-center font-medium">Delete</th>
                    <th className="py-2.5 px-3 text-center font-medium">Toggle All</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {permissions.map((row, idx) => (
                    <tr key={row.module} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-4 font-medium text-foreground capitalize">
                        {row.module.replace('Config', ' Configuration')}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Checkbox
                          checked={row.view}
                          onCheckedChange={() => togglePermission(idx, 'view')}
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Checkbox
                          checked={row.add}
                          onCheckedChange={() => togglePermission(idx, 'add')}
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Checkbox
                          checked={row.edit}
                          onCheckedChange={() => togglePermission(idx, 'edit')}
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Checkbox
                          checked={row.delete}
                          onCheckedChange={() => togglePermission(idx, 'delete')}
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => toggleAllInRow(idx)}
                          className="text-[11px] text-primary hover:underline font-medium cursor-pointer"
                        >
                          {row.view && row.add && row.edit && row.delete ? 'Clear' : 'Select All'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Fixed Footer */}
        <SheetFooter className="px-6 py-3.5 border-t border-border bg-muted/20 shrink-0 flex flex-row items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={mutation.isPending}
            className="text-xs h-8 cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="text-xs h-8 gap-1.5 cursor-pointer"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="size-3.5" />
                <span>{isEdit ? 'Save Changes' : 'Create Designation'}</span>
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export default DesignationModal
