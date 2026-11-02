import { apiClient } from '@/api/apiClient'
import type {
  RolePermission,
  CreateRoleRequest,
  UpdateRoleRequest,
  AssignUserRoleItem,
  AssignRoleToUsersRequest,
  UpdateUserRoleItem,
  UserRoleRecord,
  RoleApiResponse,
} from './rolesApi.types'

export const rolesApi = {
  getRoles: async (): Promise<RoleApiResponse<RolePermission[]>> => {
    return apiClient.get('/firm/role-permissions/all')
  },

  createRole: async (data: CreateRoleRequest): Promise<RoleApiResponse<any>> => {
    return apiClient.post('/firm/role-permissions/create', data)
  },

  updateRole: async (data: UpdateRoleRequest): Promise<RoleApiResponse<any>> => {
    return apiClient.put('/firm/role-permissions/update', data)
  },

  deleteRole: async (roleId: string): Promise<RoleApiResponse<any>> => {
    return apiClient.delete(`/firm/role-permissions/delete/${roleId}`)
  },

  assignRoleToUsers: async (data: AssignRoleToUsersRequest): Promise<RoleApiResponse<any>> => {
    return apiClient.post('/firm/user-roles/assign/role/bulk', data)
  },

  assignUserRoles: async (data: AssignUserRoleItem[]): Promise<RoleApiResponse<any>> => {
    return apiClient.post('/firm/user-roles/create', data)
  },

  updateUserRole: async (data: UpdateUserRoleItem): Promise<RoleApiResponse<any>> => {
    return apiClient.put('/firm/user-roles/update', data)
  },

  getUserRoles: async (): Promise<RoleApiResponse<UserRoleRecord[]>> => {
    return apiClient.get('/firm/user-roles/all')
  },

  deleteUserRole: async (userRoleId: string): Promise<RoleApiResponse<any>> => {
    return apiClient.delete(`/firm/user-roles/delete/${userRoleId}`)
  },
}
