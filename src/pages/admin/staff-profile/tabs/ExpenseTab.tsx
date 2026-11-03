// @ts-nocheck
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
    Plus,
    FileSpreadsheet,
    Pencil,
    Calendar,
    IndianRupee,
    TrendingDown,
    CheckCircle2,
    Eye,
} from 'lucide-react';
import rdk, { ATTENDANCE_SERVER_URL, readItems } from '@/services/server';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import ImageLightbox from '@/components/ui/image-lightbox';
import AddExpenseModal from '../modals/AddExpenseModal';
import ViewExpenseModal from '../modals/ViewExpenseModal';
import { downloadExpenseExcel } from '../utils/staffExports';

interface ExpenseTabProps {
    empId: string;
    staff: any;
    user: any;
}

export default function ExpenseTab({ empId, staff, user }: ExpenseTabProps) {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

    const [startDate, setStartDate] = useState<string>(() => firstDay.toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState<string>(() => today.toISOString().split('T')[0]);

    // Modals
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [selectedExpense, setSelectedExpense] = useState<any | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    // Fetch Expenses
    const { data: expenses = [], isLoading } = useQuery({
        queryKey: ['expenses', empId, startDate, endDate],
        queryFn: async () => {
            const res = await rdk.request(
                readItems('expenses', {
                    filter: {
                        _and: [
                            { employee_id: { _eq: empId } },
                            { expense_date: { _between: [startDate, endDate] } },
                        ],
                    },
                    fields: ['*', 'bill_image.*'],
                    sort: ['-expense_date'],
                })
            );
            return Array.isArray(res) ? res : res?.data || [];
        },
        enabled: !!empId && !!startDate && !!endDate,
    });

    // Metric Calculations matching V1
    const { totalGiven, totalRegistered, totalApproved, netTotal } = useMemo(() => {
        const given = expenses
            .filter((e: any) => e.expense_entry_type === 'given')
            .reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);

        const registered = expenses
            .filter((e: any) => e.expense_entry_type === 'expense')
            .reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);

        const approved = expenses
            .filter((e: any) => e.status === 'approve' || e.status === 'approved')
            .reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);

        return {
            totalGiven: given,
            totalRegistered: registered,
            totalApproved: approved,
            netTotal: given - approved,
        };
    }, [expenses]);

    const getStatusBadge = (status?: string) => {
        const s = String(status || '').toLowerCase();
        if (s === 'approve' || s === 'approved') {
            return (
                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">
                    Approved
                </Badge>
            );
        }
        if (s === 'reject' || s === 'rejected') {
            return (
                <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-xs">
                    Rejected
                </Badge>
            );
        }
        return (
            <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs">
                Pending
            </Badge>
        );
    };

    return (
        <div className="space-y-5 w-full">
            {/* 1. Header Filter Bar */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4 w-full">
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span>From:</span>
                        <Input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="h-8 text-xs w-36"
                        />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span>To:</span>
                        <Input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="h-8 text-xs w-36"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            downloadExpenseExcel(
                                empId,
                                staff?.name || 'Staff',
                                user?.firm_id?.firm_name || 'My Firm',
                                expenses,
                                startDate,
                                endDate
                            )
                        }
                        className="text-xs h-8 gap-1.5 cursor-pointer"
                    >
                        <FileSpreadsheet className="size-3.5" />
                        <span>Export Excel</span>
                    </Button>

                    <Button
                        size="sm"
                        onClick={() => {
                            setSelectedExpense(null);
                            setIsEditMode(false);
                            setAddModalOpen(true);
                        }}
                        className="text-xs h-8 gap-1.5 cursor-pointer"
                    >
                        <Plus className="size-3.5" />
                        <span>Add Expense</span>
                    </Button>
                </div>
            </div>

            {/* 2. 4 Metric Cards */}
            <div className="space-y-1.5 w-full">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
                    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
                        <span className="text-xs font-semibold text-muted-foreground block">
                            Total Amount Given
                        </span>
                        <div className="text-xl font-bold text-emerald-600 mt-1">
                            ₹ {Number(totalGiven).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                    </div>

                    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
                        <span className="text-xs font-semibold text-muted-foreground block">
                            Expenses Registered
                        </span>
                        <div className="text-xl font-bold text-foreground mt-1">
                            ₹ {Number(totalRegistered).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                    </div>

                    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
                        <span className="text-xs font-semibold text-muted-foreground block">
                            Expenses Approved
                        </span>
                        <div className="text-xl font-bold text-emerald-600 mt-1">
                            ₹ {Number(totalApproved).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                    </div>

                    <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 shadow-xs">
                        <span className="text-xs font-bold text-primary block">
                            Net Outstanding Balance
                        </span>
                        <div className="text-xl font-extrabold text-primary mt-1">
                            ₹ {Number(netTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                    </div>
                </div>
                <p className="text-[11px] text-muted-foreground italic px-1">
                    *This summary does not include EMIs since they are automatically computed inside the monthly payslip.
                </p>
            </div>

            {/* 3. Edge-to-edge Table */}
            <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-muted/50 border-b border-border text-muted-foreground">
                            <tr>
                                <th className="px-4 py-3 text-left font-semibold">Amount (₹)</th>
                                <th className="px-4 py-3 text-left font-semibold">Expense Date</th>
                                <th className="px-4 py-3 text-left font-semibold">Entry Type</th>
                                <th className="px-4 py-3 text-left font-semibold">Status</th>
                                <th className="px-4 py-3 text-left font-semibold">Remark / Purpose</th>
                                <th className="px-4 py-3 text-center font-semibold">Receipt</th>
                                <th className="px-4 py-3 text-right font-semibold">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                                        Loading expense records...
                                    </td>
                                </tr>
                            ) : expenses.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-10 text-center text-muted-foreground">
                                        No expense records found for the selected date range.
                                    </td>
                                </tr>
                            ) : (
                                expenses.map((exp: any, idx: number) => {
                                    const firstImg = exp.bill_image?.[0]?.directus_files_id;
                                    const imgUrl = firstImg ? `${ATTENDANCE_SERVER_URL}/assets/${firstImg}` : null;

                                    return (
                                        <tr
                                            key={exp.expense_id || idx}
                                            onClick={() => {
                                                setSelectedExpense(exp);
                                                setViewModalOpen(true);
                                            }}
                                            className="hover:bg-muted/30 cursor-pointer transition-colors"
                                        >
                                            <td className="px-4 py-3 font-bold text-foreground">
                                                ₹ {Number(exp.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-4 py-3 font-mono text-muted-foreground">
                                                {exp.expense_date ? String(exp.expense_date).slice(0, 10) : '—'}
                                            </td>
                                            <td className="px-4 py-3 capitalize font-medium text-foreground">
                                                {exp.expense_entry_type || 'Expense'}
                                            </td>
                                            <td className="px-4 py-3">{getStatusBadge(exp.status)}</td>
                                            <td className="px-4 py-3 text-foreground max-w-xs truncate">
                                                {exp.remark || '—'}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {imgUrl ? (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setLightboxImage(imgUrl);
                                                        }}
                                                        className="size-7 rounded-md border border-border overflow-hidden inline-block hover:scale-110 transition-transform"
                                                    >
                                                        <img src={imgUrl} alt="Receipt" className="size-full object-cover" />
                                                    </button>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="size-7"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedExpense(exp);
                                                            setIsEditMode(true);
                                                            setAddModalOpen(true);
                                                        }}
                                                        title="Edit Expense"
                                                    >
                                                        <Pencil className="size-3.5 text-muted-foreground hover:text-foreground" />
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
            <AddExpenseModal
                open={addModalOpen}
                onOpenChange={setAddModalOpen}
                empId={empId}
                singleExpense={selectedExpense}
                editMode={isEditMode}
            />

            <ViewExpenseModal
                open={viewModalOpen}
                onOpenChange={setViewModalOpen}
                expense={selectedExpense}
                onEditClick={() => {
                    setIsEditMode(true);
                    setAddModalOpen(true);
                }}
            />

            <ImageLightbox
                isOpen={!!lightboxImage}
                onClose={() => setLightboxImage(null)}
                imageUrl={lightboxImage || ''}
                title="Bill Receipt"
            />
        </div>
    );
}
