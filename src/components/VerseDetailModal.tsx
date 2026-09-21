import React, { useState } from 'react';
import { X, BookOpen, Layers, Bookmark, Sparkles, Copy, Check, Save } from 'lucide-react';
import { Verse, Surah, ArabicFont } from '../types';
import { getArabicFontFamily } from '../utils/fontHelper';

interface VerseDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  verse: Verse | null;
  currentSurah: Surah;
  darkMode: boolean;
  arabicFont?: ArabicFont;
  onOpenAIForVerse: (verse: Verse) => void;
  onSaveNote: (surahId: number, verseNumber: number, note: string) => void;
}

export const VerseDetailModal: React.FC<VerseDetailModalProps> = ({
  isOpen,
  onClose,
  verse,
  currentSurah,
  darkMode,
  arabicFont,
  onOpenAIForVerse,
  onSaveNote,
}) => {
  const [activeTab, setActiveTab] = useState<'tafsir' | 'translations' | 'grammar' | 'note'>('tafsir');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [personalNote, setPersonalNote] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);

  if (!isOpen || !verse) return null;

  const handleCopyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSaveNoteSubmit = () => {
    onSaveNote(currentSurah.id, verse.verseNumber, personalNote);
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2500);
  };

  return (
    <div
      id="modal-verse-detail-backdrop"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in"
    >
      <div
        id="modal-verse-detail-content"
        className={`w-full sm:max-w-2xl h-[85vh] sm:h-[80vh] flex flex-col rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden transition-all ${
          darkMode ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-800'
        }`}
      >
        {/* سربرگ مشخصات آیه */}
        <div className={`p-4 border-b flex items-center justify-between ${
          darkMode ? 'border-slate-800 bg-slate-900/90' : 'border-slate-100 bg-teal-900 text-white'
        }`}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-400/20 text-amber-300 flex items-center justify-center font-bold text-xs border border-amber-400/30">
              {verse.verseNumber}
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base flex items-center gap-1.5">
                <span>سوره {currentSurah.nameArabic}</span>
                <span className="opacity-70 text-xs">({currentSurah.namePersian})</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 font-normal">
                  آیه {verse.verseNumber}
                </span>
              </h3>
              <span className="text-[11px] opacity-75">
                جزء {verse.juzNumber} • صفحه {verse.pageNumber}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* دکمه انتقال مستقیم به هوش مصنوعی */}
            <button
              onClick={() => {
                onClose();
                onOpenAIForVerse(verse);
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow transition-all active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>تدبّر هوشمند</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* قاب نمایش متن عربی آیه */}
        <div className={`p-4 border-b text-center ${
          darkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-amber-50/40 border-amber-100'
        }`}>
          <p
            className={`font-medium leading-loose text-xl sm:text-2xl ${
              darkMode ? 'text-amber-200' : 'text-teal-950'
            }`}
            style={{ fontFamily: getArabicFontFamily(arabicFont) }}
          >
            {verse.textArabic}
          </p>
        </div>

        {/* تب‌های ناوبری جزئیات */}
        <div className={`flex border-b overflow-x-auto text-xs sm:text-sm font-semibold px-4 pt-2 gap-2 sm:gap-4 no-scrollbar ${
          darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'
        }`}>
          <button
            onClick={() => setActiveTab('tafsir')}
            className={`pb-2.5 border-b-2 flex items-center gap-1.5 transition-all shrink-0 ${
              activeTab === 'tafsir'
                ? 'border-teal-600 text-teal-600 dark:border-teal-400 dark:text-teal-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>راهنمای تدبّر</span>
          </button>

          <button
            onClick={() => setActiveTab('translations')}
            className={`pb-2.5 border-b-2 flex items-center gap-1.5 transition-all shrink-0 ${
              activeTab === 'translations'
                ? 'border-teal-600 text-teal-600 dark:border-teal-400 dark:text-teal-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>مقایسه ۳ ترجمه</span>
          </button>

          <button
            onClick={() => setActiveTab('grammar')}
            className={`pb-2.5 border-b-2 flex items-center gap-1.5 transition-all shrink-0 ${
              activeTab === 'grammar'
                ? 'border-teal-600 text-teal-600 dark:border-teal-400 dark:text-teal-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span>تحلیل لغوی و ریشه‌ها</span>
          </button>

          <button
            onClick={() => setActiveTab('note')}
            className={`pb-2.5 border-b-2 flex items-center gap-1.5 transition-all shrink-0 ${
              activeTab === 'note'
                ? 'border-teal-600 text-teal-600 dark:border-teal-400 dark:text-teal-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Bookmark className="w-4 h-4" />
            <span>یادداشت شخصی</span>
          </button>
        </div>

        {/* محتوای تب فعال */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* این داده‌ها تا زمان اتصال به منبع دارای ارجاع، تفسیرِ قابل استناد نیستند. */}
          {activeTab === 'tafsir' && (
            <div className="space-y-4">
              <div className={`p-3 rounded-xl text-xs leading-relaxed border ${
                darkMode ? 'bg-amber-950/30 border-amber-800/60 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}>
                این بخش فعلاً یادداشت راهنمای تدبّر است، نه متن یا چکیدهٔ مستندِ تفسیر. برای استناد پژوهشی، منبع و ارجاع صفحه را بررسی کنید.
              </div>
              {/* تفسیر نمونه */}
              <div className={`p-4 rounded-2xl border space-y-2 ${
                darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-stone-200 shadow-sm'
              }`}>
                <div className="flex items-center justify-between border-b pb-2 border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-600" />
                    <h4 className="font-bold text-sm text-teal-700 dark:text-teal-300">
                      راهنمای تدبّر اخلاقی
                    </h4>
                  </div>
                  <button
                    onClick={() => handleCopyText('nemoneh', verse.tafsirNemoneh || '')}
                    className="text-slate-400 hover:text-teal-600 p-1 rounded"
                    title="کپی متن راهنما"
                  >
                    {copiedKey === 'nemoneh' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 text-justify">
                  {verse.tafsirNemoneh || 'نکات تفسیری برای این آیه در حال آماده‌سازی است.'}
                </p>
              </div>

              {/* تفسیر المیزان */}
              <div className={`p-4 rounded-2xl border space-y-2 ${
                darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-stone-200 shadow-sm'
              }`}>
                <div className="flex items-center justify-between border-b pb-2 border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
                    <h4 className="font-bold text-sm text-amber-700 dark:text-amber-300">
                      راهنمای تدبّر مفهومی
                    </h4>
                  </div>
                  <button
                    onClick={() => handleCopyText('mizan', verse.tafsirMizan || '')}
                    className="text-slate-400 hover:text-amber-600 p-1 rounded"
                    title="کپی متن راهنما"
                  >
                    {copiedKey === 'mizan' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 text-justify">
                  {verse.tafsirMizan || 'برای این آیه هنوز راهنمای تدبّر افزوده نشده است.'}
                </p>
              </div>
            </div>
          )}

          {/* ۲. تب مقایسه ۳ ترجمه فارسی */}
          {activeTab === 'translations' && (
            <div className="space-y-3">
              {/* ترجمه مکارم */}
              <div className={`p-4 rounded-xl border ${
                darkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="text-xs font-bold text-teal-700 dark:text-teal-400 mb-1.5">
                  ۱. ترجمه آیت‌الله ناصر مکارم شیرازی (روان و شیوا):
                </div>
                <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                  {verse.translationMakarem}
                </p>
              </div>

              {/* ترجمه فولادوند */}
              <div className={`p-4 rounded-xl border ${
                darkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="text-xs font-bold text-teal-700 dark:text-teal-400 mb-1.5">
                  ۲. ترجمه استاد محمدمهدی فولادوند (ساختاری و دقیق):
                </div>
                <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                  {verse.translationFooladvand}
                </p>
              </div>

              {/* ترجمه انصاریان */}
              <div className={`p-4 rounded-xl border ${
                darkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="text-xs font-bold text-teal-700 dark:text-teal-400 mb-1.5">
                  ۳. ترجمه استاد حسین انصاریان (عاطفی و ادبی):
                </div>
                <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                  {verse.translationAnsarian}
                </p>
              </div>
            </div>
          )}

          {/* ۳. تب صرف، نحو و واژه‌شناسی */}
          {activeTab === 'grammar' && (
            <div className="space-y-4">
              <div className={`p-4 rounded-2xl border ${
                darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-stone-200'
              }`}>
                <h4 className="font-bold text-sm mb-3 text-teal-700 dark:text-teal-300">
                  ریشه‌های سه‌گانه واژگان اصلی آیه:
                </h4>
                <div className="flex flex-wrap gap-2">
                  {verse.rootWords && verse.rootWords.length > 0 ? (
                    verse.rootWords.map((root, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-700 dark:text-teal-300 font-bold text-sm"
                      >
                        ماده: {root}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400">دادهٔ ریشه‌شناسی این آیه هنوز افزوده نشده است.</span>
                  )}
                </div>
              </div>

              <div className={`p-4 rounded-2xl border space-y-2 ${
                darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-stone-200'
              }`}>
                <h4 className="font-bold text-sm text-teal-700 dark:text-teal-300">
                  راهنمای ادبی و صرفی:
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  تحلیل صرفی و نحویِ مستند برای این آیه هنوز افزوده نشده است. پاسخ هوش مصنوعی جایگزین منبع تخصصی یا پژوهش معتبر نیست.
                </p>
              </div>
            </div>
          )}

          {/* ۴. تب یادداشت شخصی */}
          {activeTab === 'note' && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-500">
                یادداشت، برداشت معنوی یا احساس شما نسبت به این آیه (به‌صورت کاملاً آفلاین روی دستگاه شما ذخیره می‌شود):
              </label>
              <textarea
                rows={5}
                value={personalNote}
                onChange={(e) => setPersonalNote(e.target.value)}
                placeholder="تأملات و نکات خود را اینجا بنویسید..."
                className={`w-full p-3 rounded-xl border text-sm outline-none transition-all ${
                  darkMode
                    ? 'bg-slate-800 border-slate-700 focus:border-teal-500 text-white placeholder-slate-500'
                    : 'bg-slate-50 border-slate-200 focus:border-teal-600 text-slate-900 placeholder-slate-400'
                }`}
              />
              <button
                onClick={handleSaveNoteSubmit}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow transition-all"
              >
                <Save className="w-4 h-4" />
                <span>{noteSaved ? 'با موفقیت ذخیره شد!' : 'ذخیره یادداشت'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
