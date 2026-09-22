import { describe, it, expect } from 'vitest';
import {
  buildAyahNumbers,
  createMemoState,
  advanceAfterAyahEnded,
  revealAyah,
  recordSelfTest,
  shouldMaskAyah,
  shouldMaskTranslation,
  isSessionDone,
  maskLevelForRepetition,
  clampMaskLevel,
  startTestAyah,
  MAX_MASK_LEVEL,
} from '../services/memorizationEngine';

const ayahNumbers = buildAyahNumbers({ start: 2, end: 5 }, 7);

describe('Memorization engine (Phase 5 - P5-T4)', () => {
  it('builds a bounded ayah range', () => {
    expect(ayahNumbers).toEqual([2, 3, 4, 5]);
    expect(buildAyahNumbers({ start: 1, end: 7 }, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(buildAyahNumbers({ start: 10, end: 12 }, 7)).toEqual([]); // خارج از محدوده
    expect(buildAyahNumbers({ start: 5, end: 2 }, 7)).toEqual([]); // معکوس
  });

  it('starts in review mode with mask level 0 and 1st repetition', () => {
    const s = createMemoState('review', { start: 2, end: 5 }, 3, 1000);
    expect(s.maskLevel).toBe(0);
    expect(s.repetition).toBe(1);
    expect(s.currentAyah).toBe(2);
    expect(shouldMaskAyah(s)).toBe(false);
  });

  it('test mode starts fully masked', () => {
    const s = createMemoState('test', { start: 2, end: 5 }, 2, 500);
    expect(s.maskLevel).toBe(3);
    expect(shouldMaskAyah(s)).toBe(true);
    expect(shouldMaskTranslation(s)).toBe(true);
  });

  it('review mode increases mask gradually per repetition', () => {
    let s = createMemoState('review', { start: 2, end: 5 }, 4, 500);
    expect([s.maskLevel, s.repetition]).toEqual([0, 1]);
    s = advanceAfterAyahEnded(s, ayahNumbers);
    expect([s.maskLevel, s.repetition]).toEqual([1, 2]); // 2nd: hide translation
    s = advanceAfterAyahEnded(s, ayahNumbers);
    expect([s.maskLevel, s.repetition]).toEqual([2, 3]); // 3rd: hide arabic
    expect(shouldMaskAyah(s)).toBe(true);
    s = advanceAfterAyahEnded(s, ayahNumbers);
    expect([s.maskLevel, s.repetition]).toEqual([3, 4]); // 4th: hide both
    // بعد از پایان تکرارهای آیهٔ ۲ → آیهٔ ۳ با repetition=1 و mask=0
    s = advanceAfterAyahEnded(s, ayahNumbers);
    expect([s.currentAyah, s.repetition, s.maskLevel]).toEqual([3, 1, 0]);
  });

  it('finishes when the last ayah of the range completes all repetitions', () => {
    let s = createMemoState('review', { start: 5, end: 5 }, 2, 0);
    s = advanceAfterAyahEnded(s, ayahNumbers);
    expect(isSessionDone(s)).toBe(false);
    s = advanceAfterAyahEnded(s, ayahNumbers);
    expect(isSessionDone(s)).toBe(true);
  });

  it('reveal in test mode discloses text once and records score', () => {
    let s = createMemoState('test', { start: 2, end: 5 }, 1, 0);
    s = revealAyah(s);
    expect(s.maskLevel).toBe(0);
    expect(shouldMaskAyah(s)).toBe(false);
    expect(shouldMaskTranslation(s)).toBe(false);
    s = recordSelfTest({ ...s, maskLevel: 3, phase: 'playing' }, ayahNumbers, true);
    expect(s.score).toEqual({ correct: 1, wrong: 0 });
    expect(s.currentAyah).toBe(3);
    s = recordSelfTest({ ...s, maskLevel: 3, phase: 'playing' }, ayahNumbers, false);
    expect(s.score).toEqual({ correct: 1, wrong: 1 });
  });

  // رگرسیون P5-T4: بعد از reveal و رفتن به آیهٔ بعد، پوشش باید به حداکثر بازگردد
  it('re-masks next ayah in test mode after a reveal', () => {
    let s = createMemoState('test', { start: 2, end: 4 }, 1, 0);
    // مرحلهٔ ۱: نمایش متن (reveal) — mask صفر می‌شود
    s = revealAyah(s);
    expect(s.maskLevel).toBe(0);
    // مرحلهٔ ۲: ثبت پاسخ و رفتن به آیهٔ بعد
    s = recordSelfTest(s, ayahNumbers, true);
    expect(s.currentAyah).toBe(3);
    // آیهٔ بعدی باید دوباره کاملاً پوشیده شروع شود
    expect(s.maskLevel).toBe(MAX_MASK_LEVEL);
    expect(shouldMaskAyah(s)).toBe(true);
    expect(shouldMaskTranslation(s)).toBe(true);
  });

  it('clamps repeats and mask level', () => {
    expect(createMemoState('review', { start: 1, end: 3 }, 99, 0).repeats).toBe(10);
    expect(createMemoState('review', { start: 1, end: 3 }, 0, 0).repeats).toBe(1);
    expect(clampMaskLevel(9)).toBe(3);
    expect(clampMaskLevel(-5)).toBe(0);
    expect(maskLevelForRepetition(1)).toBe(0);
    expect(maskLevelForRepetition(4)).toBe(3);
  });

  it('keeps gapMs in state for timing control', () => {
    const s = createMemoState('review', { start: 1, end: 3 }, 5, 1500);
    expect(s.gapMs).toBe(1500);
    const s2 = createMemoState('test', { start: 1, end: 3 }, 2, -100);
    expect(s2.gapMs).toBe(0); // منفی → صفر
  });

  it('startTestAyah returns to playing phase in test mode', () => {
    const s = createMemoState('test', { start: 2, end: 5 }, 2, 800);
    const t = startTestAyah(s);
    expect(t.phase).toBe('playing');
    expect(t.maskLevel).toBe(3);
  });
});