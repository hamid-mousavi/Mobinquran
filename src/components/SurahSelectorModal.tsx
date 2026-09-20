import React, { useState, useMemo } from 'react';
import { X, Search, MapPin, Layers } from 'lucide-react';
import { Surah } from '../types';

interface SurahSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  surahs: Surah[];
  currentSurahId: number;
  onSelectSurah: (surah: Surah) => void;
  darkMode: boolean;
}

export const SurahSelectorModal: React.FC<SurahSelectorModalProps> = ({
  isOpen,
  onClose,
  surahs,
  currentSurahId,
  onSelectSurah,
  darkMode,
}) => {
  const [activeTab, setActiveTab] = useState<'surahs' | 'juz'>('surahs');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSurahs = useMemo(() => {
    if (!searchQuery.trim()) return surahs;
    const q = searchQuery.toLowerCase().trim();
    return surahs.filter(
      (s) =>
        s.nameArabic.includes(q) ||
        s.namePersian.includes(q) ||
        s.englishName.toLowerCase().includes(q) ||
        s.id.toString() === q
    );
  }, [surahs, searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      id="modal-surah-selector-backdrop"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
    >
      <div
        id="modal-surah-selector-content"
        className={`w-full sm:max-w-xl h-[85vh] sm:h-[80vh] flex flex-col rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden transition-all ${
          darkMode ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-800'
        }`}
      >
        {/* سربرگ مودال */}
        <div className={`p-4 border-b flex items-center justify-between ${darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-slate-50'}`}>
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-lg">فهرست مصحف شریف</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-teal-600/10 text-teal-600 dark:text-teal-400 font-semibold">
              ۱۱۴ سوره
            </span>
          </div>
          <button
            id="btn-close-surah-modal"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* کادر جستجو */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-800">
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="input-search-surahs"
              type="text"
              placeholder="جستجوی سوره (نام عربی، فارسی یا شماره)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pr-9 pl-4 py-2 text-sm rounded-xl outline-none border transition-all ${
                darkMode
                  ? 'bg-slate-800 border-slate-700 focus:border-teal-500 text-white placeholder-slate-400'
                  : 'bg-slate-100 border-slate-200 focus:border-teal-600 text-slate-900 placeholder-slate-400'
              }`}
            />
          </div>
        </div>

        {/* تب‌های سوره و جزء */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-4 pt-2 gap-4 text-sm font-semibold">
          <button
            onClick={() => setActiveTab('surahs')}
            className={`pb-2 border-b-2 transition-all ${
              activeTab === 'surahs'
                ? 'border-teal-600 text-teal-600 dark:border-teal-400 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            سوره‌ها ({filteredSurahs.length})
          </button>
          <button
            onClick={() => setActiveTab('juz')}
            className={`pb-2 border-b-2 transition-all ${
              activeTab === 'juz'
                ? 'border-teal-600 text-teal-600 dark:border-teal-400 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            جزءهای ۳۰ گانه
          </button>
        </div>

        {/* لیست سوره‌ها */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1">
          {activeTab === 'surahs' ? (
            filteredSurahs.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">موردی با این عنوان پیدا نشد.</div>
            ) : (
              filteredSurahs.map((surah) => {
                const isSelected = surah.id === currentSurahId;
                return (
                  <button
                    key={surah.id}
                    id={`btn-select-surah-${surah.id}`}
                    onClick={() => {
                      onSelectSurah(surah);
                      onClose();
                    }}
                    className={`w-full p-2.5 rounded-xl flex items-center justify-between text-right transition-all ${
                      isSelected
                        ? darkMode
                          ? 'bg-teal-950/60 border border-teal-600/50 text-teal-300'
                          : 'bg-teal-50 border border-teal-200 text-teal-900'
                        : darkMode
                        ? 'hover:bg-slate-800/80 border border-transparent'
                        : 'hover:bg-slate-100 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* شماره سوره در کادر هشت‌ضلعی معنوی */}
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                          isSelected
                            ? 'bg-teal-600 text-white'
                            : darkMode
                            ? 'bg-slate-800 text-slate-300'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {surah.id}
                      </div>

                      <div>
                        <div className="font-bold text-sm flex items-center gap-2">
                          <span className="font-['Amiri'] text-base text-teal-700 dark:text-teal-300 font-bold">
                            سورة {surah.nameArabic}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                            ({surah.namePersian})
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {surah.revelationType === 'Meccan' ? 'مکی' : 'مدنی'}
                          </span>
                          <span>•</span>
                          <span>{surah.versesCount} آیه</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-left text-xs font-semibold text-slate-400 flex flex-col items-end">
                      <span className="text-teal-600 dark:text-teal-400 font-bold">جزء {surah.juzNumber}</span>
                      <span className="text-[11px] opacity-75">ص {surah.startPage}</span>
                    </div>
                  </button>
                );
              })
            )
          ) : (
            /* لیست جزءها */
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-1">
              {Array.from({ length: 30 }, (_, i) => i + 1).map((juz) => (
                <button
                  key={juz}
                  onClick={() => {
                    // سوره آغازین این جزء را پیدا می‌کنیم
                    const firstSurahInJuz = surahs.find((s) => s.juzNumber === juz) || surahs[0];
                    onSelectSurah(firstSurahInJuz);
                    onClose();
                  }}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                    darkMode
                      ? 'bg-slate-800/70 border-slate-700 hover:border-teal-500'
                      : 'bg-slate-50 border-slate-200 hover:border-teal-500 hover:bg-teal-50/50'
                  }`}
                >
                  <Layers className="w-5 h-5 text-amber-500" />
                  <span className="font-bold text-sm">جزء {juz}</span>
                  <span className="text-[11px] text-slate-400">شروع تلاوت</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
