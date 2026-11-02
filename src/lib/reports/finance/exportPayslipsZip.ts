// @ts-nocheck
import JSZip from "jszip";
import { ATTENDANCE_SERVER_URL } from "@/services/server";
import { generateOneOrBulkPayslips, getMonthName } from "@/utils/generateOneOrBulkPayslips";

export { generateOneOrBulkPayslips, getMonthName };

export interface PayslipsZipParams {
    employees: any[];
    month: string | number;
    year: string | number;
    user?: any;
    firmId: string;
    firmName?: string;
    firmAddress?: string;
    firmPaidLogo?: string;
    selectedEmployeeIds: string[];
    onProgress?: (progress: number, currentEmployeeName: string) => void;
}

export const exportPayslipsZip = async ({
    employees,
    month,
    year,
    user,
    firmId,
    firmName,
    firmAddress,
    firmPaidLogo,
    selectedEmployeeIds,
    onProgress,
}: PayslipsZipParams) => {
    const formattedMonth = String(month).padStart(2, '0');
    const isMultiple = selectedEmployeeIds.length > 1;
    let zip: any = null;

    if (isMultiple) {
        zip = new JSZip();
    }

    const totalCount = selectedEmployeeIds.length;
    let currentIndex = 0;

    const existingFirm = (user?.firm_id && typeof user.firm_id === 'object') ? user.firm_id : {};

    const userObj = {
        ...user,
        firm_id: {
            ...existingFirm,
            firm_id: firmId || existingFirm.firm_id || '',
            firm_name: firmName || existingFirm.firm_name || user?.firm_name || '',
            firm_address: firmAddress || existingFirm.firm_address || user?.firm_address || '',
            firm_paid_logo: firmPaidLogo || existingFirm.firm_paid_logo || user?.firm_paid_logo || '',
        }
    };

    for (const userid of selectedEmployeeIds) {
        try {
            const response = await fetch(`${ATTENDANCE_SERVER_URL}/api/employee_salary/${year}-${formattedMonth}/${userid}/${firmId}`);
            const data = await response.json();

            if (response.ok && data) {
                const salaryData = data.salary || data;
                const staffData = employees?.find((emp: any) => emp.id === userid) || { name: "Employee", id: userid };
                const empName = `${staffData.first_name || ''} ${staffData.last_name || ''}`.trim() || staffData.name || 'Employee';

                if (onProgress) {
                    currentIndex++;
                    const currentProgress = Math.round((currentIndex / totalCount) * 100);
                    onProgress(currentProgress, empName);
                }

                const result = await generateOneOrBulkPayslips(month, year, userObj, staffData, salaryData, isMultiple);

                if (isMultiple && result && result.blob) {
                    zip.file(result.filename, result.blob);
                }
            } else {
                console.error(`Failed to fetch salary data for user ID: ${userid}`);
            }
        } catch (err) {
            console.error(`Error processing payslip for ${userid}:`, err);
        }
    }

    if (isMultiple && zip) {
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const monthName = getMonthName(month);
        const link = document.createElement("a");
        link.href = URL.createObjectURL(zipBlob);
        link.download = `payslips-${monthName}-${year}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return true;
    }

    return true;
};
