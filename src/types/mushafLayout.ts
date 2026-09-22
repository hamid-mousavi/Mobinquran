export interface MushafWord {
  type: 'surah_header' | 'bismillah' | 'word' | 'end' | 'quarter';
  text: string;
  verse?: string;
  sura?: number;
  p?: number;
}

export interface MushafLine {
  line: number;
  words: MushafWord[];
}

export interface MushafSurahMeta {
  id: number;
  name: string;
  name_arabic: string;
  verse_start: number;
  verse_end: number;
}

export interface MushafPageData {
  page: number;
  surahs: MushafSurahMeta[];
  lines: MushafLine[];
}

export interface MushafLayoutPack {
  id: string;
  version: string;
  schemaVersion: number;
  sourceName: string;
  sourceUrl: string;
  license: string;
  generatedAt: string;
  pagesIncluded: number[];
  integrity: { algorithm: string; value: string };
  pages: MushafPageData[];
}