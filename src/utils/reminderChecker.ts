import { useEffect, useRef, useCallback } from 'react';
import { Task } from '../types';
import { alertUser } from './audio';

interface ReminderCallback {
    (taskId: string, taskTitle: string, message: string): void;
}

// Track which reminders have been fired to avoid duplicates
const firedReminders = new Set<string>();

export function useReminderChecker(
    tasks: Task[],
    onReminder: ReminderCallback
) {
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const tasksRef = useRef(tasks);

    // Keep tasks ref updated
    useEffect(() => {
        tasksRef.current = tasks;
    }, [tasks]);

    const checkReminders = useCallback(() => {
        const now = Date.now();

        for (const task of tasksRef.current) {
            // Skip if no reminder, already completed, or already fired
            if (!task.reminder?.enabled || task.completed) continue;
            if (!task.dateTime) continue;
            if (firedReminders.has(task.id)) continue;

            try {
                const taskDate = new Date(task.dateTime).getTime();
                const reminderTime = taskDate - (task.reminder.minutesBefore * 60 * 1000);

                // Check if reminder time has passed but task isn't due yet
                if (now >= reminderTime && now < taskDate) {
                    console.log('[ReminderChecker] Firing reminder for:', task.title);

                    // Mark as fired to prevent duplicates
                    firedReminders.add(task.id);

                    // Play sound and vibrate
                    alertUser();

                    // Calculate time until due
                    const minutesUntilDue = Math.round((taskDate - now) / 60000);
                    const message = minutesUntilDue <= 1
                        ? 'Due in less than a minute!'
                        : `Due in ${minutesUntilDue} minutes`;

                    // Trigger callback for toast notification
                    onReminder(task.id, task.title, message);

                    // Also try browser notification
                    if ('Notification' in window && Notification.permission === 'granted') {
                        new Notification(`⏰ ${task.title}`, {
                            body: message,
                            icon: '/icons/icon-192.png',
                            tag: `reminder-${task.id}`,
                            requireInteraction: true
                        });
                    }
                }

                // Clean up old entries when task is past due
                if (now > taskDate + 3600000) { // 1 hour past due
                    firedReminders.delete(task.id);
                }
            } catch (error) {
                console.warn('[ReminderChecker] Error processing task:', task.id, error);
            }
        }
    }, [onReminder]);

    // Set up interval check
    useEffect(() => {
        console.log('[ReminderChecker] Starting with', tasks.length, 'tasks');

        // Check immediately
        checkReminders();

        // Check every 10 seconds for more reliable timing
        intervalRef.current = setInterval(checkReminders, 10000);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [checkReminders]);

    // Also check when tab becomes visible
    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                console.log('[ReminderChecker] Tab visible, checking reminders');
                checkReminders();
            }
        };

        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [checkReminders]);

    // Clear fired reminder when task is completed or deleted
    const clearFiredReminder = useCallback((taskId: string) => {
        firedReminders.delete(taskId);
    }, []);

    return { clearFiredReminder };
}

// Export for resetting on task edit
export function resetFiredReminder(taskId: string) {
    firedReminders.delete(taskId);
}
