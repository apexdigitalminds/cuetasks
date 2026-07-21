import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { Task, TaskReminder, Category, DEFAULT_CATEGORIES, RecurrencePattern } from '../types';
import { isSameDay, getToday, isOverdue } from '../utils/dateUtils';
import { getNextOccurrenceDate, isRecurrenceEnded } from '../utils/recurrence';
import { resetFiredReminder } from '../utils/reminderChecker';
import { useAuth } from './AuthContext';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { pullAll, pushReconcile, migrateToUuids, newId, fetchSharedResourceIds } from '../lib/sync';

// Serialised view of the working set; used to skip redundant/echoed cloud pushes
// and to detect offline edits made since the last successful sync.
const syncSnapshot = (categories: Category[], tasks: Task[]): string =>
  JSON.stringify({ categories, tasks });
const SNAP_KEY = 'cuetasks_synced_snapshot';

interface TaskContextType {
  tasks: Task[];
  categories: Category[];
  addTask: (title: string, dateTime: string, reminder?: TaskReminder, categoryId?: string, recurrence?: RecurrencePattern) => void;
  toggleTaskStatus: (id: string) => void;
  deleteTask: (id: string) => void;
  getTasksForDate: (date: string) => Task[];
  toggleTaskStar: (id: string) => void;
  moveTaskUp: (id: string) => void;
  moveTaskDown: (id: string) => void;
  editTaskTitle: (id: string, newTitle: string) => void;
  editTask: (id: string, updates: Partial<Pick<Task, 'title' | 'dateTime' | 'reminder' | 'categoryId'>>) => void;
  addCategory: (name: string, color: string, icon: string) => void;
  deleteCategory: (id: string) => void;
  getCategoryById: (id: string) => Category | undefined;
  refreshFromCloud: () => Promise<void>;
  sharedCategoryIds: Set<string>;
  sharedTaskIds: Set<string>;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const useTaskContext = () => {
  const context = useContext(TaskContext);
  if (context === undefined) {
    throw new Error('useTaskContext must be used within a TaskProvider');
  }
  return context;
};

interface TaskProviderProps {
  children: ReactNode;
}

export const TaskProvider: React.FC<TaskProviderProps> = ({ children }) => {
  // Initialise straight from localStorage so the first render already has the
  // persisted data. (A prior load-via-useEffect raced the save effect and could
  // wipe stored tasks on mount — notably under React StrictMode's double-invoke.)
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem('tasks');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (error) {
      console.warn('Failed to load tasks from localStorage:', error);
      localStorage.removeItem('tasks');
    }
    return [];
  });
  const [categories, setCategories] = useState<Category[]>(() => {
    try {
      const saved = localStorage.getItem('categories');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (error) {
      console.warn('Failed to load categories from localStorage:', error);
    }
    return DEFAULT_CATEGORIES;
  });

  // ── Cloud sync state ──
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const tasksRef = useRef(tasks);
  const categoriesRef = useRef(categories);
  const initialSyncedFor = useRef<string | null>(null); // userId whose initial sync completed
  const syncingRef = useRef(false);
  const lastSyncedSnapshot = useRef<string>(''); // serialised state last known in sync with cloud
  const prevUserId = useRef<string | null>(null);
  const [sharedCategoryIds, setSharedCategoryIds] = useState<Set<string>>(new Set());
  const [sharedTaskIds, setSharedTaskIds] = useState<Set<string>>(new Set());

  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  useEffect(() => { categoriesRef.current = categories; }, [categories]);

  const sortTasks = (tasksToSort: Task[]): Task[] => {
    return [...tasksToSort].sort((a, b) => {
      if (a.starred && !b.starred) return -1;
      if (!a.starred && b.starred) return 1;
      if (!a.completed && b.completed) return -1;
      if (a.completed && !b.completed) return 1;
      return a.order - b.order;
    });
  };

  // Handle notification-triggered task completion
  useEffect(() => {
    const handleCompleteFromNotification = (event: Event) => {
      const customEvent = event as CustomEvent;
      const taskId = customEvent.detail?.taskId;
      if (taskId) {
        setTasks(prevTasks =>
          sortTasks(
            prevTasks.map(task =>
              task.id === taskId ? { ...task, completed: true } : task
            )
          )
        );
      }
    };

    window.addEventListener('completeTaskFromNotification', handleCompleteFromNotification);
    return () => window.removeEventListener('completeTaskFromNotification', handleCompleteFromNotification);
  }, []);

  // Save tasks to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('tasks', JSON.stringify(tasks));
    } catch (error) {
      console.warn('Failed to save tasks to localStorage:', error);
    }
  }, [tasks]);

  // Save categories to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('categories', JSON.stringify(categories));
    } catch (error) {
      console.warn('Failed to save categories to localStorage:', error);
    }
  }, [categories]);

  // Record the state that is currently in sync with the cloud (in the ref and
  // persisted, so offline edits can be detected across reloads).
  const markSynced = useCallback((cats: Category[], tks: Task[]) => {
    const snap = syncSnapshot(cats, tks);
    lastSyncedSnapshot.current = snap;
    try { localStorage.setItem(SNAP_KEY, snap); } catch { /* ignore */ }
  }, []);

  // Which lists/tasks are shared (for the UI indicators).
  const refreshSharedIds = useCallback(async () => {
    if (!isSupabaseConfigured || !userId) {
      setSharedCategoryIds(new Set());
      setSharedTaskIds(new Set());
      return;
    }
    try {
      const { categoryIds, taskIds } = await fetchSharedResourceIds();
      setSharedCategoryIds(categoryIds);
      setSharedTaskIds(taskIds);
    } catch (error) {
      console.warn('[sync] shared ids fetch failed:', error);
    }
  }, [userId]);

  // ── On sign-out, clear the working set ──
  // Prevents another account on the same device from inheriting the previous
  // user's tasks (their data stays safe in the cloud and returns on sign-in).
  useEffect(() => {
    if (prevUserId.current && !userId) {
      initialSyncedFor.current = null;
      lastSyncedSnapshot.current = '';
      try { localStorage.removeItem(SNAP_KEY); } catch { /* ignore */ }
      setTasks([]);
      setCategories(DEFAULT_CATEGORIES);
      setSharedCategoryIds(new Set());
      setSharedTaskIds(new Set());
    }
    prevUserId.current = userId;
  }, [userId]);

  // ── Initial sync on sign-in ──
  // If the cloud is empty, migrate the local set up (assigning UUIDs). Otherwise
  // the cloud is authoritative and we adopt it. localStorage stays the offline cache.
  useEffect(() => {
    if (!isSupabaseConfigured || !userId) {
      if (!userId) initialSyncedFor.current = null;
      return;
    }
    if (initialSyncedFor.current === userId) return;

    let cancelled = false;
    (async () => {
      syncingRef.current = true;
      try {
        const cloud = await pullAll();
        if (cancelled || !cloud) return;

        let finalCats: Category[];
        let finalTasks: Task[];
        if (cloud.categories.length === 0 && cloud.tasks.length === 0) {
          const migrated = migrateToUuids(categoriesRef.current, tasksRef.current);
          finalCats = migrated.categories;
          finalTasks = migrated.tasks;
          setCategories(finalCats);
          setTasks(finalTasks);
          await pushReconcile(userId, finalCats, finalTasks);
        } else {
          // Cloud has data. If this device made offline edits since it last
          // synced, push them up first so they aren't lost, then re-pull merged.
          let persisted = '';
          try { persisted = localStorage.getItem(SNAP_KEY) || ''; } catch { /* ignore */ }
          const hasLocal = tasksRef.current.length > 0 || categoriesRef.current.length > 0;
          const localDirty = !!persisted && hasLocal && syncSnapshot(categoriesRef.current, tasksRef.current) !== persisted;

          if (localDirty) {
            await pushReconcile(userId, categoriesRef.current, tasksRef.current);
            const merged = await pullAll();
            finalCats = merged && merged.categories.length ? merged.categories : DEFAULT_CATEGORIES;
            finalTasks = merged ? merged.tasks : [];
          } else {
            finalCats = cloud.categories.length ? cloud.categories : DEFAULT_CATEGORIES;
            finalTasks = cloud.tasks;
          }
          setCategories(finalCats);
          setTasks(finalTasks);
        }
        if (!cancelled) {
          markSynced(finalCats, finalTasks);
          initialSyncedFor.current = userId;
          refreshSharedIds();
        }
      } catch (error) {
        console.warn('[sync] initial sync failed:', error);
      } finally {
        syncingRef.current = false;
      }
    })();

    return () => { cancelled = true; };
  }, [userId]);

  // ── Push local changes to the cloud (debounced) ──
  useEffect(() => {
    if (!isSupabaseConfigured || !userId) return;
    if (syncingRef.current || initialSyncedFor.current !== userId) return;
    // Skip if the current state already matches the cloud (e.g. a realtime echo).
    if (syncSnapshot(categories, tasks) === lastSyncedSnapshot.current) return;

    const handle = setTimeout(() => {
      pushReconcile(userId, categories, tasks)
        .then(() => markSynced(categories, tasks))
        .catch(error => console.warn('[sync] push failed:', error));
    }, 800);
    return () => clearTimeout(handle);
  }, [tasks, categories, userId, markSynced]);

  // ── Flush local changes when the connection returns ──
  useEffect(() => {
    if (!isSupabaseConfigured || !userId) return;
    const onOnline = () => {
      if (initialSyncedFor.current !== userId) return;
      if (syncSnapshot(categoriesRef.current, tasksRef.current) === lastSyncedSnapshot.current) return;
      pushReconcile(userId, categoriesRef.current, tasksRef.current)
        .then(() => markSynced(categoriesRef.current, tasksRef.current))
        .catch(error => console.warn('[sync] reconnect push failed:', error));
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [userId, markSynced]);

  // Pull the cloud set and apply it (used by realtime and after redeeming a link).
  const refreshFromCloud = useCallback(async () => {
    if (!isSupabaseConfigured || !userId) return;
    try {
      const cloud = await pullAll();
      if (!cloud) return;
      const cats = cloud.categories.length ? cloud.categories : DEFAULT_CATEGORIES;
      // Set the snapshot first so the push effect treats this as in-sync.
      markSynced(cats, cloud.tasks);
      setCategories(cats);
      setTasks(cloud.tasks);
      refreshSharedIds();
    } catch (error) {
      console.warn('[sync] refresh failed:', error);
    }
  }, [userId, markSynced, refreshSharedIds]);

  // ── Realtime: apply remote changes live (no reload) ──
  useEffect(() => {
    if (!isSupabaseConfigured || !userId || !supabase) return;
    const sb = supabase;

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        if (initialSyncedFor.current === userId) refreshFromCloud();
      }, 300);
    };

    const channel = sb
      .channel(`cuetasks-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, scheduleRefresh)
      .subscribe();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      sb.removeChannel(channel);
    };
  }, [userId]);

  const addTask = (title: string, dateTime: string, reminder?: TaskReminder, categoryId?: string, recurrence?: RecurrencePattern) => {
    const seriesId = recurrence ? newId() : undefined;
    const newTask: Task = {
      id: newId(),
      title,
      dateTime: dateTime || '',
      completed: false,
      createdAt: new Date().toISOString(),
      starred: false,
      order: tasks.length,
      reminder,
      categoryId,
      recurrence,
      seriesId
    };

    setTasks(prevTasks => sortTasks([...prevTasks, newTask]));

    if (newTask.dateTime && newTask.reminder && newTask.reminder.enabled) {
      scheduleNotification(newTask);
    }
  };

  const toggleTaskStatus = (id: string) => {
    setTasks(prevTasks => {
      const taskToToggle = prevTasks.find(t => t.id === id);
      if (!taskToToggle) return prevTasks;

      const updatedTasks = prevTasks.map(task => {
        if (task.id === id) {
          const updatedTask = {
            ...task,
            completed: !task.completed,
            completedAt: !task.completed ? new Date().toISOString() : undefined
          };

          // Cancel reminder if completing
          if (updatedTask.completed && updatedTask.reminder?.enabled && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
              type: 'CANCEL_REMINDER',
              data: { taskId: id }
            });
          }
          return updatedTask;
        }
        return task;
      });

      // If completing a recurring task, create next occurrence
      if (!taskToToggle.completed && taskToToggle.recurrence && !isRecurrenceEnded(taskToToggle.recurrence)) {
        const currentDate = new Date(taskToToggle.dateTime || new Date());
        const nextDate = getNextOccurrenceDate(currentDate, taskToToggle.recurrence);

        if (nextDate) {
          const newOccurrence: Task = {
            id: newId(),
            title: taskToToggle.title,
            dateTime: nextDate.toISOString().slice(0, 16), // Format as datetime-local
            completed: false,
            createdAt: new Date().toISOString(),
            starred: taskToToggle.starred,
            order: prevTasks.length,
            reminder: taskToToggle.reminder,
            categoryId: taskToToggle.categoryId,
            recurrence: {
              ...taskToToggle.recurrence,
              occurrenceCount: (taskToToggle.recurrence.occurrenceCount || 0) + 1
            },
            seriesId: taskToToggle.seriesId || taskToToggle.id // Link to series
          };

          updatedTasks.push(newOccurrence);

          // Schedule notification for new occurrence if needed
          if (newOccurrence.reminder?.enabled) {
            scheduleNotification(newOccurrence);
          }
        }
      }

      return sortTasks(updatedTasks);
    });
  };

  const deleteTask = (id: string) => {
    const taskToDelete = tasks.find(task => task.id === id);
    if (taskToDelete?.reminder?.enabled && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CANCEL_REMINDER',
        data: { taskId: id }
      });
    }
    setTasks(prevTasks => prevTasks.filter(task => task.id !== id));
  };

  const getTasksForDate = (date: string): Task[] => {
    const viewingToday = date === getToday();

    const filteredTasks = tasks.filter(task => {
      if (!task.dateTime || task.dateTime === '') {
        // "No date" tasks are backlog — surface them on today only, never on
        // past or future days (so completed ones don't linger into tomorrow).
        return viewingToday;
      }
      let sameDay = false;
      try {
        sameDay = isSameDay(task.dateTime, date);
      } catch {
        return viewingToday;
      }
      if (sameDay) return true;

      // Roll unfinished overdue tasks forward onto today so they stay visible
      // instead of being stranded on the day they were due. Completed tasks
      // never roll forward (isOverdue is false once completed).
      if (viewingToday && isOverdue(task.dateTime, task.completed)) return true;

      return false;
    });
    return sortTasks(filteredTasks);
  };

  const toggleTaskStar = (id: string) => {
    setTasks(prevTasks => {
      const updatedTasks = prevTasks.map(task =>
        task.id === id ? { ...task, starred: !task.starred } : task
      );
      return sortTasks(updatedTasks);
    });
  };

  const moveTaskUp = (id: string) => {
    setTasks(prevTasks => {
      const taskIndex = prevTasks.findIndex(task => task.id === id);
      if (taskIndex > 0) {
        const newTasks = [...prevTasks];
        [newTasks[taskIndex], newTasks[taskIndex - 1]] = [newTasks[taskIndex - 1], newTasks[taskIndex]];
        newTasks.forEach((task, index) => {
          task.order = index;
        });
        return sortTasks(newTasks);
      }
      return prevTasks;
    });
  };

  const moveTaskDown = (id: string) => {
    setTasks(prevTasks => {
      const taskIndex = prevTasks.findIndex(task => task.id === id);
      if (taskIndex < prevTasks.length - 1) {
        const newTasks = [...prevTasks];
        [newTasks[taskIndex], newTasks[taskIndex + 1]] = [newTasks[taskIndex + 1], newTasks[taskIndex]];
        newTasks.forEach((task, index) => {
          task.order = index;
        });
        return sortTasks(newTasks);
      }
      return prevTasks;
    });
  };

  const editTaskTitle = (id: string, newTitle: string) => {
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === id ? { ...task, title: newTitle } : task
      )
    );
  };

  const editTask = (id: string, updates: Partial<Pick<Task, 'title' | 'dateTime' | 'reminder' | 'categoryId'>>) => {
    // A new due time (or reminder change) must clear the "already fired" flags,
    // otherwise an alert that fired for the old time blocks the new one forever.
    if (updates.dateTime !== undefined || updates.reminder !== undefined) {
      resetFiredReminder(id);
    }

    setTasks(prevTasks => {
      const updatedTasks = prevTasks.map(task => {
        if (task.id === id) {
          const updatedTask = { ...task, ...updates };
          // Re-schedule off the merged task, so changing only the time (or only
          // the reminder) still re-arms the service-worker notification.
          if (updatedTask.dateTime && updatedTask.reminder?.enabled) {
            scheduleNotification(updatedTask);
          }
          return updatedTask;
        }
        return task;
      });
      return sortTasks(updatedTasks);
    });
  };

  // Category management
  const addCategory = (name: string, color: string, icon: string) => {
    const newCategory: Category = {
      id: newId(),
      name,
      color,
      icon
    };
    setCategories(prev => [...prev, newCategory]);
  };

  const deleteCategory = (id: string) => {
    // Don't delete default categories
    if (DEFAULT_CATEGORIES.some(c => c.id === id)) return;

    setCategories(prev => prev.filter(c => c.id !== id));
    // Remove category from tasks that have it
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.categoryId === id ? { ...task, categoryId: undefined } : task
      )
    );
  };

  const getCategoryById = (id: string): Category | undefined => {
    return categories.find(c => c.id === id);
  };

  const scheduleNotification = (task: Task) => {
    if (!task.dateTime || task.dateTime === '') return;
    if (typeof window !== 'undefined' &&
      (window.location.hostname.includes('webcontainer') ||
        window.location.hostname.includes('stackblitz'))) {
      console.warn('Notifications not supported in WebContainer environment');
      return;
    }
    try {
      const taskDate = new Date(task.dateTime);
      const now = new Date();
      if (taskDate <= now) return;
      if (!task.reminder?.enabled) return;

      const minutesBefore = task.reminder.minutesBefore || 15;
      const reminderTime = taskDate.getTime() - (minutesBefore * 60 * 1000);

      if (reminderTime <= now.getTime()) return;

      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SCHEDULE_REMINDER',
          data: {
            taskId: task.id,
            taskTitle: task.title,
            reminderTime: reminderTime,
            dueTime: taskDate.getTime(),
            minutesBefore: minutesBefore
          }
        });
      }
    } catch (error) {
      console.warn('Failed to schedule notification:', error);
    }
  };

  const value: TaskContextType = {
    tasks,
    categories,
    addTask,
    toggleTaskStatus,
    deleteTask,
    getTasksForDate,
    toggleTaskStar,
    moveTaskUp,
    moveTaskDown,
    editTaskTitle,
    editTask,
    addCategory,
    deleteCategory,
    getCategoryById,
    refreshFromCloud,
    sharedCategoryIds,
    sharedTaskIds,
  };

  return (
    <TaskContext.Provider value={value}>
      {children}
    </TaskContext.Provider>
  );
};
