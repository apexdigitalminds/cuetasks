import React from 'react';
import { Bell, X, Check, Clock } from 'lucide-react';

interface Toast {
    id: string;
    title: string;
    message: string;
    type: 'reminder' | 'success' | 'info';
    taskId?: string;
    onComplete?: () => void;
}

interface ToastNotificationProps {
    toasts: Toast[];
    onDismiss: (id: string) => void;
    onComplete?: (taskId: string) => void;
}

const ToastNotification: React.FC<ToastNotificationProps> = ({ toasts, onDismiss, onComplete }) => {
    return (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className="pointer-events-auto bg-white dark:bg-gray-800 rounded-xl shadow-2xl 
                     border border-gray-200 dark:border-gray-700 overflow-hidden
                     animate-slide-in-right transform transition-all duration-300"
                >
                    {/* Colored top bar based on type */}
                    <div className={`h-1 ${toast.type === 'reminder' ? 'bg-gradient-to-r from-indigo-500 to-purple-500' :
                        toast.type === 'success' ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                            'bg-gradient-to-r from-blue-500 to-cyan-500'
                        }`} />

                    <div className="p-4">
                        <div className="flex items-start gap-3">
                            {/* Icon */}
                            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${toast.type === 'reminder' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' :
                                toast.type === 'success' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' :
                                    'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                }`}>
                                {toast.type === 'reminder' ? <Bell size={20} /> :
                                    toast.type === 'success' ? <Check size={20} /> :
                                        <Clock size={20} />}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                                    {toast.title}
                                </h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                                    {toast.message}
                                </p>

                                {/* Actions for reminders */}
                                {toast.type === 'reminder' && toast.taskId && (
                                    <div className="flex gap-2 mt-3">
                                        <button
                                            onClick={() => onComplete?.(toast.taskId!)}
                                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs 
                                 font-medium py-1.5 px-3 rounded-lg transition-colors"
                                        >
                                            Complete
                                        </button>
                                        <button
                                            onClick={() => onDismiss(toast.id)}
                                            className="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 
                                 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 
                                 text-xs font-medium py-1.5 px-3 rounded-lg transition-colors"
                                        >
                                            Dismiss
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Close button */}
                            <button
                                onClick={() => onDismiss(toast.id)}
                                className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 
                           transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ToastNotification;
export type { Toast };
