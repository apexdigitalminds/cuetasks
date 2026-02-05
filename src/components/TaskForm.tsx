import React, { useState } from 'react';
import { Plus, Calendar, Mic, Clock, Bell, Globe } from 'lucide-react';
import { useTaskContext } from '../contexts/TaskContext';
import { speechRecognition, parseSpeechToTask } from '../utils/speechRecognition';
import { getLocalDateTimeString, getUserTimezone } from '../utils/dateUtils';

const TaskForm: React.FC = () => {
  const [title, setTitle] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [requireDateTime, setRequireDateTime] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState(15);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState('');
  const [userTimezone] = useState(getUserTimezone());
  const { addTask } = useTaskContext();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      setError('Task title is required');
      return;
    }
    
    if (requireDateTime && !dateTime) {
      setError('Date and time are required');
      return;
    }
    
    // If date/time is not required and not provided, use current time
    const taskDateTime = requireDateTime && dateTime ? dateTime : '';
    
    const reminder = reminderEnabled && requireDateTime && dateTime && taskDateTime ? {
      enabled: true,
      minutesBefore: reminderMinutes
    } : undefined;
    
    addTask(title.trim(), taskDateTime, reminder);
    setTitle('');
    setDateTime('');
    setReminderEnabled(false);
    setReminderMinutes(15);
    setError('');
  };

  const handleVoiceInput = () => {
    if (!speechRecognition.isSupported()) {
      setError('Speech recognition is not supported in your browser');
      return;
    }

    const isNowRecording = speechRecognition.toggleListening((transcript) => {
      setIsRecording(false);
      
      const { title: parsedTitle, dateTime: parsedDateTime } = parseSpeechToTask(transcript);
      
      if (parsedTitle) {
        setTitle(parsedTitle);
      }
      
      if (parsedDateTime) {
        setDateTime(parsedDateTime);
      }
    });
    
    setIsRecording(isNowRecording);
  };

  const currentDateTime = getLocalDateTimeString();

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5 mb-6">
      <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Add New Task</h2>
      
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
            <Clock size={16} className="mr-2 text-gray-500 dark:text-gray-400" />
            Require Date & Time
          </label>
          <button
            type="button"
            onClick={() => setRequireDateTime(!requireDateTime)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
              requireDateTime ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'
            }`}
            aria-label="Toggle date/time requirement"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                requireDateTime ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {requireDateTime 
            ? 'Date and time must be specified to save tasks' 
            : 'Tasks can be saved without specifying date and time'}
        </p>
      </div>
      
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-md mb-4 text-sm">
          {error}
        </div>
      )}
      
      <div className="mb-4">
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Task
        </label>
        <div className="relative">
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 
                      rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400
                      focus:border-indigo-500 dark:text-gray-200"
          />
          <button
            type="button"
            onClick={handleVoiceInput}
            className={`absolute right-2 top-2 p-1 rounded-full transition-all 
                       ${isRecording 
                         ? 'bg-red-500 text-white animate-pulse' 
                         : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/30'}`}
            aria-label={isRecording ? 'Recording in progress' : 'Record voice input'}
          >
            <Mic size={18} />
          </button>
        </div>
        {isRecording && (
          <p className="mt-1 text-sm text-indigo-600 dark:text-indigo-400 animate-pulse">
            Listening for your task...
          </p>
        )}
      </div>
      
      <div className="mb-5">
        <label htmlFor="dateTime" className={`block text-sm font-medium mb-1 ${
          requireDateTime 
            ? 'text-gray-700 dark:text-gray-300' 
            : 'text-gray-500 dark:text-gray-400'
        }`}>
          Date & Time {!requireDateTime && '(Optional)'}
        </label>
        <div className="relative">
          <Calendar size={18} className="absolute left-3 top-[50%] transform -translate-y-[50%] text-gray-400" />
          <input
            type="datetime-local"
            id="dateTime"
            value={dateTime}
            min={currentDateTime}
            onChange={(e) => setDateTime(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:text-gray-200 ${
              requireDateTime 
                ? 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600' 
                : 'bg-gray-100 dark:bg-gray-600 border-gray-200 dark:border-gray-500'
            }`}
            disabled={!requireDateTime}
          />
        </div>
      </div>
      
      {requireDateTime && (
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
              <Bell size={16} className="mr-2 text-gray-500 dark:text-gray-400" />
              Set Reminder
            </label>
            <button
              type="button"
              onClick={() => setReminderEnabled(!reminderEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                reminderEnabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'
              }`}
              aria-label="Toggle reminder"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                  reminderEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Get notified before your task is due with vibration on mobile devices
          </p>
          {reminderEnabled && (
            <div className="mt-2">
              <label htmlFor="reminderMinutes" className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                Remind me before:
              </label>
              <select
                id="reminderMinutes"
                value={reminderMinutes}
                onChange={(e) => setReminderMinutes(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 
                          rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400
                          focus:border-indigo-500 dark:text-gray-200"
              >
                <option value={5}>5 minutes</option>
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={120}>2 hours</option>
                <option value={1440}>1 day</option>
              </select>
            </div>
          )}
        </div>
      )}
      
      <button
        type="submit"
        className="w-full bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 
                  text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 
                  flex items-center justify-center"
      >
        <Plus size={18} className="mr-2" />
        Add Task
      </button>
    </form>
  );
};

export default TaskForm;