import { RecurrencePattern } from '../types';

/**
 * Calculate the next occurrence date based on a recurrence pattern
 */
export function getNextOccurrenceDate(
    currentDate: Date,
    pattern: RecurrencePattern
): Date | null {
    // Check if we've hit the occurrence limit
    if (pattern.endAfterOccurrences && pattern.occurrenceCount !== undefined) {
        if (pattern.occurrenceCount >= pattern.endAfterOccurrences) {
            return null;
        }
    }

    // Check if we're past the end date
    if (pattern.endDate) {
        const endDate = new Date(pattern.endDate);
        if (currentDate >= endDate) {
            return null;
        }
    }

    const nextDate = new Date(currentDate);
    const interval = pattern.interval || 1;

    switch (pattern.type) {
        case 'daily':
            nextDate.setDate(nextDate.getDate() + interval);
            break;

        case 'weekly':
            if (pattern.daysOfWeek && pattern.daysOfWeek.length > 0) {
                // Find next matching day of week
                const currentDay = nextDate.getDay();
                const sortedDays = [...pattern.daysOfWeek].sort((a, b) => a - b);

                // Find next day in current week
                const nextDayInWeek = sortedDays.find(d => d > currentDay);

                if (nextDayInWeek !== undefined) {
                    nextDate.setDate(nextDate.getDate() + (nextDayInWeek - currentDay));
                } else {
                    // Move to next week, first matching day
                    const daysUntilNextWeek = 7 - currentDay + sortedDays[0];
                    nextDate.setDate(nextDate.getDate() + daysUntilNextWeek + (interval - 1) * 7);
                }
            } else {
                // Simple weekly repeat
                nextDate.setDate(nextDate.getDate() + 7 * interval);
            }
            break;

        case 'monthly':
            if (pattern.weekOfMonth && pattern.daysOfWeek && pattern.daysOfWeek.length > 0) {
                // e.g., "2nd Tuesday"
                nextDate.setMonth(nextDate.getMonth() + interval);
                const targetDayOfWeek = pattern.daysOfWeek[0];
                const targetWeek = pattern.weekOfMonth;

                // Start from first day of month
                nextDate.setDate(1);

                // Find first occurrence of target day
                while (nextDate.getDay() !== targetDayOfWeek) {
                    nextDate.setDate(nextDate.getDate() + 1);
                }

                // Add weeks to get to target week
                nextDate.setDate(nextDate.getDate() + (targetWeek - 1) * 7);
            } else if (pattern.dayOfMonth) {
                // Same day each month
                nextDate.setMonth(nextDate.getMonth() + interval);
                const targetDay = Math.min(pattern.dayOfMonth, getDaysInMonth(nextDate));
                nextDate.setDate(targetDay);
            } else {
                // Default: same date next month
                const originalDay = nextDate.getDate();
                nextDate.setMonth(nextDate.getMonth() + interval);
                // Handle months with fewer days
                if (nextDate.getDate() !== originalDay) {
                    nextDate.setDate(0); // Last day of previous month
                }
            }
            break;

        case 'custom':
            // Custom uses interval as days
            nextDate.setDate(nextDate.getDate() + interval);
            break;
    }

    // Validate against end date
    if (pattern.endDate) {
        const endDate = new Date(pattern.endDate);
        if (nextDate > endDate) {
            return null;
        }
    }

    return nextDate;
}

/**
 * Get number of days in a month
 */
function getDaysInMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * Format recurrence pattern for display
 */
export function formatRecurrenceText(pattern: RecurrencePattern): string {
    const interval = pattern.interval || 1;

    switch (pattern.type) {
        case 'daily':
            if (interval === 1) return 'Daily';
            return `Every ${interval} days`;

        case 'weekly':
            if (pattern.daysOfWeek && pattern.daysOfWeek.length > 0) {
                const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                const days = pattern.daysOfWeek.map(d => dayNames[d]).join(', ');
                if (interval === 1) return `Weekly on ${days}`;
                return `Every ${interval} weeks on ${days}`;
            }
            if (interval === 1) return 'Weekly';
            return `Every ${interval} weeks`;

        case 'monthly':
            if (pattern.weekOfMonth && pattern.daysOfWeek?.length) {
                const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                const ordinals = ['', '1st', '2nd', '3rd', '4th', '5th'];
                const day = dayNames[pattern.daysOfWeek[0]];
                const ord = ordinals[pattern.weekOfMonth];
                if (interval === 1) return `Monthly on ${ord} ${day}`;
                return `Every ${interval} months on ${ord} ${day}`;
            }
            if (interval === 1) return 'Monthly';
            return `Every ${interval} months`;

        case 'custom':
            return `Every ${interval} days`;

        default:
            return 'Repeating';
    }
}

/**
 * Check if a recurrence pattern has ended
 */
export function isRecurrenceEnded(pattern: RecurrencePattern): boolean {
    if (pattern.endAfterOccurrences && pattern.occurrenceCount !== undefined) {
        if (pattern.occurrenceCount >= pattern.endAfterOccurrences) {
            return true;
        }
    }

    if (pattern.endDate) {
        const now = new Date();
        const endDate = new Date(pattern.endDate);
        if (now > endDate) {
            return true;
        }
    }

    return false;
}

/**
 * Get preset recurrence patterns
 */
export function getRecurrencePresets(): { label: string; pattern: RecurrencePattern }[] {
    return [
        { label: 'Daily', pattern: { type: 'daily', interval: 1 } },
        { label: 'Weekdays', pattern: { type: 'weekly', interval: 1, daysOfWeek: [1, 2, 3, 4, 5] } },
        { label: 'Weekly', pattern: { type: 'weekly', interval: 1 } },
        { label: 'Bi-weekly', pattern: { type: 'weekly', interval: 2 } },
        { label: 'Monthly', pattern: { type: 'monthly', interval: 1 } },
    ];
}
