import Dexie, { Table } from 'dexie';
import { Surah, Verse, UserBookmark, ReadingState } from '../types';
import { ALL_SURAHS } from '../data/surahs';
import { INITIAL_VERSES } from '../data/initialVerses';

export class QuranDatabase extends Dexie {
  surahs!: Table<Surah, number>;
  verses!: Table<Verse, number>;
  bookmarks!: Table<UserBookmark, number>;
  readingState!: Table<ReadingState, string>;

  constructor() {
    super('QuranMobinDB');
    this.version(1).stores({
      surahs: 'id, nameArabic, namePersian, revelationType, juzNumber, startPage',
      verses: 'id, surahId, [surahId+verseNumber], juzNumber, pageNumber',
      bookmarks: '++id, surahId, verseNumber, createdAt',
      readingState: 'id'
    });
  }

  async populateInitialData() {
    const surahsCount = await this.surahs.count();
    if (surahsCount === 0) {
      await this.surahs.bulkAdd(ALL_SURAHS);
    }

    const versesCount = await this.verses.count();
    if (versesCount === 0) {
      await this.verses.bulkAdd(INITIAL_VERSES);
    }
  }
}

export const db = new QuranDatabase();

// Seed data immediately in background on app load
db.on('ready', () => {
  return db.populateInitialData();
});
