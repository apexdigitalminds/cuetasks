import React, { useState, useMemo } from 'react';
import { X, Search, Calendar, TrendingUp, CheckCircle2, BarChart3, Clock } from 'lucide-react';
import { useTaskContext } from '../contexts/TaskContext';
import { Task } from '../types';

interface TaskHistoryProps {
    isOpen: boolean;
    onClose: () => void;
}

type StatusFilter = 'all' | 'completed' | 'open';
type DateRangeFilter = '7days' | '30days' | '90days' | 'all';

const TaskHistory: React.FC<TaskHistoryProps> = ({ isOpen, onClose }) => {
    const { tasks, categories, getCategoryById } = useTaskContext();

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>('30days');

    // Filter tasks based on search, status, category, and date range
    const filteredTasks = useMemo(() => {
        const now = new Date();
        let cutoffDate: Date | null = null;

        switch (dateRangeFilter) {
            case '7days':
                cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30days':
                cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case '90days':
                cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                break;
            default:
                cutoffDate = null;
        }

        return tasks.filter(task => {
            // Search filter
            if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) {
                return false;
            }

            // Status filter
            if (statusFilter === 'completed' && !task.completed) return false;
            if (statusFilter === 'open' && task.completed) return false;

            // Category filter
            if (categoryFilter !== 'all' && task.categoryId !== categoryFilter) return false;

            // Date range filter
            if (cutoffDate) {
                const taskDate = new Date(task.completedAt || task.createdAt);
                if (taskDate < cutoffDate) return false;
            }

            return true;
        }).sort((a, b) => {
            // Sort by completion date (most recent first), then by creation date
            const dateA = new Date(a.completedAt || a.createdAt);
            const dateB = new Date(b.completedAt || b.createdAt);
            return dateB.getTime() - dateA.getTime();
        });
    }, [tasks, searchQuery, statusFilter, categoryFilter, dateRangeFilter]);

    // Calculate stats
    const stats = useMemo(() => {
        const completed = filteredTasks.filter(t => t.completed).length;
        const total = filteredTasks.length;
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

        // Find most productive day
        const dayCount: Record<string, number> = {};
        filteredTasks.filter(t => t.completed).forEach(task => {
            const date = new Date(task.completedAt || task.createdAt);
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            dayCount[dayName] = (dayCount[dayName] || 0) + 1;
        });

        const bestDay = Object.entries(dayCount)
            .sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

        return { completed, total, completionRate, bestDay };
    }, [filteredTasks]);

    // Group tasks by date
    const groupedTasks = useMemo(() => {
        const groups: Record<string, Task[]> = {};

        filteredTasks.forEach(task => {
            const date = new Date(task.completedAt || task.createdAt);
            const dateKey = date.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
                year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
            });

            if (!groups[dateKey]) groups[dateKey] = [];
            groups[dateKey].push(task);
        });

        return groups;
    }, [filteredTasks]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="relative w-full max-w-2xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl 
                      border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <BarChart3 size={24} className="text-indigo-500" />
                            Task History
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 
                        dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Search */}
                    <div className="relative mb-3">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search tasks..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 
                        dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 
                        focus:ring-indigo-500 dark:text-gray-200"
                            style={{ fontSize: '16px' }}
                        />
                    </div>

                    {/* Filters Row */}
                    <div className="flex flex-wrap gap-2">
                        {/* Status Filter */}
                        <div className="flex rounded-lg bg-gray-100 dark:bg-gray-700 p-1">
                            {(['all', 'completed', 'open'] as StatusFilter[]).map(status => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all capitalize
                    ${statusFilter === status
                                            ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>

                        {/* Date Range Filter */}
                        <select
                            value={dateRangeFilter}
                            onChange={(e) => setDateRangeFilter(e.target.value as DateRangeFilter)}
                            className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 border-0 rounded-lg 
                        text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="7days">Last 7 days</option>
                            <option value="30days">Last 30 days</option>
                            <option value="90days">Last 90 days</option>
                            <option value="all">All time</option>
                        </select>

                        {/* Category Filter */}
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 border-0 rounded-lg 
                        text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="all">All categories</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white dark:bg-gray-700 rounded-xl p-3 text-center shadow-sm">
                            <div className="flex items-center justify-center mb-1">
                                <CheckCircle2 size={16} className="text-green-500 mr-1" />
                                <span className="text-2xl font-bold text-gray-900 dark:text-white">{stats.completionRate}%</span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Completion</p>
                        </div>
                        <div className="bg-white dark:bg-gray-700 rounded-xl p-3 text-center shadow-sm">
                            <div className="flex items-center justify-center mb-1">
                                <TrendingUp size={16} className="text-indigo-500 mr-1" />
                                <span className="text-2xl font-bold text-gray-900 dark:text-white">{stats.completed}</span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">of {stats.total} done</p>
                        </div>
                        <div className="bg-white dark:bg-gray-700 rounded-xl p-3 text-center shadow-sm">
                            <div className="flex items-center justify-center mb-1">
                                <Calendar size={16} className="text-amber-500 mr-1" />
                                <span className="text-2xl font-bold text-gray-900 dark:text-white">{stats.bestDay}</span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Best day</p>
                        </div>
                    </div>
                </div>

                {/* Task List */}
                <div className="flex-1 overflow-y-auto p-4">
                    {Object.keys(groupedTasks).length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                            <Clock size={48} className="mb-4 opacity-50" />
                            <p className="text-lg font-medium">No tasks found</p>
                            <p className="text-sm">Try adjusting your filters</p>
                        </div>
                    ) : (
                        Object.entries(groupedTasks).map(([dateKey, dateTasks]) => (
                            <div key={dateKey} className="mb-6">
                                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2">
                                    <Calendar size={14} />
                                    {dateKey}
                                </h3>
                                <div className="space-y-2">
                                    {dateTasks.map(task => {
                                        const category = task.categoryId ? getCategoryById(task.categoryId) : null;
                                        return (
                                            <div
                                                key={task.id}
                                                className={`flex items-center p-3 rounded-xl border transition-all
                          ${task.completed
                                                        ? 'bg-gray-50 dark:bg-gray-800/30 border-gray-100 dark:border-gray-800'
                                                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}
                                            >
                                                <div className={`w-5 h-5 rounded-full flex-shrink-0 mr-3 flex items-center justify-center
                          ${task.completed
                                                        ? 'bg-green-500'
                                                        : 'border-2 border-gray-300 dark:border-gray-600'}`}
                                                >
                                                    {task.completed && <CheckCircle2 size={12} className="text-white" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-medium truncate
                            ${task.completed ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-white'}`}>
                                                        {task.title}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        {category && (
                                                            <span
                                                                className="text-xs px-1.5 py-0.5 rounded-full"
                                                                style={{ backgroundColor: `${category.color}20`, color: category.color }}
                                                            >
                                                                {category.icon} {category.name}
                                                            </span>
                                                        )}
                                                        {task.dateTime && (
                                                            <span className="text-xs text-gray-400">
                                                                {new Date(task.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default TaskHistory;
