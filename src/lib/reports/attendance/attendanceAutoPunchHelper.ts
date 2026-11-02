// @ts-nocheck
export const getAllowAutoPunch = () => {
    try {
        const userData = JSON.parse(localStorage.getItem('userData'));
        return userData?.firm_id?.allow_auto_punch;
    } catch (e) {
        console.error("Error reading allow_auto_punch:", e);
        return null;
    }
};

export const preprocessAttendanceRecord = (record) => {
    const allowAutoPunch = getAllowAutoPunch();
    if (allowAutoPunch === false && record) {
        const target = record.attendance_data ? record.attendance_data : record;
        const hasPunchIn = target.in_time !== null && target.in_time !== undefined;
        const hasPunchOut = (target.out_time !== null && target.out_time !== undefined) || 
                            (target.out_formatted_time !== null && target.out_formatted_time !== undefined && target.out_formatted_time !== '') ||
                            (target.entries && target.entries.some(l => l.TP?.toLowerCase() === "out" || l.out_time));
        
        if (hasPunchIn && !hasPunchOut) {
            if (record.status) {
                record.status = "absent";
            }
            target.in_time = null;
            target.absent = true;
            target.in_formatted_time = null;
            target.out_formatted_time = null;
            target.total_work_duration = 0;
            target.duration = 0;
            target.half_day = false;
            target.calculated_half_day = false;
            target.late = false;
            target.early_exit = false;
            if (target.entries) {
                target.entries = [];
            }
        }
    }
    return record;
};

export const preprocessAttendanceList = (attendances) => {
    attendances?.forEach(attn => {
        preprocessAttendanceRecord(attn);
    });
    return attendances;
};
