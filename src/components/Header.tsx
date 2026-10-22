import React, { useEffect, useState } from 'react';
import { Search, ChevronDown, ChevronsDown, Menu } from 'lucide-react';
import { Surah, ViewMode } from '../types';
import { toPersianDigits } from '../utils/textNormalization';
import { StarBadge } from './StarBadge';

interface HeaderProps {
  currentSurah: Surah;
  viewMode: ViewMode;
  onToggleViewMode: () => void;
  onOpenSurahList: () => void;
  onOpenSurahSearch: () => void;
  darkMode: boolean;
  onToggleDarkMode?: () => void;
  isAutoScrollActive: boolean;
  onToggleAutoScroll: () => void;
  onOpenSettings?: () => void;
  onToggleHomeView?: () => void;
  onOpenMenu?: () => void;
}

const QURAN_FONT = "'Amiri Quran', 'UthmanTaha', serif";
const iconBtn =
  'w-11 h-11 shrink-0 flex items-center justify-center rounded-xl border border-amber-300/70 dark:border-slate-700 bg-stone-50 dark:bg-slate-900 text-teal-700 dark:text-teal-300 hover:bg-stone-100 dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer';

/**
 * هدر سبک قرائت: منو، چیپ انتخاب سوره، Aa، جستجو و سوییچ «مصحف | آیه‌به‌آیه».
 * هنگام اسکرول به پایین مخفی و با اسکرول به بالا دوباره نمایان می‌شود.
 */
export const Header: React.FC<HeaderProps> = ({
  currentSurah,
  viewMode,
  onToggleViewMode,
  onOpenSurahList,
  onOpenSurahSearch,
  isAutoScrollActive,
  onToggleAutoScroll,
  onOpenSettings,
  onOpenMenu,
}) => {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - last;
      if (Math.abs(delta) < 8) return;
      setHidden(delta > 0 && y > 96);
      last = y;
    };
    const onShowHeader = () => setHidden(false);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('mobin-show-header', onShowHeader);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('mobin-show-header', onShowHeader);
    };
  }, []);

  const isMushaf = viewMode === 'mushaf-page';
  const segBase = 'flex-1 min-h-[40px] rounded-xl text-[13px] font-bold transition-colors cursor-pointer';
  const segOn = 'bg-teal-800 text-white font-extrabold';
  const segOff = 'text-slate-600 dark:text-slate-300';

  return (
    <>
      {/* نشانگر کوچک حالت خلوت قرآنی هنگام اسکرول به پایین */}
      {hidden && (
        <button
          onClick={() => setHidden(false)}
          className="fixed top-2.5 left-1/2 -translate-x-1/2 z-40 px-3.5 py-1.5 rounded-full bg-teal-900/90 hover:bg-teal-900 text-amber-300 text-xs font-bold shadow-lg backdrop-blur-md border border-amber-400/50 animate-fadeIn flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
          title="لمس جهت نمایش نوار ابزار و امکانات"
          aria-label="نمایش نوار ابزار و عنوان سوره"
        >
          <ChevronDown className="w-3.5 h-3.5" />
          <span>سوره {currentSurah.nameArabic}</span>
        </button>
      )}

      <header
        id="app-main-header"
        className={`sticky top-0 z-40 border-b border-amber-300/60 dark:border-slate-800 bg-stone-50/95 dark:bg-slate-950/95 backdrop-blur-md select-none transition-transform duration-200 ${
          hidden ? '-translate-y-full' : 'translate-y-0'
        }`}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
      <div className="max-w-4xl mx-auto px-3 sm:px-4 pt-3 pb-2.5 space-y-2.5">
        <div className="flex items-center gap-2">
          {onOpenMenu && (
            <button id="btn-header-menu" onClick={onOpenMenu} className={iconBtn} title="منو" aria-label="باز کردن منو">
              <Menu className="w-5 h-5" />
            </button>
          )}

          <button
            id="btn-open-surah-selector"
            onClick={onOpenSurahList}
            className="flex-1 min-w-0 min-h-[52px] flex items-center gap-2.5 px-3 rounded-2xl border border-amber-300/70 dark:border-slate-700 bg-stone-50 dark:bg-slate-900 text-right cursor-pointer active:scale-[0.99] transition-all"
            title="انتخاب سوره و جزء"
          >
            <StarBadge size={32}>{toPersianDigits(currentSurah.id)}</StarBadge>
            <span className="min-w-0 flex-1">
              <span
                className="block text-[19px] leading-[1.4] text-slate-900 dark:text-slate-50 truncate"
                style={{ fontFamily: QURAN_FONT }}
              >
                {currentSurah.nameArabic}
              </span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">
                جزء {toPersianDigits(currentSurah.juzNumber)} · {currentSurah.revelationType === 'Meccan' ? 'مکی' : 'مدنی'} ·{' '}
                {toPersianDigits(currentSurah.versesCount)} آیه
              </span>
            </span>
            <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
          </button>

          {onOpenSettings && (
            <button
              id="btn-header-settings-toggle"
              onClick={onOpenSettings}
              className={`${iconBtn} text-[15px] font-extrabold`}
              title="اندازه و ظاهر متن"
              aria-label="اندازه و ظاهر متن"
            >
              Aa
            </button>
          )}

          <button
            id="btn-header-surah-search"
            onClick={onOpenSurahSearch}
            className={iconBtn}
            title={`جستجو در سورهٔ ${currentSurah.nameArabic}`}
            aria-label="جستجو در سوره"
          >
            <Search className="w-5 h-5" />
          </button>

          {!isMushaf && (
            <button
              id="btn-header-autoscroll-toggle"
              onClick={onToggleAutoScroll}
              aria-pressed={isAutoScrollActive}
              className={`${iconBtn} ${isAutoScrollActive ? '!bg-amber-300 !text-teal-900 !border-amber-400' : ''}`}
              title={isAutoScrollActive ? 'توقف اسکرول خودکار' : 'مطالعه پیوسته با اسکرول خودکار'}
              aria-label="اسکرول خودکار"
            >
              <ChevronsDown className="w-5 h-5" />
            </button>
          )}
        </div>

        <div role="tablist" aria-label="نحوه نمایش" className="flex p-1 gap-1 rounded-2xl bg-stone-200/70 dark:bg-slate-800">
          <button
            role="tab"
            aria-selected={isMushaf}
            onClick={() => !isMushaf && onToggleViewMode()}
            className={`${segBase} ${isMushaf ? segOn : segOff}`}
          >
            مصحف
          </button>
          <button
            role="tab"
            aria-selected={!isMushaf}
            onClick={() => isMushaf && onToggleViewMode()}
            className={`${segBase} ${!isMushaf ? segOn : segOff}`}
          >
            آیه‌به‌آیه + ترجمه
          </button>
        </div>
      </div>
    </header>
    </>
  );
};
