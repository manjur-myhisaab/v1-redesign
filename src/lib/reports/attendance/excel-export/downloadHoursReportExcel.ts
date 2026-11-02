// @ts-nocheck
import ExcelJS from "exceljs";
import axios from "axios";
import { saveAs } from "file-saver";
import { ATTENDANCE_SERVER_URL } from "@/services/server";

// --- Helper Functions ---

const getDaysInMonth = (year, month) => {
    // month is 1-based (1=Jan). Date(year, month, 0) gives last day of specific month
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

// Convert minutes to "Xh Ym" format
const formatMinutes = (totalMinutes) => {
    if (!totalMinutes || totalMinutes <= 0) return '00:00';
    const hours = Math.floor(totalMinutes / 60);
    const mins = Math.round(totalMinutes % 60);
    
    if (hours === 0) return `00:${String(mins).padStart(2, '0')}`;
    if (mins === 0) return `${String(hours).padStart(2, '0')}:00`;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

// Determine cell content and color based on priority
const getCellData = (attendanceData) => {
    if (!attendanceData) {
        return { text: '--', color: 'FFFFFF', rawMins: 0 };
    }

    // 1. Hours (Present)
    const isOutSystem = attendanceData?.out_time?.made_by === "system";
    if (!isOutSystem && (attendanceData.total_work_duration > 0 || (attendanceData.in_time && attendanceData.out_time))) {
        const mins = attendanceData.total_work_duration || 0;
        return { 
            text: mins > 0 ? formatMinutes(mins) : '00:00', 
            color: 'E2EFDA', // Light Green
            rawMins: mins // Return raw minutes for accurate total calculation
        }; 
    }

    // 2. Status Flags
    if (attendanceData.holiday) return { text: 'HO', color: 'FCE4D6', rawMins: 0 }; // Orange
    if (attendanceData.week_off) return { text: 'WO', color: 'FFF2CC', rawMins: 0 }; // Yellow
    if (attendanceData.leave) return { text: 'L', color: 'D9E1F2', rawMins: 0 };    // Blue
    if (attendanceData.absent) return { text: 'A', color: 'FFC7CE', rawMins: 0 };   // Red

    return { text: '--', color: 'FFFFFF', rawMins: 0 };
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

export const downloadHoursReportExcel = async (
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
        const employeeDataList = Array.isArray(response.data) ? response.data : response.data?.results;

        if (!employeeDataList || employeeDataList.length === 0) {
            alert("No data available for the selected month.");
            return null;
        }

        const filteredEmployeeData = (selectedEmployeeIds && selectedEmployeeIds.length > 0)
            ? employeeDataList.filter(emp => selectedEmployeeIds.includes(emp.employee?.id))
            : employeeDataList;

        // 2. Initialize Workbook
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Hours Report');

        // 3. Constants & Calculations
        const totalDays = getDaysInMonth(year, month);
        const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });

        const STATIC_COLS_COUNT = 6;
        const totalColumns = STATIC_COLS_COUNT + totalDays + 1; // Static + Days + Total Column

        // 4. Row 1: Firm Name (Merged 1 to 6 only - Left Side)
        const firmRow = sheet.addRow([`Firm Name: ${firmName}`]);
        sheet.mergeCells(1, 1, 1, STATIC_COLS_COUNT);
        firmRow.getCell(1).font = { bold: true, size: 12 };
        firmRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
        firmRow.height = 25;

        // Row 2: Month (Merged 1 to 6 only - Left Side)
        const monthRow = sheet.addRow([`Month: ${monthName} ${year}`]);
        sheet.mergeCells(2, 1, 2, STATIC_COLS_COUNT);
        monthRow.getCell(1).font = { bold: true, size: 11 };
        monthRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

        // Row 3: Total Days (Merged 1 to 6 only - Left Side)
        const daysRow = sheet.addRow([`Total Days: ${totalDays}`]);
        sheet.mergeCells(3, 1, 3, STATIC_COLS_COUNT);
        daysRow.getCell(1).font = { bold: true, size: 11 };
        daysRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

        // Row 4: Empty spacer row
        sheet.addRow([]);

        // 5. Build Headers (Row 5: Day Names, Row 6: Day Numbers)
        const r5Values = ['S.No', 'Emp Code', 'Name', 'Designation', 'Category', 'Department'];
        const r6Values = ['', '', '', '', '', ''];

        for (let day = 1; day <= totalDays; day++) {
            const dayName = getDayName(year, month, day);
            r5Values.push(dayName);
            r6Values.push(String(day));
        }

        r5Values.push('Total Hours');
        r6Values.push('');

        const dayNameRow = sheet.addRow(r5Values); // Row 5
        const dayNumRow = sheet.addRow(r6Values);  // Row 6

        // 6. Style & Merge Headers
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

        // B. Process Day Columns
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

        // 7. Freeze Panes
        sheet.views = [
            { state: 'frozen', xSplit: STATIC_COLS_COUNT, ySplit: 6 }
        ];

        // 8. Set Column Widths
        sheet.getColumn(1).width = 6;  // S.No
        sheet.getColumn(2).width = 15; // Code
        sheet.getColumn(3).width = 25; // Name
        sheet.getColumn(4).width = 20; // Desig
        sheet.getColumn(5).width = 20; // Cat
        sheet.getColumn(6).width = 20; // Dept

        for (let i = 0; i < totalDays; i++) {
            sheet.getColumn(STATIC_COLS_COUNT + 1 + i).width = 7.5; 
        }
        sheet.getColumn(totalColumns).width = 12; // Total Hours

        const dataToProcess = (selectedEmployeeIds && selectedEmployeeIds.length > 0)
            ? filteredEmployeeData
            : employeeDataList;

        // 9. Process Data Rows
        dataToProcess.forEach((record, index) => {
            const emp = record.employee;
            const attendances = record.attendances;
            const attendanceMap = createAttendanceMap(attendances);

            // Populate Static Data
            const rowValues = [
                index + 1,
                emp?.employee_code || '--',
                `${emp?.first_name || ''} ${emp?.last_name || ''}`.trim(),
                emp?.title || '--',
                emp?.employee_category_id?.employee_category_name || '--',
                emp?.department_name || '--'
            ];

            let sumMins = 0;

            // Populate Day Data
            for (let day = 1; day <= totalDays; day++) {
                const dateKey = `${String(day).padStart(2, '0')}-${formattedMonth}-${year}`;
                const dayData = attendanceMap.get(dateKey);
                const { text, rawMins } = getCellData(dayData);

                rowValues.push(text);
                sumMins += rawMins || 0;
            }

            // Format final accumulated minutes for Total column
            rowValues.push(formatMinutes(sumMins));

            const addedRow = sheet.addRow(rowValues);

            // Style Data Cells
            for (let c = 1; c <= STATIC_COLS_COUNT; c++) {
                styleCell(addedRow.getCell(c), 'FFFFFF');
            }

            for (let day = 1; day <= totalDays; day++) {
                const dateKey = `${String(day).padStart(2, '0')}-${formattedMonth}-${year}`;
                const dayData = attendanceMap.get(dateKey);
                const { color } = getCellData(dayData);

                styleCell(addedRow.getCell(STATIC_COLS_COUNT + day), color);
            }

            styleCell(addedRow.getCell(totalColumns), 'FFFFFF', true);
        });

        // 10. Download
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const fileName = `${firmName || 'Report'}_Hours_${monthName}_${year}.xlsx`;
        
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
