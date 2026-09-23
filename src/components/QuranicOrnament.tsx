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
 * کادر قرآنی با نقوش تذهیب سنتی و حاشیه ظریف اسلامی
 */
export const QuranicCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  darkMode?: boolean;
  highlighted?: boolean;
  onClick?: () => void;
  id?: string;
}> = ({ children, className = '', darkMode = false, highlighted = false, onClick, id }) => {
  return (
    <div
      id={id}
      onClick={onClick}
      className={`relative rounded-3xl p-5 sm:p-6 transition-all duration-300 border-2 overflow-hidden ${
        highlighted
          ? darkMode
            ? 'bg-teal-950/40 border-amber-500/80 ring-2 ring-amber-500/30 shadow-lg shadow-teal-950/50'
            : 'bg-amber-50/80 border-amber-600/70 ring-2 ring-amber-500/25 shadow-lg shadow-amber-900/10'
          : darkMode
          ? 'bg-slate-900/85 border-amber-500/30 hover:border-amber-500/50 shadow-md shadow-slate-950/60'
          : 'bg-white/95 border-amber-700/25 hover:border-amber-600/40 shadow-sm shadow-stone-200'
      } ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {/* حاشیه خط‌چین ظریف داخلی شبیه کتب نفیس خطی */}
      <div className="absolute inset-1 rounded-2xl border border-dashed border-amber-600/20 dark:border-amber-400/20 pointer-events-none" />

      {/* گوشه‌های اسلیمی چهارگانه */}
      <QuranicCorner position="top-right" />
      <QuranicCorner position="top-left" />
      <QuranicCorner position="bottom-right" />
      <QuranicCorner position="bottom-left" />

      {/* محتوای داخلی کادر */}
      <div className="relative z-10">{children}</div>
    </div>
  );
};

/**
 * کتیبه فشرده و فاخر سرسوره قرآنی:
 * وسط: اسم سوره
 * چپ: تعداد آیات
 * راست: شماره سوره
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
}> = ({ surah, darkMode, className = '' }) => {
  const isMeccan = surah.revelationType === 'Meccan';
  const versesText = `${toPersianDigits(surah.versesCount)} آیه`;
  const surahNumText = `سوره ${toPersianDigits(surah.id)}`;

  return (
    <div
      id="surah-compact-quranic-header"
      className={`relative overflow-hidden rounded-2xl px-3 sm:px-5 py-2 sm:py-2.5 border-2 shadow-sm transition-all select-none ${
        darkMode
          ? 'bg-gradient-to-r from-slate-900 via-amber-950/20 to-slate-900 border-amber-500/50 text-slate-100 shadow-teal-950/20'
          : 'bg-gradient-to-r from-amber-50/80 via-white to-amber-50/80 border-amber-600/40 text-slate-900 shadow-amber-900/5'
      } ${className}`}
      dir="rtl"
    >
      {/* قاب ظریف تذهیب قرآنی داخلی */}
      <div className="absolute inset-1 rounded-xl border border-dashed border-amber-500/30 pointer-events-none" />

      {/* گوشه‌های اسلیمی سنتی سرسوره */}
      <div className="absolute top-1.5 right-1.5 w-3 h-3 border-t-2 border-r-2 border-amber-500/70 pointer-events-none" />
      <div className="absolute top-1.5 left-1.5 w-3 h-3 border-t-2 border-l-2 border-amber-500/70 pointer-events-none" />
      <div className="absolute bottom-1.5 right-1.5 w-3 h-3 border-b-2 border-r-2 border-amber-500/70 pointer-events-none" />
      <div className="absolute bottom-1.5 left-1.5 w-3 h-3 border-b-2 border-l-2 border-amber-500/70 pointer-events-none" />

      <div className="relative z-10 flex items-center justify-between gap-2 max-w-2xl mx-auto">
        {/* سمت راست: شماره سوره */}
        <div className="flex items-center gap-1.5 text-right shrink-0">
          <div className="px-2.5 py-0.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 font-bold text-xs sm:text-sm shadow-2xs">
            {surahNumText}
          </div>
          {surah.revelationType && (
            <span className="hidden sm:inline-block text-[11px] text-slate-400 font-medium">
              ({isMeccan ? 'مکی' : 'مدنی'})
            </span>
          )}
        </div>

        {/* وسط: نام سوره با خط عثمان طه / امیری */}
        <div className="flex items-center justify-center gap-2 text-center flex-1 min-w-0">
          <span className="hidden xs:inline-block w-4 sm:w-8 h-px bg-gradient-to-r from-transparent to-amber-500/70" />
          <h1
            className="text-lg sm:text-2xl font-bold text-amber-700 dark:text-amber-300 drop-shadow-2xs tracking-tight truncate leading-normal"
            style={{ fontFamily: "'Amiri', 'Amiri Quran', serif" }}
          >
            سُورَةُ {surah.nameArabic}
          </h1>
          <span className="hidden xs:inline-block w-4 sm:w-8 h-px bg-gradient-to-l from-transparent to-amber-500/70" />
        </div>

        {/* سمت چپ: تعداد آیات */}
        <div className="flex items-center gap-1.5 text-left shrink-0">
          <div className="px-2.5 py-0.5 rounded-xl bg-teal-600/15 border border-teal-600/30 text-teal-700 dark:text-teal-300 font-bold text-xs sm:text-sm shadow-2xs">
            {versesText}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * نشان و لوگوی قرآنی اختصاصی قرآن مبین
 */
export const QuranLogo: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  darkMode?: boolean;
}> = ({ size = 'md', darkMode = false }) => {
  const iconSize = size === 'sm' ? 24 : size === 'lg' ? 44 : 32;

  return (
    <div className="inline-flex items-center gap-2 select-none" dir="rtl">
      <div className="relative flex items-center justify-center">
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="shrink-0 drop-shadow-xs"
        >
          {/* ستاره ۸ پر اسلامی (شمس تذهیب) */}
          <rect
            x="7"
            y="7"
            width="34"
            height="34"
            rx="5"
            transform="rotate(0 24 24)"
            fill={darkMode ? '#0f766e' : '#0d9488'}
            opacity="0.2"
          />
          <rect
            x="7"
            y="7"
            width="34"
            height="34"
            rx="5"
            transform="rotate(45 24 24)"
            fill="#d97706"
            opacity="0.25"
          />
          <circle cx="24" cy="24" r="18" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 2" />

          {/* رحل و کتاب مصحف شریف باز */}
          <path
            d="M24 16 L24 33 M24 16 C20 13.5 15 14 12 16 L12 31 C15 29 20 29 24 31.5 C28 29 33 29 36 31 L36 16 C33 14 28 13.5 24 16 Z"
            fill={darkMode ? '#14b8a6' : '#0f766e'}
            stroke="#fbbf24"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle cx="24" cy="24" r="2.5" fill="#fbbf24" />
        </svg>
      </div>

      <div className="flex flex-col text-right">
        <div
          className="font-bold tracking-tight text-amber-600 dark:text-amber-300 leading-tight"
          style={{
            fontFamily: "'Amiri', 'Amiri Quran', serif",
            fontSize: size === 'sm' ? '15px' : size === 'lg' ? '22px' : '18px',
          }}
        >
          قُـرآنِ مُـبـیـن
        </div>
        <span
          className={`text-slate-500 dark:text-slate-400 font-sans tracking-wide ${
            size === 'sm' ? 'text-[9px]' : 'text-[10px]'
          }`}
        >
          مصحف هوشمند و تدبّر
        </span>
      </div>
    </div>
  );
};
