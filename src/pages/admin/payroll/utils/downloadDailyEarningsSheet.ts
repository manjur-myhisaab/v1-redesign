// @ts-nocheck
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import axios from 'axios';
import rdk, { ATTENDANCE_SERVER_URL, customEndpoint } from '@/services/server';
import { formatTime } from '@/lib/timeUtils';
import { preprocessAttendanceRecord } from '@/lib/reports/attendance/attendanceAutoPunchHelper';

/**
 * Parses date into components (DD-MM-YYYY, YYYY-MM-DD, month, year)
 */
export const parseDateParts = (selectedDate) => {
    let d, m, y;
    if (typeof selectedDate === 'string' && selectedDate.includes('-')) {
        const parts = selectedDate.split('-');
        if (parts[0].length === 4) {
            // YYYY-MM-DD
            y = parts[0];
            m = parts[1].padStart(2, '0');
            d = parts[2].padStart(2, '0');
        } else if (parts[2].length === 4) {
            // DD-MM-YYYY
            d = parts[0].padStart(2, '0');
            m = parts[1].padStart(2, '0');
            y = parts[2];
        }
    }
    if (!y || !m || !d) {
        const dateObj = selectedDate instanceof Date ? selectedDate : new Date(selectedDate);
        d = String(dateObj.getDate()).padStart(2, '0');
        m = String(dateObj.getMonth() + 1).padStart(2, '0');
        y = String(dateObj.getFullYear());
    }
    return {
        day: d,
        month: m,
        year: y,
        formattedDDMMYYYY: `${d}-${m}-${y}`,
        formattedYYYYMMDD: `${y}-${m}-${d}`,
        displayDate: `${d}/${m}/${y}`,
    };
};

/**
 * 1. Attendance API: /api/fast/staff_attendance_with_time_and_presence_new
 * Fetches attendance entries, punch logs, and employee attendance data for single date
 */
export const fetchDailyAttendanceAPI = async (firmId, dateStr, activeUrl) => {
    let attendanceResponse = null;

    if (!attendanceResponse) {
        try {
            attendanceResponse = await rdk.request(
                customEndpoint({
                    path: `api/fast/staff_attendance_with_time_and_presence_new`,
                    method: "POST",
                    body: JSON.stringify({
                        firm_id: firmId,
                        date: dateStr,
                        limit: 10000,
                        fields: [".*", "shift_id.*"]
                    })
                })
            );
        } catch (err) {
            console.warn("rdk customEndpoint attendance fetch failed:", err);
            if (ATTENDANCE_SERVER_URL) {
                try {
                    const res = await axios.post(`${ATTENDANCE_SERVER_URL}/api/fast/staff_attendance_with_time_and_presence_new`, {
                        firm_id: firmId,
                        date: dateStr,
                        limit: 10000,
                        fields: [".*", "shift_id.*"]
                    });
                    attendanceResponse = res?.data;
                } catch (e) {
                    console.warn("ATTENDANCE_SERVER_URL attendance fetch failed:", e);
                }
            }
        }
    }

    const resData = attendanceResponse?.data || attendanceResponse || {};
    return {
        employees: resData?.employees || [],
        absentees: resData?.absentees || []
    };
};

/**
 * 2. Salary API: api/all_employee_salary/${selectedYear}-${selectedMonth}/${firmId}
 * Fetches monthly salary structure, daywise rates, overtime, and incentive info
 */
export const fetchAllEmployeeSalaryAPI = async (firmId, yearStr, monthStr, activeUrl) => {
    let salaryResponse = null;

    if (activeUrl) {
        try {
            const res = await axios.get(`${activeUrl}/api/all_employee_salary/${yearStr}-${monthStr}/${firmId}`);
            salaryResponse = res?.data;
        } catch (err) {
            console.warn("Active URL salary fetch failed:", err);
        }
    }

    if (!salaryResponse?.results) {
        try {
            salaryResponse = await rdk.request(
                customEndpoint({
                    path: `api/all_employee_salary/${yearStr}-${monthStr}/${firmId}`,
                    method: "GET"
                })
            );
        } catch (err) {
            console.warn("rdk customEndpoint salary fetch failed:", err);
            if (ATTENDANCE_SERVER_URL) {
                try {
                    const res = await axios.get(`${ATTENDANCE_SERVER_URL}/api/all_employee_salary/${yearStr}-${monthStr}/${firmId}`);
                    salaryResponse = res?.data;
                } catch (e) {
                    console.warn("ATTENDANCE_SERVER_URL salary fetch failed:", e);
                }
            }
        }
    }

    return salaryResponse?.results || salaryResponse?.data?.results || [];
};

/**
 * Generates and downloads the Daily Earnings Sheet (Excel) populated with attendance and salary earnings data.
 */
export const downloadDailyEarningsSheet = async (
    arg1 = [],
    arg2 = new Date(),
    arg3 = "My Firm",
    arg4 = null
) => {
    try {
        // Handle options passed as a single config object or positional arguments
        let employees = [];
        let selectedEmployeeIds = [];
        let selectedDate = new Date();
        let firmName = "My Firm";
        let firmId = null;
        let user = null;

        if (arg1 && typeof arg1 === 'object' && !Array.isArray(arg1) && (arg1.selectedDate || arg1.selectedEmployeeIds || arg1.user)) {
            employees = arg1.employees || [];
            selectedEmployeeIds = arg1.selectedEmployeeIds || [];
            selectedDate = arg1.selectedDate || new Date();
            firmName = arg1.firmName || arg1.user?.firm_id?.firm_name || "My Firm";
            firmId = arg1.firmId || arg1.user?.firm_id?.firm_id;
            user = arg1.user || null;
        } else {
            employees = Array.isArray(arg1) ? arg1 : [];
            selectedDate = arg2 || new Date();
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

        const dateParts = parseDateParts(selectedDate);
        const activeUrl = user?.firm_id?.firm_server_url;

        // Fetch attendance and salary data in parallel
        const [attendanceData, salaryResults] = await Promise.all([
            fetchDailyAttendanceAPI(firmId, dateParts.formattedDDMMYYYY, activeUrl),
            fetchAllEmployeeSalaryAPI(firmId, dateParts.year, dateParts.month, activeUrl)
        ]);

        console.log("Daily Attendance Data:", attendanceData);
        console.log("All Employee Salary Data:", salaryResults);

        const { employees: apiEmployees, absentees } = attendanceData;

        // Determine list of employee objects to process
        let listToProcess = [];
        if (employees.length > 0) {
            listToProcess = employees;
        } else if (selectedEmployeeIds.length > 0) {
            const idSet = new Set(selectedEmployeeIds.map(String));
            listToProcess = apiEmployees.filter(e => idSet.has(String(e.id)));
            if (listToProcess.length === 0 && salaryResults.length > 0) {
                listToProcess = salaryResults.map(s => s.employee).filter(e => e && idSet.has(String(e.id)));
            }
        } else if (apiEmployees.length > 0) {
            listToProcess = apiEmployees;
        } else if (salaryResults.length > 0) {
            listToProcess = salaryResults.map(s => s.employee).filter(Boolean);
        }

        if (listToProcess.length === 0) {
            throw new Error("No employee records found to generate daily earnings report.");
        }

        // Create workbook & worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(`Daily Earnings - ${dateParts.formattedDDMMYYYY}`);

        // Column definitions (including Category)
        const columnsDefinition = [
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

        // Subtitle Row 2 - Report Name and Date
        worksheet.mergeCells(`A2:${lastColLetter}2`);
        const subtitleCell = worksheet.getCell('A2');
        subtitleCell.value = `Daily Employee Earnings Report — ${dateParts.displayDate}`;
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

        let grandPerDayEarn = 0;
        let grandOtEarn = 0;
        let grandPresentIncentiveEarn = 0;
        let grandWoEarn = 0;
        let grandHoEarn = 0;
        let grandTotalEarn = 0;

        // Process each employee
        listToProcess.forEach((emp, index) => {
            const empId = String(emp.id || emp.employee?.id);
            
            // Match salary and API employee record
            const salaryItem = salaryResults.find(s => String(s.employee?.id) === empId);
            const apiEmp = apiEmployees.find(e => String(e.id) === empId);
            const empInfo = salaryItem?.employee || apiEmp || emp || {};
            const salary = salaryItem?.salary || {};

            const empName = `${empInfo.first_name || ''} ${empInfo.last_name || ''}`.trim() || empInfo.name || `Employee ${index + 1}`;
            const empCode = empInfo.employee_code || empInfo.employee_no || empInfo.employee_serial_no || '—';
            const empCategory = empInfo.employee_category_id?.employee_category_name || emp.employee_category_id?.employee_category_name || emp.category || '—';
            const empCountry = empInfo.country || 'IN';

            // Find attendance record
            let attnEntry = absentees.find(a => String(a.employee_id) === empId);
            if (attnEntry) {
                preprocessAttendanceRecord(attnEntry);
            }

            const logs = attnEntry?.attendance_data?.entries || [];
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
            let latestOut = null;

            if (outLogs.length > 0 && earliestInTime) {
                latestOut = outLogs.reduce((a, b) =>
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

            // --- Worked Hours calculation (Hidden if made_by === 'system') ---
            let workedHoursStr = '—';
            let workedHoursDecimal = 0;

            if (isOutSystem) {
                workedHoursStr = '—';
            } else if (earliestInTime && latestOutTime) {
                let diffMs = latestOutTime.getTime() - earliestInTime.getTime();
                if (diffMs > 0) {
                    const hrs = Math.floor(diffMs / (1000 * 60 * 60));
                    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
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

            // Check for custom daywise salary on this date
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

            // 1. Per Day Earn (Half Day -> effectiveDayRate / 2)
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

            // 3. Present Incentive Earn (Only from present_incentives)
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

            grandPerDayEarn += perDayEarn;
            grandOtEarn += otEarn;
            grandPresentIncentiveEarn += presentIncentiveEarn;
            grandWoEarn += woEarn;
            grandHoEarn += hoEarn;
            grandTotalEarn += totalEarn;

            // Add Excel Row
            const row = worksheet.addRow({
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
            });

            row.height = 22;

            // Zebra striping
            const isEven = index % 2 === 0;
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

                // Alignment & Number formatting
                // Col 1: Name, Col 2: Code, Col 3: Category, Col 4: Attn Status, Col 5: In, Col 6: Out, Col 7: Worked Hrs
                // Col 8: Per Day Earn, Col 9: OT Hours, Col 10: OT Earn, Col 11: Present Incentive, Col 12: WO Earn, Col 13: HO Earn, Col 14: Total
                if (colNumber === 1) {
                    cell.alignment = { horizontal: 'left', vertical: 'middle' };
                    cell.font = { name: 'Calibri', size: 10, bold: true };
                } else if ([8, 10, 11, 12, 13, 14].includes(colNumber)) {
                    // Currency columns
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                    cell.numFmt = '₹#,##0.00';
                    if (colNumber === 14) {
                        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F766E' } }; // Teal
                    }
                } else {
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                }

                // Attendance Status colors (Col 4)
                if (colNumber === 4) {
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

        // Add Grand Total Summary Row
        const summaryRow = worksheet.addRow({
            emp_name: 'TOTAL',
            emp_code: '',
            emp_category: '',
            attn_status: '',
            punch_in: '',
            punch_out: '',
            worked_hours: '',
            per_day_earn: grandPerDayEarn,
            ot_hours: '',
            ot_earn: grandOtEarn,
            present_incentive_earn: grandPresentIncentiveEarn,
            wo_earn: grandWoEarn,
            ho_earn: grandHoEarn,
            total_earn: grandTotalEarn,
        });

        summaryRow.height = 26;
        summaryRow.eachCell((cell, colNumber) => {
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF1F5F9' } // Slate 100
            };
            cell.border = {
                top: { style: 'medium', color: { argb: 'FF64748B' } },
                bottom: { style: 'double', color: { argb: 'FF0F172A' } },
                left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            };

            if (colNumber === 1) {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            } else if ([8, 10, 11, 12, 13, 14].includes(colNumber)) {
                cell.alignment = { horizontal: 'right', vertical: 'middle' };
                cell.numFmt = '₹#,##0.00';
                if (colNumber === 14) {
                    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF047857' } }; // Emerald bold
                }
            } else {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            }
        });

        // Freeze pane below headers
        worksheet.views = [
            { state: 'frozen', xSplit: 0, ySplit: 4 }
        ];

        // Export Buffer and Save
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const safeFirmName = (firmName || "Firm").replace(/[^a-zA-Z0-9]/g, '_');
        const fileName = `Daily_Earnings_${safeFirmName}_${dateParts.formattedDDMMYYYY}.xlsx`;
        saveAs(blob, fileName);

        return true;
    } catch (error) {
        console.error("Error generating Daily Earnings Sheet:", error);
        throw error;
    }
};
