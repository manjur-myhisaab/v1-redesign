import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

export const handleGenerateExcel = async (
  allPayslips: any[],
  month: string,
  year: string | number,
  firmName: string,
) => {
  const formatCurrency = (amount: any) => {
    if (amount === null || amount === undefined) return '-'
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount)
  }

  const formatPayrollDetails = (items: any[]) => {
    return (items || [])
      .map((item) => `${item.name}: ${formatCurrency(item.amount)}`)
      .join('\r\n')
  }

  const formatDate = (dateString: any) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  try {
    if (!allPayslips || allPayslips.length === 0) {
      throw new Error('No payslip data found to export.')
    }

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet(`Payslips - ${month}`)

    const headingFont = { bold: true, size: 14 }
    const subheadingFont = { bold: true, size: 12 }

    const columnsDefinition: any[] = [
      { header: 'Employee Name', key: 'employee_name', width: 25 },
      { header: 'Employee ID', key: 'employee_no', width: 15 },
      { header: 'Designation', key: 'designation', width: 20 },
      { header: 'Date of Joining', key: 'doj', width: 20 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Pay Type', key: 'pay_type', width: 15 },
      { header: 'Rate(/hour or /day)', key: 'rate', width: 20 },
      { header: 'Total Hours Worked', key: 'total_hours_worked', width: 20 },
      { header: 'Monthly CTC (INR)', key: 'monthly_salary', width: 20 },
      { header: 'Basic Pay (INR)', key: 'basic_pay', width: 20 },
      { header: 'Absent Days', key: 'absent_days', width: 15 },
      { header: 'Half Days', key: 'half_days', width: 15 },
      { header: 'Leave Days', key: 'leave_days', width: 15 },
      { header: 'Holidays', key: 'holidays', width: 15 },
      { header: 'Present in Holidays', key: 'present_holidays', width: 18 },
      { header: 'Week Off Days', key: 'week_offs', width: 15 },
      { header: 'Present in Week Offs', key: 'present_week_offs', width: 18 },
      { header: 'Payable Days', key: 'payable_days', width: 15 },
      { header: 'Gross Earnings (INR)', key: 'regular_earnings', width: 20 },
      { header: 'Total Benefits (INR)', key: 'total_benefits', width: 20 },
      { header: 'Benefit Breakdown', key: 'benefit_breakdown', width: 40, alignment: { wrapText: true } },
      { header: 'Total Deductions (INR)', key: 'total_deductions', width: 20 },
      { header: 'Deduction Breakdown', key: 'deduction_breakdown', width: 40, alignment: { wrapText: true } },
      { header: 'Incentive Breakdown', key: 'incentive_breakdown', width: 40, alignment: { wrapText: true } },
      { header: 'Total Overtime Hours', key: 'total_overtime_hours', width: 20 },
      { header: 'Overtime Pay (INR)', key: 'total_overtime', width: 20 },
      { header: 'Total Week Off Earnings (INR)', key: 'total_week_off_earnings', width: 25 },
      { header: 'Total Holiday Earnings (INR)', key: 'total_holiday_earnings', width: 25 },
      { header: 'Total Incentive (INR)', key: 'total_incentive', width: 25 },
      { header: 'Net Payable (INR)', key: 'net_payable', width: 20 },
      { header: 'Status', key: 'status', width: 15 },
    ]

    worksheet.columns = columnsDefinition

    const totalColumns = columnsDefinition.length
    const lastColLetter = worksheet.getColumn(totalColumns).letter

    worksheet.mergeCells(`A1:${lastColLetter}1`)
    worksheet.getCell('A1').value = firmName
    worksheet.getCell('A1').font = headingFont
    worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' }

    worksheet.mergeCells(`A2:${lastColLetter}2`)
    worksheet.getCell('A2').value = `Payslip Report for ${month} ${year}`
    worksheet.getCell('A2').font = subheadingFont
    worksheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' }
    worksheet.addRow([])

    const headerRow = worksheet.getRow(4)
    headerRow.values = columnsDefinition.map((col) => col.header)

    for (let colNumber = 1; colNumber <= totalColumns; colNumber++) {
      const cell = headerRow.getCell(colNumber)
      cell.font = { bold: true, size: 10 }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      }
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      }
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    }

    worksheet.views = [{ state: 'frozen', ySplit: 4 }]

    allPayslips.forEach((payslip) => {
      const allowancesList = [
        ...(payslip.salary?.benefits || []).map((d: any) => ({
          name: d.payroll_head_name || d.name || 'Benefit',
          amount: Number(d.value !== undefined ? d.value : d.amount) || 0,
        })),
        ...(payslip.salary?.other_benefits || []).map((d: any) => ({
          name: d.payroll_head_name || d.name || d.title || 'Other Benefit',
          amount: Number(d.value !== undefined ? d.value : d.amount) || 0,
        })),
      ].filter((b) => b.amount > 0)

      const totalBenefitsCalculated = allowancesList.reduce((sum, item) => sum + item.amount, 0)
      const totalBenefits =
        totalBenefitsCalculated > 0
          ? totalBenefitsCalculated
          : (Number(payslip.salary?.total_benefits) || 0) + (Number(payslip.salary?.total_other_benefits) || 0)

      const deductionsList = [
        ...(payslip.salary?.deductions || []).map((d: any) => ({
          name: d.payroll_head_name || d.name || 'Deduction',
          amount: Number(d.value !== undefined ? d.value : d.amount) || 0,
        })),
        ...(payslip.salary?.other_deductions || []).map((d: any) => ({
          name: d.payroll_head_name || d.name || d.title || 'Other Deduction',
          amount: Number(d.value !== undefined ? d.value : d.amount) || 0,
        })),
        ...(payslip.salary?.loans_emi || []).map((l: any) => ({
          name: `${l.loan_title || 'Loan'} (Loan/EMI)`,
          amount: Number(l.is_emi ? l.emi_amount : l.emi_amount || l.loan_amount || l.amount) || 0,
        })),
        ...(payslip.salary?.payments_made || []).map((p: any) => ({
          name: `${p.remarks || (p.date ? `Advance [${p.date}]` : 'Advance Payment')}`,
          amount: Number(p.amount !== undefined ? p.amount : p.value) || 0,
        })),
      ].filter((d) => d.amount > 0)

      const totalDeductionsCalculated = deductionsList.reduce((sum, item) => sum + item.amount, 0)
      const totalDeductions =
        totalDeductionsCalculated > 0
          ? totalDeductionsCalculated
          : (Number(payslip.salary?.total_deductions) || 0) +
            (Number(payslip.salary?.total_loan_amount) || 0) +
            (Number(payslip.salary?.total_payments_made) || 0)

      const incentivesList = [
        ...(payslip.salary?.incentives || []).map((d: any) => ({
          name: `${d.incentive_date || d.date || 'Incentive'}`,
          amount: Number(d.incentive_amount !== undefined ? d.incentive_amount : d.amount) || 0,
        })),
        ...(payslip.salary?.present_incentives || []).map((d: any) => ({
          name: `${d.date || d.date_string || 'Present Incentive'} (PI)`,
          amount: Number(d.amount) || 0,
        })),
      ].filter((inc) => inc.amount > 0)

      const totalIncentivesCalculated = incentivesList.reduce((sum, item) => sum + item.amount, 0)
      const totalIncentive =
        totalIncentivesCalculated > 0
          ? totalIncentivesCalculated
          : (Number(payslip.salary?.total_incentive) || 0) + (Number(payslip.salary?.total_present_incentive) || 0)

      const row = worksheet.addRow({
        employee_name: `${payslip.employee?.first_name || ''} ${payslip.employee?.last_name || ''}`.trim() || '',
        employee_no: payslip.employee?.employee_code || '',
        designation: payslip.employee?.title || '',
        doj: formatDate(payslip.employee?.doj) || '',
        category: payslip.employee?.employee_category_id?.employee_category_name || '',
        department: payslip.employee?.department_name || '',
        pay_type: payslip.salary?.pay_type || '',
        rate:
          payslip.salary?.pay_type === 'Hourly' || payslip.salary?.pay_type === 'hourly'
            ? `${payslip.salary?.hourly_salary}/hr`
            : payslip.salary?.pay_type === 'Daily' || payslip.salary?.pay_type === 'daily'
              ? `${payslip.salary?.daily_salary}/day`
              : payslip.salary?.pay_type === 'Monthly' || payslip.salary?.pay_type === 'monthly'
                ? `${payslip.salary?.daily_salary}/day`
                : '...',
        total_hours_worked:
          payslip.salary?.total_hourly_data &&
          Object.keys(payslip.salary.total_hourly_data).length > 0 &&
          typeof payslip.salary.total_hourly_data.hours_worked === 'number'
            ? `${payslip.salary.total_hourly_data.hours_worked.toFixed(2)} hrs`
            : '',
        monthly_salary:
          payslip.salary?.pay_type === 'Hourly' || payslip.salary?.pay_type === 'hourly'
            ? ''
            : payslip.salary?.ctc,
        basic_pay:
          payslip.salary?.pay_type === 'Hourly' || payslip.salary?.pay_type === 'hourly'
            ? ''
            : payslip.salary?.basic_salary,
        absent_days: payslip.salary?.absent_days ?? 0,
        half_days: payslip.salary?.half_days ?? 0,
        leave_days: payslip.salary?.leave_days ?? 0,
        holidays: payslip.salary?.holidays ?? 0,
        present_holidays: payslip.salary?.present_holidays ?? 0,
        week_offs: payslip.salary?.week_offs ?? 0,
        present_week_offs: payslip.salary?.present_week_offs ?? 0,
        payable_days: payslip.salary?.payable_days ?? 0,
        regular_earnings: payslip.salary?.regular_earnings ?? 0,
        total_benefits: totalBenefits,
        benefit_breakdown: formatPayrollDetails(allowancesList),
        total_deductions: totalDeductions,
        deduction_breakdown: formatPayrollDetails(deductionsList),
        incentive_breakdown: formatPayrollDetails(incentivesList),
        total_overtime_hours: payslip.salary?.total_ot?.hours_worked ?? 0,
        total_overtime: payslip.salary?.total_ot?.total_amount ?? 0,
        total_week_off_earnings:
          payslip.employee?.week_off_as_overtime || payslip.salary?.week_off_as_overtime
            ? payslip.salary?.total_week_off_overtime?.total_amount || 0
            : payslip.employee?.week_off_payment || payslip.salary?.week_off_payment
              ? payslip.salary?.total_week_off_earnings || 0
              : 0,
        total_holiday_earnings:
          payslip.employee?.holiday_as_overtime || payslip.salary?.holiday_as_overtime
            ? payslip.salary?.total_holiday_overtime?.total_amount || 0
            : payslip.employee?.holiday_extra_payment || payslip.salary?.holiday_extra_payment
              ? payslip.salary?.total_holiday_earnings || 0
              : payslip.salary?.total_holiday_earnings || 0,
        total_incentive: totalIncentive,
        net_payable: payslip.salary?.net_payable ?? 0,
        status: payslip.status ? payslip.status.replace(/_/g, ' ') : '-',
      })

      for (let colNumber = 1; colNumber <= totalColumns; colNumber++) {
        const cell = row.getCell(colNumber)
        cell.font = { size: 10 }
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        }
        cell.alignment = { vertical: 'top', wrapText: true }
      }
    })

    const currencyKeys = [
      'rate',
      'monthly_salary',
      'basic_pay',
      'regular_earnings',
      'total_benefits',
      'total_deductions',
      'total_overtime',
      'total_week_off_earnings',
      'total_holiday_earnings',
      'total_incentive',
      'net_payable',
    ]

    const dayCountKeys = [
      'absent_days',
      'half_days',
      'leave_days',
      'holidays',
      'present_holidays',
      'week_offs',
      'present_week_offs',
      'payable_days',
      'total_overtime_hours',
    ]

    columnsDefinition.forEach((colDef, idx) => {
      const colNumber = idx + 1
      const column = worksheet.getColumn(colNumber)

      if (currencyKeys.includes(colDef.key)) {
        column.numFmt = '#,##0.00'
        column.alignment = { horizontal: 'right', vertical: 'top' }
      } else if (dayCountKeys.includes(colDef.key)) {
        column.numFmt = '#,##0.0'
        column.alignment = { horizontal: 'center', vertical: 'top' }
      }
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const fileName = `Payslip_Report_${month}_${year}.xlsx`
    saveAs(blob, fileName)
  } catch (err: any) {
    console.error('Excel Generation Error:', err)
    throw err
  }
}
