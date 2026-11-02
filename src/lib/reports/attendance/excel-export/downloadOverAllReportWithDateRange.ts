// @ts-nocheck
import ExcelJS from "exceljs";
import toast from "react-hot-toast";
import axios from "axios";
import rdk, { customEndpoint, ATTENDANCE_SERVER_URL } from "@/services/server";
import { preprocessAttendanceList } from "../attendanceAutoPunchHelper";

// Utility: Get all dates between start and end date
const getDatesInRange = (startDate, endDate) => {
    const result = [];
    let date = new Date(startDate);
    const end = new Date(endDate);

    if (String(startDate).includes('-')) {
        const parts = String(startDate).split('-');
        if (parts[0].length === 4) {
            date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
        }
    }

    let endD = new Date(endDate);
    if (String(endDate).includes('-')) {
        const parts = String(endDate).split('-');
        if (parts[0].length === 4) {
            endD = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
        }
    }

    while (date <= endD) {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");
        result.push(`${yyyy}-${mm}-${dd}`);
        date.setDate(date.getDate() + 1);
    }

    return result;
};

// Utility: Start date se End date tak saare unique YYYY-MM nikalne ke liye
const getMonthsInRange = (startDate, endDate) => {
    let start = new Date(startDate);
    let end = new Date(endDate);

    if (String(startDate).includes('-')) {
        const parts = String(startDate).split('-');
        if (parts[0].length === 4) {
            start = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
        }
    }
    if (String(endDate).includes('-')) {
        const parts = String(endDate).split('-');
        if (parts[0].length === 4) {
            end = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
        }
    }

    const months = [];
    let currentYear = start.getFullYear();
    let currentMonth = start.getMonth();
    const endYear = end.getFullYear();
    const endMonth = end.getMonth();

    while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
        const yyyy = currentYear;
        const mm = String(currentMonth + 1).padStart(2, '0');
        months.push(`${yyyy}-${mm}`);

        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
    }
    return months;
};

// Determine attendance status based on the new JSON structure
const getStatus = (dayRecord) => {
    if (!dayRecord) return "NM";

    const isPresent = Boolean(
        (dayRecord.in_time !== null && dayRecord.in_time !== undefined) ||
        dayRecord.in_formatted_time ||
        dayRecord.out_formatted_time ||
        (dayRecord.total_work_duration && dayRecord.total_work_duration > 0) ||
        (dayRecord.duration && dayRecord.duration > 0) ||
        (dayRecord.entries && dayRecord.entries.length > 0 && (dayRecord.entries[0].TP === "P" || dayRecord.entries[0].TP === "present" || dayRecord.entries[0].in_time))
    );

    if (isPresent) {
        if (dayRecord.half_day === true || dayRecord.calculated_half_day === true || (dayRecord.entries && dayRecord.entries[0]?.TP === "half_day")) {
            return "HFD";
        }
        if (dayRecord.holiday === true || dayRecord.holiday_time || (dayRecord.entries && dayRecord.entries[0]?.TP === "holiday")) {
            return "HO(P)";
        }
        if (dayRecord.week_off === true || (dayRecord.entries && dayRecord.entries[0]?.TP === "week_off")) {
            return "WO(P)";
        }
        return "P";
    }

    if (dayRecord.leave === true || (dayRecord.entries && dayRecord.entries[0]?.TP === "leave")) return "L";
    if (dayRecord.absent === true || (dayRecord.entries && dayRecord.entries[0]?.TP === "absent")) return "A";
    if (dayRecord.half_day === true || (dayRecord.entries && dayRecord.entries[0]?.TP === "half_day")) return "HFD";
    if (dayRecord.holiday === true || dayRecord.holiday_time || (dayRecord.entries && dayRecord.entries[0]?.TP === "holiday")) return "HO";
    if (dayRecord.week_off === true || (dayRecord.entries && dayRecord.entries[0]?.TP === "week_off")) return "WO";

    if (dayRecord.entries && dayRecord.entries.length > 0) {
        const tp = dayRecord.entries[0].TP;
        if (tp === "P" || tp === "present" || dayRecord.entries[0].in_time) return "P";
        if (tp === "absent") return "A";
        if (tp === "leave") return "L";
        if (tp === "week_off") return "WO";
        if (tp === "holiday") return "HO";
        if (tp === "half_day") return "HFD";
    }

    return "NM";
};

// Cell styling by status
const getCellStyle = (status) => {
    const fills = {
        NM: "FFF2F2F2",
        P: "FFCCFFCC",
        "WO(P)": "FFCCFFCC",
        "HO(P)": "FFCCFFCC",
        A: "FFFFC7CE",
        L: "fcec03",
        HFD: "FFFFEB9C",
        HO: "FFD9D9D9",
        WO: "FFD9D9D9",
    };

    return {
        fill: {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: fills[status] || "FFFFFFFF" },
        },
        font: {
            bold: true,
            size: 10,
            color: { argb: "FF000000" },
        },
        alignment: { vertical: "middle", horizontal: "center" },
        border: {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" },
        },
    };
};

const getAttendanceSummary = (statusMap) => {
    const summary = {
        Present: 0,
        Absent: 0,
        HalfDay: 0,
        PaidLeave: 0,
        Holiday: 0,
        WeekOff: 0,
        Not_Marked: 0,
    };

    Object.values(statusMap).forEach((status) => {
        if (status === "P") {
            summary.Present += 1;
        } else if (status === "WO(P)") {
            summary.Present += 1;
            summary.WeekOff += 1;
        } else if (status === "HO(P)") {
            summary.Present += 1;
            summary.Holiday += 1;
        } else if (status === "A") {
            summary.Absent += 1;
        } else if (status === "HFD") {
            summary.HalfDay += 1;
        } else if (status === "L") {
            summary.PaidLeave += 1;
        } else if (status === "HO") {
            summary.Holiday += 1;
        } else if (status === "WO") {
            summary.WeekOff += 1;
        } else if (status === "NM") {
            summary.Not_Marked += 1;
        }
    });

    return summary;
};

export const downloadOverAllReportWithDateRange = async (
    startDate: any,
    endDate: any,
    employees: any[],
    firm_id: any,
    firm_name: any,
    selectedEmployeeIds: any[] = []
) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Attendance");

        const dates = getDatesInRange(startDate, endDate);
        const monthsToFetch = getMonthsInRange(startDate, endDate);

        const summaryColCount = 6;
        const initialColCount = 5;
        const totalHeaderCols = initialColCount + dates.length + summaryColCount;
        const lastColLetter = worksheet.getColumn(totalHeaderCols).letter;

        worksheet.mergeCells(`A1:${lastColLetter}1`);
        worksheet.getCell("A1").value = `Firm Name: ${firm_name || "N/A"}`;
        worksheet.getCell("A1").font = { size: 14, bold: true };
        worksheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };

        worksheet.mergeCells(`A2:${lastColLetter}2`);
        worksheet.getCell("A2").value = "Attendance Report";
        worksheet.getCell("A2").font = { size: 12, bold: true };
        worksheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };

        worksheet.mergeCells(`A3:${lastColLetter}3`);
        worksheet.getCell("A3").value = `Date Range: ${startDate} to ${endDate}`;
        worksheet.getCell("A3").font = { italic: true };
        worksheet.getCell("A3").alignment = { horizontal: "center", vertical: "middle" };

        worksheet.addRow([]);

        const header = [
            "Employee ID",
            "Employee Name",
            "Designation",
            "Category",
            "Department",
            ...dates,
            "Total Present",
            "Total Absent",
            "Total Leave",
            "Total Halfday",
            "Total Holiday",
            "Total WeekOff",
        ];

        worksheet.addRow(header);

        const headerRow = worksheet.getRow(5);
        headerRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF808080" } };
            cell.alignment = { vertical: "middle", horizontal: "center" };
            cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
        });

        // Parallel Bulk API Calls
        const monthlyApiPromises = monthsToFetch.map(async (yearMonth) => {
            try {
                return await rdk.request(
                    customEndpoint({
                        path: `api/all_employee_attendance/${yearMonth}/${firm_id}`,
                        method: "GET",
                    })
                );
            } catch (err) {
                if (ATTENDANCE_SERVER_URL) {
                    try {
                        const res = await axios.get(`${ATTENDANCE_SERVER_URL}/api/all_employee_attendance/${yearMonth}/${firm_id}`);
                        return res.data;
                    } catch (axiosErr) {
                        console.error(`Error fetching bulk attendance for month ${yearMonth}:`, axiosErr);
                        return { results: [] };
                    }
                }
                console.error(`Error fetching bulk attendance for month ${yearMonth}:`, err);
                return { results: [] };
            }
        });

        const monthlyBulkResults = await Promise.all(monthlyApiPromises);

        const attendanceByEmpId = new Map();
        const apiEmployeesMap = new Map();

        monthlyBulkResults.forEach((monthResult) => {
            const results = monthResult?.results || monthResult?.data?.results || [];
            results.forEach((empResult) => {
                const empId = empResult?.employee?.id;
                if (empId) {
                    if (!apiEmployeesMap.has(empId) && empResult.employee) {
                        apiEmployeesMap.set(empId, empResult.employee);
                    }
                    if (!attendanceByEmpId.has(empId)) {
                        attendanceByEmpId.set(empId, []);
                    }
                    const processed = preprocessAttendanceList(empResult.attendances || []);
                    attendanceByEmpId.get(empId).push(...processed);
                }
            });
        });

        let employeeList = Array.isArray(employees)
            ? [...employees]
            : (Array.isArray(employees?.employees) ? [...employees.employees] : []);

        if (employeeList.length === 0) {
            employeeList = Array.from(apiEmployeesMap.values());
        }

        if (selectedEmployeeIds && selectedEmployeeIds.length > 0) {
            employeeList = employeeList.filter((employee) => employee && selectedEmployeeIds.includes(employee.id));
        }

        if (employeeList.length === 0) {
            toast.error("No employee matched the selection");
            return null;
        }

        for (const staffMember of employeeList) {
            const attendances = attendanceByEmpId.get(staffMember.id) || [];
            const statusMap = {};

            attendances.forEach((dayRecord) => {
                if (dayRecord && dayRecord.date) {
                    const parts = String(dayRecord.date).split("-");
                    if (parts.length === 3) {
                        const iso = parts[0].length === 4
                            ? `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
                            : `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                        statusMap[iso] = getStatus(dayRecord);
                    }
                }
            });

            const dailyStatuses = dates.map((date) => statusMap[date] || "NM");
            const summary = getAttendanceSummary(statusMap);

            const firstName = staffMember.first_name || "";
            const lastName = staffMember.last_name || "";
            const empName = `${firstName} ${lastName}`.trim() || "Unknown";

            let category = "";
            if (typeof staffMember.employee_category_id === "object" && staffMember.employee_category_id !== null) {
                category = staffMember.employee_category_id.employee_category_name || "";
            }

            const rowData = [
                `${staffMember.employee_code || ""}`,
                empName,
                `${staffMember.title || ""}`,
                category,
                `${staffMember.department_name || ""}`,
                ...dailyStatuses,
                summary.Present,
                summary.Absent,
                summary.PaidLeave,
                summary.HalfDay,
                summary.Holiday,
                summary.WeekOff,
            ];

            const row = worksheet.addRow(rowData);

            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                const value = cell.value;
                const isStatusCol = colNumber > 5 && colNumber <= 5 + dates.length;

                if (isStatusCol && typeof value === "string" && value) {
                    Object.assign(cell, getCellStyle(value));
                } else {
                    cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
                    cell.alignment = { vertical: "middle", horizontal: "center" };
                    cell.font = { bold: true };
                }
            });
        }

        worksheet.views = [{ state: "frozen", ySplit: 5 }];

        worksheet.columns.forEach((column, i) => {
            const colNumber = i + 1;
            if (colNumber >= 1 && colNumber <= 5) {
                column.width = 30;
            } else if (colNumber > 5 && colNumber <= 5 + dates.length) {
                column.width = 12;
            } else {
                column.width = 15;
            }
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `Attendance_Report_${startDate}_to_${endDate}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return true;
    } catch (error) {
        console.error("Report generation failed:", error);
        return null;
    }
};
