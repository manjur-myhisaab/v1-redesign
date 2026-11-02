// @ts-nocheck
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatTime } from "@/lib/timeUtils";
import { ATTENDANCE_SERVER_URL } from "@/services/server";

export const downloadDaywiseAttendancePDFPunchInOut = async (
    employees,
    absentees,
    firmName = "Your Firm Name",
    date,
    selectedEmployee,
    firmLogo,
    allUsers
) => {
    const firmLogoURL = `${ATTENDANCE_SERVER_URL}/assets/${firmLogo}`;

    const baseEmployees = (employees && employees.length > 0) ? employees : (allUsers || []);
    employees = baseEmployees.filter((employee) => selectedEmployee?.includes(employee.id));

    try {
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

        // === Data Preparation ===
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
                let statusText;
                switch (initialStatus) {
                    case "absent": case "not marked": statusText = "Absent"; break;
                    case "leave": statusText = "On Leave"; break;
                    case "holiday": statusText = "Holiday"; break;
                    case "week_off": statusText = "Week Off"; break;
                    default: statusText = initialStatus;
                }
                tableRows.push([
                    empCode, name, designation, category, department, statusText, "—", "—", "—", "—", "—"
                ]);
                continue;
            }

            let inLog = null;
            for (const log of logs) {
                const logType = log.TP?.toLowerCase();

                if (logType === "in") {
                    if (inLog) {
                        tableRows.push([
                            empCode, name, designation, category, department, "Pending OUT",
                            formatTime(inLog.timestamp, empCountry),
                            inLog.geo_address || "—", "—", "—", "—"
                        ]);
                    }
                    inLog = log;
                } else if (logType === "out" && inLog) {
                    const isOutSystem = log?.made_by === "system";
                    tableRows.push([
                        empCode, name, designation, category, department, isOutSystem ? "Pending OUT" : "Present",
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
                    empCode, name, designation, category, department, "Pending OUT",
                    formatTime(inLog.timestamp, empCountry),
                    inLog.geo_address || "—", "—", "—", "—"
                ]);
            }
        }

        // === Table Generation ===
        autoTable(doc, {
            startY: 45,
            head: [["EMP ID", "NAME", "DESIGNATION", "CATEGORY", "DEPARTMENT", "STATUS", "IN TIME", "IN LOCATION", "OUT TIME", "OUT LOCATION", "TOTAL"]],
            body: tableRows,
            theme: "grid",
            headStyles: { fillColor: [255, 242, 204], textColor: [0, 0, 0], fontStyle: "bold", halign: "center" },
            styles: { fontSize: 7, halign: "center", valign: "middle" },
            columnStyles: {
                0: { cellWidth: 15 },
                1: { halign: 'left', cellWidth: 25 },
                2: { halign: 'left', cellWidth: 20 },
                3: { halign: 'left', cellWidth: 20 },
                4: { halign: 'left', cellWidth: 20 },
                5: { cellWidth: 18 },
                6: { cellWidth: 18 },
                7: { halign: 'left', cellWidth: 40 },
                8: { cellWidth: 18 },
                9: { halign: 'left', cellWidth: 40 },
                10: { cellWidth: 18 },
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
                    doc.setFontSize(16).setFont("helvetica", "bold").text(firmName, pageWidth / 2, 35, { align: "center" });
                    doc.setFontSize(10).setFont("helvetica", "italic").text(`Punch In-Out Report: ${formattedDate}`, pageWidth / 2, 40, { align: "center" });
                }
                doc.text(`Page ${data.pageNumber}`, pageWidth - 25, pageHeight - 10);
            },
            didParseCell: (data) => {
                if (data.section === 'body' && data.column.index === 5) {
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
