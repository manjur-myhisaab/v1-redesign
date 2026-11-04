// @ts-nocheck
import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Trash2, Save, X, CalendarCheck, Loader2 } from 'lucide-react';
import rdk, { createItem, deleteItem, updateItem, readItems } from '@/services/server';
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

interface AddAttendanceFormModalProps {
    empId: string;
    date: Date;
    singleData?: any;
    formType: 'add' | 'edit';
    onClose: () => void;
    onSuccess?: () => void;
    user?: any;
}

export default function AddAttendanceFormModal({
    empId,
    date,
    singleData,
    formType,
    onClose,
    onSuccess,
    user,
}: AddAttendanceFormModalProps) {
    const queryClient = useQueryClient();

    const { data: shifts = [] } = useQuery({
        queryKey: ['shifts-list'],
        queryFn: async () => {
            const res = await rdk.request(readItems('shift'));
            return Array.isArray(res) ? res : res?.data || [];
        },
    });

    const isEdit = formType === 'edit' && singleData?.attendance_id;

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        control,
        formState: { isSubmitting },
    } = useForm({
        defaultValues: {
            TP: singleData?.TP || 'in',
            shift_id: singleData?.shift_id || '',
            time: singleData?.timestamp
                ? new Date(singleData.timestamp).toTimeString().slice(0, 5)
                : '09:00',
            leave_type: singleData?.leave_type || 'paid',
            remarks: singleData?.remarks || '',
        },
    });

    const selectedTP = watch('TP');

    useEffect(() => {
        if (isEdit && singleData) {
            setValue('TP', singleData.TP || 'in');
            setValue('shift_id', singleData.shift_id || '');
            if (singleData.timestamp) {
                setValue('time', new Date(singleData.timestamp).toTimeString().slice(0, 5));
            }
            setValue('remarks', singleData.remarks || '');
        }
    }, [isEdit, singleData, setValue]);

    const saveMutation = useMutation({
        mutationFn: async (formData: any) => {
            const d = date ? new Date(date) : new Date();
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');

            const [hours, mins] = (formData.time || '09:00').split(':');
            const dt = new Date(yyyy, d.getMonth(), d.getDate(), parseInt(hours, 10), parseInt(mins, 10), 0);
            const timestamp = dt.toISOString();

            const payload: any = {
                employee_id: empId,
                TP: formData.TP,
                timestamp,
                date: `${dd}-${mm}-${yyyy}`,
                remarks: formData.remarks || '',
                made_by: 'admin',
            };

            if (formData.shift_id) {
                payload.shift_id = formData.shift_id;
            }

            if (formData.TP === 'leave') {
                payload.leave = true;
                payload.leave_type = formData.leave_type || 'paid';
            } else if (formData.TP === 'absent') {
                payload.absent = true;
            } else if (formData.TP === 'holiday') {
                payload.holiday = true;
            } else if (formData.TP === 'week_off') {
                payload.week_off = true;
            }

            if (isEdit) {
                return await rdk.request(updateItem('attendance', singleData.attendance_id, payload));
            } else {
                return await rdk.request(createItem('attendance', payload));
            }
        },
        onSuccess: async () => {
            toast.success(isEdit ? 'Attendance updated' : 'Attendance marked successfully');
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['day-attendance-punches'] }),
                queryClient.invalidateQueries({ queryKey: ['DailyAttnWithShifts'] }),
                queryClient.invalidateQueries({ queryKey: ['user-attendance'] }),
                queryClient.invalidateQueries({ queryKey: ['attendance'] }),
            ]);
            onSuccess?.();
            onClose();
        },
        onError: (err: any) => {
            console.error('Error saving attendance:', err);
            toast.error(err.message || 'Failed to save attendance');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async () => {
            return await rdk.request(deleteItem('attendance', singleData.attendance_id));
        },
        onSuccess: async () => {
            toast.success('Attendance record deleted');
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['day-attendance-punches'] }),
                queryClient.invalidateQueries({ queryKey: ['DailyAttnWithShifts'] }),
                queryClient.invalidateQueries({ queryKey: ['user-attendance'] }),
                queryClient.invalidateQueries({ queryKey: ['attendance'] }),
            ]);
            onSuccess?.();
            onClose();
        },
        onError: (err: any) => {
            toast.error(err.message || 'Failed to delete');
        },
    });

    const onSubmit = (data: any) => {
        saveMutation.mutate(data);
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Attendance Status</Label>
                <Controller
                    control={control}
                    name="TP"
                    render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="in">Punch IN</SelectItem>
                                <SelectItem value="out">Punch OUT</SelectItem>
                                <SelectItem value="absent">ABSENT</SelectItem>
                                <SelectItem value="leave">LEAVE</SelectItem>
                                <SelectItem value="holiday">HOLIDAY</SelectItem>
                                <SelectItem value="week_off">WEEK OFF</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                />
            </div>

            {selectedTP === 'leave' && (
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Leave Type</Label>
                    <Controller
                        control={control}
                        name="leave_type"
                        render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select leave type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="paid">Paid Leave</SelectItem>
                                    <SelectItem value="LOP">Loss of Pay (LOP)</SelectItem>
                                    <SelectItem value="half_day">Half Day Leave</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    />
                </div>
            )}

            {(selectedTP === 'in' || selectedTP === 'out') && (
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Shift</Label>
                    <Controller
                        control={control}
                        name="shift_id"
                        render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select shift (optional)" />
                                </SelectTrigger>
                                <SelectContent>
                                    {shifts.map((s: any) => (
                                        <SelectItem key={s.shift_id} value={String(s.shift_id)}>
                                            {s.shift_name} ({s.shift_from?.slice(0, 5)} - {s.shift_to?.slice(0, 5)})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                </div>
            )}

            <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Time</Label>
                <Input type="time" {...register('time')} className="w-full" />
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Remarks / Note</Label>
                <Input placeholder="Enter reason or note..." {...register('remarks')} />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border mt-4">
                {isEdit ? (
                    <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={deleteMutation.isPending || saveMutation.isPending}
                        onClick={() => {
                            if (window.confirm('Are you sure you want to delete this record?')) {
                                deleteMutation.mutate();
                            }
                        }}
                        className="gap-1.5"
                    >
                        {deleteMutation.isPending ? (
                            <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                            <Trash2 className="size-3.5" />
                        )}
                        <span>{deleteMutation.isPending ? 'Deleting...' : 'Delete'}</span>
                    </Button>
                ) : (
                    <div />
                )}

                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={saveMutation.isPending || deleteMutation.isPending}
                        onClick={onClose}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        size="sm"
                        disabled={isSubmitting || saveMutation.isPending || deleteMutation.isPending}
                        className="gap-1.5 min-w-[130px]"
                    >
                        {saveMutation.isPending ? (
                            <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                            <Save className="size-3.5" />
                        )}
                        <span>
                            {saveMutation.isPending
                                ? isEdit
                                    ? 'Updating...'
                                    : 'Marking...'
                                : isEdit
                                ? 'Update'
                                : 'Mark Attendance'}
                        </span>
                    </Button>
                </div>
            </div>
        </form>
    );
}
