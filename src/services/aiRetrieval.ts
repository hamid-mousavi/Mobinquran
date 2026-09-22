import { Verse } from '../types';
import { searchQuranOffline } from './searchEngine';

export interface AiCandidateForRequest {
  ref: string;
  text_fa: string;
  verse: Verse;
}

function meaningfulTerms(question: string): string[] {
  return question
    .replace(/[؟?!،؛:()\[\]{}"«»]/g, ' ')
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3)
    .slice(0, 6);
}

function toCandidate(result: Awaited<ReturnType<typeof searchQuranOffline>>['results'][number]): AiCandidateForRequest {
  return {
    ref: `${result.surahId}:${result.verseNumber}`,
    text_fa: result.translation,
    verse: {
      id: result.id,
      surahId: result.surahId,
      verseNumber: result.verseNumber,
      juzNumber: result.juzNumber,
      pageNumber: result.pageNumber,
      textArabic: result.textArabic,
      translationMakarem: result.translation,
      translationFooladvand: '',
      translationAnsarian: '',
    },
  };
}

export async function retrieveAiCandidates(question: string, currentVerse?: Verse | null): Promise<AiCandidateForRequest[]> {
  const candidates = new Map<string, AiCandidateForRequest>();
  const queries = [question, ...meaningfulTerms(question)];

  if (currentVerse) {
    const ref = `${currentVerse.surahId}:${currentVerse.verseNumber}`;
    candidates.set(ref, {
      ref,
      text_fa: currentVerse.translationMakarem,
      verse: currentVerse,
    });
  }

  for (const query of queries) {
    if (candidates.size >= 12) break;
    const response = await searchQuranOffline({ query, scope: 'all', maxResults: 12 });
    for (const result of response.results) {
      if (candidates.size >= 12) break;
      const candidate = toCandidate(result);
      if (!candidates.has(candidate.ref)) candidates.set(candidate.ref, candidate);
    }
  }

  return [...candidates.values()].slice(0, 12);
}
