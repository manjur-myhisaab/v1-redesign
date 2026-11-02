// @ts-nocheck
import ExcelJS from "exceljs";
import { formatTime } from "@/lib/timeUtils";
import { preprocessAttendanceList } from "../attendanceAutoPunchHelper";

export const downloadDaywiseAttendanceExcel = async (
    employees,
    absentees,
    firmName = "Your Firm Name",
    date,
    selectedEmployee,
    allShifts,
    allUsers,
    isCustomized,
    customColumns,
    customTitle,
) => {
    // Filter employees based on selection with robust fallback to allUsers
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

        // === Columns count ===
        const totalColumns = 11; // EMPLOYEE ID to EARLY
        const lastColLetter = worksheet.getColumn(totalColumns).letter;

        // === Headers and Formatting ===
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

        worksheet.addRow([]); // empty row after headers

        // === Table Headers ===
        let headerRow;
        if (isCustomized === "customized") {
            headerRow = worksheet.addRow(
                customColumns?.map(col => col.label)
            );
        }
        else {
            headerRow = worksheet.addRow([
                "EMPLOYEE ID",
                "NAME",
                "DESIGNATION",
                "CATEGORY",
                "STATUS",
                "SHIFT NAME",
                "CHECK IN",
                "CHECK OUT",
                "TOTAL HOURS",
                "LATE",
                "EARLY",
            ]);
        }

        headerRow.eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFFFF2CC" },
            };
            cell.alignment = { horizontal: "center", vertical: "middle" };
        });

        // Column widths
        if (isCustomized === "customized") {
            customColumns?.forEach((column, index) => {
                worksheet.getColumn(index + 1).width = column.width;
            });
        }
        else {
            worksheet.getColumn(1).width = 30; // EMPLOYEE ID
            worksheet.getColumn(2).width = 30; // NAME
            worksheet.getColumn(3).width = 20; // DESIGNATION
            worksheet.getColumn(4).width = 20; // CATEGORY
            worksheet.getColumn(5).width = 12; // STATUS
            worksheet.getColumn(6).width = 15; // SHIFT NAME
            worksheet.getColumn(7).width = 12; // CHECK IN
            worksheet.getColumn(8).width = 12; // CHECK OUT
            worksheet.getColumn(9).width = 15; // TOTAL HOURS
            worksheet.getColumn(10).width = 12; // LATE
            worksheet.getColumn(11).width = 12; // EARLY
        }

        // === Data Loop ===
        const listToProcess = (absentees && absentees.length > 0) ? [...absentees] : [];
        for (const emp of employees) {
            if (!listToProcess.some((a) => a.employee_id === emp.id)) {
                listToProcess.push({
                    employee_id: emp.id,
                    status: "absent",
                    attendance_data: { entries: [] },
                });
            }
        }
        preprocessAttendanceList(listToProcess);

        for (const entry of listToProcess) {
            const employee = employees.find((e) => e.id === entry.employee_id) || allUsers?.find((e) => e.id === entry.employee_id);

            if (!employee) {
                continue;
            }

            const name = `${employee.first_name || ""} ${employee.last_name || ""}`.trim() || "—";
            const category = employee?.employee_category_id?.employee_category_name || "—";
            const empCode = employee?.employee_code || "—";
            const designation = employee?.title || "—";
            const empCountry = employee?.country || "IN";

            let statusText = "Absent";
            let statusColor = "FFFFCCCC";
            let shiftName = "—";
            let checkIn = "—";
            let checkOut = "—";
            let totalHours = "—";
            let late = "—";
            let early = "—";

            const logs = entry?.attendance_data?.entries || [];
            let shiftDetails = entry?.shift_id || (logs.length > 0 ? logs[0]?.shift_id : null);

            if (Array.isArray(shiftDetails)) {
                shiftDetails = shiftDetails[0] || null;
            }
            if (shiftDetails && (typeof shiftDetails === "string" || typeof shiftDetails === "number")) {
                shiftDetails = allShifts?.find((item) => item.shift_id === shiftDetails || item.id === shiftDetails) || shiftDetails;
            }

            // === Status Logic ===
            if (entry.status === "absent") {
                statusText = "Absent";
                statusColor = "FFFFCCCC";
            } else if (entry.status === "leave") {
                statusText = "Leave";
                statusColor = "FFFFFF99";
            } else if (entry.status === "holiday") {
                statusText = "Holiday";
                statusColor = "FFCCFFFF";
            } else if (entry.status === "present") {
                statusText = "Present";
                statusColor = "FFCCFFCC";
            } else if (entry.status === "week_off") {
                statusText = "Week Off";
                statusColor = "FFCCCCFF";
            }

            if (shiftDetails && typeof shiftDetails === "object") {
                shiftName = shiftDetails.shift_name || "—";
            }

            if (entry?.status === "absent") {
                if (employee?.shift_type === "monthly" || employee?.shift_type === "Monthly") {
                    const shiftFromMonth = employee?.monthly_shifts?.find((item) => item.date_string === formattedDate.split("/").join("-"));
                    if (shiftFromMonth?.shift_ids?.length > 0) {
                        let allShiftNameForDay = [];
                        for (const shift of (shiftFromMonth?.shift_ids || [])) {
                            const sId = shift?.shift_id || shift?.shift_shift_id || shift;
                            const sDetails = allShifts?.find((item) => item.shift_id === sId || item.id === sId);
                            if (sDetails?.shift_name) {
                                allShiftNameForDay.push(sDetails.shift_name);
                            }
                        }
                        shiftName = allShiftNameForDay.length > 0 ? allShiftNameForDay.join(", ") : "No Shift Found";
                    }
                    else {
                        shiftName = "No Shift Found";
                    }
                }
                else if (employee?.shift_type === "fixed" || employee?.shift_type === "Fixed") {
                    const targettedEmployee = allUsers?.find((item) => item.id === employee.id) || employee;
                    if (targettedEmployee?.shift_ids?.length > 0) {
                        let allShiftNameForDay = [];
                        for (const shift of (targettedEmployee?.shift_ids || [])) {
                            let sName = shift?.shift_shift_id?.shift_name;
                            if (!sName) {
                                const sId = shift?.shift_shift_id || shift?.shift_id || shift;
                                const sObj = allShifts?.find((item) => item.shift_id === sId || item.id === sId);
                                sName = sObj?.shift_name;
                            }
                            if (sName) {
                                allShiftNameForDay.push(sName);
                            }
                        }
                        shiftName = allShiftNameForDay.length > 0 ? allShiftNameForDay.join(", ") : "No Shift Found";
                    }
                    else {
                        shiftName = "No Shift Found";
                    }
                }
                else {
                    const dateParts = formattedDate.split("/");
                    const dObj = new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`);
                    const day = dObj.toLocaleDateString("en-US", { weekday: "long" });
                    if (employee?.weekly_shifts?.length > 0) {
                        for (const shift of (employee.weekly_shifts || [])) {
                            if (shift.day_name === day) {
                                const sId = shift?.shift_id || shift?.shift_shift_id || shift;
                                const shiftDetails = allShifts?.find((item) => item.shift_id === sId || item.id === sId);
                                shiftName = shiftDetails?.shift_name || "No Shift Name Found";
                            }
                        }
                    }
                    else {
                        shiftName = "No Shift Found";
                    }
                }
            }

            if (logs.length > 0) {
                const inLogs = logs.filter((l) => l.TP === "in" && l.made_by !== "system");
                const outLogs = logs.filter((l) => l.TP === "out" && l.made_by !== "system");

                let earliestInTime;
                let latestOutTime;

                // --- CHECK IN ---
                if (inLogs.length > 0) {
                    const earliestIn = inLogs.reduce((a, b) =>
                        new Date(a.timestamp).getTime() < new Date(b.timestamp).getTime() ? a : b
                    );
                    earliestInTime = new Date(earliestIn.timestamp);

                    checkIn = formatTime(earliestInTime, empCountry);

                    if (shiftDetails && shiftDetails.shift_from) {
                        const shift = shiftDetails;
                        const [sh, sm] = (shift.shift_from.split(":") || []).map(Number);

                        if (!isNaN(sh) && !isNaN(sm)) {
                            const shiftStart = new Date(earliestInTime);
                            shiftStart.setHours(sh, sm, 0, 0);

                            if (earliestInTime > shiftStart) {
                                const diffMs = earliestInTime.getTime() - shiftStart.getTime();
                                const h = Math.floor(diffMs / (1000 * 60 * 60));
                                const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                                late = `${h.toString().padStart(2, "0")}h ${m.toString().padStart(2, "0")}m`;
                            } else {
                                late = "00h 00m";
                            }
                        } else {
                            late = "—";
                        }
                    } else {
                        late = "—";
                    }
                }

                // --- CHECK OUT ---
                if (outLogs.length > 0 && earliestInTime) {
                    const latestOut = outLogs.reduce((a, b) =>
                        new Date(a.timestamp).getTime() > new Date(b.timestamp).getTime() ? a : b
                    );
                    latestOutTime = new Date(latestOut.timestamp);

                    if (latestOutTime.getTime() < earliestInTime.getTime()) {
                        latestOutTime.setDate(latestOutTime.getDate() + 1);
                    }

                    if (latestOut?.made_by === "system") {
                        checkOut = "—";
                    }
                    else {
                        checkOut = formatTime(latestOutTime, empCountry);
                    }

                    if (shiftDetails && shiftDetails.shift_to) {
                        const shift = shiftDetails;
                        const [eh, em] = (shift.shift_to.split(":") || []).map(Number);

                        if (!isNaN(eh) && !isNaN(em)) {
                            const shiftEnd = new Date(latestOutTime);

                            const shiftToHour = Number(shift.shift_to.split(":")[0]);
                            const shiftFromHour = shift.shift_from ? Number(shift.shift_from.split(":")[0]) : 0;
                            const isOvernight = !isNaN(shiftFromHour) && shiftToHour < shiftFromHour;

                            shiftEnd.setHours(eh, em, 0, 0);
                            if (isOvernight && shiftEnd.getTime() < latestOutTime.getTime()) {
                                shiftEnd.setDate(shiftEnd.getDate() + 1);
                            }

                            if (latestOutTime < shiftEnd) {
                                const diffMs = shiftEnd.getTime() - latestOutTime.getTime();
                                const h = Math.floor(diffMs / (1000 * 60 * 60));
                                const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                                early = `${h.toString().padStart(2, "0")}h ${m.toString().padStart(2, "0")}m`;
                            } else {
                                early = "00h 00m";
                            }
                        } else {
                            early = "—";
                        }
                    } else {
                        early = "—";
                    }

                    // --- TOTAL HOURS ---
                    if (earliestInTime) {
                        let diffMs = latestOutTime.getTime() - earliestInTime.getTime();
                        const hours = Math.floor(diffMs / (1000 * 60 * 60));
                        const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

                        totalHours = latestOut?.made_by === "system" ? "—" : `${hours}h ${mins.toString().padStart(2, "0")}m`;
                    }
                }
            }

            // === Add Row to Worksheet ===
            const row = worksheet.addRow([
                empCode,
                name,
                designation,
                category,
                statusText,
                shiftName,
                checkIn,
                checkOut,
                totalHours,
                late,
                early,
            ]);

            // === Apply Formatting ===
            row.getCell(5).fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: statusColor },
            };

            row.eachCell((cell) => {
                cell.alignment = { horizontal: "center", vertical: "middle" };
            });
        }

        // === Final Download ===
        const fileName = `Daywise_Attendance_${formattedDate.replace(/\//g, '-')}.xlsx`;
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

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
        alert("Something went wrong while exporting attendance report.");
        return null;
    }
};
