import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { MushafPageData, MushafWord } from '../types/mushafLayout';
import type { ArabicFont } from '../types';
import { getArabicFontFamily } from '../utils/fontHelper';

interface Props {
  pages: MushafPageData[];
  darkMode: boolean;
  arabicFont: ArabicFont;
  arabicFontSize: number;
}

const END_NUM_RE = /^V(\d+)$/;
const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

function toArabicNumber(n: string | number): string {
  return String(n)
    .split('')
    .map((c) => (c >= '0' && c <= '9' ? ARABIC_DIGITS[Number(c)] : c))
    .join('');
}

function MushafWordView({ word }: { word: MushafWord }) {
  if (word.type === 'surah_header') {
    return (
      <span className="inline-block px-2 font-['UthmanTaha'] text-amber-800 dark:text-amber-300">
        {word.text}
      </span>
    );
  }
  if (word.type === 'bismillah') {
    return <span className="inline-block px-2">{word.text}</span>;
  }
  if (word.type === 'quarter') {
    return <span className="inline-block px-2 text-teal-700 dark:text-teal-400">۞</span>;
  }
  const endMatch = END_NUM_RE.exec(word.text || '');
  if (word.type === 'end' && endMatch) {
    return (
      <span className="inline-block select-none text-teal-800 dark:text-teal-300 mx-1 leading-none align-middle">
        <span className="text-[0.7em]">۝</span>
        <span className="text-[0.6em]">{toArabicNumber(endMatch[1])}</span>
      </span>
    );
  }
  return <span className="inline-block px-1">{word.text}</span>;
}

export default function MushafPrototype({
  pages,
  darkMode,
  arabicFont,
  arabicFontSize,
}: Props) {
  const [index, setIndex] = useState(0);
  const [fontFamily, setFontFamily] = useState('');

  useEffect(() => {
    setFontFamily(getArabicFontFamily(arabicFont));
  }, [arabicFont]);

  const page = pages[index];
  if (!page) return <p className="p-4">داده‌ای موجود نیست.</p>;

  return (
    <div className="mx-auto max-w-3xl px-3 py-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-bold text-white/90 disabled:opacity-40"
        >
          <ChevronRight className="w-4 h-4" /> قبل
        </button>
        <span className="text-sm font-bold text-white/90">
          پروتوتایپ چیدمان ۱۵ خطی — صفحهٔ {page.page} از ۶۰۴
        </span>
        <button
          onClick={() => setIndex((i) => Math.min(pages.length - 1, i + 1))}
          disabled={index === pages.length - 1}
          className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-bold text-white/90 disabled:opacity-40"
        >
          بعد <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      <div
        dir="rtl"
        className={`relative rounded-3xl border-2 p-5 sm:p-8 shadow-md transition-colors ${
          darkMode
            ? 'bg-slate-900 border-amber-500/20'
            : 'bg-[#fcfaf6] border-[#d4b982]/60'
        }`}
      >
        {/* حاشیه تذهیب ساده */}
        <div className="pointer-events-none absolute inset-2 rounded-2xl border border-amber-500/20" />

        <div className="space-y-3">
          {page.lines.map((line) => (
            <div
              key={line.line}
              className="flex justify-between text-justify leading-[2.1]"
              style={{ fontFamily, fontSize: `${arabicFontSize}px` }}
            >
              <div className="flex-[0_0_auto] w-6 text-center text-xs font-bold text-amber-600/70 dark:text-amber-400/50 flex items-center">
                {toArabicNumber(line.line)}
              </div>
              <div className="flex-1 text-right">
                {line.words.map((w, wi) => (
                  <MushafWordView key={wi} word={w} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 text-center text-[11px] text-white/50">
        دادهٔ چیدمان: quran-qcf4 (QCF v4، مصحف مدینهٔ ۱۴۴۱) — مجوز MIT؛ رندر با فونت
        خودمیزبان {arabicFont}
      </p>
    </div>
  );
}