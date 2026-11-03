import html2pdf from 'html2pdf.js'
import { amountToWords } from './amountToWords'
import { ATTENDANCE_SERVER_URL } from '@/services/server'

function getMonthName(monthNumber: string | number): string {
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]
  const index = parseInt(String(monthNumber), 10) - 1
  return months[index] || ''
}

const formatCurrency = (amount: number | string | null | undefined): string => {
  const num = Number(amount) || 0
  return `₹${num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

const isValidAmount = (amount: any): boolean => {
  const num = Number(amount)
  return !isNaN(num) && num > 0
}

export const generatePayslip = (
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

  const element = document.createElement('div')

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

  const earnings = [...baseEarnings, ...dynamicBenefits].filter((e) => isValidAmount(e.amount))
  const grossEarnings = earnings.reduce((sum, e) => sum + (e.amount || 0), 0)

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

  const deductions = [...dynamicDeductions, ...loans, ...advancePayments].filter((d) => isValidAmount(d.amount))
  const totalDeductions = deductions.reduce((sum, d) => sum + (d.amount || 0), 0)

  element.innerHTML = `
    <div style="font-family: Arial, sans-serif; width: 720px; padding: 10px; color: #111;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
        <div style="display: flex; gap: 10px;">
          <div style="text-align: center;">
            ${
              user?.firm_id?.firm_paid_logo
                ? `<img src="${ATTENDANCE_SERVER_URL}/assets/${user.firm_id.firm_paid_logo}" alt="Logo" style="height: 50px; width: 50px; object-fit: contain;" />`
                : ''
            }
          </div>
          <div>
            <h1 style="font-size: 20px; font-weight: bold; margin: 0;">${user?.firm_id?.firm_name || ''}</h1>
            <div style="width: 70%; font-size: 14px; color: #555;">${user?.firm_id?.firm_address || ''}</div>
          </div>
        </div>
        <div style="text-align: right;">
          <p style="font-size: 14px; margin: 0; color: #555;">Payslip For the Month</p>
          <h2 style="font-size: 16px; font-weight: bold; margin: 0; color: #333;">${getMonthName(month)} ${year}</h2>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; margin-top: 24px; gap: 2%;">
        <div style="width: 49%; border: 1px solid #ddd; padding: 15px; border-radius: 8px;">
          <h3 style="font-size: 15px; font-weight: bold; margin-bottom: 10px;">EMPLOYEE SUMMARY</h3>
          <table style="width: 100%; font-size: 11px; line-height: 1.6;">
            <tr><td style="width: 140px; color: #555;">Employee Name</td><td>: <b>${staff?.name || '...'}</b></td></tr>
            <tr><td style="color: #555;">Designation</td><td>: ${staff?.designation || '...'}</td></tr>
            <tr><td style="color: #555;">Employee Code</td><td>: ${staff?.employee_code || '...'}</td></tr>
            <tr><td style="color: #555;">Date of joining</td><td>: ${staff?.doj || '...'}</td></tr>
            <tr><td style="color: #555;">Pay Period</td><td>: ${getMonthName(month)} ${year}</td></tr>
            <tr><td style="color: #555;">Pay Cycle</td><td>: From ${salary.pay_cycle_enabled ? salary.pay_cycle_from : '1'} to ${salary.pay_cycle_enabled ? salary.pay_cycle_to : new Date(Number(year), Number(month), 0).getDate()}</td></tr>
            <tr><td style="color: #555;">Pan No</td><td>: ${staff?.pan || '...'}</td></tr>
            <tr><td style="color: #555;">ESIC No</td><td>: ${staff?.esi_no || '...'}</td></tr>
            <tr><td style="color: #555;">PF No</td><td>: ${staff?.pf_no || '...'}</td></tr>
            <tr><td style="color: #555;">UAN</td><td>: ${staff?.uan || '...'}</td></tr>
          </table>
        </div>
        
        <div style="width: 49%; border: 1px solid #ddd; padding: 15px; border-radius: 8px;">
          <h3 style="font-size: 15px; font-weight: bold; margin-bottom: 10px;">ATTENDANCE SUMMARY</h3>
          <table style="width: 100%; font-size: 11px; line-height: 1.6;">
            <tr><td style="width: 140px; color: #555;">Total Days</td><td>: ${salary.total_days || '...'}</td></tr>
            <tr><td style="color: #555;">Present Days</td><td>: ${(salary.present_days || 0) - (salary.half_days || 0)}</td></tr>
            <tr><td style="color: #555;">Present in Week Offs</td><td>: ${salary.present_week_offs || '0'}</td></tr>
            <tr><td style="color: #555;">Present in Holidays</td><td>: ${salary.present_holidays || '0'}</td></tr>
            <tr><td style="color: #555;">Absent Days</td><td>: ${salary.absent_days || '0'}</td></tr>
            <tr><td style="color: #555;">Half Days</td><td>: ${salary.half_days || '0'}</td></tr>
            <tr><td style="color: #555;">Leave Days</td><td>: ${salary.leave_days || '0'}</td></tr>
            <tr><td style="color: #555;">Holidays</td><td>: ${salary.holidays || '0'}</td></tr>
            <tr><td style="color: #555;">Week Off Days</td><td>: ${salary.week_offs || '0'}</td></tr>
            <tr><td style="color: #555;">Payable Days</td><td>: <b>${salary.payable_days || '0'}</b></td></tr>
            ${salary.total_ot?.hours_worked > 0 ? `<tr><td style="color: #555;">OverTime Hours</td><td>: ${salary.total_ot.hours_worked.toFixed(2)} hrs</td></tr>` : ''}
            ${isWeekOffAsOvertime && salary.total_week_off_overtime?.hours_worked > 0 ? `<tr><td style="color: #555;">Week Off Overtime</td><td>: ${salary.total_week_off_overtime.hours_worked.toFixed(2)} hrs</td></tr>` : ''}
            ${isHolidayAsOvertime && salary.total_holiday_overtime?.hours_worked > 0 ? `<tr><td style="color: #555;">Holiday Overtime</td><td>: ${salary.total_holiday_overtime.hours_worked.toFixed(2)} hrs</td></tr>` : ''}
            ${salary.total_hourly_data?.hours_worked > 0 ? `<tr><td style="color: #555;">Total Hours Worked</td><td>: ${salary.total_hourly_data.hours_worked.toFixed(2)} hrs</td></tr>` : ''}
          </table>
        </div>
      </div>

      <div style="margin-top: 24px; border: 1px solid #ddd; border-radius: 12px; overflow: hidden;">
        <div style="display: flex; gap: 20px; justify-content: space-between; padding: 15px;">
          <div style="width: 49.5%;">
            <h3 style="font-size: 15px; font-weight: bold; margin-bottom: 10px; color: #16a34a;">EARNINGS</h3>
            <div style="display: flex; justify-content: space-between; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; padding: 8px 0; font-weight: bold; font-size: 12px;">
              <div>Particular</div>
              <div>Amount</div>
            </div>
            ${earnings
              .map(
                (e) => `
                <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; border-bottom: 1px dashed #f0f0f0;">
                  <div>${e.name}</div>
                  <div>${formatCurrency(e.amount)}</div>
                </div>
              `,
              )
              .join('')}
          </div>

          <div style="width: 49.5%;">
            <h3 style="font-size: 15px; font-weight: bold; margin-bottom: 10px; color: #dc2626;">DEDUCTIONS</h3>
            <div style="display: flex; justify-content: space-between; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; padding: 8px 0; font-weight: bold; font-size: 12px;">
              <div>Particular</div>
              <div>Amount</div>
            </div>
            ${deductions
              .map(
                (d) => `
                <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; border-bottom: 1px dashed #f0f0f0;">
                  <div>${d.name}</div>
                  <div>${formatCurrency(d.amount)}</div>
                </div>
              `,
              )
              .join('')}
          </div>
        </div>

        <div style="display: flex; gap: 20px; justify-content: space-between; padding: 10px 15px; font-weight: bold; background: #fff8e1; border-top: 1px solid #ddd;">
          <div style="width: 49.5%; display: flex; justify-content: space-between; font-size: 12px;">
            <div>Gross Earnings:</div>
            <div>${formatCurrency(grossEarnings)}</div>
          </div>
          <div style="width: 49.5%; display: flex; justify-content: space-between; font-size: 12px;">
            <div>Total Deductions:</div>
            <div>${formatCurrency(totalDeductions)}</div>
          </div>
        </div>
      </div>

      <div style="margin-top: 24px; border: 1px solid #c8e6c9; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; overflow: hidden;">
        <div style="padding: 12px 16px;">
          <h3 style="font-size: 14px; font-weight: bold; margin: 0;">TOTAL NET PAYABLE</h3>
          <p style="font-size: 12px; color: #555; margin: 2px 0 0 0;">Gross Earnings - Total Deductions</p>
        </div>
        <div style="background: #e8f5e9; padding: 12px 20px; height: 100%; display: flex; align-items: center;">
          <h1 style="font-size: 20px; font-weight: bold; color: #1b5e20; margin: 0;">${formatCurrency(salary.net_payable)}</h1>
        </div>
      </div>

      <div style="text-align: right; margin-top: 15px; font-size: 12px; color: #333;">
        <b>Amount In Words:</b> ${amountToWords(salary.net_payable)}
      </div>
    </div>
  `

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
    .catch((err: any) => {
      console.error('Payslip PDF error:', err)
      onFinish && onFinish()
    })
}
