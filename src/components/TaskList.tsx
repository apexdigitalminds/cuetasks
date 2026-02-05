import React, { useState } from 'react';
import TaskItem from './TaskItem';
import { Task } from '../types';
import { CheckCheck, ListTodo, Filter } from 'lucide-react';

interface TaskListProps {
  tasks: Task[];
  date: string;
}

type FilterType = 'all' | 'active' | 'completed' | 'priority';

const TaskList: React.FC<TaskListProps> = ({ tasks, date }) => {
  const [filter, setFilter] = useState<FilterType>('all');

  const filteredTasks = tasks.filter((task) => {
    if (filter === 'all') return true;
    if (filter === 'completed') return task.completed;
    if (filter === 'priority') return task.starred && !task.completed;
    return !task.completed; // active
  });

  const activeCount = tasks.filter(task => !task.completed).length;
  const completedCount = tasks.filter(task => task.completed).length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          Tasks for the Day
        </h2>
        
        <div className="relative inline-block">
            <div className="group relative">
              <button
            className="flex items-center text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 
                      dark:hover:bg-gray-600 px-3 py-1.5 rounded-md transition-colors duration-200"
            aria-label="Filter tasks"
              >
            <Filter size={16} className="mr-1.5 text-gray-500 dark:text-gray-400" />
            <span className="text-gray-700 dark:text-gray-300">
              {filter === 'all' ? 'All' : 
               filter === 'active' ? 'To Do' : 
               filter === 'completed' ? 'Completed' : 'Priority'}
            </span>
              </button>
          
              <div className="absolute right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 
                        dark:border-gray-700 rounded-md shadow-lg w-36 py-1 z-10 hidden 
                        group-hover:block">
                <button
              onClick={() => setFilter('all')}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 
                        hover:bg-gray-100 dark:hover:bg-gray-700"
                >
              All
                </button>
                <button
              onClick={() => setFilter('active')}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 
                        hover:bg-gray-100 dark:hover:bg-gray-700"
                >
              To Do
                </button>
                <button
              onClick={() => setFilter('completed')}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 
                        hover:bg-gray-100 dark:hover:bg-gray-700"
                >
              Completed
                </button>
                <button
              onClick={() => setFilter('priority')}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 
                        hover:bg-gray-100 dark:hover:bg-gray-700"
                >
              Priority
                </button>
              </div>
            </div>
          </div>
      </div>
      
      <div className="flex items-center space-x-4 mb-5">
        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
          <ListTodo size={16} className="mr-1.5 text-indigo-500 dark:text-indigo-400" />
          <span>{activeCount} to do</span>
        </div>
        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
          <CheckCheck size={16} className="mr-1.5 text-green-500 dark:text-green-400" />
          <span>{completedCount} completed</span>
        </div>
      </div>
      
      {filteredTasks.length > 0 ? (
        <div>
          {filteredTasks.map((task) => (
            <TaskItem key={task.id} task={task} />
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">
            {tasks.length === 0
              ? 'No tasks for this day yet. Add one to get started!'
              : `No ${filter === 'active' ? 'active' : 'completed'} tasks to show.`}
          </p>
        </div>
      )}
    </div>
  );
};

export default TaskList;