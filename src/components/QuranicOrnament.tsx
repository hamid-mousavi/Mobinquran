import React from 'react';
import { toPersianDigits } from '../utils/textNormalization';

/**
 * گوشه‌های سنتی اسلیمی و تذهیب برای کادرهای قرآنی
 */
export const QuranicCorner: React.FC<{
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  className?: string;
}> = ({ position, className = 'text-amber-600/70 dark:text-amber-400/60' }) => {
  const rotationClass =
    position === 'top-right'
      ? ''
      : position === 'top-left'
      ? 'rotate-90'
      : position === 'bottom-left'
      ? 'rotate-180'
      : '-rotate-90';

  const positionClass =
    position === 'top-right'
      ? 'top-1.5 right-1.5'
      : position === 'top-left'
      ? 'top-1.5 left-1.5'
      : position === 'bottom-left'
      ? 'bottom-1.5 left-1.5'
      : 'bottom-1.5 right-1.5';

  return (
    <div className={`absolute ${positionClass} ${rotationClass} pointer-events-none select-none z-10 ${className}`}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M2 22V7C2 4.23858 4.23858 2 7 2H22"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M6 18V9C6 7.34315 7.34315 6 9 6H18"
          stroke="currentColor"
          strokeWidth="0.8"
          strokeDasharray="1.5 1.5"
        />
        <circle cx="2.5" cy="21.5" r="1.5" fill="currentColor" />
        <circle cx="21.5" cy="2.5" r="1.5" fill="currentColor" />
        <path d="M7 7 L10 4 L10 10 Z" fill="currentColor" opacity="0.6" />
      </svg>
    </div>
  );
};

/**
 * کادر قرآنی تمیز، آرامش‌بخش و خوانا با طراحی مینیمال مدرن
 */
export const QuranicCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  darkMode?: boolean;
  highlighted?: boolean;
  showCorners?: boolean;
  onClick?: () => void;
  id?: string;
}> = ({
  children,
  className = '',
  contentClassName = '',
  darkMode = false,
  highlighted = false,
  showCorners = false,
  onClick,
  id,
}) => {
  return (
    <div
      id={id}
      onClick={onClick}
      className={`relative rounded-2xl p-4 sm:p-5 transition-all duration-200 border ${
        highlighted
          ? darkMode
            ? 'bg-slate-900/90 border-teal-500/30 shadow-md shadow-black/20'
            : 'bg-white border-teal-600/30 shadow-sm shadow-teal-900/5'
          : darkMode
          ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700 shadow-xs'
          : 'bg-white border-stone-200/90 hover:border-stone-300 shadow-xs'
      } ${onClick ? 'cursor-pointer active:scale-[0.99]' : ''} ${className}`}
    >
      {showCorners && (
        <>
          <QuranicCorner position="top-right" className="opacity-40" />
          <QuranicCorner position="top-left" className="opacity-40" />
          <QuranicCorner position="bottom-right" className="opacity-40" />
          <QuranicCorner position="bottom-left" className="opacity-40" />
        </>
      )}

      {/* محتوای داخلی کادر */}
      <div className={`relative z-10 ${contentClassName}`}>{children}</div>
    </div>
  );
};

/** خط تزیینی ظریف با لوزی میانی؛ دو سر به تدریج محو می‌شوند */
const OrnamentRule: React.FC = () => (
  <div className="flex items-center gap-2" aria-hidden="true">
    <span className="h-px flex-1 bg-gradient-to-l from-transparent to-amber-700/45 dark:to-amber-400/45" />
    <span className="w-1.5 h-1.5 rotate-45 bg-amber-600/70 dark:bg-amber-400/70" />
    <span className="h-px flex-1 bg-gradient-to-r from-transparent to-amber-700/45 dark:to-amber-400/45" />
  </div>
);

const SURAH_NAME_FONT = "'Amiri', 'Amiri Quran', serif";

/**
 * کتیبهٔ سرسوره — طراحی ساده و بی‌قاب:
 *  - variant="mushaf": نوار فشردهٔ تک‌خطی داخل صفحهٔ مصحف (شمارهٔ سوره | نام | تعداد آیات)
 *  - variant="reader": سرسورهٔ خوانا برای نمای آیه‌به‌آیه (نام درشت + یک خط اطلاعات)
 * فقط دو خط ظریف بالا و پایین؛ بدون قاب، گوشه‌های تزئینی یا چیپ‌های رنگی.
 */
export const QuranicSurahBanner: React.FC<{
  surah: {
    id: number;
    nameArabic: string;
    versesCount: number;
    revelationType?: 'Meccan' | 'Medinan';
    namePersian?: string;
  };
  darkMode: boolean;
  className?: string;
  variant?: 'reader' | 'mushaf';
}> = ({ surah, className = '', variant = 'reader' }) => {
  const title = `سُورَةُ ${surah.nameArabic}`;
  const versesText = `${toPersianDigits(surah.versesCount)} آیه`;
  const numText = `سورهٔ ${toPersianDigits(surah.id)}`;
  const place = surah.revelationType ? (surah.revelationType === 'Meccan' ? 'مکی' : 'مدنی') : null;

  if (variant === 'mushaf') {
    return (
      <div id="surah-compact-quranic-header" className={`select-none ${className}`} dir="rtl">
        <OrnamentRule />
        <div className="flex items-center justify-between gap-2 px-1 py-0.5">
          <span className="shrink-0 min-w-[3.5rem] text-right text-[11px] font-semibold text-amber-800/80 dark:text-amber-300/80">
            {numText}
          </span>
          <h1
            className="flex-1 min-w-0 truncate text-center text-lg sm:text-xl font-bold leading-normal text-amber-800 dark:text-amber-300"
            style={{ fontFamily: SURAH_NAME_FONT }}
          >
            {title}
          </h1>
          <span className="shrink-0 min-w-[3.5rem] text-left text-[11px] font-semibold text-amber-800/80 dark:text-amber-300/80">
            {versesText}
          </span>
        </div>
        <OrnamentRule />
      </div>
    );
  }

  const meta = [numText, place, versesText].filter(Boolean).join(' • ');
  return (
    <header id="surah-compact-quranic-header" className={`select-none py-2 space-y-2 text-center ${className}`} dir="rtl">
      <OrnamentRule />
      <div className="space-y-0.5">
        <h1
          className="text-2xl sm:text-3xl font-bold leading-relaxed text-amber-800 dark:text-amber-300"
          style={{ fontFamily: SURAH_NAME_FONT }}
        >
          {title}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {surah.namePersian ? `${surah.namePersian} • ` : ''}
          {meta}
        </p>
      </div>
      <OrnamentRule />
    </header>
  );
};

/**
 * نشان و لوگوی قرآنی اختصاصی قرآن مبین (نسخه بدون حاشیه سفید و با وضوح بالا)
 */
export const QuranLogo: React.FC<{
  size?: 'sm' | 'md' | 'lg' | 'xl';
  darkMode?: boolean;
}> = ({ size = 'md', darkMode = false }) => {
  const dimensions =
    size === 'sm'
      ? 'w-10 h-10'
      : size === 'lg'
      ? 'w-16 h-16 sm:w-20 sm:h-20'
      : size === 'xl'
      ? 'w-24 h-24 sm:w-28 sm:h-28'
      : 'w-12 h-12 sm:w-14 sm:h-14';

  return (
    <div className="inline-flex items-center justify-center select-none" dir="rtl">
      <div className="relative group">
        <div className="absolute -inset-1 rounded-2xl bg-teal-500/20 dark:bg-teal-400/20 blur-xs opacity-75 group-hover:opacity-100 transition-opacity" />
        <img
          src="/quran-logo-cropped.png"
          alt="قرآن مبین"
          className={`relative ${dimensions} object-contain rounded-2xl shadow-md border border-teal-500/30 dark:border-teal-400/30 transition-transform group-hover:scale-105 active:scale-95`}
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  );
};
