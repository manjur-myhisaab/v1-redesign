// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
    ChevronLeft,
    ChevronRight,
    FileDown,
    FileSpreadsheet,
    MapPin,
    CalendarCheck2,
    Clock,
    Briefcase,
    Calendar as CalendarIcon,
} from 'lucide-react';
import rdk, { customEndpoint, readItems } from '@/services/server';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import UserPerDayAttendanceModal from '../modals/UserPerDayAttendanceModal';
import {
    downloadOdometerExcel,
    exportTasksToExcel,
    downloadVisitReportExcel,
} from '../utils/staffExports';
import { downloadEmployeewiseAttedanceReport } from '@/lib/reports/attendance/pdf-export/downloadEmployeewiseAttedanceReport';

interface AttendanceTabProps {
    empId: string;
    staff: any;
    user: any;
}

export default function AttendanceTab({ empId, staff, user }: AttendanceTabProps) {
    const now = new Date();
    const [month, setMonth] = useState<number>(() => {
        const s = sessionStorage.getItem('month');
        return s ? Number(s) : now.getMonth() + 1;
    });
    const [year, setYear] = useState<number>(() => {
        const s = sessionStorage.getItem('year');
        return s ? Number(s) : now.getFullYear();
    });

    const [modalActive, setModalActive] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    useEffect(() => {
        sessionStorage.setItem('month', String(month));
        sessionStorage.setItem('year', String(year));
    }, [month, year]);

    const firmId = user?.firm_id?.firm_id || user?.firm_id?.id || user?.firm_id || '';

    // Fetch Daily Attendance with Shifts
    const { data: userAttendance, isLoading } = useQuery({
        queryKey: ['DailyAttnWithShifts', year, month, empId, firmId],
        queryFn: async () => {
            if (!firmId) return null;
            return await rdk.request(
                customEndpoint({
                    path: `api/DailyAttnWithShifts/${year}-${month}/${empId}/${firmId}`,
                    method: 'GET',
                    fields: ['shift_id.*'],
                })
            );
        },
        enabled: !!empId && !!firmId,
        refetchOnWindowFocus: false,
    });

    // Calculate Attendance Summary exactly as in V1
    const summary = useMemo(() => {
        const s = {
            Present: 0,
            Absent: 0,
            HalfDay: 0,
            PaidLeave: 0,
            Holiday: 0,
            WeekOff: 0,
            Late: 0,
            EarlyExit: 0,
        };

        let prevDate: string | null = null;
        const attendances = userAttendance?.attendances || [];

        attendances.forEach((entry: any) => {
            if (entry.absent === true) {
                if (entry.week_off === true) {
                    s.WeekOff += 1;
                    s.Absent += 1;
                } else if (entry.holiday === true) {
                    s.Holiday += 1;
                    s.Absent += 1;
                } else {
                    s.Absent += 1;
                }
            } else if (entry.leave === true) {
                s.PaidLeave += 1;
            } else if (entry.holiday === true) {
                s.Holiday += 1;
            } else if (entry.week_off === true) {
                s.WeekOff += 1;
            } else if (entry.in_time !== null) {
                if (entry.in_formatted_time) {
                    if (entry.week_off === true) s.WeekOff += 1;
                    if (entry.holiday === true) s.Holiday += 1;
                    if (prevDate !== entry.date) s.Present += 1;
                }
                if (entry.half_day === true || entry.calculated_half_day === true) s.HalfDay += 1;
                if (entry.late === true) s.Late += 1;
                if (entry.early_exit === true) s.EarlyExit += 1;
            }
            prevDate = entry.date;
        });

        return s;
    }, [userAttendance]);

    // Month Navigation
    const handlePrevMonth = () => {
        if (month === 1) {
            setMonth(12);
            setYear((prev) => prev - 1);
        } else {
            setMonth((prev) => prev - 1);
        }
    };

    const handleNextMonth = () => {
        if (month === 12) {
            setMonth(1);
            setYear((prev) => prev + 1);
        } else {
            setMonth((prev) => prev + 1);
        }
    };

    const monthName = new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' });

    // Download Monthly PDF Report
    const handleDownloadPdf = async () => {
        try {
            toast.loading('Generating Monthly PDF Report...', { id: 'pdf-summary' });
            await downloadEmployeewiseAttedanceReport(firmId, empId, month, year, staff);
            toast.success('Monthly Report downloaded successfully', { id: 'pdf-summary' });
        } catch (err) {
            console.error('PDF download error:', err);
            toast.error('Failed to generate Monthly PDF Report', { id: 'pdf-summary' });
        }
    };

    // Calendar Matrix Generator
    const calendarDays = useMemo(() => {
        const daysInMonth = new Date(year, month, 0).getDate();
        const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0 is Sunday
        // We adjust so Monday is column 0
        const startOffset = (firstDayOfWeek + 6) % 7;

        const days: any[] = [];
        for (let i = 0; i < startOffset; i++) {
            days.push({ empty: true });
        }

        const attendances = userAttendance?.attendances || [];

        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(year, month - 1, d);
            const dd = String(d).padStart(2, '0');
            const mm = String(month).padStart(2, '0');
            const dateKey = `${dd}-${mm}-${year}`;

            // V1 logic: filter all entries for this date as dateGroup, and find first entry
            const dateGroup = attendances.filter((e: any) => e.date === dateKey);
            const entry = attendances.find((e: any) => e.date === dateKey);

            // 1. Determine Tile Type (from V1 tileClassName)
            let tileType:
                | 'absent'
                | 'holiday-present'
                | 'holiday'
                | 'weekoff-present'
                | 'weekoff'
                | 'leave'
                | 'checkinonly'
                | 'present'
                | 'halfday'
                | null = null;

            if (entry) {
                if (entry.absent === true || entry.TP === 'absent') {
                    tileType = 'absent';
                } else if (entry.holiday === true) {
                    if (entry.in_formatted_time) tileType = 'holiday-present';
                    else tileType = 'holiday';
                } else if (entry.week_off === true) {
                    if (entry.in_formatted_time) tileType = 'weekoff-present';
                    else tileType = 'weekoff';
                } else if (entry.leave === true) {
                    tileType = 'leave';
                } else if (
                    entry.in_formatted_time &&
                    (!entry.out_formatted_time || entry.out_time?.made_by === 'system')
                ) {
                    tileType = 'checkinonly';
                } else if (entry.in_formatted_time) {
                    tileType = 'present';
                } else if (entry.half_day) {
                    tileType = 'halfday';
                }
            }

            // 2. Determine Labels & Flags (from V1 tileContent loop)
            let label: string | null = null;
            let showHalfDay = false;
            let showWeekOff = false;
            let showHoliday = false;
            let showWeekOffPresent = false;
            let showHolidayPresent = false;
            let showLate = false;
            let showEarly = false;
            let showLateAndEarly = false;
            let showLateAndHalfDay = false;
            let showEarlyAndHalfDay = false;

            if (dateGroup && dateGroup.length > 0) {
                for (const ent of dateGroup) {
                    if (ent.absent === true || ent.TP === 'absent') {
                        label = '';
                    } else if (ent.TP === 'holiday') {
                        label = 'Holiday';
                        break;
                    } else if (ent.leave === true) {
                        label = 'Leave';
                    } else if (ent.half_day === true || ent.calculated_half_day === true) {
                        if (ent.late === true) {
                            if (ent.early_exit === true) showLateAndHalfDay = true;
                            else showLateAndHalfDay = true;
                        } else if (ent.early_exit === true) {
                            showEarlyAndHalfDay = true;
                        } else {
                            showHalfDay = true;
                        }
                    } else if (ent.week_off === true) {
                        if (ent.in_formatted_time) showWeekOffPresent = true;
                        else showWeekOff = true;
                    } else if (ent.holiday === true) {
                        if (ent.in_formatted_time) showHolidayPresent = true;
                        else showHoliday = true;
                    } else if (ent.late === true && ent.early_exit === true) {
                        showLateAndEarly = true;
                    } else if (ent.late === true) {
                        if (ent.half_day === true) showLateAndHalfDay = true;
                        else showLate = true;
                    } else if (ent.early_exit === true) {
                        if (ent.half_day === true) showEarlyAndHalfDay = true;
                        else showEarly = true;
                    }
                }
            }

            // 3. Resolve Display Status Text and Visual Variant
            let displayStatus = '';
            let statusVariant:
                | 'present'
                | 'absent'
                | 'halfday'
                | 'late'
                | 'holiday'
                | 'weekoff'
                | 'leave'
                | 'checkinonly'
                | 'none' = 'none';

            if (label) {
                displayStatus = label;
                if (label === 'Holiday') statusVariant = 'holiday';
                else if (label === 'Leave') statusVariant = 'leave';
                else statusVariant = 'none';
            } else if (label === '') {
                // Absent in loop
                if (tileType === 'absent') {
                    displayStatus = 'Absent';
                    statusVariant = 'absent';
                }
            } else {
                // !label (label is null)
                if (showLateAndEarly) {
                    displayStatus = 'Late & Early';
                    statusVariant = 'late';
                } else if (showLateAndHalfDay) {
                    displayStatus = 'Late & HalfDay';
                    statusVariant = 'late';
                } else if (showEarlyAndHalfDay) {
                    displayStatus = 'Early & HalfDay';
                    statusVariant = 'late';
                } else if (showHalfDay) {
                    displayStatus = 'Half Day';
                    statusVariant = 'halfday';
                } else if (showWeekOff) {
                    displayStatus = 'Week Off';
                    statusVariant = 'weekoff';
                } else if (showWeekOffPresent) {
                    displayStatus = 'WeekOff Present';
                    statusVariant = 'present';
                } else if (showHoliday) {
                    displayStatus = 'Holiday';
                    statusVariant = 'holiday';
                } else if (showHolidayPresent) {
                    displayStatus = 'Holiday Present';
                    statusVariant = 'present';
                } else if (showLate) {
                    displayStatus = 'Late';
                    statusVariant = 'late';
                } else if (showEarly) {
                    displayStatus = 'Early';
                    statusVariant = 'late';
                } else if (tileType === 'present') {
                    displayStatus = 'Present';
                    statusVariant = 'present';
                } else if (tileType === 'absent') {
                    displayStatus = 'Absent';
                    statusVariant = 'absent';
                } else if (tileType === 'checkinonly') {
                    displayStatus = 'Check-in Only';
                    statusVariant = 'checkinonly';
                } else if (tileType === 'holiday') {
                    displayStatus = 'Holiday';
                    statusVariant = 'holiday';
                } else if (tileType === 'holiday-present') {
                    displayStatus = 'Holiday Present';
                    statusVariant = 'present';
                } else if (tileType === 'weekoff') {
                    displayStatus = 'Week Off';
                    statusVariant = 'weekoff';
                } else if (tileType === 'weekoff-present') {
                    displayStatus = 'WeekOff Present';
                    statusVariant = 'present';
                } else if (tileType === 'leave') {
                    displayStatus = 'Leave';
                    statusVariant = 'leave';
                } else if (tileType === 'halfday') {
                    displayStatus = 'Half Day';
                    statusVariant = 'halfday';
                }
            }

            const dayOfWeek = (startOffset + d - 1) % 7;
            const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; // Sat or Sun

            days.push({
                empty: false,
                dayNumber: d,
                date: dateObj,
                entry,
                tileType,
                displayStatus,
                statusVariant,
                inTime: entry?.in_formatted_time || '',
                outTime: entry?.out_formatted_time || '',
                isWeekend,
            });
        }

        return days;
    }, [year, month, userAttendance]);

    return (
        <div className="space-y-5 w-full">
            {/* 1. Quick Monthly Reports Bar */}
            <div className="rounded-xl border border-border bg-card p-3.5 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 w-full">
                <div className="flex items-center gap-2">
                    <FileSpreadsheet className="size-4 text-primary shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Monthly Reports ({monthName} {year})
                    </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadPdf}
                        className="text-xs gap-1.5 h-8.5 px-3 flex-1 sm:flex-none border-primary/30 text-primary hover:bg-primary/5 cursor-pointer"
                    >
                        <FileDown className="size-3.5" />
                        <span>Summary Sheet (PDF)</span>
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            downloadOdometerExcel(empId, staff?.name || 'Staff', user?.firm_id?.firm_name, month, year)
                        }
                        className="text-xs gap-1.5 h-8.5 px-3 flex-1 sm:flex-none cursor-pointer"
                    >
                        <FileSpreadsheet className="size-3.5" />
                        <span>Odometer Report</span>
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            exportTasksToExcel(
                                empId,
                                staff?.name || 'Staff',
                                `${user?.first_name || ''} ${user?.last_name || ''}`,
                                user?.firm_id?.firm_name,
                                month,
                                year
                            )
                        }
                        className="text-xs gap-1.5 h-8.5 px-3 flex-1 sm:flex-none cursor-pointer"
                    >
                        <Briefcase className="size-3.5" />
                        <span>Task Report</span>
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            downloadVisitReportExcel(empId, staff?.name || 'Staff', user?.firm_id?.firm_name, month, year)
                        }
                        className="text-xs gap-1.5 h-8.5 px-3 flex-1 sm:flex-none cursor-pointer"
                    >
                        <MapPin className="size-3.5" />
                        <span>Visits Report</span>
                    </Button>
                </div>
            </div>

            {/* 2. 8 Attendance Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 w-full">
                {[
                    {
                        label: 'Present',
                        value: Math.max(0, (summary.Present || 0) - (summary.HalfDay || 0)),
                        color: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
                    },
                    {
                        label: 'Absent',
                        value: summary.Absent || 0,
                        color: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400',
                    },
                    {
                        label: 'Half Day',
                        value: summary.HalfDay || 0,
                        color: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400',
                    },
                    {
                        label: 'Holiday',
                        value: summary.Holiday || 0,
                        color: 'border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-400',
                    },
                    {
                        label: 'Week Off',
                        value: summary.WeekOff || 0,
                        color: 'border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300',
                    },
                    {
                        label: 'Paid Leave',
                        value: summary.PaidLeave || 0,
                        color: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
                    },
                    {
                        label: 'Late',
                        value: summary.Late || 0,
                        color: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-800 dark:text-yellow-400',
                    },
                    {
                        label: 'Early Exit',
                        value: summary.EarlyExit || 0,
                        color: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-400',
                    },
                ].map((item, idx) => (
                    <div
                        key={idx}
                        className={`rounded-xl border p-3 shadow-xs flex flex-col justify-between ${item.color}`}
                    >
                        <span className="text-[10px] uppercase font-bold tracking-wider opacity-90 truncate">
                            {item.label}
                        </span>
                        <div className="mt-1 flex items-baseline gap-1">
                            <span className="text-xl font-extrabold tracking-tight">{item.value}</span>
                            <span className="text-[10px] font-semibold opacity-75">days</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* 3. Monthly Calendar Grid */}
            <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden w-full">
                {/* Month Navigator Header */}
                <div className="p-4 border-b border-border bg-muted/40 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CalendarIcon className="size-4 text-primary" />
                        <h2 className="text-sm font-bold text-foreground">
                            {monthName} {year}
                        </h2>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <Button
                            variant="outline"
                            size="icon"
                            className="size-7 cursor-pointer"
                            onClick={handlePrevMonth}
                            title="Previous Month"
                        >
                            <ChevronLeft className="size-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7 px-2.5 cursor-pointer font-semibold"
                            onClick={() => {
                                setMonth(now.getMonth() + 1);
                                setYear(now.getFullYear());
                            }}
                        >
                            Today
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            className="size-7 cursor-pointer"
                            onClick={handleNextMonth}
                            title="Next Month"
                        >
                            <ChevronRight className="size-4" />
                        </Button>
                    </div>
                </div>

                {/* Day of week header */}
                <div className="grid grid-cols-7 border-b border-border bg-muted/20 text-center text-[11px] font-bold text-muted-foreground py-2.5">
                    <span>Mon</span>
                    <span>Tue</span>
                    <span>Wed</span>
                    <span>Thu</span>
                    <span>Fri</span>
                    <span className="text-primary font-extrabold">Sat</span>
                    <span className="text-rose-500 font-extrabold">Sun</span>
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 divide-x divide-y divide-border/60">
                    {calendarDays.map((cell, idx) => {
                        if (cell.empty) {
                            return <div key={`empty-${idx}`} className="min-h-[92px] bg-muted/15" />;
                        }

                        const isToday =
                            cell.date?.getDate() === now.getDate() &&
                            cell.date?.getMonth() === now.getMonth() &&
                            cell.date?.getFullYear() === now.getFullYear();

                        return (
                            <div
                                key={`day-${cell.dayNumber}`}
                                onClick={() => {
                                    setSelectedDate(cell.date);
                                    setModalActive(true);
                                }}
                                className={`min-h-[92px] p-2 flex flex-col justify-between cursor-pointer transition-all hover:bg-muted/40 relative group ${
                                    isToday
                                        ? 'bg-primary/5 ring-1 ring-primary/30'
                                        : cell.statusVariant === 'absent'
                                        ? 'bg-rose-500/[0.04]'
                                        : cell.statusVariant === 'present'
                                        ? 'bg-emerald-500/[0.04]'
                                        : cell.statusVariant === 'halfday' || cell.statusVariant === 'holiday'
                                        ? 'bg-teal-500/[0.04]'
                                        : cell.statusVariant === 'leave' || cell.statusVariant === 'checkinonly'
                                        ? 'bg-amber-500/[0.04]'
                                        : cell.isWeekend
                                        ? 'bg-muted/5'
                                        : ''
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span
                                        className={`size-6 text-xs flex items-center justify-center rounded-full font-bold ${
                                            isToday
                                                ? 'bg-primary text-primary-foreground shadow-xs'
                                                : cell.isWeekend
                                                ? 'text-muted-foreground font-semibold'
                                                : 'text-foreground'
                                        }`}
                                    >
                                        {cell.dayNumber}
                                    </span>

                                    {/* Status Dot matching V1 logic */}
                                    {cell.statusVariant === 'present' && (
                                        <span className="size-2 rounded-full bg-emerald-500" title="Present" />
                                    )}
                                    {cell.statusVariant === 'absent' && (
                                        <span className="size-2 rounded-full bg-rose-500" title="Absent" />
                                    )}
                                    {cell.statusVariant === 'leave' && (
                                        <span className="size-2 rounded-full bg-amber-500" title="Leave" />
                                    )}
                                    {cell.statusVariant === 'holiday' && (
                                        <span className="size-2 rounded-full bg-[#157070]" title="Holiday" />
                                    )}
                                    {cell.statusVariant === 'weekoff' && (
                                        <span className="size-2 rounded-full bg-slate-400" title="Week Off" />
                                    )}
                                    {cell.statusVariant === 'halfday' && (
                                        <span className="size-2 rounded-full bg-[#157070]" title="Half Day" />
                                    )}
                                    {cell.statusVariant === 'late' && (
                                        <span className="size-2 rounded-full bg-rose-500" title={cell.displayStatus} />
                                    )}
                                    {cell.statusVariant === 'checkinonly' && (
                                        <span className="size-2 rounded-full bg-amber-500" title="Check-in Only" />
                                    )}
                                </div>

                                {/* Status Details & Badges */}
                                <div className="space-y-1">
                                    {cell.displayStatus && (
                                        <span
                                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold tracking-tight truncate max-w-full ${
                                                cell.statusVariant === 'present'
                                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                                                    : cell.statusVariant === 'absent'
                                                    ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/20'
                                                    : cell.statusVariant === 'leave'
                                                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                                                    : cell.statusVariant === 'holiday'
                                                    ? 'bg-[#157070]/15 text-[#157070] dark:text-teal-400 border border-[#157070]/20'
                                                    : cell.statusVariant === 'halfday'
                                                    ? 'bg-[#157070]/15 text-[#157070] dark:text-teal-400 border border-[#157070]/20'
                                                    : cell.statusVariant === 'late'
                                                    ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/20'
                                                    : cell.statusVariant === 'checkinonly'
                                                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                                                    : 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/20'
                                            }`}
                                        >
                                            {cell.displayStatus}
                                        </span>
                                    )}

                                    {/* Punch time snippet shown ONLY when not Absent */}
                                    {cell.displayStatus !== 'Absent' && cell.inTime && (
                                        <div className="text-[9px] font-mono text-muted-foreground truncate">
                                            {cell.inTime} {cell.outTime ? `— ${cell.outTime}` : ''}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Per-Day Attendance Detail & Odometer Modal */}
            <UserPerDayAttendanceModal
                open={modalActive}
                onOpenChange={setModalActive}
                empId={empId}
                staffName={staff?.name || 'Staff Member'}
                date={selectedDate}
                onDateChange={(d) => setSelectedDate(d)}
            />
        </div>
    );
}
