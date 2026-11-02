import * as React from 'react'
import {
  Search,
  ListFilter,
  Plus,
  X,
  Trash2,
  Loader2,
  Tag,
  Check,
  Pencil,
} from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  useCategoriesQuery,
  useCategoryByIdQuery,
  useCreateCategoryMutation,
  useDeleteCategoryMutation,
  useUpdateCategoryMutation,
} from '../hooks/useCategories'
import type { Category, SubcategoryItem } from '../api/categoriesApi.types'

// ─── RowCheckbox — wraps Radix Checkbox with indeterminate support ─────────────
function RowCheckbox({ checked, indeterminate, onChange }: {
  checked: boolean
  indeterminate?: boolean
  onChange: () => void
}) {
  return (
    <Checkbox
      checked={indeterminate ? 'indeterminate' : checked}
      onCheckedChange={onChange}
      className="cursor-pointer border-[#c4c8d1] data-[state=checked]:bg-[#2F63D8] data-[state=indeterminate]:bg-[#2F63D8] data-[state=checked]:border-[#2F63D8] data-[state=indeterminate]:border-[#2F63D8]"
    />
  )
}

// ─── CategoryModal — handles creation/editing ─────────────────────────────────
interface CategoryModalProps {
  open: boolean
  onClose: () => void
  editId: string | null
}

function CategoryModal({ open, onClose, editId }: CategoryModalProps) {
  const createMutation = useCreateCategoryMutation()
  const updateMutation = useUpdateCategoryMutation()

  const { data: categories = [] } = useCategoriesQuery()
  const categoryFromList = React.useMemo(() => {
    return categories.find((c) => c.category_id === editId)
  }, [categories, editId])

  const { data: categoryDetail, isLoading: loadingDetail } = useCategoryByIdQuery(
    editId || undefined
  )

  const activeDetail = categoryFromList || categoryDetail

  const [name, setName] = React.useState('')
  const [subList, setSubList] = React.useState<SubcategoryItem[]>([])

  React.useEffect(() => {
    if (open) {
      if (editId) {
        if (activeDetail) {
          setName(activeDetail.category_name)
          setSubList(activeDetail.subcategories || activeDetail.subCategoryName || [])
        }
      } else {
        setName('')
        setSubList([])
      }
    }
  }, [editId, activeDetail, open])

  const handleAddSub = () => {
    setSubList([...subList, { subcategory_name: '' }])
  }

  const handleRemoveSub = (index: number) => {
    setSubList(subList.filter((_, i) => i !== index))
  }

  const handleSubNameChange = (index: number, val: string) => {
    const next = [...subList]
    next[index].subcategory_name = val
    setSubList(next)
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  const handleSave = async () => {
    if (!name.trim()) return
    const validSubs = subList
      .map((s) => ({
        subcategory_id: s.subcategory_id,
        subcategory_name: s.subcategory_name.trim(),
      }))
      .filter((s) => s.subcategory_name !== '')

    try {
      if (editId) {
        await updateMutation.mutateAsync({
          category_id: editId,
          category_name: name.trim(),
          subCategoryName: validSubs,
        })
      } else {
        await createMutation.mutateAsync({
          category_name: name.trim(),
          subCategoryName: validSubs,
        })
      }
      onClose()
    } catch (err) {
      // Toast notifications are already handled inside hooks
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl border-border bg-background shadow-xl border p-6">
        <DialogHeader className="flex flex-row items-center gap-2 border-b border-border pb-4">
          <Tag className="size-4.5 text-primary shrink-0" />
          <DialogTitle className="text-sm font-semibold tracking-tight text-foreground">
            {editId ? 'Edit Category Details' : 'Create New Category'}
          </DialogTitle>
        </DialogHeader>

        {editId && loadingDetail ? (
          <div className="flex h-44 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5 py-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wide">
                Category Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Jaipur, Chandigarh, Delhi"
                className="h-10 text-xs bg-background/50 border border-border focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary rounded-xl"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
                    Subcategories
                  </span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    {subList.length}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleAddSub}
                  className="h-7 px-2.5 text-[11px] font-semibold text-primary hover:text-primary/80 hover:bg-primary/5 rounded-lg"
                >
                  <Plus className="size-3 mr-1" />
                  Add Subcategory
                </Button>
              </div>

              {subList.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground bg-muted/10">
                  No subcategories added yet. Click "Add Subcategory" to specify.
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                  {subList.map((sub, idx) => (
                    <div key={idx} className="flex items-center gap-2 group">
                      <div className="flex-1 relative">
                        <Input
                          value={sub.subcategory_name}
                          onChange={(e) => handleSubNameChange(idx, e.target.value)}
                          placeholder="Subcategory name (e.g. Tech, HR, Sales)"
                          className="h-9 text-xs bg-background/50 border border-border focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary rounded-xl pr-12"
                        />
                        {sub.subcategory_id && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground uppercase font-mono tracking-wider select-none">
                            Saved
                          </span>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveSub(idx)}
                        className="size-9 shrink-0 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 border-t border-border pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs h-9 font-medium px-4 border border-border hover:bg-muted rounded-xl transition-all"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isPending || !name.trim()}
            className="btn-3d text-xs h-9 bg-primary text-primary-foreground font-semibold px-4 hover:bg-primary/90 rounded-xl transition-all"
          >
            {isPending && <Loader2 className="size-3 animate-spin mr-1.5" />}
            {editId ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main CategoriesSettings ────────────────────────────────────────────────
export default function CategoriesSettings() {
  const { data: categories = [], isLoading } = useCategoriesQuery()
  const deleteMutation = useDeleteCategoryMutation()

  const [query, setQuery] = React.useState('')
  const [modalOpen, setModalOpen] = React.useState(false)
  const [editId, setEditId] = React.useState<string | null>(null)

  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [confirmBulkDelete, setConfirmBulkDelete] = React.useState(false)

  const filtered: Category[] = React.useMemo(() => {
    const q = query.toLowerCase()
    return q
      ? categories.filter(
          (c) =>
            c.category_name.toLowerCase().includes(q) ||
            c.subCategoryName?.some((s) => s.subcategory_name.toLowerCase().includes(q)) ||
            c.subcategories?.some((s) => s.subcategory_name.toLowerCase().includes(q))
        )
      : categories
  }, [categories, query])

  const allSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.category_id))
  const someSelected = filtered.some((c) => selected.has(c.category_id))
  const visibleSelectedCount = filtered.filter((c) => selected.has(c.category_id)).length

  const toggleAll = () => {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev)
        filtered.forEach((c) => next.delete(c.category_id))
        return next
      })
    } else {
      setSelected((prev) => {
        const next = new Set(prev)
        filtered.forEach((c) => next.add(c.category_id))
        return next
      })
    }
  }

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const clearSelection = () => {
    setSelected(new Set())
    setConfirmBulkDelete(false)
  }

  // DELETE single
  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync([id])
    setConfirmDeleteId(null)
  }

  // DELETE bulk
  const handleBulkDelete = async () => {
    const ids = filtered
      .filter((c) => selected.has(c.category_id))
      .map((c) => c.category_id)
    await deleteMutation.mutateAsync(ids)
    clearSelection()
  }

  const handleOpenEdit = (id: string) => {
    setEditId(id)
    setModalOpen(true)
  }

  const handleOpenCreate = () => {
    setEditId(null)
    setModalOpen(true)
  }

  return (
    <div className="flex h-full w-full flex-col">
      {/* ── Toolbar — swaps to bulk bar when rows are selected ── */}
      {visibleSelectedCount > 0 ? (
        <div className="flex items-center gap-1 bg-primary/5 py-1.5 pl-2.5 pr-1.5">
          <button
            onClick={clearSelection}
            className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Clear selection"
          >
            <X className="size-3.5" />
          </button>
          <span className="text-[13px] font-medium">{visibleSelectedCount} selected</span>
          <div className="ml-auto flex items-center gap-0.5">
            {confirmBulkDelete ? (
              <>
                <span className="mr-1 text-[12px] text-rose-600">Delete {visibleSelectedCount} item{visibleSelectedCount > 1 ? 's' : ''}?</span>
                <button
                  onClick={handleBulkDelete}
                  disabled={deleteMutation.isPending}
                  className="inline-flex h-7 items-center gap-1 rounded-md bg-rose-600 px-2.5 text-[13px] font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {deleteMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmBulkDelete(false)}
                  className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted"
                >
                  <X className="size-3.5" />
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmBulkDelete(true)}
                className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-rose-600 transition-colors hover:bg-rose-50 dark:hover:bg-rose-950/30"
              >
                <Trash2 className="size-3.5" />
                Delete
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1 py-1.5 pl-2.5 pr-1.5">
          <button className="inline-flex h-7 cursor-default items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-muted-foreground">
            <ListFilter className="size-3.5" />
            All
            <span className="text-muted-foreground">· {categories.length}</span>
          </button>

          <div className="ml-auto flex items-center gap-0.5">
            <div className="flex h-7 w-40 items-center gap-1.5 rounded-md px-2 text-[13px]">
              <Search className="size-3.5 shrink-0 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
              />
            </div>
            <button
              onClick={handleOpenCreate}
              className="btn-3d ml-1 inline-flex h-7 cursor-pointer items-center gap-1 rounded-xl bg-primary px-2.5 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="size-3.5" />
              New record
            </button>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <div className="min-h-0 flex-1 overflow-auto border-t border-border">
        {/* Header */}
        <div className="sticky top-0 z-10 grid grid-cols-[40px_32px_1.5fr_2fr_100px] items-center border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span className="px-3 py-2.5">#</span>
          <div className="flex items-center py-2.5">
            <RowCheckbox
              checked={allSelected}
              indeterminate={someSelected && !allSelected}
              onChange={toggleAll}
            />
          </div>
          <span className="py-2.5">Category Name</span>
          <span className="py-2.5">Subcategories</span>
          <span className="px-3 py-2.5 text-right">Action</span>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading…
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Tag className="size-8 text-muted-foreground/30" />
            <p className="text-[13px] text-muted-foreground">
              {query
                ? 'No categories match your search.'
                : 'No employee categories yet. Click "New record" to add one.'}
            </p>
          </div>
        )}

        {/* Rows */}
        {!isLoading &&
          filtered.map((cat, i) => {
            const isSelected = selected.has(cat.category_id)
            return (
              <div
                key={cat.category_id}
                className={cn(
                  'grid grid-cols-[40px_32px_1.5fr_2fr_100px] items-center border-b border-border text-[13px] transition-colors last:border-b-0',
                  confirmDeleteId === cat.category_id
                    ? 'bg-rose-50 dark:bg-rose-950/20'
                    : isSelected
                      ? 'bg-primary/5'
                      : 'hover:bg-muted/40',
                )}
              >
                {/* Serial */}
                <span className="px-3 py-2.5 tabular-nums text-muted-foreground">{i + 1}</span>

                {/* Checkbox */}
                <div className="flex items-center">
                  <RowCheckbox
                    checked={isSelected}
                    onChange={() => toggleOne(cat.category_id)}
                  />
                </div>

                {/* Category Name */}
                <div className="py-2.5 pr-2">
                  <span
                    onClick={() => handleOpenEdit(cat.category_id)}
                    className="font-medium text-foreground cursor-pointer hover:underline text-[13px]"
                  >
                    {cat.category_name}
                  </span>
                </div>

                {/* Subcategories (Dedicated Column) */}
                <div className="py-2 pr-2 flex flex-wrap gap-1.5 items-center">
                  {(() => {
                    const subs = cat.subcategories || cat.subCategoryName || []
                    if (subs.length === 0) {
                      return <span className="text-[11px] text-muted-foreground italic">No subcategories</span>
                    }
                    return subs.map((sub, sIdx) => (
                      <span
                        key={sIdx}
                        className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground border border-border"
                      >
                        {sub.subcategory_name}
                      </span>
                    ))
                  })()}
                </div>

                {/* Action */}
                <div className="flex items-center justify-end gap-1 px-3">
                  {confirmDeleteId === cat.category_id ? (
                    <>
                      <button
                        onClick={() => handleDelete(cat.category_id)}
                        disabled={deleteMutation.isPending}
                        className="h-6 rounded bg-rose-600 px-2 text-[12px] font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                      >
                        {deleteMutation.isPending ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Check className="size-3" />
                        )}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted"
                      >
                        <X className="size-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleOpenEdit(cat.category_id)}
                        className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="Edit"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(cat.category_id)}
                        className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
                        aria-label="Delete"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
      </div>

      {/* Category Modal */}
      <CategoryModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editId={editId}
      />
    </div>
  )
}
