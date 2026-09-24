import React from 'react';
import { Home, BookOpen, Sparkles, GraduationCap, LayoutGrid } from 'lucide-react';

interface BottomNavigationProps {
  activePage: 'home' | 'reader' | 'ai' | 'memorization' | 'offline';
  onNavigateHome: () => void;
  onNavigateReader: () => void;
  onNavigateAI: () => void;
  onNavigateMemorization: () => void;
  onOpenMoreMenu: () => void;
  darkMode: boolean;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activePage,
  onNavigateHome,
  onNavigateReader,
  onNavigateAI,
  onNavigateMemorization,
  onOpenMoreMenu,
  darkMode,
}) => {
  const navItems = [
    {
      id: 'home' as const,
      label: 'خانه',
      icon: Home,
      onClick: onNavigateHome,
      isActive: activePage === 'home',
    },
    {
      id: 'reader' as const,
      label: 'قرائت',
      icon: BookOpen,
      onClick: onNavigateReader,
      isActive: activePage === 'reader',
    },
    {
      id: 'ai' as const,
      label: 'تدبّر هوشمند',
      icon: Sparkles,
      onClick: onNavigateAI,
      isActive: activePage === 'ai',
      badge: 'جدید',
    },
    {
      id: 'memorization' as const,
      label: 'حفظ قرآن',
      icon: GraduationCap,
      onClick: onNavigateMemorization,
      isActive: activePage === 'memorization',
    },
    {
      id: 'more' as const,
      label: 'امکانات',
      icon: LayoutGrid,
      onClick: onOpenMoreMenu,
      isActive: false,
    },
  ];

  return (
    <nav
      id="app-bottom-navigation"
      aria-label="ناوبری اصلی پایین صفحه"
      className={`fixed bottom-0 inset-x-0 z-40 transition-all select-none border-t backdrop-blur-lg ${
        darkMode
          ? 'bg-slate-950/95 border-slate-800/80 text-slate-300'
          : 'bg-white/95 border-slate-200/90 text-slate-600'
      }`}
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 4px)' }}
    >
      <div className="max-w-md sm:max-w-lg mx-auto px-2 flex items-center justify-around h-15">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isCurrent = item.isActive;
          return (
            <button
              key={item.id}
              onClick={item.onClick}
              className={`relative flex flex-col items-center justify-center flex-1 h-full py-1 transition-all group active:scale-95 focus-visible:outline-none ${
                isCurrent
                  ? darkMode
                    ? 'text-teal-400 font-bold'
                    : 'text-teal-700 font-bold'
                  : 'hover:text-slate-900 dark:hover:text-slate-100 opacity-80 hover:opacity-100'
              }`}
              title={item.label}
              aria-current={isCurrent ? 'page' : undefined}
            >
              {/* نشانگر باریک فعال بالای دکمه */}
              {isCurrent && (
                <div className="absolute top-0 inset-x-3 h-0.5 bg-teal-500 rounded-full" />
              )}

              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform group-hover:scale-110 ${
                    isCurrent ? 'stroke-[2.4]' : 'stroke-[1.8]'
                  }`}
                />
                {item.id === 'ai' && (
                  <span className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                )}
              </div>
              <span className="text-[11px] mt-1 leading-none tracking-tight">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
