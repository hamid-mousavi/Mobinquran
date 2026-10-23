import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { ChevronRight, ChevronLeft, Volume2, Sparkles, BookOpen, Bookmark, Loader2, Share2, Copy, X, Eye, EyeOff } from 'lucide-react';
import { Surah, Verse, AppSettings } from '../types';
import { getArabicFontFamily } from '../utils/fontHelper';
import { shareAyah } from '../utils/shareAyah';
import { QuranService } from '../services/quranService';
import { QuranicSurahBanner } from './QuranicOrnament';
import { AyahEndMarker } from './QuranReader';
import { toPersianDigits } from '../utils/textNormalization';
import { loadMushafPage } from '../services/mushafLayoutService';
import type { MushafPageData } from '../types/mushafLayout';
import {
  ensureQcf4Font,
  isFullyDownloaded,
  isQcf4Supported,
  loadQcf4Manifest,
  onQcf4Change,
  wasPromptDismissed,
} from '../services/qcf4FontService';
import { Qcf4DownloadSheet } from './Qcf4DownloadSheet';
import { MushafFrame, MUSHAF_FRAME_W } from './MushafFrame';
import { HizbBadge } from './HizbBadge';

interface MushafPageViewProps {
  initialPageNumber: number;
  surahs: Surah[];
  settings: AppSettings;
  darkMode: boolean;
  bookmarkedVerseIds: Set<number>;
  onToggleBookmark: (verseNumber: number) => void;
  onOpenVerseDetail: (verse: Verse) => void;
  onOpenAIForVerse: (verse: Verse) => void;
  onPlayVerseAudio: (verseNumber: number, surahId?: number) => void;
  /** کلید آیه‌ی در حال پخش (مثل «2:255») برای هایلایت هماهنگ با پلیر */
  activeVerseKey?: string | null;
  onPageChange: (newPage: number, surahId?: number, verseNumber?: number) => void;
}

function getTranslationDisplay(verse: Verse, settings: AppSettings): string {
  switch (settings.activeTranslator) {
    case 'fooladvand':
      return verse.translationFooladvand || verse.translationMakarem || '';
    case 'ansarian':
      return verse.translationAnsarian || verse.translationMakarem || '';
    case 'makarem':
    default:
      return verse.translationMakarem || verse.translationFooladvand || '';
  }
}

const PAGE_LINES = 15;
const TOTAL_PAGES = 604;
/** فاصلهٔ متن از لبهٔ صفحه = پهنای قاب + کمی فضای تنفس */
const PAGE_PAD = MUSHAF_FRAME_W + 3;
/** ارتفاع سطر سرسوره نسبت به سطر عادی */
const HEADER_WEIGHT = 1.7;

interface MushafPageBodyProps {
  pageNumber: number;
  height: number;
  surahs: Surah[];
  settings: AppSettings;
  darkMode: boolean;
  selectedVerse: Verse | null;
  onSelectVerse: (verse: Verse | null) => void;
  activeVerseKey: string | null;
  isCurrent: boolean;
  onGlyphData: (has: boolean) => void;
}

/**
 * بدنهٔ یک صفحهٔ مصحف (۱۵ سطر). هر صفحه مستقل بارگذاری و اندازه‌گیری می‌شود
 * تا هنگام ورق زدن، صفحهٔ قبل و بعد کنار صفحهٔ جاری آماده باشند.
 */
const MushafPageBody: React.FC<MushafPageBodyProps> = ({
  pageNumber,
  height,
  surahs,
  settings,
  darkMode,
  selectedVerse,
  onSelectVerse,
  activeVerseKey,
  isCurrent,
  onGlyphData,
}) => {
  const [layoutPage, setLayoutPage] = useState<MushafPageData | null>(null);
  const [layoutLoaded, setLayoutLoaded] = useState(false);
  const [verses, setVerses] = useState<Verse[]>([]);
  const linesRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ fontSize: number; centered: number[]; scales: Record<number, number> }>({
    fontSize: 22,
    centered: [],
    scales: {},
  });
  // سطر سرسوره (کتیبهٔ تذهیب) کمی بلندتر از سطر معمولی است؛ بقیهٔ سطرها متناسب فشرده می‌شوند
  const headerCount = layoutPage ? layoutPage.lines.filter((l) => l.words[0]?.type === 'surah_header').length : 0;
  const units = Math.max(PAGE_LINES, (layoutPage?.lines.length ?? PAGE_LINES) + headerCount * (HEADER_WEIGHT - 1));
  const rowH = Math.max(18, height / units);
  const headH = rowH * HEADER_WEIGHT;

  useEffect(() => {
    let cancelled = false;
    setLayoutPage(null);
    setLayoutLoaded(false);
    loadMushafPage(pageNumber).then((page) => {
      if (cancelled) return;
      setLayoutPage(page);
      setLayoutLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [pageNumber]);

  useEffect(() => {
    let cancelled = false;
    QuranService.getVersesByPage(pageNumber).then((v) => {
      if (!cancelled) setVerses(v);
    });
    return () => {
      cancelled = true;
    };
  }, [pageNumber]);

  const [qcfReady, setQcfReady] = useState(false);
  const hasGlyphData = !!layoutPage?.lines.some((l) => l.words.some((w) => w.c && w.f));

  useEffect(() => {
    if (isCurrent) onGlyphData(hasGlyphData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCurrent, hasGlyphData]);

  // فونت‌های QCF4: رندر گلیفی فقط وقتی همه‌ی فونت‌های این صفحه آماده باشند؛ در غیر این‌صورت نمایش ساده
  useEffect(() => {
    setQcfReady(false);
    if (!layoutPage || !hasGlyphData || !isQcf4Supported()) return;
    const fonts = Array.from(
      new Set(layoutPage.lines.flatMap((l) => l.words.map((w) => w.f).filter((f): f is string => !!f)))
    );
    let cancelled = false;
    const check = async () => {
      const ok = await Promise.all(fonts.map((f) => ensureQcf4Font(f)));
      if (!cancelled) setQcfReady(ok.every(Boolean));
    };
    void check();
    const off = onQcf4Change(() => void check());
    return () => {
      cancelled = true;
      off();
    };
  }, [layoutPage, hasGlyphData]);

  // اندازهٔ فونت پایه طوری تنظیم می‌شود که پهن‌ترین سطر دقیقاً در عرض صفحه جا شود.
  // سطرهای کوتاه‌تر تا ۱۰٪ بزرگ‌تر می‌شوند و باقی‌مانده بین کلمه‌ها پخش می‌شود؛
  // فاصلهٔ بین کلمات (نه حروف) کشیده می‌شود تا اعراب و اتصال حروف هرگز به‌هم نریزد.
  useLayoutEffect(() => {
    const root = linesRef.current;
    if (!root || !layoutPage) return;
    const MAX_LINE_SCALE = 1.1;
    const measure = () => {
      const cs = getComputedStyle(root);
      const width = root.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
      if (width <= 0) return;
      const rows = Array.from(root.querySelectorAll<HTMLElement>('[data-mline="text"]'));
      if (rows.length === 0) return;
      const currentSize = parseFloat(getComputedStyle(root).fontSize) || 22;
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
      const MIN_GAP_EM = isMobile ? 0.16 : 0.28;
      const SAFETY = isMobile ? 0.97 : 0.985;
      const naturals = rows.map((row) => {
        const applied = Number(row.dataset.scale) || 1;
        const kids = Array.from(row.children) as HTMLElement[];
        const sum = kids.reduce((acc, el) => acc + el.getBoundingClientRect().width, 0) / applied;
        return sum + Math.max(0, kids.length - 1) * MIN_GAP_EM * currentSize;
      });
      const widest = Math.max(...naturals, 1);
      const next = Math.max(8.5, Math.min(36, (currentSize * width) / widest * SAFETY));
      const centered: number[] = [];
      const scales: Record<number, number> = {};
      rows.forEach((row, i) => {
        const lineNo = Number(row.dataset.line);
        if (naturals[i] < widest * 0.7) {
          centered.push(lineNo);
          scales[lineNo] = 1;
        } else {
          scales[lineNo] = Math.min(MAX_LINE_SCALE, Math.max(1, widest / naturals[i]));
        }
      });
      setFit((prev) => {
        const sameScales = Object.keys(scales).every((k) => Math.abs((prev.scales[Number(k)] ?? 1) - scales[Number(k)]) < 0.01);
        return Math.abs(prev.fontSize - next) < 0.2 && prev.centered.join() === centered.join() && sameScales
          ? prev
          : { fontSize: next, centered, scales };
      });
    };
    measure();
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(measure);
    });
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      ro.disconnect();
    };
  }, [layoutPage, settings.arabicFont, qcfReady]);

  const verseByKey = new Map<string, Verse>(verses.map((v) => [`${v.surahId}:${v.verseNumber}`, v]));

  const renderSajdaMark = (verse: Verse) => {
    if (!verse.sajda) return null;
    const isObligatory = verse.sajda.obligatory;
    return (
      <span
        className="inline-flex items-center justify-center mx-1 text-red-600 dark:text-red-400 font-bold select-none text-sm"
        title={isObligatory ? 'آیهٔ سجدهٔ واجب ✋' : 'آیهٔ سجدهٔ مستحب ✋'}
        aria-label={isObligatory ? 'آیه سجده واجب' : 'آیه سجده مستحب'}
      >
        ۩
      </span>
    );
  };

  if (!layoutLoaded) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-teal-600 dark:text-teal-400" />
      </div>
    );
  }

  if (layoutPage) {
    return (
      <div
        ref={linesRef}
        dir="rtl"
        className="w-full h-full flex flex-col justify-center overflow-hidden px-1 text-slate-800 dark:text-slate-100"
        style={{ fontFamily: getArabicFontFamily(settings.arabicFont), fontSize: `${fit.fontSize}px` }}
      >
            {layoutPage.lines.map((line, li) => {
              const first = line.words[0];
              if (first?.type === 'surah_header') {
                const meta = surahs.find((sr) => sr.id === first.sura);
                return (
                  <div key={line.line} data-mline="head" className="flex items-center w-full max-w-full overflow-hidden" style={{ fontSize: '16px', height: `${headH}px` }}>
                    <div className="w-full">{meta ? <QuranicSurahBanner surah={meta} darkMode={darkMode} variant="mushaf" height={Math.max(40, Math.round(headH) - 2)} /> : null}</div>
                  </div>
                );
              }
              if (first?.type === 'bismillah') {
                return (
                  <div
                    key={line.line}
                    data-mline="bismillah"
                    className={`text-center select-none w-full max-w-full overflow-hidden flex items-center justify-center ${darkMode ? 'text-amber-300/90' : 'text-amber-800'}`}
                    style={{ height: `${rowH}px`, lineHeight: 1.2 }}
                  >
                    {qcfReady && first.c && first.f ? (
                      <span style={{ fontFamily: `'${first.f}'` }}>{first.c}</span>
                    ) : (
                      first.text
                    )}
                  </div>
                );
              }
              const isCentered = fit.centered.includes(line.line);
              const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
              return (
                <div
                  key={line.line}
                  data-mline="text"
                  data-line={line.line}
                  data-scale={fit.scales[line.line] ?? 1}
                  className="flex items-center w-full max-w-full overflow-visible whitespace-nowrap"
                  style={{
                    fontSize: `${fit.scales[line.line] ?? 1}em`,
                    justifyContent: isCentered ? 'center' : 'space-between',
                    gap: isMobile ? '0.16em' : '0.28em',
                    lineHeight: 1.2,
                    height: `${rowH}px`,
                  }}
                >
                  {line.words.map((w, idx) => {
                    if (w.type === 'quarter') {
                      // ربعِ آغازشده = ربع آیهٔ بعد از نشانه (ممکن است در سطرهای بعدی صفحه باشد)
                      let nextKey: string | undefined;
                      for (let i = li; i < layoutPage.lines.length && !nextKey; i++) {
                        const ws = layoutPage.lines[i].words;
                        for (let j = i === li ? idx + 1 : 0; j < ws.length; j++) {
                          if (ws[j].verse) {
                            nextKey = ws[j].verse;
                            break;
                          }
                        }
                      }
                      const hq = nextKey ? verseByKey.get(nextKey)?.hizbQuarter : undefined;
                      if (hq) return <HizbBadge key={idx} hizbQuarter={hq} darkMode={darkMode} />;
                      return (
                        <span key={idx} className="text-amber-600 select-none" aria-hidden="true" style={{ fontSize: '0.7em' }}>
                          ۞
                        </span>
                      );
                    }
                    const verse = w.verse ? verseByKey.get(w.verse) : undefined;
                    const isSel = !!verse && selectedVerse?.id === verse.id;
                    const isPlaying = !!w.verse && w.verse === activeVerseKey;
                    const hit = {
                      onClick: verse ? () => onSelectVerse(isSel ? null : verse) : undefined,
                    };
                    if (qcfReady && w.c && w.f && (w.type === 'end' || w.type === 'word')) {
                      return (
                        <span
                          key={idx}
                          {...hit}
                          data-verse={w.verse}
                          className={`cursor-pointer rounded-md transition-colors ${
                            isPlaying
                              ? 'bg-teal-400/35 dark:bg-teal-400/25'
                              : isSel
                                ? 'bg-amber-300/40 dark:bg-amber-500/30'
                                : 'hover:bg-stone-200/50 dark:hover:bg-slate-800/60'
                          }`}
                          style={{ fontFamily: `'${w.f}'`, lineHeight: 1.9 }}
                        >
                          {w.c}
                        </span>
                      );
                    }
                    if (w.type === 'end') {
                      const num = w.verse ? Number(w.verse.split(':')[1]) : 0;
                      return (
                        <span
                          key={idx}
                          {...hit}
                          data-verse={w.verse}
                          className={`inline-flex items-center cursor-pointer rounded-full transition-colors ${
                            isPlaying ? 'bg-teal-400/40 dark:bg-teal-400/30' : ''
                          }`}
                          style={{ lineHeight: 1 }}
                        >
                          <span
                            className="relative inline-flex items-center justify-center"
                            style={{ width: '1.2em', height: '1.2em' }}
                            aria-label={`آیه ${toPersianDigits(num)}`}
                          >
                            <svg viewBox="0 0 40 40" className="absolute inset-0 w-full h-full" aria-hidden="true" fill="none" strokeWidth="1.2" stroke={isSel ? '#d97706' : '#a8802c'}>
                              <circle cx="20" cy="20" r="18" strokeDasharray="3 1.5" />
                              <circle cx="20" cy="20" r="15" strokeWidth="0.8" opacity="0.85" fill={isSel ? 'rgba(245,158,11,0.25)' : 'none'} />
                            </svg>
                            <span
                              className="relative font-bold tabular-nums text-amber-800 dark:text-amber-300"
                              style={{ fontSize: num >= 100 ? '0.34em' : '0.42em', fontFamily: "'Vazirmatn', sans-serif" }}
                            >
                              {toPersianDigits(num)}
                            </span>
                          </span>
                          {verse && renderSajdaMark(verse)}
                        </span>
                      );
                    }
                    return (
                      <span
                        key={idx}
                        {...hit}
                        data-verse={w.verse}
                        className={`cursor-pointer rounded-md transition-colors ${
                          isPlaying
                            ? 'bg-teal-400/35 dark:bg-teal-400/25 text-teal-950 dark:text-teal-100'
                            : isSel
                              ? 'bg-amber-300/40 dark:bg-amber-500/30'
                              : 'hover:bg-stone-200/50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        {w.text}
                      </span>
                    );
                  })}
                </div>
              );
            })}
      </div>
    );
  }

  // بستهٔ چیدمان در دسترس نیست: نمایش متن پیوستهٔ آیات صفحه (اسکرول فقط داخل همین حالت)
  if (verses.length === 0) {
    return (
      <div className="h-full flex items-center justify-center px-6 text-center text-sm text-slate-500 dark:text-slate-400">
        آیات این صفحه در دسترس نیست. لطفاً یکبار به اینترنت متصل شوید تا بستهٔ داده نصب شود.
      </div>
    );
  }

  const surahsOnThisPage: { surah: Surah; verses: Verse[] }[] = [];
  verses.forEach((v) => {
    let group = surahsOnThisPage.find((g) => g.surah.id === v.surahId);
    if (!group) {
      const meta = surahs.find((item) => item.id === v.surahId);
      group = {
        surah: meta || {
          id: v.surahId,
          nameArabic: `سورة ${v.surahId}`,
          namePersian: `سوره ${v.surahId}`,
          englishName: '',
          revelationType: 'Meccan',
          versesCount: 0,
          startPage: pageNumber,
          juzNumber: v.juzNumber,
        },
        verses: [],
      };
      surahsOnThisPage.push(group);
    }
    group.verses.push(v);
  });

  return (
    <div className="h-full overflow-y-auto px-3 py-2">
          <div className="space-y-6">
            {surahsOnThisPage.map((group) => {
              const isSurahStart = group.verses.some((v) => v.verseNumber === 1);
              return (
                <div key={group.surah.id} className="space-y-4">
                  {/* کتیبه سرسوره اگر آیه ۱ در این صفحه باشد */}
                  {isSurahStart && (
                    <div className="text-center space-y-2 pt-1 pb-1">
                      <QuranicSurahBanner surah={group.surah} darkMode={darkMode} />

                      {/* بسمله: به جز سورهٔ توبه (بدون بسمله) و فاتحه (آیهٔ ۱ خودش بسمله است - رفع تکرار) */}
                      {group.surah.id !== 1 && group.surah.id !== 9 && (
                        <p
                          className={`text-center py-1 text-lg sm:text-xl font-medium select-none ${
                            darkMode ? 'text-amber-300/90' : 'text-amber-800'
                          }`}
                          style={{
                            fontFamily: getArabicFontFamily(settings.arabicFont),
                          }}
                          dir="rtl"
                        >
                          بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                        </p>
                      )}
                    </div>
                  )}

                  {/* متن پیوسته آیات صفحه */}
                  <div
                    className="text-right leading-[2.6] tracking-normal text-slate-800 dark:text-slate-100"
                    style={{
                      fontFamily: getArabicFontFamily(settings.arabicFont),
                      fontSize: `${settings.arabicFontSize}px`,
                    }}
                    dir="rtl"
                  >
                    {group.verses.map((v) => {
                      const isSelected = selectedVerse?.id === v.id;
                      const isPlayingVerse = activeVerseKey === `${v.surahId}:${v.verseNumber}`;
                      return (
                        <span
                          key={v.id}
                          data-verse={`${v.surahId}:${v.verseNumber}`}
                          onClick={() => onSelectVerse(isSelected ? null : v)}
                          className={`inline cursor-pointer px-1 py-0.5 rounded-lg transition-all ${
                            isPlayingVerse
                              ? 'bg-teal-400/35 dark:bg-teal-400/25 ring-1 ring-teal-500/40'
                              : isSelected
                                ? 'bg-amber-300/40 dark:bg-amber-500/30 text-amber-950 dark:text-amber-200 ring-1 ring-amber-500/40'
                                : 'hover:bg-stone-200/50 dark:hover:bg-slate-800/60'
                          }`}
                          title={`سوره ${group.surah.nameArabic} - آیه ${v.verseNumber} (کلیک جهت مشاهده ترجمه و تفاسیر)`}
                        >
                          {v.textArabic}
                          <AyahEndMarker verseNumber={v.verseNumber} isCurrentlyPlaying={isSelected} />
                          {renderSajdaMark(v)}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
    </div>
  );
};


export const MushafPageView: React.FC<MushafPageViewProps> = ({
  initialPageNumber,
  surahs,
  settings,
  darkMode,
  bookmarkedVerseIds,
  onToggleBookmark,
  onOpenVerseDetail,
  onOpenAIForVerse,
  onPlayVerseAudio,
  activeVerseKey = null,
  onPageChange,
}) => {
  const [currentPage, setCurrentPage] = useState<number>(initialPageNumber || 1);
  const [selectedVerse, setSelectedVerse] = useState<Verse | null>(null);
  const [isJumpInputOpen, setIsJumpInputOpen] = useState(false);
  const [jumpPageInput, setJumpPageInput] = useState(String(initialPageNumber || 1));

  // دکمهٔ Back ابتدا منوی آیهٔ انتخاب‌شده را می‌بندد
  useEffect(() => {
    if (!selectedVerse) return;
    const onBack = (e: Event) => {
      e.preventDefault();
      setSelectedVerse(null);
    };
    window.addEventListener('mobin-back', onBack);
    return () => window.removeEventListener('mobin-back', onBack);
  }, [selectedVerse]);

  // صفحهٔ مصحف ثابت است و اسکرول ندارد: اسکرول سند قفل می‌شود و ارتفاع صفحه تا لبهٔ پایین پر می‌شود
  const wrapperRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const [wrapperH, setWrapperH] = useState<number | null>(null);
  // دکمهٔ چشم: حالت تمرکز (مخفی‌کردن هدر تا صفحه بزرگ‌تر شود)
  const [focusMode, setFocusMode] = useState(false);
  useEffect(() => {
    const header = document.getElementById('app-main-header');
    if (header) header.style.display = focusMode ? 'none' : '';
    return () => {
      if (header) header.style.display = '';
    };
  }, [focusMode]);
  const [areaH, setAreaH] = useState(560);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = [html.style.overflow, body.style.overflow, html.style.overscrollBehavior];
    window.scrollTo(0, 0);
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';
    return () => {
      html.style.overflow = prev[0];
      body.style.overflow = prev[1];
      html.style.overscrollBehavior = prev[2];
    };
  }, []);

  // پلیر صوتی شناور روی پایین صفحه می‌نشیند؛ ارتفاعش از صفحهٔ مصحف کم می‌شود تا نوار پایین پنهان نشود
  const playerHRef = useRef(0);
  const [playerH, setPlayerH] = useState(0);
  useEffect(() => {
    let el: HTMLElement | null = null;
    let ro: ResizeObserver | null = null;
    const apply = () => {
      const h = el ? Math.ceil(el.getBoundingClientRect().height) : 0;
      if (h !== playerHRef.current) {
        playerHRef.current = h;
        setPlayerH(h);
      }
    };
    const sync = () => {
      const found = document.getElementById('audio-player-bar-container');
      if (found !== el) {
        ro?.disconnect();
        el = found;
        if (el) {
          ro = new ResizeObserver(apply);
          ro.observe(el);
        }
      }
      apply();
    };
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      ro?.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    const measure = () => {
      const el = wrapperRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      setWrapperH(Math.max(240, Math.floor(window.innerHeight - top - playerHRef.current)));
    };
    measure();
    window.addEventListener('resize', measure);
    const header = document.getElementById('app-main-header');
    const ro = header ? new ResizeObserver(measure) : null;
    if (header && ro) ro.observe(header);
    return () => {
      window.removeEventListener('resize', measure);
      ro?.disconnect();
    };
  }, [playerH]);

  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAreaH(el.clientHeight));
    ro.observe(el);
    setAreaH(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (initialPageNumber && initialPageNumber !== currentPage) {
      setCurrentPage(initialPageNumber);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPageNumber]);

  // گزارش صفحهٔ جاری به App (موقعیت مطالعه، سورهٔ جاری)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pageVerses = await QuranService.getVersesByPage(currentPage);
      if (cancelled) return;
      setSelectedVerse(null);
      if (pageVerses.length > 0) {
        onPageChange(currentPage, pageVerses[0].surahId, pageVerses[0].verseNumber);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  // پیشنهاد دانلود فونت‌های QCF4
  const [hasGlyphData, setHasGlyphData] = useState(false);
  const [qcfOffer, setQcfOffer] = useState(false);
  const [showQcfSheet, setShowQcfSheet] = useState(false);

  useEffect(() => {
    if (!hasGlyphData || !isQcf4Supported()) return;
    let cancelled = false;
    const check = async () => {
      const manifest = await loadQcf4Manifest();
      if (cancelled || !manifest) return;
      const done = await isFullyDownloaded();
      if (cancelled) return;
      setQcfOffer(!done);
      if (!done && !wasPromptDismissed()) setShowQcfSheet(true);
      if (done) setShowQcfSheet(false);
    };
    void check();
    const off = onQcf4Change(() => void check());
    return () => {
      cancelled = true;
      off();
    };
  }, [hasGlyphData]);

  // ---------- ورق زدن: صفحه همراه انگشت حرکت می‌کند و صفحهٔ بعد/قبل کنارش دیده می‌شود ----------
  const [dragX, setDragX] = useState(0);
  const [animating, setAnimating] = useState(false);
  const animatingRef = useRef(false);
  const touchRef = useRef({ x: 0, y: 0, t: 0, lastDx: 0, mode: null as null | 'h' | 'v', active: false, moved: false });

  const areaWidth = () => areaRef.current?.clientWidth || window.innerWidth;

  // dir = +1: صفحهٔ بعد (از چپ وارد می‌شود)، dir = -1: صفحهٔ قبل (از راست)
  const slideTo = (dir: 1 | -1) => {
    const target = currentPage + dir;
    if (target < 1 || target > TOTAL_PAGES || animatingRef.current) return;
    animatingRef.current = true;
    setAnimating(true);
    setDragX(dir * areaWidth());
    window.setTimeout(() => {
      setCurrentPage(target);
      setAnimating(false);
      setDragX(0);
      animatingRef.current = false;
    }, 250);
  };

  const snapBack = () => {
    animatingRef.current = true;
    setAnimating(true);
    setDragX(0);
    window.setTimeout(() => {
      setAnimating(false);
      animatingRef.current = false;
    }, 220);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1 || animatingRef.current) return;
    const t = touchRef.current;
    t.x = e.touches[0].clientX;
    t.y = e.touches[0].clientY;
    t.t = Date.now();
    t.lastDx = 0;
    t.mode = null;
    t.moved = false;
    t.active = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const t = touchRef.current;
    if (!t.active) return;
    const dx = e.touches[0].clientX - t.x;
    const dy = e.touches[0].clientY - t.y;
    if (t.mode === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      t.mode = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'h' : 'v';
    }
    if (t.mode !== 'h') return;
    t.moved = true;
    t.lastDx = dx;
    // کشیدن به راست = صفحهٔ بعد؛ در ابتدا/انتهای مصحف مقاومت می‌دهیم
    const blocked = (dx > 0 && currentPage >= TOTAL_PAGES) || (dx < 0 && currentPage <= 1);
    setDragX(blocked ? dx * 0.25 : dx);
  };

  const handleTouchEnd = () => {
    const t = touchRef.current;
    if (!t.active) return;
    t.active = false;
    if (t.mode !== 'h') return;
    const dx = t.lastDx;
    const dir: 1 | -1 = dx > 0 ? 1 : -1;
    const velocity = Math.abs(dx) / Math.max(1, Date.now() - t.t);
    const allowed = dir === 1 ? currentPage < TOTAL_PAGES : currentPage > 1;
    if (allowed && (Math.abs(dx) > areaWidth() * 0.25 || (velocity > 0.5 && Math.abs(dx) > 40))) {
      slideTo(dir);
    } else {
      snapBack();
    }
  };

  const handleJumpToPage = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseInt(jumpPageInput, 10);
    if (!isNaN(target) && target >= 1 && target <= TOTAL_PAGES) {
      setCurrentPage(target);
      setIsJumpInputOpen(false);
    }
  };

  // ناوبری با کیبورد: در RTL فلش راست = صفحهٔ قبل و فلش چپ = صفحهٔ بعد
  const handleContainerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      slideTo(-1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      slideTo(1);
    }
  };

  const pages = [currentPage - 1, currentPage, currentPage + 1].filter((p) => p >= 1 && p <= TOTAL_PAGES);
  const pageBg = darkMode ? 'bg-slate-900' : 'bg-[#fbf8ef]';
  const navBtn =
    'w-10 h-10 flex items-center justify-center rounded-xl text-teal-800 dark:text-teal-300 disabled:opacity-30 cursor-pointer active:scale-95 transition-transform';

  return (
    <div
      id="mushaf-page-container"
      ref={wrapperRef}
      className={`w-full max-w-3xl mx-auto flex flex-col overflow-hidden box-border ${pageBg}`}
      style={{
        height: wrapperH ?? 'calc(100dvh - 120px)',
        paddingTop: focusMode ? 'env(safe-area-inset-top, 0px)' : undefined,
      }}
    >
      <div
        ref={areaRef}
        tabIndex={0}
        onKeyDown={handleContainerKeyDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onClickCapture={(e) => {
          if (touchRef.current.moved) {
            e.stopPropagation();
            e.preventDefault();
            touchRef.current.moved = false;
          }
        }}
        className="relative flex-1 min-h-0 w-full overflow-hidden outline-none select-none"
        style={{ touchAction: 'none' }}
        aria-label="نمای صفحه مصحف — برای ورق زدن، انگشت خود را بکشید"
      >
        {qcfOffer && (
          <button
            onClick={() => setShowQcfSheet(true)}
            className="absolute top-1 inset-x-3 z-20 min-h-[32px] rounded-xl border border-amber-500/50 bg-amber-50 dark:bg-slate-800 text-xs font-bold text-amber-800 dark:text-amber-300 cursor-pointer"
          >
            دانلود فونت مصحف برای نمایش دقیق صفحه
          </button>
        )}

        {pages.map((p) => (
          <div
            key={p}
            className={`absolute inset-0 ${pageBg}`}
            aria-hidden={p !== currentPage}
            style={{
              transform: `translate3d(calc(${(currentPage - p) * 100}% + ${dragX}px), 0, 0)`,
              transition: animating ? 'transform 240ms cubic-bezier(0.22, 0.8, 0.3, 1)' : 'none',
              boxShadow: dragX !== 0 ? '0 0 22px rgba(0,0,0,0.22)' : 'none',
              willChange: 'transform',
            }}
          >
            <MushafFrame darkMode={darkMode} />
            <div className="absolute" style={{ inset: PAGE_PAD }}>
              <MushafPageBody
                pageNumber={p}
                height={Math.max(120, areaH - PAGE_PAD * 2)}
                surahs={surahs}
                settings={settings}
                darkMode={darkMode}
                selectedVerse={selectedVerse}
                onSelectVerse={setSelectedVerse}
                activeVerseKey={activeVerseKey}
                isCurrent={p === currentPage}
                onGlyphData={setHasGlyphData}
              />
            </div>
          </div>
        ))}
      </div>

      {/* نوار باریک پایین: ناوبری و پرش به صفحه */}
      <div
        className="flex items-center justify-between px-3 shrink-0"
        dir="rtl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <button onClick={() => slideTo(-1)} disabled={currentPage <= 1} className={navBtn} aria-label="صفحه قبل" title="صفحه قبل">
          <ChevronRight className="w-5 h-5" />
        </button>

        {isJumpInputOpen ? (
          <form onSubmit={handleJumpToPage} className="flex items-center gap-1.5 px-2 py-1">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={TOTAL_PAGES}
              value={jumpPageInput}
              onChange={(e) => setJumpPageInput(e.target.value)}
              autoFocus
              placeholder="۱-۶۰۴"
              className="w-16 px-1.5 py-0.5 rounded-lg border border-amber-500/50 text-center font-bold text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button type="submit" className="px-2.5 py-1 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold cursor-pointer">
              برو
            </button>
            <button
              type="button"
              onClick={() => setIsJumpInputOpen(false)}
              className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 cursor-pointer"
              aria-label="انصراف"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setJumpPageInput(String(currentPage));
                setIsJumpInputOpen(true);
              }}
              className="relative w-[52px] h-[38px] flex items-center justify-center cursor-pointer active:scale-95 transition-transform text-amber-700 dark:text-amber-400"
              title="پرش به صفحهٔ دلخواه"
              aria-label={`صفحه ${toPersianDigits(currentPage)} از ۶۰۴ - پرش به صفحه`}
            >
              <svg viewBox="0 0 44 34" className="absolute inset-0 w-full h-full" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 6Q12 2 22 6Q32 2 42 6V28Q32 24 22 28Q12 24 2 28Z" />
                <path d="M22 6V28" opacity="0.6" />
              </svg>
              <span className="relative text-[12px] font-extrabold text-teal-900 dark:text-amber-200 tabular-nums" style={{ fontFamily: "'Vazirmatn', sans-serif" }}>
                {toPersianDigits(currentPage)}
              </span>
            </button>
            <button
              onClick={() => setFocusMode((f) => !f)}
              aria-pressed={focusMode}
              className={`w-10 h-10 flex items-center justify-center rounded-full cursor-pointer active:scale-95 transition-all ${
                focusMode
                  ? 'bg-teal-800 text-amber-200'
                  : 'bg-sky-100 text-sky-700 dark:bg-slate-800 dark:text-sky-300'
              }`}
              title={focusMode ? 'نمایش نوار بالا' : 'حالت تمرکز (مخفی‌کردن نوار بالا)'}
              aria-label={focusMode ? 'نمایش نوار بالا' : 'حالت تمرکز'}
            >
              {focusMode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        )}

        <button onClick={() => slideTo(1)} disabled={currentPage >= TOTAL_PAGES} className={navBtn} aria-label="صفحه بعد" title="صفحه بعد">
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>

      {/* منوی عملیات آیهٔ انتخاب‌شده: پایین صفحه، با تپ روی آیه باز می‌شود */}
      {selectedVerse && (() => {
        const verseSurah =
          surahs.find((s) => s.id === selectedVerse.surahId) || {
            id: selectedVerse.surahId,
            nameArabic: `سورة ${selectedVerse.surahId}`,
            namePersian: `سوره ${selectedVerse.surahId}`,
            englishName: '',
            revelationType: 'Meccan' as const,
            versesCount: 0,
            startPage: selectedVerse.pageNumber,
            juzNumber: selectedVerse.juzNumber,
          };
        const translation = getTranslationDisplay(selectedVerse, settings);
        const isBookmarked = bookmarkedVerseIds.has(selectedVerse.verseNumber);
        const actions = [
          { label: 'تدبّر هوشمند', icon: Sparkles, primary: true, run: () => onOpenAIForVerse(selectedVerse) },
          { label: 'پخش', icon: Volume2, run: () => onPlayVerseAudio(selectedVerse.verseNumber, selectedVerse.surahId) },
          { label: isBookmarked ? 'حذف نشانک' : 'نشانک', icon: Bookmark, active: isBookmarked, run: () => onToggleBookmark(selectedVerse.verseNumber) },
          { label: 'تفسیر', icon: BookOpen, run: () => onOpenVerseDetail(selectedVerse) },
          {
            label: 'کپی',
            icon: Copy,
            run: () => {
              try {
                navigator.clipboard.writeText(
                  `${selectedVerse.textArabic}\n\n«${translation}»\n(سوره ${verseSurah.nameArabic}، آیه ${selectedVerse.verseNumber})`
                );
              } catch {}
            },
          },
          { label: 'اشتراک', icon: Share2, run: () => shareAyah(selectedVerse, translation, verseSurah) },
        ];
        return (
          <>
            <div
              role="dialog"
              aria-label="منوی آیه"
              className="fixed bottom-0 inset-x-0 z-[90] max-w-3xl mx-auto rounded-t-3xl border-t-2 border-amber-600 bg-stone-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-[0_-8px_28px_rgba(19,78,74,0.18)] px-5 pt-2.5 space-y-3 animate-fadeIn max-h-[70vh] overflow-y-auto"
              style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
              dir="rtl"
            >
              <div className="mx-auto w-10 h-1 rounded-full bg-stone-300 dark:bg-slate-600" />
              <div className="flex items-center justify-between">
                <div className="text-sm font-extrabold">
                  آیه {toPersianDigits(selectedVerse.verseNumber)} · سوره {verseSurah.nameArabic}
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-300">
                  <span>صفحه {toPersianDigits(selectedVerse.pageNumber)}</span>
                  <button
                    onClick={() => setSelectedVerse(null)}
                    className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:bg-stone-200 dark:hover:bg-slate-800 cursor-pointer"
                    aria-label="بستن منوی آیه"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {actions.map((a) => {
                  const Icon = a.icon;
                  return (
                    <button
                      key={a.label}
                      onClick={() => {
                        a.run();
                        setSelectedVerse(null);
                      }}
                      className={`min-h-[64px] flex flex-col items-center justify-center gap-1 rounded-2xl border text-xs font-bold cursor-pointer active:scale-[0.97] transition-transform ${
                        a.primary
                          ? 'bg-teal-800 border-teal-800 text-white'
                          : a.active
                          ? 'bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-300'
                          : 'bg-white dark:bg-slate-800 border-amber-300/70 dark:border-slate-700 text-slate-800 dark:text-slate-100'
                      }`}
                    >
                      <Icon className={`w-[22px] h-[22px] ${a.primary ? 'text-amber-300' : a.active ? 'fill-current' : 'text-teal-600 dark:text-teal-400'}`} />
                      {a.label}
                    </button>
                  );
                })}
              </div>

              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {settings.activeTranslator === 'makarem'
                    ? 'ترجمه آیت‌الله مکارم: '
                    : settings.activeTranslator === 'fooladvand'
                    ? 'ترجمه استاد فولادوند: '
                    : 'ترجمه استاد انصاریان: '}
                </span>
                {translation}
              </p>
              {selectedVerse.sajda && (
                <p className="text-[11px] text-red-500 dark:text-red-400 font-bold">
                  ⚠️ {selectedVerse.sajda.obligatory ? 'این آیه از آیات سجدهٔ واجب است.' : 'این آیه از آیات سجدهٔ مستحب است.'}
                </p>
              )}
            </div>
          </>
        );
      })()}
      {showQcfSheet && <Qcf4DownloadSheet darkMode={darkMode} onClose={() => setShowQcfSheet(false)} />}
    </div>
  );
};
