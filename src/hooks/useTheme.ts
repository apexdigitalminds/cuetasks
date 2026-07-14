import { useEffect, useState, useCallback } from 'react';

// Reads the saved preference directly (defaults to dark) and keeps the
// document class + localStorage in sync. The pre-paint script in index.html
// applies the initial class; this keeps it correct on user changes.
export function useTheme(): [boolean, () => void] {
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return true;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggleTheme = useCallback(() => setIsDark(prev => !prev), []);
  return [isDark, toggleTheme];
}
