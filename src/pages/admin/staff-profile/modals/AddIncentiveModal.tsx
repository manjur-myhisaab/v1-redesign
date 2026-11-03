// @ts-nocheck
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Trash2, Save } from 'lucide-react';
import rdk, { createItem, updateItem, deleteItem } from '@/services/server';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AddIncentiveModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    empId: string;
    editableData?: any;
    editMode?: boolean;
}

export default function AddIncentiveModal({
    open,
    onOpenChange,
    empId,
    editableData,
    editMode = false,
}: AddIncentiveModalProps) {
    const queryClient = useQueryClient();

    const {
        register,
        handleSubmit,
        setValue,
        reset,
        formState: { isSubmitting },
    } = useForm({
        defaultValues: {
            incentive_amount: '',
            incentive_date: new Date().toISOString().split('T')[0],
            remarks: '',
        },
    });

    useEffect(() => {
        if (open) {
            if (editMode && editableData) {
                setValue('incentive_amount', String(editableData.incentive_amount || ''));
                setValue('incentive_date', editableData.incentive_date?.slice(0, 10) || new Date().toISOString().split('T')[0]);
                setValue('remarks', editableData.remarks || '');
            } else {
                reset({
                    incentive_amount: '',
                    incentive_date: new Date().toISOString().split('T')[0],
                    remarks: '',
                });
            }
        }
    }, [open, editMode, editableData, setValue, reset]);

    const mutation = useMutation({
        mutationFn: async (formData: any) => {
            const payload = {
                employee_id: empId,
                incentive_amount: parseFloat(formData.incentive_amount) || 0,
                incentive_date: formData.incentive_date,
                remarks: formData.remarks || '',
            };

            const incId = editableData?.incentive_id || editableData?.id;
            if (editMode && incId) {
                return await rdk.request(updateItem('incentives', incId, payload));
            } else {
                return await rdk.request(createItem('incentives', payload));
            }
        },
        onSuccess: () => {
            toast.success(editMode ? 'Incentive updated' : 'Incentive added successfully');
            queryClient.invalidateQueries({ queryKey: ['incentives'] });
            queryClient.invalidateQueries({ queryKey: ['user-salary'] });
            onOpenChange(false);
        },
        onError: (err: any) => {
            toast.error(err.message || 'Failed to save incentive');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async () => {
            const incId = editableData?.incentive_id || editableData?.id;
            return await rdk.request(deleteItem('incentives', incId));
        },
        onSuccess: () => {
            toast.success('Incentive deleted');
            queryClient.invalidateQueries({ queryKey: ['incentives'] });
            queryClient.invalidateQueries({ queryKey: ['user-salary'] });
            onOpenChange(false);
        },
        onError: (err: any) => {
            toast.error(err.message || 'Failed to delete incentive');
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
                        {editMode ? 'Edit Incentive' : 'Add Staff Incentive'}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Incentive Amount (₹) *</Label>
                        <Input
                            type="number"
                            step="0.01"
                            placeholder="e.g. 2500"
                            required
                            {...register('incentive_amount', { required: true })}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Incentive Date *</Label>
                        <Input type="date" required {...register('incentive_date', { required: true })} />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Remarks / Achievement</Label>
                        <Input
                            placeholder="e.g. Best sales performance, spot award, festival bonus..."
                            {...register('remarks')}
                        />
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-border mt-4">
                        {editMode ? (
                            <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                disabled={deleteMutation.isPending}
                                onClick={() => {
                                    if (window.confirm('Are you sure you want to delete this incentive?')) {
                                        deleteMutation.mutate();
                                    }
                                }}
                                className="gap-1.5"
                            >
                                <Trash2 className="size-3.5" />
                                <span>Delete</span>
                            </Button>
                        ) : (
                            <div />
                        )}

                        <div className="flex items-center gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" size="sm" disabled={isSubmitting || mutation.isPending} className="gap-1.5">
                                <Save className="size-3.5" />
                                <span>{editMode ? 'Update' : 'Add Incentive'}</span>
                            </Button>
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
