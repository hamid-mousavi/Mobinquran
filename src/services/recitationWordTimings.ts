import type { ReciterId } from './audioSources';

export type WordTimingSegment = readonly [
  wordStartIndex: number,
  wordEndIndex: number,
  startMs: number,
  endMs: number,
];

export interface ActiveWordRange {
  surahId: number;
  verseNumber: number;
  wordStartIndex: number;
  wordEndIndex: number;
}

export function mapVisibleWordIndexToTimingIndex(
  surahId: number,
  verseNumber: number,
  visibleWordIndex: number
): number {
  // در رعد:۱ و حجر:۱، منبع زمان‌بندی حروف مقطعه را به چند واژهٔ صوتی شکسته است.
  if ((surahId === 12 || surahId === 15) && verseNumber === 1 && visibleWordIndex > 0) {
    return visibleWordIndex + 1;
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

let husaryTimingIndexPromise: Promise<Map<string, WordTimingSegment[]>> | null = null;

async function loadHusaryTimingIndex(): Promise<Map<string, WordTimingSegment[]>> {
  if (!husaryTimingIndexPromise) {
    husaryTimingIndexPromise = fetch('/data/word-timings/husary-64kbps.json')
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
        husaryTimingIndexPromise = null;
        throw error;
      });
  }

  return husaryTimingIndexPromise;
}

export async function loadWordTimingSegments(
  reciterId: ReciterId,
  surahId: number,
  verseNumber: number
): Promise<WordTimingSegment[] | null> {
  if (reciterId !== 'husary') return null;

  try {
    const index = await loadHusaryTimingIndex();
    return index.get(`${surahId}:${verseNumber}`) ?? null;
  } catch {
    return null;
  }
}

export function findActiveWordRange(
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
    surahId,
    verseNumber,
    wordStartIndex: segment[0],
    wordEndIndex: segment[1],
  };
}
