import { describe, it, expect } from 'vitest';
import {
  estimateSurahVerses,
  audioDownloadKey,
  AUDIO_CACHE_NAME,
  AUDIO_CACHE_SOFT_LIMIT_BYTES,
  formatBytes,
  estimateSurahAudioBytes,
} from '../services/audioCacheService';

describe('Audio cache service (Phase 5 - P5-T2)', () => {
  it('estimateSurahVerses matches ALL_SURAHS known counts', () => {
    expect(estimateSurahVerses(1)).toBe(7);
    expect(estimateSurahVerses(2)).toBe(286);
    expect(estimateSurahVerses(36)).toBe(83);
    expect(estimateSurahVerses(114)).toBe(6);
    expect(estimateSurahVerses(999)).toBe(0); // سوره نامعتبر
  });

  it('audioDownloadKey is deterministic per reciter+surah', () => {
    expect(audioDownloadKey('parhizgar', 36)).toBe('parhizgar::36');
    expect(audioDownloadKey('parhizgar', 36)).toBe(audioDownloadKey('parhizgar', 36));
    expect(audioDownloadKey('minshawi', 36)).not.toBe(audioDownloadKey('parhizgar', 36));
  });

  it('cache name and soft limit are sensible constants for offline use', () => {
    expect(AUDIO_CACHE_NAME).toBe('quran-audio-v1');
    expect(AUDIO_CACHE_SOFT_LIMIT_BYTES).toBe(500 * 1024 * 1024);
  });

  it('formatBytes renders Persian-friendly units', () => {
    expect(formatBytes(0)).toBe('۰');
    expect(formatBytes(1024 * 512)).toBe('512 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 مگابایت');
  });

  it('estimateSurahAudioBytes scales with verse count (~55KB each)', () => {
    expect(estimateSurahAudioBytes('afasy', 1)).toBeCloseTo(7 * 55 * 1024, 0);
    expect(estimateSurahAudioBytes('afasy', 36)).toBeCloseTo(83 * 55 * 1024, 0);
  });
});