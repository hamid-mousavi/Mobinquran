import type { ReciterId } from './audioSources';

export type WordTimingSegment = readonly [
  wordStartIndex: number,
  wordEndIndex: number,
  startMs: number,
  endMs: number,
];

export interface ActiveWordRange {
  reciterId: ReciterId;
  surahId: number;
  verseNumber: number;
  wordStartIndex: number;
  wordEndIndex: number;
}

export function mapVisibleWordIndexToTimingIndex(
  reciterId: ReciterId,
  surahId: number,
  verseNumber: number,
  visibleWordIndex: number
): number {
  // زمان‌بندی حصری و منشاوی در چند آیه، حروف مقطعه را جدا از متن نمایشی می‌شمارند.
  if (verseNumber !== 1 || visibleWordIndex === 0) return visibleWordIndex;
  if (reciterId === 'husary' && (surahId === 12 || surahId === 15)) return visibleWordIndex + 1;
  if (reciterId === 'minshawi') {
    if (surahId === 10) return visibleWordIndex + 2;
    if (surahId === 14 || surahId === 15) return visibleWordIndex + 1;
  }
  return visibleWordIndex;
}

interface VerseWordTiming {
  surahId: number;
  verseNumber: number;
  segments: WordTimingSegment[];
}

interface WordTimingDataset {
  verses: VerseWordTiming[];
}

const timingIndexPromises: Partial<Record<ReciterId, Promise<Map<string, WordTimingSegment[]>>>> = {};

async function loadTimingIndex(reciterId: 'husary' | 'minshawi' | 'abdulbasit'): Promise<Map<string, WordTimingSegment[]>> {
  const file = {
    husary: 'husary-64kbps.json',
    minshawi: 'minshawi-murattal-128kbps.json',
    abdulbasit: 'abdul-basit-murattal-64kbps.json',
  }[reciterId];
  if (!timingIndexPromises[reciterId]) {
    timingIndexPromises[reciterId] = fetch(`/data/word-timings/${file}`)
      .then((response) => {
        if (!response.ok) throw new Error(`Word timing data request failed: ${response.status}`);
        return response.json() as Promise<WordTimingDataset>;
      })
      .then((dataset) => new Map(
        dataset.verses.map((verse) => [
          `${verse.surahId}:${verse.verseNumber}`,
          verse.segments,
        ])
      ))
      .catch((error) => {
        delete timingIndexPromises[reciterId];
        throw error;
      });
  }

  return timingIndexPromises[reciterId]!;
}

export function hasWordTimingsForSource(reciterId: ReciterId, sourceIndex: number | null): boolean {
  return (reciterId === 'husary' && sourceIndex === 0)
    || (reciterId === 'minshawi' && sourceIndex === 1)
    || (reciterId === 'abdulbasit' && (sourceIndex === 0 || sourceIndex === 1));
}

export async function loadWordTimingSegments(
  reciterId: ReciterId,
  surahId: number,
  verseNumber: number
): Promise<WordTimingSegment[] | null> {
  if (reciterId !== 'husary' && reciterId !== 'minshawi' && reciterId !== 'abdulbasit') return null;

  try {
    const index = await loadTimingIndex(reciterId);
    return index.get(`${surahId}:${verseNumber}`) ?? null;
  } catch {
    return null;
  }
}

export function findActiveWordRange(
  reciterId: ReciterId,
  segments: WordTimingSegment[] | null,
  surahId: number,
  verseNumber: number,
  currentTimeMs: number
): ActiveWordRange | null {
  if (!segments) return null;

  const segment = segments.find(([, , startMs, endMs]) =>
    currentTimeMs >= startMs && currentTimeMs < endMs
  );
  if (!segment) return null;

  return {
    reciterId,
    surahId,
    verseNumber,
    wordStartIndex: segment[0],
    wordEndIndex: segment[1],
  };
}
