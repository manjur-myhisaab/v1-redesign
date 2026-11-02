import { useState, useMemo } from 'react';
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import rdk, { createItem, deleteItems, readItems, updateItem, customEndpoint } from '@/services/server';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, Check, X, Loader2 } from 'lucide-react';

interface CategoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEditData?: { id: number | string; name: string } | null;
  onSuccess?: () => void;
}

export function CategoryModal({
  open,
  onOpenChange,
  initialEditData,
  onSuccess,
}: CategoryModalProps) {
  const [activeTab, setActiveTab] = useState<'create' | 'assign'>('create');
  const [categoryName, setCategoryName] = useState('');
  const [editingId, setEditingId] = useState<number | string | null>(initialEditData?.id || null);
  const [editingName, setEditingName] = useState(initialEditData?.name || '');

  // Assign tab state
  const [selectedCategoryForAssign, setSelectedCategoryForAssign] = useState<string>('');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [assignSearch, setAssignSearch] = useState('');

  const queryClient = useQueryClient();

  // Load categories
  const { data: categories = [], isLoading: isLoadingCategories } = useQuery({
    queryKey: ['employee_categories'],
    queryFn: async () => {
      const res: any = await rdk.request(readItems('employee_category'));
      const raw = Array.isArray(res) ? res : res?.data || [];
      return raw.filter((u: any) => { const st = (u.status || '').toLowerCase(); return st !== 'archived' && st !== 'suspended'; });
    },
    enabled: open,
  });

  // Load all users for assign tab
  const { data: allUsers = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['firm_users_assign'],
    queryFn: async () => {
      const res: any = await rdk.request(
        customEndpoint({
          path: 'users',
          method: 'GET',
          params: {
            limit: -1,
            fields: ['id', 'first_name', 'last_name', 'email', 'title', 'employee_category_id.*', 'status'],
            filter: { status: { _nin: ['archived', 'suspended'] } },
          },
        })
      );
      return Array.isArray(res) ? res : res?.data || [];
    },
    enabled: open && activeTab === 'assign',
  });

  // Add category mutation
  const addCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      return await rdk.request(
        createItem('employee_category', {
          employee_category_name: name,
          status: 'active',
        })
      );
    },
    onSuccess: () => {
      toast.success('Category created successfully');
      setCategoryName('');
      queryClient.invalidateQueries({ queryKey: ['employee_categories'] });
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to create category');
    },
  });

  // Update category mutation
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number | string; name: string }) => {
      return await rdk.request(
        updateItem('employee_category', id, {
          employee_category_name: name,
        })
      );
    },
    onSuccess: () => {
      toast.success('Category updated successfully');
      setEditingId(null);
      setEditingName('');
      queryClient.invalidateQueries({ queryKey: ['employee_categories'] });
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update category');
    },
  });

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number | string) => {
      return await rdk.request(deleteItems('employee_category', [id] as any));
    },
    onSuccess: () => {
      toast.success('Category deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['employee_categories'] });
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete category');
    },
  });

  // Assign mutation
  const assignMutation = useMutation({
    mutationFn: async ({ categoryId, userIds }: { categoryId: string; userIds: string[] }) => {
      const targetCatId = categoryId === 'none' ? null : categoryId;
      const promises = userIds.map((id) =>
        rdk.request(
          customEndpoint({
            path: `users/${id}`,
            method: 'PATCH',
            body: JSON.stringify({
              employee_category_id: targetCatId,
            }),
          })
        )
      );
      return await Promise.all(promises);
    },
    onSuccess: () => {
      toast.success('Assigned employees successfully');
      setSelectedEmployeeIds([]);
      queryClient.invalidateQueries({ queryKey: ['firm_users_assign'] });
      queryClient.invalidateQueries({ queryKey: ['staff-attendances'] });
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to assign employees');
    },
  });

  const filteredUsers = useMemo(() => {
    if (!assignSearch.trim()) return allUsers;
    const q = assignSearch.toLowerCase().trim();
    return allUsers.filter((u: any) => {
      const name = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
      const email = (u.email || '').toLowerCase();
      const title = (u.title || '').toLowerCase();
      return name.includes(q) || email.includes(q) || title.includes(q);
    });
  }, [allUsers, assignSearch]);

  const toggleSelectUser = (id: string) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEmployeeIds(filteredUsers.map((u: any) => u.id));
    } else {
      setSelectedEmployeeIds([]);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col bg-background">
        <div className="p-5 border-b border-border bg-muted/20">
          <h2 className="text-base font-semibold tracking-tight text-foreground">Employee Categories</h2>
          <div className="flex gap-4 mt-3">
            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className={`pb-2 text-xs font-medium transition-colors border-b-2 -mb-5 ${
                activeTab === 'create'
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Manage Categories
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('assign')}
              className={`pb-2 text-xs font-medium transition-colors border-b-2 -mb-5 ${
                activeTab === 'assign'
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Assign to Category
            </button>
          </div>
        </div>

        {activeTab === 'create' ? (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Enter category name (e.g. Sales, Shift A)"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && categoryName.trim()) {
                    addCategoryMutation.mutate(categoryName.trim());
                  }
                }}
              />
              <Button
                disabled={!categoryName.trim() || addCategoryMutation.isPending}
                onClick={() => addCategoryMutation.mutate(categoryName.trim())}
              >
                {addCategoryMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Plus className="w-4 h-4 mr-1" />
                )}
                Add
              </Button>
            </div>

            <div className="space-y-2 mt-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Existing Categories ({categories.length})
              </h4>
              {isLoadingCategories ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : categories.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No categories created yet.
                </p>
              ) : (
                <div className="border rounded-lg divide-y bg-card">
                  {categories.map((cat: any) => {
                    const isEditing = editingId === cat.employee_category_id;
                    return (
                      <div
                        key={cat.employee_category_id}
                        className="flex items-center justify-between px-3.5 py-2.5 text-sm"
                      >
                        {isEditing ? (
                          <div className="flex items-center gap-2 flex-1 mr-2">
                            <Input
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="h-8 text-sm"
                              autoFocus
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2 text-emerald-600 hover:text-emerald-700"
                              onClick={() => {
                                if (editingName.trim()) {
                                  updateCategoryMutation.mutate({
                                    id: cat.employee_category_id,
                                    name: editingName.trim(),
                                  });
                                }
                              }}
                              disabled={updateCategoryMutation.isPending}
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2 text-muted-foreground"
                              onClick={() => {
                                setEditingId(null);
                                setEditingName('');
                              }}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <span className="font-medium text-foreground">
                            {cat.employee_category_name}
                          </span>
                        )}

                        {!isEditing && (
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                setEditingId(cat.employee_category_id);
                                setEditingName(cat.employee_category_name);
                              }}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Are you sure you want to delete category "${cat.employee_category_name}"?`
                                  )
                                ) {
                                  deleteCategoryMutation.mutate(cat.employee_category_id);
                                }
                              }}
                              disabled={deleteCategoryMutation.isPending}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                Target Category
              </label>
              <Select
                value={selectedCategoryForAssign}
                onValueChange={setSelectedCategoryForAssign}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Category to Assign" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- No Category (Clear) --</SelectItem>
                  {categories.map((cat: any) => (
                    <SelectItem
                      key={cat.employee_category_id}
                      value={String(cat.employee_category_id)}
                    >
                      {cat.employee_category_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <Input
                placeholder="Search staff to assign..."
                value={assignSearch}
                onChange={(e) => setAssignSearch(e.target.value)}
                className="h-8 text-sm flex-1"
              />
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Checkbox
                  checked={
                    filteredUsers.length > 0 &&
                    selectedEmployeeIds.length === filteredUsers.length
                  }
                  onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
                  id="select-all-assign"
                />
                <label htmlFor="select-all-assign" className="cursor-pointer">
                  Select All ({filteredUsers.length})
                </label>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto border rounded-lg divide-y bg-card max-h-[300px]">
              {isLoadingUsers ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No staff members found.
                </p>
              ) : (
                filteredUsers.map((u: any) => {
                  const isChecked = selectedEmployeeIds.includes(u.id);
                  const currentCat =
                    u?.employee_category_id?.employee_category_name || 'None';
                  return (
                    <div
                      key={u.id}
                      onClick={() => toggleSelectUser(u.id)}
                      className={`flex items-center justify-between px-3.5 py-2 text-sm cursor-pointer hover:bg-muted/50 transition-colors ${
                        isChecked ? 'bg-primary/5' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox checked={isChecked} />
                        <div>
                          <p className="font-medium text-foreground">
                            {u.first_name || ''} {u.last_name || ''}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {u.title || 'Staff'} &bull; {u.email}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {currentCat}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t">
              <span className="text-xs text-muted-foreground">
                {selectedEmployeeIds.length} employee(s) selected
              </span>
              <Button
                disabled={
                  !selectedCategoryForAssign ||
                  selectedEmployeeIds.length === 0 ||
                  assignMutation.isPending
                }
                onClick={() =>
                  assignMutation.mutate({
                    categoryId: selectedCategoryForAssign,
                    userIds: selectedEmployeeIds,
                  })
                }
              >
                {assignMutation.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                )}
                Assign to Category
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

