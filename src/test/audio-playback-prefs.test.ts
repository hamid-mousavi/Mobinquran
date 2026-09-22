import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveAudioResumePosition,
  loadAudioResumePosition,
  clearAudioResumePosition,
  saveSleepTimerPrefs,
  loadSleepTimerPrefs,
  formatSleepTimeRemaining,
} from '../services/audioPlaybackPrefs';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
  };
})();

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });
  localStorageMock.clear();
});

describe('Audio playback prefs (Phase 5 - P5-T3 resume/sleep)', () => {
  it('round-trips resume position', () => {
    saveAudioResumePosition({ surahId: 36, verseNumber: 12, reciterId: 'parhizgar', playbackRate: 1.25, updatedAt: 1 });
    const pos = loadAudioResumePosition();
    expect(pos).not.toBeNull();
    expect(pos!.surahId).toBe(36);
    expect(pos!.verseNumber).toBe(12);
    expect(pos!.reciterId).toBe('parhizgar');
    expect(pos!.playbackRate).toBe(1.25);
  });

  it('returns null when nothing stored or corrupted', () => {
    expect(loadAudioResumePosition()).toBeNull();
    localStorageMock.setItem('quran_audio_resume', '{bad json');
    expect(loadAudioResumePosition()).toBeNull();
  });

  it('clearAudioResumePosition removes stored position', () => {
    clearAudioResumePosition();
    expect(loadAudioResumePosition()).toBeNull();
  });

  it('round-trips sleep timer prefs', () => {
    saveSleepTimerPrefs({ mode: 'time', value: 30 });
    expect(loadSleepTimerPrefs()).toEqual({ mode: 'time', value: 30 });
    saveSleepTimerPrefs({ mode: 'verses', value: 10 });
    expect(loadSleepTimerPrefs()).toEqual({ mode: 'verses', value: 10 });
  });

  it('rejects invalid sleep prefs', () => {
    localStorageMock.setItem('quran_audio_sleep_prefs', '{"mode":"derp","value":5}');
    expect(loadSleepTimerPrefs()).toBeNull();
    localStorageMock.setItem('quran_audio_sleep_prefs', '{"mode":"time"}');
    expect(loadSleepTimerPrefs()).toBeNull();
  });

  it('formats remaining sleep time in Persian', () => {
    expect(formatSleepTimeRemaining(90)).toBe('۱ دقیقه و ۳۰ ثانیه');
    expect(formatSleepTimeRemaining(3600)).toBe('۱ ساعت');
    expect(formatSleepTimeRemaining(30)).toBe('۳۰ ثانیه');
  });
});