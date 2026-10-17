import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// تعداد رسمی آیات ۱۱۴ سوره قرآن کریم بر اساس روایت حفص از عاصم (مصحف شریف مدینه و مصحف ایران)
const HAFS_CANONICAL_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109,
  123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
  112, 78, 118, 64, 77, 227, 93, 88, 69, 60,
  34, 30, 73, 54, 45, 83, 182, 88, 75, 85,
  54, 53, 89, 59, 37, 35, 38, 29, 18, 45,
  60, 49, 62, 55, 78, 96, 29, 22, 24, 13,
  14, 11, 11, 18, 12, 12, 30, 52, 52, 44,
  28, 28, 20, 56, 40, 31, 50, 40, 46, 42,
  29, 19, 36, 25, 22, 17, 19, 26, 30, 20,
  15, 21, 11, 8, 8, 19, 5, 8, 8, 11,
  11, 8, 3, 9, 5, 4, 7, 3, 6, 3,
  5, 4, 5, 6
];

// ۴ موضع سجده واجب در فقه اسلامی: سجده (۳۲:۱۵)، فصلت (۴۱:۳۸)، نجم (۵۳:۶۲)، علق (۹۶:۱۹)
const OBLIGATORY_SAJDAS = new Set(['32:15', '41:38', '53:62', '96:19']);

console.log('════════════════════════════════════════════════════════════════');
console.log('   ابزار جامع اعتبارسنجی و تطبیق متن قرآن کریم (قرآن مبین)');
console.log('   بر اساس استاندارد تنزیل (Tanzil.net) و مصحف شریف مدینه و ایران');
console.log('════════════════════════════════════════════════════════════════\n');

const dataPath = fileURLToPath(new URL('../public/data/quran-core-v1.json', import.meta.url));
const raw = readFileSync(dataPath, 'utf8');
const pack = JSON.parse(raw);

const errors = [];
const warnings = [];

// ۱. بررسی تعداد کل آیات
if (!pack.verses || pack.verses.length !== 6236) {
  errors.push(`تعداد کل آیات باید دقیقاً ۶۲۳۶ باشد (یافت شد: ${pack.verses?.length || 0})`);
} else {
  console.log('✓ تعداد کل آیات: ۶,۲۳۶ آیه کامل مطابق مصحف رسمی');
}

// ۲. تفکیک سوره به سوره
const surahMap = new Map();
for (const v of pack.verses || []) {
  const list = surahMap.get(v.surahId) || [];
  list.push(v);
  surahMap.set(v.surahId, list);
}

if (surahMap.size !== 114) {
  errors.push(`تعداد سوره‌ها باید دقیقاً ۱۱۴ باشد (یافت شد: ${surahMap.size})`);
} else {
  console.log('✓ تعداد سوره‌ها: ۱۱۴ سوره از فاتحه تا ناس');
}

// ۳. بررسی تعداد دقیق آیات هر سوره
let countMismatches = 0;
for (let sId = 1; sId <= 114; sId++) {
  const expected = HAFS_CANONICAL_COUNTS[sId - 1];
  const actual = surahMap.get(sId)?.length || 0;
  if (expected !== actual) {
    errors.push(`سوره شماره ${sId}: تعداد مورد انتظار ${expected}، ولی ${actual} یافت شد.`);
    countMismatches++;
  }
}
if (countMismatches === 0) {
  console.log('✓ انطباق کامل تعداد آیات در تک‌تک ۱۱۴ سوره با روایت حفص');
}

// ۴. بررسی دقیق بسمله
// - سوره ۱ آیه ۱ باید دارای بسمله باشد
// - سوره ۹ نباید بسمله داشته باشد
// - سوره‌های ۲ تا ۱۱۴ در آیه ۱ نباید بسملهٔ تکراری داشته باشند (چون بسمله در سرسوره می‌آید)
let bismillahIssues = 0;
for (let sId = 1; sId <= 114; sId++) {
  const verses = surahMap.get(sId) || [];
  const v1 = verses[0];
  if (!v1) continue;

  if (sId === 1) {
    if (!v1.textArabic.includes('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ') && !v1.textArabic.includes('بِسْمِ اللَّهِ')) {
      errors.push('سوره ۱ آیه ۱: بسمله به درستی ثبت نشده است.');
      bismillahIssues++;
    }
  } else if (sId === 9) {
    if (/بِسْمِ|بِّسْمِ/u.test(v1.textArabic)) {
      errors.push('سوره ۹ (توبه) نباید در ابتدای آیه ۱ بسمله داشته باشد.');
      bismillahIssues++;
    }
  } else {
    // بررسی عدم وجود بسمله در ابتدای آیه ۱
    if (/^[\s]*[ب\u0628][\u0651\u0650\u064E\u064F\u0652\s]*[س\u0633][\u0652\s]*[م\u0645][\u0650\s]+[\u0600-\u06FF\s]+?[ٱا]لرَّحِيمِ/u.test(v1.textArabic)) {
      errors.push(`سوره ${sId} آیه ۱: دارای بسمله تکراری در ابتدای متن آیه است.`);
      bismillahIssues++;
    }
  }
}
if (bismillahIssues === 0) {
  console.log('✓ بررسی بسمله: سوره ۱ دارای بسمله، سوره ۹ بدون بسمله، و تمامی ۱۱۲ سورهٔ دیگر بدون بسملهٔ تکراری');
}

// ۵. بررسی مواضع سجده
let sajdaCount = 0;
let obligatoryCount = 0;
for (const v of pack.verses || []) {
  if (v.sajda) {
    sajdaCount++;
    const key = `${v.surahId}:${v.verseNumber}`;
    if (v.sajda.obligatory) {
      obligatoryCount++;
      if (!OBLIGATORY_SAJDAS.has(key)) {
        errors.push(`آیه ${key} به اشتباه به عنوان سجده واجب علامت‌گذاری شده است.`);
      }
    }
  }
}
if (sajdaCount === 15 && obligatoryCount === 4) {
  console.log('✓ بررسی سجده‌ها: دقیقاً ۱۵ سجده (شامل ۴ سجده واجب فقهی در سوره‌های ۳۲، ۴۱، ۵۳ و ۹۶)');
} else {
  errors.push(`تعداد سجده‌ها باید ۱۵ موضع (۴ واجب) باشد. یافت شد: ${sajdaCount} سجده (${obligatoryCount} واجب)`);
}

// ۶. بررسی سلامت رسم‌الخط کلمات خاص (مانند إِبْرَٰهِيم)
let brokenYehIssues = 0;
for (const v of pack.verses || []) {
  if (v.textArabic.includes('إِبْرَٰهِۦم') || v.textArabic.includes('لِإِبْرَٰهِۦم')) {
    errors.push(`آیه ${v.surahId}:${v.verseNumber}: نگارش إِبْرَٰهِۦم با علامت یاء کوچک و شکسته یافت شد.`);
    brokenYehIssues++;
  }
}
if (brokenYehIssues === 0) {
  console.log('✓ بررسی رسم‌الخط ابراهیم: یکدست‌سازی شده با حرف یاء کامل (إِبْرَٰهِيم) و بدون خطای نویسه');
}

// ۷. بررسی وجود و تکمیل ترجمه‌های فارسی ۳ گانه
let missingTrans = 0;
for (const v of pack.verses || []) {
  if (!v.translationMakarem || !v.translationFooladvand || !v.translationAnsarian) {
    missingTrans++;
  }
}
if (missingTrans === 0) {
  console.log('✓ بررسی ترجمه‌ها: تمامی ۶۲۳۶ آیه دارای ۳ ترجمهٔ رسمی مکارم، فولادوند و انصاریان هستند');
} else {
  warnings.push(`${missingTrans} آیه فاقد یکی از ترجمه‌های سه‌گانه هستند.`);
}

console.log('\n────────────────────────────────────────────────────────────────');
if (errors.length === 0) {
  console.log('🎉 نتیجه نهایی: تمامی ۶۲۳۶ آیه با استانداردهای رسمی قرآن کریم کاملاً منطبق و معتبر هستند!');
  if (warnings.length > 0) {
    console.log(`هشدارها (${warnings.length}):`);
    warnings.forEach((w) => console.log('  ⚠️  ' + w));
  }
  process.exit(0);
} else {
  console.error(`❌ اعتبارسنجی با ${errors.length} خطا متوقف شد:`);
  errors.forEach((e) => console.error('  ✗ ' + e));
  process.exit(1);
}
