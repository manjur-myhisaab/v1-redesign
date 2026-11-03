// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Trash2, Save, Upload, X } from 'lucide-react';
import rdk, { ATTENDANCE_SERVER_URL, createItem, updateItem, uploadFiles } from '@/services/server';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface AddExpenseModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    empId: string;
    singleExpense?: any;
    editMode?: boolean;
}

export default function AddExpenseModal({
    open,
    onOpenChange,
    empId,
    singleExpense,
    editMode = false,
}: AddExpenseModalProps) {
    const queryClient = useQueryClient();
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);

    const {
        register,
        handleSubmit,
        setValue,
        reset,
        watch,
        formState: { isSubmitting },
    } = useForm({
        defaultValues: {
            expense_date: new Date().toISOString().split('T')[0],
            amount: '',
            remark: '',
            expense_entry_type: 'expense',
            status: 'pending',
        },
    });

    const entryTypeVal = watch('expense_entry_type');
    const statusVal = watch('status');

    useEffect(() => {
        if (open) {
            if (editMode && singleExpense) {
                setValue('expense_date', singleExpense.expense_date?.slice(0, 10) || new Date().toISOString().split('T')[0]);
                setValue('amount', String(singleExpense.amount || ''));
                setValue('remark', singleExpense.remark || '');
                setValue('expense_entry_type', singleExpense.expense_entry_type || 'expense');
                setValue('status', singleExpense.status || 'pending');

                const existingImgs = (singleExpense.bill_image || []).map((img: any) =>
                    `${ATTENDANCE_SERVER_URL}/assets/${img.directus_files_id}`
                );
                setImagePreviews(existingImgs);
                setSelectedFiles([]);
            } else {
                reset({
                    expense_date: new Date().toISOString().split('T')[0],
                    amount: '',
                    remark: '',
                    expense_entry_type: 'expense',
                    status: 'pending',
                });
                setImagePreviews([]);
                setSelectedFiles([]);
            }
        }
    }, [open, editMode, singleExpense, setValue, reset]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            setSelectedFiles((prev) => [...prev, ...files]);
            const newPreviews = files.map((file) => URL.createObjectURL(file));
            setImagePreviews((prev) => [...prev, ...newPreviews]);
        }
    };

    const removeImage = (index: number) => {
        setImagePreviews((prev) => prev.filter((_, i) => i !== index));
        setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const mutation = useMutation({
        mutationFn: async (formData: any) => {
            let uploadedIds: any[] = [];
            const existingFileIds =
                editMode && singleExpense ? (singleExpense.bill_image || []).map((img: any) => img.directus_files_id) : [];

            if (editMode && existingFileIds.length > 0) {
                uploadedIds = existingFileIds.map((id: string) => ({ directus_files_id: id }));
            }

            if (selectedFiles.length > 0) {
                try {
                    const fileIds = await uploadFiles(selectedFiles);
                    const newIds = fileIds.map((id: string) => ({ directus_files_id: id }));
                    uploadedIds = [...uploadedIds, ...newIds];
                } catch (e) {
                    console.error('File upload failed:', e);
                }
            }

            const payload: any = {
                employee_id: empId,
                expense_date: formData.expense_date,
                amount: parseFloat(formData.amount) || 0,
                remark: formData.remark,
                expense_entry_type: formData.expense_entry_type,
                status: formData.status,
                bill_image: uploadedIds,
            };

            if (editMode && singleExpense?.expense_id) {
                return await rdk.request(updateItem('expenses', singleExpense.expense_id, payload));
            } else {
                return await rdk.request(createItem('expenses', payload));
            }
        },
        onSuccess: () => {
            toast.success(editMode ? 'Expense updated' : 'Expense recorded successfully');
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            onOpenChange(false);
        },
        onError: (err: any) => {
            toast.error(err.message || 'Failed to save expense');
        },
    });

    const onSubmit = (data: any) => {
        mutation.mutate(data);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-base font-bold">
                        {editMode ? 'Edit Expense Record' : 'Add Expense Record'}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Entry Type</Label>
                            <Select
                                value={entryTypeVal}
                                onValueChange={(val) => setValue('expense_entry_type', val)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="expense">Expense (Spent)</SelectItem>
                                    <SelectItem value="given">Given (Allowance / Advance)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Amount (₹) *</Label>
                            <Input
                                type="number"
                                step="0.01"
                                placeholder="e.g. 1200"
                                required
                                {...register('amount', { required: true })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Expense Date *</Label>
                            <Input type="date" required {...register('expense_date', { required: true })} />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Status</Label>
                            <Select value={statusVal} onValueChange={(val) => setValue('status', val)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="approve">Approved</SelectItem>
                                    <SelectItem value="reject">Rejected</SelectItem>
                                    <SelectItem value="draft">Draft</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Remark / Description</Label>
                        <Input placeholder="e.g. Fuel bill, client lunch, travel..." {...register('remark')} />
                    </div>

                    {/* Receipt Image Upload */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Bill / Receipt Proof (Optional)</Label>
                        <div className="flex items-center gap-2">
                            <label className="cursor-pointer border border-dashed border-border hover:border-primary/50 bg-muted/30 hover:bg-muted/50 rounded-lg p-3 text-center text-xs w-full flex items-center justify-center gap-2 transition-colors">
                                <Upload className="size-4 text-muted-foreground" />
                                <span className="font-medium text-muted-foreground">Upload Image(s)</span>
                                <input
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                            </label>
                        </div>

                        {imagePreviews.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-2">
                                {imagePreviews.map((src, idx) => (
                                    <div key={idx} className="relative size-14 rounded-lg overflow-hidden border border-border group">
                                        <img src={src} alt="Preview" className="size-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => removeImage(idx)}
                                            className="absolute top-0.5 right-0.5 size-4 bg-black/70 hover:bg-black text-white rounded-full flex items-center justify-center text-[10px]"
                                        >
                                            <X className="size-2.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-border mt-4">
                        <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" size="sm" disabled={isSubmitting || mutation.isPending} className="gap-1.5">
                            <Save className="size-3.5" />
                            <span>{editMode ? 'Update' : 'Save Expense'}</span>
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
