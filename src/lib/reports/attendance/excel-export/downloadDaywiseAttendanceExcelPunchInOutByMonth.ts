// @ts-nocheck
import ExcelJS from "exceljs";
import { formatTime } from "@/lib/timeUtils";
import axios from "axios";
import { ATTENDANCE_SERVER_URL } from "@/services/server";

export const downloadDaywiseAttendanceExcelPunchInOutByMonth = async (
    firmDetails,
    month,
    year,
    selectedEmployeeIds
) => {
    try {
        const formattedMonth = String(month).padStart(2, '0');
        const yearMonth = `${year}-${formattedMonth}`;
        const response = await axios.get(`${ATTENDANCE_SERVER_URL}/api/all_employee_attendance/${yearMonth}/${firmDetails.firm_id}`);
        const allEmployeeAttendanceData = response.data;
        const results = allEmployeeAttendanceData?.results || allEmployeeAttendanceData || [];

        const selectedEmployeeAttendanceData = results.filter((item) =>
            selectedEmployeeIds.includes(item.employee?.id)
        );

        if (!selectedEmployeeAttendanceData || selectedEmployeeAttendanceData.length === 0) {
            alert("No attendance data found for the selected month and employees.");
            return null;
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Monthly Attendance");

        const totalColumns = 12;
        const lastColLetter = worksheet.getColumn(totalColumns).letter;

        worksheet.mergeCells(`A1:${lastColLetter}1`);
        const firmCell = worksheet.getCell("A1");
        firmCell.value = firmDetails.firm_name || "Your Firm Name";
        firmCell.font = { bold: true, size: 16 };
        firmCell.alignment = { horizontal: "center", vertical: "middle" };

        worksheet.mergeCells(`A2:${lastColLetter}2`);
        const dateCell = worksheet.getCell("A2");
        dateCell.value = `Attendance Report: ${formattedMonth} / ${year}`;
        dateCell.font = { italic: true, size: 12 };
        dateCell.alignment = { horizontal: "center", vertical: "middle" };

        worksheet.addRow([]);

        const headerRow = worksheet.addRow([
            "EMPLOYEE ID",
            "EMPLOYEE NAME",
            "DESIGNATION",
            "CATEGORY",
            "DEPARTMENT",
            "DATE",
            "STATUS",
            "IN TIME",
            "IN LOCATION",
            "OUT TIME",
            "OUT LOCATION",
            "TOTAL HOURS",
        ]);

        headerRow.eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
            cell.alignment = { horizontal: "center", vertical: "middle" };
        });

        worksheet.getColumn(1).width = 15;
        worksheet.getColumn(2).width = 25;
        worksheet.getColumn(3).width = 20;
        worksheet.getColumn(4).width = 18;
        worksheet.getColumn(5).width = 18;
        worksheet.getColumn(6).width = 15;
        worksheet.getColumn(7).width = 12;
        worksheet.getColumn(8).width = 15;
        worksheet.getColumn(9).width = 45;
        worksheet.getColumn(10).width = 15;
        worksheet.getColumn(11).width = 45;
        worksheet.getColumn(12).width = 15;

        for (const entry of selectedEmployeeAttendanceData) {
            const employee = entry.employee;
            const name = `${employee?.first_name || ""} ${employee?.last_name || ""}`.trim() || "—";
            const category = employee?.employee_category_id?.employee_category_name || "—";
            const department = employee?.department_name || "—";
            const empCode = employee?.employee_code || "—";
            const designation = employee?.title || "—";
            const empCountry = employee?.country || "IN";

            for (const daywiseData of (entry.attendances || [])) {
                const attDate = daywiseData?.date || "—";
                let logs = daywiseData?.entries || [];

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
                        empCode, name, designation, category, department, attDate, statusText, "—", "—", "—", "—", "—"
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
                                empCode, name, designation, category, department, attDate, "Pending OUT",
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
                            empCode, name, designation, category, department, attDate, isOutSystem ? "Pending OUT" : "Present",
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
                        empCode, name, designation, category, department, attDate, "Pending OUT",
                        formatTime(inLog.timestamp, empCountry),
                        inLog.geo_address || "—", "—", "—", "—"
                    ]);
                    row.getCell(7).font = { color: { argb: "FFFF8000" }, bold: true };
                    row.eachCell(cell => cell.alignment = { horizontal: "center", vertical: "middle" });
                }
            }
        }

        worksheet.views = [{ state: "frozen", ySplit: 4 }];

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        const safeFirmName = (firmDetails.firm_name || "Firm").replace(/\s+/g, '_');
        link.download = `Attendance_MultiPunch_${safeFirmName}_${formattedMonth}_${year}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        return true;

    } catch (error) {
        console.error("Error generating Monthly Multi-Punch Excel:", error);
        alert("Export failed. Please try again.");
        return null;
    }
};
