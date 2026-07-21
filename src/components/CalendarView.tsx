import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { useTaskContext } from '../contexts/TaskContext';
import { useAuth } from '../contexts/AuthContext';
import { isOverdue, getToday } from '../utils/dateUtils';
import { Task } from '../types';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const pad = (n: number) => String(n).padStart(2, '0');
// Local Y-M-D key, so tasks land on the calendar day the user sees them.
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

interface CalendarViewProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({ selectedDate, onSelectDate }) => {
  const { tasks, getCategoryById, sharedTaskIds } = useTaskContext();
  const { user } = useAuth();
  const [month, setMonth] = useState(() => {
    const d = new Date(`${selectedDate}T00:00`);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.dateTime) continue;
      const d = new Date(t.dateTime);
      if (isNaN(d.getTime())) continue;
      const k = dayKey(d);
      const arr = map.get(k);
      if (arr) arr.push(t); else map.set(k, [t]);
    }
    return map;
  }, [tasks]);

  // 6 weeks of cells, Monday-first, including trailing/leading days.
  const cells = useMemo(() => {
    const first = new Date(month.y, month.m, 1);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(month.y, month.m, 1 - offset);
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [month]);

  const todayK = dayKey(new Date());
  const monthLabel = new Date(month.y, month.m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const dotColor = (t: Task) => {
    if (t.completed) return '#22c55e';
    if (isOverdue(t.dateTime, t.completed)) return '#ef4444';
    return (t.categoryId && getCategoryById(t.categoryId)?.color) || '#6366f1';
  };
  const isSharedTask = (t: Task) => sharedTaskIds.has(t.id) || (!!t.ownerId && !!user && t.ownerId !== user.id);

  const undatedCount = tasks.filter(t => !t.completed && !t.dateTime).length;
  const prev = () => setMonth(v => v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 });
  const next = () => setMonth(v => v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 });
  const goToday = () => { const t = new Date(); setMonth({ y: t.getFullYear(), m: t.getMonth() }); onSelectDate(getToday()); };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 dark:text-white">{monthLabel}</h3>
        <div className="flex items-center gap-1">
          <button onClick={prev} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors" aria-label="Previous month"><ChevronLeft size={18} /></button>
          <button onClick={goToday} className="px-2.5 py-1 text-xs rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors">Today</button>
          <button onClick={next} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors" aria-label="Next month"><ChevronRight size={18} /></button>
        </div>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-[11px] font-medium text-gray-400 dark:text-gray-500 py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          const k = dayKey(cell);
          const inMonth = cell.getMonth() === month.m;
          const dayTasks = byDay.get(k) ?? [];
          const isSelected = k === selectedDate;
          const isToday = k === todayK;
          const shared = dayTasks.some(isSharedTask);
          return (
            <button
              key={i}
              onClick={() => onSelectDate(k)}
              aria-label={`${cell.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}${dayTasks.length ? `, ${dayTasks.length} task${dayTasks.length === 1 ? '' : 's'}` : ''}`}
              className={`relative aspect-square rounded-lg flex flex-col items-center pt-1 transition-colors
                ${isSelected ? 'bg-indigo-100 dark:bg-indigo-900/40 ring-1 ring-indigo-400' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'}
                ${inMonth ? '' : 'opacity-40'}`}
            >
              <span className={`text-xs ${isToday ? 'font-bold text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'}`}>{cell.getDate()}</span>
              {shared && <Users size={9} className="absolute top-1 right-1 text-indigo-400" aria-hidden="true" />}
              <div className="flex flex-wrap justify-center items-center gap-0.5 mt-0.5 px-0.5">
                {dayTasks.slice(0, 4).map((t, j) => (
                  <span key={j} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dotColor(t) }} />
                ))}
                {dayTasks.length > 4 && <span className="text-[9px] text-gray-400 dark:text-gray-500 leading-none">+{dayTasks.length - 4}</span>}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-[11px] text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />Overdue</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Done</span>
        <span className="flex items-center gap-1"><Users size={11} className="text-indigo-400" />Shared</span>
        {undatedCount > 0 && <span className="ml-auto">{undatedCount} with no date</span>}
      </div>
    </div>
  );
};

export default CalendarView;
