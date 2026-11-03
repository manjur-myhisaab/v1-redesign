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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface AddAdvancePaymentModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    empId: string;
    initialData?: any;
    isEditMode?: boolean;
}

export default function AddAdvancePaymentModal({
    open,
    onOpenChange,
    empId,
    initialData,
    isEditMode = false,
}: AddAdvancePaymentModalProps) {
    const queryClient = useQueryClient();

    const {
        register,
        handleSubmit,
        setValue,
        reset,
        watch,
        formState: { isSubmitting },
    } = useForm({
        defaultValues: {
            amount: '',
            date: new Date().toISOString().split('T')[0],
            status: 'pending',
            remarks: '',
        },
    });

    const statusVal = watch('status');

    useEffect(() => {
        if (open) {
            if (isEditMode && initialData) {
                setValue('amount', String(initialData.amount || initialData.employee_salary_payment_amount || ''));
                setValue('date', initialData.date || initialData.employee_salary_payment_date?.slice(0, 10) || new Date().toISOString().split('T')[0]);
                setValue('status', initialData.status || 'pending');
                setValue('remarks', initialData.remarks || '');
            } else {
                reset({
                    amount: '',
                    date: new Date().toISOString().split('T')[0],
                    status: 'pending',
                    remarks: '',
                });
            }
        }
    }, [open, isEditMode, initialData, setValue, reset]);

    const mutation = useMutation({
        mutationFn: async (formData: any) => {
            const payload = {
                employee_id: empId,
                employee_salary_payment_amount: parseFloat(formData.amount) || 0,
                employee_salary_payment_date: formData.date,
                status: formData.status,
                remarks: formData.remarks || '',
            };

            const paymentId = initialData?.payment_id || initialData?.id;
            if (isEditMode && paymentId) {
                return await rdk.request(updateItem('employee_salary_payments', paymentId, payload));
            } else {
                return await rdk.request(createItem('employee_salary_payments', payload));
            }
        },
        onSuccess: () => {
            toast.success(isEditMode ? 'Payment updated' : 'Advance payment recorded');
            queryClient.invalidateQueries({ queryKey: ['user-salary'] });
            queryClient.invalidateQueries({ queryKey: ['employee_salary_payments'] });
            onOpenChange(false);
        },
        onError: (err: any) => {
            toast.error(err.message || 'Failed to record payment');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async () => {
            const paymentId = initialData?.payment_id || initialData?.id;
            return await rdk.request(deleteItem('employee_salary_payments', paymentId));
        },
        onSuccess: () => {
            toast.success('Payment deleted');
            queryClient.invalidateQueries({ queryKey: ['user-salary'] });
            queryClient.invalidateQueries({ queryKey: ['employee_salary_payments'] });
            onOpenChange(false);
        },
        onError: (err: any) => {
            toast.error(err.message || 'Failed to delete payment');
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
                        {isEditMode ? 'Edit Advance Payment' : 'Add Advance Payment'}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Payment Amount (₹) *</Label>
                        <Input
                            type="number"
                            step="0.01"
                            placeholder="e.g. 5000"
                            required
                            {...register('amount', { required: true })}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Payment Date *</Label>
                        <Input type="date" required {...register('date', { required: true })} />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Payment Status</Label>
                        <Select value={statusVal} onValueChange={(val) => setValue('status', val)}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="paid">Paid</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="partially_paid">Partially Paid</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Remarks / Reason</Label>
                        <Input placeholder="e.g. Festival advance, emergency request..." {...register('remarks')} />
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-border mt-4">
                        {isEditMode ? (
                            <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                disabled={deleteMutation.isPending}
                                onClick={() => {
                                    if (window.confirm('Are you sure you want to delete this payment?')) {
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
                                <span>{isEditMode ? 'Update' : 'Save Payment'}</span>
                            </Button>
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
