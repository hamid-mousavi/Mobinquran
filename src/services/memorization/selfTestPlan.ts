/**
 * منطق خالص «خودآزمایی و سنجش» حفظ (مرحلهٔ اصلاحات):
 * گزینه‌ها هم‌نام و هم‌معنای مباحثهٔ صوتی آیه‌به‌آیه‌اند، به‌اضافهٔ «گوش دادن به تلاوت».
 */

export type TurnMode = 'all_me' | 'system_first' | 'me_first';
export type AnswerMethod = 'voice' | 'self';
export type SelfTestVerdict = 'memorized' | 'review';

export interface SelfTestOptions {
  /** همهٔ آیه‌ها با کاربر، یا تناوبی با سیستم (سیستم/کاربر شروع کند) */
  turnMode: TurnMode;
  /** پاسخ با تلاوت صوتی و ارزیابی خودکار، یا خودارزیابی با دکمه */
  answerMethod: AnswerMethod;
  /** پنهان‌بودن متن آیهٔ نوبت کاربر (تلاوت از حفظ) */
  hideUserText: boolean;
  /** پنهان‌بودن متن آیهٔ نوبت سیستم (تقویت حافظهٔ شنیداری) */
  hideSystemText: boolean;
  /** پیش از نوبت کاربر، تلاوت قاری برای همان آیه پخش شود */
  listenFirst: boolean;
  /** پس از تلاوت درست، خودکار به آیهٔ بعد برود */
  autoAdvanceOnPass: boolean;
  soundFeedback: boolean;
  strictness: 'easy' | 'normal' | 'strict';
  speechDialect: 'ar-EG' | 'ar-SA';
}

export const DEFAULT_SELF_TEST_OPTIONS: SelfTestOptions = {
  turnMode: 'all_me',
  answerMethod: 'self',
  hideUserText: true,
  hideSystemText: false,
  listenFirst: false,
  autoAdvanceOnPass: false,
  soundFeedback: true,
  strictness: 'normal',
  speechDialect: 'ar-EG',
};

export type Turn = 'user' | 'system';

/** نوبت آیهٔ شمارهٔ index (از ۰) در جلسه */
export function turnFor(index: number, mode: TurnMode): Turn {
  if (mode === 'all_me') return 'user';
  const systemIsEven = mode === 'system_first';
  const even = index % 2 === 0;
  return even === systemIsEven ? 'system' : 'user';
}

export interface SelfTestResult {
  verseNumber: number;
  verdict: SelfTestVerdict;
}

export interface SelfTestTally {
  tested: number;
  memorized: number;
  review: number;
  percent: number;
}

export function tallySelfTest(results: readonly SelfTestResult[]): SelfTestTally {
  const memorized = results.filter((r) => r.verdict === 'memorized').length;
  const tested = results.length;
  return {
    tested,
    memorized,
    review: tested - memorized,
    percent: tested === 0 ? 0 : Math.round((memorized / tested) * 100),
  };
}

/** تعداد آیه‌هایی که واقعاً نوبت کاربر بوده است (نوبت سیستم سنجیده نمی‌شود) */
export function userTurnCount(total: number, mode: TurnMode): number {
  let n = 0;
  for (let i = 0; i < total; i++) if (turnFor(i, mode) === 'user') n += 1;
  return n;
}
