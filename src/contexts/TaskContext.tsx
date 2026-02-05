import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Task, TaskReminder } from '../types';
import { isSameDay } from '../utils/dateUtils';

interface TaskContextType {
  tasks: Task[];
  addTask: (title: string, dateTime: string, reminder?: TaskReminder) => void;
  toggleTaskStatus: (id: string) => void;
  deleteTask: (id: string) => void;
  getTasksForDate: (date: string) => Task[];
  toggleTaskStar: (id: string) => void;
  moveTaskUp: (id: string) => void;
  moveTaskDown: (id: string) => void;
  editTaskTitle: (id: string, newTitle: string) => void;
  editTask: (id: string, updates: Partial<Pick<Task, 'title' | 'dateTime' | 'reminder'>>) => void;
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
  const [tasks, setTasks] = useState<Task[]>([]);

  const sortTasks = (tasksToSort: Task[]): Task[] => {
    return [...tasksToSort].sort((a, b) => {
      if (a.starred && !b.starred) return -1;
      if (!a.starred && b.starred) return 1;
      if (!a.completed && b.completed) return -1;
      if (a.completed && !b.completed) return 1;
      return a.order - b.order;
    });
  };

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

  useEffect(() => {
    try {
      const savedTasks = localStorage.getItem('tasks');
      if (savedTasks) {
        const parsedTasks = JSON.parse(savedTasks);
        if (Array.isArray(parsedTasks)) {
          setTasks(parsedTasks);
        }
      }
    } catch (error) {
      console.warn('Failed to load tasks from localStorage:', error);
      localStorage.removeItem('tasks');
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('tasks', JSON.stringify(tasks));
    } catch (error) {
      console.warn('Failed to save tasks to localStorage:', error);
    }
  }, [tasks]);

  const addTask = (title: string, dateTime: string, reminder?: TaskReminder) => {
    const newTask: Task = {
      id: Date.now().toString(),
      title,
      dateTime: dateTime || '',
      completed: false,
      createdAt: new Date().toISOString(),
      starred: false,
      order: tasks.length,
      reminder
    };

    setTasks(prevTasks => sortTasks([...prevTasks, newTask]));

    if (newTask.dateTime && newTask.reminder && newTask.reminder.enabled) {
      scheduleNotification(newTask);
    }
  };

  const toggleTaskStatus = (id: string) => {
    setTasks(prevTasks => {
      const updatedTasks = prevTasks.map(task => {
        if (task.id === id) {
          const updatedTask = { ...task, completed: !task.completed };
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

  const editTask = (id: string, updates: Partial<Pick<Task, 'title' | 'dateTime' | 'reminder'>>) => {
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
    addTask,
    toggleTaskStatus,
    deleteTask,
    getTasksForDate,
    toggleTaskStar,
    moveTaskUp,
    moveTaskDown,
    editTaskTitle,
    editTask,
  };

  return (
    <TaskContext.Provider value={value}>
      {children}
    </TaskContext.Provider>
  );
};
