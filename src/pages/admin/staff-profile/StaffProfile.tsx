// @ts-nocheck
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
    ArrowLeft,
    CalendarCheck,
    IndianRupee,
    Receipt,
    Sparkles,
    CreditCard,
    RefreshCw,
    User,
} from 'lucide-react';
import Panel from '@/components/admin/Panel';
import { useShell } from '@/components/admin/shell-context';
import { useAuth } from '@/context/auth/AuthContext';
import { cn } from '@/lib/utils';
import rdk, { API_URL, customEndpoint } from '@/services/server';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import StaffHeaderCard from './components/StaffHeaderCard';
import StaffProfileSidebar from './components/StaffProfileSidebar';
import AttendanceTab from './tabs/AttendanceTab';
import SalaryTab from './tabs/SalaryTab';
import ExpenseTab from './tabs/ExpenseTab';
import IncentiveTab from './tabs/IncentiveTab';
import LoanAndEmiTab from './tabs/LoanAndEmiTab';

export default function StaffProfile() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const shell = useShell();
    const firstTabActive = shell?.firstTabActive;

    const [activeTab, setActiveTab] = useState<'attendance' | 'salary' | 'expense' | 'incentive' | 'loan'>('attendance');

    // Fetch Staff Member Data
    const { data: staff, isLoading, error, refetch } = useQuery({
        queryKey: ['staff-profile', id],
        queryFn: async () => {
            if (!id) return null;
            const response = await rdk.request(
                customEndpoint({
                    path: `users/${id}`,
                    method: 'GET',
                    fields: ['*', 'payroll_heads.*', 'employee_category_id.*', 'supervisor_id.*'],
                })
            );

            if (!response) return null;

            const extractPhoneNumber = (email?: string) => {
                if (!email) return '';
                return email.replace('91', '').split('@')[0];
            };

            const formatDate = (dateString?: string) => {
                if (!dateString) return '';
                const date = new Date(dateString);
                if (isNaN(date.getTime())) return '';
                return new Intl.DateTimeFormat('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                }).format(date);
            };

            const formatDateOnly = (dateString?: string) => {
                if (!dateString) return '';
                const date = new Date(dateString);
                if (isNaN(date.getTime())) return '';
                return new Intl.DateTimeFormat('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                }).format(date);
            };

            return {
                id: response.id,
                name: `${response.first_name || ''} ${response.last_name || ''}`.trim() || 'Employee',
                designation: response.title || 'Staff Member',
                employee_code: response.employee_code || response.employee_serial_no || '',
                phone: response.phone || extractPhoneNumber(response.email),
                department_name: response.department_name || '...',
                category: response.employee_category_id?.employee_category_name || 'General',
                status: response.attendance_status || 'active',
                start_date: formatDate(response.date_created),
                salary: `${response.salary_per_month || 0}.${response.salary_per_month_after_decimal || 0}`,
                previous_salary: response.previous_salary_per_month || '',
                increment_from: response.increment_from || '...',
                avatar: response.avatar ? `${API_URL}/assets/${response.avatar}` : undefined,
                gender: response.gender || '...',
                last_activity: response.last_loc_time ? formatDate(response.last_loc_time) : '',
                employee_no: response.employee_serial_no || '',
                email: response.email || '...',
                pf_no: response.pf_no || '...',
                pan: response.pan_number || '...',
                esi_no: response.esi_no || '...',
                esi_applicable: response.esi_applicable || '...',
                esi_to_deduct_till: response.esi_to_deduct_till ? formatDate(response.esi_to_deduct_till) : '...',
                uan: response.uan || '...',
                doj: response.doj ? formatDateOnly(response.doj) : '...',
                pay_type: response.pay_type || 'monthly',
                mobile_attendance: response.mobile_attendance,
                multiple_attendance: response.multiple_attendance,
                live_tracking: response.live_tracking,
                opening_leaves: response.opening_leaves || '...',
                leave_taken: response.leave_taken || '...',
                balance_leaves: response.balance_leaves || '...',
                week_off_payment: response.week_off_payment || false,
                week_off_as_overtime: response.week_off_as_overtime || false,
                holiday_extra_payment: response.holiday_extra_payment || false,
                holiday_as_overtime: response.holiday_as_overtime || false,
                last_location:
                    response.last_lat && response.last_long
                        ? `${response.last_lat}, ${response.last_long}`
                        : '...',
            };
        },
        enabled: !!id,
    });

    // Delete Employee Mutation
    const deleteEmpMutation = useMutation({
        mutationFn: async () => {
            return await rdk.request(
                customEndpoint({
                    path: `users/${id}`,
                    method: 'DELETE',
                })
            );
        },
        onSuccess: () => {
            toast.success('Employee deleted successfully');
            navigate('/admin/staff');
        },
        onError: (err: any) => {
            toast.error(err.message || 'Failed to delete employee');
        },
    });

    const handleDeleteEmployee = () => {
        if (window.confirm('Are you sure you want to delete this employee? This action cannot be undone.')) {
            deleteEmpMutation.mutate();
        }
    };

    const tabs = [
        { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
        { id: 'salary', label: 'Salary', icon: IndianRupee },
        { id: 'expense', label: 'Expense', icon: Receipt },
        { id: 'incentive', label: 'Incentive', icon: Sparkles },
        { id: 'loan', label: 'Loan / EMI', icon: CreditCard },
    ];

    return (
        <Panel
            className={cn(
                'flex min-w-0 flex-1 flex-col h-full overflow-hidden w-full',
                firstTabActive && 'rounded-tl-none'
            )}
        >
            {/* 1. Header Bar matching v1-redesign system */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3 bg-card/60 backdrop-blur-xs shrink-0">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/admin/staff')}
                        className="gap-2 text-xs font-medium text-muted-foreground hover:text-foreground h-8 px-2.5"
                    >
                        <ArrowLeft className="size-4" />
                        <span>Back to Staff List</span>
                    </Button>
                    <div className="h-4 w-px bg-border" />
                    <span className="text-xs font-bold text-foreground">
                        {staff?.name || 'Staff Profile'}
                    </span>
                    {staff?.employee_code && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground font-mono">
                            #{staff.employee_code}
                        </Badge>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetch()}
                        className="gap-1.5 text-xs h-8"
                    >
                        <RefreshCw className="size-3.5" />
                        <span>Refresh</span>
                    </Button>
                </div>
            </div>

            {/* 2. Full-Width Scrollable Main Area */}
            <div className="flex-1 overflow-y-auto min-h-0 w-full p-4 md:p-6 space-y-6">
                {isLoading ? (
                    <div className="rounded-2xl border border-border bg-card p-16 text-center text-xs text-muted-foreground">
                        Loading staff profile...
                    </div>
                ) : error || !staff ? (
                    <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-12 text-center text-xs text-rose-600">
                        {error?.message || 'Staff member not found.'}
                    </div>
                ) : (
                    <>
                        {/* Profile Header Hero Card */}
                        <StaffHeaderCard staff={staff} onDeleteClick={handleDeleteEmployee} />

                        {/* Responsive 2-Column Grid (Left: 2 Cols Tabs, Right: 1 Col Sidebar) */}
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start w-full">
                            {/* Left Column (Tabs & Tab Contents) */}
                            <div className="xl:col-span-2 space-y-5 min-w-0 w-full">
                                {/* Modern Tab Switcher */}
                                <div className="rounded-xl border border-border bg-card p-1.5 shadow-xs flex items-center gap-1.5 overflow-x-auto">
                                    {tabs.map((tab) => {
                                        const Icon = tab.icon;
                                        const isActive = activeTab === tab.id;
                                        return (
                                            <button
                                                key={tab.id}
                                                type="button"
                                                onClick={() => setActiveTab(tab.id as any)}
                                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                                                    isActive
                                                        ? 'bg-primary text-primary-foreground shadow-xs'
                                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                                }`}
                                            >
                                                <Icon className="size-3.5" />
                                                <span>{tab.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Active Tab Renderer */}
                                <div className="w-full">
                                    {activeTab === 'attendance' && (
                                        <AttendanceTab empId={id!} staff={staff} user={user} />
                                    )}
                                    {activeTab === 'salary' && (
                                        <SalaryTab empId={id!} staff={staff} user={user} />
                                    )}
                                    {activeTab === 'expense' && (
                                        <ExpenseTab empId={id!} staff={staff} user={user} />
                                    )}
                                    {activeTab === 'incentive' && (
                                        <IncentiveTab empId={id!} staff={staff} user={user} />
                                    )}
                                    {activeTab === 'loan' && (
                                        <LoanAndEmiTab empId={id!} staff={staff} user={user} />
                                    )}
                                </div>
                            </div>

                            {/* Right Column (Sidebar Information) */}
                            <div className="xl:col-span-1 min-w-0 w-full">
                                <StaffProfileSidebar staff={staff} />
                            </div>
                        </div>
                    </>
                )}
            </div>
        </Panel>
    );
}
