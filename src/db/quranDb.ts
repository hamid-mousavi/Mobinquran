import Dexie, { Table } from 'dexie';
import { Surah, Verse, UserBookmark, ReadingState, ContentMetadata } from '../types';
import { ALL_SURAHS } from '../data/surahs';

export class QuranDatabase extends Dexie {
  surahs!: Table<Surah, number>;
  verses!: Table<Verse, number>;
  bookmarks!: Table<UserBookmark, number>;
  readingState!: Table<ReadingState, string>;
  contentMetadata!: Table<ContentMetadata, string>;

  constructor() {
    super('QuranMobinDB');

    this.version(1).stores({
      surahs: 'id, nameArabic, namePersian, revelationType, juzNumber, startPage',
      verses: 'id, surahId, [surahId+verseNumber], juzNumber, pageNumber',
      bookmarks: '++id, surahId, verseNumber, createdAt',
      readingState: 'id',
    });

    this.version(2).stores({
      surahs: 'id, nameArabic, namePersian, revelationType, juzNumber, startPage',
      verses: 'id, surahId, [surahId+verseNumber], juzNumber, pageNumber',
      bookmarks: '++id, surahId, verseNumber, createdAt',
      readingState: 'id',
      contentMetadata: 'id, lastSyncedAt',
    });

    // Version 3: افزودن ایندکس یکتا بر روی بوکمارک‌ها و ایندکس‌های تکمیلی آیات
    this.version(3).stores({
      surahs: 'id, nameArabic, namePersian, revelationType, juzNumber, startPage',
      verses: 'id, surahId, [surahId+verseNumber], juzNumber, pageNumber, hizbQuarter',
      bookmarks: '++id, [surahId+verseNumber], surahId, verseNumber, createdAt',
      readingState: 'id',
      contentMetadata: 'id, lastSyncedAt, schemaVersion',
    });
  }

  async populateInitialData() {
    const surahsCount = await this.surahs.count();
    if (surahsCount === 0) {
      await this.surahs.bulkAdd(ALL_SURAHS);
    }
  }
}

export const db = new QuranDatabase();

// Seed surahs immediately in background on app load
db.on('ready', () => {
  return db.populateInitialData();
});
