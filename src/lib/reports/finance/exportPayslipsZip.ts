// @ts-nocheck
import html2pdf from "html2pdf.js";
import JSZip from "jszip";
import { amountToWords } from "@/lib/utils/amountToWords";
import { ATTENDANCE_SERVER_URL } from "@/services/server";
import { toast } from "sonner";

function getMonthName(monthNumber: string | number): string {
    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    const index = parseInt(String(monthNumber), 10) - 1;
    return months[index] || "";
}

const formatCurrency = (amount: number | string): string => {
    const num = Number(amount) || 0;
    return `₹${num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

const isValidAmount = (amount: any): boolean => {
    const num = Number(amount);
    return !isNaN(num) && num > 0;
};

export const generateOneOrBulkPayslips = (
    month: string | number,
    year: string | number,
    user: any,
    staff: any,
    salary: any,
    returnBlob = false
): Promise<any> => {
    return new Promise((resolve, reject) => {
        if (!salary) {
            console.warn("No salary data provided for", staff?.name || staff?.first_name);
            return resolve(null);
        }

        const element = document.createElement("div");

        const isWeekOffPayment = staff?.week_off_payment || salary?.week_off_payment;
        const isWeekOffAsOvertime = staff?.week_off_as_overtime || salary?.week_off_as_overtime;
        const isHolidayPayment = staff?.holiday_extra_payment || salary?.holiday_extra_payment || (salary?.total_holiday_earnings > 0);
        const isHolidayAsOvertime = staff?.holiday_as_overtime || salary?.holiday_as_overtime || (salary?.total_holiday_overtime?.total_amount > 0);

        const baseEarnings = [
            {
                name: "Regular Earnings",
                amount: salary.pay_type === "Hourly" || salary.pay_type === "hourly"
                    ? +(salary?.total_hourly_data?.total_amount)?.toFixed(2) || 0
                    : +(salary?.payable_days * (salary?.basic_salary / salary?.total_days))?.toFixed(2) || 0
            },
            { name: "Present Day Incentive", amount: salary.total_present_incentive || 0 },
            { name: "OverTime Earnings", amount: salary.total_ot?.total_amount || 0 },
            { name: "Total Incentives", amount: salary.total_incentive || 0 },
        ];

        if (isWeekOffPayment) {
            baseEarnings.push({ name: "Week Off Earnings", amount: salary.total_week_off_earnings || 0 });
        }
        if (isWeekOffAsOvertime) {
            baseEarnings.push({ name: "Week Off Overtime", amount: salary.total_week_off_overtime?.total_amount || 0 });
        }
        if (isHolidayPayment) {
            baseEarnings.push({ name: "Holiday Earnings", amount: salary.total_holiday_earnings || 0 });
        }
        if (isHolidayAsOvertime) {
            baseEarnings.push({ name: "Holiday Overtime", amount: salary.total_holiday_overtime?.total_amount || 0 });
        }

        const dynamicBenefits = (salary.benefits || []).map((b: any) => ({
            name: b.payroll_head_name || "Benefit",
            amount: Number(b.value ? b.value.toFixed(2) : 0)
        }));

        const earnings = [
            ...baseEarnings,
            ...dynamicBenefits
        ].filter(e => isValidAmount(e.amount));

        const grossEarnings = earnings.reduce((sum, e) => sum + (e.amount || 0), 0);

        const dynamicDeductions = (salary.deductions || []).map((item: any) => ({
            name: item.payroll_head_name,
            amount: Number(item.value ? item.value.toFixed(2) : 0)
        }));

        const advancePayments = (salary.payments_made || []).map((item: any) => ({
            name: `Payments Made : [${item.date}]`,
            amount: Number(item.amount ? item.amount.toFixed(2) : 0)
        }));

        const loans = (salary.loans_emi || []).map((item: any) => ({
            name: item.is_emi ? `${item.loan_title}(EMI)` : item.loan_title,
            amount: item.is_emi ? Number(item.emi_amount?.toFixed(2) || 0) : Number(item.loan_amount?.toFixed(2) || 0)
        }));

        const deductions = [
            ...dynamicDeductions,
            ...loans,
            ...advancePayments
        ].filter(d => isValidAmount(d.amount));

        const totalDeductions = deductions.reduce((sum, d) => sum + (d.amount || 0), 0);

        const firmName = user?.firm_id?.firm_name || user?.firm_name || "";
        const firmAddress = user?.firm_id?.firm_address || user?.firm_address || "";
        const firmLogo = user?.firm_id?.firm_paid_logo;

        element.innerHTML = `
        <div style="font-family: Arial, sans-serif; width: 720px; padding: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
                <div style="display: flex; gap:10px;">
                    <div style="text-align: center;">
                        ${firmLogo ?
                            `<img src="${ATTENDANCE_SERVER_URL}/assets/${firmLogo}" alt="Logo" style="height: 50px; width: 50px; object-fit: contain;" />` :
                            ""
                        }
                    </div>
                    <div>
                        <h1 style="font-size: 20px; font-weight: bold; margin: 0;">${firmName}</h1>
                        <div style="width: 70%; font-size: 14px; color: #555;">${firmAddress}</div>
                    </div>
                </div>

                <div style="text-align: right;">
                    <p style="font-size: 14px; margin: 0; color: #555;">Payslip For the Month</p>
                    <h2 style="font-size: 16px; font-weight: bold; margin: 0; color: #333;">${getMonthName(month)} ${year}</h2>
                </div>
            </div>

            <div style="display: flex; justify-content: space-between; margin-top: 30px; gap: 2%;">
                <div style="width: 49%; border: 1px solid #ddd; padding: 15px; border-radius: 8px;">
                    <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 10px;">EMPLOYEE SUMMARY</h3>
                    <table style="width: 100%; font-size: 11px; line-height: 1.5;">
                        <tr><td style="width: 150px;">Employee Name</td><td>: ${`${staff.first_name || ''} ${staff.last_name || ''}`.trim() || staff.name || "..."}</td></tr>
                        <tr><td>Designation</td><td>: ${staff.title || staff.designation || "..."}</td></tr>
                        <tr><td>Employee Code</td><td>: ${staff.employee_code || "..."}</td></tr>
                        <tr><td>Date of joining</td><td>: ${staff.doj || "..."}</td></tr>
                        <tr><td>Pay Period</td><td>: ${getMonthName(month)} ${year}</td></tr>
                        <tr><td>Pay Cycle</td><td>: From ${salary.pay_cycle_enabled ? salary.pay_cycle_from : "1"} to ${salary.pay_cycle_enabled ? salary.pay_cycle_to : new Date(Number(year), Number(month), 0).getDate()}</td></tr>
                        <tr><td>Pan No</td><td>: ${staff.pan_number || "..."}</td></tr>
                        <tr><td>ESIC No</td><td>: ${staff.esi_number || "..."}</td></tr>
                        <tr><td>PF No</td><td>: ${staff.pf_number || "..."}</td></tr>
                        <tr><td>UAN</td><td>: ${staff.uan || "..."}</td></tr>
                    </table>
                </div>
                
                <div style="width: 49%; border: 1px solid #ddd; padding: 15px; border-radius: 8px;">
                    <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 10px;">ATTENDANCE SUMMARY</h3>
                    <table style="width: 100%; font-size: 11px; line-height: 1.5;">
                        <tr><td>Total Days</td><td>: ${salary.total_days || "..."}</td></tr>
                        <tr><td>Present Days</td><td>: ${salary.present_days - (salary.half_days || 0) || "..."}</td></tr>
                        <tr><td>Present in Week Offs</td><td>: ${salary.present_week_offs || "..."}</td></tr>
                        <tr><td>Present in Holidays</td><td>: ${salary.present_holidays || "..."}</td></tr>
                        <tr><td>Absent Days</td><td>: ${salary.absent_days || "..."}</td></tr>
                        <tr><td>Half Days</td><td>: ${salary.half_days || "..."}</td></tr>
                        <tr><td>Leave Days</td><td>: ${salary.leave_days || "..."}</td></tr>
                        <tr><td>Holidays</td><td>: ${salary.holidays || "..."}</td></tr>
                        <tr><td>Week Off Days</td><td>: ${salary.week_offs || "..."}</td></tr>
                        <tr><td>Payable Days</td><td>: ${salary.payable_days || "..."}</td></tr>
                        ${salary.total_ot?.hours_worked > 0 ? `<tr><td>OverTime Hours</td><td>: ${salary.total_ot.hours_worked?.toFixed(2)} hrs</td></tr>` : ""}
                        ${isWeekOffAsOvertime && salary.total_week_off_overtime?.hours_worked > 0 ? `<tr><td>Week Off Overtime Hours</td><td>: ${salary.total_week_off_overtime.hours_worked?.toFixed(2)} hrs</td></tr>` : ""}
                        ${isHolidayAsOvertime && salary.total_holiday_overtime?.hours_worked > 0 ? `<tr><td>Holiday Overtime Hours</td><td>: ${salary.total_holiday_overtime.hours_worked?.toFixed(2)} hrs</td></tr>` : ""}
                        ${salary.total_hourly_data?.hours_worked > 0 ? `<tr><td>Total Hours Worked</td><td>: ${salary.total_hourly_data.hours_worked?.toFixed(2)} hrs</td></tr>` : ""}
                    </table>
                </div>
            </div>

            <div style="margin-top: 30px; border: 1px solid #ddd; border-radius: 20px;">
                <div style="display: flex; gap:20px; justify-content: space-between; padding: 15px;">
                    <div style="width: 49.5%;">
                        <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 10px;">EARNINGS</h3>
                        <div style="display: flex; justify-content: space-between; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; padding: 10px 0; font-weight: bold;">
                            <div>Particular</div>
                            <div>Amount</div>
                        </div>
                        ${earnings.map(e => `
                            <div style="display: flex; justify-content: space-between; padding: 5px 0; font-size: 12px;">
                                <div>${e.name}</div>
                                <div>${formatCurrency(e.amount)}</div>
                            </div>
                        `).join("")}
                    </div>

                    <div style="width: 49.5%;">
                        <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 10px;">DEDUCTIONS</h3>
                        <div style="display: flex; justify-content: space-between; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; padding: 10px 0; font-weight: bold;">
                            <div>Particular</div>
                            <div>Amount</div>
                        </div>
                        ${deductions.map(d => `
                            <div style="display: flex; justify-content: space-between; padding: 5px 0; font-size: 12px;">
                                <div>${d.name}</div>
                                <div>${formatCurrency(d.amount)}</div>
                            </div>
                        `).join("")}
                    </div>
                </div>

                <div style="margin-top: 10px; display: flex; gap:20px; justify-content: space-between; padding: 5px 15px 10px 15px; border-radius: 0 0 20px 20px; font-weight: bold; background:#fff8e1;">
                    <div style="width:49.5%; display: flex; justify-content: space-between; padding: 5px 0;">
                        <div>Gross Earnings:</div>
                        <div>${formatCurrency(grossEarnings)}</div>
                    </div>
                    <div style="width:49.5%; display: flex; justify-content: space-between; padding: 5px 0;">
                        <div>Total Deductions:</div>
                        <div>${formatCurrency(totalDeductions)}</div>
                    </div>
                </div>
            </div>

            <div style="margin-top: 30px; border: 1px solid #c8e6c9; border-radius: 6px; display: flex; justify-content: space-between;">
                <div style="padding: 10px;">
                    <h3 style="font-size: 14px;">TOTAL NET PAYABLE</h3>
                    <p style="font-size: 12px; color: #555;">Gross Earnings - Total Deductions</p>
                </div>
                <div style="background:#fff8e1; padding:10px; display:flex; align-items:center;">
                    <h1 style="font-size: 18px;font-weight:bold;">${formatCurrency(salary.net_payable)}</h1>
                </div>
            </div>

            <div style="text-align:right; margin-top:15px; font-size:12px;">
                <b>Amount In Words:</b> ${amountToWords(salary.net_payable)}
            </div>
        </div>
        `;

        const filename = `payslip-${getMonthName(month)}-${year}-${staff?.first_name || 'emp'}_${staff?.last_name || ''}.pdf`;

        const options = {
            margin: 10,
            filename: filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        };

        const worker = html2pdf().from(element).set(options);

        if (returnBlob) {
            worker.output('blob')
                .then((blob: Blob) => resolve({ blob, filename }))
                .catch((err: any) => reject(err));
        } else {
            worker.save()
                .then(() => resolve(true))
                .catch((err: any) => reject(err));
        }
    });
};

export interface PayslipsZipParams {
    employees: any[];
    month: string | number;
    year: string | number;
    user?: any;
    firmId: string;
    firmName?: string;
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

    const userObj = user || {
        firm_id: {
            firm_id: firmId,
            firm_name: firmName,
        }
    };

    for (const userid of selectedEmployeeIds) {
        try {
            const response = await fetch(`${ATTENDANCE_SERVER_URL}/api/employee_salary/${year}-${formattedMonth}/${userid}/${firmId}`);
            const data = await response.json();

            if (response.ok && data) {
                const salaryData = data.salary || data;
                const staffData = employees?.find((emp) => emp.id === userid) || { name: "Employee", id: userid };
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
