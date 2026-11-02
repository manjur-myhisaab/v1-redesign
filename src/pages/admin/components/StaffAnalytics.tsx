import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  LogOut,
  CalendarDays,
  Search,
  ChevronRight,
} from 'lucide-react';
import { formatTime } from '@/lib/timeUtils';
import { useNavigate } from 'react-router-dom';

interface StaffAnalyticsProps {
  allStaff: any[];
  statusMap: Map<string, any>;
  totalEmployees: number;
  presenceCount: number;
  absenceCount: number;
  notMarkedCount: number;
  leaveCount: number;
  lateCount: number;
  earlyCount: number;
  selectedDate: Date;
  onDateSelect?: () => void;
  isFetching?: boolean;
}

export function StaffAnalytics({
  allStaff,
  statusMap,
  totalEmployees,
  presenceCount,
  absenceCount,
  notMarkedCount,
  leaveCount,
  lateCount,
  earlyCount,
  selectedDate,
  onDateSelect,
}: StaffAnalyticsProps) {
  const [activeMetric, setActiveMetric] = useState<string | null>(null);
  const [modalSearch, setModalSearch] = useState('');
  const navigate = useNavigate();

  const formattedDate = useMemo(() => {
    const today = new Date();
    if (selectedDate.toDateString() === today.toDateString()) {
      return 'Today';
    }
    return selectedDate.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }, [selectedDate]);

  const cards = [
    {
      key: 'Total',
      label: 'Total Staff',
      count: totalEmployees,
      icon: Users,
      color: 'text-slate-600',
      bgColor: 'bg-slate-50 border-slate-200/80 hover:border-slate-300',
      badgeColor: 'bg-slate-100 text-slate-700',
    },
    {
      key: 'Present',
      label: 'Present',
      count: presenceCount,
      icon: UserCheck,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50/50 border-emerald-200/60 hover:border-emerald-300',
      badgeColor: 'bg-emerald-100/80 text-emerald-800',
    },
    {
      key: 'Absent',
      label: 'Absent',
      count: absenceCount,
      icon: UserX,
      color: 'text-rose-600',
      bgColor: 'bg-rose-50/50 border-rose-200/60 hover:border-rose-300',
      badgeColor: 'bg-rose-100/80 text-rose-800',
    },
    {
      key: 'Not Marked',
      label: 'Not Marked',
      count: notMarkedCount,
      icon: Clock,
      color: 'text-zinc-500',
      bgColor: 'bg-zinc-50/60 border-zinc-200/80 hover:border-zinc-300',
      badgeColor: 'bg-zinc-100 text-zinc-700',
    },
    {
      key: 'Leave',
      label: 'On Leave',
      count: leaveCount,
      icon: CalendarDays,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50/50 border-amber-200/60 hover:border-amber-300',
      badgeColor: 'bg-amber-100/80 text-amber-800',
    },
    {
      key: 'Late',
      label: 'Late Entry',
      count: lateCount,
      icon: Clock,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50/50 border-purple-200/60 hover:border-purple-300',
      badgeColor: 'bg-purple-100/80 text-purple-800',
    },
    {
      key: 'Early',
      label: 'Early Exit',
      count: earlyCount,
      icon: LogOut,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50/50 border-orange-200/60 hover:border-orange-300',
      badgeColor: 'bg-orange-100/80 text-orange-800',
    },
  ];

  const filteredEmployeesByMetric = useMemo(() => {
    if (!activeMetric) return [];
    let list: any[] = [];
    switch (activeMetric) {
      case 'Present':
        list = allStaff.filter(
          (emp) =>
            statusMap.get(emp.id)?.status === 'present' && emp.emp_status !== 'archived'
        );
        break;
      case 'Absent':
        list = allStaff.filter(
          (emp) =>
            statusMap.get(emp.id)?.status === 'absent' && emp.emp_status !== 'archived'
        );
        break;
      case 'Not Marked':
        list = allStaff.filter(
          (emp) =>
            statusMap.get(emp.id)?.status === 'not marked' &&
            emp.emp_status !== 'archived'
        );
        break;
      case 'Leave':
        list = allStaff.filter(
          (emp) =>
            statusMap.get(emp.id)?.status === 'leave' && emp.emp_status !== 'archived'
        );
        break;
      case 'Late':
        list = allStaff.filter(
          (emp) =>
            statusMap.get(emp.id)?.attendance_data?.late &&
            !statusMap.get(emp.id)?.attendance_data?.absent &&
            emp.emp_status !== 'archived'
        );
        break;
      case 'Early':
        list = allStaff.filter(
          (emp) =>
            statusMap.get(emp.id)?.attendance_data?.early_exit &&
            !statusMap.get(emp.id)?.attendance_data?.absent &&
            emp.emp_status !== 'archived'
        );
        break;
      default:
        list = allStaff.filter((emp) => emp.emp_status !== 'archived');
        break;
    }

    if (!modalSearch.trim()) return list;
    const q = modalSearch.toLowerCase().trim();
    return list.filter((emp) => {
      const name = (emp.name || '').toLowerCase();
      const phone = (emp.phone || '').toLowerCase();
      const dept = (emp.department || '').toLowerCase();
      const num = (emp.employee_no || '').toLowerCase();
      return (
        name.includes(q) || phone.includes(q) || dept.includes(q) || num.includes(q)
      );
    });
  }, [activeMetric, allStaff, statusMap, modalSearch]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
          <span>Attendance Overview</span>
          <span className="text-xs font-normal text-muted-foreground">({formattedDate})</span>
        </h3>
        {onDateSelect && (
          <button
            type="button"
            onClick={onDateSelect}
            className="text-xs text-primary hover:underline font-medium cursor-pointer"
          >
            Change Date
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.key}
              onClick={() => {
                setActiveMetric(card.key);
                setModalSearch('');
              }}
              className={`rounded-xl border p-3.5 transition-all duration-150 cursor-pointer shadow-xs hover:shadow-sm ${card.bgColor}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground truncate">
                  {card.label}
                </span>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold tracking-tight text-foreground">
                  {card.count}
                </span>
                <span className="text-[11px] font-medium text-muted-foreground flex items-center">
                  view <ChevronRight className="w-3 h-3 ml-0.5" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal for viewing metric details */}
      <Dialog
        open={Boolean(activeMetric)}
        onOpenChange={(open) => !open && setActiveMetric(null)}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6 overflow-hidden">
          <DialogHeader className="pb-3 border-b">
            <DialogTitle className="text-lg font-semibold flex items-center justify-between">
              <span>{activeMetric} Employees ({filteredEmployeesByMetric.length})</span>
            </DialogTitle>
            <div className="pt-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, phone, department, or ID..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className="pl-9 h-9 text-sm"
                  autoFocus
                />
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto divide-y pr-1">
            {filteredEmployeesByMetric.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No employees matching criteria.
              </p>
            ) : (
              filteredEmployeesByMetric.map((emp) => {
                const attn = statusMap.get(emp.id);
                const inTime = attn?.attendance_data?.in_time;
                const outTime = attn?.attendance_data?.out_time;

                return (
                  <div
                    key={emp.id}
                    onClick={() => {
                      navigate(`/admin/employees/${emp.id}`);
                    }}
                    className="flex items-center justify-between py-3 px-2 hover:bg-muted/40 rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={emp.avatar} alt={emp.name} />
                        <AvatarFallback className="text-xs font-semibold">
                          {(emp.name || 'E').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {emp.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {emp.designation} &bull; {emp.department}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      {inTime && (
                        <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-medium">
                          IN: {formatTime(inTime?.timestamp, emp.country)}
                        </span>
                      )}
                      {outTime && outTime?.made_by !== 'system' && (
                        <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded font-medium">
                          OUT: {formatTime(outTime?.timestamp, emp.country)}
                        </span>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {attn?.status || 'No Data'}
                      </Badge>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

