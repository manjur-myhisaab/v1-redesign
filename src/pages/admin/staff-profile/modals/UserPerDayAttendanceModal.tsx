// @ts-nocheck
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    ChevronLeft,
    ChevronRight,
    Pencil,
    Plus,
    Calendar,
    Clock,
    MapPin,
    Camera,
    Gauge,
    ArrowLeft,
    X,
} from 'lucide-react';
import rdk, { ATTENDANCE_SERVER_URL, readItems } from '@/services/server';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ImageLightbox from '@/components/ui/image-lightbox';
import AddAttendanceFormModal from './AddAttendanceFormModal';
import AttendanceMapView from './AttendanceMapView';

interface UserPerDayAttendanceModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    empId: string;
    staffName: string;
    date: Date | null;
    onDateChange?: (date: Date) => void;
}

export default function UserPerDayAttendanceModal({
    open,
    onOpenChange,
    empId,
    staffName,
    date,
    onDateChange,
}: UserPerDayAttendanceModalProps) {
    const [currentDate, setCurrentDate] = useState<Date>(() => (date ? new Date(date) : new Date()));
    const [activeTab, setActiveTab] = useState<'attendance' | 'odometer' | 'map'>('attendance');
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);
    const [editingRecord, setEditingRecord] = useState<any | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);

    // Sync when date prop changes
    React.useEffect(() => {
        if (date) {
            setCurrentDate(new Date(date));
        }
    }, [date]);

    const dateStr = useMemo(() => {
        const d = currentDate;
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }, [currentDate]);

    const formattedDateLong = useMemo(() => {
        return currentDate.toLocaleDateString('en-US', {
            weekday: 'short',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    }, [currentDate]);

    const handlePrevDay = () => {
        const next = new Date(currentDate);
        next.setDate(next.getDate() - 1);
        setCurrentDate(next);
        onDateChange?.(next);
    };

    const handleNextDay = () => {
        const next = new Date(currentDate);
        next.setDate(next.getDate() + 1);
        setCurrentDate(next);
        onDateChange?.(next);
    };

    // 1. Fetch Day Attendance Punches
    const {
        data: attendancePunches = [],
        isLoading: punchesLoading,
        refetch: refetchPunches,
    } = useQuery({
        queryKey: ['day-attendance-punches', empId, dateStr],
        queryFn: async () => {
            const start = `${dateStr}T00:00:00`;
            const end = `${dateStr}T23:59:59`;
            const res = await rdk.request(
                readItems('attendance', {
                    sort: ['timestamp'],
                    filter: {
                        _and: [
                            { employee_id: { _eq: empId } },
                            { timestamp: { _between: [start, end] } },
                        ],
                    },
                })
            );
            return Array.isArray(res) ? res : res?.data || [];
        },
        enabled: !!empId && !!dateStr && open,
    });

    // 2. Fetch Odometer Readings
    const { data: odometerReadings = [], isLoading: odometerLoading } = useQuery({
        queryKey: ['day-odometer-readings', empId, dateStr],
        queryFn: async () => {
            const start = `${dateStr}T00:00:00`;
            const end = `${dateStr}T23:59:59`;
            const res = await rdk.request(
                readItems('odometer_readings', {
                    sort: ['date_created'],
                    filter: {
                        _and: [
                            { employee_id: { _eq: empId } },
                            { reading_timestamp: { _between: [start, end] } },
                        ],
                    },
                })
            );
            return Array.isArray(res) ? res : res?.data || [];
        },
        enabled: !!empId && !!dateStr && open && activeTab === 'odometer',
    });

    // Pair Odometer In / Out
    const pairedOdometer = useMemo(() => {
        const pairs: any[] = [];
        let curPair: any = {};
        odometerReadings.forEach((item: any) => {
            if (item.reading_type === 'in') {
                if (curPair.in) pairs.push(curPair);
                curPair = { in: item };
            } else if (item.reading_type === 'out') {
                curPair.out = item;
                pairs.push(curPair);
                curPair = {};
            }
        });
        if (curPair.in) pairs.push(curPair);
        return pairs;
    }, [odometerReadings]);

    const formatPunchTime = (ts?: string) => {
        if (!ts) return '-';
        return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0">
                    {/* Header */}
                    <div className="p-5 border-b border-border bg-card sticky top-0 z-10 flex items-center justify-between">
                        <div>
                            <DialogTitle className="text-base font-bold text-foreground">
                                {staffName || 'Employee'} — Daily Records
                            </DialogTitle>
                            {/* Date Nav Picker */}
                            <div className="flex items-center gap-2 mt-1.5">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="size-7"
                                    onClick={handlePrevDay}
                                    title="Previous Day"
                                >
                                    <ChevronLeft className="size-4" />
                                </Button>
                                <span className="text-xs font-semibold text-foreground px-2 py-1 rounded-md bg-muted/60">
                                    {formattedDateLong}
                                </span>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="size-7"
                                    onClick={handleNextDay}
                                    title="Next Day"
                                >
                                    <ChevronRight className="size-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Tabs */}
                        {!isFormOpen && (
                            <div className="flex items-center bg-muted p-1 rounded-lg border border-border text-xs">
                                <button
                                    onClick={() => setActiveTab('attendance')}
                                    className={`px-3 py-1 rounded-md font-semibold transition-all ${
                                        activeTab === 'attendance'
                                            ? 'bg-card text-foreground shadow-xs'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    Attendance
                                </button>
                                <button
                                    onClick={() => setActiveTab('odometer')}
                                    className={`px-3 py-1 rounded-md font-semibold transition-all ${
                                        activeTab === 'odometer'
                                            ? 'bg-card text-foreground shadow-xs'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    Odometer
                                </button>
                                <button
                                    onClick={() => setActiveTab('map')}
                                    className={`px-3 py-1 rounded-md font-semibold transition-all ${
                                        activeTab === 'map'
                                            ? 'bg-card text-foreground shadow-xs'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    Map View
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Body Content */}
                    <div className="p-5">
                        {isFormOpen ? (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between border-b border-border pb-3">
                                    <h3 className="text-sm font-bold text-foreground">
                                        {editingRecord ? 'Edit Attendance Record' : 'Mark New Attendance'}
                                    </h3>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setIsFormOpen(false);
                                            setEditingRecord(null);
                                        }}
                                        className="gap-1.5 text-xs"
                                    >
                                        <ArrowLeft className="size-3.5" />
                                        Back to Records
                                    </Button>
                                </div>
                                <AddAttendanceFormModal
                                    empId={empId}
                                    date={currentDate}
                                    singleData={editingRecord}
                                    formType={editingRecord ? 'edit' : 'add'}
                                    onSuccess={() => {
                                        refetchPunches();
                                    }}
                                    onClose={() => {
                                        setIsFormOpen(false);
                                        setEditingRecord(null);
                                        refetchPunches();
                                    }}
                                />
                            </div>
                        ) : activeTab === 'attendance' ? (
                            <div className="space-y-4">
                                <div className="overflow-x-auto rounded-lg border border-border">
                                    <table className="w-full text-xs">
                                        <thead className="bg-muted/50 border-b border-border text-muted-foreground">
                                            <tr>
                                                <th className="px-3.5 py-2.5 text-left font-semibold">Status</th>
                                                <th className="px-3.5 py-2.5 text-left font-semibold">Time</th>
                                                <th className="px-3.5 py-2.5 text-left font-semibold">Location</th>
                                                <th className="px-3.5 py-2.5 text-center font-semibold">Selfie</th>
                                                <th className="px-3.5 py-2.5 text-right font-semibold">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/60">
                                            {punchesLoading ? (
                                                <tr>
                                                    <td colSpan={5} className="py-6 text-center text-muted-foreground">
                                                        Loading punches...
                                                    </td>
                                                </tr>
                                            ) : attendancePunches.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                                                        No attendance records for this date.
                                                    </td>
                                                </tr>
                                            ) : (
                                                attendancePunches.map((item: any, idx: number) => {
                                                    const tp = (item.TP || '').toLowerCase();
                                                    const isPunchIn = tp === 'in';
                                                    const isPunchOut = tp === 'out';
                                                    const isAbsent = tp === 'absent' || item.absent;
                                                    const isLeave = tp === 'leave' || item.leave;
                                                    const isHoliday = tp === 'holiday' || item.holiday;
                                                    const isWeekOff = tp === 'week_off' || item.week_off;

                                                    return (
                                                        <tr key={item.attendance_id || idx} className="hover:bg-muted/30">
                                                            <td className="px-3.5 py-2.5 font-medium">
                                                                {isPunchIn && (
                                                                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[11px]">
                                                                        PUNCH IN
                                                                    </Badge>
                                                                )}
                                                                {isPunchOut && (
                                                                    <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[11px]">
                                                                        PUNCH OUT
                                                                    </Badge>
                                                                )}
                                                                {isAbsent && (
                                                                    <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[11px]">
                                                                        ABSENT
                                                                    </Badge>
                                                                )}
                                                                {isLeave && (
                                                                    <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[11px]">
                                                                        LEAVE
                                                                    </Badge>
                                                                )}
                                                                {isHoliday && (
                                                                    <Badge className="bg-teal-500/10 text-teal-600 border-teal-500/20 text-[11px]">
                                                                        HOLIDAY
                                                                    </Badge>
                                                                )}
                                                                {isWeekOff && (
                                                                    <Badge className="bg-slate-500/10 text-slate-600 border-slate-500/20 text-[11px]">
                                                                        WEEK OFF
                                                                    </Badge>
                                                                )}
                                                            </td>
                                                            <td className="px-3.5 py-2.5 font-mono text-muted-foreground">
                                                                {isHoliday || isWeekOff ? 'All Day' : formatPunchTime(item.timestamp)}
                                                            </td>
                                                            <td className="px-3.5 py-2.5 text-foreground max-w-xs truncate">
                                                                {item.geo_address || (item.geo_lat ? `${item.geo_lat}, ${item.geo_long}` : '—')}
                                                            </td>
                                                            <td className="px-3.5 py-2.5 text-center">
                                                                {item.face_attendance_image ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            setLightboxImage(
                                                                                `${ATTENDANCE_SERVER_URL}/assets/${item.face_attendance_image}`
                                                                            )
                                                                        }
                                                                        className="size-8 rounded-full border border-border overflow-hidden hover:scale-110 transition-transform inline-block"
                                                                    >
                                                                        <img
                                                                            src={`${ATTENDANCE_SERVER_URL}/assets/${item.face_attendance_image}`}
                                                                            alt="Selfie"
                                                                            className="size-full object-cover"
                                                                        />
                                                                    </button>
                                                                ) : (
                                                                    <span className="text-muted-foreground">—</span>
                                                                )}
                                                            </td>
                                                            <td className="px-3.5 py-2.5 text-right">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="size-7"
                                                                    onClick={() => {
                                                                        setEditingRecord(item);
                                                                        setIsFormOpen(true);
                                                                    }}
                                                                >
                                                                    <Pencil className="size-3.5 text-muted-foreground hover:text-foreground" />
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="flex justify-end pt-2">
                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            setEditingRecord(null);
                                            setIsFormOpen(true);
                                        }}
                                        className="gap-1.5 text-xs"
                                    >
                                        <Plus className="size-3.5" />
                                        <span>Mark Attendance</span>
                                    </Button>
                                </div>
                            </div>
                        ) : activeTab === 'odometer' ? (
                            <div className="space-y-4">
                                <div className="overflow-x-auto rounded-lg border border-border">
                                    <table className="w-full text-xs">
                                        <thead className="bg-muted/50 border-b border-border text-muted-foreground">
                                            <tr>
                                                <th className="px-3.5 py-2.5 text-left font-semibold">Time (In / Out)</th>
                                                <th className="px-3.5 py-2.5 text-left font-semibold">Readings</th>
                                                <th className="px-3.5 py-2.5 text-left font-semibold">Distance</th>
                                                <th className="px-3.5 py-2.5 text-left font-semibold">Tour Plan & Note</th>
                                                <th className="px-3.5 py-2.5 text-center font-semibold">Photos</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/60">
                                            {odometerLoading ? (
                                                <tr>
                                                    <td colSpan={5} className="py-6 text-center text-muted-foreground">
                                                        Loading odometer records...
                                                    </td>
                                                </tr>
                                            ) : pairedOdometer.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                                                        No odometer readings recorded for this date.
                                                    </td>
                                                </tr>
                                            ) : (
                                                pairedOdometer.map((pair: any, idx: number) => {
                                                    const inVal = pair.in?.reading ? parseFloat(pair.in.reading) : 0;
                                                    const outVal = pair.out?.reading ? parseFloat(pair.out.reading) : 0;
                                                    const distance = pair.in && pair.out ? (outVal - inVal).toFixed(2) : null;

                                                    return (
                                                        <tr key={idx} className="hover:bg-muted/30">
                                                            <td className="px-3.5 py-2.5">
                                                                <div className="text-emerald-600 font-semibold">
                                                                    IN: {pair.in ? formatPunchTime(pair.in.date_created) : '—'}
                                                                </div>
                                                                <div className="text-rose-600 font-semibold">
                                                                    OUT: {pair.out ? formatPunchTime(pair.out.date_created) : '—'}
                                                                </div>
                                                            </td>
                                                            <td className="px-3.5 py-2.5 font-mono">
                                                                <div>Start: {pair.in?.reading || '—'}</div>
                                                                <div>End: {pair.out?.reading || '—'}</div>
                                                            </td>
                                                            <td className="px-3.5 py-2.5 font-bold text-primary">
                                                                {distance !== null ? `${distance} km` : (
                                                                    <span className="text-amber-500 font-normal">Pending Out</span>
                                                                )}
                                                            </td>
                                                            <td className="px-3.5 py-2.5 max-w-xs">
                                                                <div className="font-semibold text-foreground truncate">
                                                                    {pair.in?.tour_plan || pair.out?.tour_plan || '—'}
                                                                </div>
                                                                <div className="text-muted-foreground text-[11px] truncate">
                                                                    {pair.in?.remarks || pair.out?.remarks || ''}
                                                                </div>
                                                            </td>
                                                            <td className="px-3.5 py-2.5">
                                                                <div className="flex items-center justify-center gap-2">
                                                                    {pair.in?.reading_image && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                setLightboxImage(
                                                                                    `${ATTENDANCE_SERVER_URL}/assets/${pair.in.reading_image}`
                                                                                )
                                                                            }
                                                                            className="size-8 rounded-md border border-emerald-500/40 overflow-hidden hover:scale-105 transition-transform"
                                                                        >
                                                                            <img
                                                                                src={`${ATTENDANCE_SERVER_URL}/assets/${pair.in.reading_image}`}
                                                                                alt="Start Reading"
                                                                                className="size-full object-cover"
                                                                            />
                                                                        </button>
                                                                    )}
                                                                    {pair.out?.reading_image && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                setLightboxImage(
                                                                                    `${ATTENDANCE_SERVER_URL}/assets/${pair.out.reading_image}`
                                                                                )
                                                                            }
                                                                            className="size-8 rounded-md border border-rose-500/40 overflow-hidden hover:scale-105 transition-transform"
                                                                        >
                                                                            <img
                                                                                src={`${ATTENDANCE_SERVER_URL}/assets/${pair.out.reading_image}`}
                                                                                alt="End Reading"
                                                                                className="size-full object-cover"
                                                                            />
                                                                        </button>
                                                                    )}
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
                        ) : (
                            <AttendanceMapView attendance={attendancePunches} />
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <ImageLightbox
                isOpen={!!lightboxImage}
                onClose={() => setLightboxImage(null)}
                imageUrl={lightboxImage || ''}
                title="Proof / Reading Preview"
            />
        </>
    );
}
