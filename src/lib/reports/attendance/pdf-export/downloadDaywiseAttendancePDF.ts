// @ts-nocheck
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatTime } from "@/lib/timeUtils";
import { ATTENDANCE_SERVER_URL } from "@/services/server";
import { preprocessAttendanceList } from "../attendanceAutoPunchHelper";

export const downloadDaywiseAttendancePDF = async (
    employees,
    absentees,
    firmName = "Your Firm Name",
    date,
    selectedEmployee,
    allShifts,
    allUsers,
    firmLogo
) => {
    const firmLogoURL = `${ATTENDANCE_SERVER_URL}/assets/${firmLogo}`;

    try {
        const baseEmployees = (employees && employees.length > 0) ? employees : (allUsers || []);
        employees = baseEmployees.filter((employee) => selectedEmployee?.includes(employee.id));

        const dateObj = new Date(date);
        const formattedDate = dateObj.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });

        if (!employees || employees.length === 0) {
            alert("Please select at least one employee");
            return null;
        }

        const doc = new jsPDF("l", "mm", "a4");
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        const tableRows = [];

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
            const department = employee?.department_name || "—";
            const empCode = employee?.employee_code || "—";
            const designation = employee?.title || "—";
            const empCountry = employee?.country || "IN";

            const statusMap = {
                absent: "Absent",
                leave: "Leave",
                holiday: "Holiday",
                present: "Present",
                week_off: "Week Off"
            };

            const statusText = statusMap[entry.status] || "Absent";

            let shiftName = "—", checkIn = "—", checkOut = "—", totalHours = "—", late = "—", early = "—";
            const logs = entry?.attendance_data?.entries || [];

            let shiftDetails = entry?.shift_id || (logs.length > 0 ? logs[0]?.shift_id : null);
            if (Array.isArray(shiftDetails)) shiftDetails = shiftDetails[0] || null;
            if (shiftDetails) shiftName = shiftDetails.shift_name || "—";
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
                                const sDetails = allShifts?.find((item) => item.shift_id === sId || item.id === sId);
                                shiftName = sDetails?.shift_name || "No Shift Name Found";
                            }
                        }
                    }
                    else {
                        shiftName = "No Shift Found";
                    }
                }
            }

            if (logs.length > 0) {
                const inLogs = logs.filter(l => l.TP === "in" && l.made_by !== "system");
                const outLogs = logs.filter(l => l.TP === "out" && l.made_by !== "system");

                let earliestInTime;
                let latestOutTime;

                if (inLogs.length > 0) {
                    const earliestIn = inLogs.reduce((a, b) => new Date(a.timestamp).getTime() < new Date(b.timestamp).getTime() ? a : b);
                    earliestInTime = new Date(earliestIn.timestamp);
                    checkIn = formatTime(earliestInTime, empCountry);

                    if (shiftDetails?.shift_from) {
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
                        }
                    }
                }

                if (outLogs.length > 0 && earliestInTime) {
                    const latestOut = outLogs.reduce((a, b) => new Date(a.timestamp).getTime() > new Date(b.timestamp).getTime() ? a : b);
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

                    if (shiftDetails?.shift_to) {
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
                        }
                    }

                    if (earliestInTime) {
                        let diffMs = latestOutTime.getTime() - earliestInTime.getTime();
                        const hours = Math.floor(diffMs / (1000 * 60 * 60));
                        const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                        totalHours = latestOut?.made_by === "system" ? "—" : `${hours}h ${mins.toString().padStart(2, "0")}m`;
                    }
                }
            }

            tableRows.push([
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
                early
            ]);
        }

        autoTable(doc, {
            startY: 45,
            head: [["EMP ID", "NAME", "DESIGNATION", "CATEGORY", "STATUS", "SHIFT NAME", "CHECK IN", "CHECK OUT", "TOTAL HOURS", "LATE", "EARLY"]],
            body: tableRows,
            theme: "grid",
            headStyles: { fillColor: [255, 242, 204], textColor: [0, 0, 0], fontStyle: "bold", halign: "center" },
            styles: { fontSize: 8, halign: "center", valign: "middle" },
            didDrawPage: (data) => {
                if (data.pageNumber === 1) {
                    let logoDrawn = false;
                    if (firmLogo) {
                        try {
                            const imageProps = doc.getImageProperties(firmLogoURL);
                            const fixedWidth = 25;
                            const autoHeight = (imageProps.height * fixedWidth) / imageProps.width;
                            doc.addImage(
                                firmLogoURL,
                                "PNG",
                                (pageWidth / 2) - (fixedWidth / 2),
                                8,
                                fixedWidth,
                                autoHeight
                            );
                            logoDrawn = true;
                        } catch (logoErr) {
                            console.warn("Could not render firm logo in PDF:", logoErr);
                        }
                    }
                    doc.setFontSize(18).setFont("helvetica", "bold").text(firmName, pageWidth / 2, 35, { align: "center" });
                    doc.setFontSize(12).setFont("helvetica", "italic").text(`Daywise Attendance Report: ${formattedDate}`, pageWidth / 2, 40, { align: "center" });
                }

                doc.text(`Page: ${data.pageNumber}`, pageWidth - 25, pageHeight - 10);
            },
            margin: { top: 30 },
            didParseCell: (data) => {
                if (data.section === 'body' && data.column.index === 4) {
                    const colors = { "Present": [204, 255, 204], "Absent": [255, 204, 204], "Leave": [255, 255, 153], "Holiday": [204, 255, 255], "Week Off": [204, 204, 255] };
                    if (colors[data.cell.raw]) data.cell.styles.fillColor = colors[data.cell.raw];
                }
            }
        });

        return doc.output("bloburl");
    } catch (error) {
        console.error("Error generating PDF:", error);
        alert("Something went wrong while exporting PDF report.");
        return null;
    }
};
