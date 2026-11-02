// @ts-nocheck
import ExcelJS from "exceljs";
import axios from "axios";
import { saveAs } from "file-saver";
import { ATTENDANCE_SERVER_URL } from "@/services/server";

// --- Helper Functions ---

const getDaysInMonth = (year, month) => {
    return new Date(year, month, 0).getDate();
};

const getDayName = (year, month, day) => {
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
};

// Create a map of attendance by date for O(1) lookup
const createAttendanceMap = (attendances) => {
    const map = new Map();
    attendances?.forEach((attn) => {
        if (attn.date) map.set(attn.date, attn);
    });
    return map;
};

// Format minutes into "Xh Ym" format
const formatMinutes = (totalMinutes) => {
    if (!totalMinutes || totalMinutes <= 0) return '00:00';
    const hours = Math.floor(totalMinutes / 60);
    const mins = Math.round(totalMinutes % 60);

    if (hours === 0) return `00:${String(mins).padStart(2, '0')}`;
    if (mins === 0) return `${String(hours).padStart(2, '0')}:00`;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

// Calculate Overtime strictly based on shift limit
const getOvertimeCellData = (attendanceData, shiftLimitMinutes) => {
    if (!attendanceData) {
        return { text: '--', color: 'FFFFFF', otMinutes: 0 };
    }

    const isOutSystem = attendanceData?.out_time?.made_by === "system";
    const totalWorkDuration = attendanceData?.total_work_duration || 0;

    // 1. Explicit Absent or Out marked by system => No OT
    if (attendanceData.absent || isOutSystem) {
        return { text: '00:00', color: 'FFFFFF', otMinutes: 0 };
    }

    // 2. Check if total work duration exceeds the shift limit
    if (totalWorkDuration > shiftLimitMinutes) {
        const otMinutes = totalWorkDuration - shiftLimitMinutes;
        return { text: formatMinutes(otMinutes), color: 'E2EFDA', otMinutes: otMinutes }; // Light Green indicates OT
    }

    // 3. Present but worked <= shiftLimitMinutes => No OT
    return { text: '00:00', color: 'FFFFFF', otMinutes: 0 };
};

// Standard cell styler
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

export const downloadOvertimeReportExcel = async (
    year,
    month,
    firm_id,
    firmName,
    selectedEmployeeIds
) => {
    try {
        const formattedMonth = String(month).padStart(2, '0');
        // 1. Fetch Data
        const response = await axios.get(`${ATTENDANCE_SERVER_URL}/api/all_employee_attendance/${year}-${formattedMonth}/${firm_id}`);
        const allData = Array.isArray(response.data) ? response.data : response.data?.results;

        if (!allData || allData.length === 0) {
            alert("No data available for the selected month.");
            return null;
        }

        // 2. FILTER: Only employees applicable for Overtime
        const employeeDataList = allData.filter(record => record.employee?.applicable_for_overtime === true);

        if (employeeDataList.length === 0) {
            alert("No employees found with 'Applicable for Overtime' enabled.");
            return null;
        }

        const filteredEmployeeData = (selectedEmployeeIds && selectedEmployeeIds.length > 0)
            ? employeeDataList.filter(emp => selectedEmployeeIds.includes(emp.employee?.id))
            : employeeDataList;

        if (filteredEmployeeData.length === 0) {
            alert("No selected employees have 'Applicable for Overtime' enabled.");
            return null;
        }

        // 3. Initialize Workbook
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Overtime Report');

        // 4. Month Calculation
        const totalDays = getDaysInMonth(year, month);
        const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });

        const STATIC_COLS_COUNT = 6;
        const totalColumns = STATIC_COLS_COUNT + totalDays + 1; // 6 Static + Days + Total

        // --- HEADER GENERATION ---

        // Row 1: Firm Name (Merged 1 to 6)
        const firmRow = sheet.addRow([`Firm Name: ${firmName}`]);
        sheet.mergeCells(1, 1, 1, STATIC_COLS_COUNT);
        firmRow.getCell(1).font = { bold: true, size: 12 };
        firmRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
        firmRow.height = 25;

        // Row 2: Month (Merged 1 to 6)
        const monthRow = sheet.addRow([`Month: ${monthName} ${year}`]);
        sheet.mergeCells(2, 1, 2, STATIC_COLS_COUNT);
        monthRow.getCell(1).font = { bold: true, size: 11 };
        monthRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

        // Row 3: Total Days (Merged 1 to 6)
        const daysRow = sheet.addRow([`Total Days: ${totalDays}`]);
        sheet.mergeCells(3, 1, 3, STATIC_COLS_COUNT);
        daysRow.getCell(1).font = { bold: true, size: 11 };
        daysRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

        // Row 4: Empty row for spacing
        sheet.addRow([]);

        // Row 5 & 6 Headers Setup
        const r5Values = ['S.No', 'Emp Code', 'Name', 'Designation', 'Category', 'Department'];
        const r6Values = ['', '', '', '', '', ''];

        for (let day = 1; day <= totalDays; day++) {
            const dayName = getDayName(year, month, day);
            r5Values.push(dayName);
            r6Values.push(String(day));
        }

        // Add Total OT Hours Header
        r5Values.push('Total OT Hours');
        r6Values.push('');

        const dayNameRow = sheet.addRow(r5Values); // Row 5
        const dayNumRow = sheet.addRow(r6Values);  // Row 6

        // 5. Header Styling & Merging
        const blueHeaderColor = '4472C4';

        // Merge and Style Static Headers + Total Column
        const staticColsIndices = [];
        for (let i = 1; i <= STATIC_COLS_COUNT; i++) staticColsIndices.push(i);
        staticColsIndices.push(totalColumns);

        staticColsIndices.forEach(colIdx => {
            sheet.mergeCells(5, colIdx, 6, colIdx);
            const cell = dayNameRow.getCell(colIdx);
            styleCell(cell, blueHeaderColor, true);
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        });

        // Day Columns Styling
        for (let i = 0; i < totalDays; i++) {
            const colIdx = STATIC_COLS_COUNT + 1 + i;
            const dayName = r5Values[colIdx - 1];

            // Style Day Name Cell (Row 5)
            const nameCell = dayNameRow.getCell(colIdx);
            styleCell(nameCell, 'FFFFFF', true);
            nameCell.alignment = { textRotation: 90, vertical: 'middle', horizontal: 'center' };

            if (dayName === 'Sun') {
                nameCell.font = { color: { argb: 'FFFF0000' }, bold: true };
            }

            // Style Day Number Cell (Row 6)
            const numCell = dayNumRow.getCell(colIdx);
            styleCell(numCell, blueHeaderColor, true);
            numCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        }

        // 6. Freeze Panes
        sheet.views = [
            { state: 'frozen', xSplit: STATIC_COLS_COUNT, ySplit: 6 }
        ];

        // 7. Widths
        sheet.getColumn(1).width = 6;  // S.No
        sheet.getColumn(2).width = 15; // Code
        sheet.getColumn(3).width = 25; // Name
        sheet.getColumn(4).width = 20; // Desig
        sheet.getColumn(5).width = 20; // Cat
        sheet.getColumn(6).width = 20; // Dept

        for (let i = 0; i < totalDays; i++) {
            sheet.getColumn(STATIC_COLS_COUNT + 1 + i).width = 7.5;
        }
        sheet.getColumn(totalColumns).width = 14;

        // 8. Process Data Rows
        filteredEmployeeData.forEach((record, index) => {
            const emp = record.employee;
            const attendances = record.attendances;
            const attendanceMap = createAttendanceMap(attendances);

            // Fetch dynamic shift duration limit in minutes (default to 480 mins / 8 hrs if missing)
            const shiftLimitMinutes = emp?.shift_ids?.[0]?.working_hours 
                ? Number(emp.shift_ids[0].working_hours) * 60 
                : 480;

            const rowValues = [
                index + 1,
                emp?.employee_code || '--',
                `${emp?.first_name || ''} ${emp?.last_name || ''}`.trim(),
                emp?.title || '--',
                emp?.employee_category_id?.employee_category_name || '--',
                emp?.department_name || '--'
            ];

            let sumOtMins = 0;

            // Populate Days
            for (let day = 1; day <= totalDays; day++) {
                const dateKey = `${String(day).padStart(2, '0')}-${formattedMonth}-${year}`;
                const dayData = attendanceMap.get(dateKey);
                const { text, otMinutes } = getOvertimeCellData(dayData, shiftLimitMinutes);

                rowValues.push(text);
                sumOtMins += otMinutes || 0;
            }

            // Push formatted accumulated OT
            rowValues.push(formatMinutes(sumOtMins));

            // Add to Sheet
            const addedRow = sheet.addRow(rowValues);

            // Apply Styles
            for (let c = 1; c <= STATIC_COLS_COUNT; c++) {
                styleCell(addedRow.getCell(c), 'FFFFFF');
            }

            for (let day = 1; day <= totalDays; day++) {
                const dateKey = `${String(day).padStart(2, '0')}-${formattedMonth}-${year}`;
                const dayData = attendanceMap.get(dateKey);
                const { color } = getOvertimeCellData(dayData, shiftLimitMinutes);

                styleCell(addedRow.getCell(STATIC_COLS_COUNT + day), color);
            }
            styleCell(addedRow.getCell(totalColumns), 'FFFFFF', true);
        });

        // 9. Download
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const fileName = `${firmName || 'Report'}_Overtime_${monthName}_${year}.xlsx`;
        
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
        console.error("Error generating Overtime Report:", error);
        alert(`Failed to generate Overtime Report: ${error?.message || error}`);
        return null;
    }
};
