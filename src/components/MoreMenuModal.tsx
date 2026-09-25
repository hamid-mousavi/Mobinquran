import React, { useState } from 'react';
import {
  X,
  BookOpen,
  Calendar,
  Bookmark,
  Search,
  DownloadCloud,
  Settings,
  Moon,
  Sun,
  FileText,
  Sparkles,
  Smartphone,
} from 'lucide-react';
import { PWAInstallModal } from './PWAInstallModal';

interface MoreMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSurahList: () => void;
  onOpenKhatm: () => void;
  onOpenBookmarks: () => void;
  onOpenSearch: () => void;
  onOpenOffline: () => void;
  onOpenSettings: () => void;
  onToggleDarkMode: () => void;
  onOpenMushafPage: () => void;
  darkMode: boolean;
}

export const MoreMenuModal: React.FC<MoreMenuModalProps> = ({
  isOpen,
  onClose,
  onOpenSurahList,
  onOpenKhatm,
  onOpenBookmarks,
  onOpenSearch,
  onOpenOffline,
  onOpenSettings,
  onToggleDarkMode,
  onOpenMushafPage,
  darkMode,
}) => {
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);

  if (!isOpen) return null;

  const menuItems = [
    {
      label: 'نصب نسخه اپلیکیشن (PWA)',
      desc: 'اجرای مستقل، بدون نوار مرورگر و دسترسی ۱۰۰٪ آفلاین',
      icon: Smartphone,
      iconColor: 'text-amber-600 dark:text-amber-400 bg-amber-500/15',
      action: () => {
        setIsInstallModalOpen(true);
      },
    },
    {
      label: 'فهرست سوره‌ها و ۳۰ جزء',
      desc: 'انتخاب سریع از میان ۱۱۴ سوره و اجزاء',
      icon: BookOpen,
      iconColor: 'text-teal-600 dark:text-teal-400 bg-teal-500/10',
      action: () => {
        onClose();
        onOpenSurahList();
      },
    },
    {
      label: 'مصحف صفحه‌ای عثمان طه',
      desc: 'مشاهده ۶۰۴ صفحه پیوسته قرآن',
      icon: FileText,
      iconColor: 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
      action: () => {
        onClose();
        onOpenMushafPage();
      },
    },
    {
      label: 'برنامه ختم قرآن کریم',
      desc: 'پیگیری عهد روزانه و ثبت جزءخوانی',
      icon: Calendar,
      iconColor: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10',
      action: () => {
        onClose();
        onOpenKhatm();
      },
    },
    {
      label: 'نشان‌شده‌ها و یادداشت‌ها',
      desc: 'آیات ذخیره‌شده و حاشیه‌نویسی‌ها',
      icon: Bookmark,
      iconColor: 'text-rose-600 dark:text-rose-400 bg-rose-500/10',
      action: () => {
        onClose();
        onOpenBookmarks();
      },
    },
    {
      label: 'جستجوی پیشرفته متنی',
      desc: 'کاوش در کلمات قرآن و ۳ ترجمه فارسی',
      icon: Search,
      iconColor: 'text-sky-600 dark:text-sky-400 bg-sky-500/10',
      action: () => {
        onClose();
        onOpenSearch();
      },
    },
    {
      label: 'مدیریت دانلود صوت آفلاین',
      desc: 'دریافت فایل صوتی قاریان جهت تلاوت بدون اینترنت',
      icon: DownloadCloud,
      iconColor: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
      action: () => {
        onClose();
        onOpenOffline();
      },
    },
    {
      label: 'تنظیمات قلم و ترجمه‌ها',
      desc: 'انتخاب فونت عثمان طه/امیری، اندازه و مترجم',
      icon: Settings,
      iconColor: 'text-purple-600 dark:text-purple-400 bg-purple-500/10',
      action: () => {
        onClose();
        onOpenSettings();
      },
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs animate-fadeIn select-none font-['Vazirmatn']"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className={`w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-stone-200 dark:border-slate-800 p-4 sm:p-6 shadow-2xl transition-all ${
          darkMode ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-800'
        }`}
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '85vh', overflowY: 'auto' }}
      >
        {/* دستگیره کشو در موبایل */}
        <div className="w-12 h-1 bg-stone-300 dark:bg-slate-700 rounded-full mx-auto mb-4 sm:hidden" />

        {/* سربرگ */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h2 className="font-bold text-base">امکانات و ابزارهای قرآنی</h2>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onToggleDarkMode}
              className="p-2 rounded-xl border border-stone-200 dark:border-slate-700 hover:bg-stone-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
              title="تغییر تم"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              aria-label="بستن"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* لیست گزینه‌ها */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {menuItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                onClick={item.action}
                className="flex items-center gap-3 p-3 rounded-2xl border border-stone-100 dark:border-slate-800/80 hover:border-teal-500/40 bg-stone-50/70 dark:bg-slate-800/40 hover:bg-stone-100 dark:hover:bg-slate-800 transition-all text-right active:scale-[0.99]"
              >
                <div className={`p-2.5 rounded-xl shrink-0 ${item.iconColor}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs sm:text-sm font-bold truncate">{item.label}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {item.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* مودال جامع نصب اپلیکیشن */}
      <PWAInstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        darkMode={darkMode}
      />
    </div>
  );
};
