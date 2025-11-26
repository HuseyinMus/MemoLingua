
import React from 'react';
import { Home, Sparkles, BookOpen, Trophy } from 'lucide-react';
import { AppView } from '../types';

interface NavigationProps {
  currentView: AppView;
  setView: (view: AppView) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentView, setView }) => {
  const navItems = [
    { view: AppView.DASHBOARD, icon: Home, label: 'Home', id: 'nav-dashboard' },
    { view: AppView.STUDY, icon: BookOpen, label: 'Review', id: 'nav-review' },
    { view: AppView.ARENA, icon: Trophy, label: 'Arena', id: 'nav-arena' },
    { view: AppView.DISCOVER, icon: Sparkles, label: 'Add', id: 'nav-discover' },
  ];

  return (
    <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
      <div className="bg-black/90 dark:bg-white/10 backdrop-blur-xl text-white rounded-[2rem] px-2 py-4 shadow-2xl shadow-black/20 dark:shadow-black/50 pointer-events-auto flex items-center justify-around border border-white/10 dark:border-white/5 max-w-sm w-full transition-colors duration-300">
        {navItems.map((item) => {
          const isActive = currentView === item.view;
          const Icon = item.icon;
          
          return (
            <button
              key={item.view}
              id={item.id}
              onClick={() => setView(item.view)}
              className="relative flex flex-col items-center justify-center w-16 h-12 group"
            >
              {/* Active Background Pill */}
              {isActive && (
                  <div className="absolute inset-0 bg-white/10 dark:bg-white/20 rounded-xl animate-fade-in mx-2" />
              )}
              
              <Icon 
                className={`
                    w-6 h-6 transition-all duration-300 
                    ${isActive ? 'text-white scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'text-zinc-500 group-hover:text-zinc-300 dark:text-zinc-400 dark:group-hover:text-zinc-200'}
                `} 
                strokeWidth={isActive ? 2.5 : 2}
              />
              
              {/* Active Dot */}
              <div className={`
                  absolute -bottom-1 w-1 h-1 rounded-full bg-white transition-all duration-300
                  ${isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}
              `} />
            </button>
          );
        })}
      </div>
    </div>
  );
};
