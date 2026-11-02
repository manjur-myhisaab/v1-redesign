import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { rolesApi } from '../api/rolesApi'
import type {
  RolePermission,
  CreateRoleRequest,
  UpdateRoleRequest,
  AssignUserRoleItem,
  AssignRoleToUsersRequest,
  UpdateUserRoleItem,
} from '../api/rolesApi.types'

export function useRolesQuery() {
  return useQuery<RolePermission[]>({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await rolesApi.getRoles()
      if (res && res.success && Array.isArray(res.data)) {
        return res.data
      }
      return []
    },
  })
}

export function useCreateRoleMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateRoleRequest) => {
      const res = await rolesApi.createRole(data)
      if (res && res.success) {
        toast.success(res.message || 'Role created successfully.')
        return res.data
      }
      throw new Error(res?.message || 'Failed to create role')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create role')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
    },
  })
}

export function useUpdateRoleMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: UpdateRoleRequest) => {
      const res = await rolesApi.updateRole(data)
      if (res && res.success) {
        toast.success(res.message || 'Role updated successfully.')
        return res.data
      }
      throw new Error(res?.message || 'Failed to update role')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update role')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
    },
  })
}

export function useDeleteRoleMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (roleId: string) => {
      const res = await rolesApi.deleteRole(roleId)
      if (res && res.success) {
        toast.success(res.message || 'Role deleted successfully.')
        return res.data
      }
      throw new Error(res?.message || 'Failed to delete role')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete role')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
    },
  })
}

export function useAssignRoleToUsersMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: AssignRoleToUsersRequest) => {
      const res = await rolesApi.assignRoleToUsers(data)
      if (res && res.success) {
        toast.success(res.message || 'Role assigned successfully.')
        return res.data
      }
      throw new Error(res?.message || 'Failed to assign roles')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to assign roles')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles'] })
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

export function useAssignUserRolesMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: AssignUserRoleItem[]) => {
      const res = await rolesApi.assignUserRoles(data)
      if (res && res.success) {
        return res.data
      }
      throw new Error(res?.message || 'Failed to assign roles')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to assign roles')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles'] })
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

export function useUpdateUserRoleMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: UpdateUserRoleItem) => {
      const res = await rolesApi.updateUserRole(data)
      if (res && res.success) {
        return res.data
      }
      throw new Error(res?.message || 'Failed to update user role')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update user role')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles'] })
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

export function useUserRolesQuery() {
  return useQuery({
    queryKey: ['user-roles'],
    queryFn: async () => {
      const res = await rolesApi.getUserRoles()
      if (res && res.success && Array.isArray(res.data)) {
        return res.data
      }
      return []
    },
  })
}

export function useDeleteUserRoleMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (userRoleId: string) => {
      const res = await rolesApi.deleteUserRole(userRoleId)
      if (res && res.success) {
        toast.success(res.message || 'Role removed from employee successfully.')
        return res.data
      }
      throw new Error(res?.message || 'Failed to remove role from employee')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to remove role from employee')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles'] })
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}
