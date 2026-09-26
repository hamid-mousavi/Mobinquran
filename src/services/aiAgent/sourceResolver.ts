import { SourceItem, SourceType, WebGroundingChunk } from './types';
import { toPersianDigits } from '../../utils/textNormalization';

// نقشه نام فارسی و عربی سوره‌ها
const SURAH_NAMES: Record<number, { arabic: string; persian: string }> = {
  1: { arabic: 'الفاتحة', persian: 'حمد' },
  2: { arabic: 'البقرة', persian: 'بقره' },
  3: { arabic: 'آل عمران', persian: 'آل عمران' },
  4: { arabic: 'النساء', persian: 'نساء' },
  5: { arabic: 'المائدة', persian: 'مائده' },
  6: { arabic: 'الأنعام', persian: 'انعام' },
  7: { arabic: 'الأعراف', persian: 'اعراف' },
  8: { arabic: 'الأنفال', persian: 'انفال' },
  9: { arabic: 'التوبة', persian: 'توبه' },
  10: { arabic: 'يونس', persian: 'یونس' },
  11: { arabic: 'هود', persian: 'هود' },
  12: { arabic: 'يوسف', persian: 'یوسف' },
  13: { arabic: 'الرعد', persian: 'رعد' },
  14: { arabic: 'إبراهيم', persian: 'ابراهیم' },
  15: { arabic: 'الحجر', persian: 'حجر' },
  16: { arabic: 'النحل', persian: 'نحل' },
  17: { arabic: 'الإسراء', persian: 'اسراء' },
  18: { arabic: 'الكهف', persian: 'کهف' },
  19: { arabic: 'مريم', persian: 'مریم' },
  20: { arabic: 'طه', persian: 'طه' },
  21: { arabic: 'الأنبياء', persian: 'انبیاء' },
  22: { arabic: 'الحج', persian: 'حج' },
  23: { arabic: 'المؤمنون', persian: 'مؤمنون' },
  24: { arabic: 'النور', persian: 'نور' },
  25: { arabic: 'الفرقان', persian: 'فرقان' },
  26: { arabic: 'الشعراء', persian: 'شعراء' },
  27: { arabic: 'النمل', persian: 'نمل' },
  28: { arabic: 'القصص', persian: 'قصص' },
  29: { arabic: 'العنكبوت', persian: 'عنکبوت' },
  30: { arabic: 'الروم', persian: 'روم' },
  31: { arabic: 'لقمان', persian: 'لقمان' },
  32: { arabic: 'السجدة', persian: 'سجده' },
  33: { arabic: 'الأحزاب', persian: 'احزاب' },
  34: { arabic: 'سبأ', persian: 'سبأ' },
  35: { arabic: 'فاطر', persian: 'فاطر' },
  36: { arabic: 'يس', persian: 'یس' },
  37: { arabic: 'الصافات', persian: 'صافات' },
  38: { arabic: 'ص', persian: 'ص' },
  39: { arabic: 'الزمر', persian: 'زمر' },
  40: { arabic: 'غافر', persian: 'غافر' },
  41: { arabic: 'فصلت', persian: 'فصلت' },
  42: { arabic: 'الشورى', persian: 'شوری' },
  43: { arabic: 'الزخرف', persian: 'زخرف' },
  44: { arabic: 'الدخان', persian: 'دخان' },
  45: { arabic: 'الجاثية', persian: 'جاثیه' },
  46: { arabic: 'الأحقاف', persian: 'احقاف' },
  47: { arabic: 'محمد', persian: 'محمد' },
  48: { arabic: 'الفتح', persian: 'فتح' },
  49: { arabic: 'الحجرات', persian: 'حجرات' },
  50: { arabic: 'ق', persian: 'ق' },
  51: { arabic: 'الذاريات', persian: 'ذاریات' },
  52: { arabic: 'الطور', persian: 'طور' },
  53: { arabic: 'النجم', persian: 'نجم' },
  54: { arabic: 'القمر', persian: 'قمر' },
  55: { arabic: 'الرحمن', persian: 'الرحمن' },
  56: { arabic: 'الواقعة', persian: 'واقعه' },
  57: { arabic: 'الحديد', persian: 'حدید' },
  58: { arabic: 'المجادلة', persian: 'مجادله' },
  59: { arabic: 'الحشر', persian: 'حشر' },
  60: { arabic: 'الممتحنة', persian: 'ممتحنه' },
  61: { arabic: 'الصف', persian: 'صف' },
  62: { arabic: 'الجمعة', persian: 'جمعه' },
  63: { arabic: 'المنافقون', persian: 'منافقون' },
  64: { arabic: 'التغابن', persian: 'تغابن' },
  65: { arabic: 'الطلاق', persian: 'طلاق' },
  66: { arabic: 'التحريم', persian: 'تحریم' },
  67: { arabic: 'الملك', persian: 'ملک' },
  68: { arabic: 'القلم', persian: 'قلم' },
  69: { arabic: 'الحاقة', persian: 'حاقه' },
  70: { arabic: 'المعارج', persian: 'معارج' },
  71: { arabic: 'نوح', persian: 'نوح' },
  72: { arabic: 'الجن', persian: 'جن' },
  73: { arabic: 'المزمل', persian: 'مزمل' },
  74: { arabic: 'المدثر', persian: 'مدثر' },
  75: { arabic: 'القيامة', persian: 'قیامت' },
  76: { arabic: 'الإنسان', persian: 'انسان' },
  77: { arabic: 'المرسلات', persian: 'مرسلات' },
  78: { arabic: 'النبأ', persian: 'نبأ' },
  79: { arabic: 'النازعات', persian: 'نازعات' },
  80: { arabic: 'عبس', persian: 'عبس' },
  81: { arabic: 'التكوير', persian: 'تکویر' },
  82: { arabic: 'الانفطار', persian: 'انفطار' },
  83: { arabic: 'المطففين', persian: 'مطففین' },
  84: { arabic: 'الانشقاق', persian: 'انشقاق' },
  85: { arabic: 'البروج', persian: 'بروج' },
  86: { arabic: 'الطارق', persian: 'طارق' },
  87: { arabic: 'الأعلى', persian: 'اعلی' },
  88: { arabic: 'الغاشية', persian: 'غاشیه' },
  89: { arabic: 'الفجر', persian: 'فجر' },
  90: { arabic: 'البلد', persian: 'بلد' },
  91: { arabic: 'الشمس', persian: 'شمس' },
  92: { arabic: 'الليل', persian: 'لیل' },
  93: { arabic: 'الضحى', persian: 'ضحی' },
  94: { arabic: 'الشرح', persian: 'انشراح' },
  95: { arabic: 'التين', persian: 'تین' },
  96: { arabic: 'العلق', persian: 'علق' },
  97: { arabic: 'القدر', persian: 'قدر' },
  98: { arabic: 'البينة', persian: 'بینه' },
  99: { arabic: 'الزلزلة', persian: 'زلزله' },
  100: { arabic: 'العاديات', persian: 'عادیات' },
  101: { arabic: 'القارعة', persian: 'قارعه' },
  102: { arabic: 'التكاثر', persian: 'تکاثر' },
  103: { arabic: 'العصر', persian: 'عصر' },
  104: { arabic: 'الهمزة', persian: 'همزه' },
  105: { arabic: 'الفيل', persian: 'فیل' },
  106: { arabic: 'قريش', persian: 'قریش' },
  107: { arabic: 'الماعون', persian: 'ماعون' },
  108: { arabic: 'الكوثر', persian: 'کوثر' },
  109: { arabic: 'الكافرون', persian: 'کافرون' },
  110: { arabic: 'النصر', persian: 'نصر' },
  111: { arabic: 'المسد', persian: 'مسد' },
  112: { arabic: 'الإخلاص', persian: 'توحید' },
  113: { arabic: 'الفلق', persian: 'فلق' },
  114: { arabic: 'الناس', persian: 'ناس' },
};

export function getSurahInfo(surahId: number) {
  return SURAH_NAMES[surahId] || { arabic: `سوره ${surahId}`, persian: `سوره ${surahId}` };
}

/**
 * ایجاد منبع آیه قرآن با Deep Link داخلی اپ
 */
export function createQuranSource(surahId: number, verseNumber: number): SourceItem {
  const surah = getSurahInfo(surahId);
  return {
    id: `quran:${surahId}:${verseNumber}`,
    title: `سوره ${surah.arabic} (${surah.persian})، آیه ${toPersianDigits(verseNumber)}`,
    type: 'quran',
    reference: `${surah.arabic}: ${toPersianDigits(verseNumber)}`,
    sourceName: 'قرآن کریم (ترجمه آیت‌الله العظمی مکارم شیرازی)',
    url: `/quran/${surahId}/${verseNumber}`,
    isInternal: true,
    metadata: {
      surahId,
      verseNumber,
      surahName: surah.arabic,
    },
  };
}

/**
 * ایجاد منبع تفسیر المیزان با لینک ارجاع علمی
 */
export function createTafsirMizanSource(surahId: number, verseNumber: number): SourceItem {
  const surah = getSurahInfo(surahId);
  return {
    id: `tafsir:mizan:${surahId}:${verseNumber}`,
    title: `تفسیر المیزان — ذیل آیه ${toPersianDigits(verseNumber)} سوره ${surah.arabic}`,
    type: 'tafsir',
    reference: `المیزان فی تفسیر القرآن (علامه طباطبایی)، ذیل ${surah.arabic}:${toPersianDigits(verseNumber)}`,
    sourceName: 'تفسیر المیزان (علامه سید محمدحسین طباطبایی)',
    url: `https://quran.inoor.ir/fa/ayah/${surahId}/${verseNumber}/commentary`,
    isInternal: false,
    metadata: {
      surahId,
      verseNumber,
      surahName: surah.arabic,
    },
  };
}

/**
 * ایجاد منبع تفسیر نمونه با لینک ارجاع علمی
 */
export function createTafsirNemonehSource(surahId: number, verseNumber: number): SourceItem {
  const surah = getSurahInfo(surahId);
  return {
    id: `tafsir:nemoneh:${surahId}:${verseNumber}`,
    title: `تفسیر نمونه — ذیل آیه ${toPersianDigits(verseNumber)} سوره ${surah.arabic}`,
    type: 'tafsir',
    reference: `تفسیر نمونه، ذیل ${surah.arabic}:${toPersianDigits(verseNumber)}`,
    sourceName: 'تفسیر نمونه (آیت‌الله العظمی مکارم شیرازی و دانشمندان)',
    url: `https://quran.inoor.ir/fa/ayah/${surahId}/${verseNumber}/commentary`,
    isInternal: false,
    metadata: {
      surahId,
      verseNumber,
      surahName: surah.arabic,
    },
  };
}

/**
 * ایجاد منبع روایی و حدیث معتبر
 */
export function createHadithSource(
  hadithId: string,
  bookName: string,
  chapter: string,
  reference: string
): SourceItem {
  return {
    id: `hadith:${hadithId}`,
    title: `${bookName} — باب ${chapter}`,
    type: 'hadith',
    reference,
    sourceName: bookName,
    url: `https://hadith.inoor.ir/`,
    isInternal: false,
  };
}

/**
 * ایجاد منبع جستجوی وب
 */
export function createWebSource(index: number, title: string, uri: string): SourceItem {
  return {
    id: `web:${index}`,
    title: title || 'صفحه وب مرتبط',
    type: 'web',
    reference: uri,
    sourceName: title || 'وب',
    url: uri,
    isInternal: false,
  };
}

/**
 * حل‌کننده شناسه منبع: تبدیل sourceId به شیء SourceItem کامل و معتبر
 */
export function resolveSourceById(sourceId: string, knownSourcesMap?: Map<string, SourceItem>): SourceItem | null {
  const cleanId = (sourceId || '').trim();
  if (!cleanId) return null;

  // ۱. اگر منبع قبلاً در کاتالوگ کشف شده بود
  if (knownSourcesMap && knownSourcesMap.has(cleanId)) {
    return knownSourcesMap.get(cleanId)!;
  }

  // ۲. تجزیه منبع قرآن: quran:2:255 یا 2:255
  const quranMatch = cleanId.match(/^(?:quran:)?(\d+):(\d+)$/i);
  if (quranMatch) {
    const sId = parseInt(quranMatch[1], 10);
    const vNum = parseInt(quranMatch[2], 10);
    return createQuranSource(sId, vNum);
  }

  // ۳. تجزیه تفسیر المیزان: tafsir:mizan:2:255
  const mizanMatch = cleanId.match(/^tafsir:mizan:(\d+):(\d+)$/i);
  if (mizanMatch) {
    const sId = parseInt(mizanMatch[1], 10);
    const vNum = parseInt(mizanMatch[2], 10);
    return createTafsirMizanSource(sId, vNum);
  }

  // ۴. تجزیه تفسیر نمونه: tafsir:nemoneh:2:255
  const nemonehMatch = cleanId.match(/^tafsir:nemoneh:(\d+):(\d+)$/i);
  if (nemonehMatch) {
    const sId = parseInt(nemonehMatch[1], 10);
    const vNum = parseInt(nemonehMatch[2], 10);
    return createTafsirNemonehSource(sId, vNum);
  }

  // ۵. جستجوی تقریبی در کاتالوگ
  if (knownSourcesMap) {
    for (const [id, item] of knownSourcesMap.entries()) {
      if (id.includes(cleanId) || cleanId.includes(id)) {
        return item;
      }
    }
  }

  return null;
}

/**
 * تبدیل آرایه شناسه‌های استفاده‌شده به لیست ساختاریافته منابع قابل کلیک
 */
export function resolveSourcesList(
  usedSourceIds: string[],
  knownCatalog: SourceItem[],
  webChunks?: WebGroundingChunk[]
): SourceItem[] {
  const map = new Map<string, SourceItem>();
  for (const item of knownCatalog) {
    map.set(item.id, item);
  }

  if (webChunks) {
    webChunks.forEach((chunk, idx) => {
      const webItem = createWebSource(idx, chunk.title, chunk.uri);
      map.set(webItem.id, webItem);
    });
  }

  const result: SourceItem[] = [];
  const seen = new Set<string>();

  for (const id of usedSourceIds) {
    if (seen.has(id)) continue;
    const resolved = resolveSourceById(id, map);
    if (resolved) {
      seen.add(id);
      result.push(resolved);
    }
  }

  // اگر هوش مصنوعی منبع خاصی از کاتالوگ را مستقیماً در used_source_ids نیاورد اما تنها ۱ یا ۲ آیه در کاتالوگ بود
  if (result.length === 0 && knownCatalog.length > 0) {
    return knownCatalog.slice(0, 3);
  }

  return result;
}
