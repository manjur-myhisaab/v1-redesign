// @ts-nocheck
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import rdk, { ATTENDANCE_SERVER_URL, customEndpoint } from "@/services/server";
import axios from "axios";
import { convertTo24hr } from "@/lib/timeUtils";
import { preprocessAttendanceList } from "../attendanceAutoPunchHelper";

// --- Helper Functions (Reusing your exact Excel Logic) ---

const normalizeDate = (rawDate) => {
    if (!rawDate) return null;
    if (rawDate.includes("-") && rawDate.split("-")[0].length === 4) {
        const [y, m, d] = rawDate.split("-");
        return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
    if (rawDate.includes("-") && rawDate.split("-")[2].length === 4) {
        const [d, m, y] = rawDate.split("-");
        return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
    return rawDate;
};

const formatDuration = (mins) => {
    if (!mins || mins <= 0) return "00:00";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const convertTo24Hrs = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return "00:00";
    const parts = timeStr.trim().split(' ');
    if (parts.length < 2) return timeStr;
    const [time, modifier] = parts;
    let [hours, minutes] = time.split(':');
    if (modifier.toUpperCase() === 'PM' && hours !== '12') hours = String(parseInt(hours, 10) + 12);
    if (modifier.toUpperCase() === 'AM' && hours === '12') hours = '00';
    return `${hours.padStart(2, '0')}:${minutes}`;
};

const calculateShiftHours = (shiftFrom, shiftTo) => {
    if (!shiftFrom || !shiftTo) return 0;
    const baseDate = "1970-01-01";
    const start = new Date(`${baseDate}T${shiftFrom}`);
    const end = new Date(`${baseDate}T${shiftTo}`);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    let diffMs = end - start;
    if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000; // Handle overnight
    return Math.floor(diffMs / 1000 / 60);
};

const getStatus = (attn) => {
    if (!attn) return "-";
    if (attn.in_time !== null) {
        if (attn.half_day || attn.calculated_half_day) return "P(HF)";
        if (attn.holiday) return "P(HO)";
        if (attn.week_off) return "P(WO)";
        return "P";
    }
    if (attn.leave) return "L";
    if (attn.absent) return "A";
    if (attn.holiday) return "HO";
    if (attn.week_off) return "WO";
    return "-";
};

const getAttendanceSummary = (attendanceData, emp) => {
    const summary = { Present: 0, Absent: 0, HalfDay: 0, PaidLeave: 0, Holiday: 0, WeekOff: 0, WorkMins: 0, OTMins: 0, ShortMins: 0 };
    const processedDates = new Map();

    attendanceData?.forEach(entry => {
        const dateKey = normalizeDate(entry.date);
        if (!dateKey || processedDates.has(dateKey)) return;
        processedDates.set(dateKey, true);

        const isOutSystem = entry?.out_time?.made_by === "system";
        const workMins = isOutSystem ? 0 : (entry.total_work_duration || 0);
        const shiftMins = entry.in_time?.shift_id
            ? calculateShiftHours(entry.in_time.shift_id.shift_from, entry.in_time.shift_id.shift_to)
            : 0;

        if (entry.in_time !== null) {
            summary.Present += 1;
            if (entry.half_day || entry.calculated_half_day) summary.HalfDay += 1;
            if (entry.week_off === true) {
                summary.WeekOff += 1;
            }
            // Holiday (but not week off)
            if (entry.holiday === true) {
                summary.Holiday += 1;
            }
            summary.WorkMins += workMins;

            if (workMins > 0 && shiftMins > 0) {
                const diff = workMins - shiftMins;
                if (diff > 0 && emp.applicable_for_overtime) summary.OTMins += diff;
                else if (diff < 0) summary.ShortMins += Math.abs(diff);
            }
        }
        else if (entry.week_off === true) {
            summary.WeekOff += 1;
        }
        // Holiday (but not week off)
        else if (entry.holiday === true) {
            summary.Holiday += 1;
        }

        // Leave
        else if (entry.leave === true) {
            summary.PaidLeave += 1;
        }
        // Absent
        else if (entry.absent === true) {
            summary.Absent += 1;
        }
    });
    return summary;
};

// --- Main PDF Function ---

export const downloadAttendanceTrackerPDF = async (user, year, month, employeeList, firm_id, firmName, branch, department, selectedEmployeeIds, firmLogo) => {
    let ACTIVE_URL = user?.firm_id?.firm_server_url;
    const firmLogoURL = `${ATTENDANCE_SERVER_URL}/assets/${firmLogo}`;

    const numYear = Number(year);
    const numMonth = Number(month);
    const formattedMonth = String(numMonth).padStart(2, "0");

    try {
        let allData;
        if (ACTIVE_URL) {
            try {
                const res = await axios.get(`${ACTIVE_URL}/api/all_employee_attendance/${numYear}-${formattedMonth}/${firm_id}`);
                allData = res?.data;
            } catch (err) {
                console.warn("ACTIVE_URL fetch failed:", err);
            }
        }
        if (!allData?.results) {
            try {
                allData = await rdk.request(customEndpoint({
                    path: `api/all_employee_attendance/${numYear}-${formattedMonth}/${firm_id}`,
                    method: "GET",
                }));
            } catch (err) {
                console.warn("rdk customEndpoint fetch failed:", err);
                if (ATTENDANCE_SERVER_URL) {
                    const res = await axios.get(`${ATTENDANCE_SERVER_URL}/api/all_employee_attendance/${numYear}-${formattedMonth}/${firm_id}`);
                    allData = res?.data;
                }
            }
        }

        const results = allData?.results || allData?.data?.results || [];
        if (!results || results.length === 0) {
            throw new Error("Invalid or empty attendance data received");
        }

        const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
        const daysInMonth = new Date(numYear, numMonth, 0).getDate();
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;

        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const monthString = monthNames[numMonth - 1] || month;

        // Header renderer for each sheet/page
        const drawHeader = (startYPos = 15) => {
            if (firmLogo) {
                try {
                    doc.addImage(firmLogoURL, "PNG", 15, startYPos, 20, 20);
                } catch (logoErr) {
                    console.warn("Logo load error:", logoErr);
                }
            }

            doc.setFontSize(16);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(0);
            doc.text(firmName || "Company Name", 40, startYPos + 12);

            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.setFont(undefined, 'italic');
            doc.setTextColor(0);
            doc.text(`Detailed Attendance Report`, pageWidth - 15, startYPos + 12, { align: "right" });

            doc.setFontSize(12);
            doc.setFont(undefined, 'italic');
            doc.setTextColor(100);
            doc.text(`${monthString}, ${numYear}`, pageWidth - 15, startYPos + 18, { align: "right" });

            return startYPos + 25;
        };

        // Normalizing employee list
        let employeeListArray = Array.isArray(employeeList)
            ? [...employeeList]
            : (Array.isArray(employeeList?.employees) ? [...employeeList.employees] : []);

        if (employeeListArray.length === 0 && results.length > 0) {
            employeeListArray = results.map(r => r.employee).filter(Boolean);
        }

        if (selectedEmployeeIds?.length > 0) {
            employeeListArray = employeeListArray.filter(emp => selectedEmployeeIds.includes(emp.id));
        }

        const validEmployees = employeeListArray.filter(emp => {
            const empDeptName = emp?.employee_category_id?.employee_category_name;
            if (department && department !== "All" && empDeptName !== department) return false;
            const empAttendance = results.find(s => s.employee?.id === emp.id);
            return !!empAttendance;
        });

        if (validEmployees.length === 0) {
            throw new Error("No employee matched the selection");
        }

        let startY = drawHeader(15);
        let employeeCountOnPage = 0;

        for (const emp of validEmployees) {
            const empDeptName = emp?.employee_category_id?.employee_category_name;
            const empAttendance = results.find(s => s.employee?.id === emp.id);

            // Exactly 2 employees per sheet/page
            if (employeeCountOnPage === 2) {
                doc.addPage();
                startY = drawHeader(15);
                employeeCountOnPage = 0;
            }

            const empCountry = emp?.country || "IN";
            preprocessAttendanceList(empAttendance.attendances);
            const summary = getAttendanceSummary(empAttendance.attendances, emp);
            const attendanceMap = new Map();
            empAttendance.attendances.forEach(a => attendanceMap.set(normalizeDate(a.date), a));

            // 1. Employee Header
            doc.setFillColor(240, 240, 240);
            doc.rect(14, startY, pageWidth - 28, 12, 'F');
            doc.setFontSize(12).setFont(undefined, 'bold').setTextColor(0);
            doc.text(`EmpCode: ${emp.employee_code || "N/A"} | Name: ${emp.first_name || "N/A"} ${emp.last_name || "N/A"}`, 18, startY + 8);
            doc.setFontSize(10).setFont(undefined, 'normal');
            doc.text(`Dept: ${empDeptName || "N/A"} | Desig: ${emp.title || "N/A"}`, 220, startY + 8);
            startY += 14;

            // 2. Summary Totals Table
            autoTable(doc, {
                startY: startY,
                head: [['Present', 'Holiday', 'WeekOff', 'Halfday', 'Absent', 'PaidDay', 'WorkHrs', 'ShortHrs', 'OT Hrs']],
                body: [[
                    summary.Present - summary.HalfDay,
                    summary.Holiday,
                    summary.WeekOff,
                    summary.HalfDay,
                    summary.Absent,
                    summary.Present - (summary.HalfDay / 2),
                    formatDuration(summary.WorkMins),
                    formatDuration(summary.ShortMins),
                    emp.applicable_for_overtime ? formatDuration(summary.OTMins) : "00:00"
                ]],
                theme: 'grid',
                styles: { fontSize: 10, halign: 'center' },
                headStyles: { fillColor: [71, 71, 71] },
                margin: { left: 14, bottom: 20 } // Ensure space for footer
            });
            startY = doc.lastAutoTable.finalY + 3;

            // 3. Daily Grid
            const dayHeaders = ["Label", ...Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString())];
            const rows = ["IN Time", "OUT Time", "Shift From", "Shift To", "Working", "Short hrs.", "O.Times", "Status"].map(label => {
                const row = [label];
                for (let i = 1; i <= daysInMonth; i++) {
                    const dateStr = `${numYear}-${formattedMonth}-${String(i).padStart(2, "0")}`;
                    const attn = attendanceMap.get(dateStr);
                    if (!attn) { row.push("-"); continue; }
                    const isOutSystem = attn?.out_time?.made_by === "system";
                    const workMins = isOutSystem ? 0 : (attn.total_work_duration || 0);
                    const shiftMins = attn.in_time?.shift_id ? calculateShiftHours(attn.in_time.shift_id.shift_from, attn.in_time.shift_id.shift_to) : 0;

                    const ApplicableDurationForOt = emp?.overtime_hours * 60 + emp?.overtime_minutes;

                    switch (label) {
                        case "IN Time": row.push(convertTo24hr(attn.in_formatted_time, empCountry)); break;
                        case "OUT Time": row.push(isOutSystem ? "-" : convertTo24hr(attn.out_formatted_time, empCountry) || "-"); break;
                        case "Shift From": row.push(attn.in_time?.shift_id?.shift_from?.slice(0, 5) || "-"); break;
                        case "Shift To": row.push(attn.in_time?.shift_id?.shift_to?.slice(0, 5) || "-"); break;
                        case "Working": row.push(isOutSystem ? "-" : (attn?.total_work_duration ? formatDuration(attn?.total_work_duration) : "-")); break;
                        case "Short hrs.": row.push((workMins > 0 && workMins < shiftMins) ? formatDuration(shiftMins - workMins) : "-"); break;
                        case "O.Times": row.push((emp.applicable_for_overtime && workMins > ApplicableDurationForOt) ? formatDuration(workMins - ApplicableDurationForOt) : "-"); break;
                        case "Status": row.push(getStatus(attn)); break;
                    }
                }
                return row;
            });

            autoTable(doc, {
                startY: startY,
                head: [dayHeaders],
                body: rows,
                theme: 'grid',
                styles: { fontSize: 9, cellPadding: 1, halign: 'center' },
                columnStyles: { 0: { fontStyle: 'bold', fillColor: [245, 245, 245], width: 25 } },
                headStyles: { fillColor: [200, 200, 200], textColor: 0 },
                didParseCell: (data) => {
                    if (data.row.index === 7 && data.section === 'body' && data.column.index > 0) {
                        const val = data.cell.raw;
                        if (val === 'P') data.cell.styles.fillColor = [198, 239, 206];
                        if (val === 'A') data.cell.styles.fillColor = [255, 199, 206];
                        if (['WO', 'HO'].includes(val)) data.cell.styles.fillColor = [217, 217, 217];
                    }
                },
                margin: { left: 14, bottom: 20 }
            });

            startY = doc.lastAutoTable.finalY + 10;
            employeeCountOnPage++;
        }

        // === FOOTER LOGIC ===
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(100);

            // Footer line for visual separation
            doc.setDrawColor(200);
            doc.line(14, pageHeight - 25, pageWidth - 14, pageHeight - 25);

            // Right side: Page X of Y
            const pageText = `Page: ${i} of ${totalPages}`;
            const textWidth = doc.getTextWidth(pageText);
            doc.text(pageText, pageWidth - textWidth - 14, pageHeight - 10);
        }

        const blobUrl = doc.output("bloburl");
        return blobUrl;
    } catch (error) {
        console.error("PDF Export Error", error);
        throw error;
    }
};

// Helper: Get all months in a date range (YYYY-MM)
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

// Helper: Standardize attendance entry date directly in YYYY-MM-DD
const getStandardizedDate = (att, year, month, index) => {
    if (att?.date) {
        const rawDate = att.date;
        if (rawDate.includes("-") || rawDate.includes("/")) {
            const parts = rawDate.split(/[-/]/);
            if (parts.length === 3) {
                if (parts[0].length === 4) {
                    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                } else if (parts[2].length === 4) {
                    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
            }
        }
        const d = new Date(rawDate);
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

// --- Main PDF Function for Custom Date Range (Max 31 Days) ---
export const downloadAttendanceTrackerPDFWithDateRange = async (
    user,
    startDate,
    endDate,
    employeeList,
    firm_id,
    firmName,
    branch,
    department,
    selectedEmployeeIds,
    firmLogo
) => {
    let sDate = startDate;
    let eDate = endDate;
    if (startDate && typeof startDate === "object" && startDate.start && !endDate) {
        sDate = startDate.start;
        eDate = startDate.end;
    }

    if (!sDate || !eDate) {
        alert("Please select both start and end date.");
        return null;
    }

    const start = new Date(sDate);
    const end = new Date(eDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const diffTime = end.getTime() - start.getTime();
    const totalDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;

    if (totalDays <= 0) {
        alert("Invalid date range selected. Start date must be before or equal to End date.");
        return null;
    }

    if (totalDays > 31) {
        alert("Please select a date range of up to 31 days only.");
        return null;
    }

    const dateList = [];
    let curr = new Date(start);
    while (curr <= end) {
        const y = curr.getFullYear();
        const m = String(curr.getMonth() + 1).padStart(2, "0");
        const d = String(curr.getDate()).padStart(2, "0");
        dateList.push(`${y}-${m}-${d}`);
        curr.setDate(curr.getDate() + 1);
    }

    const displayStart = `${String(start.getDate()).padStart(2, "0")}-${String(start.getMonth() + 1).padStart(2, "0")}-${start.getFullYear()}`;
    const displayEnd = `${String(end.getDate()).padStart(2, "0")}-${String(end.getMonth() + 1).padStart(2, "0")}-${end.getFullYear()}`;

    let ACTIVE_URL = user?.firm_id?.firm_server_url;
    const firmLogoURL = `${ATTENDANCE_SERVER_URL}/assets/${firmLogo}`;
    const monthsToFetch = getMonthsInRange(start, end);

    try {
        const fetchPromises = monthsToFetch.map(async (yearMonth) => {
            let data = null;
            if (ACTIVE_URL) {
                try {
                    const res = await axios.get(`${ACTIVE_URL}/api/all_employee_attendance/${yearMonth}/${firm_id}`);
                    data = res?.data;
                } catch (err) {
                    console.warn(`ACTIVE_URL fetch failed for ${yearMonth}:`, err);
                }
            }
            if (!data?.results) {
                try {
                    data = await rdk.request(customEndpoint({
                        path: `api/all_employee_attendance/${yearMonth}/${firm_id}`,
                        method: "GET",
                    }));
                } catch (err) {
                    console.warn(`rdk customEndpoint fetch failed for ${yearMonth}:`, err);
                    if (ATTENDANCE_SERVER_URL) {
                        const res = await axios.get(`${ATTENDANCE_SERVER_URL}/api/all_employee_attendance/${yearMonth}/${firm_id}`);
                        data = res?.data;
                    }
                }
            }
            return {
                yearMonth,
                results: data?.results || data?.data?.results || []
            };
        });

        const monthResponses = await Promise.all(fetchPromises);

        const mergedEmployeeData = new Map();
        for (const { yearMonth, results: monthResults } of monthResponses) {
            const [fetchedYear, fetchedMonth] = yearMonth.split('-').map(Number);
            for (const item of monthResults) {
                if (!item.employee) continue;
                if (selectedEmployeeIds?.length > 0 && !selectedEmployeeIds.includes(item.employee.id)) continue;

                if (!mergedEmployeeData.has(item.employee.id)) {
                    mergedEmployeeData.set(item.employee.id, {
                        employee: item.employee,
                        attendances: []
                    });
                }

                const empRecord = mergedEmployeeData.get(item.employee.id);
                (item.attendances || []).forEach((att, index) => {
                    const calculatedDate = getStandardizedDate(att, fetchedYear, fetchedMonth, index);
                    att.date = calculatedDate;
                    empRecord.attendances.push(att);
                });
            }
        }

        const results = Array.from(mergedEmployeeData.values());
        if (results.length === 0) {
            alert("No attendance data found for the selected employees in this date range.");
            return null;
        }

        const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;

        const isSingleMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();

        // Header renderer for each sheet/page
        const drawHeader = (startYPos = 15) => {
            if (firmLogo) {
                try {
                    doc.addImage(firmLogoURL, "PNG", 15, startYPos, 20, 20);
                } catch (logoErr) {
                    console.warn("Logo load error:", logoErr);
                }
            }

            doc.setFontSize(16);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(0);
            doc.text(firmName || user?.firm_id?.firm_name || "Company Name", 40, startYPos + 12);

            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.setFont(undefined, 'italic');
            doc.setTextColor(0);
            doc.text(`Detailed Attendance Report`, pageWidth - 15, startYPos + 12, { align: "right" });

            doc.setFontSize(12);
            doc.setFont(undefined, 'italic');
            doc.setTextColor(100);
            doc.text(`Report Date: ${displayStart} to ${displayEnd}`, pageWidth - 15, startYPos + 18, { align: "right" });

            return startYPos + 25;
        };

        let employeeListArray = Array.isArray(employeeList)
            ? [...employeeList]
            : (Array.isArray(employeeList?.employees) ? [...employeeList.employees] : []);

        if (employeeListArray.length === 0 && results.length > 0) {
            employeeListArray = results.map(r => r.employee).filter(Boolean);
        }

        if (selectedEmployeeIds?.length > 0) {
            employeeListArray = employeeListArray.filter(emp => selectedEmployeeIds.includes(emp.id));
        }

        const validEmployees = employeeListArray.filter(emp => {
            const empDeptName = emp?.employee_category_id?.employee_category_name;
            if (department && department !== "All" && empDeptName !== department) return false;
            const empAttendance = results.find(s => s.employee?.id === emp.id);
            return !!empAttendance;
        });

        if (validEmployees.length === 0) {
            alert("No employee matched the selection");
            return null;
        }

        let startY = drawHeader(15);
        let employeeCountOnPage = 0;

        for (const emp of validEmployees) {
            const empDeptName = emp?.employee_category_id?.employee_category_name;
            const empAttendance = results.find(s => s.employee?.id === emp.id);

            // Exactly 2 employees per sheet/page
            if (employeeCountOnPage === 2) {
                doc.addPage();
                startY = drawHeader(15);
                employeeCountOnPage = 0;
            }

            const empCountry = emp?.country || "IN";
            preprocessAttendanceList(empAttendance.attendances);

            const attendanceMap = new Map();
            empAttendance.attendances.forEach(a => attendanceMap.set(normalizeDate(a.date), a));

            const rangeEntries = dateList.map(d => attendanceMap.get(d)).filter(Boolean);
            const summary = getAttendanceSummary(rangeEntries, emp);

            // 1. Employee Header
            doc.setFillColor(240, 240, 240);
            doc.rect(14, startY, pageWidth - 28, 12, 'F');
            doc.setFontSize(12).setFont(undefined, 'bold').setTextColor(0);
            doc.text(`EmpCode: ${emp.employee_code || "N/A"} | Name: ${emp.first_name || "N/A"} ${emp.last_name || "N/A"}`, 18, startY + 8);
            doc.setFontSize(10).setFont(undefined, 'normal');
            doc.text(`Dept: ${empDeptName || "N/A"} | Desig: ${emp.title || "N/A"}`, 220, startY + 8);
            startY += 14;

            // 2. Summary Totals Table
            autoTable(doc, {
                startY: startY,
                head: [['Present', 'Holiday', 'WeekOff', 'Halfday', 'Absent', 'PaidDay', 'WorkHrs', 'ShortHrs', 'OT Hrs']],
                body: [[
                    summary.Present - summary.HalfDay,
                    summary.Holiday,
                    summary.WeekOff,
                    summary.HalfDay,
                    summary.Absent,
                    summary.Present - (summary.HalfDay / 2),
                    formatDuration(summary.WorkMins),
                    formatDuration(summary.ShortMins),
                    emp.applicable_for_overtime ? formatDuration(summary.OTMins) : "00:00"
                ]],
                theme: 'grid',
                styles: { fontSize: 10, halign: 'center' },
                headStyles: { fillColor: [71, 71, 71] },
                margin: { left: 14, bottom: 20 }
            });
            startY = doc.lastAutoTable.finalY + 3;

            // 3. Daily Grid
            const dayHeaders = ["Label", ...dateList.map(dStr => {
                const parts = dStr.split("-");
                return isSingleMonth ? Number(parts[2]).toString() : `${Number(parts[2])}/${Number(parts[1])}`;
            })];

            const rows = ["IN Time", "OUT Time", "Shift From", "Shift To", "Working", "Short hrs.", "O.Times", "Status"].map(label => {
                const row = [label];
                for (const dateStr of dateList) {
                    const attn = attendanceMap.get(dateStr);
                    if (!attn) { row.push("-"); continue; }
                    const isOutSystem = attn?.out_time?.made_by === "system";
                    const workMins = isOutSystem ? 0 : (attn.total_work_duration || 0);
                    const shiftMins = attn.in_time?.shift_id ? calculateShiftHours(attn.in_time.shift_id.shift_from, attn.in_time.shift_id.shift_to) : 0;
                    const ApplicableDurationForOt = (emp?.overtime_hours || 0) * 60 + (emp?.overtime_minutes || 0);

                    switch (label) {
                        case "IN Time": row.push(convertTo24hr(attn.in_formatted_time, empCountry) || "-"); break;
                        case "OUT Time": row.push(isOutSystem ? "-" : convertTo24hr(attn.out_formatted_time, empCountry) || "-"); break;
                        case "Shift From": row.push(attn.in_time?.shift_id?.shift_from?.slice(0, 5) || "-"); break;
                        case "Shift To": row.push(attn.in_time?.shift_id?.shift_to?.slice(0, 5) || "-"); break;
                        case "Working": row.push(isOutSystem ? "-" : (attn?.total_work_duration ? formatDuration(attn?.total_work_duration) : "-")); break;
                        case "Short hrs.": row.push((workMins > 0 && workMins < shiftMins) ? formatDuration(shiftMins - workMins) : "-"); break;
                        case "O.Times": row.push((emp.applicable_for_overtime && workMins > ApplicableDurationForOt) ? formatDuration(workMins - ApplicableDurationForOt) : "-"); break;
                        case "Status": row.push(getStatus(attn)); break;
                    }
                }
                return row;
            });

            autoTable(doc, {
                startY: startY,
                head: [dayHeaders],
                body: rows,
                theme: 'grid',
                styles: { fontSize: 9, cellPadding: 1, halign: 'center' },
                columnStyles: { 0: { fontStyle: 'bold', fillColor: [245, 245, 245], width: 25 } },
                headStyles: { fillColor: [200, 200, 200], textColor: 0 },
                didParseCell: (data) => {
                    if (data.row.index === 7 && data.section === 'body' && data.column.index > 0) {
                        const val = data.cell.raw;
                        if (val === 'P') data.cell.styles.fillColor = [198, 239, 206];
                        if (val === 'A') data.cell.styles.fillColor = [255, 199, 206];
                        if (['WO', 'HO'].includes(val)) data.cell.styles.fillColor = [217, 217, 217];
                    }
                },
                margin: { left: 14, bottom: 20 }
            });

            startY = doc.lastAutoTable.finalY + 10;
            employeeCountOnPage++;
        }

        // === FOOTER LOGIC ===
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(100);

            doc.setDrawColor(200);
            doc.line(14, pageHeight - 25, pageWidth - 14, pageHeight - 25);

            const pageText = `Page: ${i} of ${totalPages}`;
            const textWidth = doc.getTextWidth(pageText);
            doc.text(pageText, pageWidth - textWidth - 14, pageHeight - 10);
        }

        const blobUrl = doc.output("bloburl");
        return blobUrl;
    } catch (error) {
        console.error("PDF Export Error", error);
        throw error;
    }
};

export const downloadAttendanceTrackerPDFByDateRange = downloadAttendanceTrackerPDFWithDateRange;