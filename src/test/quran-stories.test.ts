import { describe, expect, it } from 'vitest';
import { QURAN_STORIES } from '../data/quranStories';

describe('Quran Stories Dataset and Quizzes', () => {
  it('contains essential Quranic stories with complete narratives', () => {
    expect(QURAN_STORIES.length).toBeGreaterThanOrEqual(6);

    const yusuf = QURAN_STORIES.find((s) => s.id === 'yusuf');
    expect(yusuf).toBeDefined();
    expect(yusuf?.surahId).toBe(12);
    expect(yusuf?.narrative.length).toBeGreaterThanOrEqual(3);
    expect(yusuf?.wisdoms.length).toBeGreaterThanOrEqual(3);
    expect(yusuf?.questions.length).toBeGreaterThanOrEqual(3);
  });

  it('every question has valid options and in-range correctIndex', () => {
    for (const story of QURAN_STORIES) {
      for (const q of story.questions) {
        expect(q.prompt).toBeTruthy();
        expect(q.options.length).toBeGreaterThanOrEqual(3);
        expect(q.correctIndex).toBeGreaterThanOrEqual(0);
        expect(q.correctIndex).toBeLessThan(q.options.length);
        expect(q.explanation).toBeTruthy();
        expect(q.verseNumber).toBeGreaterThan(0);
      }
    }
  });

  it('contains stories for kahf, khidr, sulaiman and maryam', () => {
    const storyIds = QURAN_STORIES.map((s) => s.id);
    expect(storyIds).toContain('kahf');
    expect(storyIds).toContain('musa_khidr');
    expect(storyIds).toContain('sulaiman');
    expect(storyIds).toContain('maryam');
    expect(storyIds).toContain('yunus');
  });
});
