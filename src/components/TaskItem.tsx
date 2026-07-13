import React, { useState } from 'react';
import { Trash2, Check, Clock, Bell, Edit3, Save, X, ArrowUp, ArrowDown, Star, Calendar, Repeat, AlertTriangle, Share2 } from 'lucide-react';
import { Task } from '../types';
import { formatTimeOnlyWithTimezone, getLocalDateTimeString, isOverdue } from '../utils/dateUtils';
import { useTaskContext } from '../contexts/TaskContext';
import { useAuth } from '../contexts/AuthContext';
import ShareModal from './ShareModal';

interface TaskItemProps {
  task: Task;
}

const TaskItem: React.FC<TaskItemProps> = ({ task }) => {
  const { toggleTaskStatus, deleteTask, editTask, toggleTaskStar, moveTaskUp, moveTaskDown, categories, getCategoryById } = useTaskContext();
  const { user, configured } = useAuth();
  const canShare = !!(configured && user && (!task.ownerId || task.ownerId === user.id));
  const [showShare, setShowShare] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(task.title);
  const [editedDateTime, setEditedDateTime] = useState('');
  const [editedReminderEnabled, setEditedReminderEnabled] = useState(false);
  const [editedReminderMinutes, setEditedReminderMinutes] = useState(15);
  const [editedCategoryId, setEditedCategoryId] = useState(task.categoryId || '');

  const category = task.categoryId ? getCategoryById(task.categoryId) : undefined;
  const overdue = isOverdue(task.dateTime, task.completed);

  // Left spine: category colour for active tasks, green once completed (a functional
  // "done" signal). Overdue is signalled by the badge + border, never the spine.
  const spineColor = task.completed ? '#22c55e' : category?.color;

  const handleToggleStatus = () => {
    toggleTaskStatus(task.id);
  };

  const handleDelete = () => {
    setIsDeleting(true);
    setTimeout(() => {
      deleteTask(task.id);
    }, 300);
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditedTitle(task.title);
    if (task.dateTime) {
      const date = new Date(task.dateTime);
      const localDateTime = getLocalDateTimeString(date);
      setEditedDateTime(localDateTime);
    } else {
      setEditedDateTime('');
    }
    setEditedReminderEnabled(task.reminder?.enabled || false);
    setEditedReminderMinutes(task.reminder?.minutesBefore || 15);
    setEditedCategoryId(task.categoryId || '');
  };

  const handleSaveEdit = () => {
    if (editedTitle.trim()) {
      const updates: Partial<Pick<Task, 'title' | 'dateTime' | 'reminder' | 'categoryId'>> = {};

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

      if (editedCategoryId !== task.categoryId) {
        updates.categoryId = editedCategoryId || undefined;
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
    if (task.dateTime) {
      const date = new Date(task.dateTime);
      const localDateTime = getLocalDateTimeString(date);
      setEditedDateTime(localDateTime);
    }
    setEditedReminderEnabled(task.reminder?.enabled || false);
    setEditedReminderMinutes(task.reminder?.minutesBefore || 15);
    setEditedCategoryId(task.categoryId || '');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter' || e.key === 'Return') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  return (
    <div
      className={`group relative flex items-start p-4 mb-3 rounded-xl border transition-all duration-300 ${task.completed
        ? 'bg-gray-50/50 dark:bg-gray-800/30 border-gray-100 dark:border-gray-800'
        : overdue
          ? 'bg-white dark:bg-gray-800 border-red-200 dark:border-red-900/50 shadow-sm hover:shadow-md'
          : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md'
        } ${isDeleting ? 'opacity-0 scale-95 translate-x-4' : 'opacity-100 scale-100'}`}
      style={spineColor ? { borderLeftColor: spineColor, borderLeftWidth: '4px' } : undefined}
    >
      {/* Checkbox */}
      <button
        onClick={handleToggleStatus}
        className={`flex-shrink-0 h-6 w-6 rounded-full border-2 flex items-center justify-center mr-3 mt-0.5
                    transition-all duration-200 ${task.completed
            ? 'bg-gradient-to-br from-green-400 to-emerald-500 border-transparent shadow-sm'
            : 'border-gray-300 dark:border-gray-600 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
          }`}
        aria-label={task.completed ? "Mark as incomplete" : "Mark as complete"}
      >
        {task.completed && <Check size={14} className="text-white" strokeWidth={3} />}
      </button>

      {/* Content */}
      <div className="flex-grow min-w-0">
        {isEditing ? (
          <div className="space-y-3">
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onKeyDown={handleKeyPress}
              className="w-full px-3 py-2 text-sm border border-indigo-300 dark:border-indigo-500 
                        rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 
                        bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              autoFocus
              style={{ fontSize: '16px' }}
              placeholder="Task title"
            />

            <div className="relative">
              <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="datetime-local"
                value={editedDateTime}
                onChange={(e) => setEditedDateTime(e.target.value)}
                className="w-full pl-10 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 
                          rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 
                          bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                style={{ fontSize: '16px' }}
              />
            </div>

            {/* Category selector in edit mode */}
            <div className="flex flex-wrap gap-1.5">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setEditedCategoryId(editedCategoryId === cat.id ? '' : cat.id)}
                  className={`px-2 py-1 text-xs rounded-md transition-all ${editedCategoryId === cat.id
                    ? 'ring-1 ring-offset-1'
                    : 'opacity-60 hover:opacity-100'
                    }`}
                  style={{
                    backgroundColor: editedCategoryId === cat.id ? cat.color : `${cat.color}20`,
                    color: editedCategoryId === cat.id ? 'white' : cat.color
                  }}
                >
                  {cat.icon} {cat.name}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Bell size={14} className="mr-2 text-gray-400" />
                  Reminder
                </label>
                <button
                  type="button"
                  onClick={() => setEditedReminderEnabled(!editedReminderEnabled)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${editedReminderEnabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'
                    }`}
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-200 ${editedReminderEnabled ? 'translate-x-5' : 'translate-x-1'
                      }`}
                  />
                </button>
              </div>

              {editedReminderEnabled && (
                <select
                  value={editedReminderMinutes}
                  onChange={(e) => setEditedReminderMinutes(Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 
                            rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-gray-200"
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

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={handleSaveEdit}
                className="flex items-center px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 
                          text-white rounded-lg transition-colors"
              >
                <Save size={14} className="mr-1" />
                Save
              </button>
              <button
                onClick={handleCancelEdit}
                className="flex items-center px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 
                          hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 
                          rounded-lg transition-colors"
              >
                <X size={14} className="mr-1" />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <h3 className={`font-medium text-gray-900 dark:text-gray-100 transition-all duration-200 ${task.completed ? 'line-through text-gray-400 dark:text-gray-500' : ''
              }`}>
              {task.title}
            </h3>

            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {/* Category Badge */}
              {category && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full"
                  style={{
                    backgroundColor: `${category.color}15`,
                    color: category.color
                  }}
                >
                  {category.icon} {category.name}
                </span>
              )}

              {/* Time */}
              {task.dateTime && (
                <span className={`flex items-center text-xs ${overdue ? 'text-red-500 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                  <Clock size={12} className="mr-1" />
                  {formatTimeOnlyWithTimezone(task.dateTime)}
                </span>
              )}

              {/* Overdue badge */}
              {overdue && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                  <AlertTriangle size={11} />
                  Overdue
                </span>
              )}

              {/* Reminder indicator */}
              {task.reminder?.enabled && (
                <span className="flex items-center text-xs text-indigo-500 dark:text-indigo-400">
                  <Bell size={11} className="mr-1" />
                  {task.reminder.minutesBefore}min
                </span>
              )}

              {/* Recurring indicator */}
              {task.recurrence && (
                <span className="flex items-center text-xs text-emerald-500 dark:text-emerald-400" title="Repeating task">
                  <Repeat size={11} className="mr-1" />
                  {task.recurrence.type === 'daily' && (task.recurrence.interval === 1 ? 'Daily' : `Every ${task.recurrence.interval} days`)}
                  {task.recurrence.type === 'weekly' && (task.recurrence.interval === 1 ? 'Weekly' : `Every ${task.recurrence.interval} weeks`)}
                  {task.recurrence.type === 'monthly' && (task.recurrence.interval === 1 ? 'Monthly' : `Every ${task.recurrence.interval} months`)}
                  {task.recurrence.type === 'custom' && `Every ${task.recurrence.interval} days`}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      {!isEditing && (
        <div className="flex-shrink-0 flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Star */}
          <button
            onClick={() => toggleTaskStar(task.id)}
            className={`p-1.5 rounded-lg transition-all ${task.starred
              ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20'
              : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'
              }`}
            aria-label={task.starred ? "Remove star" : "Add star"}
          >
            <Star size={14} fill={task.starred ? "currentColor" : "none"} />
          </button>

          {!task.completed && (
            <>
              <button
                onClick={() => moveTaskUp(task.id)}
                className="p-1.5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all"
                aria-label="Move up"
              >
                <ArrowUp size={14} />
              </button>
              <button
                onClick={() => moveTaskDown(task.id)}
                className="p-1.5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all"
                aria-label="Move down"
              >
                <ArrowDown size={14} />
              </button>
            </>
          )}

          {canShare && (
            <button
              onClick={() => setShowShare(true)}
              className="p-1.5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all"
              aria-label="Share task"
            >
              <Share2 size={14} />
            </button>
          )}

          <button
            onClick={handleEdit}
            className="p-1.5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all"
            aria-label="Edit task"
          >
            <Edit3 size={14} />
          </button>

          <button
            onClick={handleDelete}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
            aria-label="Delete task"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}

      {/* Starred indicator - always visible when starred */}
      {task.starred && !isEditing && (
        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center shadow-sm">
          <Star size={10} className="text-white" fill="white" />
        </div>
      )}

      <ShareModal
        isOpen={showShare}
        onClose={() => setShowShare(false)}
        resourceType="task"
        resourceId={task.id}
        resourceName={task.title}
      />
    </div>
  );
};

export default TaskItem;