import React, { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, BellRing, Settings, BarChart3, LogIn, User, List, CalendarDays } from 'lucide-react';
import { TaskProvider, useTaskContext } from './contexts/TaskContext';
import { useTheme } from './hooks/useTheme';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Logo from './components/Logo';
import AuthModal from './components/AuthModal';
import InstallBanner from './components/InstallBanner';
import CalendarView from './components/CalendarView';
import { redeemShareLink } from './lib/sharing';
import { showLocalNotification } from './utils/notifications';
import TaskForm from './components/TaskForm';
import TaskList from './components/TaskList';
import DailySummary from './components/DailySummary';
import ToastNotification, { Toast } from './components/ToastNotification';
import { getToday } from './utils/dateUtils';
import { alertUser, initAudio, playNotificationSound } from './utils/audio';
import { useReminderChecker } from './utils/reminderChecker';
import CategoryManager from './components/CategoryManager';
import TaskHistory from './components/TaskHistory';

// Notification Button Component with permission state
const NotificationButton: React.FC = () => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const handleClick = async () => {
    if (!('Notification' in window)) {
      alert('Notifications are not supported in this browser');
      return;
    }

    if (permission === 'granted') {
      // Test notification
      playNotificationSound();
      void showLocalNotification('CueTasks', {
        body: 'Notifications are working! 🎉',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
      });
      return;
    }

    if (permission === 'denied') {
      alert('Notifications are blocked. Please enable them in your browser settings:\n\n1. Click the lock icon in the address bar\n2. Find "Notifications" setting\n3. Change to "Allow"');
      return;
    }

    // Request permission
    setIsRequesting(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        playNotificationSound();
        void showLocalNotification('CueTasks', {
          body: 'Notifications enabled successfully! 🎉',
          icon: '/icon-192.png',
          badge: '/icon-192.png',
        });
      }
    } catch (error) {
      console.error('Failed to request notification permission:', error);
    }
    setIsRequesting(false);
  };

  const getButtonStyle = () => {
    if (permission === 'granted') {
      return 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50';
    }
    if (permission === 'denied') {
      return 'bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50';
    }
    return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700';
  };

  const getTitle = () => {
    if (permission === 'granted') return 'Notifications enabled - click to test';
    if (permission === 'denied') return 'Notifications blocked - click for help';
    return 'Click to enable notifications';
  };

  const Icon = permission === 'denied' ? BellOff : permission === 'granted' ? BellRing : Bell;

  return (
    <button
      onClick={handleClick}
      disabled={isRequesting}
      className={`p-2.5 rounded-xl transition-all duration-200 ${getButtonStyle()} ${isRequesting ? 'animate-pulse' : ''}`}
      aria-label={getTitle()}
      title={getTitle()}
    >
      <Icon size={20} />
    </button>
  );
};


// Account button — only shown when cloud sync is configured.
const AccountButton: React.FC<{ onSignIn: () => void }> = ({ onSignIn }) => {
  const { configured, user, signOut } = useAuth();
  if (!configured) return null;

  if (user) {
    return (
      <button
        onClick={() => signOut()}
        className="p-2.5 rounded-xl bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 transition-all duration-200"
        aria-label="Sign out"
        title={`Signed in as ${user.email} — click to sign out`}
      >
        <User size={20} />
      </button>
    );
  }

  return (
    <button
      onClick={onSignIn}
      className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200"
      aria-label="Sign in"
      title="Sign in to sync across devices"
    >
      <LogIn size={20} />
    </button>
  );
};

const AppContent: React.FC = () => {
  const taskContext = useTaskContext();
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const { user } = useAuth();
  const [isDark, toggleTheme] = useTheme();
  const [pendingJoin, setPendingJoin] = useState<string | null>(null);
  const [calendarView, setCalendarView] = useState(false);

  // Capture a share-link token (?join=…) from the URL on load, then clean it up.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('join');
    if (token) {
      setPendingJoin(token);
      params.delete('join');
      const rest = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''));
    }
  }, []);

  // Redeem the link once signed in (prompt sign-in first if needed).
  useEffect(() => {
    if (!pendingJoin || !taskContext) return;
    if (!user) { setShowAuth(true); return; }
    let cancelled = false;
    (async () => {
      const res = await redeemShareLink(pendingJoin);
      if (cancelled) return;
      setPendingJoin(null);
      if (res.ok) {
        await taskContext.refreshFromCloud();
        setToasts(prev => [...prev, { id: `join-${Date.now()}`, title: 'Shared with you', message: 'The shared list is now in your account.', type: 'success' }]);
      } else {
        setToasts(prev => [...prev, { id: `join-${Date.now()}`, title: 'Could not join', message: res.error || 'This link may be invalid or expired.', type: 'info' }]);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingJoin, user]);

  // Callback for when a reminder fires
  const handleReminderFired = useCallback((taskId: string, taskTitle: string, message: string) => {
    const toast: Toast = {
      id: `reminder-${taskId}-${Date.now()}`,
      title: taskTitle,
      message: message,
      type: 'reminder',
      taskId
    };
    setToasts(prev => [...prev, toast]);

    // Auto-dismiss after 15 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toast.id));
    }, 15000);
  }, []);

  // Use in-app reminder checker (reliable fallback to service worker)
  useReminderChecker(taskContext?.tasks || [], handleReminderFired);

  // Initialize audio on first user interaction
  useEffect(() => {
    const handleInteraction = () => {
      initAudio();
      document.removeEventListener('click', handleInteraction);
    };
    document.addEventListener('click', handleInteraction);
    return () => document.removeEventListener('click', handleInteraction);
  }, []);

  // Listen for notification events from service worker
  useEffect(() => {
    const handleNotificationShown = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { taskId, taskTitle } = customEvent.detail || {};

      if (taskTitle) {
        // Play sound and vibrate
        alertUser();

        // Show in-app toast
        const toast: Toast = {
          id: Date.now().toString(),
          title: taskTitle,
          message: 'Task reminder',
          type: 'reminder',
          taskId
        };
        setToasts(prev => [...prev, toast]);

        // Auto-dismiss after 10 seconds
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== toast.id));
        }, 10000);
      }
    };

    window.addEventListener('notificationShown', handleNotificationShown);
    return () => window.removeEventListener('notificationShown', handleNotificationShown);
  }, []);

  const handleDismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const handleCompleteFromToast = useCallback((taskId: string) => {
    if (taskContext) {
      taskContext.toggleTaskStatus(taskId);
    }
    setToasts(prev => prev.filter(t => t.taskId !== taskId));
  }, [taskContext]);

  if (!taskContext) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Logo size={56} idSuffix="loading" className="mx-auto mb-4 drop-shadow-lg" />
          <p className="text-gray-600 dark:text-gray-400 animate-pulse">Loading CueTasks...</p>
        </div>
      </div>
    );
  }

  const { getTasksForDate } = taskContext;
  const tasks = getTasksForDate(selectedDate);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      {/* Toast Notifications */}
      <ToastNotification
        toasts={toasts}
        onDismiss={handleDismissToast}
        onComplete={handleCompleteFromToast}
      />

      {/* Category Manager Modal */}
      <CategoryManager isOpen={showSettings} onClose={() => setShowSettings(false)} isDark={isDark} onToggleTheme={toggleTheme} />

      {/* Task History Modal */}
      <TaskHistory isOpen={showHistory} onClose={() => setShowHistory(false)} />

      {/* Auth Modal */}
      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />

      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border-b border-gray-200/50 dark:border-gray-700/50 
                        py-4 px-4 sm:px-6 fixed top-0 w-full z-40">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size={40} idSuffix="header" className="shrink-0 drop-shadow-sm" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">CueTasks</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">Say it. Cue it. Get it done.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(true)}
              className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 
                         transition-all duration-200 text-gray-600 dark:text-gray-300"
              aria-label="Task History"
              title="View Task History"
            >
              <BarChart3 size={20} />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 
                         transition-all duration-200 text-gray-600 dark:text-gray-300"
              aria-label="Settings"
              title="Settings"
            >
              <Settings size={20} />
            </button>
            <AccountButton onSignIn={() => setShowAuth(true)} />
            <NotificationButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto pt-24 pb-24 px-4 sm:px-6">
        {/* Proactive install nudge (hides once installed) */}
        <InstallBanner />

        {/* Daily Summary - Full width */}
        <DailySummary selectedDate={selectedDate} onDateChange={setSelectedDate} />

        {/* List / Calendar view toggle */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
            <button
              onClick={() => setCalendarView(false)}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg transition-colors ${!calendarView ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
            >
              <List size={16} /> List
            </button>
            <button
              onClick={() => setCalendarView(true)}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg transition-colors ${calendarView ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
            >
              <CalendarDays size={16} /> Calendar
            </button>
          </div>
        </div>

        {/* Month overview (optional) */}
        {calendarView && <CalendarView selectedDate={selectedDate} onSelectDate={setSelectedDate} />}

        {/* Content Grid - Responsive */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Task Form - Sidebar on large screens */}
          <div className="lg:col-span-4 order-2 lg:order-1">
            <div className="lg:sticky lg:top-24">
              <TaskForm />
            </div>
          </div>

          {/* Task List - Main content */}
          <div className="lg:col-span-8 order-1 lg:order-2">
            <TaskList tasks={tasks} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border-t border-gray-200/50 dark:border-gray-700/50 
                        py-4 px-4 sm:px-6 fixed bottom-0 w-full">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            CueTasks
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            © 2026
          </p>
        </div>
      </footer>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <TaskProvider>
        <AppContent />
      </TaskProvider>
    </AuthProvider>
  );
}

export default App;