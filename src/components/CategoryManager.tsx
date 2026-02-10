import React, { useState } from 'react';
import { X, Plus, Trash2, Palette } from 'lucide-react';
import { useTaskContext } from '../contexts/TaskContext';
import { DEFAULT_CATEGORIES } from '../types';

interface CategoryManagerProps {
    isOpen: boolean;
    onClose: () => void;
}

const PRESET_COLORS = [
    '#6366f1', // Indigo
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#ef4444', // Red
    '#f97316', // Orange
    '#f59e0b', // Amber
    '#84cc16', // Lime
    '#10b981', // Emerald
    '#14b8a6', // Teal
    '#06b6d4', // Cyan
    '#3b82f6', // Blue
    '#64748b', // Slate
];

const PRESET_ICONS = ['📁', '🎯', '📝', '🏃', '🎨', '📚', '🎮', '🎵', '🏠', '💼', '🛒', '💡', '❤️', '⭐', '🔥', '✈️'];

const CategoryManager: React.FC<CategoryManagerProps> = ({ isOpen, onClose }) => {
    const { categories, addCategory, deleteCategory } = useTaskContext();
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
    const [newIcon, setNewIcon] = useState('📁');
    const [showIconPicker, setShowIconPicker] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleAddCategory = () => {
        const trimmedName = newName.trim();

        if (!trimmedName) {
            setError('Category name is required');
            return;
        }

        if (categories.some(c => c.name.toLowerCase() === trimmedName.toLowerCase())) {
            setError('Category already exists');
            return;
        }

        addCategory(trimmedName, newColor, newIcon);
        setNewName('');
        setNewColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]);
        setError('');
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleAddCategory();
        }
    };

    const isDefaultCategory = (id: string) => {
        return DEFAULT_CATEGORIES.some(c => c.id === id);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden animate-fade-in-up">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Palette size={20} className="text-indigo-500" />
                        Manage Categories
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 
                       hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 overflow-y-auto max-h-[60vh]">
                    {/* Add New Category */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Add New Category
                        </label>

                        {error && (
                            <p className="text-red-500 text-sm mb-2">{error}</p>
                        )}

                        <div className="flex gap-2 mb-3">
                            {/* Icon picker button */}
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setShowIconPicker(!showIconPicker)}
                                    className="w-12 h-12 rounded-xl border-2 border-gray-200 dark:border-gray-600 
                           hover:border-indigo-500 flex items-center justify-center text-xl
                           transition-colors bg-gray-50 dark:bg-gray-700"
                                >
                                    {newIcon}
                                </button>

                                {showIconPicker && (
                                    <div className="absolute top-14 left-0 z-10 bg-white dark:bg-gray-800 rounded-xl 
                                                    shadow-xl border border-gray-200 dark:border-gray-700 p-3 w-64">
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">Select an icon</p>
                                        <div className="grid grid-cols-4 gap-2">
                                            {PRESET_ICONS.map(icon => (
                                                <button
                                                    key={icon}
                                                    onClick={() => {
                                                        setNewIcon(icon);
                                                        setShowIconPicker(false);
                                                    }}
                                                    className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl 
                                                               transition-all hover:scale-110 ${newIcon === icon
                                                            ? 'bg-indigo-100 dark:bg-indigo-900/30 ring-2 ring-indigo-500'
                                                            : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                                                >
                                                    {icon}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Name input */}
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                onKeyDown={handleKeyPress}
                                placeholder="Category name"
                                className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 
                          rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                            />

                            {/* Add button */}
                            <button
                                onClick={handleAddCategory}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl 
                         transition-colors flex items-center gap-1"
                            >
                                <Plus size={18} />
                            </button>
                        </div>

                        {/* Color picker */}
                        <div className="flex flex-wrap gap-2">
                            {PRESET_COLORS.map(color => (
                                <button
                                    key={color}
                                    onClick={() => setNewColor(color)}
                                    className={`w-8 h-8 rounded-full transition-all ${newColor === color
                                        ? 'ring-2 ring-offset-2 dark:ring-offset-gray-800 scale-110'
                                        : 'hover:scale-110'
                                        }`}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Existing Categories */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            Your Categories
                        </label>

                        <div className="space-y-2">
                            {categories.map(category => (
                                <div
                                    key={category.id}
                                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 
                           rounded-xl group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                                            style={{ backgroundColor: `${category.color}20` }}
                                        >
                                            {category.icon || '📁'}
                                        </div>
                                        <span className="font-medium text-gray-900 dark:text-white">
                                            {category.name}
                                        </span>
                                        {isDefaultCategory(category.id) && (
                                            <span className="text-xs text-gray-400 bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded-full">
                                                Default
                                            </span>
                                        )}
                                    </div>

                                    {!isDefaultCategory(category.id) && (
                                        <button
                                            onClick={() => deleteCategory(category.id)}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 
                               rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CategoryManager;
