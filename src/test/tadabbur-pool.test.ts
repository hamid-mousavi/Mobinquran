import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TADABBUR_POOL } from '../data/tadabburPool';

// بستهٔ واقعی قرآن پروژه؛ تضمین می‌کند هر ارجاع مجموعهٔ تدبر واقعاً وجود دارد
const core = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/quran-core-v1.json'), 'utf8')) as {
  verses: Array<{ surahId: number; verseNumber: number; textArabic: string; translationMakarem: string }>;
};
const byRef = new Map(core.verses.map((v) => [`${v.surahId}:${v.verseNumber}`, v]));

describe('tadabbur pool (Stage 4b)', () => {
  it('has a healthy size and no duplicate ayahs', () => {
    expect(TADABBUR_POOL.length).toBeGreaterThanOrEqual(40);
    const refs = TADABBUR_POOL.map((p) => `${p.surahId}:${p.verseNumber}`);
    expect(new Set(refs).size).toBe(refs.length);
  });

  it('references only ayahs that exist in the bundled Quran, each with Arabic text and a translation', () => {
    for (const p of TADABBUR_POOL) {
      const v = byRef.get(`${p.surahId}:${p.verseNumber}`);
      expect(!!v).toBe(true);
      expect((v?.textArabic ?? '').length).toBeGreaterThan(0);
      expect((v?.translationMakarem ?? '').length).toBeGreaterThan(0);
      expect(p.theme.trim().length).toBeGreaterThan(0);
    }
  });

  it('keeps every theme unique so two days never show the same label', () => {
    const themes = TADABBUR_POOL.map((p) => p.theme);
    expect(new Set(themes).size).toBe(themes.length);
  });
});
