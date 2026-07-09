import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { Task, TaskReminder, Category, DEFAULT_CATEGORIES, RecurrencePattern } from '../types';
import { isSameDay } from '../utils/dateUtils';
import { getNextOccurrenceDate, isRecurrenceEnded } from '../utils/recurrence';
import { useAuth } from './AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { pullAll, pushReconcile, migrateToUuids, newId } from '../lib/sync';

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

        if (cloud.categories.length === 0 && cloud.tasks.length === 0) {
          const migrated = migrateToUuids(categoriesRef.current, tasksRef.current);
          setCategories(migrated.categories);
          setTasks(migrated.tasks);
          await pushReconcile(userId, migrated.categories, migrated.tasks);
        } else {
          setCategories(cloud.categories.length ? cloud.categories : DEFAULT_CATEGORIES);
          setTasks(cloud.tasks);
        }
        if (!cancelled) initialSyncedFor.current = userId;
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

    const handle = setTimeout(() => {
      pushReconcile(userId, categoriesRef.current, tasksRef.current)
        .catch(error => console.warn('[sync] push failed:', error));
    }, 800);
    return () => clearTimeout(handle);
  }, [tasks, categories, userId]);

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
    const filteredTasks = tasks.filter(task => {
      if (!task.dateTime || task.dateTime === '') {
        return true;
      }
      try {
        return isSameDay(task.dateTime, date);
      } catch {
        return true;
      }
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
    setTasks(prevTasks => {
      const updatedTasks = prevTasks.map(task => {
        if (task.id === id) {
          const updatedTask = { ...task, ...updates };
          if (updates.dateTime && updates.reminder?.enabled) {
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
  };

  return (
    <TaskContext.Provider value={value}>
      {children}
    </TaskContext.Provider>
  );
};
