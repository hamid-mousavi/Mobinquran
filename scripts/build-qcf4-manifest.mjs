// ساخت manifest فونت‌های QCF4 (نام + حجم هر فایل) برای نمایش حجم دانلود به کاربر.
// ۱) فایل‌های fonts-woff2/QCF4_Hafs_NN_W.woff2 از ریپوی quran-qcf4 را در public/fonts/qcf4/ بگذارید
// ۲) node scripts/build-qcf4-manifest.mjs
import { readdir, stat, writeFile } from 'node:fs/promises';

const dir = new URL('../public/fonts/qcf4/', import.meta.url);
const files = (await readdir(dir)).filter((f) => /^QCF4_Hafs_\d+_W\.woff2$/.test(f)).sort();
if (files.length === 0) {
  console.error('هیچ فونت QCF4_Hafs_NN_W.woff2 در public/fonts/qcf4 پیدا نشد.');
  process.exit(1);
}
const fonts = {};
let totalBytes = 0;
for (const file of files) {
  const { size } = await stat(new URL(file, dir));
  fonts[file.replace(/_W\.woff2$/, '')] = { file, bytes: size };
  totalBytes += size;
}
const manifest = { version: 1, count: files.length, totalBytes, fonts };
await writeFile(new URL('manifest.json', dir), `${JSON.stringify(manifest, null, 1)}\n`, 'utf8');
console.log(`manifest: ${files.length} fonts, ${(totalBytes / 1048576).toFixed(1)} MB`);
if (files.length !== 47) console.warn(`هشدار: انتظار ۴۷ فونت می‌رفت، ${files.length} فایل پیدا شد.`);
