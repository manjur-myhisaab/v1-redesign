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
    Sparkles,
} from 'lucide-react';
import rdk, { readItems } from '@/services/server';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import AddIncentiveModal from '../modals/AddIncentiveModal';
import { downloadIncentiveExcel } from '../utils/staffExports';

interface IncentiveTabProps {
    empId: string;
    staff: any;
    user: any;
}

export default function IncentiveTab({ empId, staff, user }: IncentiveTabProps) {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

    const [startDate, setStartDate] = useState<string>(() => firstDay.toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState<string>(() => today.toISOString().split('T')[0]);

    // Modal
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedIncentive, setSelectedIncentive] = useState<any | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);

    // Fetch Incentives
    const { data: incentives = [], isLoading } = useQuery({
        queryKey: ['incentives', empId, startDate, endDate],
        queryFn: async () => {
            const res = await rdk.request(
                readItems('incentives', {
                    filter: {
                        _and: [
                            { employee_id: { _eq: empId } },
                            { incentive_date: { _between: [startDate, endDate] } },
                        ],
                    },
                    sort: ['-incentive_date'],
                })
            );
            return Array.isArray(res) ? res : res?.data || [];
        },
        enabled: !!empId && !!startDate && !!endDate,
    });

    const totalGiven = useMemo(() => {
        return incentives.reduce((sum: number, inc: any) => sum + Number(inc.incentive_amount || 0), 0);
    }, [incentives]);

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
                            downloadIncentiveExcel(
                                incentives,
                                staff?.name || 'Staff',
                                user?.firm_id?.firm_name || 'My Firm',
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
                            setSelectedIncentive(null);
                            setIsEditMode(false);
                            setModalOpen(true);
                        }}
                        className="text-xs h-8 gap-1.5 cursor-pointer"
                    >
                        <Plus className="size-3.5" />
                        <span>Add Incentive</span>
                    </Button>
                </div>
            </div>

            {/* 2. Metric Summary Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                <div className="rounded-xl border border-border bg-card p-4 shadow-xs flex items-center justify-between">
                    <div>
                        <span className="text-xs font-semibold text-muted-foreground block">
                            Total Incentive Disbursed
                        </span>
                        <div className="text-2xl font-bold text-emerald-600 mt-1">
                            ₹ {Number(totalGiven).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                    </div>
                    <div className="size-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                        <Sparkles className="size-5" />
                    </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-4 shadow-xs flex items-center justify-between">
                    <div>
                        <span className="text-xs font-semibold text-muted-foreground block">
                            Total Entries
                        </span>
                        <div className="text-2xl font-bold text-foreground mt-1">
                            {incentives.length} Records
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Edge-to-Edge Table */}
            <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-muted/50 border-b border-border text-muted-foreground">
                            <tr>
                                <th className="px-4 py-3 text-left font-semibold">Incentive Amount (₹)</th>
                                <th className="px-4 py-3 text-left font-semibold">Awarded Date</th>
                                <th className="px-4 py-3 text-left font-semibold">Status</th>
                                <th className="px-4 py-3 text-left font-semibold">Remarks / Achievement</th>
                                <th className="px-4 py-3 text-right font-semibold">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                                        Loading incentives...
                                    </td>
                                </tr>
                            ) : incentives.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-10 text-center text-muted-foreground">
                                        No incentives found for the selected date range.
                                    </td>
                                </tr>
                            ) : (
                                incentives.map((inc: any, idx: number) => (
                                    <tr
                                        key={inc.incentive_id || idx}
                                        onClick={() => {
                                            setSelectedIncentive(inc);
                                            setIsEditMode(true);
                                            setModalOpen(true);
                                        }}
                                        className="hover:bg-muted/30 cursor-pointer transition-colors"
                                    >
                                        <td className="px-4 py-3 font-bold text-emerald-600">
                                            ₹ {Number(inc.incentive_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-muted-foreground">
                                            {inc.incentive_date ? String(inc.incentive_date).slice(0, 10) : '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                                                Paid
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3 text-foreground max-w-sm truncate">
                                            {inc.remarks || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="size-7"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedIncentive(inc);
                                                    setIsEditMode(true);
                                                    setModalOpen(true);
                                                }}
                                                title="Edit Incentive"
                                            >
                                                <Pencil className="size-3.5 text-muted-foreground hover:text-foreground" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            <AddIncentiveModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                empId={empId}
                editableData={selectedIncentive}
                editMode={isEditMode}
            />
        </div>
    );
}
