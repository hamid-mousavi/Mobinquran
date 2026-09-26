import { beforeEach, describe, expect, it } from 'vitest';
import { getVerseReflection, saveVerseReflection } from '../services/aiReflectionStorage';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    clear: () => { store = {}; },
  };
})();

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });
  localStorageMock.clear();
});

describe('AI verse reflections', () => {
  it('stores notes independently for each verse and trims whitespace', () => {
    saveVerseReflection(2, 255, '  پیش از واکنش، صبر کنم.  ');
    saveVerseReflection(2, 256, 'با آرامش پاسخ بدهم.');

    expect(getVerseReflection(2, 255)).toBe('پیش از واکنش، صبر کنم.');
    expect(getVerseReflection(2, 256)).toBe('با آرامش پاسخ بدهم.');
  });

  it('updates and removes a verse note without affecting another verse', () => {
    saveVerseReflection(2, 255, 'یادداشت اول');
    saveVerseReflection(2, 256, 'یادداشت دیگر');
    saveVerseReflection(2, 255, 'یادداشت ویرایش‌شده');

    expect(getVerseReflection(2, 255)).toBe('یادداشت ویرایش‌شده');
    saveVerseReflection(2, 255, '');
    expect(getVerseReflection(2, 255)).toBe('');
    expect(getVerseReflection(2, 256)).toBe('یادداشت دیگر');
  });

  it('ignores corrupted stored data', () => {
    localStorageMock.setItem('mobin_ai_reflections_v1', '[null, {"surahId":2}]');

    expect(getVerseReflection(2, 255)).toBe('');
  });
});