// تبدیل متن کلمات چیدمان مصحف به رسم‌الخط عثمانی همان متن آیه‌به‌آیه (quran-core-v1.json)
// و افزودن علائم وقف که در داده‌ی خام quran-qcf4 حذف شده‌اند.
// ورودی: scripts/raw/mushaf-layout-raw.json (خروجی generate-mushaf-layout.mjs)
// خروجی: public/data/mushaf-layout-v2.json  (نام جدید → کش قدیمی Service Worker دور زده می‌شود)
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const rawPath = new URL('./raw/mushaf-layout-raw.json', import.meta.url);
const corePath = new URL('../public/data/quran-core-v1.json', import.meta.url);
const outPath = new URL('../public/data/mushaf-layout-v2.json', import.meta.url);

const pack = JSON.parse(await readFile(rawPath, 'utf8'));
const core = JSON.parse(await readFile(corePath, 'utf8'));

const MARK_ONLY = /^[\u06D6-\u06DC\u06DE-\u06E4\u06E7\u06E8\u06EA-\u06ED\u0615-\u061A]+$/;
const skeleton = (s) => s.replace(/[^\u0621-\u063F\u0641-\u064A]/g, '').replace(/[ءأإآؤئاٱ]/g, '').replace(/ى/g, 'ي');

const coreByKey = new Map();
for (const v of core.verses) {
  const out = [];
  for (const tok of v.textArabic.split(/\s+/).filter(Boolean)) {
    if (tok === '۞') continue;
    if (MARK_ONLY.test(tok)) {
      if (out.length) out[out.length - 1].marks.push(tok);
      continue;
    }
    out.push({ text: tok, marks: [] });
  }
  coreByKey.set(`${v.surahId}:${v.verseNumber}`, out);
}

// کلمات هر آیه به ترتیب (ارجاع به شیء داخل pack)
const refsByKey = new Map();
for (const page of pack.pages) {
  for (const line of page.lines) {
    line.words.forEach((w, idx) => {
      if (w.type !== 'word' || !w.verse) return;
      if (!refsByKey.has(w.verse)) refsByKey.set(w.verse, []);
      refsByKey.get(w.verse).push({ line, w, idx });
    });
  }
}

const finalText = (c) => c.text + (c.marks.length ? '\u00A0' + c.marks.join('\u00A0') : '');
let exact = 0, failed = [];

for (const [key, refs] of refsByKey) {
  const cw = coreByKey.get(key);
  if (!cw) { failed.push(key); continue; }
  if (cw.length === refs.length) {
    cw.forEach((c, i) => { refs[i].w.text = finalText(c); });
    exact++;
    continue;
  }
  // تعداد کلمات متفاوت (مثل «بَعْدَ مَا» که چیدمان جدا نوشته): متن همان آیه دست‌نخورده می‌ماند؛
  // کلمه‌ها حذف/ادغام نمی‌شوند چون هر کلمه یک گلیف QCF4 دارد.
  failed.push(key);
}

for (const page of pack.pages) {
  for (const line of page.lines) {
    for (const w of line.words) {
      if (w.type === 'surah_header') w.text = w.text.replace(/االب/g, 'الب');
    }
  }
}

pack.version = 'quran-qcf4-v2-uthmani';
pack.generatedAt = new Date().toISOString();
pack.integrity = {
  algorithm: 'SHA-256',
  value: createHash('sha256').update(JSON.stringify(pack.pages)).digest('hex'),
};
await writeFile(outPath, `${JSON.stringify(pack)}\n`, 'utf8');
console.log(`exact=${exact} skipped(word-count differs)=${failed.length}`, failed.slice(0, 10));
