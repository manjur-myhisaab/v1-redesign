// @ts-nocheck
import ExcelJS from "exceljs";
import rdk, { readItems, ATTENDANCE_SERVER_URL } from "@/services/server";

// === MULTI-EMPLOYEE VISIT REPORT EXPORT (Matched exactly with V1) ===
export const exportVisitsToExcel = async (
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
            const mm = String(date.getMonth() + 1).padStart(2, "0");
            const dd = String(date.getDate()).padStart(2, "0");
            return `${yyyy}-${mm}-${dd}`;
        };

        const start = formatDate(startDate);
        const end = formatDate(endDate);

        // Filter employee IDs
        let employeeIds: string[] = [];
        if (selectedEmployeeIds && selectedEmployeeIds.length > 0) {
            employeeIds = selectedEmployeeIds;
        } else {
            employeeIds = employeeList.map((e) => e.id);
        }

        // Fetch visits data from Directus
        const response: any = await rdk.request(
            readItems("visits", {
                filter: {
                    _and: [
                        { assigned_employee_id: { _in: employeeIds } },
                        { visit_date: { _between: [start, end] } },
                    ],
                },
                sort: ["assigned_employee_id", "visit_date"],
                fields: [
                    "*",
                    "visit_images.*",
                    "client_id.*",
                ],
                limit: -1,
            })
        );

        const visits = Array.isArray(response) ? response : response?.data || [];
        if (visits.length === 0) {
            alert("No visit data found.");
            return null;
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Visit Report");

        const monthName = new Date(numericYear, numericMonth - 1).toLocaleString("default", { month: "long" });

        // === HEADING SECTION ===
        const headingFont = { bold: true, size: 14 };
        const subheadingFont = { bold: true, size: 12 };

        worksheet.mergeCells("A1:Q1");
        worksheet.getCell("A1").value = firmName || "Firm Name";
        worksheet.getCell("A1").font = headingFont;
        worksheet.getCell("A1").alignment = { horizontal: "center" };

        worksheet.mergeCells("A2:Q2");
        worksheet.getCell("A2").value = `Visit Report ${monthName} ${year}`;
        worksheet.getCell("A2").font = subheadingFont;
        worksheet.getCell("A2").alignment = { horizontal: "center" };

        worksheet.addRow([]);

        // === TABLE HEADER ===
        const headers = [
            "EMPLOYEE ID",
            "EMPLOYEE NAME",
            "DESIGNATION",
            "CATEGORY",
            "DEPARTMENT",
            "CLIENT NAME",
            "CLIENT PHONE NO",
            "CLIENT ADDRESS",
            "VISIT DATE",
            "VISIT TIME",
            "GEO ADDRESS",
            "LATITUDE",
            "LONGITUDE",
            "REMARKS",
            "VISIT IMAGE",
            "CREATED ON",
            "UPDATED ON",
        ];
        const headerRow = worksheet.addRow(headers);

        const colWidths = [
            20,  // 1. EMPLOYEE ID
            22,  // 2. EMPLOYEE NAME
            25,  // 3. DESIGNATION
            20,  // 4. CATEGORY
            22,  // 5. DEPARTMENT
            22,  // 6. CLIENT NAME
            20,  // 7. CLIENT PHONE NO
            40,  // 8. CLIENT ADDRESS
            15,  // 9. VISIT DATE
            15,  // 10. VISIT TIME
            40,  // 11. GEO ADDRESS
            15,  // 12. LATITUDE
            15,  // 13. LONGITUDE
            50,  // 14. REMARKS
            50,  // 15. VISIT IMAGE (Link)
            25,  // 16. CREATED ON
            25,  // 17. UPDATED ON
        ];
        colWidths.forEach((w, i) => (worksheet.getColumn(i + 1).width = w));

        // Style header row
        headerRow.eachCell((cell) => {
            cell.font = { bold: true };
            cell.alignment = { horizontal: "center", vertical: "middle" };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
            cell.border = {
                top: { style: "thin" },
                left: { style: "thin" },
                bottom: { style: "thin" },
                right: { style: "thin" },
            };
        });

        // === DATA ROWS ===
        visits.forEach((v: any) => {
            const emp = employeeList.find((e) => e.id === v.assigned_employee_id);
            const empName = emp ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim() : "Unknown";

            const empID = emp?.employee_code || "—";
            const empDesignation = emp?.title || "—";
            const empCategory = emp?.employee_category_id?.employee_category_name || "—";
            const empDepartment = emp?.department_name || "—";

            const created = v.date_created
                ? new Date(v.date_created).toLocaleString("en-GB", {
                    dateStyle: "short",
                    timeStyle: "short",
                    hour12: true,
                })
                : "—";

            const updated = v.date_updated
                ? new Date(v.date_updated).toLocaleString("en-GB", {
                    dateStyle: "short",
                    timeStyle: "short",
                    hour12: true,
                })
                : "—";

            const visitTime = v.visit_time
                ? new Date(`1970-01-01T${v.visit_time}`).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                })
                : "—";

            let visitImagesText = "—";
            let firstImageUrl = null;

            if (Array.isArray(v.visit_images) && v.visit_images.length > 0) {
                const imageURLs = v.visit_images
                    .map((img: any) => `${ATTENDANCE_SERVER_URL}/assets/${img.directus_files_id || img.id || img}`);

                visitImagesText = imageURLs.join("\n");
                firstImageUrl = imageURLs[0];
            }

            const rowData = [
                empID,
                empName,
                empDesignation,
                empCategory,
                empDepartment,
                v.client_id?.client_name || v.client_name || "—",
                v.client_id?.client_phone || v.client_phone || "—",
                v.client_id?.client_address || v.client_address || "—",
                v.visit_date ? new Date(v.visit_date).toLocaleDateString("en-GB") : "—",
                visitTime,
                v.visit_geoaddress || "—",
                v.visit_lat || "—",
                v.visit_long || "—",
                v.visit_remarks || "—",
                visitImagesText,
                created,
                updated,
            ];

            const row = worksheet.addRow(rowData);

            const linkCell = row.getCell(15);
            if (firstImageUrl) {
                linkCell.value = {
                    text: visitImagesText,
                    hyperlink: firstImageUrl,
                    tooltip: 'Click to open first image'
                };
                linkCell.font = {
                    color: { argb: "FF0000FF" },
                    underline: true
                };
                linkCell.alignment = { wrapText: true, vertical: "top" };
            } else {
                linkCell.alignment = { wrapText: true, vertical: "top" };
            }

            for (let i = 1; i <= headers.length; i++) {
                row.getCell(i).border = {
                    top: { style: "thin" },
                    left: { style: "thin" },
                    bottom: { style: "thin" },
                    right: { style: "thin" }
                };
            }

            row.commit();
        });

        worksheet.views = [{ state: "frozen", ySplit: 4 }];

        // === SAVE FILE ===
        const fileName = `Overall_Visit_Report_${monthName}_${year}.xlsx`;
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        return true;
    } catch (error) {
        console.error("Failed to generate Multi-Visit Report Excel:", error);
        alert("Something went wrong while exporting the visit report.");
        return null;
    }
};
