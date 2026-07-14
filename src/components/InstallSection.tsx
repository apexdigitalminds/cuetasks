import React from 'react';
import { Download, Share } from 'lucide-react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

// Rendered inside the Settings modal. Hidden when already installed or when
// there's nothing to offer (e.g. an unsupported browser).
const InstallSection: React.FC = () => {
  const { canInstall, promptInstall, isIOS, isStandalone } = useInstallPrompt();

  if (isStandalone) return null;
  if (!canInstall && !isIOS) return null;

  return (
    <div className="mb-6 pb-6 border-b border-gray-100 dark:border-gray-700">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        <Download size={15} className="text-gray-400" />
        Install app
      </label>
      {canInstall ? (
        <button
          onClick={promptInstall}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-sm gradient-primary text-white rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-indigo-500/25"
        >
          <Download size={16} />
          Add CueTasks to your device
        </button>
      ) : (
        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
          <Share size={14} className="shrink-0" />
          On iPhone/iPad: tap Share, then “Add to Home Screen”.
        </p>
      )}
    </div>
  );
};

export default InstallSection;
