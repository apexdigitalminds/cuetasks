import React from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTaskContext } from '../contexts/TaskContext';
import { formatDate, getDayName, getToday } from '../utils/dateUtils';

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

  const handleToday = () => {
    onDateChange(getToday());
  };

  // Calculate circle progress
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (completionRate / 100) * circumference;

  return (
    <div className="gradient-primary rounded-2xl shadow-xl mb-6 overflow-hidden">
      {/* Main content */}
      <div className="p-6">
        <div className="flex items-center justify-between">
          {/* Left side - Date info */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="font-bold text-2xl text-white">
                {isToday ? 'Today' : dayName}
              </h2>
              {!isToday && (
                <button
                  onClick={handleToday}
                  className="px-2 py-0.5 text-xs font-medium bg-white/20 hover:bg-white/30 
                           rounded-full transition-colors text-white/90"
                >
                  Today
                </button>
              )}
            </div>
            <p className="text-indigo-200 text-sm">
              {new Intl.DateTimeFormat('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              }).format(date)}
            </p>

            {/* Quick stats */}
            <div className="flex gap-4 mt-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2">
                <p className="text-xs text-indigo-200">Total</p>
                <p className="text-xl font-bold text-white">{tasks.length}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2">
                <p className="text-xs text-indigo-200">Done</p>
                <p className="text-xl font-bold text-white">{completedTasks.length}</p>
              </div>
            </div>
          </div>

          {/* Right side - Progress ring */}
          <div className="flex-shrink-0 relative w-28 h-28">
            <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="rgba(255, 255, 255, 0.2)"
                strokeWidth="8"
              />
              {/* Progress circle */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="white"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold text-white">{completionRate}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Date navigation bar */}
      <div className="bg-black/10 backdrop-blur-sm px-6 py-3 flex items-center justify-between">
        <button
          onClick={handlePrevDay}
          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white"
          aria-label="Previous day"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="relative">
          <CalendarDays size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/70" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="bg-white/10 hover:bg-white/20 border-0 rounded-lg py-2 pl-10 pr-4 text-white text-sm
                     focus:outline-none focus:ring-2 focus:ring-white/30 transition-colors cursor-pointer"
          />
        </div>

        <button
          onClick={handleNextDay}
          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white"
          aria-label="Next day"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
};

export default DailySummary;