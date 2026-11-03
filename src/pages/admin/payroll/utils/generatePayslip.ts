// Note: This module generates printable PDF payslips using html2pdf.js
import html2pdf from 'html2pdf.js'
import { amountToWords } from './amountToWords'
import rdk, { ATTENDANCE_SERVER_URL, readItem, readItems } from '@/services/server'

function getMonthName(monthNumber: string | number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  const index = parseInt(String(monthNumber), 10) - 1
  return months[index] || ''
}

const formatCurrency = (amount: number | string | null | undefined): string => {
  const num = Number(amount) || 0
  return `₹${num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

// Helper function to check for zero/null/undefined amount
const isValidAmount = (amount: any): boolean => {
  const num = Number(amount)
  return !isNaN(num) && num > 0
}

export const generatePayslip = async (
  salary: any,
  month: string | number,
  year: string | number,
  user: any,
  staff: any,
  onStart?: () => void,
  onFinish?: () => void,
) => {
  if (!salary) return

  if (onStart) onStart()

  // ------------------------------------------------------------
  // RESOLVE FIRM DETAILS (Name, Address, Logo)
  // ------------------------------------------------------------
  let firmName = user?.firm_id?.firm_name || user?.firm_name || ''
  let firmAddress = user?.firm_id?.firm_address || user?.firm_address || ''
  let firmLogo = user?.firm_id?.firm_paid_logo || user?.firm_paid_logo || user?.firm_id?.firm_logo || ''

  const rawFirmId =
    typeof user?.firm_id === 'object'
      ? user?.firm_id?.firm_id
      : user?.firm_id || user?.current_firm_id

  // Check localStorage for cached userData
  if (!firmName || !firmAddress || !firmLogo) {
    try {
      const stored = JSON.parse(localStorage.getItem('userData') || '{}')
      if (stored?.firm_id && typeof stored.firm_id === 'object') {
        firmName = firmName || stored.firm_id.firm_name || ''
        firmAddress = firmAddress || stored.firm_id.firm_address || ''
        firmLogo = firmLogo || stored.firm_id.firm_paid_logo || stored.firm_id.firm_logo || ''
      }
    } catch {
      // ignore
    }
  }

  // If still missing, fetch directly from Directus
  if ((!firmName || !firmAddress || !firmLogo) && rawFirmId) {
    try {
      const res: any = await rdk.request(
        readItem('firms', rawFirmId, {
          fields: ['firm_id', 'firm_name', 'firm_address', 'firm_paid_logo', 'firm_logo'],
        }),
      )
      if (res) {
        firmName = firmName || res.firm_name || ''
        firmAddress = firmAddress || res.firm_address || ''
        firmLogo = firmLogo || res.firm_paid_logo || res.firm_logo || ''
      }
    } catch {
      try {
        const listRes: any = await rdk.request(
          readItems('firms', {
            filter: { firm_id: { _eq: Number(rawFirmId) } },
            fields: ['firm_id', 'firm_name', 'firm_address', 'firm_paid_logo', 'firm_logo'],
            limit: 1,
          }),
        )
        const f = Array.isArray(listRes) ? listRes[0] : listRes?.data?.[0]
        if (f) {
          firmName = firmName || f.firm_name || ''
          firmAddress = firmAddress || f.firm_address || ''
          firmLogo = firmLogo || f.firm_paid_logo || f.firm_logo || ''
        }
      } catch (e) {
        console.warn('Could not fetch firm details for payslip:', e)
      }
    }
  }

  const element = document.createElement('div')

  // ------------------------------------------------------------
  // BUILD EARNINGS ARRAY
  // ------------------------------------------------------------
  const isWeekOffPayment = staff?.week_off_payment || salary?.week_off_payment
  const isWeekOffAsOvertime = staff?.week_off_as_overtime || salary?.week_off_as_overtime
  const isHolidayPayment =
    staff?.holiday_extra_payment || salary?.holiday_extra_payment || salary?.total_holiday_earnings > 0
  const isHolidayAsOvertime =
    staff?.holiday_as_overtime ||
    salary?.holiday_as_overtime ||
    salary?.total_holiday_overtime?.total_amount > 0

  const baseEarnings = [
    {
      name: 'Regular Earnings',
      amount:
        salary.pay_type === 'Hourly' || salary.pay_type === 'hourly'
          ? +salary?.total_hourly_data?.total_amount?.toFixed(2) || 0
          : +(salary?.payable_days * (salary?.basic_salary / (salary?.total_days || 1)))?.toFixed(2) || 0,
    },
    { name: 'Present Day Incentive', amount: salary.total_present_incentive || 0 },
    { name: 'OverTime Earnings', amount: salary.total_ot?.total_amount || 0 },
    { name: 'Total Incentives', amount: salary.total_incentive || 0 },
  ]

  if (isWeekOffPayment) {
    baseEarnings.push({ name: 'Week Off Earnings', amount: salary.total_week_off_earnings || 0 })
  }
  if (isWeekOffAsOvertime) {
    baseEarnings.push({ name: 'Week Off Overtime', amount: salary.total_week_off_overtime?.total_amount || 0 })
  }
  if (isHolidayPayment) {
    baseEarnings.push({ name: 'Holiday Earnings', amount: salary.total_holiday_earnings || 0 })
  }
  if (isHolidayAsOvertime) {
    baseEarnings.push({ name: 'Holiday Overtime', amount: salary.total_holiday_overtime?.total_amount || 0 })
  }

  const dynamicBenefits = (salary.benefits || []).map((b: any) => ({
    name: b.payroll_head_name || 'Benefit',
    amount: Number((b.value || 0).toFixed(2)),
  }))

  // APPLY FILTER: Filter out zero/null amounts
  const earnings = [...baseEarnings, ...dynamicBenefits].filter((e) => isValidAmount(e.amount))
  const grossEarnings = earnings.reduce((sum, e) => sum + (e.amount || 0), 0)

  // ------------------------------------------------------------
  // DEDUCTIONS ARRAY
  // ------------------------------------------------------------
  const dynamicDeductions = (salary.deductions || []).map((item: any) => ({
    name: item.payroll_head_name,
    amount: Number((item.value || 0).toFixed(2)),
  }))

  const advancePayments = (salary.payments_made || []).map((item: any) => ({
    name: `Payments Made : [${item.date}]`,
    amount: Number((item.amount || 0).toFixed(2)),
  }))

  const loans = (salary.loans_emi || []).map((item: any) => ({
    name: item.is_emi ? `${item.loan_title}(EMI)` : item.loan_title,
    amount: item.is_emi ? Number((item.emi_amount || 0).toFixed(2)) : Number((item.loan_amount || 0).toFixed(2)),
  }))

  // APPLY FILTER: Filter out zero/null amounts
  const deductions = [...dynamicDeductions, ...loans, ...advancePayments].filter((d) => isValidAmount(d.amount))
  const totalDeductions = deductions.reduce((sum, d) => sum + (d.amount || 0), 0)

  // ------------------------------------------------------------
  // HTML TEMPLATE (Exact matching v1)
  // ------------------------------------------------------------
  element.innerHTML = `
    <div style="font-family: Arial, sans-serif; width: 720px; padding: 10px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
        <div style="display: flex; gap: 10px;">
          <div style="text-align: center;">
            ${
              firmLogo
                ? `<img src="${ATTENDANCE_SERVER_URL}/assets/${firmLogo}" alt="Logo" style="height: 50px; width: 50px; object-fit: contain;" />`
                : ''
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
            <tr><td style="width: 150px;">Employee Name</td><td>: ${staff?.name || '...'}</td></tr>
            <tr><td>Designation</td><td>: ${staff?.designation || '...'}</td></tr>
            <tr><td>Employee Code</td><td>: ${staff?.employee_code || '...'}</td></tr>
            <tr><td>Date of joining</td><td>: ${staff?.doj || '...'}</td></tr>
            <tr><td>Pay Period</td><td>: ${getMonthName(month)} ${year}</td></tr>
            <tr><td>Pay Cycle</td><td>: From ${salary.pay_cycle_enabled ? salary.pay_cycle_from : '1'} to ${salary.pay_cycle_enabled ? salary.pay_cycle_to : new Date(Number(year), Number(month), 0).getDate()}</td></tr>
            <tr><td>Pan No</td><td>: ${staff?.pan || '...'}</td></tr>
            <tr><td>ESIC No</td><td>: ${staff?.esi_no || '...'}</td></tr>
            <tr><td>PF No</td><td>: ${staff?.pf_no || '...'}</td></tr>
            <tr><td>UAN</td><td>: ${staff?.uan || '...'}</td></tr>
          </table>
        </div>

        <div style="width: 49%; border: 1px solid #ddd; padding: 15px; border-radius: 8px;">
          <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 10px;">ATTENDANCE SUMMARY</h3>
          <table style="width: 100%; font-size: 11px; line-height: 1.5;">
            <tr><td>Total Days</td><td>: ${salary.total_days || '...'}</td></tr>
            <tr><td>Present Days</td><td>: ${(salary.present_days || 0) - (salary.half_days || 0)}</td></tr>
            <tr><td>Present in Week Offs</td><td>: ${salary.present_week_offs || '...'}</td></tr>
            <tr><td>Present in Holidays</td><td>: ${salary.present_holidays || '...'}</td></tr>
            <tr><td>Absent Days</td><td>: ${salary.absent_days || '...'}</td></tr>
            <tr><td>Half Days</td><td>: ${salary.half_days || '...'}</td></tr>
            <tr><td>Leave Days</td><td>: ${salary.leave_days || '...'}</td></tr>
            <tr><td>Holidays</td><td>: ${salary.holidays || '...'}</td></tr>
            <tr><td>Week Off Days</td><td>: ${salary.week_offs || '...'}</td></tr>
            <tr><td>Payable Days</td><td>: ${salary.payable_days || '...'}</td></tr>
            ${salary.total_ot?.hours_worked > 0 ? `<tr><td>OverTime Hours</td><td>: ${salary.total_ot.hours_worked.toFixed(2)} hrs</td></tr>` : ''}
            ${isWeekOffAsOvertime && salary.total_week_off_overtime?.hours_worked > 0 ? `<tr><td>Week Off Overtime Hours</td><td>: ${salary.total_week_off_overtime.hours_worked.toFixed(2)} hrs</td></tr>` : ''}
            ${isHolidayAsOvertime && salary.total_holiday_overtime?.hours_worked > 0 ? `<tr><td>Holiday Overtime Hours</td><td>: ${salary.total_holiday_overtime.hours_worked.toFixed(2)} hrs</td></tr>` : ''}
            ${salary.total_hourly_data?.hours_worked > 0 ? `<tr><td>Total Hours Worked</td><td>: ${salary.total_hourly_data.hours_worked.toFixed(2)} hrs</td></tr>` : ''}
          </table>
        </div>
      </div>

      <div style="margin-top: 30px; border: 1px solid #ddd; border-radius: 20px;">
        <div style="display: flex; gap: 20px; justify-content: space-between; padding: 15px;">
          <div style="width: 49.5%;">
            <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 10px;">EARNINGS</h3>
            <div style="display: flex; justify-content: space-between; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; padding: 10px 0; font-weight: bold;">
              <div>Particular</div>
              <div>Amount</div>
            </div>
            ${earnings
              .map(
                (e) => `
              <div style="display: flex; justify-content: space-between; padding: 5px 0; font-size: 12px;">
                <div>${e.name}</div>
                <div>${formatCurrency(e.amount)}</div>
              </div>
            `,
              )
              .join('')}
          </div>

          <div style="width: 49.5%;">
            <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 10px;">DEDUCTIONS</h3>
            <div style="display: flex; justify-content: space-between; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; padding: 10px 0; font-weight: bold;">
              <div>Particular</div>
              <div>Amount</div>
            </div>
            ${deductions
              .map(
                (d) => `
              <div style="display: flex; justify-content: space-between; padding: 5px 0; font-size: 12px;">
                <div>${d.name}</div>
                <div>${formatCurrency(d.amount)}</div>
              </div>
            `,
              )
              .join('')}
          </div>
        </div>

        <div style="margin-top: 10px; display: flex; gap: 20px; justify-content: space-between; padding: 5px 15px 10px 15px; border-radius: 0 0 20px 20px; font-weight: bold; background: #fff8e1;">
          <div style="width: 49.5%; display: flex; justify-content: space-between; padding: 5px 0;">
            <div>Gross Earnings:</div>
            <div>${formatCurrency(grossEarnings)}</div>
          </div>
          <div style="width: 49.5%; display: flex; justify-content: space-between; padding: 5px 0;">
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
        <div style="background: #fff8e1; padding: 10px; display: flex; align-items: center;">
          <h1 style="font-size: 18px; font-weight: bold;">${formatCurrency(salary.net_payable)}</h1>
        </div>
      </div>

      <div style="text-align: right; margin-top: 15px; font-size: 12px;">
        <b>Amount In Words:</b> ${amountToWords(salary.net_payable)}
      </div>
    </div>
  `

  // PDF GENERATION
  const options = {
    margin: 10,
    filename: `payslip-${getMonthName(month)}-${year}-${staff?.name || 'employee'}.pdf`,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
  }

  html2pdf()
    .from(element)
    .set(options)
    .save()
    .then(() => onFinish && onFinish())
    .catch(() => onFinish && onFinish())
}
