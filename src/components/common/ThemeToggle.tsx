import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      type="button"
      title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
      aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
      className={`btn-action flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold font-mono transition-all duration-300 cursor-pointer shadow-sm border ${
        theme === 'dark'
          ? 'bg-[#0E1A29] text-[#22D3EE] border-[#22D3EE]/40 hover:bg-[#13253B] hover:border-[#22D3EE]'
          : 'bg-white text-[#0B2559] border-slate-300 hover:bg-slate-100 hover:border-[#0B2559] shadow-slate-200'
      } ${className}`}
    >
      {theme === 'dark' ? (
        <>
          <Sun className="w-4 h-4 text-[#22D3EE] animate-pulse" />
          <span className="hidden sm:inline font-bold">Light Mode</span>
        </>
      ) : (
        <>
          <Moon className="w-4 h-4 text-[#0B2559]" />
          <span className="hidden sm:inline font-bold">Dark Mode</span>
        </>
      )}
    </button>
  );
};
export default ThemeToggle;
