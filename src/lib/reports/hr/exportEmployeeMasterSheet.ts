// @ts-nocheck
import ExcelJS from 'exceljs';
import toast from 'react-hot-toast';

export const exportEmployeeMasterSheet = async (
    firmName: string,
    response: any[],
    isCustomized?: string,
    customizedCoulmns?: any[],
    selectedEmpIds: string[] = []
) => {
    const toastId = toast.loading('Downloading Employee Master Sheet...');

    // Helper to extract phone from email (e.g., 918116... -> 8116...)
    const extractPhoneNumber = (email: string) => {
        if (!email) return '';
        if (email.includes('@') && !isNaN(email.split('@')[0])) {
            return email.replace('91', '').split('@')[0];
        }
        return '';
    };

    const formatStatus = (val: any) => (val === true || val === 'true' ? 'Enable' : 'Disable');

    const getDayName = (num: number) => {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[num] || '';
    };

    const capitalize = (str: string) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';

    const getColumnLetter = (colIndex: number) => {
        let temp = colIndex;
        let letter = '';
        while (temp > 0) {
            let modulo = (temp - 1) % 26;
            letter = String.fromCharCode(65 + modulo) + letter;
            temp = Math.floor((temp - modulo) / 26);
        }
        return letter;
    };

    try {
        let data = [];
        if (isCustomized === "customized" && selectedEmpIds && selectedEmpIds.length > 0) {
            data = (Array.isArray(response) ? response : []).filter(emp => selectedEmpIds.includes(emp.id));
        } else if (selectedEmpIds && selectedEmpIds.length > 0) {
            data = (Array.isArray(response) ? response : []).filter(emp => selectedEmpIds.includes(emp.id));
        } else {
            data = Array.isArray(response) ? response : [];
        }

        if (data.length === 0) {
            toast.dismiss(toastId);
            alert("No employee data found.");
            return null;
        }

        // Include active and archived (inactive) employees, but exclude suspended employees
        data = data.filter((emp: any) => (emp.status || '').toLowerCase() !== 'suspended');

        if (data.length === 0) {
            toast.dismiss(toastId);
            alert("No employee data found.");
            return null;
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Employee Master Sheet');

        if (isCustomized === "customized" && customizedCoulmns && customizedCoulmns.length > 0) {
            worksheet.columns = customizedCoulmns.map((col) => ({
                key: col.key,
                width: col.width || col.defaultWidth || 15
            }));
        } else {
            worksheet.columns = [
                { key: 'sr_no', width: 10 },
                { key: 'employee_name', width: 25 },
                { key: 'register_number', width: 20 },
                { key: 'employee_code', width: 15 },
                { key: 'designation', width: 20 },
                { key: 'department', width: 20 },
                { key: 'report_to', width: 20 },
                { key: 'status', width: 15 },
                { key: 'inactive_date', width: 15 },
                { key: 'doj', width: 15 },
                { key: 'gender', width: 10 },
                { key: 'role_type', width: 15 },
                { key: 'country', width: 15 },
                { key: 'salary_type', width: 15 },
                { key: 'salary', width: 15 },
                { key: 'week_extra_payment', width: 25 },
                { key: 'week_off_day', width: 15 },
                { key: 'overtime_applicable', width: 25 },
                { key: 'shift_wise_attendance', width: 25 },
                { key: 'shift_alignment', width: 20 },
                { key: 'overall_shifts', width: 20 },
                { key: 'casual_leaves', width: 20 },
                { key: 'sick_leaves', width: 20 },
                { key: 'privilege_leaves', width: 20 },
                { key: 'category', width: 15 },
                { key: 'email', width: 30 },
                { key: 'pan', width: 15 },
                { key: 'aadhar', width: 15 },
                { key: 'uan', width: 15 },
                { key: 'pf', width: 15 },
                { key: 'esi', width: 15 },
                { key: 'bank_ac', width: 20 },
                { key: 'bank_ifsc', width: 15 },
                { key: 'bank_name', width: 20 },
                { key: 'bank_branch', width: 20 },
                { key: 'ac_holder', width: 25 },
                { key: 'address', width: 30 },
                { key: 'blood_group', width: 10 },
                { key: 'marriage_status', width: 15 },
                { key: 'birth_date', width: 15 },
                { key: 'emergency_name', width: 20 },
                { key: 'emergency_number', width: 15 },
                { key: 'punch_from', width: 15 },
                { key: 'multiple_attendance', width: 20 },
                { key: 'live_tracking', width: 15 },
                { key: 'mobile_attendance', width: 20 },
                { key: 'ai_selfie', width: 20 },
                { key: 'view_self_salary', width: 20 },
                { key: 'self_odometer', width: 25 },
            ];
        }

        const colCount = worksheet.columns?.length || 48;
        const lastColLetter = getColumnLetter(colCount);

        worksheet.mergeCells(`A1:${lastColLetter}1`);
        worksheet.getCell('A1').value = firmName || 'Firm Name';
        worksheet.getCell('A1').font = { bold: true, size: 14 };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        worksheet.mergeCells(`A2:${lastColLetter}2`);
        worksheet.getCell('A2').value = 'Employee Master Sheet';
        worksheet.getCell('A2').font = { bold: true, size: 12 };
        worksheet.getCell('A2').alignment = { horizontal: 'center' };

        worksheet.addRow([]); // Spacer Row 3

        let headerValues = [];
        if (isCustomized === "customized" && customizedCoulmns && customizedCoulmns.length > 0) {
            headerValues = customizedCoulmns.map(col => col.label);
        } else {
            headerValues = [
                'SR. No', 'Employee Name', 'Register number ', 'Employee code ', 'Designation',
                'Department', 'Report to ', 'Status','Inactive From', 'Date of Joining', 'Gender',
                'Roll type ', 'Country', 'Salary type ', 'Salary', 'Week of extra payment ',
                'Week off Day', 'Applicable for overtime', 'Shift wise attendnace ', 'shift alignment type ', 'Overall assigned shifts',
                'Number of Casual leave', 'Number of Sick Leaves', 'Number of Privilege Leaves', 'Category', 'Email address',
                'Pan Number', 'Aadhar number', 'UAN number', 'PF number', 'ESI number',
                'Bank account number', 'Bank IFSC code ', 'Bank name', 'Bank branch Name', 'Account holder name',
                'Address', 'Blood group', 'Marrige status', 'Birth Date', 'Emergency contact name',
                'Number', 'Punch from', 'Multiple Attendance', 'Live tracking', 'Mobile attendance',
                'Ai selfie Verification', 'View self salary', 'Self Odometer reading'
            ];
        }

        const headerRow = worksheet.addRow(headerValues);
        headerRow.eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCC00' } };
            cell.alignment = { horizontal: 'center' };
            cell.border = { outline: true, style: 'thin' };
        });

        data.forEach((item: any, index: number) => {
            worksheet.addRow({
                sr_no: index + 1,
                first_name: item.first_name || '',
                last_name: item.last_name || '',
                employee_name: `${item.first_name || ''} ${item.last_name || ''}`.trim(),
                register_number: extractPhoneNumber(item.email),
                employee_code: item.employee_code || '',
                designation: item.title || '',
                department: item.department_name || '',
                report_to: `${item.supervisor_id?.first_name || ''} ${item.supervisor_id?.last_name || ''}`.trim(),
                status: item.status === "archived" || item.status === "deleted" ? "INACTIVE" : "ACTIVE",
                inactive_date: item.inactive_date?.slice(0, 10) || '',
                doj: item.doj || '',
                gender: capitalize(item.gender) || '',
                role_type: item.role === 'bb64d3fd-5fde-4493-9cb7-bf6be2031d82' ? "Admin" : item.role === "8734320f-991f-479f-bba8-9d4af261856e" ? "Manager" : "Employee",
                country: item.country === 'IN' ? 'India' : (item.country || 'India'),
                salary_type: item.pay_type || '',
                salary: `${item.salary_per_month || 0}.${item.salary_per_month_after_decimal || 0}`,
                week_extra_payment: formatStatus(item.week_off_payment),
                week_off_day: getDayName(item.week_off_day_number),
                overtime_applicable: formatStatus(item.applicable_for_overtime),
                shift_wise_attendance: formatStatus(item.shiftwise_attendance),
                shift_alignment: capitalize(item.shift_type) || '',
                overall_shifts: (item.shift_ids || [])
                    .map((shift: any) => shift.shift_shift_id?.shift_name)
                    .filter(Boolean)
                    .join(', '),
                casual_leaves: item.casual_leaves || 0,
                sick_leaves: item.sick_leaves || 0,
                privilege_leaves: item.privilege_leaves || 0,
                category: item.employee_category_id?.employee_category_name || '',
                email: item.email || '',
                pan: item.pan_number || '',
                aadhar: item.aadhaar_number || '',
                uan: item.uan || '',
                pf: item.pf_no || '',
                esi: item.esi_no || '',
                bank_ac: item.employee_bank_ac_number || '',
                bank_ifsc: item.employee_bank_ifsc || '',
                bank_name: item.employee_bank_name || '',
                bank_branch: item.employee_bank_branch_name || '',
                ac_holder: item.employee_bank_ac_holder_name || '',
                address: item.employee_address || item.last_geo_address || '',
                blood_group: item.employee_blood_group || '',
                marriage_status: item.marital_status || '',
                birth_date: item.employee_birthdate || '',
                emergency_name: item.emergency_contact_name || '',
                emergency_number: item.emergency_contact_phone || '',
                punch_from: capitalize(item.punch_from) || '',
                multiple_attendance: formatStatus(item.multiple_attendance),
                live_tracking: formatStatus(item.live_tracking),
                mobile_attendance: formatStatus(item.mobile_attendance),
                ai_selfie: formatStatus(item.ai_selfie_verification),
                view_self_salary: formatStatus(item.can_view_self_salary),
                self_odometer: formatStatus(item.self_odometer_reading),
            });
        });

        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            if (rowNumber <= 4) return;

            row.eachCell((cell) => {
                const val = cell.value ? cell.value.toString() : '';

                if (['Enable', 'Active', 'ACTIVE'].includes(val)) {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFC6EFCE' }
                    };
                    cell.font = { color: { argb: 'FF006100' }, bold: true };
                } else if (['Disable', 'Inactive', 'Deleted', 'INACTIVE'].includes(val)) {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFFC7CE' }
                    };
                    cell.font = { color: { argb: 'FF9C0006' }, bold: true };
                }

                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${firmName || 'Report'}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.dismiss(toastId);
        toast.success('Employee Master Sheet downloaded successfully!');
        return true;

    } catch (error) {
        console.error("Export Error:", error);
        toast.dismiss(toastId);
        toast.error('Failed to download Employee Master Sheet!');
        return null;
    }
};
