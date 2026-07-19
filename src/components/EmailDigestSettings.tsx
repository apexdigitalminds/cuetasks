import React, { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Send } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTaskContext } from '../contexts/TaskContext';
import {
  EmailDigestSettings as Digest,
  DEFAULT_EMAIL_DIGEST,
  getEmailDigest,
  saveEmailDigest,
  sendTestDigest,
} from '../lib/userSettings';

const Segmented = <T extends string>({ value, options, onChange }: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) => (
  <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden text-xs">
    {options.map(o => (
      <button
        key={o.value}
        type="button"
        onClick={() => onChange(o.value)}
        className={`px-3 py-1.5 transition-colors ${
          value === o.value
            ? 'bg-indigo-600 text-white'
            : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
        }`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

const EmailDigestSettings: React.FC = () => {
  const { user, configured } = useAuth();
  const { categories } = useTaskContext();
  const [digest, setDigest] = useState<Digest>(DEFAULT_EMAIL_DIGEST);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [loaded, setLoaded] = useState(false);
  const [testState, setTestState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [testError, setTestError] = useState('');

  const handleTest = async () => {
    setTestState('sending');
    setTestError('');
    const res = await sendTestDigest();
    if (res.ok) {
      setTestState('sent');
      setTimeout(() => setTestState('idle'), 4000);
    } else {
      setTestError(res.error ?? 'Could not send');
      setTestState('error');
    }
  };

  useEffect(() => {
    if (!configured || !user) return;
    let cancelled = false;
    getEmailDigest()
      .then(d => { if (!cancelled) { setDigest(d); setLoaded(true); } })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [configured, user]);

  const persist = useCallback(async (next: Digest) => {
    if (!user) return;
    setDigest(next);
    setStatus('saving');
    try {
      await saveEmailDigest(user.id, next);
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 1500);
    } catch {
      setStatus('error');
    }
  }, [user]);

  // Cloud-only feature: nothing to configure until you're signed in.
  if (!configured || !user) return null;

  const toggleCategory = (id: string) => {
    const ids = digest.category_ids.includes(id)
      ? digest.category_ids.filter(c => c !== id)
      : [...digest.category_ids, id];
    persist({ ...digest, category_ids: ids });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between py-1">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Email me a digest</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            Sent to {user.email}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={digest.enabled}
          aria-label="Email digest"
          disabled={!loaded}
          onClick={() => persist({ ...digest, enabled: !digest.enabled })}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-50 ${
            digest.enabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'
          }`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
            digest.enabled ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </button>
      </div>

      {digest.enabled && (
        <div className="space-y-3 pl-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-600 dark:text-gray-400">How often</span>
            <Segmented
              value={digest.frequency}
              onChange={v => persist({ ...digest, frequency: v })}
              options={[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }]}
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-600 dark:text-gray-400">Send at</span>
            <input
              type="time"
              value={digest.send_at}
              onChange={e => persist({ ...digest, send_at: e.target.value })}
              className="px-2 py-1 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-gray-200"
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-600 dark:text-gray-400">Include</span>
            <Segmented
              value={digest.scope}
              onChange={v => persist({ ...digest, scope: v })}
              options={[{ value: 'all', label: 'All tasks' }, { value: 'categories', label: 'Chosen lists' }]}
            />
          </div>

          {digest.scope === 'categories' && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {categories.map(c => {
                const on = digest.category_ids.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCategory(c.id)}
                    className={`px-2 py-1 text-xs rounded-lg border transition-all ${on ? 'ring-1 ring-offset-1 dark:ring-offset-gray-800' : 'opacity-60 hover:opacity-100'}`}
                    style={{
                      backgroundColor: on ? c.color : `${c.color}18`,
                      color: on ? 'white' : c.color,
                      borderColor: on ? c.color : `${c.color}40`,
                    }}
                  >
                    {c.icon} {c.name}
                  </button>
                );
              })}
              {digest.category_ids.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 w-full">Pick at least one list, or the digest will be empty.</p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="pt-1">
        <button
          type="button"
          onClick={handleTest}
          disabled={testState === 'sending'}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-60 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
        >
          {testState === 'sending'
            ? <><Loader2 size={14} className="animate-spin" /> Sending…</>
            : <><Send size={14} /> Send test digest now</>}
        </button>
        {testState === 'sent' && (
          <p className="mt-1.5 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
            <Check size={12} /> Sent — check {user.email}
          </p>
        )}
        {testState === 'error' && (
          <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{testError}</p>
        )}
      </div>

      <div className="h-4">
        {status === 'saving' && (
          <span className="text-xs text-gray-400 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Saving…</span>
        )}
        {status === 'saved' && (
          <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1"><Check size={12} /> Saved</span>
        )}
        {status === 'error' && (
          <span className="text-xs text-red-600 dark:text-red-400">Couldn’t save — check your connection.</span>
        )}
      </div>
    </div>
  );
};

export default EmailDigestSettings;
