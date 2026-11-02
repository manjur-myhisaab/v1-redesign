import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { employeesApi } from '../api/employeesApi'
import type { Employee } from '@/lib/employees'
import type { CreateEmployeeRequest, UpdateEmployeeRequest } from '../types/employeesApi.types'

/**
 * Resolves display role string:
 * - If `roles` parameter has items, display all role names comma-separated (e.g. "attendance, HR231")
 * - If `roles` parameter is empty, display what is inside `role` parameter (e.g. user.role -> "OWNER", "MEMBER")
 */
export function resolveEmployeeRoles(rawItem: any, user: any = {}, roles: any[] = []): string {
  const roleList =
    Array.isArray(roles) && roles.length > 0
      ? roles
      : Array.isArray(rawItem?.roles) && rawItem.roles.length > 0
        ? rawItem.roles
        : Array.isArray(user?.roles) && user.roles.length > 0
          ? user.roles
          : []

  const roleNames = roleList
    .map((r: any) => {
      if (!r) return ''
      if (typeof r === 'string') return r.trim()
      return (r.role_name || r.name || r.role || '').trim()
    })
    .filter(Boolean)

  if (roleNames.length > 0) {
    return roleNames.join(', ')
  }

  // Fallback to role parameter inside user or rawItem
  const directRole = user?.role ?? rawItem?.role
  if (Array.isArray(directRole) && directRole.length > 0) {
    const directNames = directRole
      .map((r: any) => {
        if (!r) return ''
        if (typeof r === 'string') return r.trim()
        return (r.role_name || r.name || r.role || String(r)).trim()
      })
      .filter(Boolean)
    if (directNames.length > 0) {
      return directNames.join(', ')
    }
  } else if (typeof directRole === 'string' && directRole.trim()) {
    return directRole.trim()
  }

  return 'MEMBER'
}

export function toEmployee(rawItem: any): Employee {
  if (!rawItem) {
    const emptyUser = { user_id: '' }
    return {
      firm: {},
      user: emptyUser,
      roles: [],
      shifts: [],
      geo_fence: [],
      id: '',
      user_id: '',
      empCode: '',
      name: 'No Name',
      email: '',
      phone: '',
      department: '',
      role: 'MEMBER',
      gender: '',
      managerId: null,
      managerUserId: null,
      shiftId: null,
      managerName: '',
      status: 'Active',
      joined: '',
      monthlyCtc: 0,
      payBasis: 'monthly',
      trackingEnabled: false,
      rawRoles: [],
      rawUser: emptyUser,
      rawFirm: {},
    }
  }

  // Exact API raw response fields ({ firm, user, roles, shifts, geo_fence })
  const firm = rawItem.firm || {}
  const user = rawItem.user || rawItem
  const roles = Array.isArray(rawItem.roles) ? rawItem.roles : Array.isArray(user.roles) ? user.roles : []
  const shifts = Array.isArray(rawItem.shifts) ? rawItem.shifts : Array.isArray(user.shifts) ? user.shifts : []
  const geo_fence = Array.isArray(rawItem.geo_fence) ? rawItem.geo_fence : []

  const firstName = user.first_name || ''
  const lastName = user.last_name || ''
  const fullName = `${firstName} ${lastName}`.trim() || user.mobile_number || 'No Name'

  const g = (user.gender || '').toLowerCase()
  const gender = g === 'male' || g === 'man' ? 'man' : g === 'female' || g === 'woman' ? 'woman' : ''
  const status = user.inactive_date ? 'Inactive' : 'Active'

  let joined = ''
  if (user.doj) {
    const d = new Date(user.doj)
    if (!isNaN(d.getTime())) {
      joined = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
    }
  }

  const shiftId = (Array.isArray(shifts) && shifts[0]?.shift_id) || user.shift_id || null
  const userIdVal = user.user_id || user.ufid || rawItem.user_id || ''

  const resolvedRole = resolveEmployeeRoles(rawItem, user, roles)

  // Extract category and subcategory information from user.categories array or direct properties
  const rawCategories = user.categories || rawItem.categories || []
  const catIds: string[] = []
  const subIds: string[] = []
  let firstCatName = ''
  let firstSubName = ''

  if (Array.isArray(rawCategories)) {
    rawCategories.forEach((item: any) => {
      if (typeof item === 'string' && item) {
        catIds.push(item)
      } else if (item && typeof item === 'object') {
        const cId = item.category_id || item.categoryId || item.id
        if (cId) catIds.push(String(cId))
        if (item.category_name || item.name) {
          if (!firstCatName) firstCatName = item.category_name || item.name
        }

        const rawSubs = item.sub_category_id ?? item.subcategory_id ?? item.sub_category_ids ?? item.subcategories
        if (Array.isArray(rawSubs)) {
          rawSubs.forEach((s) => {
            if (typeof s === 'string' && s) {
              subIds.push(s)
            } else if (s && typeof s === 'object') {
              const sId = s.subcategory_id || s.sub_category_id || s.id
              if (sId) subIds.push(String(sId))
              if (s.subcategory_name || s.name) {
                if (!firstSubName) firstSubName = s.subcategory_name || s.name
              }
            }
          })
        } else if (typeof rawSubs === 'string' && rawSubs) {
          subIds.push(rawSubs)
        }
      }
    })
  }

  const categoryIdVal =
    user.category_id ||
    rawItem.category_id ||
    user.employee_category_id ||
    rawItem.category?.category_id ||
    (catIds.length > 0 ? catIds[0] : '')

  const subcategoryIdVal =
    user.subcategory_id ||
    user.sub_category_id ||
    rawItem.subcategory_id ||
    rawItem.sub_category_id ||
    (subIds.length > 0 ? subIds[0] : '')

  return {
    // Direct API Response Parameters (Exact backend names)
    firm,
    user,
    roles,
    shifts,
    geo_fence,
    user_id: userIdVal,

    // UI Helper properties for backwards compatibility
    id: userIdVal,
    empCode: user.employee_code || '',
    name: fullName,
    email: user.employee_email_address || '',
    phone: user.mobile_number || '',
    department: user.department_name || '',
    role: resolvedRole || 'MEMBER',
    gender,
    managerId: user.supervisor_id || null,
    managerUserId: null,
    shiftId,
    managerName: '',
    status,
    joined,
    monthlyCtc: user.salary_per_month ? Number(user.salary_per_month) * 100 : 0,
    payBasis: user.pay_type || 'monthly',
    trackingEnabled: Boolean(user.live_tracking),
    category:
      user.category_name ||
      user.category ||
      rawItem.category_name ||
      rawItem.category?.category_name ||
      rawItem.category ||
      firstCatName ||
      '',
    categoryId: categoryIdVal,
    subcategory:
      user.subcategory_name ||
      user.sub_category_name ||
      user.subcategory ||
      user.sub_category ||
      rawItem.subcategory_name ||
      rawItem.sub_category_name ||
      firstSubName ||
      '',
    subcategoryId: subcategoryIdVal,
    categoryIds: catIds.length > 0 ? catIds : categoryIdVal ? [categoryIdVal] : [],
    subcategoryIds: subIds.length > 0 ? subIds : subcategoryIdVal ? [subcategoryIdVal] : [],
    rawRoles: roles,
    rawUser: user,
    rawFirm: firm,
  }
}

export function useEmployeesQuery() {
  return useQuery<Employee[]>({
    queryKey: ['employees'],
    queryFn: async () => {
      const res = await employeesApi.getEmployees()
      if (res && res.success && Array.isArray(res.data)) {
        return res.data.map(toEmployee)
      }
      return []
    },
  })
}

export function useEmployeeByIdQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['employee', id],
    queryFn: async () => {
      if (!id) throw new Error('No employee ID')
      const res = await employeesApi.getEmployeeById(id)
      if (res && res.success && res.data) {
        return res.data
      }
      throw new Error(res?.message || 'Failed to fetch employee')
    },
    enabled: !!id,
  })
}

export function useCreateEmployeeMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateEmployeeRequest) => {
      const res = await employeesApi.createEmployee(data)
      if (res && res.success && res.data) {
        toast.success(res.message || 'Employee created successfully.')
        return toEmployee(res.data)
      }
      throw new Error(res?.message || 'Failed to create employee')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create employee')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

export function useUpdateEmployeeMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: UpdateEmployeeRequest) => {
      const res = await employeesApi.updateEmployee(data)
      if (res && res.success && res.data) {
        toast.success(res.message || 'Employee updated successfully.')
        return toEmployee(res.data)
      }
      throw new Error(res?.message || 'Failed to update employee')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update employee')
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      if (variables?.user_id) {
        queryClient.invalidateQueries({ queryKey: ['employee', variables.user_id] })
      }
    },
  })
}

export function useDeleteEmployeeMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.all(ids.map((id) => employeesApi.deleteEmployee(id)))
      const successful = results.find((res) => res && res.success)
      if (successful) {
        toast.success(successful.message || 'Employee(s) deleted successfully.')
      } else {
        toast.success('Employee(s) deleted successfully.')
      }
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete employee(s)')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}
