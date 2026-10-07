import React, { useState } from 'react';
import {
  X,
  Flame,
  Trophy,
  Calendar,
  CheckCircle2,
  RotateCcw,
  BookOpen,
  ArrowRight,
  Sparkles,
  Layers,
  Plus,
  Info,
  Check,
  AlertCircle,
} from 'lucide-react';
import {
  StreakData,
  WeekDayStatus,
  ReviewAyahItem,
  advanceAyahReview,
  removeAyahFromReview,
  recordUserActivity,
  getActivities,
  getAllReviewAyahs,
  seedSampleReviewAyahs,
  addAyahToReview,
} from '../services/activityTracker';
import { toPersianDigits } from '../utils/textNormalization';
import { localDateKey } from '../utils/date';
import { ALL_SURAHS } from '../data/surahs';

interface DailyStreakModalProps {
  isOpen: boolean;
  onClose: () => void;
  streakData: StreakData;
  weekStatus: WeekDayStatus[];
  dueReviewAyahs: ReviewAyahItem[];
  onNavigateToVerse: (surahId: number, verseNumber: number) => void;
  darkMode: boolean;
}

export const DailyStreakModal: React.FC<DailyStreakModalProps> = ({
  isOpen,
  onClose,
  streakData,
  weekStatus,
  dueReviewAyahs,
  onNavigateToVerse,
  darkMode,
}) => {
  const [activeTab, setActiveTab] = useState<'leitner' | 'calendar'>('leitner');
  const [selectedSurahId, setSelectedSurahId] = useState<number>(1);
  const [verseNumberInput, setVerseNumberInput] = useState<number>(1);
  const [addFeedback, setAddFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const activities = getActivities();
  const todayKey = localDateKey();
  const allReviewItems = getAllReviewAyahs();

  // تولید تقویم ۳۰ روز گذشته
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    const dateKey = localDateKey(d);
    return {
      dateKey,
      dayNumber: d.getDate(),
      isCompleted: Boolean(activities[dateKey] && activities[dateKey].count > 0),
      isToday: dateKey === todayKey,
    };
  });

  const handleMarkToday = () => {
    recordUserActivity('read');
  };

  const handleAddCustomAyah = (e: React.FormEvent) => {
    e.preventDefault();
    const surah = ALL_SURAHS.find((s) => s.id === selectedSurahId);
    if (!surah) return;
    const vNum = Math.max(1, Math.min(verseNumberInput, surah.versesCount));
    addAyahToReview(surah.id, surah.nameArabic, vNum, true);
    setAddFeedback(`آیه ${toPersianDigits(vNum)} سوره ${surah.nameArabic} به جعبه ۱ لایتنر افزوده شد.`);
    setTimeout(() => setAddFeedback(null), 3000);
  };

  // تفکیک آمار ۵ جعبه لایتنر
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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/65 backdrop-blur-sm animate-fadeIn"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* سربرگ مودال با استایل شیک */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-stone-200/80 dark:border-slate-800/80 bg-stone-50/60 dark:bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-md shadow-amber-500/25">
              <Flame className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>همراهی و استمرار قرآنی</span>
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                  {toPersianDigits(streakData.currentStreak)} روز پیاپی
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                میزکار مرور لایتنر، تقویم ۳۰ روزه و تثبیت ماندگار آیات در ذهن
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

        {/* نوار ناوبری دو تب اصلی: ۱. میزکار لایتنر | ۲. تقویم ۳۰ روزه */}
        <div className="flex border-b border-stone-200/80 dark:border-slate-800/80 bg-stone-100/50 dark:bg-slate-800/40 p-1.5 gap-1.5 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('leitner')}
            className={`flex-1 py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'leitner'
                ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs ring-1 ring-stone-200 dark:ring-slate-700'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>میزکار مرور آیات (جعبه لایتنر)</span>
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px]">
              {toPersianDigits(allReviewItems.length)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('calendar')}
            className={`flex-1 py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'calendar'
                ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-xs ring-1 ring-stone-200 dark:ring-slate-700'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>تقویم ۳۰ روزه و آمار استمرار</span>
          </button>
        </div>

        {/* محتوای اسکرول‌پذیر بر اساس تب انتخابی */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {activeTab === 'leitner' ? (
            /* ========================================================== */
            /* تب ۱: میزکار مرور آیات (جعبه لایتنر ۵ مرحله‌ای) */
            /* ========================================================== */
            <div className="space-y-4 animate-fadeIn">
              {/* توضیح خلاصه شیوه کار لایتنر */}
              <div className="p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-500/25 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>جعبه لایتنر ۵ مرحله‌ای چگونه آیات را ماندگار می‌کند؟</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                  هر آیه با پاسخ صحیح به جعبه بعدی با فاصله زمانی بزرگتر (۱، ۳، ۷، ۱۴ و ۳۰ روز) منتقل می‌شود تا به حافظه بلندمدت بسپارد. در صورت اشتباه به جعبه اول بازمی‌گردد تا مجدداً تکرار شود.
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
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">
                            آیه را در ذهن یا با صوت مرور کنید و وضعیت تسلط خود را ثبت نمایید:
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
                            onClick={() => advanceAyahReview(item.id, true)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
                            title="مسلط هستم (انتقال به جعبه بعدی)"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>تثبیت شد</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => advanceAyahReview(item.id, false)}
                            className="px-2.5 py-1.5 rounded-xl border border-stone-200 dark:border-slate-700 hover:bg-amber-50 text-slate-600 dark:text-slate-400 font-bold text-[11px] transition-all cursor-pointer active:scale-95"
                            title="نیاز به تکرار مجدد (برگشت به جعبه ۱)"
                          >
                            <span>نیاز به تکرار</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => removeAyahFromReview(item.id)}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors cursor-pointer"
                            title="حذف از جعبه لایتنر"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-stone-50 dark:bg-slate-800/40 border border-stone-200/80 dark:border-slate-800 text-center text-xs text-slate-400 space-y-2">
                    <p>هیچ آیه‌ای برای نوبت مرور امروز نمانده است یا هنوز آیه‌ای به لایتنر اضافه نکرده‌اید.</p>
                    <button
                      type="button"
                      onClick={() => seedSampleReviewAyahs()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition-all shadow-xs cursor-pointer active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>افزودن ۳ آیه نمونه (آیةالکرسی، توحید، انشراح) برای شروع</span>
                    </button>
                  </div>
                )}
              </div>

              {/* فرم ساده افزودن آیه دلخواه به جعبه لایتنر */}
              <form
                onSubmit={handleAddCustomAyah}
                className="p-3.5 rounded-2xl border border-stone-200/80 dark:border-slate-800 bg-stone-50/70 dark:bg-slate-800/40 space-y-2.5"
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-700 dark:text-slate-300">
                  <Plus className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>افزودن مستقیم آیه دلخواه به جعبه لایتنر:</span>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedSurahId}
                    onChange={(e) => setSelectedSurahId(Number(e.target.value))}
                    className="flex-1 p-2 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-200"
                  >
                    {ALL_SURAHS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {toPersianDigits(s.id)}. سوره {s.nameArabic} ({toPersianDigits(s.versesCount)} آیه)
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs text-slate-500 font-bold">آیه:</span>
                    <input
                      type="number"
                      min={1}
                      max={ALL_SURAHS.find((s) => s.id === selectedSurahId)?.versesCount || 286}
                      value={verseNumberInput}
                      onChange={(e) => setVerseNumberInput(Number(e.target.value))}
                      className="w-16 p-2 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-center text-slate-800 dark:text-slate-200"
                    />
                  </div>

                  <button
                    type="submit"
                    className="px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
                  >
                    افزودن
                  </button>
                </div>

                {addFeedback && (
                  <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 animate-fadeIn">
                    ✓ {addFeedback}
                  </div>
                )}
              </form>
            </div>
          ) : (
            /* ========================================================== */
            /* تب ۲: تقویم ۳۰ روزه و آمار استمرار */
            /* ========================================================== */
            <div className="space-y-5 animate-fadeIn">
              {/* کارت آمار ۳گانه زنجیره */}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3 text-center">
                <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-slate-800/60 border border-stone-200/80 dark:border-slate-700/60 space-y-1">
                  <div className="flex items-center justify-center text-amber-500 mb-0.5">
                    <Flame className="w-5 h-5 fill-current" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                    {toPersianDigits(streakData.currentStreak)}
                  </div>
                  <div className="text-xs text-slate-400 font-medium">روز پیاپی فعلی</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-slate-800/60 border border-stone-200/80 dark:border-slate-700/60 space-y-1">
                  <div className="flex items-center justify-center text-teal-600 dark:text-teal-400 mb-0.5">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                    {toPersianDigits(streakData.bestStreak)}
                  </div>
                  <div className="text-xs text-slate-400 font-medium">بهترین رکورد</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-slate-800/60 border border-stone-200/80 dark:border-slate-700/60 space-y-1">
                  <div className="flex items-center justify-center text-indigo-500 mb-0.5">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                    {toPersianDigits(streakData.totalDaysActive)}
                  </div>
                  <div className="text-xs text-slate-400 font-medium">کل روزهای انس</div>
                </div>
              </div>

              {/* وضعیت امروز و ثبت با یک لمس */}
              <div className="p-3.5 sm:p-4 rounded-2xl border border-stone-200/90 dark:border-slate-800 bg-stone-50/70 dark:bg-slate-800/40 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      streakData.todayCompleted
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : 'bg-stone-200 dark:bg-slate-700 text-slate-400'
                    }`}
                  >
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 block">
                      {streakData.todayCompleted
                        ? 'همراهی امروز شما ثبت شده است ✓'
                        : 'امروز هنوز همراهی خود را ثبت نکرده‌اید'}
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      با تلاوت، استماع صوت، مرور یا لمس دکمه زیر زنجیره خود را حفظ کنید.
                    </span>
                  </div>
                </div>

                {!streakData.todayCompleted && (
                  <button
                    type="button"
                    onClick={handleMarkToday}
                    className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 shrink-0 flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>ثبت تلاوت امروز</span>
                  </button>
                )}
              </div>

              {/* تقویم ۳۰ روز گذشته (نمودار ماتریسی پیوستگی) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold px-1">
                  <span>فعالیت ۳۰ روز اخیر:</span>
                  <span className="text-[11px] font-normal text-emerald-600 dark:text-emerald-400 font-bold">
                    سبز: روزهایی که قرآن تلاوت یا مرور شده است
                  </span>
                </div>

                <div className="grid grid-cols-10 gap-1.5 p-3 rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  {last30Days.map((d) => (
                    <div
                      key={d.dateKey}
                      className={`aspect-square rounded-lg flex items-center justify-center text-[10px] font-bold transition-all ${
                        d.isCompleted
                          ? 'bg-emerald-500 text-white shadow-2xs'
                          : d.isToday
                          ? 'border-2 border-teal-500 bg-teal-500/10 text-teal-600 dark:text-teal-400'
                          : 'bg-stone-100 dark:bg-slate-800 text-slate-400'
                      }`}
                      title={`${d.dateKey}: ${d.isCompleted ? 'فعالیت ثبت شد' : 'بدون فعالیت'}`}
                    >
                      {toPersianDigits(d.dayNumber)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* پاورقی مودال */}
        <div className="p-3 sm:p-4 border-t border-stone-200/80 dark:border-slate-800/80 bg-stone-50/60 dark:bg-slate-900/60 flex items-center justify-between text-xs">
          <span className="text-slate-400 text-[11px]">
            {activeTab === 'leitner'
              ? 'نکته: در حین مطالعه هر آیه با لمس «افزودن به لایتنر» آن را به اینجا اضافه کنید.'
              : 'استمرار روزانه به مرور زمان عادتی پایدار و دلنشین می‌آفریند.'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-stone-300 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};
