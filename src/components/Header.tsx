import React from 'react';
import {
  BookOpen,
  Search,
  Moon,
  Sun,
  FileText,
  ChevronsDown,
  ChevronDown,
  Home,
} from 'lucide-react';
import { Surah, ViewMode } from '../types';
import { toPersianDigits } from '../utils/textNormalization';

interface HeaderProps {
  currentSurah: Surah;
  viewMode: ViewMode;
  onToggleViewMode: () => void;
  onOpenSurahList: () => void;
  onOpenSurahSearch: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  isAutoScrollActive: boolean;
  onToggleAutoScroll: () => void;
  onToggleHomeView?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentSurah,
  viewMode,
  onToggleViewMode,
  onOpenSurahList,
  onOpenSurahSearch,
  darkMode,
  onToggleDarkMode,
  isAutoScrollActive,
  onToggleAutoScroll,
  onToggleHomeView,
}) => {
  return (
    <header
      id="app-main-header"
      className={`sticky top-0 z-40 transition-colors duration-200 border-b select-none ${
        darkMode
          ? 'bg-slate-900/95 border-slate-800 text-slate-100 backdrop-blur-md'
          : 'bg-teal-900 text-white border-teal-800 shadow-sm backdrop-blur-md'
      }`}
    >
      <div className="max-w-4xl mx-auto px-3 sm:px-4 h-15 flex items-center justify-between gap-2">
        {/* راست: دکمه آیکونی خانه و انتخاب سوره */}
        <div className="flex items-center gap-2 min-w-0">
          {/* دکمه آیکونی بازگشت به خانه */}
          {onToggleHomeView && (
            <button
              id="btn-header-home-toggle"
              onClick={onToggleHomeView}
              className="p-2 sm:p-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white border border-white/15 transition-all shrink-0"
              title="بازگشت به صفحه اصلی"
              aria-label="صفحه اصلی"
            >
              <Home className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}

          {/* دکمه انتخاب سوره */}
          <button
            id="btn-open-surah-selector"
            onClick={onOpenSurahList}
            className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 active:scale-98 transition-all text-right border border-white/10 min-w-0"
            title="انتخاب سوره و جزء"
          >
            <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300 shrink-0" />
            <div className="flex flex-col min-w-0 text-right">
              <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm leading-tight truncate">
                <span>سوره {currentSurah.nameArabic}</span>
                <span className="text-[10px] sm:text-xs px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 font-normal shrink-0">
                  {toPersianDigits(currentSurah.versesCount)}
                </span>
              </div>
              <span className="text-[10px] sm:text-[11px] opacity-80 leading-none mt-0.5 truncate">
                جزء {toPersianDigits(currentSurah.juzNumber)} • {currentSurah.revelationType === 'Meccan' ? 'مکی' : 'مدنی'}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 opacity-70 shrink-0 mr-0.5" />
          </button>
        </div>

        {/* چپ: دکمه‌های کاملاً آیکونی و خلوت (بدون تایتل و نوشته اضافه) */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* دکمه جستجو در همین سوره */}
          <button
            id="btn-header-surah-search"
            onClick={onOpenSurahSearch}
            className="p-2 sm:p-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white/90 hover:text-white transition-all"
            title={`جستجو در سورهٔ ${currentSurah.nameArabic}`}
            aria-label="جستجو در سوره"
          >
            <Search className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* سوئیچ نما (نمای صفحه‌ای / آیه‌ای) */}
          <button
            id="btn-header-viewmode-toggle"
            onClick={onToggleViewMode}
            className={`p-2 sm:p-2.5 rounded-xl active:scale-95 transition-all border ${
              viewMode === 'mushaf-page'
                ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-sm'
                : 'bg-white/10 hover:bg-white/20 text-white/90 border-white/10'
            }`}
            title={
              viewMode === 'mushaf-page'
                ? 'نمای فعلی: صفحه‌ای (کلیک جهت نمای آیه‌ای)'
                : 'نمای فعلی: آیه‌ای (کلیک جهت نمای صفحه‌ای)'
            }
            aria-label="تغییر نمای مطالعه"
          >
            <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* اسکرول خودکار */}
          <button
            id="btn-header-autoscroll-toggle"
            onClick={onToggleAutoScroll}
            className={`p-2 sm:p-2.5 rounded-xl active:scale-95 transition-all border ${
              isAutoScrollActive
                ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-sm'
                : 'bg-white/10 hover:bg-white/20 text-white/90 border-white/10'
            }`}
            title={isAutoScrollActive ? 'توقف اسکرول خودکار' : 'شروع مطالعه پیوسته با اسکرول خودکار'}
            aria-label="اسکرول خودکار"
          >
            <ChevronsDown className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* تغییر تم تاریک/روشن */}
          <button
            id="btn-header-theme"
            onClick={onToggleDarkMode}
            className="p-2 sm:p-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white/90 hover:text-white transition-all"
            title={darkMode ? 'حالت روز' : 'حالت شب'}
            aria-label="تغییر تم"
          >
            {darkMode ? <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
        </div>
      </div>
    </header>
  );
};
