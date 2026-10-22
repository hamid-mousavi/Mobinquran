import React, { useState } from 'react';
import {
  X,
  RotateCcw,
  BookOpen,
  Plus,
  Info,
  Check,
  Sparkles,
  Layers,
  GraduationCap,
} from 'lucide-react';
import {
  ReviewAyahItem,
  gradeAyahReview,
  removeAyahFromReview,
  getAllReviewAyahs,
  addAyahToReview,
  getReviewSummary,
  setReviewLimit,
  enrollMemorizedAyahs,
} from '../services/activityTracker';
import { toPersianDigits } from '../utils/textNormalization';
import { ALL_SURAHS } from '../data/surahs';
import { ReviewSession } from './ReviewSession';

interface LeitnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  dueReviewAyahs: ReviewAyahItem[];
  onNavigateToVerse: (surahId: number, verseNumber: number) => void;
  darkMode: boolean;
}

export const LeitnerModal: React.FC<LeitnerModalProps> = ({
  isOpen,
  onClose,
  dueReviewAyahs,
  onNavigateToVerse,
  darkMode,
}) => {
  const [selectedSurahId, setSelectedSurahId] = useState<number>(1);
  const [verseNumberInput, setVerseNumberInput] = useState<number>(1);
  const [addFeedback, setAddFeedback] = useState<string | null>(null);
  const [enrollFeedback, setEnrollFeedback] = useState<string | null>(null);
  const [sessionItems, setSessionItems] = useState<ReviewAyahItem[] | null>(null);

  if (!isOpen) return null;

  const allReviewItems = getAllReviewAyahs();
  const reviewSummary = getReviewSummary();

  const handleAddCustomAyah = (e: React.FormEvent) => {
    e.preventDefault();
    const surah = ALL_SURAHS.find((s) => s.id === selectedSurahId);
    if (!surah) return;
    const vNum = Math.max(1, Math.min(verseNumberInput, surah.versesCount));
    addAyahToReview(surah.id, surah.nameArabic, vNum, true);
    setAddFeedback(`آیه ${toPersianDigits(vNum)} سوره ${surah.nameArabic} به جعبه ۱ لایتنر افزوده شد.`);
    setTimeout(() => setAddFeedback(null), 3000);
  };

  const boxCounts = [1, 2, 3, 4, 5].map((boxNum) => ({
    box: boxNum,
    count: allReviewItems.filter((item) => item.box === boxNum).length,
    label:
      boxNum === 1
        ? 'روزانه'
        : boxNum === 2
        ? '۳ روزه'
        : boxNum === 3
        ? '۷ روزه'
        : boxNum === 4
        ? '۱۴ روزه'
        : '۳۰ روزه (تثبیت)',
  }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl sm:max-w-4xl rounded-3xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[94vh] flex flex-col text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* سربرگ مودال */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-stone-200/80 dark:border-slate-800/80 bg-stone-50/70 dark:bg-slate-900/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-teal-600 text-white flex items-center justify-center shadow-md shadow-amber-500/25 shrink-0">
              <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>جعبه لایتنر و میزکار مرور ماندگار آیات</span>
                <span className="text-[11px] sm:text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                  {toPersianDigits(allReviewItems.length)} آیه در چرخه
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                تثبیت محفوظات و آیات منتخب در حافظه بلندمدت با الگوریتم تکرار فاصله‌دار (Spaced Repetition)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-stone-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* محتوای لایتنر */}
        <div className="p-3 sm:p-6 overflow-y-auto space-y-5">
          {/* توضیح شیوه کار لایتنر */}
          <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-500/25 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
              <Info className="w-4 h-4 shrink-0" />
              <span>جعبه لایتنر ۵ مرحله‌ای چگونه آیات را ماندگار می‌کند؟</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
              هر آیه با پاسخ صحیح به جعبه بعدی با فاصله زمانی بزرگتر (۱، ۳، ۷، ۱۴ و ۳۰ روز) منتقل می‌شود تا در حافظه بلندمدت تثبیت شود. در صورت نیاز به تکرار، به جعبه اول بازمی‌گردد.
            </p>
          </div>

          {/* نمودار وضعیت ۵ جعبه لایتنر */}
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2 text-center">
            {boxCounts.map((b) => (
              <div
                key={b.box}
                className="p-2 sm:p-2.5 rounded-xl border border-stone-200/90 dark:border-slate-800 bg-stone-50 dark:bg-slate-800/60 space-y-0.5"
              >
                <div className="text-[10px] text-slate-400 font-bold">جعبه {toPersianDigits(b.box)}</div>
                <div className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400">
                  {toPersianDigits(b.count)}
                </div>
                <div className="text-[9px] text-slate-400 font-medium truncate">{b.label}</div>
              </div>
            ))}
          </div>

          {/* سقف مرور روزانه */}
          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300 px-1">
            <label htmlFor="review-daily-limit" className="font-bold">
              سقف مرور روزانه
            </label>
            <select
              id="review-daily-limit"
              value={reviewSummary.dailyLimit}
              onChange={(e) => setReviewLimit(Number(e.target.value))}
              className="rounded-lg border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-[11px] font-bold cursor-pointer"
            >
              {[10, 20, 30, 50].map((n) => (
                <option key={n} value={n}>
                  {toPersianDigits(n)} آیه
                </option>
              ))}
            </select>
          </div>

          {/* ورود آیه‌های حفظ‌شده‌ی خارج از مرور */}
          {reviewSummary.memorizedNotInReview > 0 && (
            <div className="p-3 rounded-2xl bg-teal-50/70 dark:bg-teal-950/20 border border-teal-500/25 text-[11px] space-y-2">
              <p className="text-slate-700 dark:text-slate-200 leading-relaxed">
                {toPersianDigits(reviewSummary.memorizedNotInReview)} آیهٔ حفظ‌شده هنوز وارد مرور نشده است. با افزودن، به‌تدریج و
                به اندازهٔ سقف روزانه در برنامهٔ مرور پخش می‌شوند.
              </p>
              <button
                type="button"
                onClick={() => {
                  const n = enrollMemorizedAyahs();
                  setEnrollFeedback(`${toPersianDigits(n)} آیه به برنامهٔ مرور اضافه شد.`);
                  setTimeout(() => setEnrollFeedback(null), 3500);
                }}
                className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-[11px] cursor-pointer active:scale-95 transition-all"
              >
                افزودن به برنامهٔ مرور
              </button>
            </div>
          )}
          {enrollFeedback && (
            <div role="status" className="text-[11px] font-semibold text-teal-700 dark:text-teal-300 px-1">
              {enrollFeedback}
            </div>
          )}

          {/* لیست آیات نوبت مرور امروز */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 font-bold px-1">
              <span className="flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
                <span>آیات آماده مرور برای امروز:</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[11px]">
                {toPersianDigits(dueReviewAyahs.length)} آیه
              </span>
            </div>

            {reviewSummary.deferred > 0 && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 px-1">
                {toPersianDigits(reviewSummary.deferred)} آیهٔ دیگر هم موعدش رسیده، ولی به‌خاطر سقف روزانه به روزهای بعد موکول شد.
              </p>
            )}

            {dueReviewAyahs.length > 0 && (
              <button
                type="button"
                onClick={() => setSessionItems([...dueReviewAyahs])}
                className="w-full px-4 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm cursor-pointer active:scale-[0.99] transition-all shadow-xs"
              >
                شروع مرور امروز ({toPersianDigits(dueReviewAyahs.length)} آیه)
              </button>
            )}

            {dueReviewAyahs.length > 0 ? (
              <div className="space-y-2">
                {dueReviewAyahs.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 sm:p-3.5 rounded-2xl border border-stone-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs hover:border-amber-500/40 transition-all"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                          سوره {item.surahNameArabic}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 text-[11px] font-bold">
                          آیه {toPersianDigits(item.verseNumber)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          (در جعبه {toPersianDigits(item.box)})
                        </span>
                        {item.isLeech && (
                          <span className="px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-300 text-[10px] font-bold">
                            نیاز به توجه ویژه
                          </span>
                        )}
                        {(item.overdueDays ?? 0) > 0 && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400">
                            {toPersianDigits(item.overdueDays ?? 0)} روز تأخیر
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        آیه را در ذهن مرور کرده یا با صوت گوش دهید و وضعیت تسلط خود را ثبت کنید:
                      </p>
                    </div>

                    {/* دکمه‌های اقدام لایتنر */}
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onNavigateToVerse(item.surahId, item.verseNumber);
                        }}
                        className="p-2 rounded-xl bg-stone-100 dark:bg-slate-800 hover:bg-teal-50 hover:text-teal-700 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                        title="مشاهده و خواندن آیه در مصحف"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => gradeAyahReview(item.id, 'good')}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
                        title="مسلط هستم (انتقال به جعبه بعدی)"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>تثبیت شد</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => gradeAyahReview(item.id, 'hard')}
                        className="px-2.5 py-1.5 rounded-xl border border-stone-200 dark:border-slate-700 hover:bg-amber-50 text-slate-600 dark:text-slate-400 font-bold text-[11px] transition-all cursor-pointer active:scale-95"
                        title="سخت بود (همین جعبه، مرور زودتر)"
                      >
                        <span>سخت بود</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => gradeAyahReview(item.id, 'again')}
                        className="px-2.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/40 hover:bg-rose-50 text-rose-600 dark:text-rose-400 font-bold text-[11px] transition-all cursor-pointer active:scale-95"
                        title="یادم نبود (بازگشت به جعبه ۱)"
                      >
                        <span>نیاز به تکرار</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => removeAyahFromReview(item.id)}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                        title="حذف از جعبه لایتنر"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 rounded-2xl border border-dashed border-stone-300 dark:border-slate-700 text-center space-y-2">
                <Sparkles className="w-8 h-8 text-amber-500 mx-auto" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  برای امروز آیهٔ در نوبت مروری باقی نمانده است!
                </p>
                <p className="text-[11px] text-slate-400">
                  می‌توانید از فرم زیر، هر آیه‌ای که مایلید را به جعبه لایتنر اضافه کنید.
                </p>
              </div>
            )}
          </div>

          {/* فرم افزودن آیه دلخواه به جعبه ۱ لایتنر */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-stone-50 dark:bg-slate-800/50 border border-stone-200/90 dark:border-slate-800 space-y-3">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>افزودن آیه دلخواه به جعبه لایتنر</span>
            </div>

            <form onSubmit={handleAddCustomAyah} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 block font-medium">سوره مبارکه:</label>
                <select
                  value={selectedSurahId}
                  onChange={(e) => {
                    setSelectedSurahId(Number(e.target.value));
                    setVerseNumberInput(1);
                  }}
                  className="w-full h-9 rounded-xl border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs font-bold cursor-pointer"
                >
                  {ALL_SURAHS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {toPersianDigits(s.id)}. {s.nameArabic} ({toPersianDigits(s.versesCount)} آیه)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 block font-medium">شماره آیه:</label>
                <input
                  type="number"
                  min={1}
                  max={ALL_SURAHS.find((s) => s.id === selectedSurahId)?.versesCount || 286}
                  value={verseNumberInput}
                  onChange={(e) => setVerseNumberInput(Number(e.target.value))}
                  className="w-full h-9 rounded-xl border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-bold text-center"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full h-9 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>افزودن به جعبه ۱</span>
                </button>
              </div>
            </form>

            {addFeedback && (
              <div role="status" className="text-xs text-emerald-600 dark:text-emerald-400 font-bold px-1 animate-fadeIn">
                ✓ {addFeedback}
              </div>
            )}
          </div>
        </div>
      </div>

      {sessionItems && (
        <ReviewSession
          items={sessionItems}
          onExit={() => setSessionItems(null)}
          darkMode={darkMode}
        />
      )}
    </div>
  );
};
