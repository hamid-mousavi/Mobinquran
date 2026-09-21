import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const EDITIONS = [
  'quran-uthmani',
  'quran-simple-clean',
  'fa.makarem',
  'fa.fooladvand',
  'fa.ansarian',
];
const BASE_URL = 'https://api.alquran.cloud/v1/quran/';

function removeRepeatedBismillah(text, surahId, verseNumber) {
  if (surahId <= 1 || surahId === 9 || verseNumber !== 1) return text.trim();
  return text
    .replace(/^[\uFEFF\u200B\s]*بِسْمِ\s+[\u0600-\u06FF\s]+?ٱلرَّحِيمِ\s*/u, '')
    .replace(/^[\uFEFF\u200B\s]*بِسْمِ\s+[\u0600-\u06FF\s]+?الرَّحِيمِ\s*/u, '')
    .replace(/^[\uFEFF\u200B\s]*بسم\s+الله\s+الرحمن\s+الرحيم\s*/u, '')
    .trim();
}

/**
 * یکسان‌سازی حروف عربی ي/ك در ترجمه‌های فارسی
 */
function normalizePersianText(text) {
  if (!text) return '';
  return text
    .replace(/[\uFEFF\u200B]/g, '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u0643/g, 'ک')
    .replace(/\u0649/g, 'ی')
    .replace(/\u06CC/g, 'ی')
    .trim();
}

console.log('Fetching Quran datasets from Al Quran Cloud...');
const payloads = await Promise.all(
  EDITIONS.map(async (edition) => {
    const response = await fetch(`${BASE_URL}${edition}`);
    if (!response.ok) throw new Error(`${edition}: HTTP ${response.status}`);
    const json = await response.json();
    if (!json?.data?.surahs?.length) throw new Error(`${edition}: invalid response`);
    console.log(`✓ Fetched ${edition}`);
    return json.data;
  })
);

const [uthmani, simpleClean, makarem, fooladvand, ansarian] = payloads;

const verses = uthmani.surahs.flatMap((surah, surahIndex) =>
  surah.ayahs.map((ayah, verseIndex) => {
    const rawClean = simpleClean.surahs[surahIndex]?.ayahs[verseIndex]?.text || '';
    const cleanNoBismillah = removeRepeatedBismillah(rawClean, surah.number, ayah.numberInSurah);

    // سجده: تعیین نوع سجده (مستحب / واجب)
    let sajdaInfo = undefined;
    if (ayah.sajda) {
      if (typeof ayah.sajda === 'object') {
        sajdaInfo = {
          id: ayah.sajda.id,
          recommended: !!ayah.sajda.recommended,
          obligatory: !!ayah.sajda.obligatory,
        };
      } else {
        sajdaInfo = {
          id: 0,
          recommended: true,
          obligatory: false,
        };
      }
    }

    return {
      id: ayah.number,
      surahId: surah.number,
      verseNumber: ayah.numberInSurah,
      juzNumber: ayah.juz,
      pageNumber: ayah.page,
      hizbQuarter: ayah.hizbQuarter || 1,
      ruku: ayah.ruku || 1,
      manzil: ayah.manzil || 1,
      sajda: sajdaInfo,
      textArabic: removeRepeatedBismillah(ayah.text || '', surah.number, ayah.numberInSurah),
      textSimple: cleanNoBismillah,
      translationMakarem: normalizePersianText(makarem.surahs[surahIndex]?.ayahs[verseIndex]?.text || ''),
      translationFooladvand: normalizePersianText(fooladvand.surahs[surahIndex]?.ayahs[verseIndex]?.text || ''),
      translationAnsarian: normalizePersianText(ansarian.surahs[surahIndex]?.ayahs[verseIndex]?.text || ''),
      rootWords: [],
    };
  })
);

if (verses.length !== 6236) {
  throw new Error(`Expected 6236 verses, received ${verses.length}`);
}

// اعتبارسنجی سجده‌ها: باید دقیقاً ۱۵ موضع شامل ۴ موضع واجب باشد
const sajdaVerses = verses.filter((v) => !!v.sajda);
const obligatorySajda = verses.filter((v) => v.sajda?.obligatory);
if (sajdaVerses.length !== 15 || obligatorySajda.length !== 4) {
  throw new Error(`Sajda validation failed: found ${sajdaVerses.length} sajdas (${obligatorySajda.length} obligatory)`);
}

const contentPack = {
  id: 'quran-core',
  version: 'alquran-cloud-core-v2',
  schemaVersion: 2,
  sourceName: 'Al Quran Cloud',
  sourceUrl: 'https://alquran.cloud/',
  datasetVersion: EDITIONS.join(' + '),
  licenseStatus: 'pending_review',
  generatedAt: new Date().toISOString(),
  integrity: {
    algorithm: 'SHA-256',
    value: createHash('sha256').update(JSON.stringify(verses)).digest('hex'),
  },
  verses,
};

await mkdir(new URL('../public/data/', import.meta.url), { recursive: true });
await writeFile(
  new URL('../public/data/quran-core-v1.json', import.meta.url),
  `${JSON.stringify(contentPack)}\n`,
  'utf8'
);
console.log(`Successfully generated ${verses.length} verses with textSimple and normalized translations.`);
console.log(`Integrity SHA-256: ${contentPack.integrity.value}`);
