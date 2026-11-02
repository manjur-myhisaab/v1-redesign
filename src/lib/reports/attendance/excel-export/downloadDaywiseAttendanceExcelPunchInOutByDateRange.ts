// @ts-nocheck
import ExcelJS from "exceljs";
import { formatTime } from "@/lib/timeUtils";
import axios from "axios";
import { ATTENDANCE_SERVER_URL } from "@/services/server";

// ==========================================
// HELPER FUNCTIONS
// ==========================================

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

const getStandardizedDate = (att, year, month, index) => {
    if (att.date) {
        const parts = att.date.split(/[-/]/);
        if (parts.length === 3) {
            if (parts[0].length === 4) {
                return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            } else if (parts[2].length === 4) {
                return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
        }

        const d = new Date(att.date);
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

// ==========================================
// MAIN EXPORT FUNCTION
// ==========================================

export const downloadDaywiseAttendanceExcelPunchInOutByDateRange = async (
    firmDetails,
    dateRange,
    selectedEmployeeIds
) => {
    if (!selectedEmployeeIds || selectedEmployeeIds.length === 0) {
        alert("Please select at least one employee");
        return null;
    }

    try {
        const { start, end } = dateRange;
        const startDate = new Date(start);
        const endDate = new Date(end);

        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);

        const monthsToFetch = getMonthsInRange(startDate, endDate);

        const apiCalls = monthsToFetch.map((yearMonth) =>
            axios.get(`${ATTENDANCE_SERVER_URL}/api/all_employee_attendance/${yearMonth}/${firmDetails.firm_id}`)
        );
        const responses = await Promise.all(apiCalls);

        const mergedEmployeeData = new Map();

        for (let i = 0; i < responses.length; i++) {
            const yearMonth = monthsToFetch[i];
            const [fetchedYear, fetchedMonth] = yearMonth.split('-').map(Number);
            const results = responses[i].data?.results || responses[i].data || [];

            for (const item of results) {
                if (!selectedEmployeeIds.includes(item.employee?.id)) continue;

                if (!mergedEmployeeData.has(item.employee.id)) {
                    mergedEmployeeData.set(item.employee.id, {
                        employee: item.employee,
                        attendances: [],
                    });
                }

                (item.attendances || []).forEach((att, index) => {
                    att.calculatedDate = getStandardizedDate(att, fetchedYear, fetchedMonth, index);
                    mergedEmployeeData.get(item.employee.id).attendances.push(att);
                });
            }
        }

        const filteredEmployeeAttendanceData = [];
        mergedEmployeeData.forEach((val) => {
            const filteredAttendances = val.attendances.filter((att) => {
                if (!att.calculatedDate) return false;
                const recordDate = new Date(`${att.calculatedDate}T00:00:00`);
                return recordDate >= startDate && recordDate <= endDate;
            });

            filteredAttendances.sort((a, b) => new Date(a.calculatedDate).getTime() - new Date(b.calculatedDate).getTime());

            filteredEmployeeAttendanceData.push({
                employee: val.employee,
                attendances: filteredAttendances,
            });
        });

        if (!filteredEmployeeAttendanceData || filteredEmployeeAttendanceData.length === 0) {
            alert("No attendance data found for the selected employees in this date range.");
            return null;
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Date Range Attendance");

        const totalColumns = 12;
        const lastColLetter = worksheet.getColumn(totalColumns).letter;

        worksheet.mergeCells(`A1:${lastColLetter}1`);
        const firmCell = worksheet.getCell("A1");
        firmCell.value = firmDetails.firm_name;
        firmCell.font = { bold: true, size: 16 };
        firmCell.alignment = { horizontal: "center", vertical: "middle" };

        const displayStartDate = startDate.toLocaleDateString("en-GB");
        const displayEndDate = endDate.toLocaleDateString("en-GB");

        worksheet.mergeCells(`A2:${lastColLetter}2`);
        const dateCell = worksheet.getCell("A2");
        dateCell.value = `Attendance Report: ${displayStartDate} to ${displayEndDate}`;
        dateCell.font = { italic: true, size: 12 };
        dateCell.alignment = { horizontal: "center", vertical: "middle" };

        worksheet.addRow([]);

        const headerRow = worksheet.addRow([
            "EMPLOYEE ID", "NAME", "DESIGNATION", "CATEGORY", "DEPARTMENT", "DATE", "STATUS",
            "IN TIME", "IN LOCATION", "OUT TIME", "OUT LOCATION", "TOTAL HOURS"
        ]);

        headerRow.eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
            cell.alignment = { horizontal: "center", vertical: "middle" };
        });

        const columnWidths = [15, 25, 20, 20, 20, 12, 12, 12, 45, 12, 45, 12];
        columnWidths.forEach((width, index) => {
            worksheet.getColumn(index + 1).width = width;
        });

        for (const entry of filteredEmployeeAttendanceData) {
            const name = `${entry.employee?.first_name || ""} ${entry.employee?.last_name || ""}`.trim() || "—";
            const category = entry.employee?.employee_category_id?.employee_category_name || "—";
            const department = entry.employee?.department_name || "—";
            const empCode = entry.employee?.employee_code || "—";
            const designation = entry.employee?.title || "—";
            const empCountry = entry.employee?.country || "IN";

            for (const daywiseData of (entry.attendances || [])) {
                let logs = daywiseData?.entries || [];

                const [y, m, d] = daywiseData.calculatedDate.split('-');
                const recordDate = `${d}/${m}/${y}`;

                const currentStatus = daywiseData.in_time !== null ? "present" :
                    daywiseData.absent ? "absent" :
                        daywiseData.leave ? "leave" :
                            daywiseData.holiday ? "holiday" :
                                daywiseData.week_off ? "week_off" :
                                    daywiseData.not_marked ? "not marked" : "absent";

                logs = logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

                if (["absent", "leave", "holiday", "week_off", "not marked"].includes(currentStatus) && logs.length === 0) {
                    let statusText, statusColor;
                    switch (currentStatus) {
                        case "absent": case "not marked": statusText = "Absent"; statusColor = "FFFFCCCC"; break;
                        case "leave": statusText = "On Leave"; statusColor = "FFFFFF99"; break;
                        case "holiday": statusText = "Holiday"; statusColor = "FFCCFFFF"; break;
                        case "week_off": statusText = "Week Off"; statusColor = "FFCCCCFF"; break;
                        default: statusText = currentStatus; statusColor = "FFFFFFFF";
                    }

                    const row = worksheet.addRow([
                        empCode, name, designation, category, department, recordDate, statusText, "—", "—", "—", "—", "—"
                    ]);

                    row.getCell(7).font = { bold: true };
                    row.getCell(7).fill = { type: "pattern", pattern: "solid", fgColor: { argb: statusColor } };
                    row.eachCell(cell => cell.alignment = { horizontal: "center", vertical: "middle" });
                    continue;
                }

                let inLog = null;
                for (const log of logs) {
                    const logType = log.TP?.toLowerCase();

                    if (logType === "in") {
                        if (inLog) {
                            const row = worksheet.addRow([
                                empCode, name, designation, category, department, recordDate, "Pending OUT",
                                formatTime(inLog.timestamp, empCountry),
                                inLog.geo_address || "—", "—", "—", "—"
                            ]);
                            row.getCell(7).font = { color: { argb: "FFFF8000" }, bold: true };
                            row.eachCell(cell => cell.alignment = { horizontal: "center", vertical: "middle" });
                        }
                        inLog = log;
                    } else if (logType === "out" && inLog) {
                        const isOutSystem = log?.made_by === "system";
                        const start = new Date(inLog.timestamp).getTime();
                        let end = new Date(log.timestamp).getTime();

                        if (end < start) end += 86400000;

                        const diffMs = end - start;
                        const hours = Math.floor(diffMs / 3600000);
                        const minutes = Math.floor((diffMs / 60000) % 60);

                        const row = worksheet.addRow([
                            empCode, name, designation, category, department, recordDate, isOutSystem ? "Pending OUT" : "Present",
                            formatTime(inLog.timestamp, empCountry),
                            inLog.geo_address || "—",
                            isOutSystem ? "—" : formatTime(log.timestamp, empCountry),
                            isOutSystem ? "—" : (log.geo_address || "—"),
                            isOutSystem ? "—" : `${hours}h ${minutes.toString().padStart(2, '0')}m`
                        ]);

                        row.getCell(7).font = { color: { argb: isOutSystem ? "FFFF8000" : "FF00B050" }, bold: true };
                        row.getCell(8).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCCFFCC" } };
                        if (!isOutSystem) {
                            row.getCell(10).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFCCCC" } };
                        }
                        row.eachCell(cell => cell.alignment = { horizontal: "center", vertical: "middle" });
                        inLog = null;
                    }
                }

                if (inLog) {
                    const row = worksheet.addRow([
                        empCode, name, designation, category, department, recordDate, "Pending OUT",
                        formatTime(inLog.timestamp, empCountry),
                        inLog.geo_address || "—", "—", "—", "—"
                    ]);
                    row.getCell(7).font = { color: { argb: "FFFF8000" }, bold: true };
                    row.eachCell(cell => cell.alignment = { horizontal: "center", vertical: "middle" });
                }
            }
        }

        worksheet.views = [{ state: "frozen", ySplit: 4 }];

        const safeFirmName = (firmDetails.firm_name || "Firm").replace(/[^a-z0-9]/gi, '_');
        const fileName = `Attendance_${safeFirmName}_${displayStartDate.replace(/\//g, '-')}_to_${displayEndDate.replace(/\//g, '-')}.xlsx`;

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        return true;

    } catch (error) {
        console.error("Error generating Excel:", error);
        alert("Something went wrong while exporting attendance report. Please check the console.");
        return null;
    }
};
