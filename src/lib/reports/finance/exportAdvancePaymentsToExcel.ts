// @ts-nocheck
import ExcelJS from 'exceljs';
import rdk, { readItems } from '@/services/server';

// === MULTI-EMPLOYEE ADVANCE PAYMENT REPORT EXPORT (Matched exactly with V1) ===
export const exportAdvancePaymentsToExcel = async (
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
        const worksheet = workbook.addWorksheet('Advance Payment Report');

        // Styling
        const headingFont = { bold: true, size: 14 };
        const subheadingFont = { bold: true, size: 12 };
        const headerFill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFCC00' },
        };

        // Freeze header
        worksheet.views = [{ state: 'frozen', ySplit: 4 }];

        let currentRow = 1;

        // --- Main Headings ---
        worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
        worksheet.getCell(`A${currentRow}`).value = firmName || 'Firm Name';
        worksheet.getCell(`A${currentRow}`).font = headingFont;
        worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center' };
        currentRow++;

        worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
        worksheet.getCell(`A${currentRow}`).value = `Advance Payment Report (${start} to ${end})`;
        worksheet.getCell(`A${currentRow}`).font = subheadingFont;
        worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center' };
        currentRow++;

        currentRow++; // Blank row

        // --- Column Headers --- (9 Headers)
        const headers = ['Employee ID', 'Employee Name', 'Designation', 'Category', 'Department', 'Payment Date', 'Amount', 'Payment Status', 'Remarks'];
        const headerRow = worksheet.getRow(currentRow);
        headers.forEach((header, index) => {
            const cell = headerRow.getCell(index + 1);
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
        currentRow++;

        // Set column widths
        worksheet.columns = [
            { key: 'empid', width: 20 },
            { key: 'name', width: 25 },
            { key: 'designation', width: 25 },
            { key: 'category', width: 25 },
            { key: 'department', width: 25 },
            { key: 'date', width: 18 },
            { key: 'amount', width: 15 },
            { key: 'status', width: 18 },
            { key: 'remarks', width: 30 },
        ];

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
            const categoryName = category?.employee_category_name || (typeof category === 'string' ? category : '-');
            const departmentName = department || '-';

            const response: any = await rdk.request(
                readItems("employee_salary_payments", {
                    filter: {
                        _and: [
                            { employee_id: { _eq: empId } },
                            { employee_salary_payment_date: { _between: [start, end] } },
                        ]
                    },
                    fields: ['*'],
                    limit: -1,
                })
            );

            const data = Array.isArray(response) ? response : response?.data || [];

            data.forEach((item: any) => {
                const row = worksheet.getRow(currentRow);
                
                row.getCell(1).value = empCode || '-'; 
                row.getCell(2).value = name;             
                row.getCell(3).value = designation || '-';      
                row.getCell(4).value = categoryName;     
                row.getCell(5).value = departmentName;     
                row.getCell(6).value = item.employee_salary_payment_date ? new Date(item.employee_salary_payment_date).toLocaleDateString('en-GB') : '-'; 
                row.getCell(7).value = Number(item.employee_salary_payment_amount) || 0;                      
                row.getCell(8).value = item.status || '';                                                    
                row.getCell(9).value = item.remarks || '';                                                   

                const statusCell = row.getCell(8);
                const status = (item.status || '').toLowerCase();
                
                if (status === 'paid') {
                    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };
                } else if (status === 'partially_paid') {
                    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFCC' } };
                } else {
                    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
                }
                
                for (let i = 1; i <= headers.length; i++) {
                    row.getCell(i).border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                }

                row.commit();
                currentRow++;
            });
        }

        const fileName = `Advance_Payment_Report_${start}_to_${end}.xlsx`;
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        return true;

    } catch (error) {
        console.error("Failed to download advance payment report:", error);
        alert("Something went wrong while generating the report.");
        return null;
    }
};
