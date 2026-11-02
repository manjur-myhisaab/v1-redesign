// ─── Subcategory Item within Category ──────────────────────────────────────────

export interface SubcategoryItem {
  subcategory_id?: string
  subcategory_name: string
}

// ─── Category (actual API response shape) ─────────────────────────────────────

export interface Category {
  category_id: string
  firm_id?: string
  category_name: string
  status?: 'active' | 'inactive'
  user_created?: string
  user_updated?: string
  created_at?: string
  updated_at?: string
  subCategoryName?: SubcategoryItem[]
  subcategories?: SubcategoryItem[]
}

// ─── Generic wrapper matching the API envelope ─────────────────────────────────
export interface CategoryResponse<T> {
  success: boolean
  message: string
  data: T
}

export type CategoryListResponse = CategoryResponse<Category[]>
export type SingleCategoryResponse = CategoryResponse<Category>

// ─── Request payloads ──────────────────────────────────────────────────────────

/**
 * POST /api/v2/firm/category/create
 */
export interface CreateCategoryRequest {
  category_name: string
  subCategoryName: SubcategoryItem[]
}

/**
 * PUT /api/v2/firm/category/update
 */
export interface UpdateCategoryRequest {
  category_id: string
  category_name: string
  subCategoryName: SubcategoryItem[]
}

