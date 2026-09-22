import { describe, expect, it } from 'vitest';

/**
 * منطق خالص متریال‌سازی تدریجی (P3-T8).
 * از کامپوننت‌های React استفاده نمی‌کند؛ فقط قواعد chunk را آزمون می‌کند
 * تا تضمین کنیم MVP قرائت در سوره‌های بلند شکسته نمی‌شود.
 */

const VIRTUALIZE_THRESHOLD = 200;
const INITIAL_CHUNK = 40;
const CHUNK_SIZE = 30;

function nextRenderCount(prev: number, versesLength: number): number {
  if (versesLength <= VIRTUALIZE_THRESHOLD) return versesLength;
  return Math.min(prev + CHUNK_SIZE, versesLength);
}

function ensureCountFor(prev: number, target: number, versesLength: number): number {
  if (versesLength <= VIRTUALIZE_THRESHOLD) return versesLength;
  const clamped = Math.min(Math.max(target, 1), versesLength);
  return Math.min(Math.max(prev, clamped, INITIAL_CHUNK), versesLength);
}

describe('reader virtualization logic (P3-T8)', () => {
  it('short surahs are never virtualized (all verses render)', () => {
    expect(nextRenderCount(0, 7)).toBe(7); // فاتحه
    expect(nextRenderCount(0, 176)).toBe(176); // آل عمران؟ خیر 120؛ مثال 176
    expect(nextRenderCount(40, 176)).toBe(176);
  });

  it('long surah limits to total length', () => {
    expect(nextRenderCount(40, 286)).toBe(70); // بقره: chunk ۳۰
    expect(nextRenderCount(280, 286)).toBe(286); // آخرین chunk به کل سوره می‌رسد
    expect(nextRenderCount(286, 286)).toBe(286); // بی‌اثر پس از کامل شدن
  });

  it('jump targets fully materialize before scroll', () => {
    expect(ensureCountFor(40, 200, 286)).toBe(200);
    expect(ensureCountFor(40, 3, 286)).toBe(40); // پرش به جلوتر از INITIAL نیست
    expect(ensureCountFor(100, 150, 286)).toBe(150);
    expect(ensureCountFor(40, 999, 286)).toBe(286); // خارج از محدوده → کل سوره
  });
});