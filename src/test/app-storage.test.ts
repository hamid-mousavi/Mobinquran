import { describe, it, expect, beforeEach } from 'vitest';
import { appStorage, STORAGE_KEYS } from '../services/storage/appStorage';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      store = {};
    },
  };
})();

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });
  Object.defineProperty(globalThis, 'window', {
    value: { localStorage: localStorageMock },
    writable: true,
  });
  localStorageMock.clear();
});

describe('SafeStorageService (appStorage)', () => {
  it('stores and retrieves strings correctly', () => {
    const success = appStorage.setItem(STORAGE_KEYS.SETTINGS, 'my-theme');
    expect(success).toBe(true);
    expect(appStorage.getItem(STORAGE_KEYS.SETTINGS)).toBe('my-theme');
  });

  it('stores and retrieves JSON objects correctly', () => {
    const data = { darkMode: true, arabicFontSize: 32 };
    appStorage.setItem('test_obj_key', data);
    const retrieved = appStorage.getItem<typeof data>('test_obj_key');
    expect(retrieved).toEqual(data);
  });

  it('returns defaultValue if key does not exist', () => {
    const result = appStorage.getItem('non_existent_key', 'fallback_value');
    expect(result).toBe('fallback_value');
  });

  it('handles corrupted JSON gracefully without crashing', () => {
    localStorageMock.setItem('corrupted_key', '{not-a-valid-json');
    const result = appStorage.getItem('corrupted_key');
    expect(result).toBe('{not-a-valid-json');
  });

  it('removes items correctly', () => {
    appStorage.setItem('temp_key', 'to_delete');
    expect(appStorage.getItem('temp_key')).toBe('to_delete');
    appStorage.removeItem('temp_key');
    expect(appStorage.getItem('temp_key')).toBeNull();
  });
});
