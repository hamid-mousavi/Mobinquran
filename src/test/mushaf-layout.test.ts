import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { MushafLayoutPack } from '../types/mushafLayout';

const pack = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../public/data/mushaf-layout-v2.json', import.meta.url)),
    'utf8'
  )
) as MushafLayoutPack;

describe('mushaf-layout pack (P3-T3, quran-qcf4 MIT data)', () => {
  it('contains all 604 pages in order', () => {
    expect(pack.id).toBe('mushaf-layout');
    expect(pack.pages.length).toBe(604);
    for (let i = 0; i < pack.pages.length; i++) {
      expect(pack.pages[i].page).toBe(i + 1);
    }
  });

  it('every page has at least one line with words', () => {
    for (const page of pack.pages) {
      expect(page.lines.length).toBeGreaterThan(0);
      for (const line of page.lines) {
        expect(line.words.length).toBeGreaterThan(0);
        expect(line.line).toBeGreaterThan(0);
      }
    }
  });

  it('every word has known type and a non-empty text', () => {
    const validTypes = new Set(['surah_header', 'bismillah', 'word', 'end', 'quarter']);
    for (const page of pack.pages) {
      for (const line of page.lines) {
        for (const w of line.words) {
          expect(validTypes.has(w.type)).toBe(true);
          expect(typeof w.text).toBe('string');
          expect(w.text.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('word/end words carry a verse_key (surah:verse)', () => {
    for (const page of pack.pages) {
      for (const line of page.lines) {
        for (const w of line.words) {
          if (w.type === 'word' || w.type === 'end') {
            expect(w.verse).toMatch(/^\d+:\d+$/);
          }
        }
      }
    }
  });

  it('page 1 covers Fatiha and page 604 covers the last three surahs', () => {
    const p1 = pack.pages[0];
    expect(p1.surahs.some((s) => s.id === 1 && s.verse_start === 1 && s.verse_end === 7)).toBe(true);
    const p604 = pack.pages[603];
    expect(p604.surahs.map((s) => s.id)).toEqual([112, 113, 114]);
  });

  it('integrity hash matches raw page data', () => {
    const { createHash } = require('node:crypto');
    const pages = pack.pages;
    const hash = createHash('sha256').update(JSON.stringify(pages)).digest('hex');
    expect(pack.integrity.value).toBe(hash);
  });

  it('uses Uthmani spelling matching verse-by-verse text (no plain-alef "إِلَاهَ")', () => {
    const words = pack.pages.flatMap((pg) => pg.lines.flatMap((l) => l.words));
    const ayatKursi = words.filter((w) => w.type === 'word' && w.verse === '2:255').map((w) => w.text);
    expect(ayatKursi.some((t) => t.includes('إِلَٰهَ'))).toBe(true);
    expect(words.some((w) => w.text.includes('إِلَاهَ'))).toBe(false);
    expect(words.some((w) => w.type === 'surah_header' && w.text.includes('االب'))).toBe(false);
  });

  it('keeps waqf marks attached to the preceding word', () => {
    const words = pack.pages.flatMap((pg) => pg.lines.flatMap((l) => l.words));
    expect(words.some((w) => w.type === 'word' && /[\u06D6-\u06DC]/.test(w.text))).toBe(true);
  });

  it('keeps glyph fields (c/f) when present, with consistent font names', () => {
    const words = pack.pages.flatMap((pg) => pg.lines.flatMap((l) => l.words));
    const glyph = words.filter((w) => w.c !== undefined || w.f !== undefined);
    // بسته‌ی بدون گلیف (قبل از اجرای generate) مجاز است؛ اگر گلیف دارد باید کامل باشد
    for (const w of glyph) {
      expect(typeof w.c).toBe('string');
      expect(w.f).toMatch(/^QCF4_Hafs_\d{2}$/);
    }
    if (glyph.length > 0) {
      const bare = words.filter((w) => (w.type === 'word' || w.type === 'end') && !w.c);
      expect(bare.length).toBe(0);
    }
  });
});