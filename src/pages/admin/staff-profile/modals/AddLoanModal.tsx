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

interface AddLoanModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    empId: string;
    loanData?: any;
    editMode?: boolean;
}

export default function AddLoanModal({
    open,
    onOpenChange,
    empId,
    loanData,
    editMode = false,
}: AddLoanModalProps) {
    const queryClient = useQueryClient();

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { isSubmitting },
    } = useForm({
        defaultValues: {
            loan_title: '',
            loan_amount: '',
            loan_details: '',
            loan_date: new Date().toISOString().split('T')[0],
            is_emi: false,
            emi_amount: '',
            emi_start_month: new Date().toISOString().slice(0, 7),
            emi_end_month: new Date().toISOString().slice(0, 7),
        },
    });

    const isEmi = watch('is_emi');

    useEffect(() => {
        if (open) {
            if (editMode && loanData) {
                setValue('loan_title', loanData.loan_title || '');
                setValue('loan_amount', String(loanData.loan_amount || ''));
                setValue('loan_details', loanData.loan_details || '');
                setValue('loan_date', loanData.loan_date?.slice(0, 10) || new Date().toISOString().split('T')[0]);
                setValue('is_emi', !!loanData.is_emi);
                setValue('emi_amount', String(loanData.emi_amount || ''));
                setValue('emi_start_month', loanData.emi_start_month?.slice(0, 7) || new Date().toISOString().slice(0, 7));
                setValue('emi_end_month', loanData.emi_end_month?.slice(0, 7) || new Date().toISOString().slice(0, 7));
            } else {
                reset({
                    loan_title: '',
                    loan_amount: '',
                    loan_details: '',
                    loan_date: new Date().toISOString().split('T')[0],
                    is_emi: false,
                    emi_amount: '',
                    emi_start_month: new Date().toISOString().slice(0, 7),
                    emi_end_month: new Date().toISOString().slice(0, 7),
                });
            }
        }
    }, [open, editMode, loanData, setValue, reset]);

    const mutation = useMutation({
        mutationFn: async (formData: any) => {
            const payload: any = {
                employee_id: empId,
                loan_entry_type: 'add',
                loan_title: formData.loan_title,
                loan_amount: parseFloat(formData.loan_amount) || 0,
                loan_details: formData.loan_details,
                loan_date: formData.loan_date,
                is_emi: !!formData.is_emi,
                status: 'approved',
            };

            if (formData.is_emi) {
                payload.emi_amount = parseFloat(formData.emi_amount) || 0;
                payload.emi_start_month = formData.emi_start_month;
                payload.emi_end_month = formData.emi_end_month;
            }

            const loanId = loanData?.loan_id || loanData?.id;
            if (editMode && loanId) {
                return await rdk.request(updateItem('loans', loanId, payload));
            } else {
                return await rdk.request(createItem('loans', payload));
            }
        },
        onSuccess: () => {
            toast.success(editMode ? 'Loan updated' : 'Loan successfully disbursed');
            queryClient.invalidateQueries({ queryKey: ['active-loans'] });
            queryClient.invalidateQueries({ queryKey: ['user-salary'] });
            onOpenChange(false);
        },
        onError: (err: any) => {
            toast.error(err.message || 'Failed to disburse loan');
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
                        {editMode ? 'Edit Loan Entry' : 'Disburse / Add Loan'}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Loan Title *</Label>
                        <Input
                            placeholder="e.g. Salary Advance, Personal Loan, Laptop EMI"
                            required
                            {...register('loan_title', { required: true })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Loan Amount (₹) *</Label>
                            <Input
                                type="number"
                                step="0.01"
                                placeholder="e.g. 50000"
                                required
                                {...register('loan_amount', { required: true })}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Disbursed Date *</Label>
                            <Input type="date" required {...register('loan_date', { required: true })} />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Loan Details / Purpose</Label>
                        <Input placeholder="Enter details or reason..." {...register('loan_details')} />
                    </div>

                    {/* EMI Toggle Checkbox */}
                    <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-muted/30">
                        <input
                            type="checkbox"
                            id="is_emi_toggle"
                            className="rounded border-border text-primary focus:ring-primary size-4"
                            {...register('is_emi')}
                        />
                        <label htmlFor="is_emi_toggle" className="text-xs font-medium cursor-pointer text-foreground">
                            Repay via Monthly EMI Deductions
                        </label>
                    </div>

                    {isEmi && (
                        <div className="space-y-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Monthly EMI Amount (₹) *</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="e.g. 5000"
                                    {...register('emi_amount', { required: isEmi })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">EMI Start Month</Label>
                                    <Input type="month" {...register('emi_start_month')} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">EMI End Month</Label>
                                    <Input type="month" {...register('emi_end_month')} />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-border mt-4">
                        <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" size="sm" disabled={isSubmitting || mutation.isPending} className="gap-1.5">
                            <Save className="size-3.5" />
                            <span>{editMode ? 'Update' : 'Add Loan'}</span>
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
