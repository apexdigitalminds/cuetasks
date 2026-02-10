export interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string;
}

export interface TaskReminder {
  enabled: boolean;
  minutesBefore: number;
}

export interface RecurrencePattern {
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  interval: number;                  // Every X days/weeks/months
  daysOfWeek?: number[];             // 0=Sun, 1=Mon, etc. for weekly
  dayOfMonth?: number;               // 1-31 for monthly
  weekOfMonth?: number;              // 1-5 for "2nd Tuesday" type
  endDate?: string;                  // Optional: end by date
  endAfterOccurrences?: number;      // Optional: end after X occurrences
  occurrenceCount?: number;          // Track completed count
}

export interface Task {
  id: string;
  title: string;
  dateTime: string;
  completed: boolean;
  createdAt: string;
  completedAt?: string;
  starred: boolean;
  order: number;
  reminder?: TaskReminder;
  categoryId?: string;
  recurrence?: RecurrencePattern;
  seriesId?: string;                 // Links all occurrences in a series
}

export type TaskContextType = {
  tasks: Task[];
  categories: Category[];
  addTask: (title: string, dateTime: string, reminder?: TaskReminder, categoryId?: string, recurrence?: RecurrencePattern) => void;
  toggleTaskStatus: (id: string) => void;
  deleteTask: (id: string) => void;
  toggleTaskStar: (id: string) => void;
  moveTaskUp: (id: string) => void;
  moveTaskDown: (id: string) => void;
  getTasksForDate: (date: string) => Task[];
  editTaskTitle: (id: string, title: string) => void;
  editTask: (id: string, updates: Partial<Pick<Task, 'title' | 'dateTime' | 'reminder' | 'categoryId'>>) => void;
  addCategory: (name: string, color: string, icon: string) => void;
  deleteCategory: (id: string) => void;
  getCategoryById: (id: string) => Category | undefined;
};

// Default categories
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'work', name: 'Work', color: '#6366f1', icon: '💼' },
  { id: 'personal', name: 'Personal', color: '#10b981', icon: '🏠' },
  { id: 'shopping', name: 'Shopping', color: '#f59e0b', icon: '🛒' },
  { id: 'ideas', name: 'Ideas', color: '#8b5cf6', icon: '💡' },
];