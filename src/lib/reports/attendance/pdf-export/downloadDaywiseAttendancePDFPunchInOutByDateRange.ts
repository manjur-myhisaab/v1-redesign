// @ts-nocheck
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
// MAIN PDF EXPORT FUNCTION
// ==========================================

export const downloadDaywiseAttendancePDFPunchInOutByDateRange = async (
    firmDetails,
    dateRange,
    selectedEmployeeIds,
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
                    let statusText;
                    switch (currentStatus) {
                        case "absent": case "not marked": statusText = "Absent"; break;
                        case "leave": statusText = "On Leave"; break;
                        case "holiday": statusText = "Holiday"; break;
                        case "week_off": statusText = "Week Off"; break;
                        default: statusText = currentStatus;
                    }

                    tableRows.push([
                        empCode, name, designation, category, department, recordDate, statusText, "—", "—", "—", "—", "—"
                    ]);
                    continue;
                }

                let inLog = null;
                for (const log of logs) {
                    const logType = log.TP?.toLowerCase();

                    if (logType === "in") {
                        if (inLog) {
                            tableRows.push([
                                empCode, name, designation, category, department, recordDate, "Pending OUT",
                                formatTime(inLog.timestamp, empCountry),
                                inLog.geo_address || "—", "—", "—", "—"
                            ]);
                        }
                        inLog = log;
                    } else if (logType === "out" && inLog) {
                        const isOutSystem = log?.made_by === "system";
                        tableRows.push([
                            empCode, name, designation, category, department, recordDate, isOutSystem ? "Pending OUT" : "Present",
                            formatTime(inLog.timestamp, empCountry),
                            inLog.geo_address || "—",
                            isOutSystem ? "—" : formatTime(log.timestamp, empCountry),
                            isOutSystem ? "—" : (log.geo_address || "—"),
                            isOutSystem ? "—" : calculateTotalHours(inLog.timestamp, log.timestamp)
                        ]);
                        inLog = null;
                    }
                }

                if (inLog) {
                    tableRows.push([
                        empCode, name, designation, category, department, recordDate, "Pending OUT",
                        formatTime(inLog.timestamp, empCountry),
                        inLog.geo_address || "—", "—", "—", "—"
                    ]);
                }
            }
        }

        const displayStartDate = startDate.toLocaleDateString("en-GB");
        const displayEndDate = endDate.toLocaleDateString("en-GB");

        autoTable(doc, {
            startY: 45,
            head: [["EMP ID", "NAME", "DESIGNATION", "CATEGORY", "DEPARTMENT", "DATE", "STATUS", "IN TIME", "IN LOCATION", "OUT TIME", "OUT LOCATION", "TOTAL"]],
            body: tableRows,
            theme: "grid",
            headStyles: { fillColor: [255, 242, 204], textColor: [0, 0, 0], fontStyle: "bold", halign: "center" },
            styles: { fontSize: 6.5, halign: "center", valign: "middle" },
            columnStyles: {
                0: { cellWidth: 15 },
                1: { halign: 'left', cellWidth: 22 },
                2: { halign: 'left', cellWidth: 18 },
                3: { halign: 'left', cellWidth: 18 },
                4: { halign: 'left', cellWidth: 18 },
                5: { cellWidth: 15 },
                6: { cellWidth: 15 },
                7: { cellWidth: 15 },
                8: { halign: 'left', cellWidth: 35 },
                9: { cellWidth: 15 },
                10: { halign: 'left', cellWidth: 35 },
                11: { cellWidth: 15 },
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
                    doc.setFontSize(16).setFont("helvetica", "bold").text(firmDetails.firm_name || "Firm", pageWidth / 2, 35, { align: "center" });
                    doc.setFontSize(10).setFont("helvetica", "italic").text(`Punch In-Out Report: ${displayStartDate} to ${displayEndDate}`, pageWidth / 2, 40, { align: "center" });
                }
                doc.text(`Page ${data.pageNumber}`, pageWidth - 25, pageHeight - 10);
            },
            didParseCell: (data) => {
                if (data.section === 'body' && data.column.index === 6) {
                    const status = data.cell.raw;
                    if (status === "Present") data.cell.styles.textColor = [0, 128, 0];
                    if (status === "Absent" || status === "On Leave") data.cell.styles.fillColor = [255, 230, 230];
                    if (status === "Pending OUT") data.cell.styles.textColor = [255, 128, 0];
                }
            },
            margin: { top: 25 }
        });

        return doc.output("bloburl");

    } catch (error) {
        console.error("PDF Error:", error);
        alert("Error generating PDF.");
        return null;
    }
};

const calculateTotalHours = (start, end) => {
    let s = new Date(start).getTime(), e = new Date(end).getTime();
    if (e < s) e += 86400000;
    const diff = e - s;
    return `${Math.floor(diff / 3600000)}h ${Math.floor((diff / 60000) % 60).toString().padStart(2, '0')}m`;
};
