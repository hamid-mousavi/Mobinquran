import React, { useState, useRef, useEffect } from 'react';
import {
  BookOpen,
  Settings,
  Search,
  Sparkles,
  Moon,
  Sun,
  Bookmark,
  Calendar,
  DownloadCloud,
  FileText,
  ChevronsDown,
  LayoutGrid,
  ChevronDown,
  X,
  Check,
  Layers,
  Sparkle,
  GraduationCap
} from 'lucide-react';
import { Surah, ViewMode } from '../types';

interface HeaderProps {
  currentSurah: Surah;
  viewMode: ViewMode;
  onToggleViewMode: () => void;
  onOpenSurahList: () => void;
  onOpenSettings: () => void;
  onOpenSearch: () => void;
  onOpenBookmarks: () => void;
  onOpenKhatm: () => void;
  onOpenOffline: () => void;
  onOpenAI: () => void;
  onOpenMemorization: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  isAutoScrollActive: boolean;
  onToggleAutoScroll: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentSurah,
  viewMode,
  onToggleViewMode,
  onOpenSurahList,
  onOpenSettings,
  onOpenSearch,
  onOpenBookmarks,
  onOpenKhatm,
  onOpenOffline,
  onOpenAI,
  onOpenMemorization,
  darkMode,
  onToggleDarkMode,
  isAutoScrollActive,
  onToggleAutoScroll,
}) => {
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // بستن منو با کلیک در بیرون
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsToolsMenuOpen(false);
      }
    };
    if (isToolsMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isToolsMenuOpen]);

  return (
    <header
      id="app-main-header"
      className={`sticky top-0 z-30 transition-colors duration-200 border-b select-none ${
        darkMode
          ? 'bg-slate-900/95 border-slate-800 text-slate-100 backdrop-blur-md'
          : 'bg-teal-900 text-white border-teal-800 shadow-sm backdrop-blur-md'
      }`}
    >
      <div className="max-w-4xl mx-auto px-2.5 sm:px-4 h-16 flex items-center justify-between gap-2">
        {/* راست: دکمه انتخاب سوره و سوئیچ نما */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          <button
            id="btn-open-surah-selector"
            onClick={onOpenSurahList}
            className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 transition-all text-right border border-white/10 min-w-0"
            title="انتخاب سوره و فهرست ۱۱۴ سوره"
          >
            <BookOpen className="w-5 h-5 text-amber-300 shrink-0" />
            <div className="flex flex-col min-w-0 text-right">
              <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm leading-tight truncate">
                <span>سوره {currentSurah.nameArabic}</span>
                <span className="text-[10px] sm:text-xs px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 font-normal shrink-0">
                  {currentSurah.versesCount} آیه
                </span>
              </div>
              <span className="text-[10px] sm:text-[11px] opacity-80 leading-none mt-0.5 truncate">
                جزء {currentSurah.juzNumber} • {currentSurah.revelationType === 'Meccan' ? 'مکی' : 'مدنی'}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 opacity-70 shrink-0 mr-0.5" />
          </button>

          {/* سوئیچ سریع نما (نمایهٔ صفحه‌ای / نمای آیه‌ای) */}
          <button
            id="btn-header-viewmode-toggle"
            onClick={onToggleViewMode}
            className={`flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl font-bold text-xs transition-all border ${
              viewMode === 'mushaf-page'
                ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-sm'
                : 'bg-white/10 hover:bg-white/15 text-white/90 border-white/10'
            }`}
            title={
              viewMode === 'mushaf-page'
                ? 'نمای فعلی: صفحه‌ای (کلیک جهت نمای آیه‌ای)'
                : 'نمای فعلی: آیه‌ای (کلیک جهت صفحه‌ای)'
            }
          >
            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="hidden sm:inline">
              {viewMode === 'mushaf-page' ? 'نمایهٔ صفحه‌ای' : 'نمای آیه‌ای'}
            </span>
          </button>
        </div>

        {/* چپ: ابزارهای اصلی و منوی دسته‌بندی‌شده «امکانات» بدون اسکرول افقی */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0" ref={menuRef}>
          {/* دکمه جستجو */}
          <button
            id="btn-header-search"
            onClick={onOpenSearch}
            className="p-2 rounded-xl hover:bg-white/10 text-white/90 transition-colors"
            title="جستجو در قرآن کریم"
          >
            <Search className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* دکمه هوش مصنوعی تدبّر (برجسته و دسترسی مستقیم) */}
          <button
            id="btn-header-ai-assistant"
            onClick={onOpenAI}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-linear-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-bold text-xs shadow-md transition-all active:scale-95"
            title="دستیار هوشمند تدبّر و هدایت قرآنی"
          >
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-950" />
            <span className="hidden xs:inline sm:inline">تدبّر</span>
          </button>

          {/* تغییر حالت تاریک/روشن سریع */}
          <button
            id="btn-header-theme"
            onClick={onToggleDarkMode}
            className="p-2 rounded-xl hover:bg-white/10 text-white/90 transition-colors"
            title={darkMode ? 'حالت روز' : 'حالت شب'}
          >
            {darkMode ? <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>

          {/* کلید باز کردن منوی دسته‌بندی‌شده امکانات و ابزارها */}
          <div className="relative">
            <button
              id="btn-header-tools-menu"
              onClick={() => setIsToolsMenuOpen(!isToolsMenuOpen)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                isToolsMenuOpen
                  ? 'bg-white text-teal-900 border-white shadow-md'
                  : 'bg-white/10 hover:bg-white/15 text-white border-white/15'
              }`}
              title="امکانات و ابزارهای قرآنی"
            >
              <LayoutGrid className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">امکانات</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${isToolsMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* دراپ‌داون دسته‌بندی‌شده و مرتب امکانات */}
            {isToolsMenuOpen && (
              <div
                id="header-tools-dropdown"
                className={`absolute left-0 top-full mt-2 w-72 sm:w-80 rounded-2xl shadow-2xl border p-3 z-50 animate-fadeIn ${
                  darkMode
                    ? 'bg-slate-900 border-slate-700 text-slate-100 shadow-black/60'
                    : 'bg-white border-stone-200 text-slate-800 shadow-slate-400/30'
                }`}
                dir="rtl"
              >
                {/* سربرگ دراپ‌داون */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-teal-700 dark:text-teal-400">
                    <LayoutGrid className="w-4 h-4" />
                    <span>دسته‌بندی امکانات و ابزارها</span>
                  </div>
                  <button
                    onClick={() => setIsToolsMenuOpen(false)}
                    className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-slate-800 text-slate-400"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* دسته اول: قرائت و مطالعه مصحف */}
                <div className="space-y-1 mb-2.5">
                  <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 px-1 mb-1">
                    مطالعه و قرائت
                  </div>

                  {/* سوئیچ نما */}
                  <button
                    onClick={() => {
                      onToggleViewMode();
                      setIsToolsMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition-colors ${
                      darkMode ? 'hover:bg-slate-800' : 'hover:bg-stone-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">حالت نمایش قرآن</div>
                        <div className="text-[10px] text-slate-400">
                          {viewMode === 'mushaf-page' ? 'مصحف عثمان طه (۶۰۴ ص)' : 'نمای آیه‌ای روان'}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                      تغییر
                    </span>
                  </button>

                  {/* اسکرول خودکار */}
                  <button
                    onClick={() => {
                      onToggleAutoScroll();
                      setIsToolsMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition-colors ${
                      darkMode ? 'hover:bg-slate-800' : 'hover:bg-stone-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${isAutoScrollActive ? 'bg-amber-500/20 text-amber-500' : 'bg-slate-500/10 text-slate-500'}`}>
                        <ChevronsDown className="w-4 h-4" />
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">اسکرول خودکار صفحه</div>
                        <div className="text-[10px] text-slate-400">مطالعه پیوسته بدون لمس صفحه</div>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      isAutoScrollActive
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-stone-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}>
                      {isAutoScrollActive ? 'فعال' : 'غیرفعال'}
                    </span>
                  </button>

                  {/* نشانه‌ها و بوکمارک‌ها */}
                  <button
                    onClick={() => {
                      onOpenBookmarks();
                      setIsToolsMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition-colors ${
                      darkMode ? 'hover:bg-slate-800' : 'hover:bg-stone-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <Bookmark className="w-4 h-4" />
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">نشانه‌ها و آیات منتخب</div>
                        <div className="text-[10px] text-slate-400">آیات نشان‌شده و سابقه قرائت</div>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400">مشاهده</span>
                  </button>
                </div>

                {/* دسته دوم: برنامه‌ریزی و معارف */}
                <div className="space-y-1 mb-2.5 pt-2 border-t border-stone-100 dark:border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 px-1 mb-1">
                    برنامه‌ریزی و معارف
                  </div>

                  {/* ختم قرآن */}
                  <button
                    onClick={() => {
                      onOpenKhatm();
                      setIsToolsMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition-colors ${
                      darkMode ? 'hover:bg-slate-800' : 'hover:bg-stone-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">برنامه‌ریزی ختم قرآن</div>
                        <div className="text-[10px] text-slate-400">محاسبه روزانه صفحات و پیگیری پیشرفت</div>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400">تقویم</span>
                  </button>

                  {/* حالت حفظ */}
                  <button
                    onClick={() => {
                      onOpenMemorization();
                      setIsToolsMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition-colors ${
                      darkMode ? 'hover:bg-slate-800' : 'hover:bg-stone-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
                        <GraduationCap className="w-4 h-4" />
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">حالت حفظ</div>
                        <div className="text-[10px] text-slate-400">بازهٔ انتخابی، تکرار و خودآزمایی</div>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400">شروع</span>
                  </button>

                  {/* دستیار هوشمند تدبّر */}
                  <button
                    onClick={() => {
                      onOpenAI();
                      setIsToolsMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition-colors ${
                      darkMode ? 'hover:bg-slate-800' : 'hover:bg-stone-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-amber-400/20 text-amber-600 dark:text-amber-400">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">دستیار هوشمند تدبّر</div>
                        <div className="text-[10px] text-slate-400">پاسخ مستند با ارجاع به آیات محلی</div>
                      </div>
                    </div>
                  </button>
                </div>

                {/* دسته سوم: تنظیمات و پایگاه داده */}
                <div className="space-y-1 pt-2 border-t border-stone-100 dark:border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 px-1 mb-1">
                    تنظیمات و حافظه آفلاین
                  </div>

                  {/* مدیریت دانلود و آفلاین */}
                  <button
                    onClick={() => {
                      onOpenOffline();
                      setIsToolsMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition-colors ${
                      darkMode ? 'hover:bg-slate-800' : 'hover:bg-stone-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <DownloadCloud className="w-4 h-4" />
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">مدیریت دانلود و آفلاین</div>
                        <div className="text-[10px] text-slate-400">دیتابیس سوره‌ها و ذخیره‌سازی محلی</div>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400">مدیریت</span>
                  </button>

                  {/* تنظیمات قلم و ترجمه */}
                  <button
                    onClick={() => {
                      onOpenSettings();
                      setIsToolsMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition-colors ${
                      darkMode ? 'hover:bg-slate-800' : 'hover:bg-stone-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                        <Settings className="w-4 h-4" />
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">تنظیمات قلم و مطالعه</div>
                        <div className="text-[10px] text-slate-400">اندازه فونت، نوع خط، انتخاب مترجمین</div>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400">تنظیم</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

