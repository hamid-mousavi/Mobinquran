import React, { useState, useMemo } from 'react';
import { X, Search, MapPin, Layers, Sparkles, SlidersHorizontal, BookOpen } from 'lucide-react';
import { Surah } from '../types';
import { toPersianDigits } from '../utils/textNormalization';
import { JUZ_STARTS, getJuzStartInfo } from '../data/surahs';

interface SurahSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  surahs: Surah[];
  currentSurahId: number;
  onSelectSurah: (surah: Surah) => void;
  onSelectJuz?: (juzNumber: number) => void;
  onOpenAdvancedSearch?: () => void;
  darkMode: boolean;
}

export const SurahSelectorModal: React.FC<SurahSelectorModalProps> = ({
  isOpen,
  onClose,
  surahs,
  currentSurahId,
  onSelectSurah,
  onSelectJuz,
  onOpenAdvancedSearch,
  darkMode,
}) => {
  const [activeTab, setActiveTab] = useState<'surahs' | 'juz'>('surahs');
  const [searchQuery, setSearchQuery] = useState('');
  const [surahTypeFilter, setSurahTypeFilter] = useState<'all' | 'meccan' | 'medinan'>('all');

  const filteredSurahs = useMemo(() => {
    let list = surahs;
    if (surahTypeFilter === 'meccan') {
      list = list.filter((s) => s.revelationType === 'Meccan');
    } else if (surahTypeFilter === 'medinan') {
      list = list.filter((s) => s.revelationType === 'Medinan');
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (s) =>
        s.nameArabic.includes(q) ||
        s.namePersian.includes(q) ||
        s.englishName.toLowerCase().includes(q) ||
        s.id.toString() === q
    );
  }, [surahs, searchQuery, surahTypeFilter]);

  const filteredJuzList = useMemo(() => {
    if (!searchQuery.trim()) return JUZ_STARTS;
    const q = searchQuery.toLowerCase().trim();
    return JUZ_STARTS.filter((j) => {
      return (
        String(j.juz) === q ||
        j.surahNameArabic.includes(q) ||
        j.surahNamePersian.includes(q) ||
        j.startWordsArabic.includes(q) ||
        `جزء ${j.juz}`.includes(q)
      );
    });
  }, [searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      id="modal-surah-selector-backdrop"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="modal-surah-selector-content"
        className={`w-full sm:max-w-2xl h-[88vh] sm:h-[84vh] flex flex-col rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden transition-all border ${
          darkMode
            ? 'bg-slate-900 border-slate-800 text-slate-100'
            : 'bg-[#faf8f5] border-stone-200 text-slate-800'
        }`}
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* سربرگ مودال با دسترسی به جستجوی پیشرفته */}
        <div className={`p-4 border-b flex items-center justify-between shrink-0 ${
          darkMode ? 'border-slate-800 bg-slate-900' : 'border-stone-200 bg-stone-50/80'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-600/10 text-teal-600 dark:text-teal-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base sm:text-lg">فهرست و راهنمای مصحف شریف</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                انتخاب سریع سوره، جزء، و دسترسی به جستجوی پیشرفته
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenAdvancedSearch && (
              <button
                onClick={() => {
                  onClose();
                  onOpenAdvancedSearch();
                }}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 font-bold text-xs transition-colors"
                title="جستجوی پیشرفته در کلمات و ترجمه آیات"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>جستجوی پیشرفته متنی</span>
              </button>
            )}

            <button
              id="btn-close-surah-modal"
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-slate-500"
              aria-label="بستن پنجره"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* کادر جستجو و فیلترها */}
        <div className="p-3 border-b border-stone-200/70 dark:border-slate-800 space-y-2.5 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="input-search-surahs"
              type="text"
              placeholder="جستجوی سوره یا جزء (مثلاً یس، بقره، جزء ۳۰)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pr-10 pl-9 py-2.5 text-xs sm:text-sm rounded-xl outline-none border transition-all ${
                darkMode
                  ? 'bg-slate-800 border-slate-700 focus:border-teal-500 text-white placeholder-slate-400'
                  : 'bg-white border-stone-200 focus:border-teal-600 text-slate-900 placeholder-slate-400 shadow-2xs'
              }`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* تب‌های سوره / جزء و دکمه پیشرفته برای موبایل */}
          <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('surahs')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                  activeTab === 'surahs'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-500 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                سوره‌ها ({toPersianDigits(filteredSurahs.length)})
              </button>
              <button
                onClick={() => setActiveTab('juz')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                  activeTab === 'juz'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-500 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                ۳۰ جزء قرآن ({toPersianDigits(filteredJuzList.length)})
              </button>
            </div>

            {activeTab === 'surahs' ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSurahTypeFilter('all')}
                  className={`px-2 py-1 rounded-lg font-bold transition-all ${
                    surahTypeFilter === 'all'
                      ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  همه
                </button>
                <button
                  onClick={() => setSurahTypeFilter('meccan')}
                  className={`px-2 py-1 rounded-lg font-bold transition-all ${
                    surahTypeFilter === 'meccan'
                      ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  مکی
                </button>
                <button
                  onClick={() => setSurahTypeFilter('medinan')}
                  className={`px-2 py-1 rounded-lg font-bold transition-all ${
                    surahTypeFilter === 'medinan'
                      ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  مدنی
                </button>
              </div>
            ) : null}

            {onOpenAdvancedSearch && (
              <button
                onClick={() => {
                  onClose();
                  onOpenAdvancedSearch();
                }}
                className="sm:hidden text-amber-700 dark:text-amber-400 font-bold flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>جستجوی پیشرفته</span>
              </button>
            )}
          </div>
        </div>

        {/* محتوای لیست سوره‌ها یا جزءها */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
          {activeTab === 'surahs' ? (
            filteredSurahs.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-sm">
                سوره‌ای با عبارت جستجوشده یافت نشد.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredSurahs.map((surah) => {
                  const isSelected = surah.id === currentSurahId;
                  return (
                    <button
                      key={surah.id}
                      id={`btn-select-surah-${surah.id}`}
                      onClick={() => {
                        onSelectSurah(surah);
                        onClose();
                      }}
                      className={`p-3 rounded-2xl border text-right transition-all flex items-center justify-between group hover:scale-[1.01] ${
                        isSelected
                          ? darkMode
                            ? 'bg-teal-950/60 border-teal-500 text-teal-200 shadow-sm'
                            : 'bg-teal-50 border-teal-600 text-teal-900 shadow-sm'
                          : darkMode
                          ? 'bg-slate-800/60 border-slate-800 hover:border-slate-700 text-slate-200'
                          : 'bg-white border-stone-200 hover:border-stone-300 text-slate-800 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            isSelected
                              ? 'bg-teal-600 text-white'
                              : darkMode
                              ? 'bg-slate-800 text-slate-300 border border-slate-700'
                              : 'bg-stone-100 text-slate-700 border border-stone-200'
                          }`}
                        >
                          {toPersianDigits(surah.id)}
                        </div>

                        <div className="min-w-0">
                          <div className="font-bold text-sm flex items-center gap-1.5 truncate">
                            <span className="font-['Amiri'] text-base text-teal-700 dark:text-teal-300 font-bold">
                              سورة {surah.nameArabic}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-normal truncate">
                              ({surah.namePersian})
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <span className="flex items-center gap-0.5">
                              <MapPin className="w-3 h-3" />
                              {surah.revelationType === 'Meccan' ? 'مکی' : 'مدنی'}
                            </span>
                            <span>•</span>
                            <span>{toPersianDigits(surah.versesCount)} آیه</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-left text-xs font-semibold text-slate-400 flex flex-col items-end shrink-0">
                        <span className="text-teal-600 dark:text-teal-400 font-bold">
                          جزء {toPersianDigits(surah.juzNumber)}
                        </span>
                        <span className="text-[11px] opacity-75">ص {toPersianDigits(surah.startPage)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )
          ) : (
            /* لیست دقیق ۳۰ جزء با ناوبری به آیه دقیق ابتدای جزء (حل باگ جزء) */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredJuzList.map((juzInfo) => (
                <button
                  key={juzInfo.juz}
                  onClick={() => {
                    if (onSelectJuz) {
                      onSelectJuz(juzInfo.juz);
                    } else {
                      const target = surahs.find((s) => s.id === juzInfo.surahId) || surahs[0];
                      onSelectSurah(target);
                    }
                    onClose();
                  }}
                  className={`p-3.5 rounded-2xl border text-right transition-all flex items-start justify-between gap-3 group hover:scale-[1.01] ${
                    darkMode
                      ? 'bg-slate-800/60 border-slate-800 hover:border-amber-500/50 hover:bg-slate-800'
                      : 'bg-white border-stone-200 hover:border-amber-600/50 hover:bg-amber-50/30 shadow-2xs'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold text-sm shrink-0 border border-amber-500/20">
                      {toPersianDigits(juzInfo.juz)}
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <div className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                        <span>جزء {toPersianDigits(juzInfo.juz)}</span>
                        <span className="text-xs text-teal-600 dark:text-teal-400 font-normal">
                          (سوره {juzInfo.surahNameArabic}، آیه {toPersianDigits(juzInfo.ayah)})
                        </span>
                      </div>

                      <p
                        className="text-xs text-slate-600 dark:text-slate-300 font-['Amiri'] truncate"
                        dir="rtl"
                      >
                        «{juzInfo.startWordsArabic}»
                      </p>
                    </div>
                  </div>

                  <div className="text-left text-xs shrink-0 flex flex-col items-end">
                    <span className="px-2 py-0.5 rounded-full bg-teal-600/10 text-teal-600 dark:text-teal-400 font-bold text-[11px]">
                      ص {toPersianDigits(juzInfo.page)}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-1">شروع جزء</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

