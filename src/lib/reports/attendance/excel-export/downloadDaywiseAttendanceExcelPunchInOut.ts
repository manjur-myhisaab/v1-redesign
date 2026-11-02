// @ts-nocheck
import ExcelJS from "exceljs";
import { formatTime } from "@/lib/timeUtils";

export const downloadDaywiseAttendanceExcelPunchInOut = async (
    employees,
    absentees,
    firmName = "Your Firm Name",
    date,
    selectedEmployee,
    allUsers
) => {
    const baseEmployees = (employees && employees.length > 0) ? employees : (allUsers || []);
    employees = baseEmployees.filter((employee) => selectedEmployee?.includes(employee.id));

    try {
        const formattedDate = new Date(date).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });

        if (!employees || employees.length === 0) {
            alert("Please select at least one employee");
            return null;
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Daywise Attendance");

        const totalColumns = 11;
        const lastColLetter = worksheet.getColumn(totalColumns).letter;

        worksheet.mergeCells(`A1:${lastColLetter}1`);
        const firmCell = worksheet.getCell("A1");
        firmCell.value = firmName;
        firmCell.font = { bold: true, size: 16 };
        firmCell.alignment = { horizontal: "center", vertical: "middle" };

        worksheet.mergeCells(`A2:${lastColLetter}2`);
        const dateCell = worksheet.getCell("A2");
        dateCell.value = `Date: ${formattedDate}`;
        dateCell.font = { italic: true, size: 12 };
        dateCell.alignment = { horizontal: "center", vertical: "middle" };

        worksheet.addRow([]);

        const headerRow = worksheet.addRow([
            "EMPLOYEE ID",
            "EMPLOYEE NAME",
            "DESIGNATION",
            "CATEGORY",
            "DEPARTMENT",
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
        worksheet.getColumn(6).width = 12;
        worksheet.getColumn(7).width = 15;
        worksheet.getColumn(8).width = 50;
        worksheet.getColumn(9).width = 15;
        worksheet.getColumn(10).width = 50;
        worksheet.getColumn(11).width = 15;

        const listToProcess = (absentees && absentees.length > 0) ? [...absentees] : [];
        for (const emp of employees) {
            if (!listToProcess.some((a) => a.employee_id === emp.id)) {
                listToProcess.push({
                    employee_id: emp.id,
                    status: "absent",
                    attendance_data: { entries: [] }
                });
            }
        }

        for (const entry of listToProcess) {
            const employee = employees.find((e) => e.id === entry.employee_id) || allUsers?.find((e) => e.id === entry.employee_id);

            if (!employee) {
                continue;
            }

            const name = employee ? `${employee.first_name || ""} ${employee.last_name || ""}`.trim() : "—";
            const category = employee?.employee_category_id?.employee_category_name || "—";
            const department = employee?.department_name || "—";
            const empCode = employee?.employee_code || "—";
            const designation = employee?.title || "—";
            const empCountry = employee?.country || "IN";

            const initialStatus = entry.status?.toLowerCase() || "—";
            let logs = entry?.attendance_data?.entries || [];

            logs = logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

            if (["absent", "leave", "holiday", "week_off", "not marked"].includes(initialStatus)) {
                let statusText, statusColor;
                switch (initialStatus) {
                    case "absent": case "not marked": statusText = "Absent"; statusColor = "FFFFCCCC"; break;
                    case "leave": statusText = "On Leave"; statusColor = "FFFFFF99"; break;
                    case "holiday": statusText = "Holiday"; statusColor = "FFCCFFFF"; break;
                    case "week_off": statusText = "Week Off"; statusColor = "FFCCCCFF"; break;
                    default: statusText = initialStatus; statusColor = "FFFFFFFF";
                }

                const row = worksheet.addRow([
                    empCode, name, designation, category, department, statusText, "—", "—", "—", "—", "—"
                ]);

                row.getCell(6).font = { bold: true };
                row.getCell(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: statusColor } };
                row.eachCell(cell => cell.alignment = { horizontal: "center", vertical: "middle" });
                continue;
            }

            let inLog = null;
            for (const log of logs) {
                const logType = log.TP?.toLowerCase();

                if (logType === "in") {
                    if (inLog) {
                        const row = worksheet.addRow([
                            empCode, name, designation, category, department, "Pending OUT",
                            formatTime(inLog.timestamp, empCountry),
                            inLog.geo_address || "—", "—", "—", "—"
                        ]);
                        row.getCell(6).font = { color: { argb: "FFFF8000" }, bold: true };
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
                        empCode, name, designation, category, department, isOutSystem ? "Pending OUT" : "Present",
                        formatTime(inLog.timestamp, empCountry),
                        inLog.geo_address || "—",
                        isOutSystem ? "—" : formatTime(log.timestamp, empCountry),
                        isOutSystem ? "—" : (log.geo_address || "—"),
                        isOutSystem ? "—" : `${hours}h ${minutes.toString().padStart(2, '0')}m`
                    ]);

                    row.getCell(6).font = { color: { argb: isOutSystem ? "FFFF8000" : "FF00B050" }, bold: true };
                    row.getCell(7).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCCFFCC" } };
                    if (!isOutSystem) {
                        row.getCell(9).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFCCCC" } };
                    }
                    row.eachCell(cell => cell.alignment = { horizontal: "center", vertical: "middle" });
                    inLog = null;
                }
            }

            if (inLog) {
                const row = worksheet.addRow([
                    empCode, name, designation, category, department, "Pending OUT",
                    formatTime(inLog.timestamp, empCountry),
                    inLog.geo_address || "—", "—", "—", "—"
                ]);
                row.getCell(6).font = { color: { argb: "FFFF8000" }, bold: true };
                row.eachCell(cell => cell.alignment = { horizontal: "center", vertical: "middle" });
            }
        }

        worksheet.views = [{ state: "frozen", ySplit: 4 }];

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Attendance_MultiPunch_${formattedDate.replace(/\//g, '-')}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        return true;
    } catch (error) {
        console.error("Error generating Multi-Punch Excel:", error);
        alert("Export failed.");
        return null;
    }
};
