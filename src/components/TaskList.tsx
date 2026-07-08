import React, { useState } from 'react';
import TaskItem from './TaskItem';
import { Task } from '../types';
import { CheckCheck, ListTodo, Filter, AlertTriangle } from 'lucide-react';
import { useTaskContext } from '../contexts/TaskContext';
import { isOverdue } from '../utils/dateUtils';

interface TaskListProps {
  tasks: Task[];
}

type FilterType = 'all' | 'active' | 'completed' | 'priority';

const TaskList: React.FC<TaskListProps> = ({ tasks }) => {
  const [filter, setFilter] = useState<FilterType>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const { categories } = useTaskContext();

  const filteredTasks = tasks.filter((task) => {
    // Status filter
    const statusMatch =
      filter === 'all' ? true :
        filter === 'completed' ? task.completed :
          filter === 'priority' ? task.starred && !task.completed :
            !task.completed;

    // Category filter
    const categoryMatch = !categoryFilter || task.categoryId === categoryFilter;

    return statusMatch && categoryMatch;
  });

  const activeCount = tasks.filter(task => !task.completed).length;
  const completedCount = tasks.filter(task => task.completed).length;
  const overdueCount = tasks.filter(task => isOverdue(task.dateTime, task.completed)).length;
  const completionRate = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Tasks
          </h2>

          {/* Status Filter Dropdown */}
          <div className="relative group">
            <button className="flex items-center gap-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 
                              dark:hover:bg-gray-600 px-3 py-1.5 rounded-lg transition-colors">
              <Filter size={14} className="text-gray-500 dark:text-gray-400" />
              <span className="text-gray-700 dark:text-gray-300">
                {filter === 'all' ? 'All' :
                  filter === 'active' ? 'To Do' :
                    filter === 'completed' ? 'Done' : 'Priority'}
              </span>
            </button>

            <div className="absolute right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 
                          dark:border-gray-700 rounded-xl shadow-xl w-36 py-1 z-10 hidden group-hover:block">
              {['all', 'active', 'completed', 'priority'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f as FilterType)}
                  className={`block w-full text-left px-4 py-2 text-sm transition-colors
                            ${filter === f
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                >
                  {f === 'all' ? 'All' : f === 'active' ? 'To Do' : f === 'completed' ? 'Done' : 'Priority'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-4">
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mr-2">
              <ListTodo size={14} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <span>{activeCount} to do</span>
          </div>
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <div className="w-6 h-6 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center mr-2">
              <CheckCheck size={14} className="text-green-600 dark:text-green-400" />
            </div>
            <span>{completedCount} done</span>
          </div>
          {overdueCount > 0 && (
            <div className="flex items-center text-sm text-red-600 dark:text-red-400">
              <div className="w-6 h-6 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center mr-2">
                <AlertTriangle size={14} className="text-red-600 dark:text-red-400" />
              </div>
              <span>{overdueCount} overdue</span>
            </div>
          )}
        </div>

        {/* Completion progress */}
        {tasks.length > 0 && (
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${completionRate}%` }}
              />
            </div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 tabular-nums">{completionRate}%</span>
          </div>
        )}

        {/* Category Filter Pills */}
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            onClick={() => setCategoryFilter('')}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${!categoryFilter
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
          >
            All
          </button>
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => setCategoryFilter(categoryFilter === category.id ? '' : category.id)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-all flex items-center gap-1 ${categoryFilter === category.id
                  ? 'ring-1 ring-offset-1'
                  : 'opacity-60 hover:opacity-100'
                }`}
              style={{
                backgroundColor: categoryFilter === category.id ? category.color : `${category.color}20`,
                color: categoryFilter === category.id ? 'white' : category.color
              }}
            >
              {category.icon} {category.name}
            </button>
          ))}
        </div>
      </div>

      {/* Task List */}
      <div className="p-4">
        {filteredTasks.length > 0 ? (
          <div className="space-y-0">
            {filteredTasks.map((task) => (
              <TaskItem key={task.id} task={task} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <ListTodo size={28} className="text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {tasks.length === 0
                ? 'No tasks for this day yet'
                : `No ${filter === 'active' ? 'active' : filter === 'completed' ? 'completed' : categoryFilter ? 'matching' : ''} tasks`}
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
              {tasks.length === 0 ? 'Add one to get started!' : 'Try a different filter'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskList;