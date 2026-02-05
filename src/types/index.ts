export interface TaskReminder {
  enabled: boolean;
  minutesBefore: number;
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
}

export type TaskContextType = {
  tasks: Task[];
  addTask: (title: string, dateTime: string, reminder?: TaskReminder) => void;
  toggleTaskStatus: (id: string) => void;
  deleteTask: (id: string) => void;
  toggleTaskStar: (id: string) => void;
  moveTaskUp: (id: string) => void;
  moveTaskDown: (id: string) => void;
  getTasksForDate: (date: string) => Task[];
  editTaskTitle: (id: string, title: string) => void;
  editTask: (id: string, updates: Partial<Pick<Task, 'title' | 'dateTime' | 'reminder'>>) => void;
};