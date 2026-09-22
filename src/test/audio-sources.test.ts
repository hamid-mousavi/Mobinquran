import { describe, it, expect } from 'vitest';
import {
  padVerseKey,
  globalVerseNumber,
  getAudioSourceUrl,
  getSourcesForReciter,
  AudioSource,
} from '../services/audioSources';
import { ALL_SURAHS } from '../data/surahs';

function surahCount(id: number): number {
  return ALL_SURAHS[id - 1]?.versesCount ?? 0;
}

describe('AudioSource layer (Phase 5 - P5-T1)', () => {
  it('padVerseKey produces 6-digit everyayah keys', () => {
    expect(padVerseKey(1, 1)).toBe('001001');
    expect(padVerseKey(2, 286)).toBe('002286');
    expect(padVerseKey(114, 6)).toBe('114006');
  });

  it('globalVerseNumber sums previous surahs from ALL_SURAHS', () => {
    expect(globalVerseNumber(1, 1)).toBe(1);
    expect(globalVerseNumber(2, 1)).toBe(surahCount(1) + 1); // 8
    expect(globalVerseNumber(114, 6)).toBe(6236);
    expect(globalVerseNumber(114, 1)).toBe(6236 - 6 + 1);
  });

  it('each reciter has 3 sorted fallback sources', () => {
    for (const rid of ['parhizgar', 'abdulbasit', 'minshawi', 'afasy'] as const) {
      const list = getSourcesForReciter(rid);
      expect(list.length).toBe(3);
      expect(list[0].priority).toBe(0);
      expect(list[1].priority).toBe(1);
      expect(list[2].priority).toBe(2);
      expect(list.map((s) => s.priority)).toEqual([0, 1, 2]);
    }
  });

  it('parhizgar everyayah URL follows everyayah pattern', () => {
    const url = getAudioSourceUrl('parhizgar', 2, 286, 0);
    expect(url).toBe('https://everyayah.com/data/Parhizgar_48kbps/002286.mp3');
  });

  it('alquran.cloud uses global verse number in URL', () => {
    // آیه ۱۱۴:۶ = آیه ۶ ناس = آیه ۶۲۳۶ام قرآن — GCCD
    const url = getAudioSourceUrl('afasy', 114, 6, 2);
    expect(url).toBe('https://cdn.islamic.network/quran/audio/64/ar.alafasy/6236.mp3');
  });

  it('maqra fallback URL uses 6-digit key on Hugging Face', () => {
    const url = getAudioSourceUrl('abdulbasit', 2, 286, 1);
    expect(url).toBe(
      'https://huggingface.co/datasets/maqra-project/abdul-basit-murattal-64kbps/resolve/main/002286.mp3'
    );
  });

  it('everyayah primary URL for a present Minshawi verse is non-null', () => {
    expect(getAudioSourceUrl('minshawi', 2, 286, 0)).toBe(
      'https://everyayah.com/data/Menshawi_32kbps/002286.mp3'
    );
  });

  it('everyayah returns null for verses missing from Menshawi_32kbps', () => {
    expect(getAudioSourceUrl('minshawi', 77, 5, 0)).toBeNull();
    expect(getAudioSourceUrl('minshawi', 56, 30, 0)).toBeNull();
    expect(getAudioSourceUrl('minshawi', 53, 16, 0)).toBeNull();
  });

  it('fallback URL is available for missing Minshawi verses', () => {
    expect(getAudioSourceUrl('minshawi', 77, 5, 1)).toBe(
      'https://huggingface.co/datasets/maqra-project/mohamed-siddiq-al-minshawi-murattal-128kbps/resolve/main/077005.mp3'
    );
  });

  it('out-of-range source index returns null', () => {
    expect(getAudioSourceUrl('parhizgar', 1, 1, 5)).toBeNull();
  });

  it('every source carries honest attribution', () => {
    const all: AudioSource[] = [];
    for (const rid of ['parhizgar', 'abdulbasit', 'minshawi', 'afasy'] as const) {
      for (const src of getSourcesForReciter(rid)) {
        all.push(src);
      }
    }
    expect(all.length).toBe(12);
    for (const src of all) {
      expect(src.attribution.length).toBeGreaterThan(0);
      expect(src.license.length).toBeGreaterThan(0);
      expect(src.host).toMatch(/^(everyayah|islamicNetwork|maqra)$/);
    }
  });
});