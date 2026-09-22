import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const BASE_URL =
  'https://raw.githubusercontent.com/MohamadHajjRabee/quran-qcf4/main/pages/';
const TOTAL_PAGES = 604;
const ALLOWED_TYPES = new Set(['surah_header', 'bismillah', 'word', 'end', 'quarter']);

const argv = process.argv.slice(2);
const pagesArg = argv.find((a) => a.startsWith('--pages='));
const pages =
  pagesArg
    ? pagesArg.split('=')[1].split(',').filter(Boolean).map((s) => parseInt(s, 10))
    : Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1);

if (pages.some((p) => !Number.isInteger(p) || p < 1 || p > TOTAL_PAGES)) {
  throw new Error(`Page numbers must be in 1..${TOTAL_PAGES}`);
}

console.log(`Fetching ${pages.length} mushaf pages from quran-qcf4 (MIT)...`);
const pageData = [];
for (const pageNumber of [...pages].sort((a, b) => a - b)) {
  const zeros = String(pageNumber).padStart(3, '0');
  const url = `${BASE_URL}${zeros}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`page ${zeros}: HTTP ${res.status}`);
  const json = await res.json();
  if (json.page !== pageNumber) throw new Error(`page ${zeros}: page field mismatch (${json.page})`);
  if (!Array.isArray(json.lines) || json.lines.length === 0) {
    throw new Error(`page ${zeros}: no lines`);
  }

  // اعتبارسنجی کلمات بدون ساخت متن
  for (const line of json.lines) {
    if (!Array.isArray(line.words) || line.words.length === 0) {
      throw new Error(`page ${zeros} line ${line.line}: no words`);
    }
    for (const w of line.words) {
      if (!ALLOWED_TYPES.has(w.type)) {
        throw new Error(`page ${zeros}: unknown word type "${w.type}"`);
      }
      if (typeof w.text !== 'string' || w.text.length === 0) {
        throw new Error(`page ${zeros}: word without text`);
      }
      if (w.type !== 'surah_header' && w.type !== 'bismillah' && w.type !== 'quarter') {
        if (typeof w.verse_key !== 'string' || w.verse_key.indexOf(':') < 1) {
          throw new Error(`page ${zeros}: missing verse_key for ${w.type} word`);
        }
      }
    }
  }
  pageData.push(json);
  if (pages.length <= 5 || pages.length === TOTAL_PAGES) {
    process.stdout.write(`✓ ${zeros}\n`);
  }
}

console.log('Building content pack...');
const normalized = pageData.map((p) => ({
  page: p.page,
  surahs: p.surahs,
  lines: p.lines.map((l) => ({
    line: l.line,
    words: l.words.map((w) => ({
      type: w.type,
      text: w.text,
      ...(w.type !== 'surah_header' && w.type !== 'bismillah' && w.type !== 'quarter'
        ? { verse: w.verse_key }
        : {}),
      ...(w.sura ? { sura: w.sura } : {}),
      ...(w.verse_key && w.type === 'word' ? { p: w.position } : {}),
    })),
  })),
}));

const contentPack = {
  id: 'mushaf-layout',
  version: 'quran-qcf4-v1',
  schemaVersion: 1,
  sourceName: 'quran-qcf4 (QCF v4, Madinah Mushaf 1441 AH)',
  sourceUrl: 'https://github.com/MohamadHajjRabee/quran-qcf4',
  license: 'MIT (JSON data) — fonts not redistributed; rendered with self-hosted fonts',
  generatedAt: new Date().toISOString(),
  pagesIncluded: normalized.map((p) => p.page),
  integrity: {
    algorithm: 'SHA-256',
    value: createHash('sha256').update(JSON.stringify(normalized)).digest('hex'),
  },
  pages: normalized,
};

await mkdir(new URL('../public/data/', import.meta.url), { recursive: true });
await writeFile(
  new URL('../public/data/mushaf-layout-v1.json', import.meta.url),
  `${JSON.stringify(contentPack)}\n`,
  'utf8'
);
console.log(
  `Wrote ${normalized.length} pages to public/data/mushaf-layout-v1.json`
);
console.log(`Integrity SHA-256: ${contentPack.integrity.value}`);