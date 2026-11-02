// @ts-nocheck
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatTime } from "@/lib/timeUtils";
import axios from "axios";
import { ATTENDANCE_SERVER_URL } from "@/services/server";
import { preprocessAttendanceList } from "../attendanceAutoPunchHelper";

// Helper: Get all YYYY-MM months in range
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

// Helper: Safely extract or calculate date directly in YYYY-MM-DD
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

export const downloadDaywiseAttendancePDFByDateRange = async (
    firmDetails,
    dateRange,
    selectedEmployeeIds,
    allShifts,
    allUsers,
    firmLogo
) => {
    if (!selectedEmployeeIds || selectedEmployeeIds.length === 0) {
        alert("Please select at least one employee");
        return null;
    }

    const firmLogoURL = `${ATTENDANCE_SERVER_URL}/assets/${firmLogo}`;

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

                preprocessAttendanceList(item.attendances);
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
            alert("No attendance data found for the selected range and employees.");
            return null;
        }

        const doc = new jsPDF("l", "mm", "a4");
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        const tableRows = [];

        for (const entry of filteredEmployeeAttendanceData) {
            const name = `${entry.employee?.first_name || ""} ${entry.employee?.last_name || ""}`.trim() || "—";
            const category = entry.employee?.employee_category_id?.employee_category_name || "—";
            const department = entry.employee?.department_name || "—";
            const empCode = entry.employee?.employee_code || "—";
            const designation = entry.employee?.title || "—";
            const empCountry = entry.employee?.country || "IN";

            for (const daywiseData of entry.attendances) {
                let statusText = "Absent", statusColor = "FFFFCCCC", shiftName = "—",
                    checkIn = "—", checkOut = "—", totalHours = "—", late = "—", early = "—";

                const logs = daywiseData?.entries || [];

                const [y, m, d] = daywiseData.calculatedDate.split('-');
                const recordDate = `${d}/${m}/${y}`;

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
                        const shiftFromMonth = entry?.employee?.monthly_shifts?.find((item) => item.date_string === recordDate.split("/").join("-"));
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
                        const date = new Date(recordDate.split("/").reverse().join("-"));
                        const day = date.toLocaleDateString("en-US", { weekday: "long" });
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
                    recordDate, empCode, name, designation, category, department, statusText,
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
