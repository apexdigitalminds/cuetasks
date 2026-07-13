import React, { useEffect, useState, useCallback } from 'react';
import { X, Link2, Copy, Check, Trash2, Mail, Share2, Users } from 'lucide-react';
import {
  ResourceType, Role, Member, ShareLinkRow,
  createShareLink, listShareLinks, revokeShareLink,
  listMembers, removeMember, inviteByEmail, shareUrl,
} from '../lib/sharing';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  resourceType: ResourceType;
  resourceId: string;
  resourceName: string;
}

const RolePicker: React.FC<{ value: Role; onChange: (r: Role) => void }> = ({ value, onChange }) => (
  <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden text-xs">
    {(['viewer', 'editor'] as Role[]).map(r => (
      <button
        key={r}
        type="button"
        onClick={() => onChange(r)}
        className={`px-3 py-1.5 capitalize transition-colors ${
          value === r
            ? 'bg-indigo-600 text-white'
            : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
        }`}
      >
        {r}
      </button>
    ))}
  </div>
);

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, resourceType, resourceId, resourceName }) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [links, setLinks] = useState<ShareLinkRow[]>([]);
  const [linkRole, setLinkRole] = useState<Role>('editor');
  const [inviteRole, setInviteRole] = useState<Role>('editor');
  const [email, setEmail] = useState('');
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'warn' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [m, l] = await Promise.all([
        listMembers(resourceType, resourceId),
        listShareLinks(resourceType, resourceId),
      ]);
      setMembers(m);
      setLinks(l);
    } catch (e) {
      setFeedback({ kind: 'error', text: e instanceof Error ? e.message : 'Failed to load sharing info' });
    }
  }, [resourceType, resourceId]);

  useEffect(() => {
    if (isOpen) { setFeedback(null); refresh(); }
  }, [isOpen, refresh]);

  if (!isOpen) return null;

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setFeedback({ kind: 'warn', text: 'Could not copy — long-press the link to copy it.' });
    }
  };

  const handleCreateLink = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const url = await createShareLink(resourceType, resourceId, linkRole);
      await refresh();
      if (navigator.share) {
        navigator.share({ title: `CueTasks: ${resourceName}`, text: `Join "${resourceName}" on CueTasks`, url }).catch(() => {});
      } else {
        await copy(url, 'new');
      }
    } catch (e) {
      setFeedback({ kind: 'error', text: e instanceof Error ? e.message : 'Failed to create link' });
    }
    setBusy(false);
  };

  const handleInvite = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setFeedback(null);
    const res = await inviteByEmail(resourceType, resourceId, email.trim(), inviteRole);
    setBusy(false);
    if (res.status === 'added') {
      setEmail('');
      setFeedback({ kind: 'ok', text: 'Invited — they now have access.' });
      refresh();
    } else if (res.status === 'not_registered') {
      setFeedback({ kind: 'warn', text: `${email.trim()} isn't on CueTasks yet — share a link instead so they can join.` });
    } else {
      setFeedback({ kind: 'error', text: res.error ?? 'Failed to invite' });
    }
  };

  const feedbackClass =
    feedback?.kind === 'ok' ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
    : feedback?.kind === 'warn' ? 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20'
    : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-hidden animate-fade-in-up flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 min-w-0">
            <Share2 size={18} className="text-indigo-500 shrink-0" />
            <span className="truncate">Share “{resourceName}”</span>
          </h2>
          <button onClick={onClose} aria-label="Close" className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-6">
          {feedback && <p className={`text-sm rounded-lg px-3 py-2 ${feedbackClass}`}>{feedback.text}</p>}

          {/* Share link */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Link2 size={15} className="text-gray-400" /> Share a link
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Anyone with the link can join. Send it however you like.</p>
            <div className="flex items-center gap-2">
              <RolePicker value={linkRole} onChange={setLinkRole} />
              <button
                onClick={handleCreateLink}
                disabled={busy}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg transition-colors"
              >
                <Share2 size={14} /> Create link
              </button>
            </div>

            {links.length > 0 && (
              <div className="mt-3 space-y-2">
                {links.map(l => (
                  <div key={l.token} className="flex items-center gap-2 text-xs bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
                    <span className="capitalize text-gray-500 dark:text-gray-400 w-12 shrink-0">{l.role}</span>
                    <span className="truncate text-gray-700 dark:text-gray-300 flex-1">{shareUrl(l.token)}</span>
                    <button onClick={() => copy(shareUrl(l.token), l.token)} aria-label="Copy link" className="p-1 text-gray-400 hover:text-indigo-500">
                      {copied === l.token ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                    </button>
                    <button onClick={async () => { await revokeShareLink(l.token); refresh(); }} aria-label="Revoke link" className="p-1 text-gray-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Invite by email */}
          <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Mail size={15} className="text-gray-400" /> Invite by email
            </label>
            <div className="flex items-center gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleInvite(); }}
                placeholder="name@example.com"
                className="flex-1 min-w-0 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
              />
              <RolePicker value={inviteRole} onChange={setInviteRole} />
            </div>
            <button onClick={handleInvite} disabled={busy} className="mt-2 w-full py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-60 text-gray-700 dark:text-gray-200 rounded-lg transition-colors">
              Invite
            </button>
          </div>

          {/* People with access */}
          <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Users size={15} className="text-gray-400" /> People with access
            </label>
            {members.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500">Only you, so far.</p>
            ) : (
              <div className="space-y-2">
                {members.map(m => (
                  <div key={m.user_id} className="flex items-center gap-2 text-sm bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
                    <span className="truncate text-gray-700 dark:text-gray-300 flex-1">{m.email ?? m.user_id}</span>
                    <span className="capitalize text-xs text-gray-500 dark:text-gray-400">{m.role}</span>
                    <button onClick={async () => { await removeMember(resourceType, resourceId, m.user_id); refresh(); }} aria-label="Remove access" className="p-1 text-gray-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
