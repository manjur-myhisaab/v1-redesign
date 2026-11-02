// @ts-nocheck
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import rdk, { customEndpoint, ATTENDANCE_SERVER_URL } from "@/services/server";
import axios from "axios";
import { preprocessAttendanceList } from "../attendanceAutoPunchHelper";

// Helper: Format date to DD-MM-YYYY
const formatDateStandard = (rawDate) => {
    if (!rawDate) return "";
    if (typeof rawDate === "string") {
        if (rawDate.includes("-") && rawDate.split("-")[0].length === 4) {
            const [y, m, d] = rawDate.split("-");
            return `${d.padStart(2, "0")}-${m.padStart(2, "0")}-${y}`;
        }
        if (rawDate.includes("-") && rawDate.split("-")[2].length === 4) {
            const [d, m, y] = rawDate.split("-");
            return `${d.padStart(2, "0")}-${m.padStart(2, "0")}-${y}`;
        }
    }
    const dateObj = new Date(rawDate);
    if (!isNaN(dateObj.getTime())) {
        const dd = String(dateObj.getDate()).padStart(2, "0");
        const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
        const yyyy = dateObj.getFullYear();
        return `${dd}-${mm}-${yyyy}`;
    }
    return String(rawDate);
};

// Helper: Format time string to 12-hour format (e.g. 10:00 AM, 12:22 PM)
const formatTime12h = (timeVal) => {
    if (!timeVal) return "";
    if (typeof timeVal === "string" && (timeVal.includes("AM") || timeVal.includes("PM"))) {
        return timeVal.trim();
    }
    const dateObj = new Date(timeVal);
    if (!isNaN(dateObj.getTime())) {
        let hours = dateObj.getHours();
        const minutes = String(dateObj.getMinutes()).padStart(2, "0");
        const ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12 || 12;
        return `${hours}:${minutes} ${ampm}`;
    }
    if (typeof timeVal === "string" && timeVal.includes(":")) {
        const parts = timeVal.split(":");
        let hours = parseInt(parts[0], 10);
        const minutes = parts[1] || "00";
        if (!isNaN(hours)) {
            const ampm = hours >= 12 ? "PM" : "AM";
            hours = hours % 12 || 12;
            return `${hours}:${minutes} ${ampm}`;
        }
    }
    return String(timeVal);
};

// Helper: Format minutes to hh:mm format (e.g. 540 mins -> 09:00)
const formatHours = (mins) => {
    if (!mins || mins <= 0) return "00:00";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

// Helper: Generate list of dates in month in ASCENDING order (Day 1 to maxDay)
const getDatesInMonthAscending = (year, month) => {
    const y = Number(year);
    const m = Number(month);
    const currentDate = new Date();
    const isCurrentMonth = currentDate.getFullYear() === y && (currentDate.getMonth() + 1) === m;

    const totalDaysInMonth = new Date(y, m, 0).getDate();
    const maxDay = isCurrentMonth ? Math.min(currentDate.getDate(), totalDaysInMonth) : totalDaysInMonth;

    const dates = [];
    for (let day = 1; day <= maxDay; day++) {
        const dd = String(day).padStart(2, "0");
        const mm = String(m).padStart(2, "0");
        dates.push(`${dd}-${mm}-${y}`);
    }
    return dates;
};

// Helper: Extract clean mobile number
const formatMobileNumber = (email, phone) => {
    let num = phone || "";
    if (!num && email) {
        num = email.replace("91", "").split("@")[0];
    }
    if (!num) return "";
    num = String(num).trim();
    if (num.startsWith("+")) return num;
    if (num.startsWith("91") && num.length > 10) return `+${num}`;
    return `+91${num}`;
};

export const downloadEmployeewiseAttedanceReport = async (
    firmId, empId, month, year, staffDetails, returnBlob = false
) => {
    try {
        const formattedMonth = String(month).padStart(2, "0");

        // Fetch data from API endpoint with axios fallback
        let res = null;
        try {
            res = await rdk.request(
                customEndpoint({
                    path: `api/DailyAttnWithShifts/${year}-${formattedMonth}/${empId}/${firmId}`,
                    method: "GET",
                })
            );
        } catch (rdkErr) {
            console.warn("rdk.request DailyAttnWithShifts failed, trying axios fallback:", rdkErr);
        }

        if (!res) {
            try {
                const axiosRes = await axios.get(`${ATTENDANCE_SERVER_URL}/api/DailyAttnWithShifts/${year}-${formattedMonth}/${empId}/${firmId}`);
                res = axiosRes.data;
            } catch (axErr) {
                console.error("axios fallback DailyAttnWithShifts also failed:", axErr);
            }
        }

        const employee = res?.employees || staffDetails || {};
        const attendances = res?.attendances || [];

        // Header Details
        const firstName = employee.first_name || staffDetails?.first_name || "";
        const lastName = employee.last_name || staffDetails?.last_name || "";
        const empName = `${firstName} ${lastName}`.trim() || staffDetails?.name || "Employee";
        const empMob = formatMobileNumber(employee.email || staffDetails?.email, employee.phone || staffDetails?.phone);

        // Map standardized date string -> day record
        const attendanceMap = new Map();
        preprocessAttendanceList(attendances);
        attendances.forEach((item) => {
            if (item && item.date) {
                const stdDate = formatDateStandard(item.date);
                attendanceMap.set(stdDate, item);
            }
        });

        // Filter dates to ONLY include those that have attendance data
        const datesList = getDatesInMonthAscending(year, month);
        const datesListWithData = datesList.filter((dateStr) => attendanceMap.has(dateStr));

        const bodyRows = [];
        let totalAbsent = 0;
        let totalPresent = 0;
        let totalHalfDay = 0;
        let totalLeave = 0;
        let totalHoliday = 0;
        let totalWeekOff = 0;
        let totalWeekOffPresent = 0;
        let totalHolidayPresent = 0;
        let totalLate = 0;
        let totalEarly = 0;
        let totalMinutes = 0;

        datesListWithData.forEach((dateStr) => {
            const dayRecord = attendanceMap.get(dateStr);
            if (!dayRecord) return;

            // 1. If absent is true, do NOT check entries or punches at all!
            const isAbsent = Boolean(dayRecord.absent === true || dayRecord.TP === "absent");
            if (isAbsent) {
                totalAbsent += 1;
                bodyRows.push([dateStr, "Ab", "", "", "", "", "00:00", "", ""]);
                return;
            }

            // 2. If leave is true
            const isLeave = Boolean(dayRecord.leave === true || dayRecord.TP === "leave");
            if (isLeave) {
                totalLeave += 1;
                bodyRows.push([dateStr, "Leave", "", "", "", "", "00:00", "", ""]);
                return;
            }

            const entries = dayRecord.entries || [];
            const inLogs = entries.filter((e) => e.TP === "in" || e.in_time);
            const outLogs = entries.filter((e) => e.TP === "out" || e.out_time);

            const hasPunch = inLogs.length > 0 || Boolean(dayRecord.in_formatted_time || dayRecord.in_time !== null || (dayRecord.total_work_duration && dayRecord.total_work_duration > 0));
            const isHalfDay = Boolean(dayRecord.half_day || dayRecord.calculated_half_day);
            const isWeekOff = Boolean(dayRecord.week_off || dayRecord.TP === "week_off");
            const isHoliday = Boolean(dayRecord.holiday || dayRecord.TP === "holiday");

            // 3. Unworked Week Off
            if (isWeekOff && !hasPunch) {
                totalWeekOff += 1;
                bodyRows.push([dateStr, "Week Off", "", "", "", "", "00:00", "", ""]);
                return;
            }

            // 4. Unworked Holiday
            if (isHoliday && !hasPunch) {
                totalHoliday += 1;
                bodyRows.push([dateStr, "Holiday", "", "", "", "", "00:00", "", ""]);
                return;
            }

            // 5. No punch record at all
            if (!hasPunch) {
                totalAbsent += 1;
                bodyRows.push([dateStr, "Ab", "", "", "", "", "00:00", "", ""]);
                return;
            }

            // 6. Worked Days Status
            let statText = "Present";
            if (isWeekOff) {
                statText = "WeekOff Present";
                totalWeekOffPresent += 1;
            } else if (isHoliday) {
                statText = "Holiday Present";
                totalHolidayPresent += 1;
            } else if (isHalfDay) {
                statText = "Half Day";
                totalHalfDay += 1;
            } else {
                statText = "Present";
                totalPresent += 1;
            }

            // Process punch entries & durations
            if (entries.length > 0 && inLogs.length > 0) {
                inLogs.forEach((inLog, idx) => {
                    const outLog = outLogs[idx] || null;
                    const isOutSystem = outLog?.made_by === "system" || (idx === 0 && dayRecord?.out_time?.made_by === "system");

                    let minutes = 0;
                    if (!isOutSystem) {
                        if (inLog.timestamp && outLog && outLog.timestamp) {
                            const diffMs = new Date(outLog.timestamp).getTime() - new Date(inLog.timestamp).getTime();
                            if (diffMs > 0) minutes = Math.floor(diffMs / 60000);
                        } else if (inLog.duration) {
                            minutes = Number(inLog.duration) || 0;
                        } else if (dayRecord.total_work_duration && idx === 0) {
                            minutes = Number(dayRecord.total_work_duration) || 0;
                        }
                    }

                    totalMinutes += minutes;

                    const isEarly = inLog.early || outLog?.early || (idx === 0 && (dayRecord.early || dayRecord.early_exit));
                    const isLate = inLog.late || (idx === 0 && dayRecord.late);

                    if (isEarly) totalEarly += 1;
                    if (isLate) totalLate += 1;

                    const inAddr = inLog.geo_address || inLog.address || (idx === 0 ? (dayRecord.in_address || dayRecord.geo_address) : "") || "";
                    const outAddr = (!isOutSystem && outLog) ? (outLog.geo_address || outLog.address || (idx === 0 ? dayRecord.out_address : "") || "") : "";

                    bodyRows.push([
                        dateStr,
                        idx === 0 ? statText : "",
                        formatTime12h(inLog.timestamp || inLog.time || dayRecord.in_formatted_time),
                        inAddr,
                        (outLog && !isOutSystem) ? formatTime12h(outLog.timestamp || outLog.time || dayRecord.out_formatted_time) : "",
                        outAddr,
                        formatHours(minutes),
                        isEarly ? "E" : "",
                        isLate ? "L" : "",
                    ]);
                });
            } else {
                const isOutSystem = dayRecord?.out_time?.made_by === "system";
                const minutes = isOutSystem ? 0 : (Number(dayRecord.total_work_duration || dayRecord.duration) || 0);
                totalMinutes += minutes;

                const isEarly = dayRecord.early || dayRecord.early_exit;
                const isLate = dayRecord.late;

                if (isEarly) totalEarly += 1;
                if (isLate) totalLate += 1;

                bodyRows.push([
                    dateStr,
                    statText,
                    formatTime12h(dayRecord.in_formatted_time || dayRecord.in_time),
                    dayRecord.in_address || dayRecord.in_geo_address || dayRecord.geo_address || "",
                    isOutSystem ? "" : formatTime12h(dayRecord.out_formatted_time || dayRecord.out_time),
                    isOutSystem ? "" : (dayRecord.out_address || dayRecord.out_geo_address || ""),
                    formatHours(minutes),
                    isEarly ? "E" : "",
                    isLate ? "L" : "",
                ]);
            }
        });

        // Initialize PDF in LANDSCAPE A4 mode (Width 297mm x Height 210mm)
        const doc = new jsPDF({
            orientation: "landscape",
            unit: "mm",
            format: "a4",
        });

        // Header Bar (#3F4D63) - Full 277mm Landscape width
        doc.setFillColor(63, 77, 99);
        doc.rect(10, 10, 277, 14, "F");

        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text("MONTHLY ATTENDANCE", 14, 19);

        doc.setFontSize(11);
        doc.text(`Date: ${month}/${year}`, 282, 19, { align: "right" });

        // Sub-Header Bar (#798A9E) - Full 277mm Landscape width
        doc.setFillColor(121, 138, 158);
        doc.rect(10, 24, 277, 16, "F");

        doc.setFontSize(9.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text(`EMP NAME : ${empName}`, 14, 30);
        doc.text(`ENG MOB : ${empMob}`, 14, 36);

        // Main Attendance Grid Table
        autoTable(doc, {
            startY: 42,
            head: [["DATE", "STAT", "IN", "IN LOC", "OUT", "OUT LOC", "TOTAL HOURS", "EARLY", "LATE"]],
            body: bodyRows,
            theme: "grid",
            headStyles: {
                fillColor: [55, 71, 95], // #37475F
                textColor: [255, 255, 255],
                fontStyle: "bold",
                halign: "center",
                valign: "middle",
                fontSize: 8.5,
            },
            styles: {
                fontSize: 7.5,
                cellPadding: 1.5,
                valign: "middle",
                lineWidth: 0.1,
                lineColor: [60, 60, 60],
            },
            columnStyles: {
                0: { cellWidth: 24, halign: "center" },
                1: { cellWidth: 22, halign: "center" },
                2: { cellWidth: 19, halign: "center" },
                3: { cellWidth: 72, halign: "left" },
                4: { cellWidth: 19, halign: "center" },
                5: { cellWidth: 72, halign: "left" },
                6: { cellWidth: 21, halign: "center" },
                7: { cellWidth: 14, halign: "center" },
                8: { cellWidth: 14, halign: "center" },
            },
            didParseCell: (data) => {
                if (data.section === "body") {
                    // Style STAT column (index 1)
                    if (data.column.index === 1) {
                        const statVal = String(data.cell.raw || "");
                        if (statVal === "Present") {
                            data.cell.styles.textColor = [0, 128, 0]; // Green
                            data.cell.styles.fontStyle = "bold";
                        } else if (statVal === "Half Day") {
                            data.cell.styles.textColor = [180, 100, 0]; // Dark Yellow/Orange
                            data.cell.styles.fontStyle = "bold";
                        } else if (statVal === "WeekOff Present") {
                            data.cell.styles.textColor = [0, 130, 130]; // Teal
                            data.cell.styles.fontStyle = "bold";
                        } else if (statVal === "Holiday Present") {
                            data.cell.styles.textColor = [128, 0, 128]; // Purple
                            data.cell.styles.fontStyle = "bold";
                        } else if (statVal === "Ab") {
                            data.cell.styles.textColor = [192, 0, 0]; // Red
                            data.cell.styles.fontStyle = "bold";
                        } else if (statVal === "Leave") {
                            data.cell.styles.textColor = [180, 80, 0];
                            data.cell.styles.fontStyle = "bold";
                        }
                    }

                    // Style EARLY and LATE flags
                    if (data.column.index === 7 && data.cell.raw === "E") {
                        data.cell.styles.textColor = [211, 47, 47];
                        data.cell.styles.fontStyle = "bold";
                    }
                    if (data.column.index === 8 && data.cell.raw === "L") {
                        data.cell.styles.textColor = [211, 47, 47];
                        data.cell.styles.fontStyle = "bold";
                    }
                }
            },
            margin: { left: 10, right: 10, top: 15, bottom: 15 },
        });

        // Separate Attendance Summary Section
        let summaryStartY = doc.lastAutoTable.finalY + 8;
        const pageHeight = doc.internal.pageSize.getHeight();

        // Check if space remains on page for summary table (needs ~25mm), else add new page
        if (summaryStartY + 25 > pageHeight - 10) {
            doc.addPage();
            summaryStartY = 15;
        }

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(55, 71, 95);
        doc.text("ATTENDANCE SUMMARY", 10, summaryStartY);

        autoTable(doc, {
            startY: summaryStartY + 3,
            head: [["PRESENT", "ABSENT", "HALF DAY", "LEAVE", "HOLIDAY", "WEEK OFF", "WO PRESENT", "HO PRESENT", "LATE", "EARLY", "TOTAL HOURS"]],
            body: [[
                String(totalPresent),
                String(totalAbsent),
                String(totalHalfDay),
                String(totalLeave),
                String(totalHoliday),
                String(totalWeekOff),
                String(totalWeekOffPresent),
                String(totalHolidayPresent),
                String(totalLate),
                String(totalEarly),
                formatHours(totalMinutes),
            ]],
            theme: "grid",
            headStyles: {
                fillColor: [55, 71, 95],
                textColor: [255, 255, 255],
                fontStyle: "bold",
                halign: "center",
                valign: "middle",
                fontSize: 7,
            },
            styles: {
                fontSize: 7.5,
                fontStyle: "bold",
                halign: "center",
                valign: "middle",
                cellPadding: 1.8,
                lineWidth: 0.1,
                lineColor: [60, 60, 60],
            },
            columnStyles: {
                0: { cellWidth: 25.18 },
                1: { cellWidth: 25.18 },
                2: { cellWidth: 25.18 },
                3: { cellWidth: 25.18 },
                4: { cellWidth: 25.18 },
                5: { cellWidth: 25.18 },
                6: { cellWidth: 25.18 },
                7: { cellWidth: 25.18 },
                8: { cellWidth: 25.18 },
                9: { cellWidth: 25.18 },
                10: { cellWidth: 25.2 },
            },
            didParseCell: (data) => {
                if (data.section === "body") {
                    const idx = data.column.index;
                    if (idx === 0) {
                        data.cell.styles.fillColor = [204, 255, 204];
                        data.cell.styles.textColor = [0, 100, 0];
                    } else if (idx === 1) {
                        data.cell.styles.fillColor = [255, 204, 204];
                        data.cell.styles.textColor = [180, 0, 0];
                    } else if (idx === 2) {
                        data.cell.styles.fillColor = [255, 235, 156];
                        data.cell.styles.textColor = [150, 100, 0];
                    } else if (idx === 3) {
                        data.cell.styles.fillColor = [255, 224, 178];
                        data.cell.styles.textColor = [180, 80, 0];
                    } else if (idx === 4 || idx === 5) {
                        data.cell.styles.fillColor = [230, 230, 230];
                        data.cell.styles.textColor = [50, 50, 50];
                    } else if (idx === 6) {
                        data.cell.styles.fillColor = [200, 240, 240];
                        data.cell.styles.textColor = [0, 120, 120];
                    } else if (idx === 7) {
                        data.cell.styles.fillColor = [235, 215, 255];
                        data.cell.styles.textColor = [110, 0, 150];
                    } else if (idx === 8 || idx === 9) {
                        data.cell.styles.fillColor = [255, 205, 210];
                        data.cell.styles.textColor = [180, 0, 0];
                    } else if (idx === 10) {
                        data.cell.styles.fillColor = [197, 225, 250];
                        data.cell.styles.textColor = [0, 50, 150];
                    }
                }
            },
            margin: { left: 10, right: 10, top: 15, bottom: 15 },
        });

        // Save PDF file
        const sanitizedEmpName = empName.replace(/[^a-zA-Z0-9]/g, "_");
        const filename = `Monthly_Attendance_${sanitizedEmpName}_${month}_${year}.pdf`;

        if (returnBlob) {
            return {
                filename,
                blob: doc.output("blob")
            };
        }

        doc.save(filename);
        return doc.output("bloburl");
    } catch (error) {
        console.error("Error generating Employeewise Attendance PDF:", error);
        throw error;
    }
};