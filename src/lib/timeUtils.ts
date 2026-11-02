import { countries } from "./countryData";

// 1. Dictionary ek hi baar banegi jab ye file load hogi
const countryTimeZoneMap: Record<string, string> = countries?.reduce((map: Record<string, string>, country: any) => {
    if (country.name && country.timezone) {
        map[country.name] = country.timezone;
    }
    if (country.code && country.timezone) {
        map[country.code] = country.timezone;
    }
    return map;
}, {}) || {};

// Custom additions
countryTimeZoneMap['Dubai'] = 'Asia/Dubai';
countryTimeZoneMap['UAE'] = 'Asia/Dubai';
countryTimeZoneMap['USA'] = 'America/New_York';
countryTimeZoneMap['UK'] = 'Europe/London';

// 2. 12-Hour Format (AM/PM) ke liye
export const formatTime = (timeString?: string | null, country?: string): string => {
    if (!timeString) return '-';
    const date = new Date(timeString);

    const employeeTimeZone = (country && countryTimeZoneMap[country]) || Intl.DateTimeFormat().resolvedOptions().timeZone;

    try {
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: employeeTimeZone
        });
    } catch (error) {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
};

// 3. 24-Hour Format ke liye (Handles both AM/PM strings & Timestamps)
export const convertTo24hr = (timeString?: string | null, country?: string): string => {
    if (!timeString) return '-';

    let date: Date;
    const trimmedTime = timeString.trim();

    // Check for "8:30 AM" or "6:00 PM"
    const timeOnlyMatch = trimmedTime.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);

    if (timeOnlyMatch) {
        let hours = parseInt(timeOnlyMatch[1], 10);
        const minutes = parseInt(timeOnlyMatch[2], 10);
        const ampm = timeOnlyMatch[3].toUpperCase();

        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;

        date = new Date();
        date.setHours(hours, minutes, 0, 0);
    } else {
        date = new Date(timeString);
    }

    const employeeTimeZone = (country && countryTimeZoneMap[country]) || Intl.DateTimeFormat().resolvedOptions().timeZone;

    try {
        return date.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: employeeTimeZone
        });
    } catch (error) {
        return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
};

export const shiftTimeByCountryGap = (timeString: string, country?: string): string => {
    if (!timeString) return '-';

    const timeParts = timeString.trim().match(/^(\d{1,2}):(\d{2})/);
    if (!timeParts) return timeString;

    const hours = parseInt(timeParts[1], 10);
    const minutes = parseInt(timeParts[2], 10);

    const baseDate = new Date();
    baseDate.setHours(hours, minutes, 0, 0);

    const targetTimeZone = (country && countryTimeZoneMap[country]) || Intl.DateTimeFormat().resolvedOptions().timeZone;

    const targetTimeStr = baseDate.toLocaleString('en-US', { timeZone: targetTimeZone });
    const localTimeStr = baseDate.toLocaleString('en-US');

    const targetDate = new Date(targetTimeStr);
    const localDate = new Date(localTimeStr);

    const gapMs = Math.abs(targetDate.getTime() - localDate.getTime());
    const finalDate = new Date(baseDate.getTime() + gapMs);

    return finalDate.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
};

export const addTimeDifferenceToUserTime = (time1?: string, time2?: string, userSelectedTime?: string): string => {
    if (!time1 || !time2 || !userSelectedTime) return '-';

    const timeToMinutes = (timeStr: string) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return (hours * 60) + minutes;
    };

    const minutes1 = timeToMinutes(time1);
    const minutes2 = timeToMinutes(time2);
    const differenceInMinutes = Math.abs(minutes2 - minutes1);

    const userSelectedMinutes = timeToMinutes(userSelectedTime);
    let finalTotalMinutes = userSelectedMinutes + differenceInMinutes;

    if (finalTotalMinutes >= 24 * 60) {
        finalTotalMinutes = finalTotalMinutes % (24 * 60);
    }

    const finalHours = Math.floor(finalTotalMinutes / 60);
    const finalMinutes = finalTotalMinutes % 60;

    const formattedHour = finalHours.toString().padStart(2, '0');
    const formattedMinute = finalMinutes.toString().padStart(2, '0');

    return `${formattedHour}:${formattedMinute}`;
};

