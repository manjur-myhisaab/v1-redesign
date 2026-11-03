// @ts-nocheck
import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CheckCircle2, XCircle, Pencil, Calendar, IndianRupee } from 'lucide-react';
import rdk, { ATTENDANCE_SERVER_URL, updateItem } from '@/services/server';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ImageLightbox from '@/components/ui/image-lightbox';

interface ViewExpenseModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    expense: any;
    onEditClick?: () => void;
}

export default function ViewExpenseModal({
    open,
    onOpenChange,
    expense,
    onEditClick,
}: ViewExpenseModalProps) {
    const queryClient = useQueryClient();
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    const updateStatusMutation = useMutation({
        mutationFn: async (status: string) => {
            return await rdk.request(updateItem('expenses', expense?.expense_id, { status }));
        },
        onSuccess: (_, status) => {
            toast.success(`Expense marked as ${status}`);
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            onOpenChange(false);
        },
        onError: (err: any) => {
            toast.error(err.message || 'Failed to update status');
        },
    });

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
                Pending Approval
            </Badge>
        );
    };

    if (!expense) return null;

    const billImages = expense?.bill_image || [];

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-md">
                    <DialogHeader className="flex flex-row items-center justify-between">
                        <DialogTitle className="text-base font-bold">Expense Details</DialogTitle>
                        {onEditClick && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    onOpenChange(false);
                                    onEditClick();
                                }}
                                className="gap-1.5 text-xs mr-4"
                            >
                                <Pencil className="size-3.5" />
                                Edit
                            </Button>
                        )}
                    </DialogHeader>

                    <div className="space-y-4 pt-2 text-xs">
                        {/* Summary grid */}
                        <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-border bg-muted/40">
                            <div>
                                <span className="text-muted-foreground block text-[11px]">Entry Type</span>
                                <span className="font-semibold text-foreground capitalize">
                                    {expense.expense_entry_type || 'Expense'}
                                </span>
                            </div>
                            <div>
                                <span className="text-muted-foreground block text-[11px]">Status</span>
                                <div className="mt-0.5">{getStatusBadge(expense.status)}</div>
                            </div>
                            <div>
                                <span className="text-muted-foreground block text-[11px]">Amount</span>
                                <span className="font-bold text-sm text-foreground">
                                    ₹ {Number(expense.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            <div>
                                <span className="text-muted-foreground block text-[11px]">Expense Date</span>
                                <span className="font-semibold text-foreground">
                                    {expense.expense_date ? String(expense.expense_date).slice(0, 10) : '—'}
                                </span>
                            </div>
                        </div>

                        {/* Remark */}
                        <div className="space-y-1">
                            <span className="text-muted-foreground font-semibold">Remark / Description:</span>
                            <p className="p-2.5 rounded-lg border border-border bg-card text-foreground">
                                {expense.remark || 'No description provided.'}
                            </p>
                        </div>

                        {/* Bill Images */}
                        {billImages.length > 0 && (
                            <div className="space-y-1.5">
                                <span className="text-muted-foreground font-semibold">Attached Receipts:</span>
                                <div className="flex flex-wrap gap-2 pt-1">
                                    {billImages.map((img: any, idx: number) => {
                                        const fileId = img.directus_files_id || img;
                                        const url = `${ATTENDANCE_SERVER_URL}/assets/${fileId}`;
                                        return (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => setLightboxImage(url)}
                                                className="size-16 rounded-lg overflow-hidden border border-border hover:border-primary/50 transition-all hover:scale-105"
                                            >
                                                <img src={url} alt="Receipt" className="size-full object-cover" />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-3 border-t border-border mt-5">
                            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                                Close
                            </Button>

                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={updateStatusMutation.isPending}
                                    onClick={() => updateStatusMutation.mutate('reject')}
                                    className="gap-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                >
                                    <XCircle className="size-3.5" />
                                    Reject
                                </Button>
                                <Button
                                    size="sm"
                                    disabled={updateStatusMutation.isPending}
                                    onClick={() => updateStatusMutation.mutate('approve')}
                                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                    <CheckCircle2 className="size-3.5" />
                                    Approve
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <ImageLightbox
                isOpen={!!lightboxImage}
                onClose={() => setLightboxImage(null)}
                imageUrl={lightboxImage || ''}
                title="Bill Receipt Preview"
            />
        </>
    );
}
