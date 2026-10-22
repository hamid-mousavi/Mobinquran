import React, { useState, useEffect, useMemo } from 'react';
import { X, Bookmark, Trash2, BookOpen, Clock, FileText, Search, Sparkles } from 'lucide-react';
import { UserBookmark, Surah } from '../types';
import { QuranService } from '../services/quranService';
import { toPersianDigits } from '../utils/textNormalization';
import { useModalA11y } from '../hooks/useModalA11y';

interface BookmarksModalProps {
  isOpen: boolean;
  onClose: () => void;
  surahs: Surah[];
  onSelectBookmark: (surahId: number, verseNumber: number) => void;
  darkMode: boolean;
}

export const BookmarksModal: React.FC<BookmarksModalProps> = ({
  isOpen,
  onClose,
  surahs,
  onSelectBookmark,
  darkMode,
}) => {
  const modalRef = useModalA11y<HTMLDivElement>({ isOpen, onClose });
  const [bookmarks, setBookmarks] = useState<UserBookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'notes'>('all');
  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadBookmarks();
      setSearchFilter('');
    }
  }, [isOpen]);

  const loadBookmarks = async () => {
    setLoading(true);
    const data = await QuranService.getBookmarks();
    setBookmarks(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    setLoading(false);
  };

  const handleDelete = async (e: React.MouseEvent, surahId: number, verseNumber: number) => {
    e.stopPropagation();
    await QuranService.toggleBookmark(surahId, verseNumber);
    setBookmarks((prev) => prev.filter((b) => !(b.surahId === surahId && b.verseNumber === verseNumber)));
  };

  const filteredBookmarks = useMemo(() => {
    let list = bookmarks;
    if (activeTab === 'notes') {
      list = list.filter((b) => Boolean(b.note && b.note.trim().length > 0));
    }
    if (searchFilter.trim().length > 0) {
      const q = searchFilter.trim().toLowerCase();
      list = list.filter((b) => {
        const s = surahs.find((item) => item.id === b.surahId);
        const matchSurah = s?.nameArabic.toLowerCase().includes(q) || s?.namePersian.toLowerCase().includes(q);
        const matchNote = b.note ? b.note.toLowerCase().includes(q) : false;
        const matchVerse = String(b.verseNumber).includes(q);
        return matchSurah || matchNote || matchVerse;
      });
    }
    return list;
  }, [bookmarks, activeTab, searchFilter, surahs]);

  const noteCount = useMemo(() => {
    return bookmarks.filter((b) => Boolean(b.note && b.note.trim().length > 0)).length;
  }, [bookmarks]);

  if (!isOpen) return null;

  return (
    <div
      id="modal-bookmarks-backdrop"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        id="modal-bookmarks-content"
        className={`w-full sm:max-w-lg h-[82vh] sm:h-[75vh] flex flex-col rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden transition-all ${
          darkMode ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-800'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* سربرگ */}
        <div
          className={`p-4 border-b flex items-center justify-between ${
            darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-amber-500 fill-amber-500" />
            <h2 className="font-bold text-base">نشانه‌گذاری‌ها و آیات برگزیده</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
              {toPersianDigits(bookmarks.length)} آیه
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* فیلتر تب‌ها و جستجو */}
        <div className={`p-3 border-b space-y-2.5 ${darkMode ? 'border-slate-800 bg-slate-900/60' : 'border-slate-100 bg-stone-50/50'}`}>
          <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'all'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>همه نشانه‌ها</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/15">
                {toPersianDigits(bookmarks.length)}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'notes'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>یادداشت‌دار</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/15">
                {toPersianDigits(noteCount)}
              </span>
            </button>
          </div>

          {bookmarks.length > 3 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="جستجو در نام سوره یا متن یادداشت..."
                className={`w-full pr-8 pl-8 py-1.5 text-xs rounded-xl border outline-none transition-all ${
                  darkMode
                    ? 'bg-slate-800/80 border-slate-700 focus:border-amber-500 text-slate-100 placeholder:text-slate-500'
                    : 'bg-white border-stone-200 focus:border-amber-500 text-slate-800 placeholder:text-slate-400'
                }`}
              />
              {searchFilter && (
                <button
                  onClick={() => setSearchFilter('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* لیست آیات نشانه‌گذاری شده */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {loading ? (
            <div className="text-center py-12 text-slate-400 text-sm">در حال واکشی...</div>
          ) : bookmarks.length === 0 ? (
            <div className="text-center py-16 px-4 space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <Bookmark className="w-7 h-7" />
              </div>
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                هنوز آیه‌ای را نشانه‌گذاری نکرده‌اید.
              </p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                در حین مطالعه با لمس دکمه نشانه‌گذاری، آیات برگزیده برای دسترسی سریع به این فهرست اضافه خواهند شد.
              </p>
            </div>
          ) : filteredBookmarks.length === 0 ? (
            <div className="text-center py-14 px-4 space-y-2">
              <Sparkles className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-xs text-slate-400">
                موردی مطابق با فیلتر انتخاب‌شده یافت نشد.
              </p>
            </div>
          ) : (
            filteredBookmarks.map((b) => {
              const surah = surahs.find((s) => s.id === b.surahId);
              const formattedDate = new Date(b.createdAt).toLocaleDateString('fa-IR');

              return (
                <div
                  key={`${b.surahId}-${b.verseNumber}`}
                  onClick={() => {
                    onSelectBookmark(b.surahId, b.verseNumber);
                    onClose();
                  }}
                  className={`w-full p-3.5 rounded-2xl border transition-all cursor-pointer group ${
                    darkMode
                      ? 'bg-slate-800/60 border-slate-700/80 hover:border-amber-500/50 hover:bg-slate-800'
                      : 'bg-stone-50 border-stone-200/80 hover:border-amber-500 hover:bg-amber-50/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex flex-col items-center justify-center font-bold shrink-0">
                        <span className="text-xs">{toPersianDigits(b.verseNumber)}</span>
                        <span className="text-[9px] opacity-75">آیه</span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
                          <BookOpen className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                          <span>سوره {surah?.nameArabic || `سوره شماره ${toPersianDigits(b.surahId)}`}</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                            ({surah?.namePersian})
                          </span>
                        </div>

                        {b.note && (
                          <div
                            className={`mt-2 p-2 rounded-xl text-xs flex items-start gap-2 border ${
                              darkMode
                                ? 'bg-amber-950/20 border-amber-900/30 text-amber-200'
                                : 'bg-amber-50 border-amber-200 text-amber-900'
                            }`}
                          >
                            <FileText className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                            <p className="line-clamp-2 leading-relaxed">{b.note}</p>
                          </div>
                        )}

                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-1.5">
                          <Clock className="w-3 h-3" />
                          <span>ثبت در: {formattedDate}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleDelete(e, b.surahId, b.verseNumber)}
                      className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors shrink-0"
                      title="حذف از نشانه‌ها"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
