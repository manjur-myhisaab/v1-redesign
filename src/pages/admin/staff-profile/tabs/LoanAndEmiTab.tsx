// @ts-nocheck
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
    Plus,
    Minus,
    Pencil,
    Trash2,
    IndianRupee,
    CreditCard,
    Calendar,
    ArrowDownRight,
    ArrowUpRight,
} from 'lucide-react';
import rdk, { readItems, deleteItem } from '@/services/server';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import AddLoanModal from '../modals/AddLoanModal';
import DeductLoanModal from '../modals/DeductLoanModal';

interface LoanAndEmiTabProps {
    empId: string;
    staff: any;
    user: any;
}

export default function LoanAndEmiTab({ empId, staff, user }: LoanAndEmiTabProps) {
    const queryClient = useQueryClient();

    // Modals
    const [addLoanOpen, setAddLoanOpen] = useState(false);
    const [deductLoanOpen, setDeductLoanOpen] = useState(false);
    const [selectedLoan, setSelectedLoan] = useState<any | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);

    // Fetch Loans
    const { data: activeLoans = [], isLoading } = useQuery({
        queryKey: ['active-loans', empId],
        queryFn: async () => {
            const res = await rdk.request(
                readItems('loans', {
                    filter: {
                        employee_id: { _eq: empId },
                    },
                    sort: ['-date_created'],
                })
            );
            return Array.isArray(res) ? res : res?.data || [];
        },
        enabled: !!empId,
    });

    // Delete Mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            return await rdk.request(deleteItem('loans', id));
        },
        onSuccess: () => {
            toast.success('Loan entry deleted successfully');
            queryClient.invalidateQueries({ queryKey: ['active-loans'] });
            queryClient.invalidateQueries({ queryKey: ['user-salary'] });
        },
        onError: (err: any) => {
            toast.error(err.message || 'Failed to delete loan entry');
        },
    });

    // Summary calculations
    const totals = useMemo(() => {
        let totalLoanAmount = 0;
        let totalLoanDeducted = 0;

        activeLoans.forEach((loan: any) => {
            const amount = parseFloat(loan.loan_amount) || 0;
            if (loan.loan_entry_type === 'add') {
                totalLoanAmount += amount;
            } else if (loan.loan_entry_type === 'deduct') {
                totalLoanDeducted += amount;
            }
        });

        return {
            totalLoanAmount,
            totalLoanDeducted,
            netOutstanding: totalLoanAmount - totalLoanDeducted,
        };
    }, [activeLoans]);

    const handleRowClick = (item: any) => {
        setSelectedLoan(item);
        setIsEditMode(true);
        if (item.loan_entry_type === 'deduct') {
            setDeductLoanOpen(true);
        } else {
            setAddLoanOpen(true);
        }
    };

    return (
        <div className="space-y-5 w-full">
            {/* 1. Header Action Bar */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-xs flex items-center justify-between gap-4 w-full">
                <div className="flex items-center gap-2">
                    <CreditCard className="size-4 text-primary shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Loans & EMI Management
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setSelectedLoan(null);
                            setIsEditMode(false);
                            setDeductLoanOpen(true);
                        }}
                        className="text-xs h-8 gap-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-500/20 cursor-pointer"
                    >
                        <Minus className="size-3.5" />
                        <span>Deduct Loan</span>
                    </Button>

                    <Button
                        size="sm"
                        onClick={() => {
                            setSelectedLoan(null);
                            setIsEditMode(false);
                            setAddLoanOpen(true);
                        }}
                        className="text-xs h-8 gap-1.5 cursor-pointer"
                    >
                        <Plus className="size-3.5" />
                        <span>Add Loan</span>
                    </Button>
                </div>
            </div>

            {/* 2. Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
                <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground block">
                            Total Loan Given
                        </span>
                        <ArrowUpRight className="size-4 text-emerald-600" />
                    </div>
                    <div className="text-xl font-bold text-foreground mt-1">
                        ₹ {Number(totals.totalLoanAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground block">
                            Total Amount Repaid / Deducted
                        </span>
                        <ArrowDownRight className="size-4 text-rose-600" />
                    </div>
                    <div className="text-xl font-bold text-rose-600 mt-1">
                        ₹ {Number(totals.totalLoanDeducted).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                </div>

                <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 shadow-xs">
                    <span className="text-xs font-bold text-primary block">
                        Net Outstanding Balance
                    </span>
                    <div className="text-xl font-extrabold text-primary mt-1">
                        ₹ {Number(totals.netOutstanding).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                </div>
            </div>

            {/* 3. Edge-to-Edge Table */}
            <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-muted/50 border-b border-border text-muted-foreground">
                            <tr>
                                <th className="px-4 py-3 text-left font-semibold">Title</th>
                                <th className="px-4 py-3 text-left font-semibold">Amount (₹)</th>
                                <th className="px-4 py-3 text-left font-semibold">Details / Purpose</th>
                                <th className="px-4 py-3 text-left font-semibold">Type</th>
                                <th className="px-4 py-3 text-left font-semibold">Entry</th>
                                <th className="px-4 py-3 text-left font-semibold">EMI Amount</th>
                                <th className="px-4 py-3 text-left font-semibold">Period / Month</th>
                                <th className="px-4 py-3 text-right font-semibold">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                                        Loading loans and EMIs...
                                    </td>
                                </tr>
                            ) : activeLoans.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-10 text-center text-muted-foreground">
                                        No loan or EMI entries found for this employee.
                                    </td>
                                </tr>
                            ) : (
                                activeLoans.map((item: any, idx: number) => {
                                    const isDeduct = item.loan_entry_type === 'deduct';
                                    const loanId = item.id || item.loan_id;

                                    return (
                                        <tr
                                            key={loanId || idx}
                                            onClick={() => handleRowClick(item)}
                                            className="hover:bg-muted/30 cursor-pointer transition-colors"
                                        >
                                            <td className="px-4 py-3 font-semibold text-foreground">
                                                {item.loan_title || (isDeduct ? 'Deduction' : 'Loan')}
                                            </td>
                                            <td
                                                className={`px-4 py-3 font-bold ${
                                                    isDeduct ? 'text-rose-600' : 'text-foreground'
                                                }`}
                                            >
                                                {isDeduct ? '- ' : ''}₹{' '}
                                                {Number(item.loan_amount || 0).toLocaleString('en-IN', {
                                                    minimumFractionDigits: 2,
                                                })}
                                            </td>
                                            <td className="px-4 py-3 text-foreground max-w-xs truncate">
                                                {item.loan_details || '—'}
                                            </td>
                                            <td className="px-4 py-3">
                                                {item.is_emi ? (
                                                    <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[10px]">
                                                        EMI
                                                    </Badge>
                                                ) : (
                                                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                                                        ONE-TIME
                                                    </Badge>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {isDeduct ? (
                                                    <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[10px]">
                                                        DEDUCTION
                                                    </Badge>
                                                ) : (
                                                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                                                        DISBURSEMENT
                                                    </Badge>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 font-mono">
                                                {item.emi_amount ? `₹ ${Number(item.emi_amount).toFixed(2)}` : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                {item.is_emi
                                                    ? `${item.emi_start_month || '—'} to ${item.emi_end_month || '—'}`
                                                    : item.loan_date?.slice(0, 10) || '—'}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="size-7"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRowClick(item);
                                                        }}
                                                        title="Edit"
                                                    >
                                                        <Pencil className="size-3.5 text-muted-foreground hover:text-foreground" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="size-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (window.confirm('Are you sure you want to delete this loan entry?')) {
                                                                deleteMutation.mutate(loanId);
                                                            }
                                                        }}
                                                        disabled={deleteMutation.isPending}
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="size-3.5" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modals */}
            <AddLoanModal
                open={addLoanOpen}
                onOpenChange={setAddLoanOpen}
                empId={empId}
                loanData={selectedLoan}
                editMode={isEditMode}
            />

            <DeductLoanModal
                open={deductLoanOpen}
                onOpenChange={setDeductLoanOpen}
                empId={empId}
                loanData={selectedLoan}
                editMode={isEditMode}
            />
        </div>
    );
}
