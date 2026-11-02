import rdk, { createItem, customEndpoint, deleteItems, readItems } from "@/services/server";

function getUniqueMonths(datesArray: string[]) {
    if (!Array.isArray(datesArray) || datesArray.length === 0) {
        return [];
    }
    return [...new Set(datesArray.map(date => {
        const [, month, year] = date.split('-');
        return `${year}-${month}`;
    }))];
}

function getWeekDayNumber(dateString: string) {
    const [day, month, year] = dateString.split('-');
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return date.getDay();
}

const createAttendance = async (data: any) => {
    return await rdk.request(createItem("attendance", data));
};

const deleteAttendance = async (ids: (string | number)[]) => {
    return await rdk.request(deleteItems("attendance", ids as any));
};

async function fetchAttnDataForMultipleMonths(monthYearArray: string[], user: any) {
    try {
        const apiPromises = monthYearArray.map(async (monthYear) => {
            const response: any = await rdk.request(
                customEndpoint({
                    path: `api/all_employee_attendance/${monthYear}/${user?.firm_id?.firm_id}`,
                    method: "GET",
                })
            );
            return response?.results || [];
        });

        const results = await Promise.all(apiPromises);
        return results.flat();
    } catch (error) {
        console.error("API error in fetchAttnDataForMultipleMonths:", error);
        return [];
    }
}

const createLeaveRequest = async (data: any) => {
    const response = await rdk.request(createItem("leave_requests", data));
    return (response as any)?.data || response;
};

const fetchCreatedLeaveRequest = async (empId: string, standardDateStr: string) => {
    try {
        const response: any = await rdk.request(readItems("leave_requests", {
            limit: 1,
            sort: ["-leave_request_id"],
            filter: {
                _and: [
                    { employee_id: { _eq: empId } },
                    { status: { _eq: "approved" } },
                    { leave_date: { _eq: standardDateStr } }
                ]
            }
        }));
        const leaves = response?.data || response;
        if (Array.isArray(leaves) && leaves.length > 0) {
            return leaves[0];
        }
        return null;
    } catch (error) {
        console.error("Error fetching created leave request:", error);
        return null;
    }
};

export interface BulkAttendancePayload {
    dates: string[];
    employeeIds: string[];
    status: string;
    users: any[];
    user: any;
    allShiftsDetails: any[];
    selectionMode?: string;
}

export async function handleBulkAttnUpdate(payload: BulkAttendancePayload) {
    const { dates, employeeIds, status, users, user, allShiftsDetails: allShifts } = payload;

    try {
        const attendanceData = await fetchAttnDataForMultipleMonths(getUniqueMonths(dates), user);

        // 1. Gather all attendance IDs to delete across all selected employees and dates
        const allIdsToDelete: (string | number)[] = [];
        for (const empId of employeeIds) {
            const attendanceDataById = attendanceData.filter((attn: any) => attn?.employee?.id === empId);
            for (const date of dates) {
                const attendance = attendanceDataById.map((attn: any) => attn?.attendances || []).flat();
                const dateWiseAttnData = attendance.filter((attn: any) => attn?.date === date);
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
        const creationPromises: Promise<any>[] = [];

        for (const empId of employeeIds) {
            const employee = users.find(u => u.id === empId);
            if (!employee) continue;

            const shiftType = employee.shift_type;

            if (status === "present") {
                if (shiftType === "monthly") {
                    const allMonthlyShifts = employee?.monthly_shifts || [];

                    for (const date of dates) {
                        const daywiseShifts = allMonthlyShifts?.find((shift: any) => shift.date_string === date)?.shift_ids?.filter((s: any) => {
                            const sId = typeof s.shift_id === 'object' ? s.shift_id?.shift_id : s.shift_id;
                            return sId !== 0 && sId !== null && sId !== undefined;
                        });

                        let finalShift: any;
                        if (daywiseShifts && daywiseShifts.length > 0) {
                            const targetShiftId = typeof daywiseShifts[0].shift_id === 'object' ? daywiseShifts[0].shift_id?.shift_id : daywiseShifts[0].shift_id;
                            finalShift = allShifts?.find((shift: any) => shift.shift_id === targetShiftId);
                        }

                        if (!finalShift) {
                            finalShift = { shift_from: "10:00:00", shift_to: "19:00:00" };
                        }

                        const [hour1, minutes1] = (finalShift.shift_from || "10:00:00").split(":");
                        const [hour2, minutes2] = (finalShift.shift_to || "19:00:00").split(":");

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
                    const employeeShiftIds = employee?.shift_ids?.filter((shift: any) => shift.shift_shift_id !== null) || [];
                    let finalShift: any;
                    if (employeeShiftIds.length > 0) {
                        finalShift = employeeShiftIds[0]?.shift_shift_id;
                    }

                    if (!finalShift) {
                        finalShift = { shift_from: "10:00:00", shift_to: "19:00:00" };
                    }

                    for (const date of dates) {
                        const [hour1, minutes1] = (finalShift.shift_from || "10:00:00").split(":");
                        const [hour2, minutes2] = (finalShift.shift_to || "19:00:00").split(":");

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
                            timestamp: inTimestamp,
                        }));

                        creationPromises.push(createAttendance({
                            TP: "out",
                            employee_id: empId,
                            made_by: 'manual',
                            timestamp: outTimestamp,
                        }));
                    }
                } else {
                    // weekly or default shift
                    const allWeeklyShifts = employee?.weekly_shifts || [];

                    for (const date of dates) {
                        let weekDayNumber = getWeekDayNumber(date);
                        weekDayNumber = weekDayNumber === 0 ? 7 : weekDayNumber;

                        const daywiseShift = allWeeklyShifts.filter((shift: any) => shift.day_number === weekDayNumber);

                        let finalShift: any;
                        if (daywiseShift[0]) {
                            const targetShiftId = typeof daywiseShift[0].shift_id === 'object' ? daywiseShift[0].shift_id?.shift_id : daywiseShift[0].shift_id;
                            finalShift = allShifts.find((shift: any) => shift.shift_id === targetShiftId);
                        }

                        if (!finalShift) {
                            finalShift = { shift_from: "10:00:00", shift_to: "19:00:00" };
                        }

                        const [hour1, minutes1] = (finalShift.shift_from || "10:00:00").split(":");
                        const [hour2, minutes2] = (finalShift.shift_to || "19:00:00").split(":");

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
                    dateTime.setHours(23, 59, 0, 0);
                    const fullTimestamp = dateTime.toISOString();

                    if (status === "leave") {
                        creationPromises.push((async () => {
                            let leaveRequestId = null;
                            try {
                                const leaveReqPayload = {
                                    status: "approved",
                                    leave_date: standardDateStr,
                                    leave_reason: "Marked as leave from attendance",
                                    leave_type: "casual",
                                    employee_id: empId,
                                    leave_date_from: standardDateStr,
                                    leave_date_to: standardDateStr,
                                    leave_documents: []
                                };
                                await createLeaveRequest(leaveReqPayload);
                                const fetchedLeave = await fetchCreatedLeaveRequest(empId, standardDateStr);
                                leaveRequestId = fetchedLeave?.leave_request_id;
                            } catch (e) {
                                console.error("Failed to create leave request:", e);
                            }

                            return createAttendance({
                                TP: status,
                                employee_id: empId,
                                made_by: 'manual',
                                timestamp: fullTimestamp,
                                leave_request_id: leaveRequestId
                            });
                        })());
                    } else {
                        creationPromises.push(createAttendance({
                            TP: status,
                            employee_id: empId,
                            made_by: 'manual',
                            timestamp: fullTimestamp
                        }));
                    }
                }
            }
        }

        if (creationPromises.length > 0) {
            await Promise.all(creationPromises);
        }
    }
    catch (error) {
        console.error("Error in bulk attendance update:", error);
        throw error;
    }
}

