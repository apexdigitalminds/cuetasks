import React from 'react';
import { Bell, Volume2, Vibrate, Clock } from 'lucide-react';
import { useNotificationSettings } from '../utils/notificationSettings';

interface ToggleRowProps {
  checked: boolean;
  onChange: () => void;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ checked, onChange, label, description, icon }) => (
  <div className="flex items-center justify-between py-2">
    <div className="flex items-center gap-3">
      <span className="text-gray-400 dark:text-gray-500">{icon}</span>
      <div>
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
      </div>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${
        checked ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  </div>
);

const NotificationSettings: React.FC = () => {
  const [settings, update] = useNotificationSettings();

  return (
    <div className="space-y-0.5">
      <ToggleRow
        icon={<Volume2 size={16} />}
        label="Sound"
        description="Play an alert tone"
        checked={settings.sound}
        onChange={() => update({ sound: !settings.sound })}
      />
      <ToggleRow
        icon={<Vibrate size={16} />}
        label="Vibration"
        description="Vibrate on mobile devices"
        checked={settings.vibrate}
        onChange={() => update({ vibrate: !settings.vibrate })}
      />
      <ToggleRow
        icon={<Bell size={16} />}
        label="Remind before due"
        description="Use each task's reminder lead time"
        checked={settings.remindBefore}
        onChange={() => update({ remindBefore: !settings.remindBefore })}
      />
      <ToggleRow
        icon={<Clock size={16} />}
        label="Alert when due"
        description="Notify the moment a task is due"
        checked={settings.alertOnDue}
        onChange={() => update({ alertOnDue: !settings.alertOnDue })}
      />
    </div>
  );
};

export default NotificationSettings;
