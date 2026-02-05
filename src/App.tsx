import React, { useState } from 'react';
import { CheckSquare, Menu } from 'lucide-react';
import { TaskProvider } from './contexts/TaskContext';
import TaskForm from './components/TaskForm';
import TaskList from './components/TaskList';
import DailySummary from './components/DailySummary';
import ThemeToggle from './components/ThemeToggle';
import { useTaskContext } from './contexts/TaskContext';
import { getToday } from './utils/dateUtils';

const AppContent: React.FC = () => {
  const taskContext = useTaskContext();
  
  // Add error boundary for context
  if (!taskContext) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Loading...</h1>
          <p className="text-gray-600 dark:text-gray-400">Initializing TaskVoice</p>
        </div>
      </div>
    );
  }
  
  const { getTasksForDate } = taskContext;
  const [selectedDate, setSelectedDate] = useState(getToday());
  const tasks = getTasksForDate(selectedDate);
  
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors duration-200">
      <header className="bg-white dark:bg-gray-800 shadow-sm py-4 px-6 fixed top-0 w-full z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center">
            <CheckSquare size={28} className="text-indigo-600 dark:text-indigo-500 mr-3" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">TaskVoice</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>
      
      <main className="max-w-3xl mx-auto pt-20 pb-20 px-4">
        <DailySummary selectedDate={selectedDate} onDateChange={setSelectedDate} />
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <TaskForm />
          </div>
          
          <div className="md:col-span-2">
            <TaskList tasks={tasks} date={selectedDate} />
          </div>
        </div>
      </main>
      
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-4 px-6 fixed bottom-0 w-full">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            TaskVoice - Manage your tasks effortlessly
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            © 2025 TaskVoice
          </p>
        </div>
      </footer>
    </div>
  );
};

function App() {
  return (
    <TaskProvider>
      <AppContent />
    </TaskProvider>
  );
}

export default App;