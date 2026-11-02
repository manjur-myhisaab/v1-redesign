import { apiClient } from '@/api/apiClient'
import type {
  CategoryListResponse,
  SingleCategoryResponse,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from './categoriesApi.types'

export const categoriesApi = {
  /**
   * GET /api/v2/firm/category/all
   * Returns all categories for the current firm.
   */
  getCategories: async (): Promise<CategoryListResponse> => {
    return apiClient.get('/firm/category/all')
  },

  /**
   * GET /api/v2/firm/category/details/:id
   */
  getCategoryById: async (id: string): Promise<SingleCategoryResponse> => {
    return apiClient.get(`/firm/category/details/${id}`)
  },

  /**
   * POST /api/v2/firm/category/create
   * Payload: { category_name: string, subCategoryName: SubcategoryItem[] }
   */
  createCategory: async (data: CreateCategoryRequest): Promise<SingleCategoryResponse> => {
    return apiClient.post('/firm/category/create', data)
  },

  /**
   * PUT /api/v2/firm/category/update
   * Payload: { category_id: string, category_name: string, subCategoryName: SubcategoryItem[] }
   */
  updateCategory: async (data: UpdateCategoryRequest): Promise<SingleCategoryResponse> => {
    return apiClient.put('/firm/category/update', data)
  },

  /**
   * DELETE /api/v2/firm/category/delete/:id
   */
  deleteCategory: async (id: string): Promise<SingleCategoryResponse> => {
    return apiClient.delete(`/firm/category/delete/${id}`)
  },
}

