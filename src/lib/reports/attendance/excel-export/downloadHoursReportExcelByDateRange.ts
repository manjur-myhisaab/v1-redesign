// @ts-nocheck
import ExcelJS from "exceljs";
import axios from "axios";
import { saveAs } from "file-saver";
import { ATTENDANCE_SERVER_URL } from "@/services/server";

// --- Helper Functions ---

const getDatesInRange = (startDate, endDate) => {
    const dates = [];
    let curr = new Date(startDate);
    while (curr <= endDate) {
        dates.push(new Date(curr));
        curr.setDate(curr.getDate() + 1);
    }
    return dates;
};

const getMonthsInRange = (startDate, endDate) => {
    const months = [];
    let curr = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    while (curr <= end) {
        const y = curr.getFullYear();
        const m = String(curr.getMonth() + 1).padStart(2, '0');
        months.push(`${y}-${m}`);
        curr.setMonth(curr.getMonth() + 1);
    }
    return months;
};

const formatDateKey = (date) => {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
};

const createAttendanceMap = (attendances) => {
    const map = new Map();
    attendances?.forEach((attn) => {
        if (attn.date) map.set(attn.date, attn);
    });
    return map;
};

const formatMinutes = (totalMinutes) => {
    if (!totalMinutes || totalMinutes <= 0) return '00:00';
    const hours = Math.floor(totalMinutes / 60);
    const mins = Math.round(totalMinutes % 60);

    if (hours === 0) return `00:${String(mins).padStart(2, '0')}`;
    if (mins === 0) return `${String(hours).padStart(2, '0')}:00`;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const getCellData = (attendanceData) => {
    if (!attendanceData) {
        return { text: '--', color: 'FFFFFF', rawMins: 0 };
    }

    const isOutSystem = attendanceData?.out_time?.made_by === "system";
    if (!isOutSystem && (attendanceData.total_work_duration > 0 || (attendanceData.in_time && attendanceData.out_time))) {
        const mins = attendanceData.total_work_duration || 0;
        return {
            text: mins > 0 ? formatMinutes(mins) : '00:00',
            color: 'E2EFDA',
            rawMins: mins
        };
    }

    if (attendanceData.holiday) return { text: 'HO', color: 'FCE4D6', rawMins: 0 };
    if (attendanceData.week_off) return { text: 'WO', color: 'FFF2CC', rawMins: 0 };
    if (attendanceData.leave) return { text: 'L', color: 'D9E1F2', rawMins: 0 };
    if (attendanceData.absent) return { text: 'A', color: 'FFC7CE', rawMins: 0 };

    return { text: '--', color: 'FFFFFF', rawMins: 0 };
};

const styleCell = (cell, colorHex, isBold = false) => {
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
    };
    cell.font = { name: 'Calibri', size: 10, bold: isBold };

    if (colorHex && colorHex !== 'FFFFFF') {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF' + colorHex }
        };
    }
};

// --- Main Function ---

export const downloadHoursReportExcelByDateRange = async (
    dateRange,
    firm_id,
    firmName,
    selectedEmployeeIds
) => {
    if (!selectedEmployeeIds || selectedEmployeeIds.length === 0) {
        alert("Please select at least one employee");
        return null;
    }

    try {
        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);

        const displayStartDate = startDate.toLocaleDateString("en-GB");
        const displayEndDate = endDate.toLocaleDateString("en-GB");

        const datesList = getDatesInRange(startDate, endDate);
        const totalDays = datesList.length;

        const monthsToFetch = getMonthsInRange(startDate, endDate);
        const apiCalls = monthsToFetch.map((yearMonth) =>
            axios.get(`${ATTENDANCE_SERVER_URL}/api/all_employee_attendance/${yearMonth}/${firm_id}`)
        );
        const responses = await Promise.all(apiCalls);

        const mergedEmployeeDataMap = new Map();

        for (let i = 0; i < responses.length; i++) {
            const results = Array.isArray(responses[i].data) ? responses[i].data : responses[i].data?.results || [];

            for (const item of results) {
                if (!selectedEmployeeIds.includes(item.employee?.id)) continue;

                if (!mergedEmployeeDataMap.has(item.employee.id)) {
                    mergedEmployeeDataMap.set(item.employee.id, {
                        employee: item.employee,
                        attendances: [],
                    });
                }

                mergedEmployeeDataMap.get(item.employee.id).attendances.push(...(item.attendances || []));
            }
        }

        const filteredEmployeeData = Array.from(mergedEmployeeDataMap.values());

        if (!filteredEmployeeData || filteredEmployeeData.length === 0) {
            alert("No data available for the selected date range.");
            return null;
        }

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Hours Report');

        const STATIC_COLS_COUNT = 6;
        const totalColumns = STATIC_COLS_COUNT + totalDays + 1;

        const firmRow = sheet.addRow([`Firm Name: ${firmName}`]);
        sheet.mergeCells(1, 1, 1, STATIC_COLS_COUNT);
        firmRow.getCell(1).font = { bold: true, size: 12 };
        firmRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
        firmRow.height = 25;

        const rangeRow = sheet.addRow([`Date Range: ${displayStartDate} to ${displayEndDate}`]);
        sheet.mergeCells(2, 1, 2, STATIC_COLS_COUNT);
        rangeRow.getCell(1).font = { bold: true, size: 11 };
        rangeRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

        const daysRow = sheet.addRow([`Total Days: ${totalDays}`]);
        sheet.mergeCells(3, 1, 3, STATIC_COLS_COUNT);
        daysRow.getCell(1).font = { bold: true, size: 11 };
        daysRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

        sheet.addRow([]);

        const r5Values = ['S.No', 'Emp Code', 'Name', 'Designation', 'Category', 'Department'];
        const r6Values = ['', '', '', '', '', ''];

        datesList.forEach(d => {
            const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
            const dayNum = d.getDate();
            r5Values.push(dayName);
            r6Values.push(String(dayNum));
        });

        r5Values.push('Total Hours');
        r6Values.push('');

        const dayNameRow = sheet.addRow(r5Values);
        const dayNumRow = sheet.addRow(r6Values);

        const blueHeaderColor = '4472C4';

        const staticColsIndices = [];
        for (let i = 1; i <= STATIC_COLS_COUNT; i++) staticColsIndices.push(i);
        staticColsIndices.push(totalColumns);

        staticColsIndices.forEach(colIdx => {
            sheet.mergeCells(5, colIdx, 6, colIdx);
            const cell = dayNameRow.getCell(colIdx);
            styleCell(cell, blueHeaderColor, true);
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        });

        for (let i = 0; i < totalDays; i++) {
            const colIdx = STATIC_COLS_COUNT + 1 + i;
            const dayName = r5Values[colIdx - 1];

            const nameCell = dayNameRow.getCell(colIdx);
            styleCell(nameCell, 'FFFFFF', true);
            nameCell.alignment = { textRotation: 90, vertical: 'middle', horizontal: 'center' };

            if (dayName === 'Sun') {
                nameCell.font = { color: { argb: 'FFFF0000' }, bold: true };
            }

            const numCell = dayNumRow.getCell(colIdx);
            styleCell(numCell, blueHeaderColor, true);
            numCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        }

        sheet.views = [
            { state: 'frozen', xSplit: STATIC_COLS_COUNT, ySplit: 6 }
        ];

        sheet.getColumn(1).width = 6;
        sheet.getColumn(2).width = 15;
        sheet.getColumn(3).width = 25;
        sheet.getColumn(4).width = 20;
        sheet.getColumn(5).width = 20;
        sheet.getColumn(6).width = 20;

        for (let i = 0; i < totalDays; i++) {
            sheet.getColumn(STATIC_COLS_COUNT + 1 + i).width = 7.5;
        }
        sheet.getColumn(totalColumns).width = 12;

        filteredEmployeeData.forEach((record, index) => {
            const emp = record.employee;
            const attendances = record.attendances;
            const attendanceMap = createAttendanceMap(attendances);

            const rowValues = [
                index + 1,
                emp?.employee_code || '--',
                `${emp?.first_name || ''} ${emp?.last_name || ''}`.trim(),
                emp?.title || '--',
                emp?.employee_category_id?.employee_category_name || '--',
                emp?.department_name || '--'
            ];

            let sumMins = 0;

            datesList.forEach(d => {
                const dateKey = formatDateKey(d);
                const dayData = attendanceMap.get(dateKey);
                const { text, rawMins } = getCellData(dayData);

                rowValues.push(text);
                sumMins += rawMins || 0;
            });

            rowValues.push(formatMinutes(sumMins));

            const addedRow = sheet.addRow(rowValues);

            for (let c = 1; c <= STATIC_COLS_COUNT; c++) {
                styleCell(addedRow.getCell(c), 'FFFFFF');
            }

            for (let day = 1; day <= totalDays; day++) {
                const d = datesList[day - 1];
                const dateKey = formatDateKey(d);
                const dayData = attendanceMap.get(dateKey);
                const { color } = getCellData(dayData);

                styleCell(addedRow.getCell(STATIC_COLS_COUNT + day), color);
            }

            styleCell(addedRow.getCell(totalColumns), 'FFFFFF', true);
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const safeName = (firmName || 'Report').replace(/[^a-z0-9]/gi, '_');
        const fileName = `${safeName}_Hours_${displayStartDate.replace(/\//g, '-')}_to_${displayEndDate.replace(/\//g, '-')}.xlsx`;
        
        try {
            saveAs(blob, fileName);
        } catch {
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        return true;

    } catch (error) {
        console.error("Error generating Hours Report:", error);
        alert(`Failed to generate Hours Report: ${error?.message || error}`);
        return null;
    }
};
