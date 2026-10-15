import React, { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { toPersianDigits } from '../../utils/textNormalization';
import { addAyahToReview } from '../../services/activityTracker';
import { getOrCreateDeviceId } from '../../utils/deviceId';
import { apiFetch } from '../../services/apiClient';
import { SmartRecitationFeedbackPanelProps, AiRecitationResult } from './types';

export const SmartRecitationFeedbackPanel: React.FC<SmartRecitationFeedbackPanelProps> = ({
  evaluation,
  transcribedText,
  isRecording,
  onToggleRecording,
  onRetry,
  onAccept,
  onReject,
  acceptLabel = 'تلاوت مسلط (مرحله بعد)',
  rejectLabel = 'نیاز به تمرین',
  isCompetitive = false,
  targetText,
  surahName,
  verseNumber,
  surahId,
  rawVerseNumber,
}) => {
  const hasTranscribed = Boolean(transcribedText && transcribedText.trim());
  const [aiEvaluation, setAiEvaluation] = useState<AiRecitationResult | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isAddedToLeitner, setIsAddedToLeitner] = useState<boolean>(false);

  // ریست ارزیابی هوش مصنوعی با تغییر متن ورودی
  useEffect(() => {
    setAiEvaluation(null);
    setAiError(null);
  }, [transcribedText, targetText]);

  // درخواست ارزیابی تخصصی از Gemini
  const handleVerifyWithAi = async () => {
    if (!transcribedText || !targetText) return;
    setIsLoadingAi(true);
    setAiError(null);
    try {
      const deviceId = getOrCreateDeviceId();
      const resp = await apiFetch('/api/ai/verify-recitation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-ID': deviceId,
        },
        body: JSON.stringify({
          targetText,
          spokenText: transcribedText,
          surahName,
          verseNumber,
        }),
      });

      if (!resp.ok) {
        throw new Error('خطا در پاسخ هوش مصنوعی');
      }

      const data = await resp.json();
      setAiEvaluation(data);
    } catch {
      setAiError('عدم امکان داوری با هوش مصنوعی در حال حاضر. از ارزیابی سریع زیر استفاده کنید.');
    } finally {
      setIsLoadingAi(false);
    }
  };

  const isApproved = evaluation.isPass || (aiEvaluation && aiEvaluation.isPass);

  return (
    <div
      className={`p-4 sm:p-5 rounded-3xl border transition-all space-y-3.5 max-w-full overflow-hidden break-words ${
        hasTranscribed
          ? isApproved
            ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20'
            : 'border-amber-500 bg-amber-50/40 dark:bg-amber-950/20 ring-2 ring-amber-500/20'
          : isRecording
          ? 'border-rose-500 bg-rose-50/30 dark:bg-rose-950/20 ring-2 ring-rose-500/20 animate-pulse'
          : 'border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs'
      }`}
      dir="rtl"
    >
      {/* سربرگ کنترل ضبط و وضعیت ارزیابی */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleRecording}
            className={`px-3.5 py-2 rounded-2xl flex items-center gap-2 text-xs font-black transition-all cursor-pointer shadow-sm active:scale-95 ${
              isRecording
                ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse shadow-rose-600/30'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
            }`}
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span>{isRecording ? 'در حال شنیدن… (پایان ضبط)' : 'شروع تلاوت با میکروفون'}</span>
          </button>

          {isRecording && (
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-1 rounded-full bg-rose-500 animate-pulse"
                  style={{
                    height: `${10 + (i % 3) * 6}px`,
                    animationDelay: `${i * 100}ms`,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* نشانگر دقت و وضعیت درستی */}
        {hasTranscribed && (
          <div className="flex items-center gap-1.5">
            <span
              className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1.5 border shadow-2xs ${
                isApproved
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                  : 'bg-amber-500/15 border-amber-500/30 text-amber-800 dark:text-amber-200'
              }`}
            >
              {isApproved ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    تطابق: {toPersianDigits(aiEvaluation ? aiEvaluation.accuracy : evaluation.accuracy)}٪ • تایید شد
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>تطابق: {toPersianDigits(evaluation.accuracy)}٪ • نیاز به دقت</span>
                </>
              )}
            </span>
          </div>
        )}
      </div>

      {/* نوار خطی دقت درصد */}
      {hasTranscribed && (
        <div className="w-full h-1.5 rounded-full bg-stone-200 dark:bg-slate-800 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              isApproved ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
            style={{
              width: `${Math.min(
                100,
                Math.max(5, aiEvaluation ? aiEvaluation.accuracy : evaluation.accuracy)
              )}%`,
            }}
          />
        </div>
      )}

      {/* تفکیک کلمه به کلمه آیه هدف با رنگ‌بندی صحت */}
      {hasTranscribed && evaluation.wordResults.length > 0 && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-stone-200/80 dark:border-slate-800 space-y-2 text-right">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 border-b border-stone-100 dark:border-slate-800 pb-2">
            <span>تحلیل هوشمند کلمات تلاوت‌شده:</span>
            <div className="flex items-center gap-2.5">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>صحیح</span>
              </span>
              <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>جاافتاده / ناخوانا</span>
              </span>
            </div>
          </div>

          <div
            className="flex flex-wrap items-center gap-1.5 leading-[2.6] py-1 text-base sm:text-lg"
            style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', 'Scheherazade New', serif" }}
            dir="rtl"
          >
            {evaluation.wordResults.map((wr, idx) => (
              <span
                key={idx}
                className={`px-2 py-0.5 rounded-lg border text-sm sm:text-base transition-all select-none ${
                  wr.status === 'matched'
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-950 dark:text-emerald-100 font-bold'
                    : wr.status === 'fuzzy'
                    ? 'bg-teal-500/15 border-teal-500/30 text-teal-950 dark:text-teal-100 font-medium'
                    : 'bg-rose-500/15 border-rose-500/40 text-rose-800 dark:text-rose-300 font-bold line-through decoration-rose-500/80'
                }`}
                title={
                  wr.status === 'matched'
                    ? 'صحیح'
                    : wr.status === 'fuzzy'
                    ? `تلفظ نزدیک: «${wr.spokenWord}»`
                    : 'جا افتاده یا ناخوانا'
                }
              >
                {wr.originalWord}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* متن شنیده‌شده و پیام سیستم */}
      {hasTranscribed ? (
        <div className="space-y-2 text-right">
          <div className="p-3 rounded-xl bg-stone-50 dark:bg-slate-800/80 border border-stone-200 dark:border-slate-700 text-xs">
            <span className="text-[10px] text-slate-400 block mb-0.5">صدای شنیده شده از شما:</span>
            <span className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200">
              «{transcribedText}»
            </span>
          </div>

          <div
            className={`text-xs font-bold px-1 flex items-center gap-1.5 ${
              isApproved
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-amber-700 dark:text-amber-400'
            }`}
          >
            {isApproved ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            )}
            <span>{aiEvaluation ? aiEvaluation.verdictMessage : evaluation.message}</span>
          </div>

          {/* دکمه و کارت داوری تخصصی هوش مصنوعی قرآنی Gemini */}
          {targetText && (
            <div className="pt-1">
              {!aiEvaluation ? (
                <button
                  type="button"
                  onClick={handleVerifyWithAi}
                  disabled={isLoadingAi}
                  className="w-full py-2 px-3 rounded-xl border border-teal-500/30 bg-teal-50/50 dark:bg-slate-800 hover:bg-teal-100/60 dark:hover:bg-slate-700/80 text-teal-800 dark:text-teal-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs disabled:opacity-50 active:scale-[0.99]"
                >
                  <Sparkles className={`w-3.5 h-3.5 text-teal-600 dark:text-teal-400 ${isLoadingAi ? 'animate-spin' : ''}`} />
                  <span>{isLoadingAi ? 'در حال داوری با هوش مصنوعی قرآنی Gemini…' : 'داوری تخصصی با هوش مصنوعی (Gemini)'}</span>
                </button>
              ) : (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-teal-500/10 border border-teal-500/30 space-y-2 text-right animate-fadeIn">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="flex items-center gap-1 text-teal-700 dark:text-teal-300">
                      <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                      <span>داوری استاد هوش مصنوعی قرآنی:</span>
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                      aiEvaluation.isPass ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-200' : 'bg-amber-500/20 text-amber-800 dark:text-amber-200'
                    }`}>
                      دقت: {toPersianDigits(aiEvaluation.accuracy)}٪ {aiEvaluation.isPass ? '(تایید شد)' : '(نیاز به تمرین)'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                    {aiEvaluation.verdictMessage}
                  </p>

                  {aiEvaluation.tajweedNote && (
                    <div className="text-[11px] text-teal-800 dark:text-teal-300 font-normal bg-teal-500/10 p-2 rounded-lg">
                      نکته تجویدی و لحن: {aiEvaluation.tajweedNote}
                    </div>
                  )}
                </div>
              )}

              {aiError && (
                <div className="text-[11px] text-rose-500 text-center pt-1 font-medium">{aiError}</div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-2 text-xs text-slate-400">
          {isRecording
            ? 'میکروفون فعال است؛ آیه را با ترتیل واضح بخوانید…'
            : 'برای ارزیابی هوشمند، دکمه میکروفون را لمس کرده و آیه را با صوت تلاوت کنید.'}
        </div>
      )}

      {/* دکمه‌های اقدام و تایید */}
      {!isCompetitive && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {hasTranscribed ? (
            <>
              {isApproved ? (
                <button
                  type="button"
                  onClick={onAccept}
                  className="flex-1 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-600/20 cursor-pointer active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{acceptLabel}</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onRetry}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>تلاش دوباره (پاک کردن)</span>
                  </button>

                  <button
                    type="button"
                    onClick={onAccept}
                    className="py-2.5 px-3 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-stone-50 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer active:scale-95"
                    title="تایید دستی در صورت عدم تشخیص مناسب لهجه توسط مرورگر"
                  >
                    <span>تایید دستی</span>
                  </button>

                  {onReject && (
                    <button
                      type="button"
                      onClick={onReject}
                      className="py-2.5 px-3 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 text-xs font-bold transition-all cursor-pointer active:scale-95"
                    >
                      <span>{rejectLabel}</span>
                    </button>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onAccept}
                className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{acceptLabel}</span>
              </button>

              {onReject && (
                <button
                  type="button"
                  onClick={onReject}
                  className="py-2.5 px-3 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                >
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <span>{rejectLabel}</span>
                </button>
              )}
            </>
          )}

          {/* دکمه اختصاصی افزودن آیه مورد مباحثه به جعبه لایتنر */}
          {Boolean(rawVerseNumber || (typeof verseNumber === 'number' && verseNumber > 0)) && (
            <button
              type="button"
              onClick={() => {
                const vNum = rawVerseNumber || (typeof verseNumber === 'number' ? verseNumber : 1);
                addAyahToReview(surahId || 1, surahName || 'قرآن کریم', vNum, true);
                setIsAddedToLeitner(true);
                setTimeout(() => setIsAddedToLeitner(false), 2500);
              }}
              className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 ${
                isAddedToLeitner
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-xs'
                  : 'border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300'
              }`}
              title="افزودن این آیه به جعبه لایتنر برای مرور هوشمند"
            >
              <RotateCcw className={`w-3.5 h-3.5 text-amber-500 ${isAddedToLeitner ? 'animate-spin' : ''}`} />
              <span>{isAddedToLeitner ? 'در لایتنر ثبت شد ✓' : 'افزودن به جعبه لایتنر'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
