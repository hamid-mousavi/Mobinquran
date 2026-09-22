import { Verse, Surah } from '../types';

/**
 * اشتراک‌گذاری آیه (P3-T7):
 * ۱. متن (سوره:آیه + ترجمه + نام اپ)
 * ۲. کارت تصویری با فونت‌های خودمیزبان (Amiri برای عربی، Vazirmatn برای فارسی)
 * از هیچ CDN خارجی استفاده نمی‌شود.
 */

const APP_NAME = 'قرآن مبین';

function buildAyahText(verse: Verse, translation: string, surah: Surah): string {
  const ref = `سوره ${surah.namePersian} (${surah.nameArabic}) — آیه ${verse.verseNumber}`;
  return `${verse.textArabic}\n\n«${translation}»\n(${ref})\n📖 ${APP_NAME}`;
}

const ARABIC_FONT = "'Amiri Quran'";
const PERSIAN_FONT = "'Vazirmatn'";

async function ensureFontLoaded(fontSpec: string): Promise<void> {
  try {
    if (document.fonts?.load) {
      await Promise.allSettled([
        document.fonts.load(fontSpec, 'بِسْمِ ٱللَّهِ'),
        document.fonts.load(fontSpec, 'قرآن مبین'),
      ]);
      await document.fonts.ready;
    }
  } catch {
    // در صورت عدم پشتیبانی، بدون فونت ادامه می‌دهیم
  }
}

function drawCard(
  verse: Verse,
  translation: string,
  surah: Surah,
  darkMode: boolean
): HTMLCanvasElement {
  const width = 1080;
  const height = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  const bg = darkMode
    ? ctx.createLinearGradient(0, 0, width, height)
    : ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, darkMode ? '#0f172a' : '#0b3d3a');
  bg.addColorStop(0.5, darkMode ? '#042f2e' : '#065f5a');
  bg.addColorStop(1, darkMode ? '#022c22' : '#0f766e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // قاب تذهیب
  ctx.strokeStyle = darkMode ? 'rgba(245, 158, 11, 0.55)' : 'rgba(180, 150, 60, 0.8)';
  ctx.lineWidth = 3;
  ctx.strokeRect(28, 28, width - 56, height - 56);

  ctx.direction = 'rtl';
  ctx.textAlign = 'center';

  // سربرگ
  ctx.fillStyle = darkMode ? '#fbbf24' : '#fcd34d';
  ctx.font = `600 44px ${PERSIAN_FONT}`;
  ctx.fillText(`سوره ${surah.namePersian} — آیه ${verse.verseNumber}`, width / 2, 150);

  // متن عربی آیه
  ctx.fillStyle = '#ffffff';
  ctx.font = `52px ${ARABIC_FONT}`;
  const arabicLines = wrapCanvasText(ctx, verse.textArabic, width - 160, 56);
  const arabicBlockHeight = arabicLines.length * 90;
  let y = 300;
  for (const line of arabicLines) {
    ctx.fillText(line, width / 2, y);
    y += 96;
  }

  // ترجمه
  const transLines = wrapCanvasText(ctx, translation, width - 220, 32);
  ctx.font = `40px ${PERSIAN_FONT}`;
  ctx.fillStyle = darkMode ? '#d8f3ec' : '#e7f6f2';
  y = 360 + arabicBlockHeight;
  for (const line of transLines.slice(0, 7)) {
    ctx.fillText(line, width / 2, y);
    y += 64;
  }

  // امضای انتهای کارت
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `500 34px ${PERSIAN_FONT}`;
  ctx.fillText(`📖 ${APP_NAME}`, width / 2, height - 110);

  return canvas;
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLen: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxLen && (current === '' || ctx.measureText(candidate).width <= maxWidth)) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function shareAyah(verse: Verse, translation: string, surah: Surah): Promise<void> {
  if (!translation) translation = verse.translationMakarem || '';
  const text = buildAyahText(verse, translation, surah);

  const canvasPromise = (async () => {
    await ensureFontLoaded(`52px ${ARABIC_FONT}`);
    await ensureFontLoaded(`40px ${PERSIAN_FONT}`);
    const isDark = document.documentElement.classList.contains('dark');
    const card = drawCard(verse, translation, surah, isDark);
    return await new Promise<Blob>((resolve, reject) => {
      card.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/png');
    });
  })();

  try {
    const nav = navigator as Navigator & {
      canShare?: (data: { files?: File[] }) => boolean;
    };
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ text, title: `${APP_NAME} — آیه ${verse.verseNumber}` });
        return;
      } catch {
        // کاربر اشتراک را لغو کرد یا قابلیت تصویرپذیری ندارد؛ ادامه برای کارت
      }
      try {
        const imgBlob = await canvasPromise;
        const file = new File([imgBlob], `ayah-${verse.surahId}-${verse.verseNumber}.png`, {
          type: 'image/png',
        });
        if (nav.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], text });
          return;
        }
      } catch {
        // ادامه به دانلود
      }
    }
    // fallback: کپی متن و دانلود کارت
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // بدون کلیپ‌بورد
    }
    const imgBlob = await canvasPromise;
    downloadBlob(imgBlob, `ayah-${verse.surahId}-${verse.verseNumber}.png`);
  } catch {
    // در صورت هر خطایی، دست‌کم متن کپی می‌شود
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // هیچ
    }
  }
}