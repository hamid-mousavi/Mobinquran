import { Verse } from '../types';
import { searchQuranOffline } from './searchEngine';

export interface AiCandidateForRequest {
  ref: string;
  text_fa: string;
  verse: Verse;
}

const STOP_WORDS = new Set([
  'برای', 'درباره', 'مورد', 'قرآن', 'قرآنی', 'آیه', 'آیات', 'سوره', 'کدام', 'چیست',
  'هست', 'بود', 'شد', 'راهنمایی', 'بگو', 'کن', 'کنید', 'دارد', 'دارند', 'چگونه',
  'چطور', 'یک', 'این', 'آن', 'با', 'از', 'تا', 'در', 'به', 'بر', 'که', 'و',
]);

const SYNONYM_MAP: Record<string, string[]> = {
  آرامش: ['سکینة', 'اطمینان', 'قلب', 'طمانینة', 'شفا'],
  نگرانی: ['سکینة', 'اطمینان', 'قلب', 'غم'],
  صبر: ['صابرین', 'استقامت', 'شکیبایی', 'عسر', 'یسر'],
  سختی: ['عسر', 'یسر', 'صبر', 'بلاء', 'ابتلاء'],
  امید: ['رحمت', 'فضل', 'مغفرت', 'روح', 'یاس'],
  ناامیدی: ['یاس', 'قنوط', 'رحمت', 'استغفار'],
  رزق: ['روزی', 'برکت', 'انفاق', 'فضل', 'رزقناهم'],
  روزی: ['رزق', 'برکت', 'انفاق', 'کسب', 'طیب'],
  خانواده: ['والدین', 'احسان', 'همسر', 'مودت', 'ذرية'],
  والدین: ['والدین', 'احسان', 'پدر', 'مادر', 'بر'],
  دعا: ['استجابت', 'ربنا', 'نداء', 'تضرع', 'اجیب'],
  اخلاق: ['احسان', 'معروف', 'تقوا', 'بر', 'عدل'],
  عدالت: ['قسط', 'عدل', 'میزان', 'حق'],
  بحران: ['فرج', 'مخرج', 'توفیق', 'رحمت', 'نصر'],
  توکل: ['وکیل', 'حسبنا', 'کاف'],
};

function meaningfulTerms(question: string): string[] {
  const words = question
    .replace(/[؟?!،؛:()\[\]{}"«»\-–]/g, ' ')
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2 && !STOP_WORDS.has(term));

  const expansions: string[] = [];
  for (const word of words) {
    for (const [key, synonyms] of Object.entries(SYNONYM_MAP)) {
      if (word.includes(key) || key.includes(word)) {
        expansions.push(...synonyms);
      }
    }
  }

  return [...new Set([...words, ...expansions])].slice(0, 8);
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
  const cleanQ = question.trim().toLowerCase();
  const isGreeting = /^(سلام|درود|سلام علیکم|سلام بر شما|خوبی|چطوری|درود بر شما|وقت بخیر|صبح بخیر|عصر بخیر|شب بخیر|یا علی|یا حق)[\s!.,،]*$/i.test(cleanQ);

  if (isGreeting && !currentVerse) {
    return [];
  }

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
