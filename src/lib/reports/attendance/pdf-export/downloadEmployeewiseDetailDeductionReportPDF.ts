// @ts-nocheck
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const SAMPLE_DEDUCTION_REPORT_DATA = {
    employeeInfo: {
        empCodeName: "PCS-0071-Test Aniket",
        totalDaysInMonth: "31",
        branch: "Phantom Cyber Securities",
        salary: "15000.00 / Monthly",
        presentDays: "15.5",
        department: "Sales Department",
        salaryOfDay: "15000/26 = 576.92",
        paidDaysWOPH: "4",
        rule: "test omkar",
        salaryOfHour: "52.4476",
        absentDays: "7",
        timing: "10:00am TO 09:00pm(11:00Hours / Break Hours:00:30)",
        otDays: "1.0",
        paidDays: "16.5",
        joining: "01/08/2026",
    },
    salarySummary: {
        openingBalance: "0 C Pending",
        totalSalary: "(+) 8886",
        bonusAllowance: "(+) 0",
        advLoanDeduction: "(-) 0",
        salaryToPay: "8886 C Pending",
    },
    loanSummary: {
        totalLoanGiven: "0",
        totalLoanDeducted: "0",
        pendingLoan: "0 C",
    },
    totalDeductionsText: "Late Fine: 588.46, Excess Break: 180.00",
    totalAdditionsText: "Overtime: 711.92",
    loansEmiText: "Advance Loan: 0.00",
    incentivesText: "Monthly Bonus: 0.00",
    meta: {
        reportGeneratedOn: "27/08/2026 13:38:25",
        lastPostedOn: "27/08/2026 13:38:25",
        pageNum: "# 1/1",
    },
    rows: [
        {
            date: "01 Aug | Sat",
            status: "Present",
            inTime: "10:00am",
            outTime: "09:00pm",
            workHour: "11:00",
            breaks: "01:00pm-02:00pm",
            breakHour: "01:00",
            excessFlag: "Y",
            excessHour: "00:30",
            excessAmt: "30.00",
            workHourAfterBreak: "10:00",
            lateFlag: "",
            lateHour: "",
            lateAmt: "",
            earlyHour: "",
            earlyAmt: "",
            otFlag: "",
            otHour: "",
            otAmt: "",
            earlyOtHour: "",
            earlyOtAmt: "",
            totalDeduction: "30.00",
            totalAddition: "",
            payableSalary: "546.92",
        },
        {
            date: "02 Aug | Sun",
            status: "Weekly Off 1",
            inTime: "",
            outTime: "",
            workHour: "",
            breaks: "",
            breakHour: "",
            excessFlag: "",
            excessHour: "",
            excessAmt: "",
            workHourAfterBreak: "",
            lateFlag: "",
            lateHour: "",
            lateAmt: "",
            earlyHour: "",
            earlyAmt: "",
            otFlag: "",
            otHour: "",
            otAmt: "",
            earlyOtHour: "",
            earlyOtAmt: "",
            totalDeduction: "",
            totalAddition: "",
            payableSalary: "0.00",
        },
        {
            date: "03 Aug | Mon",
            status: "Present|Late",
            inTime: "10:30am",
            outTime: "09:00pm",
            workHour: "10:30",
            breaks: "03:00pm-03:30pm",
            breakHour: "00:30",
            excessFlag: "",
            excessHour: "",
            excessAmt: "",
            workHourAfterBreak: "10:00",
            lateFlag: "Y",
            lateHour: "00:30",
            lateAmt: "",
            earlyHour: "",
            earlyAmt: "",
            otFlag: "",
            otHour: "",
            otAmt: "",
            earlyOtHour: "",
            earlyOtAmt: "",
            totalDeduction: "",
            totalAddition: "",
            payableSalary: "576.92",
        },
        {
            date: "04 Aug | Tue",
            status: "Present|Late",
            inTime: "10:45am",
            outTime: "09:45pm",
            workHour: "11:00",
            breaks: "03:00pm-03:30pm",
            breakHour: "00:30",
            excessFlag: "",
            excessHour: "",
            excessAmt: "",
            workHourAfterBreak: "10:30",
            lateFlag: "Y",
            lateHour: "00:45",
            lateAmt: "",
            earlyHour: "",
            earlyAmt: "",
            otFlag: "Y",
            otHour: "00:45",
            otAmt: "45.00",
            earlyOtHour: "",
            earlyOtAmt: "",
            totalDeduction: "",
            totalAddition: "45.00",
            payableSalary: "621.92",
        },
        {
            date: "05 Aug | Wed",
            status: "Present",
            inTime: "10:00am",
            outTime: "09:00pm",
            workHour: "11:00",
            breaks: "03:00pm-03:30pm,07:00pm-07:30pm",
            breakHour: "01:00",
            excessFlag: "Y",
            excessHour: "00:30",
            excessAmt: "30.00",
            workHourAfterBreak: "10:00",
            lateFlag: "",
            lateHour: "",
            lateAmt: "",
            earlyHour: "",
            earlyAmt: "",
            otFlag: "",
            otHour: "",
            otAmt: "",
            earlyOtHour: "",
            earlyOtAmt: "",
            totalDeduction: "30.00",
            totalAddition: "",
            payableSalary: "546.92",
        },
        {
            date: "06 Aug | Thu",
            status: "Present|Late",
            inTime: "10:55am",
            outTime: "09:00pm",
            workHour: "10:05",
            breaks: "12:00pm-12:30pm,03:00pm-03:30pm,07:00pm-07:30pm",
            breakHour: "01:30",
            excessFlag: "Y",
            excessHour: "01:00",
            excessAmt: "60.00",
            workHourAfterBreak: "08:35",
            lateFlag: "Y",
            lateHour: "00:55",
            lateAmt: "",
            earlyHour: "",
            earlyAmt: "",
            otFlag: "",
            otHour: "",
            otAmt: "",
            earlyOtHour: "",
            earlyOtAmt: "",
            totalDeduction: "60.00",
            totalAddition: "",
            payableSalary: "516.92",
        },
        {
            date: "07 Aug | Fri",
            status: "Present|Late",
            inTime: "10:30am",
            outTime: "09:45pm",
            workHour: "11:15",
            breaks: "12:00pm-12:30pm,03:00pm-03:30pm,07:00pm-07:30pm",
            breakHour: "01:30",
            excessFlag: "Y",
            excessHour: "01:00",
            excessAmt: "60.00",
            workHourAfterBreak: "09:45",
            lateFlag: "Y",
            lateHour: "00:30",
            lateAmt: "",
            earlyHour: "",
            earlyAmt: "",
            otFlag: "Y",
            otHour: "00:45",
            otAmt: "45.00",
            earlyOtHour: "",
            earlyOtAmt: "",
            totalDeduction: "60.00",
            totalAddition: "45.00",
            payableSalary: "561.92",
        },
        {
            date: "08 Aug | Sat",
            status: "Present|Late",
            inTime: "11:00am",
            outTime: "09:00pm",
            workHour: "10:00",
            breaks: "03:00pm-03:30pm",
            breakHour: "00:30",
            excessFlag: "",
            excessHour: "",
            excessAmt: "",
            workHourAfterBreak: "09:30",
            lateFlag: "Y",
            lateHour: "01:00",
            lateAmt: "",
            earlyHour: "",
            earlyAmt: "",
            otFlag: "",
            otHour: "",
            otAmt: "",
            earlyOtHour: "",
            earlyOtAmt: "",
            totalDeduction: "",
            totalAddition: "",
            payableSalary: "576.92",
        },
        {
            date: "09 Aug | Sun",
            status: "WO . Over",
            inTime: "10:00am",
            outTime: "09:00pm",
            workHour: "11:00",
            breaks: "03:00pm-03:30pm",
            breakHour: "00:30",
            excessFlag: "",
            excessHour: "",
            excessAmt: "",
            workHourAfterBreak: "10:30",
            lateFlag: "",
            lateHour: "",
            lateAmt: "",
            earlyHour: "",
            earlyAmt: "",
            otFlag: "Y",
            otHour: "11:00",
            otAmt: "578.92",
            earlyOtHour: "",
            earlyOtAmt: "",
            totalDeduction: "",
            totalAddition: "578.92",
            payableSalary: "576.92",
        },
        {
            date: "10 Aug | Mon",
            status: "Present|Late",
            inTime: "12:00pm",
            outTime: "09:00pm",
            workHour: "09:00",
            breaks: "03:00pm-03:30pm",
            breakHour: "00:30",
            excessFlag: "",
            excessHour: "",
            excessAmt: "",
            workHourAfterBreak: "08:30",
            lateFlag: "Y",
            lateHour: "02:00",
            lateAmt: "",
            earlyHour: "",
            earlyAmt: "",
            otFlag: "",
            otHour: "",
            otAmt: "",
            earlyOtHour: "",
            earlyOtAmt: "",
            totalDeduction: "",
            totalAddition: "",
            payableSalary: "576.92",
        },
        {
            date: "11 Aug | Tue",
            status: "Present|Late",
            inTime: "03:00pm",
            outTime: "09:00pm",
            workHour: "06:00",
            breaks: "",
            breakHour: "",
            excessFlag: "",
            excessHour: "",
            excessAmt: "",
            workHourAfterBreak: "06:00",
            lateFlag: "Y",
            lateHour: "05:00",
            lateAmt: "288.46",
            earlyHour: "",
            earlyAmt: "",
            otFlag: "",
            otHour: "",
            otAmt: "",
            earlyOtHour: "",
            earlyOtAmt: "",
            totalDeduction: "288.46",
            totalAddition: "",
            payableSalary: "288.46",
        },
        {
            date: "12 Aug | Wed",
            status: "Half Day",
            inTime: "04:00pm",
            outTime: "09:00pm",
            workHour: "05:00",
            breaks: "",
            breakHour: "",
            excessFlag: "",
            excessHour: "",
            excessAmt: "",
            workHourAfterBreak: "05:00",
            lateFlag: "",
            lateHour: "",
            lateAmt: "",
            earlyHour: "",
            earlyAmt: "",
            otFlag: "",
            otHour: "",
            otAmt: "",
            earlyOtHour: "",
            earlyOtAmt: "",
            totalDeduction: "",
            totalAddition: "",
            payableSalary: "288.46",
        },
        {
            date: "13 Aug | Thu",
            status: "Present",
            inTime: "10:00am",
            outTime: "09:00pm",
            workHour: "11:00",
            breaks: "03:00pm-03:30pm",
            breakHour: "00:30",
            excessFlag: "",
            excessHour: "",
            excessAmt: "",
            workHourAfterBreak: "10:30",
            lateFlag: "",
            lateHour: "",
            lateAmt: "",
            earlyHour: "",
            earlyAmt: "",
            otFlag: "",
            otHour: "",
            otAmt: "",
            earlyOtHour: "",
            earlyOtAmt: "",
            totalDeduction: "",
            totalAddition: "",
            payableSalary: "576.92",
        },
        {
            date: "14 Aug | Fri",
            status: "Present",
            inTime: "10:00am",
            outTime: "09:00pm",
            workHour: "11:00",
            breaks: "03:00pm-03:30pm",
            breakHour: "00:30",
            excessFlag: "",
            excessHour: "",
            excessAmt: "",
            workHourAfterBreak: "10:30",
            lateFlag: "",
            lateHour: "",
            lateAmt: "",
            earlyHour: "",
            earlyAmt: "",
            otFlag: "",
            otHour: "",
            otAmt: "",
            earlyOtHour: "",
            earlyOtAmt: "",
            totalDeduction: "",
            totalAddition: "",
            payableSalary: "576.92",
        },
        {
            date: "15 Aug | Sat",
            status: "Absent",
            inTime: "",
            outTime: "",
            workHour: "",
            breaks: "",
            breakHour: "",
            excessFlag: "",
            excessHour: "",
            excessAmt: "",
            workHourAfterBreak: "",
            lateFlag: "",
            lateHour: "",
            lateAmt: "",
            earlyHour: "",
            earlyAmt: "",
            otFlag: "",
            otHour: "",
            otAmt: "",
            earlyOtHour: "",
            earlyOtAmt: "",
            totalDeduction: "",
            totalAddition: "",
            payableSalary: "0.00",
        },
        {
            date: "16 Aug | Sun",
            status: "Weekly Off 1",
            inTime: "",
            outTime: "",
            workHour: "",
            breaks: "",
            breakHour: "",
            excessFlag: "",
            excessHour: "",
            excessAmt: "",
            workHourAfterBreak: "",
            lateFlag: "",
            lateHour: "",
            lateAmt: "",
            earlyHour: "",
            earlyAmt: "",
            otFlag: "",
            otHour: "",
            otAmt: "",
            earlyOtHour: "",
            earlyOtAmt: "",
            totalDeduction: "",
            totalAddition: "",
            payableSalary: "0.00",
        },
        {
            date: "17 Aug | Mon",
            status: "Present|Late",
            inTime: "11:30am",
            outTime: "09:00pm",
            workHour: "09:30",
            breaks: "03:00pm-03:30pm",
            breakHour: "00:30",
            excessFlag: "",
            excessHour: "",
            excessAmt: "",
            workHourAfterBreak: "09:00",
            lateFlag: "Y",
            lateHour: "01:30",
            lateAmt: "100.00",
            earlyHour: "",
            earlyAmt: "",
            otFlag: "",
            otHour: "",
            otAmt: "",
            earlyOtHour: "",
            earlyOtAmt: "",
            totalDeduction: "100.00",
            totalAddition: "",
            payableSalary: "476.92",
        },
        {
            date: "18 Aug | Tue",
            status: "Present|Over",
            inTime: "10:00am",
            outTime: "09:45pm",
            workHour: "11:45",
            breaks: "03:00pm-03:30pm",
            breakHour: "00:30",
            excessFlag: "",
            excessHour: "",
            excessAmt: "",
            workHourAfterBreak: "11:15",
            lateFlag: "",
            lateHour: "",
            lateAmt: "",
            earlyHour: "",
            earlyAmt: "",
            otFlag: "Y",
            otHour: "00:45",
            otAmt: "45.00",
            earlyOtHour: "",
            earlyOtAmt: "",
            totalDeduction: "",
            totalAddition: "45.00",
            payableSalary: "621.92",
        },
        {
            date: "19 Aug | Wed",
            status: "Present|Late",
            inTime: "12:00pm",
            outTime: "09:00pm",
            workHour: "09:00",
            breaks: "03:00pm-03:30pm",
            breakHour: "00:30",
            excessFlag: "",
            excessHour: "",
            excessAmt: "",
            workHourAfterBreak: "08:30",
            lateFlag: "Y",
            lateHour: "02:00",
            lateAmt: "100.00",
            earlyHour: "",
            earlyAmt: "",
            otFlag: "",
            otHour: "",
            otAmt: "",
            earlyOtHour: "",
            earlyOtAmt: "",
            totalDeduction: "100.00",
            totalAddition: "",
            payableSalary: "476.92",
        },
        {
            date: "20 Aug | Thu",
            status: "Present|Late",
            inTime: "01:00pm",
            outTime: "09:00pm",
            workHour: "08:00",
            breaks: "03:00pm-03:30pm",
            breakHour: "00:30",
            excessFlag: "",
            excessHour: "",
            excessAmt: "",
            workHourAfterBreak: "07:30",
            lateFlag: "Y",
            lateHour: "03:00",
            lateAmt: "100.00",
            earlyHour: "",
            earlyAmt: "",
            otFlag: "",
            otHour: "",
            otAmt: "",
            earlyOtHour: "",
            earlyOtAmt: "",
            totalDeduction: "100.00",
            totalAddition: "",
            payableSalary: "476.92",
        },
        {
            date: "21 Aug | Fri",
            status: "Absent",
            inTime: "",
            outTime: "",
            workHour: "",
            breaks: "",
            breakHour: "",
            excessFlag: "",
            excessHour: "",
            excessAmt: "",
            workHourAfterBreak: "",
            lateFlag: "",
            lateHour: "",
            lateAmt: "",
            earlyHour: "",
            earlyAmt: "",
            otFlag: "",
            otHour: "",
            otAmt: "",
            earlyOtHour: "",
            earlyOtAmt: "",
            totalDeduction: "",
            totalAddition: "",
            payableSalary: "0.00",
        },
        {
            date: "22 Aug | Sat",
            status: "Absent",
            inTime: "",
            outTime: "",
            workHour: "",
            breaks: "",
            breakHour: "",
            excessFlag: "",
            excessHour: "",
            excessAmt: "",
            workHourAfterBreak: "",
            lateFlag: "",
            lateHour: "",
            lateAmt: "",
            earlyHour: "",
            earlyAmt: "",
            otFlag: "",
            otHour: "",
            otAmt: "",
            earlyOtHour: "",
            earlyOtAmt: "",
            totalDeduction: "",
            totalAddition: "",
            payableSalary: "0.00",
        },
        {
            date: "23 Aug | Sun",
            status: "Weekly Off 1",
            inTime: "",
            outTime: "",
            workHour: "",
            breaks: "",
            breakHour: "",
            excessFlag: "",
            excessHour: "",
            excessAmt: "",
            workHourAfterBreak: "",
            lateFlag: "",
            lateHour: "",
            lateAmt: "",
            earlyHour: "",
            earlyAmt: "",
            otFlag: "",
            otHour: "",
            otAmt: "",
            earlyOtHour: "",
            earlyOtAmt: "",
            totalDeduction: "",
            totalAddition: "",
            payableSalary: "0.00",
        },
        {
            date: "24 Aug | Mon",
            status: "Absent",
            inTime: "",
            outTime: "",
            workHour: "",
            breaks: "",
            breakHour: "",
            excessFlag: "",
            excessHour: "",
            excessAmt: "",
            workHourAfterBreak: "",
            lateFlag: "",
            lateHour: "",
            lateAmt: "",
            earlyHour: "",
            earlyAmt: "",
            otFlag: "",
            otHour: "",
            otAmt: "",
            earlyOtHour: "",
            earlyOtAmt: "",
            totalDeduction: "",
            totalAddition: "",
            payableSalary: "0.00",
        },
        {
            date: "25 Aug | Tue",
            status: "Absent",
            inTime: "",
            outTime: "",
            workHour: "",
            breaks: "",
            breakHour: "",
            excessFlag: "",
            excessHour: "",
            excessAmt: "",
            workHourAfterBreak: "",
            lateFlag: "",
            lateHour: "",
            lateAmt: "",
            earlyHour: "",
            earlyAmt: "",
            otFlag: "",
            otHour: "",
            otAmt: "",
            earlyOtHour: "",
            earlyOtAmt: "",
            totalDeduction: "",
            totalAddition: "",
            payableSalary: "0.00",
        },
        {
            date: "26 Aug | Wed",
            status: "Absent",
            inTime: "",
            outTime: "",
            workHour: "",
            breaks: "",
            breakHour: "",
            excessFlag: "",
            excessHour: "",
            excessAmt: "",
            workHourAfterBreak: "",
            lateFlag: "",
            lateHour: "",
            lateAmt: "",
            earlyHour: "",
            earlyAmt: "",
            otFlag: "",
            otHour: "",
            otAmt: "",
            earlyOtHour: "",
            earlyOtAmt: "",
            totalDeduction: "",
            totalAddition: "",
            payableSalary: "0.00",
        },
        {
            date: "27 Aug | Thu",
            status: "Absent",
            inTime: "",
            outTime: "",
            workHour: "",
            breaks: "",
            breakHour: "",
            excessFlag: "",
            excessHour: "",
            excessAmt: "",
            workHourAfterBreak: "",
            lateFlag: "",
            lateHour: "",
            lateAmt: "",
            earlyHour: "",
            earlyAmt: "",
            otFlag: "",
            otHour: "",
            otAmt: "",
            earlyOtHour: "",
            earlyOtAmt: "",
            totalDeduction: "",
            totalAddition: "",
            payableSalary: "0.00",
        },
    ],
    totals: {
        workHour: "166:05",
        breakHour: "10:30",
        excessHour: "03:00",
        excessAmt: "180.00",
        workHourAfterBreak: "155:35",
        lateHour: "17:10",
        lateAmt: "588.46",
        earlyHour: "",
        earlyAmt: "",
        otHour: "13:15",
        otAmt: "711.92",
        earlyOtHour: "",
        earlyOtAmt: "",
        totalDeduction: "768.46",
        totalAddition: "711.92",
        payableSalary: "8886.00",
    }
};

/**
 * Downloads / Generates the Employeewise Detail Deduction Report PDF
 * @param {Object} [customData] - Optional custom data, defaults to SAMPLE_DEDUCTION_REPORT_DATA
 * @param {boolean} [returnBlob=false] - Whether to return blob/url instead of saving directly
 */
export const downloadEmployeewiseDetailDeductionReportPDF = async (
    customData = null,
    returnBlob = false
) => {
    try {
        const data = customData || SAMPLE_DEDUCTION_REPORT_DATA;
        const { employeeInfo, salarySummary, loanSummary, meta, rows, totals } = data;

        // Initialize PDF in LANDSCAPE A4 mode (297mm x 210mm)
        const doc = new jsPDF({
            orientation: "landscape",
            unit: "mm",
            format: "a4",
        });

        const startX = 6;
        const startY = 6;
        const fullWidth = 277;
        const boxHeight = 31; // height of the top header information grid

        // Draw outer header box container
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.3);
        doc.rect(startX, startY, fullWidth, boxHeight);

        // Section widths
        const leftWidth = 142;
        const middleWidth = 78;
        const rightWidth = fullWidth - leftWidth - middleWidth; // 57

        // Vertical dividers for the top boxes
        doc.line(startX + leftWidth, startY, startX + leftWidth, startY + boxHeight);
        doc.line(startX + leftWidth + middleWidth, startY, startX + leftWidth + middleWidth, startY + boxHeight);

        // -------------------------------------------------------------
        // 1. LEFT HEADER BLOCK (Employee & Salary Structure Details)
        // -------------------------------------------------------------
        // Title row: "5. Employeewise Detail Deduction Report"
        const titleRowHeight = 5.2;
        doc.line(startX, startY + titleRowHeight, startX + leftWidth, startY + titleRowHeight);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.text("5. Employeewise Detail Deduction Report", startX + 2, startY + 3.8);

        // Employee Name row: "Employee : PCS-0071-Test Aniket"
        const empNameRowHeight = 5.0;
        const empNameY = startY + titleRowHeight;
        doc.line(startX, empNameY + empNameRowHeight, startX + leftWidth, empNameY + empNameRowHeight);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text(`Employee :  ${employeeInfo.empCodeName || ""}`, startX + 2, empNameY + 3.6);

        // Left 5-row inner grid
        const gridStartY = empNameY + empNameRowHeight;
        const gridHeight = boxHeight - (titleRowHeight + empNameRowHeight); // 31 - 10.2 = 20.8
        const numRows = 5;
        const rowH = gridHeight / numRows;

        // Sub-column divisions on the left:
        // Col1 (width: 38): Label / Value
        // Col2 (width: 52): Label / Value
        // Col3 (width: 52): Label / Value
        const c1w = 38;
        const c2w = 52;
        const c3w = leftWidth - c1w - c2w; // 52

        // Inner horizontal grid lines
        for (let i = 1; i < numRows; i++) {
            doc.line(startX, gridStartY + i * rowH, startX + leftWidth, gridStartY + i * rowH);
        }
        // Inner vertical grid lines
        doc.line(startX + c1w, gridStartY, startX + c1w, startY + boxHeight);
        // Row 4 (index 3) is Timing which merges col 2 and col 3
        doc.line(startX + c1w + c2w, gridStartY, startX + c1w + c2w, gridStartY + 3 * rowH);
        doc.line(startX + c1w + c2w, gridStartY + 4 * rowH, startX + c1w + c2w, startY + boxHeight);

        // Draw cells text for Left Grid
        const drawGridCell = (x, y, w, h, label, val, isBoldVal = false) => {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(6.5);
            doc.setTextColor(0, 0, 0);
            doc.text(label, x + 1, y + h - 1.2);
            if (val !== undefined && val !== null) {
                if (isBoldVal) doc.setFont("helvetica", "bold");
                doc.text(String(val), x + w - 1, y + h - 1.2, { align: "right" });
            }
        };

        // Row 1
        drawGridCell(startX, gridStartY, c1w, rowH, "Total Days in Month", employeeInfo.totalDaysInMonth);
        drawGridCell(startX + c1w, gridStartY, c2w, rowH, "Branch", employeeInfo.branch);
        drawGridCell(startX + c1w + c2w, gridStartY, c3w, rowH, "Salary", employeeInfo.salary);

        // Row 2
        drawGridCell(startX, gridStartY + rowH, c1w, rowH, "Present Days", employeeInfo.presentDays);
        drawGridCell(startX + c1w, gridStartY + rowH, c2w, rowH, "Department", employeeInfo.department);
        drawGridCell(startX + c1w + c2w, gridStartY + rowH, c3w, rowH, "Salary of Day", employeeInfo.salaryOfDay);

        // Row 3
        drawGridCell(startX, gridStartY + 2 * rowH, c1w, rowH, "Paid Days (WO+PH)", employeeInfo.paidDaysWOPH);
        drawGridCell(startX + c1w, gridStartY + 2 * rowH, c2w, rowH, "Rule", employeeInfo.rule);
        drawGridCell(startX + c1w + c2w, gridStartY + 2 * rowH, c3w, rowH, "Salary of Hour", employeeInfo.salaryOfHour);

        // Row 4: Timing merges c2 and c3
        drawGridCell(startX, gridStartY + 3 * rowH, c1w, rowH, "Absent Days", employeeInfo.absentDays);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.text("Timing", startX + c1w + 1, gridStartY + 3 * rowH + rowH - 1.2);
        doc.text(employeeInfo.timing || "", startX + leftWidth - 1, gridStartY + 3 * rowH + rowH - 1.2, { align: "right" });

        // Row 5
        drawGridCell(startX, gridStartY + 4 * rowH, c1w, rowH, "OT Days", employeeInfo.otDays);
        drawGridCell(startX + c1w, gridStartY + 4 * rowH, c2w, rowH, "Paid Days", employeeInfo.paidDays);
        drawGridCell(startX + c1w + c2w, gridStartY + 4 * rowH, c3w, rowH, "Joining", employeeInfo.joining);

        // -------------------------------------------------------------
        // 2. MIDDLE HEADER BLOCK (Salary Breakdown & Balance)
        // -------------------------------------------------------------
        const midX = startX + leftWidth;
        const midRowH = boxHeight / 5; // 5 rows = 6.2 each
        for (let i = 1; i < 5; i++) {
            doc.line(midX, startY + i * midRowH, midX + middleWidth, startY + i * midRowH);
        }

        // Row 1: Opening Balance
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.text("Opening Balance:", midX + 2, startY + midRowH - 1.8);
        doc.text(salarySummary.openingBalance || "0 C Pending", midX + middleWidth - 2, startY + midRowH - 1.8, { align: "right" });

        // Row 2: Total Salary
        doc.text("Total Salary:", midX + 2, startY + 2 * midRowH - 1.8);
        doc.text("(+)", midX + 36, startY + 2 * midRowH - 1.8);
        doc.text(String(salarySummary.totalSalary || "8886").replace("(+)", "").trim(), midX + middleWidth - 2, startY + 2 * midRowH - 1.8, { align: "right" });

        // Row 3: Bonus & Allowance
        doc.text("Bonus & Allowance:", midX + 2, startY + 3 * midRowH - 1.8);
        doc.text("(+)", midX + 36, startY + 3 * midRowH - 1.8);
        doc.text(String(salarySummary.bonusAllowance || "0").replace("(+)", "").trim(), midX + middleWidth - 2, startY + 3 * midRowH - 1.8, { align: "right" });

        // Row 4: Adv & Loan Deduction
        doc.text("Adv & Loan Deduction:", midX + 2, startY + 4 * midRowH - 1.8);
        doc.text("(-)", midX + 36, startY + 4 * midRowH - 1.8);
        doc.text(String(salarySummary.advLoanDeduction || "0").replace("(-)", "").trim(), midX + middleWidth - 2, startY + 4 * midRowH - 1.8, { align: "right" });

        // Row 5: Salary to Pay
        doc.setFontSize(8.5);
        doc.text("Salary to Pay:", midX + 2, startY + 5 * midRowH - 1.8);
        doc.text(salarySummary.salaryToPay || "8886 C Pending", midX + middleWidth - 2, startY + 5 * midRowH - 1.8, { align: "right" });

        // -------------------------------------------------------------
        // 3. RIGHT HEADER BLOCK (Loan Summary & Page Indicator)
        // -------------------------------------------------------------
        const rightX = midX + middleWidth;
        const loanRowH = boxHeight / 3; // 3 rows ~ 10.33 each

        // Page number at top right above the loan box
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.text(meta.pageNum || "# 1/1", startX + fullWidth - 1, startY - 1.2, { align: "right" });

        // Horizontal lines inside loan box
        doc.line(rightX, startY + loanRowH, startX + fullWidth, startY + loanRowH);
        doc.line(rightX, startY + 2 * loanRowH, startX + fullWidth, startY + 2 * loanRowH);

        // Row 1: Total Loan Given
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.text("Total Loan Given", rightX + rightWidth / 2, startY + 4, { align: "center" });
        doc.setFontSize(8);
        doc.text(String(loanSummary.totalLoanGiven || "0"), rightX + rightWidth / 2, startY + 8.2, { align: "center" });

        // Row 2: Total Loan Deducted
        doc.setFontSize(7.5);
        doc.text("Total Loan Deducted", rightX + rightWidth / 2, startY + loanRowH + 4, { align: "center" });
        doc.setFontSize(8);
        doc.text(String(loanSummary.totalLoanDeducted || "0"), rightX + rightWidth / 2, startY + loanRowH + 8.2, { align: "center" });

        // Row 3: Pending Loan
        doc.setFontSize(7.5);
        doc.text("Pending Loan", rightX + rightWidth / 2, startY + 2 * loanRowH + 4, { align: "center" });
        doc.setFontSize(8);
        doc.text(String(loanSummary.pendingLoan || "0 C"), rightX + rightWidth / 2, startY + 2 * loanRowH + 8.2, { align: "center" });

        // -------------------------------------------------------------
        // 4. VERTICAL META TEXT ON RIGHT MARGIN
        // -------------------------------------------------------------
        doc.saveGraphicsState();
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(50, 50, 50);
        // Position at far right edge rotated 90 degrees
        const rotX = 293;
        const rotY = 160;
        doc.text(
            `Report Generated On : ${meta.reportGeneratedOn || "27/08/2026 13:38:25"}    Last Posted On : ${meta.lastPostedOn || "27/08/2026 13:38:25"}`,
            rotX,
            rotY,
            { angle: 90 }
        );
        doc.restoreGraphicsState();

        // -------------------------------------------------------------
        // 5. MAIN ATTENDANCE & DEDUCTION TABLE
        // -------------------------------------------------------------
        const tableStartY = startY + boxHeight; // right below header box

        // Table column headers
        const tableHead = [
            [
                { content: "Date", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                { content: "Status", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                { content: "In", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                { content: "Out", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                { content: "Work\nHour", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                { content: "Shift Details", colSpan: 2, styles: { halign: "center", valign: "middle" } },
                { content: "Overtime / Weekoff Overtime", colSpan: 4, styles: { halign: "center", valign: "middle" } },
                { content: "Daywise\nEarnings", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                { content: "Total\nDeduction", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                { content: "Total\nBenefits", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                { content: "Loans /\nEMI", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                { content: "Incentives", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
            ],
            [
                { content: "Shift Timings", styles: { halign: "center" } },
                { content: "Duration", styles: { halign: "center" } },
                { content: "", styles: { halign: "center" } },
                { content: "Weekoff", styles: { halign: "center" } },
                { content: "Hour", styles: { halign: "center" } },
                { content: "Rate", styles: { halign: "center" } },
            ]
        ];

        // Text values for the 4 summary columns (comma-separated or custom text)
        const totalDeductionsText = data.totalDeductionsText || data.totalDeductionText || "";
        const totalBenefitsText = data.totalBenefitsText || data.totalBenefitText || data.totalAdditionsText || data.totalAdditionText || "";
        const loansEmiText = data.loansEmiText || data.loanEmiText || data.loansText || "";
        const incentivesText = data.incentivesText || data.incentiveText || "";

        // Format body rows (Using rowSpan on row 0 for the 4 text columns to eliminate row-wise borders)
        const tableBody = rows.map((r, idx) => {
            const rowArr = [
                r.date || "",
                r.status || "",
                r.inTime || "",
                r.outTime || "",
                r.workHour || "",
                r.shiftTimings || r.breaks || "",
                r.shiftDuration || r.breakHour || "",
                r.applicable || r.otApplicable || r.otFlag || "",
                r.weekoff || r.weekOff || (r.status && (r.status.includes("Weekly Off") || r.status.includes("WO")) ? "Y" : ""),
                r.otHour || "",
                r.otRate || r.otAmt || "",
                r.daywiseEarnings || r.dayEarnings || r.payableSalary || "",
            ];

            if (idx === 0) {
                rowArr.push(
                    { content: totalDeductionsText, rowSpan: rows.length, styles: { valign: "top", halign: "left", cellPadding: 1.5, fontSize: 5.5 } },
                    { content: totalBenefitsText, rowSpan: rows.length, styles: { valign: "top", halign: "left", cellPadding: 1.5, fontSize: 5.5 } },
                    { content: loansEmiText, rowSpan: rows.length, styles: { valign: "top", halign: "left", cellPadding: 1.5, fontSize: 5.5 } },
                    { content: incentivesText, rowSpan: rows.length, styles: { valign: "top", halign: "left", cellPadding: 1.5, fontSize: 5.5 } }
                );
            }
            return rowArr;
        });

        // Footer Total Row
        const tableFoot = [
            [
                { content: "", colSpan: 4, styles: { halign: "center" } },
                { content: totals.workHour || "", styles: { halign: "center", fontStyle: "bold" } },
                { content: "", styles: { halign: "center" } },
                { content: totals.shiftDuration || totals.breakHour || "", styles: { halign: "center", fontStyle: "bold" } },
                { content: "", styles: { halign: "center" } },
                { content: "", styles: { halign: "center" } },
                { content: totals.otHour || "", styles: { halign: "center", fontStyle: "bold" } },
                { content: totals.otRate || totals.otAmt || "", styles: { halign: "right", fontStyle: "bold" } },
                { content: totals.daywiseEarnings || totals.totalDaywiseEarnings || totals.payableSalary || "", styles: { halign: "right", fontStyle: "bold", fontSize: 6.5 } },
                { content: "", styles: { halign: "right", fontStyle: "bold" } }, // Total Deduction
                { content: "", styles: { halign: "right", fontStyle: "bold" } }, // Total Benefits
                { content: "", styles: { halign: "right", fontStyle: "bold" } }, // Loans / EMI
                { content: "", styles: { halign: "right", fontStyle: "bold" } }, // Incentives
            ]
        ];

        // Column widths map strictly matching the 277mm landscape table
        const colWidths = {
            0: { cellWidth: 16, halign: "left" },    // Date
            1: { cellWidth: 17, halign: "left" },    // Status
            2: { cellWidth: 12, halign: "center" },  // In
            3: { cellWidth: 12, halign: "center" },  // Out
            4: { cellWidth: 12, halign: "center" },  // Work Hour
            5: { cellWidth: 32, halign: "left" },    // Shift Timings
            6: { cellWidth: 12, halign: "center" },  // Duration
            7: { cellWidth: 11, halign: "center" },  // Applicable
            8: { cellWidth: 11, halign: "center" },  // Weekoff
            9: { cellWidth: 12, halign: "center" },  // Hour
            10: { cellWidth: 15, halign: "right" },  // Rate
            11: { cellWidth: 23, halign: "right" },  // Daywise Earnings
            12: { cellWidth: 23, halign: "right" },  // Total Deduction
            13: { cellWidth: 23, halign: "right" },  // Total Addition
            14: { cellWidth: 23, halign: "right" },  // Loans / EMI
            15: { cellWidth: 23, halign: "right" },  // Incentives
        };

        autoTable(doc, {
            startY: tableStartY,
            head: tableHead,
            body: tableBody,
            foot: tableFoot,
            theme: "grid",
            margin: { left: startX, right: 297 - (startX + fullWidth) },
            headStyles: {
                fillColor: [255, 240, 0], // Bright Yellow
                textColor: [0, 0, 0],
                fontStyle: "bold",
                fontSize: 6.0,
                cellPadding: 0.9,
                lineWidth: 0.15,
                lineColor: [0, 0, 0],
            },
            bodyStyles: {
                fontSize: 5.8,
                cellPadding: 0.8,
                textColor: [0, 0, 0],
                lineWidth: 0.1,
                lineColor: [100, 100, 100],
            },
            footStyles: {
                fillColor: [255, 240, 0], // Yellow Total row
                textColor: [0, 0, 0],
                fontStyle: "bold",
                fontSize: 6.2,
                cellPadding: 0.9,
                lineWidth: 0.15,
                lineColor: [0, 0, 0],
            },
            columnStyles: colWidths,
            didParseCell: (hookData) => {
                if (hookData.section === "body") {
                    const colIdx = hookData.column.index;
                    // Green text for Overtime / Weekoff Overtime (indices 7 to 10)
                    if (colIdx >= 7 && colIdx <= 10) {
                        if (hookData.cell.raw) {
                            hookData.cell.styles.textColor = [0, 150, 60]; // Green
                        }
                    }
                }
            },
        });

        // -------------------------------------------------------------
        // 6. FOOTER BRANDING (Bottom Left)
        // -------------------------------------------------------------
        const finalY = doc.lastAutoTable?.finalY || 190;
        const footerY = Math.min(finalY + 6, 203);

        // Logo circle / icon
        doc.setFillColor(33, 150, 243);
        doc.circle(startX + 3, footerY - 1, 2.2, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(33, 33, 33);
        doc.text("Software by www.pagarguru.com", startX + 7, footerY);


        // File generation / output
        const filename = `Employeewise_Detail_Deduction_Report_${employeeInfo.empCodeName.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;

        if (returnBlob) {
            return {
                filename,
                blob: doc.output("blob"),
                blobUrl: doc.output("bloburl")
            };
        }

        doc.save(filename);
        return doc.output("bloburl");
    } catch (err) {
        console.error("Error generating Employeewise Detail Deduction Report PDF:", err);
        throw err;
    }
};
