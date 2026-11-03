// @ts-nocheck
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { formatTime } from '@/lib/timeUtils';
import { preprocessAttendanceRecord } from '@/lib/reports/attendance/attendanceAutoPunchHelper';
import rdk, { readItems } from '@/services/server';
import {
    parseDateParts,
    fetchDailyAttendanceAPI,
    fetchAllEmployeeSalaryAPI
} from './downloadDailyEarningsSheet';

/**
 * Format decimal hours into 'XXh YYm'
 */
const formatHoursMinutes = (decimalHours) => {
    if (!decimalHours || decimalHours <= 0) return '00h 00m';
    const hrs = Math.floor(decimalHours);
    const mins = Math.round((decimalHours - hrs) * 60);
    return `${hrs.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m`;
};

/**
 * Helper to match various date representations against a parsed dateParts object
 */
const matchesDate = (rawDate, dateParts) => {
    if (!rawDate) return false;
    const s = String(rawDate).trim();
    if (s === dateParts.formattedYYYYMMDD || s === dateParts.formattedDDMMYYYY) return true;
    if (s.startsWith(dateParts.formattedYYYYMMDD) || s.startsWith(dateParts.formattedDDMMYYYY)) return true;

    const clean = s.split('T')[0].replace(/\//g, '-');
    const parts = clean.split('-');
    if (parts.length === 3) {
        if (parts[0].length === 4) {
            // YYYY-MM-DD
            return parts[0] === dateParts.year &&
                   String(Number(parts[1])).padStart(2, '0') === dateParts.month &&
                   String(Number(parts[2])).padStart(2, '0') === dateParts.day;
        } else {
            // DD-MM-YYYY
            return String(Number(parts[0])).padStart(2, '0') === dateParts.day &&
                   String(Number(parts[1])).padStart(2, '0') === dateParts.month &&
                   parts[2] === dateParts.year;
        }
    }
    return false;
};

/**
 * Consolidates advance payments from Directus table and salary API result without duplicates
 */
const collectAdvancePayments = (empId, salaryPaymentsMade, directusPayments) => {
    const list = [];
    const seenIds = new Set();

    // 1. Directus employee_salary_payments
    (directusPayments || []).forEach(p => {
        if (String(p.employee_id) === String(empId)) {
            const pId = p.payment_id || p.id;
            if (pId) seenIds.add(String(pId));
            list.push({
                id: pId,
                date: p.employee_salary_payment_date || p.date,
                amount: Number(p.employee_salary_payment_amount || p.amount) || 0,
                remarks: p.remarks || '',
                status: p.status || ''
            });
        }
    });

    // 2. salary.payments_made from API
    (salaryPaymentsMade || []).forEach(p => {
        const pId = p.payment_id || p.id;
        if (pId && seenIds.has(String(pId))) return;
        const amt = Number(p.amount !== undefined ? p.amount : p.value) || 0;
        const dt = p.date || p.employee_salary_payment_date;
        const isDuplicate = list.some(item =>
            Number(item.amount) === amt && item.date && dt && String(item.date).slice(0, 10) === String(dt).slice(0, 10)
        );
        if (!isDuplicate) {
            list.push({
                id: pId,
                date: dt,
                amount: amt,
                remarks: p.remarks || '',
                status: p.status || ''
            });
        }
    });

    return list;
};

/**
 * Generates and downloads the Weekly Payments Sheet (Excel) populated with attendance,
 * salary earnings, and advance payments deductions for up to 7 days.
 * For each employee, outputs up to 7 daily rows, followed by a Weekly Subtotal row, followed by a blank spacer row.
 */
export const downloadWeeklyEarningsSheet = async (
    arg1 = [],
    arg2 = { start: new Date(), end: new Date() },
    arg3 = "My Firm",
    arg4 = null
) => {
    try {
        let employees = [];
        let selectedEmployeeIds = [];
        let weeklyDateRange = { start: new Date(), end: new Date() };
        let firmName = "My Firm";
        let firmId = null;
        let user = null;

        if (arg1 && typeof arg1 === 'object' && !Array.isArray(arg1) && (arg1.weeklyDateRange || arg1.dateRange || arg1.selectedEmployeeIds || arg1.user)) {
            employees = arg1.employees || [];
            selectedEmployeeIds = arg1.selectedEmployeeIds || [];
            weeklyDateRange = arg1.weeklyDateRange || arg1.dateRange || { start: new Date(), end: new Date() };
            firmName = arg1.firmName || arg1.user?.firm_id?.firm_name || "My Firm";
            firmId = arg1.firmId || arg1.user?.firm_id?.firm_id;
            user = arg1.user || null;
        } else {
            employees = Array.isArray(arg1) ? arg1 : [];
            weeklyDateRange = arg2 || { start: new Date(), end: new Date() };
            firmName = typeof arg3 === 'string' ? arg3 : "My Firm";
            user = arg4 || null;
            firmId = user?.firm_id?.firm_id;
            if (employees.length > 0 && typeof employees[0] === 'string') {
                selectedEmployeeIds = employees;
            } else if (employees.length > 0 && employees[0]?.id) {
                selectedEmployeeIds = employees.map(e => String(e.id));
            }
        }

        // Fallback for firmId if still missing
        if (!firmId) {
            try {
                const storedUser = JSON.parse(localStorage.getItem('userData'));
                firmId = storedUser?.firm_id?.firm_id;
                if (!firmName || firmName === "My Firm") {
                    firmName = storedUser?.firm_id?.firm_name || "My Firm";
                }
                if (!user) user = storedUser;
            } catch (e) {
                console.warn("Could not read userData from localStorage:", e);
            }
        }

        if (!firmId) {
            throw new Error("Firm ID is required to fetch attendance and salary data");
        }

        // 1. Process Date Range
        const startDate = new Date(weeklyDateRange.start);
        const endDate = weeklyDateRange.end ? new Date(weeklyDateRange.end) : new Date(startDate);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);

        const diffMs = endDate.getTime() - startDate.getTime();
        const totalDays = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;

        if (totalDays <= 0) {
            throw new Error("Start date must be before or equal to End date");
        }
        if (totalDays > 7) {
            throw new Error("Date range cannot exceed 7 days for weekly payments");
        }

        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dateList = [];
        let curr = new Date(startDate);
        while (curr <= endDate) {
            const dp = parseDateParts(new Date(curr));
            const dayOfWeek = dayNames[curr.getDay()];
            dateList.push({
                ...dp,
                dayOfWeek,
                dateObj: new Date(curr),
                label: `${dp.displayDate} (${dayOfWeek})`
            });
            curr.setDate(curr.getDate() + 1);
        }

        const activeUrl = user?.firm_id?.firm_server_url;

        // 2. Fetch Attendance for all dates in parallel
        const dailyAttendanceMap = new Map();
        const attendancePromises = dateList.map(async (dp) => {
            try {
                const data = await fetchDailyAttendanceAPI(firmId, dp.formattedDDMMYYYY, activeUrl);
                dailyAttendanceMap.set(dp.formattedDDMMYYYY, data || { employees: [], absentees: [] });
            } catch (err) {
                console.warn(`Attendance fetch failed for ${dp.formattedDDMMYYYY}:`, err);
                dailyAttendanceMap.set(dp.formattedDDMMYYYY, { employees: [], absentees: [] });
            }
        });

        // 3. Fetch Salary Data for all unique year-months in parallel
        const distinctYearMonths = [...new Set(dateList.map(dp => `${dp.year}-${dp.month}`))];
        const salaryResultsMap = new Map();
        const salaryPromises = distinctYearMonths.map(async (ym) => {
            const [year, month] = ym.split('-');
            try {
                const results = await fetchAllEmployeeSalaryAPI(firmId, year, month, activeUrl);
                salaryResultsMap.set(ym, Array.isArray(results) ? results : []);
            } catch (err) {
                console.warn(`Salary fetch failed for ${ym}:`, err);
                salaryResultsMap.set(ym, []);
            }
        });

        // 4. Fetch Advance Payments from Directus table for the date range
        const startIso = `${dateList[0].year}-${dateList[0].month}-${dateList[0].day}`;
        const endIso = `${dateList[dateList.length - 1].year}-${dateList[dateList.length - 1].month}-${dateList[dateList.length - 1].day}`;
        let directusAdvancePayments = [];
        const advancePaymentsPromise = (async () => {
            try {
                const advResponse = await rdk.request(
                    readItems("employee_salary_payments", {
                        filter: {
                            employee_salary_payment_date: { _between: [startIso, endIso] }
                        },
                        fields: ['*'],
                        limit: -1
                    })
                );
                directusAdvancePayments = Array.isArray(advResponse) ? advResponse : (advResponse?.data || []);
            } catch (e) {
                console.warn("Directus fetch employee_salary_payments failed:", e);
            }
        })();

        await Promise.all([...attendancePromises, ...salaryPromises, advancePaymentsPromise]);

        // 5. Determine list of employees to process
        let listToProcess = [];
        if (employees.length > 0) {
            listToProcess = employees;
        } else if (selectedEmployeeIds.length > 0) {
            const idSet = new Set(selectedEmployeeIds.map(String));
            for (const dp of dateList) {
                const attData = dailyAttendanceMap.get(dp.formattedDDMMYYYY);
                if (attData?.employees) {
                    const matches = attData.employees.filter(e => idSet.has(String(e.id)));
                    matches.forEach(m => {
                        if (!listToProcess.some(x => String(x.id) === String(m.id))) {
                            listToProcess.push(m);
                        }
                    });
                }
            }
            if (listToProcess.length === 0) {
                for (const ym of distinctYearMonths) {
                    const salaries = salaryResultsMap.get(ym) || [];
                    salaries.forEach(s => {
                        if (s.employee && idSet.has(String(s.employee.id))) {
                            if (!listToProcess.some(x => String(x.id) === String(s.employee.id))) {
                                listToProcess.push(s.employee);
                            }
                        }
                    });
                }
            }
        }

        if (listToProcess.length === 0) {
            throw new Error("No employee records found to generate weekly payments report.");
        }

        // 6. Initialize ExcelJS Workbook & Worksheet
        const workbook = new ExcelJS.Workbook();
        const displayStart = dateList[0].displayDate;
        const displayEnd = dateList[dateList.length - 1].displayDate;
        const worksheet = workbook.addWorksheet(`Weekly Earnings (${dateList[0].day}-${dateList[dateList.length - 1].day})`);

        // Column Definitions (Includes Advance and Net Total)
        const columnsDefinition = [
            { header: 'Date', key: 'date', width: 18 },
            { header: 'Employee Name', key: 'emp_name', width: 26 },
            { header: 'Employee Code', key: 'emp_code', width: 16 },
            { header: 'Category', key: 'emp_category', width: 18 },
            { header: 'Attn Status', key: 'attn_status', width: 16 },
            { header: 'Punch IN', key: 'punch_in', width: 14 },
            { header: 'Punch OUT', key: 'punch_out', width: 14 },
            { header: 'Worked Hours', key: 'worked_hours', width: 16 },
            { header: 'Per Day Earn (₹)', key: 'per_day_earn', width: 18 },
            { header: 'OT Hours', key: 'ot_hours', width: 14 },
            { header: 'OT Earn (₹)', key: 'ot_earn', width: 16 },
            { header: 'Present Incentive Earn (₹)', key: 'present_incentive_earn', width: 26 },
            { header: 'WO Earn (₹)', key: 'wo_earn', width: 16 },
            { header: 'HO Earn (₹)', key: 'ho_earn', width: 16 },
            { header: 'Total (₹)', key: 'total_earn', width: 18 },
            { header: 'Advance (₹)', key: 'advance_deduct', width: 16 },
            { header: 'Net Total (₹)', key: 'net_total', width: 18 },
        ];

        worksheet.columns = columnsDefinition;
        const totalColumns = columnsDefinition.length;
        const lastColLetter = worksheet.getColumn(totalColumns).letter;

        // Title Row 1 - Firm Name
        worksheet.mergeCells(`A1:${lastColLetter}1`);
        const titleCell = worksheet.getCell('A1');
        titleCell.value = firmName || "Company Name";
        titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1E293B' } // Slate 800
        };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.getRow(1).height = 30;

        // Subtitle Row 2 - Report Name and Date Range
        worksheet.mergeCells(`A2:${lastColLetter}2`);
        const subtitleCell = worksheet.getCell('A2');
        subtitleCell.value = `Weekly Employee Payments Report — ${displayStart} to ${displayEnd} (${totalDays} Days)`;
        subtitleCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        subtitleCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF334155' } // Slate 700
        };
        subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.getRow(2).height = 24;

        // Blank Spacer Row 3
        worksheet.addRow([]);
        worksheet.getRow(3).height = 8;

        // Header Row 4
        const headerRow = worksheet.getRow(4);
        headerRow.values = columnsDefinition.map(col => col.header);
        headerRow.height = 28;

        headerRow.eachCell((cell) => {
            cell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FF0F172A' } };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE2E8F0' } // Slate 200
            };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FF94A3B8' } },
                bottom: { style: 'medium', color: { argb: 'FF64748B' } },
                left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            };
        });

        // Grand Accumulators
        let grandWorkedHoursDecimal = 0;
        let grandPerDayEarn = 0;
        let grandOtHoursNum = 0;
        let grandOtEarn = 0;
        let grandPresentIncentiveEarn = 0;
        let grandWoEarn = 0;
        let grandHoEarn = 0;
        let grandTotalEarn = 0;
        let grandAdvanceEarn = 0;
        let grandNetTotal = 0;

        // Process each employee
        listToProcess.forEach((emp, empIdx) => {
            const empId = String(emp.id || emp.employee?.id);
            const empName = `${emp.first_name || emp.employee?.first_name || ''} ${emp.last_name || emp.employee?.last_name || ''}`.trim() || emp.name || `Employee ${empIdx + 1}`;
            const empCode = emp.employee_code || emp.employee?.employee_code || emp.employee_no || emp.employee_serial_no || '—';
            const empCategory = emp.employee_category_id?.employee_category_name || emp.employee?.employee_category_id?.employee_category_name || emp.category || '—';
            const empCountry = emp.country || emp.employee?.country || 'IN';

            // Collect all salary items for this employee across fetched months to find payments_made
            const empSalaryPaymentsMade = [];
            distinctYearMonths.forEach(ymKey => {
                const sResults = salaryResultsMap.get(ymKey) || [];
                const sItem = sResults.find(s => String(s.employee?.id) === empId);
                if (Array.isArray(sItem?.salary?.payments_made)) {
                    empSalaryPaymentsMade.push(...sItem.salary.payments_made);
                }
            });

            // Consolidate all advance payments for this employee
            const empAdvances = collectAdvancePayments(empId, empSalaryPaymentsMade, directusAdvancePayments);
            const matchedAdvances = new Set();

            // Employee-level accumulators for weekly subtotal
            let empWorkedHoursDecimal = 0;
            let empPerDayEarn = 0;
            let empOtHoursNum = 0;
            let empOtEarn = 0;
            let empPresentIncentiveEarn = 0;
            let empWoEarn = 0;
            let empHoEarn = 0;
            let empTotalEarn = 0;
            let empAdvanceEarn = 0;
            let empNetTotal = 0;
            const empStatusCounts = { Present: 0, 'Half Day': 0, 'Week Off': 0, Holiday: 0, Leave: 0, Absent: 0 };

            // Process each date in the range (up to 7 days)
            dateList.forEach((dateParts, dayIdx) => {
                const ymKey = `${dateParts.year}-${dateParts.month}`;
                const salaryResults = salaryResultsMap.get(ymKey) || [];
                const salaryItem = salaryResults.find(s => String(s.employee?.id) === empId);
                const empInfo = salaryItem?.employee || emp || {};
                const salary = salaryItem?.salary || {};

                // Get attendance record for this date
                const attData = dailyAttendanceMap.get(dateParts.formattedDDMMYYYY) || { employees: [], absentees: [] };
                let attnEntry = attData.absentees.find(a => String(a.employee_id) === empId);
                if (!attnEntry && attData.employees) {
                    attnEntry = attData.employees.find(e => String(e.id || e.employee_id) === empId);
                }
                if (attnEntry) {
                    preprocessAttendanceRecord(attnEntry);
                }

                const logs = attnEntry?.attendance_data?.entries || attnEntry?.entries || [];
                const inLogs = logs.filter(l => l.TP?.toLowerCase() === 'in');
                const outLogs = logs.filter(l => l.TP?.toLowerCase() === 'out');

                // --- Punch IN calculation ---
                let earliestInTime = null;
                let punchInStr = '—';
                if (inLogs.length > 0) {
                    const earliestIn = inLogs.reduce((a, b) =>
                        new Date(a.timestamp).getTime() < new Date(b.timestamp).getTime() ? a : b
                    );
                    earliestInTime = new Date(earliestIn.timestamp);
                    punchInStr = formatTime(earliestInTime, empCountry);
                } else if (attnEntry?.attendance_data?.in_time || attnEntry?.in_time) {
                    const inVal = attnEntry?.attendance_data?.in_time || attnEntry?.in_time;
                    earliestInTime = new Date(inVal);
                    punchInStr = formatTime(earliestInTime, empCountry);
                }

                // --- Punch OUT calculation (System-made checker) ---
                let latestOutTime = null;
                let punchOutStr = '—';
                let isOutSystem = false;

                if (outLogs.length > 0 && earliestInTime) {
                    const latestOut = outLogs.reduce((a, b) =>
                        new Date(a.timestamp).getTime() > new Date(b.timestamp).getTime() ? a : b
                    );
                    latestOutTime = new Date(latestOut.timestamp);
                    if (latestOutTime.getTime() < earliestInTime.getTime()) {
                        latestOutTime.setDate(latestOutTime.getDate() + 1);
                    }
                    isOutSystem = latestOut?.made_by === 'system';
                    punchOutStr = isOutSystem ? '—' : formatTime(latestOutTime, empCountry);
                } else if (attnEntry?.attendance_data?.out_time || attnEntry?.out_time) {
                    const outObj = attnEntry?.attendance_data?.out_time || attnEntry?.out_time;
                    if (outObj?.made_by === 'system' || attnEntry?.attendance_data?.made_by === 'system') {
                        isOutSystem = true;
                        punchOutStr = '—';
                    } else {
                        const outTimestamp = typeof outObj === 'string' ? outObj : outObj.timestamp;
                        latestOutTime = new Date(outTimestamp);
                        punchOutStr = formatTime(latestOutTime, empCountry);
                    }
                }

                // --- Worked Hours calculation ---
                let workedHoursStr = '—';
                let workedHoursDecimal = 0;

                if (isOutSystem) {
                    workedHoursStr = '—';
                } else if (earliestInTime && latestOutTime) {
                    const diffMsec = latestOutTime.getTime() - earliestInTime.getTime();
                    if (diffMsec > 0) {
                        const hrs = Math.floor(diffMsec / (1000 * 60 * 60));
                        const mins = Math.floor((diffMsec % (1000 * 60 * 60)) / (1000 * 60));
                        workedHoursStr = `${hrs.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m`;
                        workedHoursDecimal = hrs + (mins / 60);
                    }
                } else if (salary?.hourly_rates) {
                    const hrKey = dateParts.formattedDDMMYYYY;
                    const altKey = dateParts.formattedYYYYMMDD;
                    const hoursVal = salary.hourly_rates[hrKey] !== undefined ? salary.hourly_rates[hrKey] : salary.hourly_rates[altKey];
                    if (hoursVal !== undefined && Number(hoursVal) > 0) {
                        const numH = Number(hoursVal);
                        workedHoursDecimal = numH;
                        const hrs = Math.floor(numH);
                        const mins = Math.round((numH - hrs) * 60);
                        workedHoursStr = `${hrs.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m`;
                    }
                }

                // --- Attn Status calculation ---
                let attnStatus = 'Absent';
                const rawStatus = (attnEntry?.status || attnEntry?.attendance_data?.status || attnEntry?.attendance_status || '').toLowerCase().trim();
                const rawEntries = [
                    ...(Array.isArray(attnEntry?.entries) ? attnEntry.entries : []),
                    ...(Array.isArray(attnEntry?.attendance_data?.entries) ? attnEntry.attendance_data.entries : [])
                ];
                const hasHalfDayInEntries = rawEntries.some(e =>
                    (e.TP || e.type || e.status || '').toLowerCase().includes('half') ||
                    e.half_day === true ||
                    e.calculated_half_day === true
                );

                const isHalfDayEntry = Boolean(
                    attnEntry?.half_day ||
                    attnEntry?.calculated_half_day ||
                    attnEntry?.is_half_day ||
                    attnEntry?.is_halfday ||
                    attnEntry?.attendance_data?.half_day ||
                    attnEntry?.attendance_data?.calculated_half_day ||
                    attnEntry?.attendance_data?.is_half_day ||
                    attnEntry?.attendance_data?.is_halfday ||
                    hasHalfDayInEntries ||
                    rawStatus === 'half_day' ||
                    rawStatus === 'half day' ||
                    rawStatus === 'halfday' ||
                    rawStatus === 'p(hf)' ||
                    rawStatus === 'hfd' ||
                    rawStatus.includes('half')
                );

                if (isHalfDayEntry) {
                    attnStatus = 'Half Day';
                } else if (rawStatus === 'present' || inLogs.length > 0 || earliestInTime) {
                    attnStatus = 'Present';
                } else if (rawStatus === 'week_off' || rawStatus.includes('week_off') || rawStatus === 'wo' || rawStatus === 'p(wo)') {
                    attnStatus = 'Week Off';
                } else if (rawStatus === 'holiday' || rawStatus.includes('holiday') || rawStatus === 'ho' || rawStatus === 'p(ho)') {
                    attnStatus = 'Holiday';
                } else if (rawStatus === 'leave' || rawStatus.includes('leave') || rawStatus === 'l') {
                    attnStatus = 'Leave';
                } else if (rawStatus === 'absent' || rawStatus === 'a') {
                    attnStatus = 'Absent';
                } else {
                    attnStatus = 'Absent';
                }

                empStatusCounts[attnStatus] = (empStatusCounts[attnStatus] || 0) + 1;

                // --- Earnings Calculations ---
                const payType = (salary.pay_type || empInfo.pay_type || 'Monthly').toLowerCase();
                const dailySalaryRate = Number(
                    salary.daily_salary ||
                    (salary.basic_salary && salary.total_days ? salary.basic_salary / salary.total_days : 0) ||
                    empInfo.salary_per_month ||
                    0
                );
                const hourlySalaryRate = Number(salary.hourly_salary || 0);
                const otHourlyRate = Number(salary.total_ot?.hourly_rate || empInfo.overtime_hourly_rate || 0);

                // Custom daywise salary check
                let customDaySalary = null;
                if (Array.isArray(salary.custom_daywise_salary_list)) {
                    const customMatch = salary.custom_daywise_salary_list.find(c =>
                        c.date === dateParts.formattedDDMMYYYY ||
                        c.date === dateParts.formattedYYYYMMDD ||
                        c.date_string === dateParts.formattedDDMMYYYY ||
                        c.date_string === dateParts.formattedYYYYMMDD
                    );
                    if (customMatch && customMatch.amount !== undefined) {
                        customDaySalary = Number(customMatch.amount);
                    }
                }

                const effectiveDayRate = customDaySalary !== null ? customDaySalary : dailySalaryRate;

                // 1. Per Day Earn
                let perDayEarn = 0;
                if (payType === 'hourly') {
                    let hrsForDay = workedHoursDecimal;
                    if (salary.hourly_rates) {
                        const hrKey = dateParts.formattedDDMMYYYY;
                        const altKey = dateParts.formattedYYYYMMDD;
                        if (salary.hourly_rates[hrKey] !== undefined) hrsForDay = Number(salary.hourly_rates[hrKey]);
                        else if (salary.hourly_rates[altKey] !== undefined) hrsForDay = Number(salary.hourly_rates[altKey]);
                    }
                    if (attnStatus === 'Half Day') {
                        perDayEarn = effectiveDayRate > 0 ? (effectiveDayRate / 2) : (hrsForDay * hourlySalaryRate) / 2;
                    } else if (attnStatus === 'Present') {
                        perDayEarn = hrsForDay * hourlySalaryRate;
                    } else {
                        perDayEarn = 0;
                    }
                } else {
                    if (attnStatus === 'Present') {
                        perDayEarn = effectiveDayRate;
                    } else if (attnStatus === 'Half Day') {
                        perDayEarn = effectiveDayRate / 2;
                    } else {
                        perDayEarn = 0;
                    }
                }

                // 2. OT Hours & OT Earn
                let otHoursNum = 0;
                if (salary.over_time_data) {
                    const otKey = dateParts.formattedDDMMYYYY;
                    const altOtKey = dateParts.formattedYYYYMMDD;
                    if (salary.over_time_data[otKey] !== undefined) {
                        otHoursNum = Number(salary.over_time_data[otKey]);
                    } else if (salary.over_time_data[altOtKey] !== undefined) {
                        otHoursNum = Number(salary.over_time_data[altOtKey]);
                    }
                }
                let otHoursStr = '00h 00m';
                if (otHoursNum > 0) {
                    const otH = Math.floor(otHoursNum);
                    const otM = Math.round((otHoursNum - otH) * 60);
                    otHoursStr = `${otH.toString().padStart(2, '0')}h ${otM.toString().padStart(2, '0')}m`;
                } else {
                    otHoursStr = attnStatus === 'Absent' ? '—' : '00h 00m';
                }
                const otEarn = otHoursNum * otHourlyRate;

                // 3. Present Incentive Earn
                let presentIncentiveEarn = 0;
                if (Array.isArray(salary.present_incentives)) {
                    const matchingPIs = salary.present_incentives.filter(pi =>
                        pi.date === dateParts.formattedDDMMYYYY ||
                        pi.date === dateParts.formattedYYYYMMDD ||
                        pi.date_string === dateParts.formattedDDMMYYYY
                    );
                    presentIncentiveEarn = matchingPIs.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
                }

                // 4. WO Earn (Week Off)
                let woEarn = 0;
                if (attnStatus === 'Week Off') {
                    const isWeekOffPayment = empInfo.week_off_payment || user?.firm_id?.week_off_payment;
                    if (isWeekOffPayment || (salary.total_week_off_earnings && salary.total_week_off_earnings > 0)) {
                        woEarn = effectiveDayRate;
                    }
                }

                // 5. HO Earn (Holiday)
                let hoEarn = 0;
                if (attnStatus === 'Holiday') {
                    hoEarn = effectiveDayRate;
                }

                // Total Earn for the day
                const totalEarn = perDayEarn + otEarn + presentIncentiveEarn + woEarn + hoEarn;

                // 6. Advance Payments received on this specific day
                const advancesOnThisDay = empAdvances.filter(p => matchesDate(p.date, dateParts));
                const dayAdvance = advancesOnThisDay.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
                advancesOnThisDay.forEach(p => matchedAdvances.add(p));

                // 7. Net Total after deducting Advance
                const netDayTotal = totalEarn - dayAdvance;

                // Employee accumulators
                empWorkedHoursDecimal += workedHoursDecimal;
                empPerDayEarn += perDayEarn;
                empOtHoursNum += otHoursNum;
                empOtEarn += otEarn;
                empPresentIncentiveEarn += presentIncentiveEarn;
                empWoEarn += woEarn;
                empHoEarn += hoEarn;
                empTotalEarn += totalEarn;
                empAdvanceEarn += dayAdvance;
                empNetTotal += netDayTotal;

                // Grand accumulators
                grandWorkedHoursDecimal += workedHoursDecimal;
                grandPerDayEarn += perDayEarn;
                grandOtHoursNum += otHoursNum;
                grandOtEarn += otEarn;
                grandPresentIncentiveEarn += presentIncentiveEarn;
                grandWoEarn += woEarn;
                grandHoEarn += hoEarn;
                grandTotalEarn += totalEarn;
                grandAdvanceEarn += dayAdvance;
                grandNetTotal += netDayTotal;

                // Add Excel Row for this day
                const row = worksheet.addRow({
                    date: dateParts.label,
                    emp_name: empName,
                    emp_code: empCode,
                    emp_category: empCategory,
                    attn_status: attnStatus,
                    punch_in: punchInStr,
                    punch_out: punchOutStr,
                    worked_hours: workedHoursStr,
                    per_day_earn: perDayEarn,
                    ot_hours: otHoursStr,
                    ot_earn: otEarn,
                    present_incentive_earn: presentIncentiveEarn,
                    wo_earn: woEarn,
                    ho_earn: hoEarn,
                    total_earn: totalEarn,
                    advance_deduct: dayAdvance,
                    net_total: netDayTotal,
                });

                row.height = 20;

                // Styling daily row
                const isEven = dayIdx % 2 === 0;
                const bgArgb = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

                row.eachCell((cell, colNumber) => {
                    cell.font = { name: 'Calibri', size: 10 };
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: bgArgb }
                    };
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    };

                    if (colNumber === 1) {
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF475569' } };
                    } else if (colNumber === 2) {
                        cell.alignment = { horizontal: 'left', vertical: 'middle' };
                        cell.font = { name: 'Calibri', size: 10, bold: true };
                    } else if ([9, 11, 12, 13, 14, 15, 16, 17].includes(colNumber)) {
                        cell.alignment = { horizontal: 'right', vertical: 'middle' };
                        cell.numFmt = '₹#,##0.00';
                        if (colNumber === 15) {
                            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F766E' } }; // Teal
                        } else if (colNumber === 16 && cell.value > 0) {
                            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFDC2626' } }; // Red
                        } else if (colNumber === 17) {
                            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF047857' } }; // Emerald
                        }
                    } else {
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    }

                    // Attendance Status styling (Col 5)
                    if (colNumber === 5) {
                        if (attnStatus === 'Present') {
                            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF166534' } }; // Green
                        } else if (attnStatus === 'Half Day') {
                            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFCA8A04' } }; // Amber
                        } else if (attnStatus === 'Absent') {
                            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFDC2626' } }; // Red
                        } else if (attnStatus === 'Week Off' || attnStatus === 'Holiday') {
                            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } }; // Slate
                        } else if (attnStatus === 'Leave') {
                            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF7C3AED' } }; // Violet
                        }
                    }
                });
            });

            // Account for any advance payment that was not matched to a specific day in this week
            const unmatchedAdvances = empAdvances.filter(p => !matchedAdvances.has(p));
            const unmatchedAmount = unmatchedAdvances.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
            if (unmatchedAmount > 0) {
                empAdvanceEarn += unmatchedAmount;
                empNetTotal -= unmatchedAmount;
                grandAdvanceEarn += unmatchedAmount;
                grandNetTotal -= unmatchedAmount;
            }

            // Weekly Subtotal Row for this employee
            const subtotalRow = worksheet.addRow({
                date: 'Weekly Total',
                emp_name: `${empName}`,
                emp_code: empCode,
                emp_category: empCategory,
                attn_status: `${empStatusCounts.Present || 0}P ${empStatusCounts['Half Day'] || 0}HD ${empStatusCounts['Week Off'] || 0}WO ${empStatusCounts.Absent || 0}A`,
                punch_in: '—',
                punch_out: '—',
                worked_hours: formatHoursMinutes(empWorkedHoursDecimal),
                per_day_earn: empPerDayEarn,
                ot_hours: formatHoursMinutes(empOtHoursNum),
                ot_earn: empOtEarn,
                present_incentive_earn: empPresentIncentiveEarn,
                wo_earn: empWoEarn,
                ho_earn: empHoEarn,
                total_earn: empTotalEarn,
                advance_deduct: empAdvanceEarn,
                net_total: empNetTotal,
            });

            subtotalRow.height = 24;
            subtotalRow.eachCell((cell, colNumber) => {
                cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E293B' } };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF1F5F9' } // Slate 100
                };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FF94A3B8' } },
                    bottom: { style: 'medium', color: { argb: 'FF64748B' } },
                    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                };

                if (colNumber === 1) {
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF2563EB' } }; // Blue
                } else if (colNumber === 2) {
                    cell.alignment = { horizontal: 'left', vertical: 'middle' };
                } else if ([9, 11, 12, 13, 14, 15, 16, 17].includes(colNumber)) {
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                    cell.numFmt = '₹#,##0.00';
                    if (colNumber === 15) {
                        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0D9488' } }; // Teal bold
                    } else if (colNumber === 16 && cell.value > 0) {
                        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFDC2626' } }; // Red bold
                    } else if (colNumber === 17) {
                        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF047857' } }; // Emerald bold
                    }
                } else {
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                }
            });

            // Blank Spacer Row between employees (as requested)
            const blankRow = worksheet.addRow([]);
            blankRow.height = 14;
        });

        // Add Grand Total Summary Row
        const summaryRow = worksheet.addRow({
            date: '',
            emp_name: 'GRAND TOTAL',
            emp_code: '',
            emp_category: '',
            attn_status: '',
            punch_in: '',
            punch_out: '',
            worked_hours: formatHoursMinutes(grandWorkedHoursDecimal),
            per_day_earn: grandPerDayEarn,
            ot_hours: formatHoursMinutes(grandOtHoursNum),
            ot_earn: grandOtEarn,
            present_incentive_earn: grandPresentIncentiveEarn,
            wo_earn: grandWoEarn,
            ho_earn: grandHoEarn,
            total_earn: grandTotalEarn,
            advance_deduct: grandAdvanceEarn,
            net_total: grandNetTotal,
        });

        summaryRow.height = 28;
        summaryRow.eachCell((cell, colNumber) => {
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE2E8F0' } // Slate 200
            };
            cell.border = {
                top: { style: 'medium', color: { argb: 'FF64748B' } },
                bottom: { style: 'double', color: { argb: 'FF0F172A' } },
                left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            };

            if (colNumber === 2) {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            } else if ([9, 11, 12, 13, 14, 15, 16, 17].includes(colNumber)) {
                cell.alignment = { horizontal: 'right', vertical: 'middle' };
                cell.numFmt = '₹#,##0.00';
                if (colNumber === 15) {
                    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0D9488' } };
                } else if (colNumber === 16 && cell.value > 0) {
                    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFDC2626' } };
                } else if (colNumber === 17) {
                    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF047857' } }; // Emerald bold
                }
            } else {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            }
        });

        // Freeze pane below headers (Row 4)
        worksheet.views = [
            { state: 'frozen', xSplit: 0, ySplit: 4 }
        ];

        // Export Buffer and Save
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const safeFirmName = (firmName || "Firm").replace(/[^a-zA-Z0-9]/g, '_');
        const fileName = `Weekly_Payments_${safeFirmName}_${dateList[0].formattedDDMMYYYY}_to_${dateList[dateList.length - 1].formattedDDMMYYYY}.xlsx`;
        saveAs(blob, fileName);

        return true;
    } catch (error) {
        console.error("Error generating Weekly Payments Sheet:", error);
        throw error;
    }
};
