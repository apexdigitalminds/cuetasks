import React, { useState } from 'react';
import { Download, X, Share } from 'lucide-react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import Logo from './Logo';

const SNOOZE_KEY = 'installBannerSnoozedUntil';
const SNOOZE_DAYS = 7; // dismissing hides the nudge for a week, then it returns

// Proactive install nudge. Appears on its own when the app is installable and
// disappears for good once installed. Dismissing only snoozes it — Settings
// still offers Install at any time.
const InstallBanner: React.FC = () => {
  const { canInstall, promptInstall, isIOS, isStandalone } = useInstallPrompt();
  const [snoozed, setSnoozed] = useState<boolean>(() => {
    try {
      return Date.now() < Number(localStorage.getItem(SNOOZE_KEY) || 0);
    } catch {
      return false;
    }
  });

  if (isStandalone) return null;            // already installed — self-hiding
  if (snoozed) return null;
  if (!canInstall && !isIOS) return null;   // nothing we can offer here

  const snooze = () => {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000));
    } catch { /* ignore */ }
    setSnoozed(true);
  };

  return (
    <div className="mb-6 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/70 dark:bg-indigo-900/20 p-4 flex items-center gap-3 animate-fade-in-up">
      <Logo size={36} idSuffix="install-banner" className="shrink-0" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white">Install CueTasks</p>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {canInstall
            ? 'Add it to your home screen for one-tap access, offline use and reminders.'
            : 'Tap Share, then “Add to Home Screen”, for one-tap access and offline use.'}
        </p>
      </div>

      {canInstall ? (
        <button
          onClick={promptInstall}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm gradient-primary text-white rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-indigo-500/25"
        >
          <Download size={16} />
          Install
        </button>
      ) : (
        <Share size={18} className="shrink-0 text-indigo-500 dark:text-indigo-400" />
      )}

      <button
        onClick={snooze}
        aria-label="Dismiss install banner"
        className="shrink-0 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-white/60 dark:hover:bg-gray-700/50 transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
};

export default InstallBanner;
