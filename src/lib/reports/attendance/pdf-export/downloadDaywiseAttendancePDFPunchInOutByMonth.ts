// @ts-nocheck
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatTime } from "@/lib/timeUtils";
import axios from "axios";
import { ATTENDANCE_SERVER_URL } from "@/services/server";

export const downloadDaywiseAttendancePDFPunchInOutByMonth = async (
    firmDetails,
    month,
    year,
    selectedEmployeeIds,
    firmLogo
) => {
    const firmLogoURL = `${ATTENDANCE_SERVER_URL}/assets/${firmLogo}`;
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

        const doc = new jsPDF("l", "mm", "a4");
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        const tableRows = [];

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
                    let statusText;
                    switch (currentStatus) {
                        case "absent": case "not marked": statusText = "Absent"; break;
                        case "leave": statusText = "On Leave"; break;
                        case "holiday": statusText = "Holiday"; break;
                        case "week_off": statusText = "Week Off"; break;
                        default: statusText = currentStatus;
                    }

                    tableRows.push([
                        empCode, name, designation, category, department, attDate, statusText, "—", "—", "—", "—", "—"
                    ]);
                    continue;
                }

                let inLog = null;
                for (const log of logs) {
                    const logType = log.TP?.toLowerCase();

                    if (logType === "in") {
                        if (inLog) {
                            tableRows.push([
                                empCode, name, designation, category, department, attDate, "Pending OUT",
                                formatTime(inLog.timestamp, empCountry),
                                inLog.geo_address || "—", "—", "—", "—"
                            ]);
                        }
                        inLog = log;
                    } else if (logType === "out" && inLog) {
                        const isOutSystem = log?.made_by === "system";
                        tableRows.push([
                            empCode, name, designation, category, department, attDate, isOutSystem ? "Pending OUT" : "Present",
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
                        empCode, name, designation, category, department, attDate, "Pending OUT",
                        formatTime(inLog.timestamp, empCountry),
                        inLog.geo_address || "—", "—", "—", "—"
                    ]);
                }
            }
        }

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
                    doc.setFontSize(10).setFont("helvetica", "italic").text(`Punch In-Out Report: ${formattedMonth} / ${year}`, pageWidth / 2, 40, { align: "center" });
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
