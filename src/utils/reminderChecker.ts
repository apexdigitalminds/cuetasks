import { useEffect, useRef, useCallback } from 'react';
import { Task } from '../types';
import { alertUser } from './audio';
import { getNotificationSettings } from './notificationSettings';

interface ReminderCallback {
    (taskId: string, taskTitle: string, message: string): void;
}

// Track which alerts have already fired to avoid duplicates.
const firedReminders = new Set<string>();  // lead-time ("before due") reminders
const firedDueAlerts = new Set<string>();  // "due now" alerts

// Play sound/vibration (per settings), raise an in-app toast, and a browser notification.
function fireReminder(task: Task, message: string, onReminder: ReminderCallback) {
    console.log('[ReminderChecker] Firing reminder for:', task.title);
    alertUser();
    onReminder(task.id, task.title, message);
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(`⏰ ${task.title}`, {
            body: message,
            icon: '/icon-192.png',
            tag: `reminder-${task.id}`,
            requireInteraction: true,
        });
    }
}

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
        const settings = getNotificationSettings();

        for (const task of tasksRef.current) {
            if (task.completed || !task.dateTime) continue;

            try {
                const taskDate = new Date(task.dateTime).getTime();
                if (isNaN(taskDate)) continue;

                // Lead-time reminder ("X minutes before due") — needs a per-task reminder.
                if (settings.remindBefore && task.reminder?.enabled && !firedReminders.has(task.id)) {
                    const reminderTime = taskDate - (task.reminder.minutesBefore * 60 * 1000);
                    if (now >= reminderTime && now < taskDate) {
                        firedReminders.add(task.id);
                        const minutesUntilDue = Math.round((taskDate - now) / 60000);
                        const message = minutesUntilDue <= 1
                            ? 'Due in less than a minute!'
                            : `Due in ${minutesUntilDue} minutes`;
                        fireReminder(task, message, onReminder);
                    }
                }

                // Due alert — fires once when any dated task reaches its due time.
                if (settings.alertOnDue && !firedDueAlerts.has(task.id)) {
                    if (now >= taskDate && now < taskDate + 3600000) {
                        firedDueAlerts.add(task.id);
                        fireReminder(task, 'Due now', onReminder);
                    }
                }

                // Clean up once well past due so the sets don't grow unbounded.
                if (now > taskDate + 3600000) {
                    firedReminders.delete(task.id);
                    firedDueAlerts.delete(task.id);
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

    // Clear fired alerts when task is completed or deleted
    const clearFiredReminder = useCallback((taskId: string) => {
        firedReminders.delete(taskId);
        firedDueAlerts.delete(taskId);
    }, []);

    return { clearFiredReminder };
}

// Export for resetting on task edit
export function resetFiredReminder(taskId: string) {
    firedReminders.delete(taskId);
    firedDueAlerts.delete(taskId);
}
