import React, { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Globe } from 'lucide-react';
import { useTaskContext } from '../contexts/TaskContext';
import { formatDate, getDayName, getToday, getUserTimezone } from '../utils/dateUtils';

interface DailySummaryProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
}

const DailySummary: React.FC<DailySummaryProps> = ({ 
  selectedDate, 
  onDateChange 
}) => {
  const { getTasksForDate } = useTaskContext();
  const tasks = getTasksForDate(selectedDate);
  
  const completedTasks = tasks.filter(task => task.completed);
  const completionRate = tasks.length > 0 
    ? Math.round((completedTasks.length / tasks.length) * 100) 
    : 0;
  
  const date = new Date(selectedDate);
  const dayName = getDayName(selectedDate);
  const isToday = selectedDate === getToday();
  const userTimezone = getUserTimezone();
  
  const handlePrevDay = () => {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() - 1);
    onDateChange(formatDate(newDate));
  };
  
  const handleNextDay = () => {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + 1);
    onDateChange(formatDate(newDate));
  };
  
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onDateChange(e.target.value);
  };

  return (
    <div className="bg-indigo-600 dark:bg-indigo-700 text-white rounded-lg shadow-md mb-6 overflow-hidden">
      <div className="flex items-center justify-between p-5">
        <div>
          <h2 className="font-bold text-2xl">
            {isToday ? 'Today' : dayName}
          </h2>
          <p className="text-indigo-200 dark:text-indigo-300 mt-1">
            {new Intl.DateTimeFormat('en-US', { 
              month: 'long', 
              day: 'numeric', 
              year: 'numeric',
              timeZone: userTimezone
            }).format(date)}
          </p>
          <p className="text-xs text-indigo-300 dark:text-indigo-400 mt-1 flex items-center">
            <Globe size={12} className="mr-1" />
            {userTimezone}
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrevDay}
            className="p-2 rounded-full bg-indigo-500/30 hover:bg-indigo-500/50 transition-colors duration-200"
            aria-label="Previous day"
          >
            <ChevronLeft size={18} />
          </button>
          
          <div className="relative">
            <CalendarDays size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-indigo-200" />
            <input
              type="date"
              value={selectedDate}
              onChange={handleDateChange}
              className="bg-indigo-500/30 border border-indigo-400/30 rounded-md py-1.5 pl-10 pr-3 text-white placeholder-indigo-200"
            />
          </div>
          
          <button
            onClick={handleNextDay}
            className="p-2 rounded-full bg-indigo-500/30 hover:bg-indigo-500/50 transition-colors duration-200"
            aria-label="Next day"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      
      <div className="bg-indigo-700/30 dark:bg-indigo-800/40 p-4 flex items-center justify-between">
        <div className="flex space-x-6">
          <div>
            <p className="text-sm text-indigo-200 dark:text-indigo-300">Total Tasks</p>
            <p className="text-2xl font-semibold">{tasks.length}</p>
          </div>
          <div>
            <p className="text-sm text-indigo-200 dark:text-indigo-300">Completed</p>
            <p className="text-2xl font-semibold">{completedTasks.length}</p>
          </div>
        </div>
        
        <div className="w-24 h-24 relative">
          <svg viewBox="0 0 36 36" className="w-full h-full">
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="rgba(255, 255, 255, 0.2)"
              strokeWidth="3"
              strokeDasharray="100, 100"
            />
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeDasharray={`${completionRate}, 100`}
              className="transition-all duration-1000 ease-out"
            />
            <text x="18" y="20.5" textAnchor="middle" fill="white" fontSize="8.5">
              {completionRate}%
            </text>
          </svg>
        </div>
      </div>
    </div>
  );
};

export default DailySummary;