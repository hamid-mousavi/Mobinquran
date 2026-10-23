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

const SURAH_NAME_FONT = "'Amiri Quran', 'Amiri', 'UthmanTaha', serif";

/** نسبت عرض هر سر کتیبه به ارتفاعش (از تصویر اصلی: ۳۳۲ × ۴۵۴) */
const CARTOUCHE_END_RATIO = 332 / 454;

/**
 * کتیبهٔ تذهیب‌شدهٔ نام سوره (مثل مصحف چاپی): سه تکه تصویر — دو سر (اسلیمی) و تکهٔ میانی که تکرار می‌شود —
 * تا در هر عرضی بدون کشیدگی بنشیند. نام سوره روی بخش خالی وسط نوشته می‌شود.
 */
const SurahCartouche: React.FC<{ title: string; dark: boolean; height: number }> = ({ title, dark, height }) => {
  const endW = Math.round(height * CARTOUCHE_END_RATIO);
  const filter = dark ? 'invert(0.9) hue-rotate(180deg)' : undefined;
  const layer = (file: string, extra: React.CSSProperties): React.CSSProperties => ({
    height: '100%',
    backgroundImage: `url(/ornaments/${file})`,
    filter,
    ...extra,
  });
  return (
    <div dir="ltr" className="relative w-full select-none" style={{ height }}>
      <div className="flex h-full" aria-hidden="true">
        <div style={layer('surah-left.webp', { width: endW, backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat' })} />
        <div style={layer('surah-mid.webp', { flex: '1 1 0', minWidth: 0, backgroundSize: 'auto 100%', backgroundRepeat: 'repeat-x' })} />
        <div style={layer('surah-right.webp', { width: endW, backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat' })} />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <h1
          dir="rtl"
          className="font-bold whitespace-nowrap"
          style={{
            fontFamily: SURAH_NAME_FONT,
            fontSize: Math.round(height * 0.36),
            lineHeight: 1.6,
            paddingBottom: '0.1em',
            color: dark ? '#fcd34d' : '#0f4c47',
          }}
        >
          {title}
        </h1>
      </div>
    </div>
  );
};

/**
 * کتیبهٔ سرسوره — کادر تذهیب مثل مصحف چاپی:
 *  - variant="mushaf": کتیبه با ارتفاع سطر مصحف (داخل صفحهٔ ۱۵ سطری)
 *  - variant="reader": کتیبهٔ بزرگ‌تر برای نمای آیه‌به‌آیه + یک خط اطلاعات زیرش
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
  /** ارتفاع کتیبه (px)؛ در مصحف برابر ارتفاع سطر */
  height?: number;
}> = ({ surah, darkMode, className = '', variant = 'reader', height }) => {
  const title = `سُورَةُ ${surah.nameArabic}`;
  const versesText = `${toPersianDigits(surah.versesCount)} آیه`;
  const numText = `سورهٔ ${toPersianDigits(surah.id)}`;
  const place = surah.revelationType ? (surah.revelationType === 'Meccan' ? 'مکی' : 'مدنی') : null;

  if (variant === 'mushaf') {
    return (
      <div id="surah-compact-quranic-header" className={`w-full select-none ${className}`}>
        <SurahCartouche title={title} dark={darkMode} height={height ?? 64} />
      </div>
    );
  }

  const meta = [numText, place, versesText].filter(Boolean).join(' • ');
  return (
    <header id="surah-compact-quranic-header" className={`select-none py-2 space-y-1.5 text-center ${className}`} dir="rtl">
      <div className="max-w-md mx-auto">
        <SurahCartouche title={title} dark={darkMode} height={height ?? 84} />
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {surah.namePersian ? `${surah.namePersian} • ` : ''}
        {meta}
      </p>
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
