import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';

describe('Phase 2 — Content Integrity & Local Quran Source', () => {
  const app = createApp();

  it('serves surah 1 from local dataset with correct verses count and no fake tafsir', async () => {
    const res = await request(app).get('/api/quran/surah/1');
    expect(res.status).toBe(200);
    expect(res.body.surahId).toBe(1);
    expect(res.body.count).toBe(7);
    expect(Array.isArray(res.body.verses)).toBe(true);
    expect(res.body.verses.length).toBe(7);

    // Verify verse 1
    const v1 = res.body.verses[0];
    expect(v1.verseNumber).toBe(1);
    expect(v1.textArabic).toContain('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ');
    expect(v1.translationMakarem).toBeTruthy();

    // Verify no fake constant tafsir strings are attached
    for (const verse of res.body.verses) {
      expect(verse.tafsirNemoneh).toBeUndefined();
      expect(verse.tafsirMizan).toBeUndefined();
    }
  });

  it('serves surah 2 with clean text where verse 1 does not start with redundant Bismillah', async () => {
    const res = await request(app).get('/api/quran/surah/2');
    expect(res.status).toBe(200);
    expect(res.body.surahId).toBe(2);
    expect(res.body.count).toBe(286);

    const v1 = res.body.verses[0];
    expect(v1.verseNumber).toBe(1);
    expect(v1.textArabic).toBe('الٓمٓ');
    expect(v1.textArabic.startsWith('بِسْمِ')).toBe(false);
  });

  it('performs local search in Arabic and translation without third-party network dependency', async () => {
    const res = await request(app).get('/api/quran/search?q=الرحمن');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('results');
    expect(res.body.results.length).toBeGreaterThan(0);
    expect(res.body.results[0]).toHaveProperty('surahId');
    expect(res.body.results[0]).toHaveProperty('surahNameArabic');
    expect(res.body.results[0]).toHaveProperty('verseNumber');
  });

  it('confirms deprecated /api/ai/tadabbur dead route is completely removed', async () => {
    const res = await request(app).post('/api/ai/tadabbur').send({});
    // Should be 404 Not Found since it is removed
    expect(res.status).toBe(404);
  });
});
