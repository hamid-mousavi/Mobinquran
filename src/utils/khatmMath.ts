import { KhatmType } from '../types';

/**
 * محاسبهٔ بازه‌های روزانهٔ ختم بر اساس مرزهای واقعی مصحف (P3-T9)
 * به‌جای `Math.ceil(604 / n)`، از مرزهای جزء (۳۰ تا) و ربع حزب (۲۴۰ تا)
 * که از دادهٔ بستهٔ quran-core استخراج می‌شوند استفاده می‌کنیم تا برنامه
 * دقیقاً در روز هدف به پایان برسد و برچسب‌ها با جدول مصحف واقعی هم‌خوان باشند.
 */

export interface KhatmSegment {
  day: number;
  startPage: number;
  endPage: number;
  label: string;
}

const QUARTERS_PER_JUZ = 8;
const TOTAL_HIZB = 240;

function labelForBoundary(page: number, juzStarts: number[], quarterStarts: number[]): string {
  const juzIdx = juzStarts.indexOf(page);
  if (juzIdx !== -1) return `جزء ${juzIdx + 1}`;
  const qIdx = quarterStarts.indexOf(page);
  if (qIdx !== -1) return `ربع حزب ${qIdx + 1}`;
  return '';
}

/**
 * ساخت بازه‌ها از یک آرایهٔ مرزهای واقعی (صفحات شروع).
 * مرزها باید مرتب و بدون تکرار باشند و با صفحهٔ ۱ شروع و آخرین بازه با ۶۰۴ تمام شود.
 * اگر شکافی میان مرزها بود (دادهٔ ناهنجار)، آن را با تقسیم یکنواخت پر می‌کنیم.
 */
export function segmentsFromBoundaries(
  boundaryPages: number[],
  juzStarts: number[],
  quarterStarts: number[]
): KhatmSegment[] {
  const starts = [...new Set(boundaryPages.filter((p) => p >= 1 && p <= 604))].sort((a, b) => a - b);
  if (starts.length === 0 || starts[0] !== 1) starts.unshift(1);
  if (starts[starts.length - 1] !== 604) starts.push(604);

  const segments: KhatmSegment[] = [];
  const lastIndex = starts.length - 1;
  for (let i = 0; i < lastIndex; i++) {
    const day = i + 1;
    // آخرین بازه باید خودِ صفحهٔ ۶۰۴ را هم شامل شود (sentinel فقط نشان‌گر پایان است)
    const endPage = i === lastIndex - 1 ? 604 : starts[i + 1] - 1;
    segments.push({
      day,
      startPage: starts[i],
      endPage,
      label: labelForBoundary(starts[i], juzStarts, quarterStarts),
    });
  }
  return segments;
}

/**
 * بازه‌های روزانهٔ برنامهٔ ختم بر اساس نوع:
 * - ramadan_30 : مرزهای واقعی جزء (۳۰ بازه)
 * - hizb_120   : هر ۲ ربع حزب (۱۲۰ بازه ≈ ۵ صفحه در روز)
 * - arbaeen_40 : هر ۶ ربع حزب (۴۰ بازه ≈ ۱۵ صفحه در روز)
 * - custom     : چون مرز واقعی در بازهٔ دلخواه نیست، بازه‌های هم‌تا با سقف به صفحهٔ ۶۰۴
 */
export function buildKhatmSegments(
  type: KhatmType,
  targetDays: number,
  juzStarts: number[],
  quarterStarts: number[]
): { segments: KhatmSegment[]; perDayLabel: string } {
  if (type === 'ramadan_30' || (targetDays === 30 && juzStarts.length === 30)) {
    // انتشار واقعی یک جزء در هر روز
    const segments = segmentsFromBoundaries(juzStarts, juzStarts, quarterStarts);
    return { segments, perDayLabel: 'روزانه ۱ جزء (بر اساس مرز واقعی اجزاء)' };
  }

  if (type === 'hizb_120' && quarterStarts.length >= 120) {
    const step = 2; // ۱۲۰ بازه از ۲۴۰ مرز ربع
    const boundaries: number[] = [];
    for (let q = 0; q < 240; q += step) {
      boundaries.push(quarterStarts[q] || 1);
    }
    const segments = segmentsFromBoundaries(boundaries, juzStarts, quarterStarts);
    return { segments, perDayLabel: 'روزانه ۲ ربع حزب (~۵ صفحه)' };
  }

  if (type === 'arbaeen_40' && quarterStarts.length >= 240) {
    const step = 6; // ۴۰ بازه از ۲۴۰ مرز ربع
    const boundaries: number[] = [];
    for (let q = 0; q < 240; q += step) {
      boundaries.push(quarterStarts[q] || 1);
    }
    const segments = segmentsFromBoundaries(boundaries, juzStarts, quarterStarts);
    return { segments, perDayLabel: 'روزانه ۶ ربع حزب (~۱۵ صفحه)' };
  }

  // ختم سفارشی یا بازگشتِ امن: توزیع هم‌تا روی صفحهٔ ۶۰۴ بدون بیرون‌زدن از بازه
  const segments: KhatmSegment[] = [];
  for (let day = 1; day <= targetDays; day++) {
    const startPage = Math.floor(((day - 1) * 604) / targetDays) + 1;
    const endPage = Math.floor((day * 604) / targetDays);
    segments.push({
      day,
      startPage,
      endPage,
      label: labelForBoundary(startPage, juzStarts, quarterStarts),
    });
  }
  return { segments, perDayLabel: `روزانه ~${Math.ceil(604 / targetDays)} صفحه` };
}

export function buildSegmentsFromData(targetDays: number, juzStarts: number[], quarterStarts: number[]): KhatmSegment[] {
  return buildKhatmSegments('custom', targetDays, juzStarts, quarterStarts).segments;
}

export { TOTAL_HIZB, QUARTERS_PER_JUZ };