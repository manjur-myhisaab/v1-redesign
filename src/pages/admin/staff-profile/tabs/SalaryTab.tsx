// @ts-nocheck
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
    Calendar,
    FileDown,
    Plus,
    Pencil,
    IndianRupee,
    Briefcase,
    CalendarCheck,
    AlertCircle,
    CheckCircle2,
    Clock,
    TrendingUp,
    ShieldAlert,
    CreditCard,
    Award,
    Timer,
} from 'lucide-react';
import rdk, { customEndpoint } from '@/services/server';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { generatePayslip } from '@/pages/admin/payroll/utils/generatePayslip';
import AddAdvancePaymentModal from '../modals/AddAdvancePaymentModal';
import AddIncentiveModal from '../modals/AddIncentiveModal';

interface SalaryTabProps {
    empId: string;
    staff: any;
    user: any;
}

export default function SalaryTab({ empId, staff, user }: SalaryTabProps) {
    const now = new Date();
    const currentYear = now.getFullYear();

    const [month, setMonth] = useState<string>(() => String(now.getMonth() + 1).padStart(2, '0'));
    const [year, setYear] = useState<string>(() => String(currentYear));
    const [generatingPayslip, setGeneratingPayslip] = useState(false);

    // Modal States
    const [advanceModalOpen, setAdvanceModalOpen] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState<any | null>(null);
    const [incentiveModalOpen, setIncentiveModalOpen] = useState(false);
    const [selectedIncentive, setSelectedIncentive] = useState<any | null>(null);

    const firmId = user?.firm_id?.firm_id || user?.firm_id?.id || user?.firm_id;

    // Fetch Salary Computation from API
    const { data: userSalary, isLoading, refetch } = useQuery({
        queryKey: ['user-salary', month, year, empId, firmId],
        queryFn: async () => {
            if (!firmId) return null;
            return await rdk.request(
                customEndpoint({
                    path: `api/employee_salary/${year}-${month}/${empId}/${firmId}`,
                    method: 'GET',
                })
            );
        },
        enabled: !!month && !!year && !!empId && !!firmId,
        refetchOnWindowFocus: false,
    });

    const years = useMemo(() => {
        const arr = [];
        for (let y = currentYear - 3; y <= currentYear + 1; y++) {
            arr.push(String(y));
        }
        return arr;
    }, [currentYear]);

    const months = [
        { label: 'January', value: '01' },
        { label: 'February', value: '02' },
        { label: 'March', value: '03' },
        { label: 'April', value: '04' },
        { label: 'May', value: '05' },
        { label: 'June', value: '06' },
        { label: 'July', value: '07' },
        { label: 'August', value: '08' },
        { label: 'September', value: '09' },
        { label: 'October', value: '10' },
        { label: 'November', value: '11' },
        { label: 'December', value: '12' },
    ];

    const handleGeneratePayslip = async () => {
        if (!userSalary) {
            toast.error('No salary details available for this period');
            return;
        }
        try {
            setGeneratingPayslip(true);
            await generatePayslip(
                userSalary,
                month,
                year,
                user,
                staff,
                () => setGeneratingPayslip(true),
                () => setGeneratingPayslip(false)
            );
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || 'Failed to generate payslip');
            setGeneratingPayslip(false);
        }
    };

    const isWeekOffPaymentEnabled = staff?.week_off_payment || userSalary?.week_off_payment;
    const isWeekOffAsOvertimeEnabled = staff?.week_off_as_overtime || userSalary?.week_off_as_overtime;
    const isHolidayPaymentEnabled = staff?.holiday_extra_payment || userSalary?.holiday_extra_payment;
    const isHolidayAsOvertimeEnabled = staff?.holiday_as_overtime || userSalary?.holiday_as_overtime;

    return (
        <div className="space-y-6 w-full">
            {/* 1. Header Filter & Action Bar */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4 w-full">
                <div className="flex items-center gap-3 w-full md:w-auto">
                    {/* Month */}
                    <div className="w-36">
                        <Select value={month} onValueChange={setMonth}>
                            <SelectTrigger className="h-9 text-xs">
                                <SelectValue placeholder="Month" />
                            </SelectTrigger>
                            <SelectContent>
                                {months.map((m) => (
                                    <SelectItem key={m.value} value={m.value} className="text-xs">
                                        {m.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Year */}
                    <div className="w-28">
                        <Select value={year} onValueChange={setYear}>
                            <SelectTrigger className="h-9 text-xs">
                                <SelectValue placeholder="Year" />
                            </SelectTrigger>
                            <SelectContent>
                                {years.map((y) => (
                                    <SelectItem key={y} value={y} className="text-xs">
                                        {y}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                    <Button
                        size="sm"
                        disabled={generatingPayslip || isLoading || !userSalary}
                        onClick={handleGeneratePayslip}
                        className="gap-1.5 text-xs h-9 cursor-pointer"
                    >
                        <FileDown className="size-3.5" />
                        <span>{generatingPayslip ? 'Generating PDF...' : 'Generate Payslip (PDF)'}</span>
                    </Button>
                </div>
            </div>

            {isLoading ? (
                <div className="rounded-xl border border-border bg-card p-12 text-center text-xs text-muted-foreground w-full">
                    Calculating salary and fetching payroll records...
                </div>
            ) : !userSalary ? (
                <div className="rounded-xl border border-border bg-card p-12 text-center text-xs text-muted-foreground w-full">
                    No salary computation found for the selected period.
                </div>
            ) : (
                <div className="space-y-5 w-full">
                    {/* 2. Top Summary Grid: Salary Info & Attendance Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                        {/* Salary Info */}
                        <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3">
                            <div className="flex items-center gap-2 border-b border-border pb-2.5">
                                <IndianRupee className="size-4 text-primary" />
                                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                                    Salary Structure Info
                                </h3>
                            </div>

                            <div className="divide-y divide-border/60 text-xs">
                                <div className="py-2 flex items-center justify-between">
                                    <span className="text-muted-foreground">Pay Type</span>
                                    <span className="capitalize font-semibold text-foreground">
                                        {userSalary?.pay_type || 'Monthly'}
                                    </span>
                                </div>
                                <div className="py-2 flex items-center justify-between">
                                    <span className="text-muted-foreground">Monthly CTC</span>
                                    <span className="font-bold text-foreground">
                                        ₹ {Number(userSalary?.ctc || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="py-2 flex items-center justify-between">
                                    <span className="text-muted-foreground">Basic Salary</span>
                                    <span className="font-semibold text-foreground">
                                        ₹ {Number(userSalary?.basic_salary || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                {userSalary?.daily_salary && (
                                    <div className="py-2 flex items-center justify-between">
                                        <span className="text-muted-foreground">Daily Rate</span>
                                        <span className="font-mono text-foreground font-semibold">
                                            ₹ {Number(userSalary?.daily_salary || 0).toFixed(2)}
                                        </span>
                                    </div>
                                )}
                                {userSalary?.hourly_salary && (
                                    <div className="py-2 flex items-center justify-between">
                                        <span className="text-muted-foreground">Hourly Rate</span>
                                        <span className="font-mono text-foreground font-semibold">
                                            ₹ {Number(userSalary?.hourly_salary || 0).toFixed(2)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Attendance Summary */}
                        <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3">
                            <div className="flex items-center gap-2 border-b border-border pb-2.5">
                                <CalendarCheck className="size-4 text-emerald-600" />
                                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                                    Attendance Summary
                                </h3>
                            </div>

                            <div className="grid grid-cols-2 gap-x-4 divide-y divide-border/60 text-xs">
                                <div className="py-1.5 flex items-center justify-between">
                                    <span className="text-muted-foreground">Total Days</span>
                                    <span className="font-semibold text-foreground">{userSalary.total_days}</span>
                                </div>
                                <div className="py-1.5 flex items-center justify-between">
                                    <span className="text-muted-foreground">Payable Days</span>
                                    <span className="font-bold text-emerald-600">{userSalary.payable_days}</span>
                                </div>
                                <div className="py-1.5 flex items-center justify-between">
                                    <span className="text-muted-foreground">Present Days</span>
                                    <span className="font-semibold text-foreground">
                                        {Math.max(0, (userSalary.present_days || 0) - (userSalary.half_days || 0))}
                                    </span>
                                </div>
                                <div className="py-1.5 flex items-center justify-between">
                                    <span className="text-muted-foreground">Half Days</span>
                                    <span className="font-semibold text-blue-600">{userSalary.half_days || 0}</span>
                                </div>
                                <div className="py-1.5 flex items-center justify-between">
                                    <span className="text-muted-foreground">Present Weekoffs</span>
                                    <span className="font-semibold text-foreground">{userSalary.present_week_offs || 0}</span>
                                </div>
                                <div className="py-1.5 flex items-center justify-between">
                                    <span className="text-muted-foreground">Present Holidays</span>
                                    <span className="font-semibold text-foreground">{userSalary.present_holidays || 0}</span>
                                </div>
                                <div className="py-1.5 flex items-center justify-between">
                                    <span className="text-muted-foreground">Absent Days</span>
                                    <span className="font-semibold text-rose-600">{userSalary.absent_days || 0}</span>
                                </div>
                                <div className="py-1.5 flex items-center justify-between">
                                    <span className="text-muted-foreground">Paid Leaves</span>
                                    <span className="font-semibold text-amber-600">{userSalary.leave_days || 0}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. Side-by-Side: Benefits & Deductions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                        {/* Benefits */}
                        <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3">
                            <div className="flex items-center justify-between border-b border-border pb-2.5">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                                    Benefits & Allowances
                                </h3>
                                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                                    + ₹ {Number(userSalary?.total_benefits || 0).toFixed(2)}
                                </Badge>
                            </div>

                            {userSalary.benefits?.length > 0 ? (
                                <div className="divide-y divide-border/60 text-xs">
                                    {userSalary.benefits.map((b: any, idx: number) => (
                                        <div key={idx} className="py-2 flex items-center justify-between">
                                            <span className="text-muted-foreground">{b.payroll_head_name}</span>
                                            <span className="font-semibold text-emerald-600">
                                                + ₹ {Number(b.value || 0).toFixed(2)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground py-2">No benefits applied.</p>
                            )}
                        </div>

                        {/* Deductions */}
                        <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3">
                            <div className="flex items-center justify-between border-b border-border pb-2.5">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                                    Payroll Deductions
                                </h3>
                                <Badge variant="outline" className="text-[10px] bg-rose-500/10 text-rose-600 border-rose-500/20">
                                    - ₹ {Number(userSalary?.total_deductions || 0).toFixed(2)}
                                </Badge>
                            </div>

                            {userSalary.deductions?.length > 0 ? (
                                <div className="divide-y divide-border/60 text-xs">
                                    {userSalary.deductions.map((d: any, idx: number) => (
                                        <div key={idx} className="py-2 flex items-center justify-between">
                                            <span className="text-muted-foreground">{d.payroll_head_name}</span>
                                            <span className="font-semibold text-rose-600">
                                                - ₹ {Number(d.value || 0).toFixed(2)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground py-2">No deductions applied.</p>
                            )}
                        </div>
                    </div>

                    {/* 4. Side-by-Side: Advance Payments Made & Incentives */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                        {/* Advance Payments */}
                        <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3">
                            <div className="flex items-center justify-between border-b border-border pb-2.5">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                                        Advance Payments Made
                                    </h3>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setSelectedPayment(null);
                                        setAdvanceModalOpen(true);
                                    }}
                                    className="h-7 text-xs gap-1 cursor-pointer"
                                >
                                    <Plus className="size-3" />
                                    Add Payment
                                </Button>
                            </div>

                            {userSalary.payments_made?.length > 0 ? (
                                <div className="divide-y divide-border/60 text-xs">
                                    {userSalary.payments_made.map((pm: any, idx: number) => (
                                        <div
                                            key={idx}
                                            onClick={() => {
                                                setSelectedPayment(pm);
                                                setAdvanceModalOpen(true);
                                            }}
                                            className="py-2 flex items-center justify-between hover:bg-muted/40 px-1 rounded-md cursor-pointer transition-colors"
                                        >
                                            <div>
                                                <div className="font-medium text-foreground flex items-center gap-1.5">
                                                    <span>{pm.remarks || 'Advance Payment'}</span>
                                                    <Badge
                                                        variant="outline"
                                                        className={`text-[9px] py-0 ${
                                                            pm.status === 'paid'
                                                                ? 'text-emerald-600 border-emerald-500/20'
                                                                : 'text-amber-600 border-amber-500/20'
                                                        }`}
                                                    >
                                                        {pm.status}
                                                    </Badge>
                                                </div>
                                                <span className="text-[11px] text-muted-foreground font-mono">
                                                    {pm.date || pm.employee_salary_payment_date?.slice(0, 10)}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-rose-600">
                                                    - ₹ {Number(pm.amount || pm.employee_salary_payment_amount || 0).toFixed(2)}
                                                </span>
                                                <Pencil className="size-3 text-muted-foreground" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground py-2">No advance payments recorded this month.</p>
                            )}
                        </div>

                        {/* Incentives */}
                        <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3">
                            <div className="flex items-center justify-between border-b border-border pb-2.5">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                                        Performance Incentives
                                    </h3>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setSelectedIncentive(null);
                                        setIncentiveModalOpen(true);
                                    }}
                                    className="h-7 text-xs gap-1 cursor-pointer"
                                >
                                    <Plus className="size-3" />
                                    Add Incentive
                                </Button>
                            </div>

                            {userSalary.incentives?.length > 0 ? (
                                <div className="divide-y divide-border/60 text-xs">
                                    {userSalary.incentives.map((inc: any, idx: number) => (
                                        <div
                                            key={idx}
                                            onClick={() => {
                                                setSelectedIncentive(inc);
                                                setIncentiveModalOpen(true);
                                            }}
                                            className="py-2 flex items-center justify-between hover:bg-muted/40 px-1 rounded-md cursor-pointer transition-colors"
                                        >
                                            <div>
                                                <div className="font-medium text-foreground">
                                                    {inc.remarks || 'Spot Incentive'}
                                                </div>
                                                <span className="text-[11px] text-muted-foreground font-mono">
                                                    {inc.incentive_date?.slice(0, 10)}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-emerald-600">
                                                    + ₹ {Number(inc.incentive_amount || 0).toFixed(2)}
                                                </span>
                                                <Pencil className="size-3 text-muted-foreground" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground py-2">No incentives added for this month.</p>
                            )}
                        </div>
                    </div>

                    {/* 5. Additional V1 Details: Present Incentives & Loans Applied */}
                    {(userSalary.present_incentives?.length > 0 || userSalary.loans_emi?.length > 0) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                            {userSalary.present_incentives?.length > 0 && (
                                <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3">
                                    <div className="flex items-center gap-2 border-b border-border pb-2.5">
                                        <Award className="size-4 text-emerald-600" />
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                                            Shift Present Incentives
                                        </h3>
                                    </div>
                                    <div className="divide-y divide-border/60 text-xs">
                                        {userSalary.present_incentives.map((pi: any, idx: number) => (
                                            <div key={idx} className="py-2 flex items-center justify-between">
                                                <div>
                                                    <span className="font-medium text-foreground block">
                                                        {pi.shift?.shift_name || 'Standard Shift'}
                                                    </span>
                                                    <span className="text-[11px] text-muted-foreground font-mono">
                                                        {pi.date}
                                                    </span>
                                                </div>
                                                <span className="font-semibold text-emerald-600">
                                                    + ₹ {Number(pi.amount || 0).toFixed(2)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {userSalary.loans_emi?.length > 0 && (
                                <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3">
                                    <div className="flex items-center gap-2 border-b border-border pb-2.5">
                                        <CreditCard className="size-4 text-rose-600" />
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                                            Loan / EMI Deductions
                                        </h3>
                                    </div>
                                    <div className="divide-y divide-border/60 text-xs">
                                        {userSalary.loans_emi.map((l: any, idx: number) => (
                                            <div key={idx} className="py-2 flex items-center justify-between">
                                                <div>
                                                    <span className="font-medium text-foreground block">
                                                        {l.loan_title} {l.is_emi ? '(EMI)' : ''}
                                                    </span>
                                                </div>
                                                <span className="font-semibold text-rose-600">
                                                    - ₹ {Number(l.is_emi ? l.emi_amount : l.loan_amount || 0).toFixed(2)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 6. Hourly / Overtime Daily Insights Table */}
                    {userSalary?.over_time_data && Object.keys(userSalary.over_time_data).length > 0 && (
                        <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3 w-full">
                            <div className="flex items-center gap-2 border-b border-border pb-2.5">
                                <Timer className="size-4 text-primary" />
                                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                                    Overtime Payments Insights
                                </h3>
                            </div>
                            <div className="overflow-x-auto rounded-lg border border-border">
                                <table className="w-full text-xs">
                                    <thead className="bg-muted/50 border-b border-border text-muted-foreground">
                                        <tr>
                                            <th className="px-4 py-2 text-left font-semibold">Date</th>
                                            <th className="px-4 py-2 text-left font-semibold">OT Hours</th>
                                            <th className="px-4 py-2 text-right font-semibold">Daily Total (₹)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/60">
                                        {Object.entries(userSalary.over_time_data).map(([dt, hrs]) => {
                                            const rate = userSalary?.total_ot?.hourly_rate || 0;
                                            const tot = Number(hrs) * rate;
                                            return (
                                                <tr key={dt} className="hover:bg-muted/30">
                                                    <td className="px-4 py-2 font-mono text-muted-foreground">{dt}</td>
                                                    <td className="px-4 py-2 font-semibold">
                                                        {Math.floor(hrs)}h {Math.round((hrs - Math.floor(hrs)) * 60)}m
                                                    </td>
                                                    <td className="px-4 py-2 font-bold text-emerald-600 text-right">
                                                        ₹ {tot.toFixed(2)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* 7. Comprehensive Salary Calculations Ledger */}
                    <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-3 w-full">
                        <div className="flex items-center gap-2 border-b border-border pb-2.5">
                            <TrendingUp className="size-4 text-primary" />
                            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                                Comprehensive Payroll Ledger Breakdown
                            </h3>
                        </div>

                        <div className="divide-y divide-border/60 text-xs">
                            {/* Regular Basic Earnings */}
                            <div className="py-2 flex items-center justify-between">
                                <div>
                                    <span className="font-medium text-foreground block">Basic Payable Earnings</span>
                                    <span className="text-[11px] text-muted-foreground">
                                        {userSalary?.payable_days} days × ₹ {(userSalary?.daily_salary || 0).toFixed(2)}/day
                                    </span>
                                </div>
                                <span className="font-semibold text-foreground">
                                    ₹ {Number(userSalary.regular_earnings || 0).toFixed(2)}
                                </span>
                            </div>

                            {/* Total Benefits */}
                            <div className="py-2 flex items-center justify-between">
                                <span className="font-medium text-foreground">Total Benefits & Allowances</span>
                                <span className="font-semibold text-emerald-600">
                                    + ₹ {Number(userSalary.total_benefits || 0).toFixed(2)}
                                </span>
                            </div>

                            {/* Overtime */}
                            {Number(userSalary?.total_ot?.total_amount || 0) > 0 && (
                                <div className="py-2 flex items-center justify-between">
                                    <div>
                                        <span className="font-medium text-foreground block">Overtime Earnings</span>
                                        <span className="text-[11px] text-muted-foreground">
                                            {userSalary?.total_ot?.hours_worked?.toFixed(2)} hrs × ₹ {userSalary?.total_ot?.hourly_rate || 0}/hr
                                        </span>
                                    </div>
                                    <span className="font-semibold text-emerald-600">
                                        + ₹ {Number(userSalary.total_ot.total_amount).toFixed(2)}
                                    </span>
                                </div>
                            )}

                            {/* Present Incentives Total */}
                            {Number(userSalary?.total_present_incentive || 0) > 0 && (
                                <div className="py-2 flex items-center justify-between">
                                    <span className="font-medium text-foreground">Total Present Incentives</span>
                                    <span className="font-semibold text-emerald-600">
                                        + ₹ {Number(userSalary.total_present_incentive).toFixed(2)}
                                    </span>
                                </div>
                            )}

                            {/* Incentives Total */}
                            {Number(userSalary?.total_incentive || 0) > 0 && (
                                <div className="py-2 flex items-center justify-between">
                                    <span className="font-medium text-foreground">Total Incentives</span>
                                    <span className="font-semibold text-emerald-600">
                                        + ₹ {Number(userSalary.total_incentive).toFixed(2)}
                                    </span>
                                </div>
                            )}

                            {/* Week Off / Holiday Earnings */}
                            {isWeekOffPaymentEnabled && Number(userSalary?.total_week_off_earnings || 0) > 0 && (
                                <div className="py-2 flex items-center justify-between">
                                    <span className="font-medium text-foreground">Week Off Worked Earnings</span>
                                    <span className="font-semibold text-emerald-600">
                                        + ₹ {Number(userSalary.total_week_off_earnings).toFixed(2)}
                                    </span>
                                </div>
                            )}

                            {isHolidayPaymentEnabled && Number(userSalary?.total_holiday_earnings || 0) > 0 && (
                                <div className="py-2 flex items-center justify-between">
                                    <span className="font-medium text-foreground">Holiday Worked Earnings</span>
                                    <span className="font-semibold text-emerald-600">
                                        + ₹ {Number(userSalary.total_holiday_earnings).toFixed(2)}
                                    </span>
                                </div>
                            )}

                            {/* Deductions */}
                            <div className="py-2 flex items-center justify-between">
                                <span className="font-medium text-foreground">Total Payroll Deductions</span>
                                <span className="font-semibold text-rose-600">
                                    - ₹ {Number(userSalary.total_deductions || 0).toFixed(2)}
                                </span>
                            </div>

                            {/* Loan / EMI */}
                            {Number(userSalary.total_loan_amount || 0) > 0 && (
                                <div className="py-2 flex items-center justify-between">
                                    <span className="font-medium text-foreground">Total Loan / EMI Deductions</span>
                                    <span className="font-semibold text-rose-600">
                                        - ₹ {Number(userSalary.total_loan_amount).toFixed(2)}
                                    </span>
                                </div>
                            )}

                            {/* Advance Payments */}
                            {Number(userSalary.total_payments_made || 0) > 0 && (
                                <div className="py-2 flex items-center justify-between">
                                    <span className="font-medium text-foreground">Advance Payments Deducted</span>
                                    <span className="font-semibold text-rose-600">
                                        - ₹ {Number(userSalary.total_payments_made).toFixed(2)}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 8. Net Payable Hero Card */}
                    <div className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/15 p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 w-full">
                        <div>
                            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                                Net Salary Payable
                            </span>
                            <div className="text-3xl font-extrabold tracking-tight text-emerald-700 dark:text-emerald-400 mt-1">
                                ₹ {Number(userSalary?.net_payable || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                disabled={generatingPayslip}
                                onClick={handleGeneratePayslip}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs cursor-pointer"
                            >
                                <FileDown className="size-4" />
                                <span>Download Payslip</span>
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Advance Payment Modal */}
            <AddAdvancePaymentModal
                open={advanceModalOpen}
                onOpenChange={setAdvanceModalOpen}
                empId={empId}
                initialData={selectedPayment}
                isEditMode={!!selectedPayment}
            />

            {/* Incentive Modal */}
            <AddIncentiveModal
                open={incentiveModalOpen}
                onOpenChange={setIncentiveModalOpen}
                empId={empId}
                editableData={selectedIncentive}
                editMode={!!selectedIncentive}
            />
        </div>
    );
}
