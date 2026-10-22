import React, { useState } from 'react';
import {
  X,
  Home,
  BookOpen,
  Sparkles,
  GraduationCap,
  Calendar,
  Bookmark,
  RotateCcw,
  DownloadCloud,
  Settings,
  Moon,
  Sun,
  Smartphone,
  Info,
} from 'lucide-react';
import { PWAInstallModal } from './PWAInstallModal';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { QuranLogo } from './QuranicOrnament';

type PageId = 'home' | 'reader' | 'ai' | 'memorization' | 'offline' | 'stories';

interface AppDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activePage: PageId;
  onNavigateHome: () => void;
  onNavigateReader: () => void;
  onNavigateAI: () => void;
  onNavigateMemorization: () => void;
  onOpenKhatm: () => void;
  onOpenBookmarks: () => void;
  onOpenStories: () => void;
  onOpenOffline: () => void;
  onOpenSettings: () => void;
  onOpenAbout: () => void;
  onToggleDarkMode: () => void;
  darkMode: boolean;
}

/**
 * منوی کشویی اصلی برنامه (جایگزین نوار پایین و منوی «امکانات»).
 * از سمت راست باز می‌شود (RTL)، هیچ‌وقت روی دکمه‌های پایین پنل‌ها نمی‌افتد
 * و با دکمهٔ Back بسته می‌شود (handleAppBack در App.tsx).
 */
export const AppDrawer: React.FC<AppDrawerProps> = ({
  isOpen,
  onClose,
  activePage,
  onNavigateHome,
  onNavigateReader,
  onNavigateAI,
  onNavigateMemorization,
  onOpenKhatm,
  onOpenBookmarks,
  onOpenStories,
  onOpenOffline,
  onOpenSettings,
  onOpenAbout,
  onToggleDarkMode,
  darkMode,
}) => {
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const { isInstalled } = usePWAInstall();

  if (!isOpen && !isInstallModalOpen) return null;

  const go = (fn: () => void) => () => {
    onClose();
    fn();
  };

  const rowBase =
    'w-full min-h-[46px] flex items-center gap-3 px-3 rounded-xl text-sm font-bold text-right transition-colors cursor-pointer active:scale-[0.99]';
  const rowIdle = 'text-slate-800 dark:text-slate-100 hover:bg-stone-100 dark:hover:bg-slate-800';
  const rowOn = 'bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-200';

  const Row: React.FC<{
    icon: React.ElementType;
    label: string;
    onClick: () => void;
    active?: boolean;
    iconClass?: string;
    trailing?: React.ReactNode;
  }> = ({ icon: Icon, label, onClick, active, iconClass = 'text-teal-600 dark:text-teal-400', trailing }) => (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`${rowBase} ${active ? rowOn : rowIdle}`}
    >
      <Icon className={`w-[22px] h-[22px] shrink-0 ${active ? '' : iconClass}`} />
      <span className="flex-1 truncate">{label}</span>
      {trailing}
    </button>
  );

  const GroupLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="px-3 pt-1 text-[11px] font-extrabold text-amber-700 dark:text-amber-300">{children}</div>
  );
  const Divider = () => <div className="h-px bg-stone-300/70 dark:bg-slate-700/70 my-1.5" />;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-[120] bg-black/50 animate-fadeIn select-none font-['Vazirmatn']"
          onClick={onClose}
          dir="rtl"
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="منوی اصلی"
            onClick={(e) => e.stopPropagation()}
            className="absolute top-0 bottom-0 right-0 w-[min(320px,86vw)] flex flex-col gap-0.5 px-3 pt-4 border-l-2 border-amber-600 rounded-l-3xl bg-stone-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-2xl"
            style={{
              paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)',
              paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)',
            }}
          >
            {/* سربرگ منو: دقیقاً همان لوگوی اصلی برنامه در صفحه اصلی */}
            <div className="flex items-center justify-between gap-3 px-1.5 py-2 mb-1 rounded-2xl bg-stone-100/80 dark:bg-slate-800/60 border border-amber-300/40 dark:border-slate-700/60">
              <div className="flex items-center gap-3 min-w-0">
                <QuranLogo size="md" darkMode={darkMode} />
                <div className="min-w-0 text-right">
                  <div className="font-black text-base text-slate-900 dark:text-slate-100 leading-tight">قرآن مبین</div>
                  <div className="text-[11px] text-teal-700 dark:text-teal-400 font-medium truncate">قرائت، ترجمه و تدبّر</div>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="بستن منو"
                className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-500 hover:bg-stone-200 dark:hover:bg-slate-700 active:scale-95 transition-all cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <Divider />

            {/* ناوبری اصلی */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5">
              <Row icon={Home} label="خانه" active={activePage === 'home'} onClick={go(onNavigateHome)} />
              <Row icon={BookOpen} label="قرائت قرآن" active={activePage === 'reader'} onClick={go(onNavigateReader)} />
              <Row
                icon={Sparkles}
                label="تدبّر هوشمند"
                active={activePage === 'ai'}
                onClick={go(onNavigateAI)}
                trailing={<i className="w-2 h-2 rounded-full bg-amber-500 block" />}
              />
              <Row icon={GraduationCap} label="حفظ قرآن" active={activePage === 'memorization'} onClick={go(onNavigateMemorization)} />

              <Divider />
              <GroupLabel>همراه قرائت</GroupLabel>
              <Row icon={Calendar} label="برنامه ختم قرآن" iconClass="text-indigo-600 dark:text-indigo-400" onClick={go(onOpenKhatm)} />
              <Row icon={Bookmark} label="نشان‌شده‌ها و یادداشت‌ها" iconClass="text-rose-600 dark:text-rose-400" onClick={go(onOpenBookmarks)} />
              <Row
                icon={Sparkles}
                label="داستان‌ها و حکمت‌های قرآنی"
                active={activePage === 'stories'}
                iconClass="text-purple-600 dark:text-purple-400"
                onClick={go(onOpenStories)}
              />

              <Divider />
              <GroupLabel>ابزارها</GroupLabel>
              <Row
                icon={RotateCcw}
                label="جعبه لایتنر و مرور آیات"
                iconClass="text-amber-600 dark:text-amber-400"
                onClick={go(() =>
                  window.dispatchEvent(new CustomEvent('mobin-open-leitner'))
                )}
              />
              <Row
                icon={DownloadCloud}
                label="دانلود صوت آفلاین"
                active={activePage === 'offline'}
                iconClass="text-emerald-600 dark:text-emerald-400"
                onClick={go(onOpenOffline)}
              />

              <Divider />
              <GroupLabel>برنامه</GroupLabel>
              <Row icon={Settings} label="تنظیمات نمایش و قلم" iconClass="text-purple-600 dark:text-purple-400" onClick={go(onOpenSettings)} />
              <Row
                icon={darkMode ? Sun : Moon}
                label="حالت شب"
                onClick={onToggleDarkMode}
                trailing={
                  <span
                    role="switch"
                    aria-checked={darkMode}
                    className={`w-12 h-7 rounded-full p-[3px] flex items-center transition-colors ${
                      darkMode ? 'bg-teal-700 justify-start' : 'bg-stone-300 justify-end'
                    }`}
                  >
                    <i className="w-[22px] h-[22px] rounded-full bg-white block" />
                  </span>
                }
              />
              {!isInstalled && (
                <Row
                  icon={Smartphone}
                  label="نصب برنامه روی گوشی"
                  iconClass="text-amber-600 dark:text-amber-400"
                  onClick={() => {
                    onClose();
                    setIsInstallModalOpen(true);
                  }}
                />
              )}
              <Row icon={Info} label="درباره و تماس با ما" iconClass="text-amber-600 dark:text-amber-400" onClick={go(onOpenAbout)} />
            </div>

            {/* موکب */}
            <button
              type="button"
              onClick={go(onOpenAbout)}
              className="mt-2 flex items-center gap-3 p-2.5 rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 to-teal-50 dark:from-amber-950/30 dark:to-teal-950/30 dark:border-amber-700/40 text-right cursor-pointer active:scale-[0.99]"
            >
              <img
                src="/mokeb-logo.jpg"
                alt="موکب فاطمه الزهرا (س)"
                className="w-11 h-11 object-cover rounded-xl border border-amber-400/60 shrink-0"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold text-amber-700 dark:text-amber-300">
                  نذر فرهنگی و ترویج کلام وحی
                </span>
                <span className="block text-xs font-black truncate">موکب حضرت فاطمه‌الزهرا (س)</span>
              </span>
            </button>
          </aside>
        </div>
      )}

      <PWAInstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        darkMode={darkMode}
      />
    </>
  );
};
