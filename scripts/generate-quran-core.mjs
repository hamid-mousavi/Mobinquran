import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const EDITIONS = ['quran-uthmani', 'fa.makarem', 'fa.fooladvand', 'fa.ansarian'];
const BASE_URL = 'https://api.alquran.cloud/v1/quran/';

function removeRepeatedBismillah(text, surahId, verseNumber) {
  if (surahId <= 1 || surahId === 9 || verseNumber !== 1) return text.trim();
  return text
    .replace(/^بِسْمِ\s+[\u0600-\u06FF\s]+?ٱلرَّحِيمِ\s*/u, '')
    .replace(/^بِسْمِ\s+[\u0600-\u06FF\s]+?الرَّحِيمِ\s*/u, '')
    .trim();
}

const payloads = await Promise.all(EDITIONS.map(async (edition) => {
  const response = await fetch(`${BASE_URL}${edition}`);
  if (!response.ok) throw new Error(`${edition}: HTTP ${response.status}`);
  const json = await response.json();
  if (!json?.data?.surahs?.length) throw new Error(`${edition}: invalid response`);
  return json.data;
}));

const [arabic, makarem, fooladvand, ansarian] = payloads;
const verses = arabic.surahs.flatMap((surah, surahIndex) =>
  surah.ayahs.map((ayah, verseIndex) => ({
    id: ayah.number,
    surahId: surah.number,
    verseNumber: ayah.numberInSurah,
    juzNumber: ayah.juz,
    pageNumber: ayah.page,
    textArabic: removeRepeatedBismillah(ayah.text || '', surah.number, ayah.numberInSurah),
    translationMakarem: makarem.surahs[surahIndex]?.ayahs[verseIndex]?.text || '',
    translationFooladvand: fooladvand.surahs[surahIndex]?.ayahs[verseIndex]?.text || '',
    translationAnsarian: ansarian.surahs[surahIndex]?.ayahs[verseIndex]?.text || '',
    rootWords: [],
  }))
);

if (verses.length !== 6236) throw new Error(`Expected 6236 verses, received ${verses.length}`);

const contentPack = {
  id: 'quran-core',
  version: 'alquran-cloud-core-v1',
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
await writeFile(new URL('../public/data/quran-core-v1.json', import.meta.url), `${JSON.stringify(contentPack)}\n`, 'utf8');
console.log(`Generated ${verses.length} verses in public/data/quran-core-v1.json`);
