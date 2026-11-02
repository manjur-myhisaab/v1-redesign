// @ts-nocheck
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatTime } from "@/lib/timeUtils";
import axios from "axios";
import { ATTENDANCE_SERVER_URL } from "@/services/server";
import { preprocessAttendanceList } from "../attendanceAutoPunchHelper";

export const downloadDaywiseAttendancePDFByMonth = async (
    firmDetails,
    month,
    year,
    selectedEmployeeIds,
    allShifts,
    allUsers,
    firmLogo
) => {
    try {
        const formattedMonth = String(month).padStart(2, '0');
        const yearMonth = `${year}-${formattedMonth}`;
        const startDate = new Date(year, parseInt(month, 10) - 1, 1);
        const endDate = new Date(year, parseInt(month, 10), 0);

        const response = await axios.get(`${ATTENDANCE_SERVER_URL}/api/all_employee_attendance/${yearMonth}/${firmDetails.firm_id}`);
        const allEmployeeAttendanceData = response.data;
        const results = allEmployeeAttendanceData?.results || allEmployeeAttendanceData || [];

        const selectedEmployeeAttendanceData = results.filter((item) =>
            selectedEmployeeIds?.includes(item.employee?.id)
        );

        if (!selectedEmployeeAttendanceData || selectedEmployeeAttendanceData.length === 0) {
            alert("No attendance records found for selected month and employees.");
            return null;
        }

        const doc = new jsPDF("l", "mm", "a4");
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        const firmLogoURL = `${ATTENDANCE_SERVER_URL}/assets/${firmLogo}`;

        const tableRows = [];

        for (const entry of selectedEmployeeAttendanceData) {
            const name = `${entry.employee?.first_name || ""} ${entry.employee?.last_name || ""}`.trim() || "—";
            const category = entry.employee?.employee_category_id?.employee_category_name || "—";
            const department = entry.employee?.department_name || "—";
            const empCode = entry.employee?.employee_code || "—";
            const designation = entry.employee?.title || "—";
            const empCountry = entry.employee?.country || "IN";

            preprocessAttendanceList(entry.attendances);
            for (const daywiseData of (entry.attendances || [])) {
                let statusText = "Absent", statusColor = "FFFFCCCC", shiftName = "—",
                    checkIn = "—", checkOut = "—", totalHours = "—", late = "—", early = "—";

                const logs = daywiseData?.entries || [];
                const attDate = daywiseData?.date || "—";

                let shiftDetails = null;
                const entryWithShift = logs.find(l => l.shift_id && typeof l.shift_id === 'object');
                if (entryWithShift) {
                    shiftDetails = entryWithShift.shift_id;
                }

                const statusMap = {
                    'present': { text: "Present", color: "FFCCFFCC" },
                    'absent': { text: "Absent", color: "FFFFCCCC" },
                    'leave': { text: "Leave", color: "FFFFFF99" },
                    'holiday': { text: "Holiday", color: "FFCCFFFF" },
                    'week_off': { text: "Week Off", color: "FFCCCCFF" }
                };

                const currentStatus = daywiseData.in_time !== null ? "present" :
                    daywiseData.absent ? "absent" :
                        daywiseData.leave ? "leave" :
                            daywiseData.holiday ? "holiday" :
                                daywiseData.week_off ? "week_off" : "absent";

                statusText = statusMap[currentStatus]?.text || "Absent";

                if (shiftDetails) {
                    shiftName = shiftDetails.shift_name || "—";
                }

                if (currentStatus === "absent") {
                    if (entry?.employee?.shift_type === "monthly" || entry?.employee?.shift_type === "Monthly") {
                        const shiftFromMonth = entry.employee?.monthly_shifts?.find((item) => item.date_string === attDate.split("/").join("-"));
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
                    else if (entry?.employee?.shift_type === "fixed" || entry?.employee?.shift_type === "Fixed") {
                        const targettedEmployee = allUsers?.find((item) => item.id === entry?.employee?.id) || entry?.employee;
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
                        const dateParts = attDate.split("/");
                        const dObj = new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`);
                        const day = dObj.toLocaleDateString("en-US", { weekday: "long" });
                        if (entry?.employee?.weekly_shifts?.length > 0) {
                            for (const shift of (entry?.employee?.weekly_shifts || [])) {
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
                    const inLogs = logs.filter(l => l.TP === "in" && l.made_by !== "system");
                    const outLogs = logs.filter(l => l.TP === "out" && l.made_by !== "system");

                    let earliestInTime;
                    let latestOutTime;

                    if (inLogs.length > 0) {
                        const earliestIn = inLogs.reduce((a, b) => new Date(a.timestamp).getTime() < new Date(b.timestamp).getTime() ? a : b);
                        earliestInTime = new Date(earliestIn.timestamp);
                        checkIn = formatTime(earliestInTime, empCountry);

                        if (shiftDetails?.shift_from) {
                            const [sh, sm] = (shiftDetails.shift_from.split(":") || []).map(Number);
                            if (!isNaN(sh) && !isNaN(sm)) {
                                const shiftStart = new Date(earliestInTime);
                                shiftStart.setHours(sh, sm, 0, 0);

                                if (earliestInTime > shiftStart) {
                                    const diffMs = earliestInTime.getTime() - shiftStart.getTime();
                                    const h = Math.floor(diffMs / (1000 * 60 * 60));
                                    const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                                    late = `${h.toString().padStart(2, "0")}h ${m.toString().padStart(2, "0")}m`;
                                } else late = "00h 00m";
                            }
                        }
                    }

                    if (outLogs.length > 0 && earliestInTime) {
                        const latestOut = outLogs.reduce((a, b) => new Date(a.timestamp).getTime() > new Date(b.timestamp).getTime() ? a : b);
                        latestOutTime = new Date(latestOut.timestamp);

                        if (latestOutTime.getTime() < earliestInTime.getTime()) {
                            latestOutTime.setDate(latestOutTime.getDate() + 1);
                        }

                        if (latestOut?.made_by === "system") checkOut = "—";
                        else checkOut = formatTime(latestOutTime, empCountry);

                        if (shiftDetails?.shift_to) {
                            const [eh, em] = (shiftDetails.shift_to.split(":") || []).map(Number);
                            if (!isNaN(eh) && !isNaN(em)) {
                                const shiftEnd = new Date(latestOutTime);
                                const shiftToHour = Number(shiftDetails.shift_to.split(":")[0]);
                                const shiftFromHour = shiftDetails.shift_from ? Number(shiftDetails.shift_from.split(":")[0]) : 0;
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
                                } else early = "00h 00m";
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
                    attDate, empCode, name, designation, category, department, statusText,
                    shiftName, checkIn, checkOut, totalHours, late, early
                ]);
            }
        }

        const displayStartDate = startDate.toLocaleDateString("en-GB");
        const displayEndDate = endDate.toLocaleDateString("en-GB");

        autoTable(doc, {
            startY: 45,
            head: [["DATE", "EMP ID", "NAME", "DESIGNATION", "CATEGORY", "DEPARTMENT", "STATUS", "SHIFT", "IN", "OUT", "TOTAL", "LATE", "EARLY"]],
            body: tableRows,
            theme: "grid",
            headStyles: { fillColor: [255, 242, 204], textColor: [0, 0, 0], fontStyle: "bold", halign: "center" },
            styles: { fontSize: 6, halign: "center", valign: "middle" },
            columnStyles: {
                0: { halign: 'center', cellWidth: 16 },
                1: { halign: 'center', cellWidth: 16 },
                2: { halign: 'left', cellWidth: 26 },
            },
            didDrawPage: (data) => {
                if (data.pageNumber === 1) {
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
                        } catch (logoErr) {
                            console.warn("Could not render logo in PDF:", logoErr);
                        }
                    }
                    doc.setFontSize(18).setFont("helvetica", "bold").text(firmDetails.firm_name, pageWidth / 2, 35, { align: "center" });
                    doc.setFontSize(12).setFont("helvetica", "italic").text(`Attendance Report: ${displayStartDate} to ${displayEndDate}`, pageWidth / 2, 40, { align: "center" });
                }
                doc.text(`Page: ${data.pageNumber}`, pageWidth - 25, pageHeight - 10);
            },
            margin: { top: 30 },
            didParseCell: (data) => {
                if (data.section === 'body' && data.column.index === 6) {
                    const colors = {
                        "Present": [204, 255, 204],
                        "Absent": [255, 204, 204],
                        "Leave": [255, 255, 153],
                        "Holiday": [204, 255, 255],
                        "Week Off": [204, 204, 255]
                    };
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
