/**
 * موتور منطق «حالت حفظ» (P5-T4) — تمام توابع خالص و بدون ساید‌افکت جهت تست پذیری.
 *
 * جلسهٔ حفظ شامل یک بازهٔ آیه (start..end از سورهٔ جاری) است؛ هر آیه‌ی
 * «repeats» بار پخش می‌شود و بین تکرارها «gapMs» میلی‌ثانیه صبر می‌کنیم.
 * در «حالت مرور (review)»، پوشاندنِ متن تدریجی است: تکرارِ نخست کامل،
 * سپس با هر تکرار سطح پوشش ۰→۱→۲→۳ بالا می‌رود (مطابق RFP: پنهان‌سازی
 * تدریجی متن/ترجمه). در «حالت خودآزمایی (test)» سطحِ پوشش ثابت می‌ماند
 * و کاربر با دکمه‌ی «نمایش متن» خود‌ارزیابی می‌کند.
 */

export type MemoMode = 'review' | 'test';

/** سطح پوشش: ۰ = کامل (متن و ترجمه)، ۱ = پنهانِ ترجمه، ۲ = پنهانِ متن، ۳ = هر دو پنهان */
export type MaskLevel = 0 | 1 | 2 | 3;

export type MemoPhase = 'idle' | 'playing' | 'reveal' | 'done';

export interface MemoRange {
  start: number;
  end: number;
}

export interface MemoState {
  mode: MemoMode;
  range: MemoRange;
  repeats: number;
  gapMs: number;
  maskLevel: MaskLevel;
  /** شماره‌ی آیه‌ی جاری (همان verseNumber سوره) */
  currentAyah: number;
  /** شمارندهٔ تکرارِ فعلی از ۱ تا «repeats» */
  repetition: number;
  phase: MemoPhase;
  /** آمار خودآزمایی در حالت test */
  score: { correct: number; wrong: number };
}

export interface MemoSession {
  surahId: number;
  state: MemoState;
  ayahNumbers: number[];
}

export const MAX_MASK_LEVEL: MaskLevel = 3;
export const MAX_REPEATS = 10;

export function clampMaskLevel(n: number): MaskLevel {
  return Math.max(0, Math.min(MAX_MASK_LEVEL, Math.round(n))) as MaskLevel;
}

/** سطح پوشش برای تکرارِ ارسال‌شده (حالت مرور): تکرار ۱ → ۰، تکرار ۲ → ۱، ... */
export function maskLevelForRepetition(repetition: number): MaskLevel {
  return clampMaskLevel(repetition - 1);
}

export function buildAyahNumbers(range: MemoRange, surahVersesCount: number): number[] {
  const start = Math.max(1, Math.round(range.start));
  const end = Math.min(surahVersesCount, Math.round(range.end));
  if (start > end) return [];
  const out: number[] = [];
  for (let i = start; i <= end; i++) out.push(i);
  return out;
}

export function createMemoState(mode: MemoMode, range: MemoRange, repeats: number, gapMs: number): MemoState {
  return {
    mode,
    range,
    repeats: Math.max(1, Math.min(MAX_REPEATS, Math.round(repeats))),
    gapMs: Math.max(0, gapMs),
    maskLevel: mode === 'test' ? MAX_MASK_LEVEL : maskLevelForRepetition(1),
    currentAyah: range.start,
    repetition: 1,
    phase: 'idle',
    score: { correct: 0, wrong: 0 },
  };
}

/**
 * پس از پایان هر تکرارِ صوتی فراخوان شود.
 * اگر شمارندهٔ تکرار باقی باشد همان آیه را با شمارهٔ بعدی برمی‌گرداند؛
 * در غیر این صورت به آیهٔ بعد می‌رود (یا phase=done).
 */
export function advanceAfterAyahEnded(state: MemoState, ayahNumbers: number[]): MemoState {
  const idx = ayahNumbers.indexOf(state.currentAyah);
  if (state.repetition < state.repeats) {
    return {
      ...state,
      repetition: state.repetition + 1,
      maskLevel: state.mode === 'review' ? maskLevelForRepetition(state.repetition + 1) : state.maskLevel,
      phase: 'playing',
    };
  }
  const nextIdx = idx + 1;
  if (nextIdx < ayahNumbers.length) {
    const nextAyah = ayahNumbers[nextIdx];
    return {
      ...state,
      currentAyah: nextAyah,
      repetition: 1,
      maskLevel: state.mode === 'review' ? maskLevelForRepetition(1) : state.maskLevel,
      phase: 'playing',
    };
  }
  return { ...state, phase: 'done' };
}

/** در حالت خودآزمایی: شروع یک آیهٔ جدید با پوشش ثابت */
export function startTestAyah(state: MemoState): MemoState {
  return { ...state, phase: 'playing' };
}

/** در حالت خودآزمایی: نمایش متن بعد از محو */
export function revealAyah(state: MemoState): MemoState {
  return { ...state, maskLevel: 0, phase: 'reveal' };
}

/**
 * ثبت خودارزیابی و حرکت به آیهٔ بعد.
 * در حالت خودآزمایی، هر آیه فقط یک‌بار سنجیده می‌شود و آیهٔ بعدی لزوماً
 * دوباره «کاملاً پوشیده» شروع می‌شود؛ در حالت مرور، حرکت طبق شمارندهٔ
 * تکرار انجام می‌شود و پوشش از روی شمارندهٔ تکرار محاسبه می‌گردد.
 */
export function recordSelfTest(state: MemoState, ayahNumbers: number[], correct: boolean): MemoState {
  const score = {
    correct: state.score.correct + (correct ? 1 : 0),
    wrong: state.score.wrong + (correct ? 0 : 1),
  };
  if (state.mode === 'test') {
    const idx = ayahNumbers.indexOf(state.currentAyah);
    const nextIdx = idx >= 0 ? idx + 1 : 1;
    if (nextIdx >= ayahNumbers.length) {
      return { ...state, maskLevel: MAX_MASK_LEVEL, phase: 'done', score };
    }
    return {
      ...state,
      currentAyah: ayahNumbers[nextIdx],
      repetition: 1,
      maskLevel: MAX_MASK_LEVEL,
      phase: 'playing',
      score,
    };
  }
  const next = advanceAfterAyahEnded(state, ayahNumbers);
  return { ...next, score };
}

/** پرس: آیا آیهٔ جاری باید پوشیده شود؟ */
export function shouldMaskAyah(state: MemoState): boolean {
  if (state.phase === 'reveal') return false;
  return state.maskLevel >= 2; // ۲ = پنهانِ متن، ۳ = هر دو پنهان
}

/** پرس: آیا ترجمه باید پوشیده شود؟ */
export function shouldMaskTranslation(state: MemoState): boolean {
  if (state.phase === 'reveal') return false;
  return state.maskLevel === 1 || state.maskLevel === 3;
}

export function isSessionDone(state: MemoState): boolean {
  return state.phase === 'done';
}