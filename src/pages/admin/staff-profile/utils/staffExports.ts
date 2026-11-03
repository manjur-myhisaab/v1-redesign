// @ts-nocheck
import ExcelJS from 'exceljs';
import toast from 'react-hot-toast';
import rdk, { ATTENDANCE_SERVER_URL, readItems } from '@/services/server';

const formatTime = (timeStr?: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const date = new Date();
    date.setHours(parseInt(hours, 10));
    date.setMinutes(parseInt(minutes, 10));
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
};

const formatDateTime = (timestamp?: string) =>
    timestamp
        ? new Date(timestamp)
              .toLocaleString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
              })
              .replace(',', '')
        : '';

/**
 * 1. Odometer Excel Report for Single Employee
 */
export const downloadOdometerExcel = async (
    employeeId: string,
    employeeName: string,
    firmName: string,
    selectedMonth?: number,
    selectedYear?: number
) => {
    try {
        const rawMonth = selectedMonth || sessionStorage.getItem('month') || new Date().getMonth() + 1;
        const rawYear = selectedYear || sessionStorage.getItem('year') || new Date().getFullYear();

        const month = Number(rawMonth);
        const year = Number(rawYear);

        const start = `${year}-${String(month).padStart(2, '0')}-01T00:00:00`;
        const lastDay = new Date(year, month, 0).getDate();
        const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59`;

        const loadingToast = toast.loading('Preparing Odometer Report...');

        const rawData = await rdk.request(
            readItems('odometer_readings', {
                filter: {
                    _and: [
                        { employee_id: { _eq: employeeId } },
                        { reading_timestamp: { _between: [start, end] } },
                    ],
                },
                sort: ['reading_timestamp'],
            })
        );

        const readings = Array.isArray(rawData) ? rawData : [];

        if (readings.length === 0) {
            toast.dismiss(loadingToast);
            toast.error('No odometer data found for the selected month.');
            return;
        }

        const monthName = new Date(`${year}-${String(month).padStart(2, '0')}-01`).toLocaleString('default', {
            month: 'long',
        });
        const fileName = `Odometer_Report_${employeeName.replace(/\s+/g, '_')}_${year}-${monthName}.xlsx`;

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Odometer Report');

        const headingFont = { bold: true, size: 14 };
        const subheadingFont = { bold: true, size: 12 };

        worksheet.mergeCells('A1:H1');
        worksheet.getCell('A1').value = firmName || 'Firm Name';
        worksheet.getCell('A1').font = headingFont;
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A2:H2');
        worksheet.getCell('A2').value = `Odometer Report for ${monthName} ${year}`;
        worksheet.getCell('A2').font = subheadingFont;
        worksheet.getCell('A2').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A3:H3');
        worksheet.getCell('A3').value = `Employee: ${employeeName}`;
        worksheet.getCell('A3').font = { italic: true };
        worksheet.getCell('A3').alignment = { horizontal: 'center' };

        worksheet.addRow([]);

        const headers = [
            'Date',
            'Reading Type',
            'Reading Value (km)',
            'Tour Plan',
            'Remarks',
            'Distance Traveled (km)',
            'Time',
            'Image URL',
        ];
        const headerRow = worksheet.addRow(headers);
        headerRow.eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFCC00' },
            };
            cell.alignment = { horizontal: 'center' };
        });

        worksheet.columns = [
            { key: 'date', width: 15 },
            { key: 'type', width: 15 },
            { key: 'reading', width: 20 },
            { key: 'tourPlan', width: 25 },
            { key: 'remarks', width: 25 },
            { key: 'distance', width: 22 },
            { key: 'time', width: 15 },
            { key: 'image', width: 35 },
        ];

        let prevReading: number | null = null;
        readings.forEach((entry: any) => {
            const dt = new Date(entry.reading_timestamp);
            const dateStr = dt.toISOString().split('T')[0];
            const timeStr = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            const currentReading = parseFloat(entry.reading) || 0;
            let distance: number | string = '-';

            if (entry.reading_type === 'out' && prevReading !== null) {
                distance = (currentReading - prevReading).toFixed(2);
            }
            if (entry.reading_type === 'in') {
                prevReading = currentReading;
            }

            const imgUrl = entry.reading_image
                ? `${ATTENDANCE_SERVER_URL}/assets/${entry.reading_image}`
                : '-';

            worksheet.addRow({
                date: dateStr,
                type: (entry.reading_type || '').toUpperCase(),
                reading: currentReading,
                tourPlan: entry.tour_plan || '-',
                remarks: entry.remarks || '-',
                distance,
                time: timeStr,
                image: imgUrl,
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        window.URL.revokeObjectURL(url);

        toast.dismiss(loadingToast);
        toast.success('Odometer Report Downloaded');
    } catch (err: any) {
        console.error('Odometer export failed:', err);
        toast.error('Failed to export odometer report');
    }
};

/**
 * 2. Task Report Excel for Single Employee
 */
export const exportTasksToExcel = async (
    employeeId: string,
    employeeName: string,
    supervisorName: string = '',
    firmName: string = '',
    selectedMonth?: number,
    selectedYear?: number
) => {
    try {
        const rawMonth = selectedMonth || sessionStorage.getItem('month') || new Date().getMonth() + 1;
        const rawYear = selectedYear || sessionStorage.getItem('year') || new Date().getFullYear();
        const month = Number(rawMonth);
        const year = Number(rawYear);

        const loadingToast = toast.loading('Preparing Task Report...');

        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        const response = await rdk.request(
            readItems('tasks', {
                filter: {
                    _and: [
                        { employee_id: { _eq: employeeId } },
                        { task_date: { _between: [startDate, endDate] } },
                    ],
                },
                fields: ['*', 'client_id.*', 'task_images.*'],
                sort: ['-task_date'],
            })
        );

        const tasks = Array.isArray(response) ? response : [];
        if (tasks.length === 0) {
            toast.dismiss(loadingToast);
            toast.error('No tasks found for this period.');
            return;
        }

        const monthName = new Date(`${year}-${String(month).padStart(2, '0')}-01`).toLocaleString('default', {
            month: 'long',
        });
        const fileName = `Task_Report_${employeeName.replace(/\s+/g, '_')}_${year}-${monthName}.xlsx`;

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Task Report');

        worksheet.mergeCells('A1:I1');
        worksheet.getCell('A1').value = firmName || 'Firm Name';
        worksheet.getCell('A1').font = { bold: true, size: 14 };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A2:I2');
        worksheet.getCell('A2').value = `Task Report for ${monthName} ${year}`;
        worksheet.getCell('A2').font = { bold: true, size: 12 };
        worksheet.getCell('A2').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A3:I3');
        worksheet.getCell('A3').value = `Employee: ${employeeName}`;
        worksheet.getCell('A3').font = { italic: true };
        worksheet.getCell('A3').alignment = { horizontal: 'center' };

        worksheet.addRow([]);

        const headers = [
            'Date',
            'Task Name',
            'Description',
            'Client',
            'Priority',
            'Status',
            'Assigned By',
            'Completion Time',
            'Remarks',
        ];
        const headerRow = worksheet.addRow(headers);
        headerRow.eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFCC00' },
            };
            cell.alignment = { horizontal: 'center' };
        });

        worksheet.columns = [
            { key: 'date', width: 15 },
            { key: 'name', width: 25 },
            { key: 'desc', width: 30 },
            { key: 'client', width: 20 },
            { key: 'priority', width: 14 },
            { key: 'status', width: 16 },
            { key: 'assignedBy', width: 20 },
            { key: 'completedAt', width: 20 },
            { key: 'remarks', width: 25 },
        ];

        tasks.forEach((t: any) => {
            worksheet.addRow({
                date: t.task_date || '-',
                name: t.task_name || t.title || '-',
                desc: t.task_description || t.description || '-',
                client: t.client_id?.client_name || '-',
                priority: (t.priority || 'medium').toUpperCase(),
                status: (t.status || 'pending').toUpperCase(),
                assignedBy: supervisorName || '-',
                completedAt: t.completed_at ? formatDateTime(t.completed_at) : '-',
                remarks: t.remarks || '-',
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        window.URL.revokeObjectURL(url);

        toast.dismiss(loadingToast);
        toast.success('Task Report Downloaded');
    } catch (err: any) {
        console.error('Task export failed:', err);
        toast.error('Failed to export task report');
    }
};

/**
 * 3. Visit Report Excel for Single Employee
 */
export const downloadVisitReportExcel = async (
    employeeId: string,
    employeeName: string,
    firmName: string = '',
    selectedMonth?: number,
    selectedYear?: number
) => {
    try {
        const rawMonth = selectedMonth || sessionStorage.getItem('month') || new Date().getMonth() + 1;
        const rawYear = selectedYear || sessionStorage.getItem('year') || new Date().getFullYear();
        const month = Number(rawMonth);
        const year = Number(rawYear);

        const loadingToast = toast.loading('Preparing Visit Report...');

        const start = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        const response = await rdk.request(
            readItems('visits', {
                filter: {
                    _and: [
                        { assigned_employee_id: { _eq: employeeId } },
                        { visit_date: { _between: [start, end] } },
                    ],
                },
                sort: ['-visit_date'],
                fields: ['*', 'client_id.*', 'visit_images.*'],
            })
        );

        const visits = Array.isArray(response) ? response : [];
        if (visits.length === 0) {
            toast.dismiss(loadingToast);
            toast.error('No visit data found for the selected month.');
            return;
        }

        const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
        const fileName = `Visit_Report_${employeeName.replace(/\s+/g, '_')}_${year}-${monthName}.xlsx`;

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Visit Report');

        worksheet.mergeCells('A1:G1');
        worksheet.getCell('A1').value = firmName || 'Firm Name';
        worksheet.getCell('A1').font = { bold: true, size: 14 };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A2:G2');
        worksheet.getCell('A2').value = `Visit Report for ${monthName} ${year}`;
        worksheet.getCell('A2').font = { bold: true, size: 12 };
        worksheet.getCell('A2').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A3:G3');
        worksheet.getCell('A3').value = `Employee: ${employeeName}`;
        worksheet.getCell('A3').font = { italic: true };
        worksheet.getCell('A3').alignment = { horizontal: 'center' };

        worksheet.addRow([]);

        const headers = [
            'Visit Date',
            'Client Name',
            'Purpose of Visit',
            'Status',
            'Check In',
            'Check Out',
            'Outcome / Notes',
        ];
        const headerRow = worksheet.addRow(headers);
        headerRow.eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFCC00' },
            };
            cell.alignment = { horizontal: 'center' };
        });

        worksheet.columns = [
            { key: 'date', width: 16 },
            { key: 'client', width: 25 },
            { key: 'purpose', width: 28 },
            { key: 'status', width: 15 },
            { key: 'checkIn', width: 18 },
            { key: 'checkOut', width: 18 },
            { key: 'outcome', width: 30 },
        ];

        visits.forEach((v: any) => {
            worksheet.addRow({
                date: v.visit_date || '-',
                client: v.client_id?.client_name || '-',
                purpose: v.visit_purpose || v.purpose || '-',
                status: (v.status || 'completed').toUpperCase(),
                checkIn: v.check_in_time ? formatTime(v.check_in_time) : '-',
                checkOut: v.check_out_time ? formatTime(v.check_out_time) : '-',
                outcome: v.remarks || v.outcome || '-',
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        window.URL.revokeObjectURL(url);

        toast.dismiss(loadingToast);
        toast.success('Visits Report Downloaded');
    } catch (err: any) {
        console.error('Visit export failed:', err);
        toast.error('Failed to export visit report');
    }
};

/**
 * 4. Expense Excel Report for Single Employee
 */
export const downloadExpenseExcel = async (
    empId: string,
    name: string,
    firmName: string,
    expensesList: any[],
    start: string,
    end: string
) => {
    try {
        const data = expensesList || [];
        if (data.length === 0) {
            toast.error('No expense data found for the selected period.');
            return;
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Expense Report');

        const headingFont = { bold: true, size: 14 };
        const subheadingFont = { bold: true, size: 12 };

        worksheet.mergeCells('A1:G1');
        worksheet.getCell('A1').value = `${firmName || 'Firm Name'}`;
        worksheet.getCell('A1').font = headingFont;
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A2:G2');
        worksheet.getCell('A2').value = `Expense Report (${start} to ${end})`;
        worksheet.getCell('A2').font = subheadingFont;
        worksheet.getCell('A2').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A3:G3');
        worksheet.getCell('A3').value = `Employee: ${name}`;
        worksheet.getCell('A3').font = { italic: true };
        worksheet.getCell('A3').alignment = { horizontal: 'center' };

        worksheet.addRow([]);

        const headers = ['NAME', 'Date', 'Amount (₹)', 'Status', 'Remark', 'Entry Type', 'Receipt Link'];
        const headerRow = worksheet.addRow(headers);
        headerRow.eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCC00' } };
            cell.alignment = { horizontal: 'center' };
        });

        worksheet.columns = [
            { key: 'name', width: 22 },
            { key: 'date', width: 16 },
            { key: 'amount', width: 16 },
            { key: 'status', width: 16 },
            { key: 'remark', width: 30 },
            { key: 'type', width: 16 },
            { key: 'image', width: 35 },
        ];

        data.forEach((exp: any) => {
            const firstImg = exp.bill_image?.[0]?.directus_files_id;
            const imgUrl = firstImg ? `${ATTENDANCE_SERVER_URL}/assets/${firstImg}` : '-';

            worksheet.addRow({
                name,
                date: exp.expense_date ? String(exp.expense_date).slice(0, 10) : '-',
                amount: Number(exp.amount) || 0,
                status: (exp.status || 'pending').toUpperCase(),
                remark: exp.remark || '-',
                type: (exp.expense_entry_type || 'expense').toUpperCase(),
                image: imgUrl,
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Expense_Report_${name.replace(/\s+/g, '_')}_${start}_${end}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);

        toast.success('Expense Report Downloaded');
    } catch (err: any) {
        console.error('Expense export failed:', err);
        toast.error('Failed to export expense report');
    }
};

/**
 * 5. Incentive Excel Report for Single Employee
 */
export const downloadIncentiveExcel = async (
    incentivesList: any[],
    employeeName: string,
    firmName: string,
    start: string,
    end: string
) => {
    try {
        const data = incentivesList || [];
        if (data.length === 0) {
            toast.error('No incentives found for the selected period.');
            return;
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Incentive Report');

        const headingFont = { bold: true, size: 14 };
        const subheadingFont = { bold: true, size: 12 };

        worksheet.mergeCells('A1:D1');
        worksheet.getCell('A1').value = firmName || 'Firm Name';
        worksheet.getCell('A1').font = headingFont;
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A2:D2');
        worksheet.getCell('A2').value = `Incentive Report from ${start} to ${end}`;
        worksheet.getCell('A2').font = subheadingFont;
        worksheet.getCell('A2').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A3:D3');
        worksheet.getCell('A3').value = `Employee: ${employeeName}`;
        worksheet.getCell('A3').font = { italic: true };
        worksheet.getCell('A3').alignment = { horizontal: 'center' };

        worksheet.addRow([]);

        const headers = ['Date', 'Amount (₹)', 'Status', 'Remarks'];
        const headerRow = worksheet.addRow(headers);
        headerRow.eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFCC00' },
            };
            cell.alignment = { horizontal: 'center' };
        });

        worksheet.columns = [
            { key: 'date', width: 16 },
            { key: 'amount', width: 18 },
            { key: 'status', width: 15 },
            { key: 'remarks', width: 35 },
        ];

        data.forEach((inc: any) => {
            worksheet.addRow({
                date: inc.incentive_date ? String(inc.incentive_date).slice(0, 10) : '-',
                amount: Number(inc.incentive_amount) || 0,
                status: 'PAID',
                remarks: inc.remarks || '-',
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Incentive_Report_${employeeName.replace(/\s+/g, '_')}_${start}_${end}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);

        toast.success('Incentive Report Downloaded');
    } catch (err: any) {
        console.error('Incentive export failed:', err);
        toast.error('Failed to export incentive report');
    }
};
