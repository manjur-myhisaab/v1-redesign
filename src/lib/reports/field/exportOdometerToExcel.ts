// @ts-nocheck
import ExcelJS from 'exceljs';
import rdk, { readItems, ATTENDANCE_SERVER_URL } from '@/services/server';

// === MULTI-EMPLOYEE ODOMETER REPORT EXPORT (Matched exactly with V1) ===
export const exportOdometerToExcel = async (
    employeeList: any[],
    month: string | number,
    year: string | number,
    firmName: string,
    firmId: string,
    selectedEmployeeIds: string[] = []
) => {
    try {
        const numericMonth = Number(month);
        const numericYear = Number(year);
        const monthName = new Date(`${numericYear}-${String(numericMonth).padStart(2, '0')}-01`).toLocaleString('default', { month: 'long' });
        const fileName = `Odometer_Report_${numericYear}-${monthName}.xlsx`;

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Odometer Report');

        // Freeze header
        worksheet.views = [{ state: 'frozen', ySplit: 4 }];

        // --- Constants ---
        const TOTAL_COLUMNS = 17;
        const columnLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0, TOTAL_COLUMNS);
        const LAST_COLUMN = columnLetters.slice(-1);

        // --- Title and Subheadings ---
        worksheet.mergeCells(`A1:${LAST_COLUMN}1`);
        worksheet.getCell('A1').value = firmName || 'Firm Name';
        worksheet.getCell('A1').font = { bold: true, size: 14 };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        worksheet.mergeCells(`A2:${LAST_COLUMN}2`);
        worksheet.getCell('A2').value = `Odometer Report for ${monthName} ${numericYear}`;
        worksheet.getCell('A2').font = { bold: true, size: 12 };
        worksheet.getCell('A2').alignment = { horizontal: 'center' };

        worksheet.addRow([]); // Spacer (Row 3)

        // --- Header (Row 4) ---
        const headers = [
            'Employee ID',
            'Employee Name',
            'Designation',
            'Category',
            'Department',
            'Date',
            'In Time',
            'In time Odometer reding',
            'In Image',
            'Tour Plan (In)',
            'In Remarks',
            'Out Time',
            'Out time Odometer reding',
            'Out Image',
            'Tour Plan (Out)',
            'Out Remarks',
            'Total KM'
        ];

        const headerRowRef = worksheet.addRow(headers);
        headerRowRef.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRowRef.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '4472C4' }, // Excel Blue
        };
        headerRowRef.alignment = { horizontal: 'center', vertical: 'middle' };

        headerRowRef.eachCell(cell => {
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' },
            };
        });

        const startOfMonth = `${numericYear}-${String(numericMonth).padStart(2, '0')}-01`;
        const nextMonth = numericMonth === 12 ? 1 : numericMonth + 1;
        const nextMonthYear = numericMonth === 12 ? numericYear + 1 : numericYear;
        const startOfNextMonth = `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-01`;

        let listToProcess = employeeList;
        if (selectedEmployeeIds && selectedEmployeeIds.length > 0) {
            listToProcess = employeeList.filter(emp => selectedEmployeeIds.includes(emp.id));
        }

        for (const employee of listToProcess) {
            const {
                id: employeeId,
                employee_code: empCode,
                title: designation,
                first_name: firstName,
                last_name: lastName,
                employee_category_id: category,
                department_name: department
            } = employee;

            const response: any = await rdk.request(
                readItems('odometer_readings', {
                    fields: ['*'],
                    limit: -1,
                    sort: ['reading_timestamp'],
                    filter: {
                        _and: [
                            { employee_id: { _eq: employeeId } },
                            { reading_timestamp: { _between: [startOfMonth, startOfNextMonth] } }
                        ]
                    }
                })
            );

            const readings = Array.isArray(response) ? response : response?.data || [];
            const groupedByDate: Record<string, any> = {};

            for (const reading of readings) {
                if (!reading.reading_timestamp) continue;
                const date = reading.reading_timestamp.split('T')[0];
                const type = reading.reading_type; // 'in' or 'out'
                if (!groupedByDate[date]) groupedByDate[date] = {};
                groupedByDate[date][type] = reading;
            }

            let hasData = false;

            for (const [date, entry] of Object.entries(groupedByDate)) {
                hasData = true;

                const inData = entry.in || {};
                const outData = entry.out || {};

                const kmTravelled = (inData.reading && outData.reading)
                    ? outData.reading - inData.reading
                    : '';

                const dataRow = worksheet.addRow([
                    empCode || '-',
                    `${firstName || ''} ${lastName || ''}`.trim() || "-",
                    designation || "-",
                    category?.employee_category_name || (typeof category === 'string' ? category : '') || "",
                    department || "",
                    date,
                    inData.reading_timestamp
                        ? new Date(inData.reading_timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
                        : '',
                    inData.reading || '',
                    inData.reading_image
                        ? { text: 'View Image', hyperlink: `${ATTENDANCE_SERVER_URL}/assets/${inData.reading_image}` }
                        : '',
                    inData.tour_plan || '',
                    inData.remarks || '',
                    outData.reading_timestamp
                        ? new Date(outData.reading_timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
                        : '',
                    outData.reading || '',
                    outData.reading_image
                        ? { text: 'View Image', hyperlink: `${ATTENDANCE_SERVER_URL}/assets/${outData.reading_image}` }
                        : '',
                    outData.tour_plan || '',
                    outData.remarks || '',
                    kmTravelled,
                ]);

                const inImageCell = dataRow.getCell(9);
                if (inData.reading_image) {
                    inImageCell.font = { color: { argb: 'FF0000FF' }, underline: true };
                }

                const outImageCell = dataRow.getCell(14);
                if (outData.reading_image) {
                    outImageCell.font = { color: { argb: 'FF0000FF' }, underline: true };
                }

                dataRow.eachCell(cell => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' },
                    };
                    cell.alignment = { vertical: 'middle' };
                });
            }

            if (hasData) {
                worksheet.addRow([]);
            }
        }

        worksheet.columns.forEach((col: any, index: number) => {
            if (index === 1 || index === 2 || index === 8 || index === 9 || index === 13 || index === 14) {
                col.width = 20;
            } else {
                col.width = 15;
            }
        });

        // Download Excel
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        window.URL.revokeObjectURL(url);
        return true;

    } catch (error) {
        console.error("Failed to download odometer report:", error);
        alert("Something went wrong while generating the report.");
        return null;
    }
};
