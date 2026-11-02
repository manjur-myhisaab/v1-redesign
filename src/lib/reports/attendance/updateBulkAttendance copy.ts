// @ts-nocheck
import rdk, { createItem, customEndpoint, deleteItem, deleteItems } from "@/services/server";
import { addTimeDifferenceToUserTime, convertTo24hr, formatTime } from "@/lib/timeUtils";

function getUniqueMonths(datesArray) {
    if (!Array.isArray(datesArray) || datesArray.length === 0) {
        return [];
    }
    return [...new Set(datesArray.map(date => {
        const [day, month, year] = date.split('-');
        return `${year}-${month}`;
    }))];
}

function getWeekDayNumber(dateString) {
    const [day, month, year] = dateString.split('-');
    const date = new Date(year, month - 1, day);
    const weekDayNumber = date.getDay();
    return weekDayNumber;
}

const createAttendance = async (data) => {
    const response = await rdk.request(createItem("attendance", data));
    return response;
}

const deleteAttendance = async (ids) => {
    const response = await rdk.request(deleteItems("attendance", ids));
    return response;
}

async function fetchAttnDataForMultipleMonths(monthYearArray, user) {
    try {
        const apiPromises = monthYearArray.map(async (monthYear) => {
            const response = await rdk.request(
                customEndpoint({
                    path: `api/all_employee_attendance/${monthYear}/${user?.firm_id.firm_id}`,
                    method: "GET",
                })
            );
            return response?.results;
        });

        const results = await Promise.all(apiPromises);

        const flattenedResults = results.flat();

        return flattenedResults;

    } catch (error) {
        console.error("API call mein error aayi:", error);
    }
}



export async function handleBulkAttnUpdate(payload) {
    const { dates, employeeIds, status, users, user, allShiftsDetails: allShifts } = payload;
    console.log("shifts", allShifts);

    try {
        const attendanceData = await fetchAttnDataForMultipleMonths(getUniqueMonths(dates), user);

        // 1. Gather all attendance IDs to delete across all selected employees and dates to minimize API calls
        const allIdsToDelete = [];
        for (const empId of employeeIds) {
            const attendanceDataById = attendanceData.filter((attn) => attn.employee.id === empId);
            for (const date of dates) {
                const attendance = attendanceDataById.map((attn) => attn.attendances).flat();
                const dateWiseAttnData = attendance.filter((attn) => attn.date === date);
                if (dateWiseAttnData[0]?.entries?.length > 0) {
                    allIdsToDelete.push(...(dateWiseAttnData[0]?.attendance_ids || []));
                }
            }
        }

        // Perform bulk delete in a single API call if there are records to delete
        if (allIdsToDelete.length > 0) {
            await deleteAttendance(allIdsToDelete);
        }

        // 2. Prepare creation promises for all selected employees and dates
        const creationPromises = [];

        for (const empId of employeeIds) {
            const employee = users.find(u => u.id === empId);
            if (!employee) continue;

            const shiftType = employee.shift_type;

            if (status === "present") {
                if (shiftType === "monthly") {
                    const allMonthlyShifts = employee?.monthly_shifts || [];

                    for (const date of dates) {
                        const daywiseShifts = allMonthlyShifts?.find((shift) => shift.date_string === date)?.shift_ids?.filter((s) => {
                            const sId = typeof s.shift_id === 'object' ? s.shift_id?.shift_id : s.shift_id;
                            return sId !== 0 && sId !== null && sId !== undefined;
                        });

                        let finalShift;
                        if (daywiseShifts && daywiseShifts.length > 0) {
                            const targetShiftId = typeof daywiseShifts[0].shift_id === 'object' ? daywiseShifts[0].shift_id?.shift_id : daywiseShifts[0].shift_id;
                            finalShift = allShifts?.find((shift) => shift.shift_id === targetShiftId);
                        }

                        if (!finalShift) {
                            finalShift = { shift_from: "10:00:00", shift_to: "19:00:00" };
                        }

                        const [hour1, minutes1] = finalShift.shift_from.split(":");
                        const [hour2, minutes2] = finalShift.shift_to.split(":");

                        const [day, month, year] = date.split("-");
                        const standardDateStr = `${year}-${month}-${day}`;

                        const dateTime1 = new Date(standardDateStr);
                        dateTime1.setHours(Number(hour1), Number(minutes1), 0, 0);
                        const inTimestamp = dateTime1.toISOString();

                        const dateTime2 = new Date(standardDateStr);
                        dateTime2.setHours(Number(hour2), Number(minutes2), 0, 0);
                        const outTimestamp = dateTime2.toISOString();

                        const targetShiftId = (daywiseShifts && daywiseShifts.length > 0)
                            ? (typeof daywiseShifts[0].shift_id === 'object' ? daywiseShifts[0].shift_id?.shift_id : daywiseShifts[0].shift_id)
                            : null;

                        creationPromises.push(createAttendance({
                            TP: "in",
                            employee_id: empId,
                            made_by: 'manual',
                            shift_id: targetShiftId,
                            timestamp: inTimestamp,
                        }));

                        creationPromises.push(createAttendance({
                            TP: "out",
                            employee_id: empId,
                            made_by: 'manual',
                            shift_id: targetShiftId,
                            timestamp: outTimestamp,
                        }));
                    }
                } else if (shiftType === "fixed") {
                    const employeeShiftIds = employee?.shift_ids?.filter((shift) => shift.shift_shift_id !== null) || [];
                    let finalShift;
                    if (employeeShiftIds.length > 0) {
                        finalShift = employeeShiftIds[0]?.shift_shift_id;
                    }

                    if (!finalShift) {
                        finalShift = { shift_from: "10:00:00", shift_to: "19:00:00" };
                    }

                    for (const date of dates) {
                        const [hour1, minutes1] = finalShift.shift_from.split(":");
                        const [hour2, minutes2] = finalShift.shift_to.split(":");

                        const [day, month, year] = date.split("-");
                        const standardDateStr = `${year}-${month}-${day}`;

                        const dateTime1 = new Date(standardDateStr);
                        dateTime1.setHours(Number(hour1), Number(minutes1), 0, 0);
                        const inTimestamp = dateTime1.toISOString();

                        const dateTime2 = new Date(standardDateStr);
                        dateTime2.setHours(Number(hour2), Number(minutes2), 0, 0);
                        const outTimestamp = dateTime2.toISOString();

                        creationPromises.push(createAttendance({
                            TP: "in",
                            employee_id: empId,
                            made_by: 'manual',
                            shift_id: finalShift?.shift_id || null,
                            timestamp: inTimestamp,
                        }));

                        creationPromises.push(createAttendance({
                            TP: "out",
                            employee_id: empId,
                            made_by: 'manual',
                            shift_id: finalShift?.shift_id || null,
                            timestamp: outTimestamp,
                        }));
                    }
                } else {
                    // weekly or default shift
                    const allWeeklyShifts = employee?.weekly_shifts || [];

                    for (const date of dates) {
                        let weekDayNumber = getWeekDayNumber(date);
                        weekDayNumber = weekDayNumber === 0 ? 7 : weekDayNumber;

                        const daywiseShift = allWeeklyShifts.filter((shift) => shift.day_number === weekDayNumber);

                        let finalShift;
                        if (daywiseShift[0]) {
                            const targetShiftId = typeof daywiseShift[0].shift_id === 'object' ? daywiseShift[0].shift_id?.shift_id : daywiseShift[0].shift_id;
                            finalShift = allShifts.find((shift) => shift.shift_id === targetShiftId);
                        }

                        if (!finalShift) {
                            finalShift = { shift_from: "10:00:00", shift_to: "19:00:00" };
                        }

                        const [hour1, minutes1] = finalShift.shift_from.split(":");
                        const [hour2, minutes2] = finalShift.shift_to.split(":");

                        const [day, month, year] = date.split("-");
                        const standardDateStr = `${year}-${month}-${day}`;

                        const dateTime1 = new Date(standardDateStr);
                        dateTime1.setHours(Number(hour1), Number(minutes1), 0, 0);
                        const inTimestamp = dateTime1.toISOString();

                        const dateTime2 = new Date(standardDateStr);
                        dateTime2.setHours(Number(hour2), Number(minutes2), 0, 0);
                        const outTimestamp = dateTime2.toISOString();

                        const targetShiftId = daywiseShift[0]
                            ? (typeof daywiseShift[0].shift_id === 'object' ? daywiseShift[0].shift_id?.shift_id : daywiseShift[0].shift_id)
                            : null;

                        creationPromises.push(createAttendance({
                            TP: "in",
                            employee_id: empId,
                            made_by: 'manual',
                            shift_id: targetShiftId,
                            timestamp: inTimestamp,
                        }));

                        creationPromises.push(createAttendance({
                            TP: "out",
                            employee_id: empId,
                            made_by: 'manual',
                            shift_id: targetShiftId,
                            timestamp: outTimestamp,
                        }));
                    }
                }
            } else if (["absent", "week_off", "holiday", "leave"].includes(status)) {
                for (const date of dates) {
                    const [day, month, year] = date.split("-");
                    const standardDateStr = `${year}-${month}-${day}`;
                    const dateTime = new Date(standardDateStr);
                    dateTime.setHours(11, 59, 0, 0);
                    const fullTimestamp = dateTime.toISOString();

                    creationPromises.push(createAttendance({
                        TP: status,
                        employee_id: empId,
                        made_by: 'manual',
                        timestamp: fullTimestamp
                    }));
                }
            }
        }

        // Wait for all creations to complete
        if (creationPromises.length > 0) {
            await Promise.all(creationPromises);
        }
    }
    catch (error) {
        console.error("Error in bulk attendance update:", error);
        throw error;
    }
}