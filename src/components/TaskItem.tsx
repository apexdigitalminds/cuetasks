import React, { useState } from 'react';
import { Trash2, Check, Clock, Bell, Edit3, Save, X, ArrowUp, ArrowDown, Star, Calendar } from 'lucide-react';
import { Task } from '../types';
import { formatTimeOnlyWithTimezone, getLocalDateTimeString } from '../utils/dateUtils';
import { useTaskContext } from '../contexts/TaskContext';

interface TaskItemProps {
  task: Task;
}

const TaskItem: React.FC<TaskItemProps> = ({ task }) => {
  const { toggleTaskStatus, deleteTask, editTask, toggleTaskStar, moveTaskUp, moveTaskDown } = useTaskContext();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(task.title);
  const [editedDateTime, setEditedDateTime] = useState('');
  const [editedReminderEnabled, setEditedReminderEnabled] = useState(false);
  const [editedReminderMinutes, setEditedReminderMinutes] = useState(15);

  const handleToggleStatus = () => {
    toggleTaskStatus(task.id);
  };

  const handleDelete = () => {
    setIsDeleting(true);
    // Add a slight delay for the animation
    setTimeout(() => {
      deleteTask(task.id);
    }, 300);
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditedTitle(task.title);
    // Convert ISO string to local datetime-local format
    const date = new Date(task.dateTime);
    const localDateTime = getLocalDateTimeString(date);
    setEditedDateTime(localDateTime);
    setEditedReminderEnabled(task.reminder?.enabled || false);
    setEditedReminderMinutes(task.reminder?.minutesBefore || 15);
  };

  const handleSaveEdit = () => {
    if (editedTitle.trim()) {
      const updates: Partial<Pick<Task, 'title' | 'dateTime' | 'reminder'>> = {};
      
      if (editedTitle.trim() !== task.title) {
        updates.title = editedTitle.trim();
      }
      
      if (editedDateTime) {
        const newDateTime = new Date(editedDateTime).toISOString();
        if (newDateTime !== task.dateTime) {
          updates.dateTime = newDateTime;
        }
      }
      
      const currentReminderEnabled = task.reminder?.enabled || false;
      const currentReminderMinutes = task.reminder?.minutesBefore || 15;
      
      if (editedReminderEnabled !== currentReminderEnabled || 
          editedReminderMinutes !== currentReminderMinutes) {
        updates.reminder = editedReminderEnabled ? {
          enabled: true,
          minutesBefore: editedReminderMinutes
        } : {
          enabled: false,
          minutesBefore: editedReminderMinutes
        };
      }
      
      if (Object.keys(updates).length > 0) {
        editTask(task.id, updates);
      }
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedTitle(task.title);
    const date = new Date(task.dateTime);
    const localDateTime = getLocalDateTimeString(date);
    setEditedDateTime(localDateTime);
    setEditedReminderEnabled(task.reminder?.enabled || false);
    setEditedReminderMinutes(task.reminder?.minutesBefore || 15);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter' || e.key === 'Return') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleMoveToTop = () => {
    moveTaskUp(task.id);
  };

  const handleMoveDown = () => {
    moveTaskDown(task.id);
  };

  const handleToggleStar = () => {
    toggleTaskStar(task.id);
  };

  return (
    <div 
      className={`group relative flex items-center p-4 mb-3 rounded-lg border border-gray-200 dark:border-gray-700 
                  shadow-sm transition-all duration-300 ${
                    task.completed ? 'bg-gray-50 dark:bg-gray-800/50' : 'bg-white dark:bg-gray-800'
                  } ${isDeleting ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
    >
      <button
        onClick={handleToggleStatus}
        className={`flex-shrink-0 h-6 w-6 rounded-full border-2 flex items-center justify-center mr-3 
                    transition-all duration-200 ${
                      task.completed
                        ? 'bg-green-500 dark:bg-green-600 border-green-500 dark:border-green-600'
                        : 'border-gray-300 dark:border-gray-600 hover:border-indigo-500 dark:hover:border-indigo-400'
                    }`}
        aria-label={task.completed ? "Mark as incomplete" : "Mark as complete"}
      >
        {task.completed && <Check size={16} className="text-white" />}
      </button>
      
      <div className="flex-grow">
        {isEditing ? (
          <div className="space-y-3">
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onKeyDown={handleKeyPress}
              className="w-full px-3 py-2 text-sm border border-indigo-300 dark:border-indigo-500 
                        rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 
                        bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              autoFocus
              style={{ fontSize: '16px' }} // Prevents zoom on iOS
              placeholder="Task title"
            />
            
            <div className="relative">
              <Calendar size={16} className="absolute left-3 top-[50%] transform -translate-y-[50%] text-gray-400" />
              <input
                type="datetime-local"
                value={editedDateTime}
                onChange={(e) => setEditedDateTime(e.target.value)}
                className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 
                          rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 
                          bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                style={{ fontSize: '16px' }} // Prevents zoom on iOS
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Bell size={14} className="mr-2 text-gray-500 dark:text-gray-400" />
                  Reminder
                </label>
                <button
                  type="button"
                  onClick={() => setEditedReminderEnabled(!editedReminderEnabled)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                    editedReminderEnabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'
                  }`}
                  aria-label="Toggle reminder"
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-200 ${
                      editedReminderEnabled ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              
              {editedReminderEnabled && (
                <select
                  value={editedReminderMinutes}
                  onChange={(e) => setEditedReminderMinutes(Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 
                            rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400
                            focus:border-indigo-500 dark:text-gray-200"
                >
                  <option value={5}>5 minutes before</option>
                  <option value={10}>10 minutes before</option>
                  <option value={15}>15 minutes before</option>
                  <option value={30}>30 minutes before</option>
                  <option value={60}>1 hour before</option>
                  <option value={120}>2 hours before</option>
                  <option value={1440}>1 day before</option>
                </select>
              )}
            </div>
            
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={handleSaveEdit}
                className="flex items-center px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 
                          text-white rounded-md transition-colors duration-200 touch-manipulation"
                aria-label="Save changes"
              >
                <Save size={14} className="mr-1" />
                Save
              </button>
              <button
                onClick={handleCancelEdit}
                className="flex items-center px-3 py-1.5 text-sm bg-gray-500 hover:bg-gray-600 
                          text-white rounded-md transition-colors duration-200 touch-manipulation"
                aria-label="Cancel editing"
              >
                <X size={14} className="mr-1" />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <h3 className={`font-medium text-gray-900 dark:text-gray-100 transition-all duration-200 ${
            task.completed ? 'line-through text-gray-500 dark:text-gray-400' : ''
          }`}>
            {task.title}
          </h3>
        )}
        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-1">
          <Clock size={14} className="mr-1" />
          <span>{formatTimeOnlyWithTimezone(task.dateTime)}</span>
          {task.reminder?.enabled && (
            <div className="flex items-center ml-3">
              <Bell size={12} className="mr-1 text-indigo-500 dark:text-indigo-400" />
              <span className="text-xs">{task.reminder.minutesBefore}min before</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex-shrink-0 mr-3">
        <button
          onClick={handleToggleStar}
          className={`flex items-center justify-center w-6 h-6 rounded-full transition-all duration-200 ${
            task.starred
              ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 hover:text-yellow-500 dark:hover:text-yellow-400'
          }`}
          aria-label={task.starred ? "Remove star" : "Add star"}
          title={task.starred ? "Remove star" : "Add star"}
        >
          <Star size={12} fill={task.starred ? "currentColor" : "none"} />
        </button>
      </div>
      
      <div className="flex items-center space-x-1">
        {!task.completed && !isEditing && (
          <>
            <button
              onClick={handleMoveToTop}
              className="text-gray-400 hover:text-indigo-500 dark:text-gray-500 dark:hover:text-indigo-400 
                        transition-colors duration-200 p-2 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-900/20 touch-manipulation"
              aria-label="Move up one position"
              title="Move up one position"
            >
              <ArrowUp size={16} />
            </button>
            <button
              onClick={handleMoveDown}
              className="text-gray-400 hover:text-indigo-500 dark:text-gray-500 dark:hover:text-indigo-400 
                        transition-colors duration-200 p-2 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-900/20 touch-manipulation"
              aria-label="Move down one position"
              title="Move down one position"
            >
              <ArrowDown size={16} />
            </button>
          </>
        )}
        {!isEditing && (
          <button
            onClick={handleEdit}
            className="text-gray-400 hover:text-indigo-500 dark:text-gray-500 dark:hover:text-indigo-400 
                      transition-colors duration-200 p-2 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-900/20 touch-manipulation"
            aria-label="Edit task"
          >
            <Edit3 size={16} />
          </button>
        )}
        <button
          onClick={handleDelete}
          className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 
                    transition-colors duration-200 p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 touch-manipulation"
          aria-label="Delete task"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
};

export default TaskItem;