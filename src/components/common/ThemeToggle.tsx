import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      type="button"
      title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`}
      className={`btn-action flex items-center space-x-2 px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all duration-200 cursor-pointer shadow-md border border-[#16e990]/40 ${
        theme === 'dark'
          ? 'bg-[#0E1A29] text-[#16e990] hover:bg-[#122033] hover:border-[#16e990]'
          : 'bg-white text-[#0F172A] hover:bg-[#E6F9F0] border-emerald-400'
      } ${className}`}
    >
      {theme === 'dark' ? (
        <>
          <Sun className="w-4 h-4 text-[#16e990] animate-spin-slow" />
          <span className="hidden sm:inline">Light Mode</span>
        </>
      ) : (
        <>
          <Moon className="w-4 h-4 text-emerald-600" />
          <span className="hidden sm:inline">Dark Mode</span>
        </>
      )}
    </button>
  );
};
