import { describe, it, expect } from 'vitest';
import {
  HELP_SYSTEM_PROMPT,
  buildHelpUserPrompt,
  helpCacheKey,
  validateHelpOutput,
  validateHelpRequest,
} from '../../server/memorizationHelp';
import { containsQuranicText, splitDisplayWords } from '../services/memorization/helpTypes';

const base = {
  surahId: 4,
  verseNumber: 17,
  surahName: 'النساء',
  lapses: 4,
  targetText: 'إِنَّ اللَّهَ كَانَ عَلِيمًا حَكِيمًا',
  previousText: 'مقدمة سابقة',
  nextText: 'لاحقة',
  similar: [{ ref: '4:26', text: 'إِنَّ اللَّهَ كَانَ غَفُورًا رَحِيمًا', kind: 'same_start' }],
};
const req = () => {
  const v = validateHelpRequest(base);
  if (!v.ok) throw new Error('fixture invalid');
  return v.data;
};

describe('memorizationHelp request validation (Stage 3c)', () => {
  it('accepts a well-formed request and defaults lapses', () => {
    const ok = validateHelpRequest({ ...base, lapses: undefined, similar: undefined });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect([ok.data.lapses, ok.data.similar]).toEqual([0, []]);
  });

  it('rejects malformed input', () => {
    for (const bad of [
      null, [], 'x',
      { ...base, surahId: 0 },
      { ...base, verseNumber: 287 },
      { ...base, targetText: '   ' },
      { ...base, targetText: 'ا'.repeat(1300) },
      { ...base, lapses: -1 },
      { ...base, lapses: 1.5 },
      { ...base, previousText: 5 },
      { ...base, similar: Array(5).fill(base.similar[0]) },
      { ...base, similar: [{ ref: 'abc', text: 'x', kind: 'same_start' }] },
      { ...base, similar: [{ ref: '1:1', text: 'x', kind: 'weird' }] },
    ]) {
      expect(validateHelpRequest(bad).ok).toBe(false);
    }
  });
});

describe('memorizationHelp prompt and output (Stage 3c)', () => {
  it('numbers the target words and delimits the verse data', () => {
    const p = buildHelpUserPrompt(req());
    expect(p).toContain('=== BEGIN VERSE DATA ===');
    expect(p).toContain('1) إِنَّ');
    expect(p).toContain('5) حَكِيمًا');
    expect(p).toContain('4:26 (same_start)');
    expect(HELP_SYSTEM_PROMPT).toContain('هیچ آیه یا عبارت عربی قرآن را از خودت ننویس');
  });

  it('keeps only valid keyword numbers and only the provided similar refs', () => {
    const out = validateHelpOutput(
      {
        link_to_previous: 'پیوند معنایی کوتاه',
        keyword_indexes: [5, 2, 2, 9, 0, 'x', 3.5],
        memory_tip: '  به پایان آیه توجه کن  ',
        confusions: [
          { ref: '4:26', tip: 'پایان‌ها فرق دارد' },
          { ref: '9:99', tip: 'ارجاع ساختگی' },
          { ref: '4:26', tip: 'تکراری' },
        ],
        practice_plan: 'سه بار با متن پنهان',
      },
      req()
    );
    expect(out).toEqual({
      linkToPrevious: 'پیوند معنایی کوتاه',
      keywordIndexes: [2, 5],
      memoryTip: 'به پایان آیه توجه کن',
      confusions: [{ ref: '4:26', tip: 'پایان‌ها فرق دارد' }],
      practicePlan: 'سه بار با متن پنهان',
    });
  });

  it('drops fields that quote Quranic text and refuses output without a usable tip', () => {
    const quoted = validateHelpOutput(
      { memory_tip: 'نکته', link_to_previous: 'بخوان: إِنَّ اللَّهَ كَانَ', practice_plan: 'x', keyword_indexes: [1] },
      req()
    );
    expect(quoted?.linkToPrevious).toBe('');
    expect(validateHelpOutput({ memory_tip: 'إِنَّ اللَّهَ كَانَ عَلِيمًا' }, req())).toBeNull();
    expect(validateHelpOutput({ keyword_indexes: [1] }, req())).toBeNull();
    expect(validateHelpOutput(null, req())).toBeNull();
    expect(validateHelpOutput([], req())).toBeNull();
  });

  it('hides the link when no previous ayah was given', () => {
    const r = validateHelpRequest({ ...base, previousText: undefined });
    if (!r.ok) throw new Error('fixture');
    expect(validateHelpOutput({ memory_tip: 'نکته', link_to_previous: 'پیوند' }, r.data)?.linkToPrevious).toBe('');
  });

  it('builds a stable cache key that ignores lapses but not the similar set', () => {
    const a = req();
    const b = { ...req(), lapses: 9 };
    const c = { ...req(), similar: [] };
    expect(helpCacheKey(a)).toBe(helpCacheKey(b));
    expect(helpCacheKey(a) === helpCacheKey(c)).toBe(false);
    expect(helpCacheKey(a)).toHaveLength(64);
  });

  it('shares word splitting and Quranic-text detection with the client', () => {
    expect(splitDisplayWords('  إِنَّ   اللَّهَ  ')).toEqual(['إِنَّ', 'اللَّهَ']);
    expect(containsQuranicText('نکته')).toBe(false);
    expect(containsQuranicText('بِسْمِ')).toBe(true);
    expect(containsQuranicText('یک علامت َ')).toBe(false);
  });
});
