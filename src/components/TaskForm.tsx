import React, { useState } from 'react';
import { Plus, Calendar, Mic, Clock, Bell, ChevronDown, ChevronUp, Repeat } from 'lucide-react';
import { useTaskContext } from '../contexts/TaskContext';
import { speechRecognition, parseSpeechToTask } from '../utils/speechRecognition';
import { getLocalDateTimeString } from '../utils/dateUtils';
import { RecurrencePattern } from '../types';

const TaskForm: React.FC = () => {
  const [title, setTitle] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [requireDateTime, setRequireDateTime] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState(15);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showOptions, setShowOptions] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState('');

  // Recurrence state
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('daily');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceEndType, setRecurrenceEndType] = useState<'never' | 'date' | 'count'>('never');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [recurrenceEndCount, setRecurrenceEndCount] = useState(10);

  const { addTask, categories } = useTaskContext();
  const voiceSupported = speechRecognition.isSupported();

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

    const taskDateTime = requireDateTime && dateTime ? dateTime : '';

    const reminder = reminderEnabled && requireDateTime && dateTime && taskDateTime ? {
      enabled: true,
      minutesBefore: reminderMinutes
    } : undefined;

    // Build recurrence pattern if enabled
    let recurrence: RecurrencePattern | undefined;
    if (recurrenceEnabled && requireDateTime) {
      recurrence = {
        type: recurrenceType,
        interval: recurrenceInterval,
        ...(recurrenceEndType === 'date' && recurrenceEndDate ? { endDate: recurrenceEndDate } : {}),
        ...(recurrenceEndType === 'count' ? { endAfterOccurrences: recurrenceEndCount } : {}),
        occurrenceCount: 0
      };
    }

    addTask(title.trim(), taskDateTime, reminder, selectedCategory || undefined, recurrence);

    // Reset form
    setTitle('');
    setDateTime('');
    setReminderEnabled(false);
    setReminderMinutes(15);
    setSelectedCategory('');
    setRecurrenceEnabled(false);
    setRecurrenceType('daily');
    setRecurrenceInterval(1);
    setRecurrenceEndType('never');
    setRecurrenceEndDate('');
    setRecurrenceEndCount(10);
    setShowOptions(false);
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
        setRequireDateTime(true);
      }
    });

    setIsRecording(isNowRecording);
  };

  const currentDateTime = getLocalDateTimeString();

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-5 mb-6 animate-fade-in-up">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
        <span className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center mr-3">
          <Plus size={18} className="text-white" />
        </span>
        New Task
      </h2>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-xl mb-4 text-sm border border-red-100 dark:border-red-800">
          {error}
        </div>
      )}

      {/* Task Title Input - Always visible for fast-track */}
      <div className="mb-4">
        <div className="relative">
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 
                      rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400
                      focus:border-indigo-500 dark:text-gray-100 text-base placeholder:text-gray-400"
          />
          {voiceSupported && (
            <button
              type="button"
              onClick={handleVoiceInput}
              className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all
                         ${isRecording
                  ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30'
                  : 'bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:text-indigo-600'}`}
              aria-label={isRecording ? 'Recording in progress' : 'Record voice input'}
            >
              <Mic size={18} />
            </button>
          )}
        </div>
        {isRecording && (
          <p className="mt-2 text-sm text-indigo-600 dark:text-indigo-400 animate-pulse flex items-center">
            <span className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></span>
            Listening for your task...
          </p>
        )}
      </div>

      {/* Quick Category Pills - With clearer label and selection */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
          Category (tap to select)
        </label>
        <div className="flex flex-wrap gap-2">
          {categories.map(category => (
            <button
              key={category.id}
              type="button"
              onClick={() => setSelectedCategory(selectedCategory === category.id ? '' : category.id)}
              className={`px-3 py-2 text-xs font-medium rounded-xl transition-all duration-200 flex items-center gap-1.5
                border-2 cursor-pointer
                ${selectedCategory === category.id
                  ? 'shadow-lg scale-105'
                  : 'hover:scale-105 hover:shadow-md'}`}
              style={{
                backgroundColor: selectedCategory === category.id ? category.color : `${category.color}10`,
                color: selectedCategory === category.id ? 'white' : category.color,
                borderColor: selectedCategory === category.id ? category.color : `${category.color}40`
              }}
            >
              <span className="text-sm">{category.icon}</span>
              {category.name}
              {selectedCategory === category.id && (
                <span className="ml-1">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Expandable Options Toggle */}
      <button
        type="button"
        onClick={() => setShowOptions(!showOptions)}
        className="w-full mb-4 flex items-center justify-center gap-2 py-2 text-sm text-gray-500 dark:text-gray-400 
                   hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
      >
        {showOptions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        {showOptions ? 'Hide options' : 'More options (date, reminder, repeat)'}
      </button>

      {/* Expandable Options Section */}
      {showOptions && (
        <div className="space-y-4 mb-4 pb-4 border-b border-gray-100 dark:border-gray-700 animate-fade-in-up">
          {/* Date/Time Toggle */}
          <div>
            <div className="flex items-center justify-between">
              <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                <Clock size={16} className="mr-2 text-gray-400" />
                Set Date & Time
              </label>
              <button
                type="button"
                onClick={() => setRequireDateTime(!requireDateTime)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${requireDateTime ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'
                  }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${requireDateTime ? 'translate-x-6' : 'translate-x-1'
                    }`}
                />
              </button>
            </div>
          </div>

          {/* Date/Time Input */}
          {requireDateTime && (
            <div className="relative">
              <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="datetime-local"
                id="dateTime"
                value={dateTime}
                min={currentDateTime}
                onChange={(e) => setDateTime(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 
                          rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-gray-200"
              />
            </div>
          )}

          {/* Reminder Toggle */}
          {requireDateTime && (
            <div>
              <div className="flex items-center justify-between">
                <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Bell size={16} className="mr-2 text-gray-400" />
                  Set Reminder
                </label>
                <button
                  type="button"
                  onClick={() => setReminderEnabled(!reminderEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${reminderEnabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'
                    }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${reminderEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                  />
                </button>
              </div>

              {reminderEnabled && (
                <select
                  value={reminderMinutes}
                  onChange={(e) => setReminderMinutes(Number(e.target.value))}
                  className="mt-2 w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 
                            rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-gray-200"
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
          )}

          {/* Recurrence Toggle */}
          {requireDateTime && (
            <div>
              <div className="flex items-center justify-between">
                <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Repeat size={16} className="mr-2 text-gray-400" />
                  Repeat Task
                </label>
                <button
                  type="button"
                  onClick={() => setRecurrenceEnabled(!recurrenceEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${recurrenceEnabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'
                    }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${recurrenceEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                  />
                </button>
              </div>

              {recurrenceEnabled && (
                <div className="mt-3 space-y-3">
                  {/* Preset Buttons */}
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'Daily', type: 'daily' as const, interval: 1 },
                      { label: 'Weekdays', type: 'weekly' as const, interval: 1 },
                      { label: 'Weekly', type: 'weekly' as const, interval: 1 },
                      { label: 'Monthly', type: 'monthly' as const, interval: 1 },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setRecurrenceType(preset.type);
                          setRecurrenceInterval(preset.interval);
                        }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all
                          ${recurrenceType === preset.type
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {/* Custom Interval */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Every</span>
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={recurrenceInterval}
                      onChange={(e) => setRecurrenceInterval(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 px-2 py-1 text-sm text-center bg-gray-50 dark:bg-gray-700/50 border border-gray-200 
                                dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-gray-200"
                    />
                    <select
                      value={recurrenceType}
                      onChange={(e) => setRecurrenceType(e.target.value as 'daily' | 'weekly' | 'monthly' | 'custom')}
                      className="px-2 py-1 text-sm bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 
                                rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-gray-200"
                    >
                      <option value="daily">day(s)</option>
                      <option value="weekly">week(s)</option>
                      <option value="monthly">month(s)</option>
                    </select>
                  </div>

                  {/* End Condition */}
                  <div className="space-y-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Ends:</span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setRecurrenceEndType('never')}
                        className={`px-3 py-1 text-xs rounded-lg transition-all
                          ${recurrenceEndType === 'never'
                            ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-500'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
                      >
                        Never
                      </button>
                      <button
                        type="button"
                        onClick={() => setRecurrenceEndType('date')}
                        className={`px-3 py-1 text-xs rounded-lg transition-all
                          ${recurrenceEndType === 'date'
                            ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-500'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
                      >
                        On date
                      </button>
                      <button
                        type="button"
                        onClick={() => setRecurrenceEndType('count')}
                        className={`px-3 py-1 text-xs rounded-lg transition-all
                          ${recurrenceEndType === 'count'
                            ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-500'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
                      >
                        After # times
                      </button>
                    </div>

                    {recurrenceEndType === 'date' && (
                      <input
                        type="date"
                        value={recurrenceEndDate}
                        onChange={(e) => setRecurrenceEndDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700/50 border border-gray-200 
                                  dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-gray-200"
                      />
                    )}

                    {recurrenceEndType === 'count' && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">After</span>
                        <input
                          type="number"
                          min="1"
                          max="999"
                          value={recurrenceEndCount}
                          onChange={(e) => setRecurrenceEndCount(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-16 px-2 py-1 text-sm text-center bg-gray-50 dark:bg-gray-700/50 border border-gray-200 
                                    dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-gray-200"
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-400">occurrences</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        className="w-full gradient-primary hover:opacity-90 text-white font-medium py-3 px-4 rounded-xl 
                  transition-all duration-200 flex items-center justify-center shadow-lg shadow-indigo-500/25
                  hover:shadow-xl hover:shadow-indigo-500/30 active:scale-[0.98]"
      >
        <Plus size={18} className="mr-2" />
        Add Task
      </button>
    </form>
  );
};

export default TaskForm;