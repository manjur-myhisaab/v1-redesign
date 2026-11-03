// @ts-nocheck
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Save } from 'lucide-react';
import rdk, { createItem, updateItem } from '@/services/server';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DeductLoanModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    empId: string;
    loanData?: any;
    editMode?: boolean;
}

export default function DeductLoanModal({
    open,
    onOpenChange,
    empId,
    loanData,
    editMode = false,
}: DeductLoanModalProps) {
    const queryClient = useQueryClient();

    const {
        register,
        handleSubmit,
        setValue,
        reset,
        formState: { isSubmitting },
    } = useForm({
        defaultValues: {
            loan_amount: '',
            deduct_month: new Date().toISOString().slice(0, 7),
            loan_details: '',
        },
    });

    useEffect(() => {
        if (open) {
            if (editMode && loanData) {
                setValue('loan_amount', String(loanData.loan_amount || ''));
                setValue('deduct_month', loanData.loan_date?.slice(0, 7) || new Date().toISOString().slice(0, 7));
                setValue('loan_details', loanData.loan_details || '');
            } else {
                reset({
                    loan_amount: '',
                    deduct_month: new Date().toISOString().slice(0, 7),
                    loan_details: '',
                });
            }
        }
    }, [open, editMode, loanData, setValue, reset]);

    const mutation = useMutation({
        mutationFn: async (formData: any) => {
            const payload: any = {
                employee_id: empId,
                loan_entry_type: 'deduct',
                loan_title: 'Deduction',
                loan_amount: parseFloat(formData.loan_amount) || 0,
                loan_details: formData.loan_details || 'Manual loan deduction',
                loan_date: formData.deduct_month,
                status: 'active',
            };

            const loanId = loanData?.loan_id || loanData?.id;
            if (editMode && loanId) {
                return await rdk.request(updateItem('loans', loanId, payload));
            } else {
                return await rdk.request(createItem('loans', payload));
            }
        },
        onSuccess: () => {
            toast.success(editMode ? 'Deduction updated' : 'Loan deduction recorded successfully');
            queryClient.invalidateQueries({ queryKey: ['active-loans'] });
            queryClient.invalidateQueries({ queryKey: ['user-salary'] });
            onOpenChange(false);
        },
        onError: (err: any) => {
            toast.error(err.message || 'Failed to record deduction');
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
                        {editMode ? 'Edit Loan Deduction' : 'Deduct Loan / Repayment'}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Deduction Amount (₹) *</Label>
                        <Input
                            type="number"
                            step="0.01"
                            placeholder="e.g. 5000"
                            required
                            {...register('loan_amount', { required: true })}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Deduct Month *</Label>
                        <Input type="month" required {...register('deduct_month', { required: true })} />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Remarks / Deduction Details</Label>
                        <Input
                            placeholder="e.g. Repaid via cash, monthly settlement..."
                            {...register('loan_details')}
                        />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-border mt-4">
                        <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" size="sm" disabled={isSubmitting || mutation.isPending} className="gap-1.5">
                            <Save className="size-3.5" />
                            <span>{editMode ? 'Update' : 'Record Deduction'}</span>
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
