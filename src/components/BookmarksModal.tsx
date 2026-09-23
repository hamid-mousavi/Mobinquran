import React, { useState, useEffect } from 'react';
import { X, Bookmark, Trash2, BookOpen, Clock } from 'lucide-react';
import { UserBookmark, Surah } from '../types';
import { QuranService } from '../services/quranService';
import { toPersianDigits } from '../utils/textNormalization';

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
  const [bookmarks, setBookmarks] = useState<UserBookmark[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadBookmarks();
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

  if (!isOpen) return null;

  return (
    <div
      id="modal-bookmarks-backdrop"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
    >
      <div
        id="modal-bookmarks-content"
        className={`w-full sm:max-w-lg h-[75vh] sm:h-[70vh] flex flex-col rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden transition-all ${
          darkMode ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-800'
        }`}
      >
        {/* سربرگ */}
        <div className={`p-4 border-b flex items-center justify-between ${
          darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-slate-50'
        }`}>
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
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* لیست آیات نشانه‌گذاری شده */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="text-center py-12 text-slate-400 text-sm">در حال واکشی...</div>
          ) : bookmarks.length === 0 ? (
            <div className="text-center py-16 px-4 space-y-2">
              <Bookmark className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                هنوز آیه‌ای را نشانه‌گذاری نکرده‌اید.
              </p>
              <p className="text-xs text-slate-400">
                در حین مطالعه با کلیک روی آیکون نشانه‌گذاری (Bookmark)، آیه به این لیست اضافه خواهد شد.
              </p>
            </div>
          ) : (
            bookmarks.map((b) => {
              const surah = surahs.find((s) => s.id === b.surahId);
              const formattedDate = new Date(b.createdAt).toLocaleDateString('fa-IR');

              return (
                <div
                  key={`${b.surahId}-${b.verseNumber}`}
                  onClick={() => {
                    onSelectBookmark(b.surahId, b.verseNumber);
                    onClose();
                  }}
                  className={`w-full p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                    darkMode
                      ? 'bg-slate-800/60 border-slate-700/80 hover:border-amber-500/50'
                      : 'bg-stone-50 border-stone-200/80 hover:border-amber-500 hover:bg-amber-50/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex flex-col items-center justify-center font-bold shrink-0">
                      <span className="text-xs">{toPersianDigits(b.verseNumber)}</span>
                      <span className="text-[9px] opacity-75">آیه</span>
                    </div>

                    <div>
                      <div className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                        <span>سوره {surah?.nameArabic || `سوره شماره ${toPersianDigits(b.surahId)}`}</span>
                        <span className="text-xs opacity-60">({surah?.namePersian})</span>
                      </div>
                      {b.note && (
                        <p className="text-xs text-amber-600 dark:text-amber-300 font-medium line-clamp-1 mt-0.5">
                          یادداشت: {b.note}
                        </p>
                      )}
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        <span>ثبت در: {formattedDate}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleDelete(e, b.surahId, b.verseNumber)}
                    className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                    title="حذف از نشانه‌ها"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
