import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { sound } from '@/lib/sound'
import { categoriesApi } from '../api/categoriesApi'
import type { Category } from '../api/categoriesApi.types'
import type { CreateCategoryRequest, UpdateCategoryRequest } from '../api/categoriesApi.types'

export function useCategoriesQuery() {
  return useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await categoriesApi.getCategories()
      if (res && res.success && Array.isArray(res.data)) {
        return res.data
      }
      return []
    },
  })
}

export function useCategoryByIdQuery(id: string | undefined) {
  return useQuery<Category>({
    queryKey: ['category', id],
    queryFn: async () => {
      if (!id) throw new Error('No category ID')
      const res = await categoriesApi.getCategoryById(id)
      if (res && res.success && res.data) {
        return res.data
      }
      throw new Error(res?.message || 'Failed to fetch category')
    },
    enabled: !!id,
  })
}

/**
 * Creates one or more categories.
 * Payload: { category_name: string[] }
 * Returns the list of newly created Category objects.
 */
export function useCreateCategoryMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateCategoryRequest) => {
      const res = await categoriesApi.createCategory(data)
      if (res && res.success) {
        toast.success(res.message || 'Category created successfully.')
        return res.data
      }
      throw new Error(res?.message || 'Failed to create category')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create category')
    },
    onSuccess: () => {
      sound.success()
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}

/**
 * Updates a single category name.
 * Payload: { category_id, category_name }
 */
export function useUpdateCategoryMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: UpdateCategoryRequest) => {
      const res = await categoriesApi.updateCategory(data)
      if (res && res.success && res.data) {
        toast.success(res.message || 'Category updated successfully.')
        return res.data
      }
      throw new Error(res?.message || 'Failed to update category')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update category')
    },
    onSuccess: (data) => {
      sound.success()
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      if (data && (data.category_id || (data as any).id)) {
        const id = data.category_id || (data as any).id
        queryClient.invalidateQueries({ queryKey: ['category', id] })
      }
    },
  })
}

/**
 * Deletes one or more categories by ID.
 */
export function useDeleteCategoryMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.all(ids.map((id) => categoriesApi.deleteCategory(id)))
      const successful = results.find((res) => res && res.success)
      if (successful) {
        toast.success(successful.message || 'Category deleted successfully.')
      } else {
        toast.success('Category deleted successfully.')
      }
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete category')
    },
    onSuccess: () => {
      sound.success()
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}

