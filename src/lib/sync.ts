import { supabase } from './supabase';
import { Task, Category, RecurrencePattern } from '../types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s?: string): boolean => !!s && UUID_RE.test(s);

// UUIDs so rows fit the Supabase schema and stay unique across devices.
export const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

interface TaskRow {
  id: string;
  owner_id: string;
  category_id: string | null;
  title: string;
  due_at: string | null;
  completed: boolean;
  completed_at: string | null;
  starred: boolean;
  sort_order: number;
  reminder_enabled: boolean;
  reminder_minutes_before: number;
  recurrence: RecurrencePattern | null;
  series_id: string | null;
  created_at?: string;
}

interface CategoryRow {
  id: string;
  owner_id: string;
  name: string;
  color: string;
  icon: string | null;
}

const toIso = (dt?: string): string | null => {
  if (!dt) return null;
  const d = new Date(dt);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

// Mutable columns (everything except id / owner_id / created_at) — used for
// updating shared rows we don't own but may edit.
function taskMutable(t: Task) {
  return {
    category_id: t.categoryId ?? null,
    title: t.title,
    due_at: toIso(t.dateTime),
    completed: t.completed,
    completed_at: t.completedAt ?? null,
    starred: t.starred,
    sort_order: t.order,
    reminder_enabled: t.reminder?.enabled ?? false,
    reminder_minutes_before: t.reminder?.minutesBefore ?? 15,
    recurrence: t.recurrence ?? null,
    series_id: t.seriesId && isUuid(t.seriesId) ? t.seriesId : null,
  };
}

function taskToRow(t: Task, userId: string): TaskRow {
  return { id: t.id, owner_id: t.ownerId ?? userId, created_at: t.createdAt, ...taskMutable(t) };
}

function rowToTask(r: TaskRow): Task {
  return {
    id: r.id,
    title: r.title,
    dateTime: r.due_at ?? '',
    completed: r.completed,
    createdAt: r.created_at ?? new Date().toISOString(),
    completedAt: r.completed_at ?? undefined,
    starred: r.starred,
    order: r.sort_order,
    reminder: { enabled: r.reminder_enabled, minutesBefore: r.reminder_minutes_before },
    categoryId: r.category_id ?? undefined,
    recurrence: r.recurrence ?? undefined,
    seriesId: r.series_id ?? undefined,
    ownerId: r.owner_id,
  };
}

const categoryMutable = (c: Category) => ({ name: c.name, color: c.color, icon: c.icon ?? null });

const categoryToRow = (c: Category, userId: string): CategoryRow => ({
  id: c.id,
  owner_id: c.ownerId ?? userId,
  ...categoryMutable(c),
});

const rowToCategory = (r: CategoryRow): Category => ({
  id: r.id,
  name: r.name,
  color: r.color,
  icon: r.icon ?? undefined,
  ownerId: r.owner_id,
});

// Give any non-UUID local ids fresh UUIDs, remapping task→category references.
export function migrateToUuids(categories: Category[], tasks: Task[]): { categories: Category[]; tasks: Task[] } {
  const catMap = new Map<string, string>();
  const nextCats = categories.map(c => {
    const id = isUuid(c.id) ? c.id : newId();
    catMap.set(c.id, id);
    return { ...c, id };
  });
  const nextTasks = tasks.map(t => ({
    ...t,
    id: isUuid(t.id) ? t.id : newId(),
    categoryId: t.categoryId ? (catMap.get(t.categoryId) ?? t.categoryId) : undefined,
    seriesId: t.seriesId && isUuid(t.seriesId) ? t.seriesId : undefined,
  }));
  return { categories: nextCats, tasks: nextTasks };
}

// Ids of categories/tasks involved in sharing (visible to this user via RLS):
// ones you own that have members or an active link, plus ones shared with you.
export async function fetchSharedResourceIds(): Promise<{ categoryIds: Set<string>; taskIds: Set<string> }> {
  if (!supabase) return { categoryIds: new Set(), taskIds: new Set() };
  const [cm, ts, sl] = await Promise.all([
    supabase.from('category_members').select('category_id'),
    supabase.from('task_shares').select('task_id'),
    supabase.from('share_links').select('resource_type, resource_id').eq('revoked', false),
  ]);
  const categoryIds = new Set<string>((cm.data ?? []).map(r => r.category_id as string));
  const taskIds = new Set<string>((ts.data ?? []).map(r => r.task_id as string));
  for (const link of sl.data ?? []) {
    if (link.resource_type === 'category') categoryIds.add(link.resource_id as string);
    else taskIds.add(link.resource_id as string);
  }
  return { categoryIds, taskIds };
}

// Pull all of the signed-in user's rows (RLS scopes to them automatically).
export async function pullAll(): Promise<{ categories: Category[]; tasks: Task[] } | null> {
  if (!supabase) return null;
  const [cats, tks] = await Promise.all([
    supabase.from('categories').select('*'),
    supabase.from('tasks').select('*'),
  ]);
  if (cats.error) throw cats.error;
  if (tks.error) throw tks.error;
  return {
    categories: (cats.data as CategoryRow[]).map(rowToCategory),
    tasks: (tks.data as TaskRow[]).map(rowToTask),
  };
}

const mine = <T extends { ownerId?: string }>(items: T[], userId: string) =>
  items.filter(i => !i.ownerId || i.ownerId === userId);
const shared = <T extends { ownerId?: string }>(items: T[], userId: string) =>
  items.filter(i => i.ownerId && i.ownerId !== userId);

// Push local changes to the cloud, respecting ownership:
//  * own rows        → upsert (and delete our own rows that are gone locally)
//  * shared rows      → update mutable fields only (RLS lets editors through,
//                       silently no-ops for viewers); never inserted or deleted
export async function pushReconcile(userId: string, categories: Category[], tasks: Task[]): Promise<void> {
  if (!supabase) return;

  const myCats = mine(categories, userId);
  const myTasks = mine(tasks, userId);

  if (myCats.length) {
    const { error } = await supabase.from('categories').upsert(myCats.map(c => categoryToRow(c, userId)));
    if (error) throw error;
  }
  if (myTasks.length) {
    const { error } = await supabase.from('tasks').upsert(myTasks.map(t => taskToRow(t, userId)));
    if (error) throw error;
  }

  // Shared rows I may edit — update only; RLS enforces editor vs viewer.
  for (const t of shared(tasks, userId)) {
    await supabase.from('tasks').update(taskMutable(t)).eq('id', t.id);
  }
  for (const c of shared(categories, userId)) {
    await supabase.from('categories').update(categoryMutable(c)).eq('id', c.id);
  }

  // Delete only our OWN cloud rows that no longer exist locally.
  const myTaskIds = new Set(myTasks.map(t => t.id));
  const cloudTasks = await supabase.from('tasks').select('id').eq('owner_id', userId);
  const staleTasks = (cloudTasks.data ?? []).map(r => r.id).filter(id => !myTaskIds.has(id));
  if (staleTasks.length) await supabase.from('tasks').delete().in('id', staleTasks);

  const myCatIds = new Set(myCats.map(c => c.id));
  const cloudCats = await supabase.from('categories').select('id').eq('owner_id', userId);
  const staleCats = (cloudCats.data ?? []).map(r => r.id).filter(id => !myCatIds.has(id));
  if (staleCats.length) await supabase.from('categories').delete().in('id', staleCats);
}
