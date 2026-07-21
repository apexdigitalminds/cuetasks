import React, { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { isPushConfigured, isPushEnabled, enablePush, disablePush } from '../lib/push';

// Background reminders via Web Push — fire even when the app is closed.
// Cloud-only (the server sends them), so this is signed-in + configured only.
const PushSettings: React.FC = () => {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const available = isPushConfigured();

  useEffect(() => {
    if (available) isPushEnabled().then(setEnabled);
  }, [available]);

  if (!available) return null;

  const toggle = async () => {
    setBusy(true);
    setError('');
    if (enabled) {
      await disablePush();
      setEnabled(false);
    } else {
      const res = await enablePush();
      if (res.ok) setEnabled(true);
      else setError(res.error ?? 'Could not enable');
    }
    setBusy(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <span className="text-gray-400 dark:text-gray-500"><BellRing size={16} /></span>
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Background reminders</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Notify me even when the app is closed</p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Background reminders"
          disabled={busy}
          onClick={toggle}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-50 ${
            enabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'
          }`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </button>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
};

export default PushSettings;
