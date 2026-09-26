import { Verse } from '../../types';
import { searchQuranOffline } from '../searchEngine';
import { RagCandidate, SourceItem } from './types';
import {
  createQuranSource,
  createTafsirMizanSource,
  createTafsirNemonehSource,
  createHadithSource,
  getSurahInfo,
} from './sourceResolver';

// گنجینه احادیث معتبر موضوعی جهت اتصال معارف قرآن به سنّت نبوی و اهل‌بیت
interface ThematicHadith {
  id: string;
  theme: string;
  bookName: string;
  chapter: string;
  reference: string;
  arabicText: string;
  persianText: string;
}

const THEMATIC_HADITHS: ThematicHadith[] = [
  {
    id: 'sabr_1',
    theme: 'صبر',
    bookName: 'اصول کافی',
    chapter: 'باب الصبر',
    reference: 'الکافی، ج ۲، ص ۸۹، ح ۳',
    arabicText: 'الصَّبْرُ مِنَ الْإِيمَانِ كَالرَّأْسِ مِنَ الْجَسَدِ',
    persianText: 'امام صادق (ع): صبر نسبت به ایمان، مانند سر نسبت به پیکر است؛ همان‌گونه که با رفتن سر پیکر نابود می‌شود، با رفتن صبر ایمان نیز از بین می‌رود.',
  },
  {
    id: 'tavakkol_1',
    theme: 'توکل',
    bookName: 'اصول کافی',
    chapter: 'باب التفویض إلی الله و التوکل علیه',
    reference: 'الکافی، ج ۲، ص ۶۵، ح ۲',
    arabicText: 'مَنْ تَوَكَّلَ عَلَى اللَّهِ كَفَاهُ',
    persianText: 'پیامبر اکرم (ص): هر کس بر خداوند توکل و اعتماد کند، خداوند او را کفایت می‌کند و تکیه‌گاهی امن‌تر از او نخواهد یافت.',
  },
  {
    id: 'aramesh_1',
    theme: 'آرامش',
    bookName: 'نهج‌البلاغه',
    chapter: 'حکمت‌ها',
    reference: 'نهج‌البلاغه، حکمت ۱۹۳',
    arabicText: 'إِنَّ هَذِهِ الْقُلُوبَ تَمَلُّ كَمَا تَمَلُّ الْأَبْدَانُ فَابْتَغُوا لَهَا طَرَائِفَ الْحِكَمِ',
    persianText: 'امیرالمؤمنین علی (ع): این دل‌ها همانند بدن‌ها خسته و ملول می‌شوند، پس برای آرامش آن‌ها سخنان نغز و حکمت‌آمیز بجویید.',
  },
  {
    id: 'doa_1',
    theme: 'دعا',
    bookName: 'اصول کافی',
    chapter: 'باب فضل الدعاء',
    reference: 'الکافی، ج ۲، ص ۴۶۸، ح ۱',
    arabicText: 'الدُّعَاءُ سِلَاحُ الْمُؤْمِنِ وَ عِمَادُ الدِّينِ',
    persianText: 'رسول خدا (ص): دعا سلاح انسان باایمان، ستون دین و نور آسمان‌ها و زمین است.',
  },
  {
    id: 'walidayn_1',
    theme: 'والدین',
    bookName: 'اصول کافی',
    chapter: 'باب بر الوالدین',
    reference: 'الکافی، ج ۲، ص ۱۵۷، ح ۲',
    arabicText: 'بِرُّ الْوَالِدَيْنِ أَكْبَرُ فَرِيضَةٍ',
    persianText: 'امام علی (ع): نیکی به پدر و مادر بزرگ‌ترین واجب الهی و مایه طول عمر و برکت در زندگی است.',
  },
  {
    id: 'esteghfar_1',
    theme: 'استغفار',
    bookName: 'تحف‌العقول',
    chapter: 'مواعظ پیامبر (ص)',
    reference: 'تحف‌العقول، ص ۱۹',
    arabicText: 'خَيْرُ الدُّعَاءِ الِاسْتِغْفَارُ',
    persianText: 'پیامبر اکرم (ص): برترین دعا برای گشودن گره‌های زندگی و رفع سنگینی دل، استغفار و پوزش‌خواهی از پروردگار است.',
  },
];

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

function extractKeywords(text: string): string[] {
  const words = text
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

  return [...new Set([...words, ...expansions])].slice(0, 6);
}

export interface RetrievalResult {
  candidates: RagCandidate[];
  sourcesCatalog: SourceItem[];
  contextPromptText: string;
}

/**
 * بازیابی چندگانه منابع: قرآن، تفسیر المیزان، تفسیر نمونه و احادیث متناظر
 */
export async function retrieveRagKnowledge(
  question: string,
  currentVerse?: Verse | null
): Promise<RetrievalResult> {
  const candidates: RagCandidate[] = [];
  const sourcesCatalog: SourceItem[] = [];
  const seenRefs = new Set<string>();

  // ۱. اگر کاربر در حال حاضر آیه‌ای را در کانتکست قرار داده است
  if (currentVerse) {
    const sId = currentVerse.surahId;
    const vNum = currentVerse.verseNumber;
    const surah = getSurahInfo(sId);
    const quranSource = createQuranSource(sId, vNum);
    const mizanSource = createTafsirMizanSource(sId, vNum);
    const nemonehSource = createTafsirNemonehSource(sId, vNum);

    sourcesCatalog.push(quranSource, mizanSource, nemonehSource);
    seenRefs.add(`${sId}:${vNum}`);

    candidates.push({
      sourceId: quranSource.id,
      type: 'quran',
      title: quranSource.title,
      reference: quranSource.reference,
      sourceName: quranSource.sourceName,
      content: `«${currentVerse.textArabic}»\nترجمه: ${currentVerse.translationMakarem}`,
      sourceItem: quranSource,
    });

  }

  // ۲. جستجوی آفلاین در متن قرآن بر اساس کلمات کلیدی و مفاهیم پرسش
  const keywords = extractKeywords(question);
  const searchQueries = [question, ...keywords];

  for (const q of searchQueries) {
    if (candidates.filter((c) => c.type === 'quran').length >= 4) break;

    const res = await searchQuranOffline({ query: q, scope: 'all', maxResults: 6 });
    for (const item of res.results) {
      const key = `${item.surahId}:${item.verseNumber}`;
      if (seenRefs.has(key)) continue;
      seenRefs.add(key);

      const qSource = createQuranSource(item.surahId, item.verseNumber);
      sourcesCatalog.push(qSource);

      candidates.push({
        sourceId: qSource.id,
        type: 'quran',
        title: qSource.title,
        reference: qSource.reference,
        sourceName: qSource.sourceName,
        content: `«${item.textArabic}»\nترجمه: ${item.translation}`,
        sourceItem: qSource,
      });

      // Keep commentary links available without inventing tafsir content.
      if (sourcesCatalog.filter((s) => s.type === 'tafsir').length < 2) {
        const tSource = createTafsirMizanSource(item.surahId, item.verseNumber);
        sourcesCatalog.push(tSource);
      }

      if (candidates.filter((c) => c.type === 'quran').length >= 4) break;
    }
  }

  // ۳. پیوند با روایات و احادیث متناظر موضوعی (در صورت تطابق با دغدغه کاربر)
  for (const h of THEMATIC_HADITHS) {
    if (question.includes(h.theme) || keywords.some((k) => k.includes(h.theme))) {
      const hSource = createHadithSource(h.id, h.bookName, h.chapter, h.reference);
      sourcesCatalog.push(hSource);
      candidates.push({
        sourceId: hSource.id,
        type: 'hadith',
        title: hSource.title,
        reference: hSource.reference,
        sourceName: hSource.sourceName,
        content: `«${h.arabicText}»\nترجمه روایت: ${h.persianText}`,
        sourceItem: hSource,
      });
      break;
    }
  }

  // ساخت متن فرمت‌شدهٔ Context برای پرامپت هوش مصنوعی
  const contextPromptText = candidates
    .map(
      (c) =>
        `[شناسه_منبع: ${c.sourceId}] (${c.sourceName} | ${c.reference})\n${c.content}`
    )
    .join('\n\n---\n\n');

  return {
    candidates,
    sourcesCatalog,
    contextPromptText,
  };
}
