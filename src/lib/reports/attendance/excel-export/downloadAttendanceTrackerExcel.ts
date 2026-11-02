// @ts-nocheck
import ExcelJS from "exceljs";
import rdk, { ATTENDANCE_SERVER_URL, customEndpoint } from "@/services/server";
import axios from "axios";
import { convertTo24hr } from "@/lib/timeUtils";
import { preprocessAttendanceList } from "../attendanceAutoPunchHelper";

// Column definitions for easier maintenance
const COLUMNS = {
    EMP_CODE: { start: 'A', end: 'C' },
    NAME: { start: 'D', end: 'K' },
    PRESENT: { start: 'L', end: 'M' },
    HOLIDAY: { start: 'N', end: 'O' },
    WEEKOFF: { start: 'P', end: 'Q' },
    HALFDAY: { start: 'R', end: 'S' },
    ABSENT: { start: 'T', end: 'U' },
    LEAVE: { start: 'V', end: 'W' },
    PAIDDAY: { start: 'X', end: 'Y' },
    WORKHRS: { start: 'Z', end: 'AA' },
    SHORTHRS: { start: 'AB', end: 'AC' },
    OVERTIME: { start: 'AD', end: 'AF' },
    FULL_WIDTH: { start: 'A', end: 'AF' }
};

// Normalize date to YYYY-MM-DD format
const normalizeDate = (rawDate) => {
    if (!rawDate) return null;

    // Already YYYY-MM-DD format
    if (rawDate.includes("-") && rawDate.split("-")[0].length === 4) {
        const [y, m, d] = rawDate.split("-");
        return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }

    // DD-MM-YYYY format
    if (rawDate.includes("-") && rawDate.split("-")[2].length === 4) {
        const [d, m, y] = rawDate.split("-");
        return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }

    return rawDate;
};

// Summary Calculation Logic
const getAttendanceSummary = (attendanceData) => {

    const summary = {
        Present: 0,
        Absent: 0,
        HalfDay: 0,
        PaidLeave: 0,
        Holiday: 0,
        WeekOff: 0,
        Late: 0,
        EarlyExit: 0,
    };

    // Create a map to ensure we count each date only once
    const processedDates = new Map();

    attendanceData?.forEach(entry => {
        const dateKey = normalizeDate(entry.date);
        if (!dateKey || processedDates.has(dateKey)) return;

        processedDates.set(dateKey, true);

        // Priority-based status counting (highest priority first)
        // Week off takes precedence
        // Present (has in_time)
        if (entry.in_time !== null) {

            // Count half day separately (can overlap with Present)
            if (entry.half_day === true || entry.calculated_half_day === true) {
                summary.HalfDay += 1;
            }

            // Count lateness/early exit
            if (entry.late === true) summary.Late += 1;
            if (entry.early_exit === true) summary.EarlyExit += 1;
            if (entry.week_off === true) {
                summary.WeekOff += 1;
            }
            // Holiday (but not week off)
            if (entry.holiday === true) {
                summary.Holiday += 1;
            }

            summary.Present += 1;
        }

        else if (entry.week_off === true) {
            summary.WeekOff += 1;
        }
        // Holiday (but not week off)
        else if (entry.holiday === true) {
            summary.Holiday += 1;
        }

        // Leave
        else if (entry.leave === true) {
            summary.PaidLeave += 1;
        }
        // Absent
        else if (entry.absent === true) {
            summary.Absent += 1;
        }

    });

    return summary;
};

// Sum duration strings in HH:MM format
const sumDurations = (times) => {
    let totalMins = 0;
    times.forEach((t) => {
        if (!t || typeof t !== "string" || !t.includes(":")) return;
        const [h, m] = t.split(":").map(Number);
        if (!isNaN(h) && !isNaN(m)) {
            totalMins += h * 60 + m;
        }
    });
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
};

// Convert 12-hour time to 24-hour format
const convertTo24Hrs = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') {
        return "00:00";
    }

    const parts = timeStr.trim().split(' ');
    if (parts.length < 2) return "00:00";

    const [time, modifier] = parts;
    const timeParts = time.split(':');
    if (timeParts.length < 2) return "00:00";

    let [hours, minutes] = timeParts;

    if (modifier.toUpperCase() === 'PM') {
        hours = hours === '12' ? '12' : String(parseInt(hours, 10) + 12);
    } else {
        hours = hours === '12' ? '00' : hours.padStart(2, '0');
    }

    return `${hours.padStart(2, '0')}:${minutes}`;
};

// Calculate shift duration in minutes
const calculateShiftHours = (shiftFrom, shiftTo) => {
    if (!shiftFrom || !shiftTo) return 0;

    const baseDate = "1970-01-01";
    const start = new Date(`${baseDate}T${shiftFrom}`);
    const end = new Date(`${baseDate}T${shiftTo}`);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;

    let diffMs = end - start;

    // Handle overnight shift
    if (diffMs < 0) {
        diffMs += 24 * 60 * 60 * 1000;
    }

    return Math.floor(diffMs / 1000 / 60);
};

// Format minutes to HH:MM
const formatDuration = (mins) => {
    if (!mins || mins <= 0) return "00:00";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

// Determine status with clear priority
const getStatus = (attn) => {
    if (!attn) return "-";

    // Present-based statuses (has checked in)
    if (attn.in_time !== null) {
        if (attn.half_day === true || attn.calculated_half_day === true) {
            return "P(HF)";
        }
        if (attn.holiday === true && attn.week_off === true) {
            return "P(HO)";
        }
        if (attn.holiday === true) {
            return "P(HO)";
        }
        if (attn.week_off === true) {
            return "P(WO)";
        }
        return "P";
    }

    // Not present - check reason
    if (attn.leave === true) return "L";
    if (attn.absent === true) return "A";
    if (attn.holiday === true) return "HO";
    if (attn.week_off === true) return "WO";

    return "-";
};

// Create attendance map indexed by date
const createAttendanceMap = (attendances) => {
    const map = new Map();
    attendances?.forEach(attn => {
        const dateKey = normalizeDate(attn.date);
        if (dateKey) {
            map.set(dateKey, attn);
        }
    });
    return map;
};

// Apply cell styling
const applyCellStyle = (cell, style = {}) => {
    const defaultStyle = {
        font: { size: 8 },
        alignment: { vertical: "middle", horizontal: "center" },
        border: {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
        }
    };

    Object.assign(cell, { ...defaultStyle, ...style });
};

// Merge cells helper
const mergeCells = (worksheet, rowNum, colDef, value, style = {}) => {
    const range = `${colDef.start}${rowNum}:${colDef.end}${rowNum}`;
    worksheet.mergeCells(range);
    const cell = worksheet.getCell(`${colDef.start}${rowNum}`);
    cell.value = value;
    applyCellStyle(cell, style);
};

export const downloadAttendanceTracker = async (
    user,
    year,
    month,
    employeeList,
    firm_id,
    firmName,
    branch,
    department,
    selectedEmployeeIds,
) => {
    let ACTIVE_URL = user?.firm_id?.firm_server_url;
    const numYear = Number(year);
    const numMonth = Number(month);
    const formattedMonth = String(numMonth).padStart(2, "0");

    try {
        // Fetch attendance data
        let allEmployeeAttendanceData;
        if (ACTIVE_URL) {
            try {
                const res = await axios.get(`${ACTIVE_URL}/api/all_employee_attendance/${numYear}-${formattedMonth}/${firm_id}`);
                allEmployeeAttendanceData = res?.data;
            } catch (err) {
                console.warn("ACTIVE_URL fetch failed:", err);
            }
        }
        if (!allEmployeeAttendanceData?.results) {
            try {
                allEmployeeAttendanceData = await rdk.request(customEndpoint({
                    path: `api/all_employee_attendance/${numYear}-${formattedMonth}/${firm_id}`,
                    method: "GET",
                }));
            } catch (err) {
                console.warn("rdk customEndpoint fetch failed:", err);
                if (ATTENDANCE_SERVER_URL) {
                    const res = await axios.get(`${ATTENDANCE_SERVER_URL}/api/all_employee_attendance/${numYear}-${formattedMonth}/${firm_id}`);
                    allEmployeeAttendanceData = res?.data;
                }
            }
        }

        const results = allEmployeeAttendanceData?.results || allEmployeeAttendanceData?.data?.results || [];
        if (!results || results.length === 0) {
            throw new Error("Invalid or empty attendance data received");
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Attendance Tracker");

        const daysInMonth = new Date(numYear, numMonth, 0).getDate();

        // === HEADER SECTION ===
        const thinBorder = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
        };

        // Row 1-3: Report Date (merged)
        worksheet.mergeCells("A1:AF3");
        worksheet.getCell("A1").value = `Report Date From : 01-${month}-${year} To : ${daysInMonth}-${month}-${year}`;
        worksheet.getCell("A1").font = { bold: true, size: 9 };
        worksheet.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };
        worksheet.getCell("A1").border = thinBorder;

        // Row 4: Company Name
        worksheet.mergeCells("A4:AF4");
        worksheet.getCell("A4").value = `Company Name : ${firmName}`;
        worksheet.getCell("A4").font = { bold: true, size: 10, color: { argb: "0000FF" } };
        worksheet.getCell("A4").alignment = { vertical: "middle", horizontal: "center" };
        worksheet.getCell("A4").border = thinBorder;

        // Row 5: Branch
        worksheet.mergeCells("A5:AF5");
        worksheet.getCell("A5").value = `Branch : ${branch}`;
        worksheet.getCell("A5").font = { bold: true, size: 10, color: { argb: "0000FF" } };
        worksheet.getCell("A5").alignment = { vertical: "middle", horizontal: "center" };
        worksheet.getCell("A5").border = thinBorder;

        worksheet.addRow([]); // Row 6: spacer

        // === EMPLOYEE SECTION BUILDER ===
        const addEmployeeSection = (emp, attendanceMap) => {
            const summary = getAttendanceSummary(Array.from(attendanceMap.values()));

            // Collections for monthly totals
            let workingDurations = [];
            let overtimeDurations = [];
            let shortfallDurations = [];

            // Department + Designation row
            const currentRowNumber = worksheet.lastRow.number + 1;
            const deptName = emp?.employee_category_id?.employee_category_name || "N/A";
            const desigName = emp?.title || "N/A";
            const empCountry = emp?.country || "IN";

            mergeCells(worksheet, currentRowNumber,
                { start: 'A', end: 'O' },
                `Department : ${deptName}`,
                { font: { bold: true, size: 10 }, alignment: { vertical: "middle", horizontal: "center" } }
            );

            mergeCells(worksheet, currentRowNumber,
                { start: 'P', end: 'AF' },
                `Desig : ${desigName}`,
                { font: { bold: true, size: 10 }, alignment: { vertical: "middle", horizontal: "center" } }
            );

            // Summary Header Row
            const headerRowNum = worksheet.lastRow.number + 1;

            mergeCells(worksheet, headerRowNum, COLUMNS.EMP_CODE, "EmpCode");
            mergeCells(worksheet, headerRowNum, COLUMNS.NAME, "Name");

            const summaryBlocks = [
                { col: COLUMNS.PRESENT, label: "Present", color: "FF00B050", textColor: "000000" },
                { col: COLUMNS.HOLIDAY, label: "Holiday", color: "FFBFBFBF", textColor: "000000" },
                { col: COLUMNS.WEEKOFF, label: "WeekOff", color: "FFC0C0C0", textColor: "000000" },
                { col: COLUMNS.HALFDAY, label: "Halfday", color: "92D050", textColor: "000000" },
                { col: COLUMNS.ABSENT, label: "Absent", color: "FFFF0000", textColor: "000000" },
                { col: COLUMNS.LEAVE, label: "Leave", color: "FFFFC000", textColor: "000000" },
                { col: COLUMNS.PAIDDAY, label: "PaidDay", color: "808080", textColor: "000000" },
                { col: COLUMNS.WORKHRS, label: "WorkHrs", color: "ED7D31", textColor: "000000" },
                { col: COLUMNS.SHORTHRS, label: "ShortHrs", color: "4472C4", textColor: "000000" },
                { col: COLUMNS.OVERTIME, label: "OverTimeHrs", color: "A5A5A5", textColor: "000000" },
            ];

            summaryBlocks.forEach(block => {
                mergeCells(worksheet, headerRowNum, block.col, block.label, {
                    font: { bold: true, size: 8, color: { argb: block.textColor } },
                    fill: { type: "pattern", pattern: "solid", fgColor: { argb: block.color } }
                });
            });

            // Employee Data Row
            const dataRowNum = headerRowNum + 1;
            const dataStyle = {
                font: { size: 10 },
                alignment: { vertical: "middle", horizontal: "center" }
            };

            mergeCells(worksheet, dataRowNum, COLUMNS.EMP_CODE, emp.employee_code, dataStyle);
            mergeCells(worksheet, dataRowNum, COLUMNS.NAME, `${emp.first_name} ${emp.last_name}`, dataStyle);
            mergeCells(worksheet, dataRowNum, COLUMNS.PRESENT, summary.Present - summary.HalfDay, dataStyle);
            mergeCells(worksheet, dataRowNum, COLUMNS.HOLIDAY, summary.Holiday, dataStyle);
            mergeCells(worksheet, dataRowNum, COLUMNS.WEEKOFF, summary.WeekOff, dataStyle);
            mergeCells(worksheet, dataRowNum, COLUMNS.HALFDAY, summary.HalfDay, dataStyle);
            mergeCells(worksheet, dataRowNum, COLUMNS.ABSENT, summary.Absent, dataStyle);
            mergeCells(worksheet, dataRowNum, COLUMNS.LEAVE, summary.PaidLeave, dataStyle);
            mergeCells(worksheet, dataRowNum, COLUMNS.PAIDDAY, summary.Present - (summary.HalfDay / 2), dataStyle);

            // Day Header Row
            const dayHeaderRow = ["Label", ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
            const row = worksheet.addRow(dayHeaderRow);
            row.eachCell((cell) => {
                applyCellStyle(cell, {
                    font: { bold: true, size: 8 },
                    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "D9D9D9" } }
                });
            });

            // Sub-rows with daily data
            const subRows = ["IN Time", "OUT Time", "Shift From", "Shift To", "Working", "O.Times", "Short hrs.", "Status"];

            subRows.forEach((label) => {
                const rowValues = [label, ...Array.from({ length: daysInMonth }, (_, i) => {
                    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
                    const attn = attendanceMap.get(dateStr);

                    if (!attn) return "";

                    const isOutTimeSystem = attn?.out_time?.made_by === "system";

                    // Calculate durations
                    const workMins = isOutTimeSystem ? 0 : (attn?.total_work_duration || 0);
                    // const shiftMins = attn?.in_time?.shift_id
                    //     ? calculateShiftHours(
                    //         attn.in_time.shift_id.shift_from,
                    //         attn.in_time.shift_id.shift_to
                    //     )
                    //     : 0;

                    const ApplicableDurationForOt = emp?.overtime_hours * 60 + emp?.overtime_minutes;

                    let workingDuration = workMins > 0 ? formatDuration(workMins) : "-";
                    let otDuration = "-";
                    let shortDuration = "-";

                    if (workMins > 0 && ApplicableDurationForOt > 0) {
                        const diff = workMins - ApplicableDurationForOt;
                        if (diff > 0) {
                            otDuration = formatDuration(diff);
                        } else if (diff < 0) {
                            shortDuration = formatDuration(Math.abs(diff));
                        }
                    }

                    // Collect for monthly totals
                    if (label === "Working" && workingDuration !== "-") {
                        workingDurations.push(workingDuration);
                    }
                    if (label === "O.Times" && emp?.applicable_for_overtime && otDuration !== "-") {
                        overtimeDurations.push(otDuration);
                    }
                    if (label === "Short hrs." && shortDuration !== "-") {
                        shortfallDurations.push(shortDuration);
                    }

                    // Return appropriate value
                    switch (label) {
                        case "IN Time": return convertTo24hr(attn?.in_formatted_time, empCountry) || "-";
                        case "OUT Time":
                            return isOutTimeSystem
                                ? "-"
                                : convertTo24hr(attn?.out_formatted_time, empCountry) || "-";
                        case "Shift From": return attn?.in_time?.shift_id?.shift_from?.slice(0, 5) || "-";
                        case "Shift To": return attn?.in_time?.shift_id?.shift_to?.slice(0, 5) || "-";
                        case "Working": return isOutTimeSystem ? "-" : (attn?.total_work_duration ? formatDuration(attn?.total_work_duration) : "-");
                        case "O.Times": return emp?.applicable_for_overtime ? otDuration : "-";
                        case "Short hrs.": return shortDuration;
                        case "Status": return getStatus(attn);
                        default: return "";
                    }
                })];

                const row = worksheet.addRow(rowValues);

                row.eachCell((cell, colNumber) => {
                    applyCellStyle(cell, {
                        font: { size: 8 },
                        alignment: {
                            vertical: "middle",
                            horizontal: colNumber === 1 ? "left" : "center"
                        }
                    });

                    if (colNumber > 1) {
                        const value = cell.value;

                        // Color coding
                        if (label === "IN Time" && value && value !== "-") {
                            cell.font = { size: 8, color: { argb: "FF00B050" } };
                        }
                        if (label === "OUT Time" && value && value !== "-") {
                            cell.font = { size: 8, color: { argb: "FFFF0000" } };
                        }
                        if (label === "Status") {
                            const statusColors = {
                                "A": "FFFF0000",
                                "L": "FFFFC000",
                                "HO": "FFBFBFBF",
                                "WO": "FFBFBFBF",
                                "P": "FF00B050",
                                "P(HF)": "92D050",
                                "P(HO)": "FFBFBFBF",
                                "P(WO)": "FFBFBFBF"
                            };
                            if (statusColors[value]) {
                                cell.fill = {
                                    type: "pattern",
                                    pattern: "solid",
                                    fgColor: { argb: statusColors[value] }
                                };
                            }
                        }
                    }
                });
            });

            // Populate Monthly Totals
            mergeCells(worksheet, dataRowNum, COLUMNS.WORKHRS, sumDurations(workingDurations), dataStyle);
            mergeCells(worksheet, dataRowNum, COLUMNS.SHORTHRS, sumDurations(shortfallDurations), dataStyle);
            mergeCells(worksheet, dataRowNum, COLUMNS.OVERTIME,
                emp?.applicable_for_overtime ? sumDurations(overtimeDurations) : "00:00",
                dataStyle
            );

            worksheet.addRow([]);
        };

        // Normalizing employee list
        let employeeListArray = Array.isArray(employeeList)
            ? [...employeeList]
            : (Array.isArray(employeeList?.employees) ? [...employeeList.employees] : []);

        if (employeeListArray.length === 0 && results.length > 0) {
            employeeListArray = results.map(r => r.employee).filter(Boolean);
        }

        if (selectedEmployeeIds?.length > 0) {
            employeeListArray = employeeListArray.filter(emp => selectedEmployeeIds.includes(emp.id));
        }

        if (employeeListArray.length === 0) {
            throw new Error("No employee matched the selection");
        }

        // Process each employee
        for (const emp of employeeListArray) {
            const empDeptName = emp?.employee_category_id?.employee_category_name;

            // Filter by department if specified
            if (department && department !== "All" && empDeptName !== department) {
                continue;
            }

            const empData = results.find(
                (singleEmp) => singleEmp.employee?.id === emp.id
            );

            if (!empData) {
                console.warn(`No attendance data found for employee: ${emp.employee_code}`);
                continue;
            }

            const attendanceMap = createAttendanceMap(preprocessAttendanceList(empData.attendances));
            addEmployeeSection(emp, attendanceMap);
        }

        // Set column widths
        worksheet.columns.forEach((col, i) => {
            col.width = i === 0 ? 8.8 : 5.7;
        });

        // Freeze top rows
        worksheet.views = [{ state: 'frozen', ySplit: 5 }];

        // Generate and download file
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Attendance_${formattedMonth}_${numYear}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
        return url;

    } catch (error) {
        console.error("Error generating attendance tracker:", error);
        throw new Error(`Failed to generate attendance report: ${error.message}`);
    }
};

// Helper: Get all months in a date range (YYYY-MM)
const getMonthsInRange = (startDate, endDate) => {
    const months = [];
    let currentDate = new Date(startDate);
    currentDate.setDate(1);

    while (
        currentDate <= endDate ||
        (currentDate.getMonth() === endDate.getMonth() && currentDate.getFullYear() === endDate.getFullYear())
    ) {
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, "0");
        months.push(`${year}-${month}`);
        currentDate.setMonth(currentDate.getMonth() + 1);
    }
    return months;
};

// Helper: Standardize attendance entry date directly in YYYY-MM-DD
const getStandardizedDate = (att, year, month, index) => {
    if (att?.date) {
        const rawDate = att.date;
        if (rawDate.includes("-") || rawDate.includes("/")) {
            const parts = rawDate.split(/[-/]/);
            if (parts.length === 3) {
                if (parts[0].length === 4) {
                    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                } else if (parts[2].length === 4) {
                    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
            }
        }
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        }
    }
    const day = String(index + 1).padStart(2, '0');
    return `${year}-${String(month).padStart(2, '0')}-${day}`;
};

// Date Range Excel Export for Attendance Tracker (Max 31 days)
export const downloadAttendanceTrackerWithDateRange = async (
    user,
    startDate,
    endDate,
    employeeList,
    firm_id,
    firmName,
    branch,
    department,
    selectedEmployeeIds
) => {
    let sDate = startDate;
    let eDate = endDate;
    if (startDate && typeof startDate === "object" && startDate.start && !endDate) {
        sDate = startDate.start;
        eDate = startDate.end;
    }

    if (!sDate || !eDate) {
        alert("Please select both start and end date.");
        return null;
    }

    const start = new Date(sDate);
    const end = new Date(eDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const diffTime = end.getTime() - start.getTime();
    const totalDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;

    if (totalDays <= 0) {
        alert("Invalid date range selected. Start date must be before or equal to End date.");
        return null;
    }

    if (totalDays > 31) {
        alert("Please select a date range of up to 31 days only.");
        return null;
    }

    const dateList = [];
    let curr = new Date(start);
    while (curr <= end) {
        const y = curr.getFullYear();
        const m = String(curr.getMonth() + 1).padStart(2, "0");
        const d = String(curr.getDate()).padStart(2, "0");
        dateList.push(`${y}-${m}-${d}`);
        curr.setDate(curr.getDate() + 1);
    }

    const displayStart = `${String(start.getDate()).padStart(2, "0")}-${String(start.getMonth() + 1).padStart(2, "0")}-${start.getFullYear()}`;
    const displayEnd = `${String(end.getDate()).padStart(2, "0")}-${String(end.getMonth() + 1).padStart(2, "0")}-${end.getFullYear()}`;

    let ACTIVE_URL = user?.firm_id?.firm_server_url;
    const monthsToFetch = getMonthsInRange(start, end);

    try {
        const fetchPromises = monthsToFetch.map(async (yearMonth) => {
            let data = null;
            if (ACTIVE_URL) {
                try {
                    const res = await axios.get(`${ACTIVE_URL}/api/all_employee_attendance/${yearMonth}/${firm_id}`);
                    data = res?.data;
                } catch (err) {
                    console.warn(`ACTIVE_URL fetch failed for ${yearMonth}:`, err);
                }
            }
            if (!data?.results) {
                try {
                    data = await rdk.request(customEndpoint({
                        path: `api/all_employee_attendance/${yearMonth}/${firm_id}`,
                        method: "GET",
                    }));
                } catch (err) {
                    console.warn(`rdk customEndpoint fetch failed for ${yearMonth}:`, err);
                    if (ATTENDANCE_SERVER_URL) {
                        const res = await axios.get(`${ATTENDANCE_SERVER_URL}/api/all_employee_attendance/${yearMonth}/${firm_id}`);
                        data = res?.data;
                    }
                }
            }
            return {
                yearMonth,
                results: data?.results || data?.data?.results || []
            };
        });

        const monthResponses = await Promise.all(fetchPromises);

        const mergedEmployeeData = new Map();
        for (const { yearMonth, results: monthResults } of monthResponses) {
            const [fetchedYear, fetchedMonth] = yearMonth.split('-').map(Number);
            for (const item of monthResults) {
                if (!item.employee) continue;
                if (selectedEmployeeIds?.length > 0 && !selectedEmployeeIds.includes(item.employee.id)) continue;

                if (!mergedEmployeeData.has(item.employee.id)) {
                    mergedEmployeeData.set(item.employee.id, {
                        employee: item.employee,
                        attendances: []
                    });
                }

                const empRecord = mergedEmployeeData.get(item.employee.id);
                (item.attendances || []).forEach((att, index) => {
                    const calculatedDate = getStandardizedDate(att, fetchedYear, fetchedMonth, index);
                    att.date = calculatedDate;
                    empRecord.attendances.push(att);
                });
            }
        }

        const results = Array.from(mergedEmployeeData.values());
        if (results.length === 0) {
            alert("No attendance data found for the selected employees in this date range.");
            return null;
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Attendance Tracker");

        const thinBorder = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
        };

        // Row 1-3: Report Date Range (merged A1:AF3)
        worksheet.mergeCells("A1:AF3");
        worksheet.getCell("A1").value = `Report Date From : ${displayStart} To : ${displayEnd}`;
        worksheet.getCell("A1").font = { bold: true, size: 9 };
        worksheet.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };
        worksheet.getCell("A1").border = thinBorder;

        // Row 4: Company Name
        worksheet.mergeCells("A4:AF4");
        worksheet.getCell("A4").value = `Company Name : ${firmName || user?.firm_id?.firm_name || "Company"}`;
        worksheet.getCell("A4").font = { bold: true, size: 10, color: { argb: "0000FF" } };
        worksheet.getCell("A4").alignment = { vertical: "middle", horizontal: "center" };
        worksheet.getCell("A4").border = thinBorder;

        // Row 5: Branch
        worksheet.mergeCells("A5:AF5");
        worksheet.getCell("A5").value = `Branch : ${branch || "N/A"}`;
        worksheet.getCell("A5").font = { bold: true, size: 10, color: { argb: "0000FF" } };
        worksheet.getCell("A5").alignment = { vertical: "middle", horizontal: "center" };
        worksheet.getCell("A5").border = thinBorder;

        worksheet.addRow([]); // Row 6: spacer

        const addEmployeeSectionRange = (emp, attendanceMap) => {
            const rangeEntries = dateList.map(d => attendanceMap.get(d)).filter(Boolean);
            const summary = getAttendanceSummary(rangeEntries);

            let workingDurations = [];
            let overtimeDurations = [];
            let shortfallDurations = [];

            const currentRowNumber = worksheet.lastRow.number + 1;
            const deptName = emp?.employee_category_id?.employee_category_name || "N/A";
            const desigName = emp?.title || "N/A";
            const empCountry = emp?.country || "IN";

            mergeCells(worksheet, currentRowNumber,
                { start: 'A', end: 'O' },
                `Department : ${deptName}`,
                { font: { bold: true, size: 10 }, alignment: { vertical: "middle", horizontal: "center" } }
            );

            mergeCells(worksheet, currentRowNumber,
                { start: 'P', end: 'AF' },
                `Desig : ${desigName}`,
                { font: { bold: true, size: 10 }, alignment: { vertical: "middle", horizontal: "center" } }
            );

            const headerRowNum = worksheet.lastRow.number + 1;

            mergeCells(worksheet, headerRowNum, COLUMNS.EMP_CODE, "EmpCode");
            mergeCells(worksheet, headerRowNum, COLUMNS.NAME, "Name");

            const summaryBlocks = [
                { col: COLUMNS.PRESENT, label: "Present", color: "FF00B050", textColor: "000000" },
                { col: COLUMNS.HOLIDAY, label: "Holiday", color: "FFBFBFBF", textColor: "000000" },
                { col: COLUMNS.WEEKOFF, label: "WeekOff", color: "FFC0C0C0", textColor: "000000" },
                { col: COLUMNS.HALFDAY, label: "Halfday", color: "92D050", textColor: "000000" },
                { col: COLUMNS.ABSENT, label: "Absent", color: "FFFF0000", textColor: "000000" },
                { col: COLUMNS.LEAVE, label: "Leave", color: "FFFFC000", textColor: "000000" },
                { col: COLUMNS.PAIDDAY, label: "PaidDay", color: "808080", textColor: "000000" },
                { col: COLUMNS.WORKHRS, label: "WorkHrs", color: "ED7D31", textColor: "000000" },
                { col: COLUMNS.SHORTHRS, label: "ShortHrs", color: "4472C4", textColor: "000000" },
                { col: COLUMNS.OVERTIME, label: "OverTimeHrs", color: "A5A5A5", textColor: "000000" },
            ];

            summaryBlocks.forEach(block => {
                mergeCells(worksheet, headerRowNum, block.col, block.label, {
                    font: { bold: true, size: 8, color: { argb: block.textColor } },
                    fill: { type: "pattern", pattern: "solid", fgColor: { argb: block.color } }
                });
            });

            const dataRowNum = headerRowNum + 1;
            const dataStyle = {
                font: { size: 10 },
                alignment: { vertical: "middle", horizontal: "center" }
            };

            mergeCells(worksheet, dataRowNum, COLUMNS.EMP_CODE, emp.employee_code || "-", dataStyle);
            mergeCells(worksheet, dataRowNum, COLUMNS.NAME, `${emp.first_name || ""} ${emp.last_name || ""}`.trim() || "-", dataStyle);
            mergeCells(worksheet, dataRowNum, COLUMNS.PRESENT, summary.Present - summary.HalfDay, dataStyle);
            mergeCells(worksheet, dataRowNum, COLUMNS.HOLIDAY, summary.Holiday, dataStyle);
            mergeCells(worksheet, dataRowNum, COLUMNS.WEEKOFF, summary.WeekOff, dataStyle);
            mergeCells(worksheet, dataRowNum, COLUMNS.HALFDAY, summary.HalfDay, dataStyle);
            mergeCells(worksheet, dataRowNum, COLUMNS.ABSENT, summary.Absent, dataStyle);
            mergeCells(worksheet, dataRowNum, COLUMNS.LEAVE, summary.PaidLeave, dataStyle);
            mergeCells(worksheet, dataRowNum, COLUMNS.PAIDDAY, summary.Present - (summary.HalfDay / 2), dataStyle);

            const isSingleMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
            const dayHeaders = ["Label", ...dateList.map(dStr => {
                const parts = dStr.split("-");
                return isSingleMonth ? Number(parts[2]).toString() : `${Number(parts[2])}/${Number(parts[1])}`;
            })];

            const row = worksheet.addRow(dayHeaders);
            row.eachCell((cell) => {
                applyCellStyle(cell, {
                    font: { bold: true, size: 8 },
                    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "D9D9D9" } }
                });
            });

            const subRows = ["IN Time", "OUT Time", "Shift From", "Shift To", "Working", "O.Times", "Short hrs.", "Status"];

            subRows.forEach((label) => {
                const rowValues = [label, ...dateList.map((dateStr) => {
                    const attn = attendanceMap.get(dateStr);
                    if (!attn) return "";

                    const isOutTimeSystem = attn?.out_time?.made_by === "system";
                    const workMins = isOutTimeSystem ? 0 : (attn?.total_work_duration || 0);
                    const ApplicableDurationForOt = (emp?.overtime_hours || 0) * 60 + (emp?.overtime_minutes || 0);

                    let workingDuration = workMins > 0 ? formatDuration(workMins) : "-";
                    let otDuration = "-";
                    let shortDuration = "-";

                    if (workMins > 0 && ApplicableDurationForOt > 0) {
                        const diff = workMins - ApplicableDurationForOt;
                        if (diff > 0) {
                            otDuration = formatDuration(diff);
                        } else if (diff < 0) {
                            shortDuration = formatDuration(Math.abs(diff));
                        }
                    }

                    if (label === "Working" && workingDuration !== "-") {
                        workingDurations.push(workingDuration);
                    }
                    if (label === "O.Times" && emp?.applicable_for_overtime && otDuration !== "-") {
                        overtimeDurations.push(otDuration);
                    }
                    if (label === "Short hrs." && shortDuration !== "-") {
                        shortfallDurations.push(shortDuration);
                    }

                    switch (label) {
                        case "IN Time": return convertTo24hr(attn?.in_formatted_time, empCountry) || "-";
                        case "OUT Time":
                            return isOutTimeSystem
                                ? "-"
                                : convertTo24hr(attn?.out_formatted_time, empCountry) || "-";
                        case "Shift From": return attn?.in_time?.shift_id?.shift_from?.slice(0, 5) || "-";
                        case "Shift To": return attn?.in_time?.shift_id?.shift_to?.slice(0, 5) || "-";
                        case "Working": return isOutTimeSystem ? "-" : (attn?.total_work_duration ? formatDuration(attn?.total_work_duration) : "-");
                        case "O.Times": return emp?.applicable_for_overtime ? otDuration : "-";
                        case "Short hrs.": return shortDuration;
                        case "Status": return getStatus(attn);
                        default: return "";
                    }
                })];

                const subRow = worksheet.addRow(rowValues);
                subRow.eachCell((cell, colNumber) => {
                    applyCellStyle(cell, {
                        font: { size: 8 },
                        alignment: {
                            vertical: "middle",
                            horizontal: colNumber === 1 ? "left" : "center"
                        }
                    });

                    if (colNumber > 1) {
                        const value = cell.value;
                        if (label === "IN Time" && value && value !== "-") {
                            cell.font = { size: 8, color: { argb: "FF00B050" } };
                        }
                        if (label === "OUT Time" && value && value !== "-") {
                            cell.font = { size: 8, color: { argb: "FFFF0000" } };
                        }
                        if (label === "Status") {
                            const statusColors = {
                                "A": "FFFF0000",
                                "L": "FFFFC000",
                                "HO": "FFBFBFBF",
                                "WO": "FFBFBFBF",
                                "P": "FF00B050",
                                "P(HF)": "92D050",
                                "P(HO)": "FFBFBFBF",
                                "P(WO)": "FFBFBFBF"
                            };
                            if (statusColors[value]) {
                                cell.fill = {
                                    type: "pattern",
                                    pattern: "solid",
                                    fgColor: { argb: statusColors[value] }
                                };
                            }
                        }
                    }
                });
            });

            mergeCells(worksheet, dataRowNum, COLUMNS.WORKHRS, sumDurations(workingDurations), dataStyle);
            mergeCells(worksheet, dataRowNum, COLUMNS.SHORTHRS, sumDurations(shortfallDurations), dataStyle);
            mergeCells(worksheet, dataRowNum, COLUMNS.OVERTIME,
                emp?.applicable_for_overtime ? sumDurations(overtimeDurations) : "00:00",
                dataStyle
            );

            worksheet.addRow([]);
        };

        let employeeListArray = Array.isArray(employeeList)
            ? [...employeeList]
            : (Array.isArray(employeeList?.employees) ? [...employeeList.employees] : []);

        if (employeeListArray.length === 0 && results.length > 0) {
            employeeListArray = results.map(r => r.employee).filter(Boolean);
        }

        if (selectedEmployeeIds?.length > 0) {
            employeeListArray = employeeListArray.filter(emp => selectedEmployeeIds.includes(emp.id));
        }

        if (employeeListArray.length === 0) {
            alert("No employee matched the selection");
            return null;
        }

        for (const emp of employeeListArray) {
            const empDeptName = emp?.employee_category_id?.employee_category_name;
            if (department && department !== "All" && empDeptName !== department) {
                continue;
            }

            const empData = results.find(
                (singleEmp) => singleEmp.employee?.id === emp.id
            );

            if (!empData) {
                console.warn(`No attendance data found for employee: ${emp.employee_code}`);
                continue;
            }

            preprocessAttendanceList(empData.attendances);
            const attendanceMap = createAttendanceMap(empData.attendances);
            addEmployeeSectionRange(emp, attendanceMap);
        }

        worksheet.columns.forEach((col, i) => {
            col.width = i === 0 ? 8.8 : 5.7;
        });

        worksheet.views = [{ state: 'frozen', ySplit: 5 }];

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Attendance_Tracker_${displayStart}_to_${displayEnd}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
        return url;

    } catch (error) {
        console.error("Error generating attendance tracker with date range:", error);
        throw new Error(`Failed to generate attendance report: ${error.message}`);
    }
};

export const downloadAttendanceTrackerByDateRange = downloadAttendanceTrackerWithDateRange;