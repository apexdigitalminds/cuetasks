import { supabase } from './supabase';

export type ResourceType = 'category' | 'task';
export type Role = 'viewer' | 'editor';

export interface Member {
  user_id: string;
  email: string | null;
  role: Role;
}

export interface ShareLinkRow {
  token: string;
  role: Role;
  created_at: string;
}

const membersTable = (rt: ResourceType) => (rt === 'category' ? 'category_members' : 'task_shares');
const idColumn = (rt: ResourceType) => (rt === 'category' ? 'category_id' : 'task_id');

export const shareUrl = (token: string) => `${window.location.origin}/?join=${token}`;

export async function createShareLink(rt: ResourceType, resourceId: string, role: Role): Promise<string> {
  if (!supabase) throw new Error('Cloud sync is not configured');
  const { data, error } = await supabase
    .from('share_links')
    .insert({ resource_type: rt, resource_id: resourceId, role })
    .select('token')
    .single();
  if (error) throw error;
  return shareUrl(data.token);
}

export async function listShareLinks(rt: ResourceType, resourceId: string): Promise<ShareLinkRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('share_links')
    .select('token, role, created_at')
    .eq('resource_type', rt)
    .eq('resource_id', resourceId)
    .eq('revoked', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ShareLinkRow[];
}

export async function revokeShareLink(token: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('share_links').delete().eq('token', token);
  if (error) throw error;
}

export async function redeemShareLink(token: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Cloud sync is not configured' };
  const { data, error } = await supabase.rpc('redeem_share_link', { link_token: token });
  if (error) return { ok: false, error: error.message };
  return (data ?? { ok: false, error: 'Unknown error' }) as { ok: boolean; error?: string };
}

export async function listMembers(rt: ResourceType, resourceId: string): Promise<Member[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from(membersTable(rt))
    .select('user_id, role, invited_email')
    .eq(idColumn(rt), resourceId);
  if (error) throw error;
  return (data ?? []).map(r => ({ user_id: r.user_id, email: r.invited_email ?? null, role: r.role as Role }));
}

export async function removeMember(rt: ResourceType, resourceId: string, userId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from(membersTable(rt))
    .delete()
    .eq(idColumn(rt), resourceId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function inviteByEmail(
  rt: ResourceType,
  resourceId: string,
  email: string,
  role: Role,
): Promise<{ status: 'added' | 'not_registered' | 'error'; error?: string }> {
  if (!supabase) return { status: 'error', error: 'Cloud sync is not configured' };
  const { data: uid, error: rpcErr } = await supabase.rpc('find_user_id_by_email', { lookup_email: email });
  if (rpcErr) return { status: 'error', error: rpcErr.message };
  if (!uid) return { status: 'not_registered' };

  const row: Record<string, unknown> = rt === 'category'
    ? { category_id: resourceId, user_id: uid, role, invited_email: email }
    : { task_id: resourceId, user_id: uid, role, invited_email: email };
  const { error } = await supabase.from(membersTable(rt)).upsert(row as never);
  if (error) return { status: 'error', error: error.message };
  return { status: 'added' };
}
