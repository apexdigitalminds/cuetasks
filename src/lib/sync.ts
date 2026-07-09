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

function taskToRow(t: Task, userId: string): TaskRow {
  return {
    id: t.id,
    owner_id: userId,
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
    created_at: t.createdAt,
  };
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
  };
}

const categoryToRow = (c: Category, userId: string): CategoryRow => ({
  id: c.id,
  owner_id: userId,
  name: c.name,
  color: c.color,
  icon: c.icon ?? null,
});

const rowToCategory = (r: CategoryRow): Category => ({
  id: r.id,
  name: r.name,
  color: r.color,
  icon: r.icon ?? undefined,
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

// Upsert the current set and delete cloud rows that no longer exist locally.
export async function pushReconcile(userId: string, categories: Category[], tasks: Task[]): Promise<void> {
  if (!supabase) return;

  if (categories.length) {
    const { error } = await supabase.from('categories').upsert(categories.map(c => categoryToRow(c, userId)));
    if (error) throw error;
  }
  if (tasks.length) {
    const { error } = await supabase.from('tasks').upsert(tasks.map(t => taskToRow(t, userId)));
    if (error) throw error;
  }

  const localTaskIds = new Set(tasks.map(t => t.id));
  const cloudTasks = await supabase.from('tasks').select('id');
  const staleTasks = (cloudTasks.data ?? []).map(r => r.id).filter(id => !localTaskIds.has(id));
  if (staleTasks.length) await supabase.from('tasks').delete().in('id', staleTasks);

  const localCatIds = new Set(categories.map(c => c.id));
  const cloudCats = await supabase.from('categories').select('id');
  const staleCats = (cloudCats.data ?? []).map(r => r.id).filter(id => !localCatIds.has(id));
  if (staleCats.length) await supabase.from('categories').delete().in('id', staleCats);
}
