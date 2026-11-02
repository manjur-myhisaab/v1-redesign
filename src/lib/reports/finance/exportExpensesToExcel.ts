// @ts-nocheck
import ExcelJS from 'exceljs';
import rdk, { ATTENDANCE_SERVER_URL, readItems } from '@/services/server';

// === MULTI-EMPLOYEE EXPENSE REPORT EXPORT (Matched exactly with V1) ===
export const exportExpensesToExcel = async (
    employeeList: any[],
    month: string | number,
    year: string | number,
    firmName: string,
    selectedEmployeeIds: string[] = []
) => {
    try {
        const numericMonth = Number(month);
        const numericYear = Number(year);
        const startDate = new Date(numericYear, numericMonth - 1, 1);
        const endDate = new Date(numericYear, numericMonth, 0);

        const formatDate = (date: Date) => {
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        };

        const start = formatDate(startDate);
        const end = formatDate(endDate);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Expense Report');

        const headingFont = { bold: true, size: 14 };
        const subheadingFont = { bold: true, size: 12 };
        const headerFill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFCC00' },
        };

        worksheet.views = [{ state: 'frozen', ySplit: 4 }];

        let currentRow = 1;

        const TOTAL_COLUMNS = 11;
        const columnLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0, TOTAL_COLUMNS);
        const LAST_COLUMN = columnLetters.slice(-1);

        worksheet.mergeCells(`A${currentRow}:${LAST_COLUMN}${currentRow}`);
        worksheet.getCell(`A${currentRow}`).value = `${firmName || 'Firm Name'}`;
        worksheet.getCell(`A${currentRow}`).font = headingFont;
        worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center' };
        currentRow++;

        worksheet.mergeCells(`A${currentRow}:${LAST_COLUMN}${currentRow}`);
        worksheet.getCell(`A${currentRow}`).value = `Expense Report (${start} to ${end})`;
        worksheet.getCell(`A${currentRow}`).font = subheadingFont;
        worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center' };
        currentRow++;

        currentRow++; // Empty row

        const headers = ['Employee ID', 'Name', 'Designation', 'Category', 'Department', 'Date', 'Amount', 'Status', 'Remark', 'Entry Type', 'Bill Image Link'];
        const headerRow = worksheet.getRow(currentRow);
        headers.forEach((header, idx) => {
            const cell = headerRow.getCell(idx + 1);
            cell.value = header;
            cell.font = { bold: true };
            cell.fill = headerFill;
            cell.alignment = { horizontal: 'center' };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });
        headerRow.commit();

        worksheet.columns = [
            { key: 'empid', width: 18 },        // Col 1
            { key: 'name', width: 22 },         // Col 2
            { key: 'designation', width: 20 },  // Col 3
            { key: 'category', width: 20 },     // Col 4
            { key: 'department', width: 20 },   // Col 5
            { key: 'date', width: 15 },         // Col 6
            { key: 'amount', width: 12 },       // Col 7
            { key: 'status', width: 12 },       // Col 8
            { key: 'remark', width: 30 },       // Col 9
            { key: 'entry_type', width: 15 },   // Col 10
            { key: 'bill_links', width: 50 },   // Col 11
        ];

        currentRow++;

        let listToProcess = employeeList;
        if (selectedEmployeeIds && selectedEmployeeIds.length > 0) {
            listToProcess = employeeList.filter(emp => selectedEmployeeIds.includes(emp.id));
        }

        // --- Data Rows ---
        for (const emp of listToProcess) {
            const {
                id: empId,
                employee_code: empCode,
                title: designation,
                first_name: firstName,
                last_name: lastName,
                employee_category_id: category,
                department_name: department
            } = emp;

            const name = `${firstName || ''} ${lastName || ''}`.trim() || '-';
            const categoryName = `${category?.employee_category_name || (typeof category === 'string' ? category : '-')}`;
            const departmentName = `${department || '-'}`;

            const response: any = await rdk.request(
                readItems("expenses", {
                    filter: {
                        _and: [
                            { employee_id: { _eq: empId } },
                            { expense_date: { _between: [start, end] } },
                        ]
                    },
                    fields: ['*', 'bill_image.*'],
                    limit: -1,
                })
            );

            const data = Array.isArray(response) ? response : response?.data || [];

            data.forEach((item: any) => {
                const date = item.expense_date ? new Date(item.expense_date).toLocaleDateString('en-GB') : '-';
                const status = (item.status || '').toUpperCase();

                const billLinksArray = (item.bill_image || []).map((img: any) =>
                    `${ATTENDANCE_SERVER_URL}/assets/${img.directus_files_id || img.id || img}`
                );

                const numBills = Math.max(1, billLinksArray.length);
                const startRow = currentRow;
                const endRow = currentRow + numBills - 1;

                for (let i = 0; i < numBills; i++) {
                    const row = worksheet.getRow(currentRow);
                    const isFirstRow = i === 0;

                    if (isFirstRow) {
                        row.getCell(1).value = empCode || '-';
                        row.getCell(2).value = name;
                        row.getCell(3).value = designation || '-';
                        row.getCell(4).value = categoryName;
                        row.getCell(5).value = departmentName;
                        row.getCell(6).value = date;
                        row.getCell(7).value = item.amount || 0;
                        row.getCell(8).value = status;
                        row.getCell(9).value = item.remark || '-';
                        row.getCell(10).value = item.expense_entry_type || '-';
                    }

                    const billCell = row.getCell(11);
                    if (i < billLinksArray.length) {
                        const link = billLinksArray[i];
                        billCell.value = { 
                            text: billLinksArray.length > 1 ? `View Bill ${i + 1}` : 'View Image', 
                            hyperlink: link,
                            tooltip: 'Click to view bill image' 
                        };
                        billCell.font = { 
                            color: { argb: 'FF0000FF' }, 
                            underline: true 
                        }; 
                        billCell.alignment = { vertical: 'middle', horizontal: 'left' };
                    } else {
                        billCell.value = '-';
                        billCell.alignment = { vertical: 'middle', horizontal: 'center' };
                    }

                    for (let col = 1; col <= TOTAL_COLUMNS; col++) {
                        const cell = row.getCell(col);
                        cell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' }
                        };
                        if (col !== 11 || i >= billLinksArray.length) {
                            cell.alignment = { vertical: 'top', horizontal: 'left' };
                        }
                    }

                    const statusCell = row.getCell(8);
                    const fill = status === 'APPROVED' ? 'FFC6EFCE' : 
                                 status === 'REJECTED' ? 'FFFFC7CE' : 'FFFFFFCC';
                    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };

                    row.commit();
                    currentRow++;
                }

                if (numBills > 1) {
                    for (let col = 1; col <= 10; col++) {
                        const startCell = worksheet.getCell(`${String.fromCharCode(64 + col)}${startRow}`);
                        const endCell = worksheet.getCell(`${String.fromCharCode(64 + col)}${endRow}`);
                        worksheet.mergeCells(startCell.address, endCell.address);
                        startCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
                    }
                }
            });
        }

        const fileName = `Multi_Expense_Report_${start}_to_${end}.xlsx`;
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        // document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        return true;
    } catch (error) {
        console.error("Failed to download multi-employee expense Excel:", error);
        alert("Something went wrong while generating the report.");
        return null;
    }
};
