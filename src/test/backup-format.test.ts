import { describe, it, expect } from 'vitest';
import {
  BACKUP_APP_ID,
  BACKUP_LOCAL_KEYS,
  BACKUP_VERSION,
  MAX_BACKUP_TEXT_LENGTH,
  parseBackupText,
  validateBackup,
} from '../services/backup/backupFormat';

const TODAY = '2026-10-18';
const NOW = 1_800_000_000_000;

const base = () => ({
  app: BACKUP_APP_ID,
  version: BACKUP_VERSION,
  exportedAt: '2026-10-18T10:00:00.000Z',
  tables: { ayahProgress: [], bookmarks: [], khatmPlans: [], readingState: [] },
  local: {},
});

describe('backupFormat — validation (Stage 0)', () => {
  it('accepts a minimal valid backup', () => {
    const r = validateBackup(base(), TODAY, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.dropped).toBe(0);
  });

  it('rejects wrong shape, app id, version and missing tables', () => {
    expect(validateBackup(null, TODAY, NOW).ok).toBe(false);
    expect(validateBackup([], TODAY, NOW).ok).toBe(false);
    expect(validateBackup({ ...base(), app: 'other' }, TODAY, NOW).ok).toBe(false);
    expect(validateBackup({ ...base(), version: 99 }, TODAY, NOW).ok).toBe(false);
    expect(validateBackup({ app: BACKUP_APP_ID, version: BACKUP_VERSION }, TODAY, NOW).ok).toBe(false);
  });

  it('reports parse problems in Persian instead of throwing', () => {
    const empty = parseBackupText('   ', TODAY, NOW);
    const broken = parseBackupText('{not json', TODAY, NOW);
    const huge = parseBackupText('x'.repeat(MAX_BACKUP_TEXT_LENGTH + 1), TODAY, NOW);
    for (const r of [empty, broken, huge]) {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.length).toBeGreaterThan(5);
    }
    expect(parseBackupText(JSON.stringify(base()), TODAY, NOW).ok).toBe(true);
  });

  it('drops invalid items and counts them', () => {
    const raw = {
      ...base(),
      tables: {
        ayahProgress: [
          { key: '2:255', memorized: true },
          { key: '999:1', memorized: true },
          { key: '3:3', memorized: false, inReview: false },
          'junk',
        ],
        bookmarks: [
          { surahId: 2, verseNumber: 5, createdAt: 10, note: 'n' },
          { surahId: 0, verseNumber: 5 },
          { surahId: 'x' },
        ],
        khatmPlans: [
          { id: 'p1', type: 'custom', targetDays: 60, completedPages: [5, 5, 3, 0, 700, 'a'], isActive: true },
          { id: '', type: 'custom', targetDays: 60 },
          { id: 'p2', type: 'custom', targetDays: 0 },
        ],
        readingState: [{ id: 'last_read', surahId: 2, verseNumber: 1, pageNumber: 2 }, { id: 'bad' }],
      },
    };
    const r = validateBackup(raw, TODAY, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.tables.ayahProgress.map((p) => p.key)).toEqual(['2:255']);
    expect(r.data.tables.bookmarks).toHaveLength(1);
    expect(r.data.tables.khatmPlans).toHaveLength(1);
    expect(r.data.tables.khatmPlans[0].completedPages).toEqual([3, 5]); // یکتا، مرتب، در بازهٔ ۱..۶۰۴
    expect(r.data.tables.readingState).toHaveLength(1);
    expect(r.dropped).toBe(3 + 2 + 2 + 1);
  });

  it('only keeps whitelisted localStorage keys with string values', () => {
    const [allowed] = BACKUP_LOCAL_KEYS;
    const raw = {
      ...base(),
      local: {
        [allowed]: '[1,2]',
        mobin_ai_chat_history_v1: 'private chat',
        __proto__x: 'x',
        quran_last_read: 42,
      },
    };
    const r = validateBackup(raw, TODAY, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.keys(r.data.local)).toEqual([allowed]);
    expect(r.dropped).toBe(1); // مقدار غیررشته‌ای برای یک کلید مجاز
  });
});
