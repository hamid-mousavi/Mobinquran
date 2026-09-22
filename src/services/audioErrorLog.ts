import { db } from '../db/quranDb';
import { AudioErrorLogEntry, AudioErrorKind } from '../types';

/** حداکثر تعداد ورودی‌های لاگ نگهداری‌شده (برای جلوگیری از رشد بی‌حد) */
export const AUDIO_ERROR_LOG_LIMIT = 200;

export async function logAudioError(entry: Omit<AudioErrorLogEntry, 'id' | 'createdAt'>): Promise<void> {
  try {
    await db.audioErrorLog.add({ ...entry, createdAt: Date.now() });
    // برش لاگ به آخرین N رکورد
    const total = await db.audioErrorLog.count();
    if (total > AUDIO_ERROR_LOG_LIMIT) {
      const excess = await db.audioErrorLog.orderBy('id').limit(total - AUDIO_ERROR_LOG_LIMIT).toArray();
      if (excess.length > 0) {
        await db.audioErrorLog.bulkDelete(excess.map((e) => e.id!));
      }
    }
  } catch (err) {
    console.warn('Failed to persist audio error log:', err);
  }
}

export async function getAudioErrorLog(limit = 100): Promise<AudioErrorLogEntry[]> {
  try {
    return await db.audioErrorLog.orderBy('id').reverse().limit(limit).toArray();
  } catch {
    return [];
  }
}

export async function clearAudioErrorLog(): Promise<void> {
  try {
    await db.audioErrorLog.clear();
  } catch {
    // نادیده گرفتن
  }
}

/** نگاشت معنادار نوع خطا به پیام فارسی برای نمایش در پلیر */
export function describeAudioError(kind: AudioErrorKind): string {
  switch (kind) {
    case 'network':
      return 'مشکل در ارتباط با شبکه رخ داد. اتصال اینترنت را بررسی کنید.';
    case 'not-found':
      return 'فایل صوتی این آیه در منبع انتخابی موجود نیست.';
    case 'corrupt':
      return 'فایل صوتی خراب یا قابل پخش نیست.';
    case 'cors':
      return 'دسترسی به منبع صوتی توسط مرورگر مسدود شد (CORS).';
    case 'cancelled':
      return 'پخش به‌صورت دستی متوقف شد.';
    default:
      return 'خطای ناشناخته در پخش صوتی رخ داد.';
  }
}

/**
 * طبقه‌بندی خطا بر اساس کد خطای عنصر audio مرورگر:
 *  2 → MEDIA_ERR_NETWORK (قطع شبکه)، 3 → MEDIA_ERR_DECODE (فایل خراب)
 * و وضعیت آنلاین مرورگر برای تفکیک قطعی از ۴۰۴.
 */
export function classifyAudioError(
  mediaErrorCode: number | null | undefined,
  isOnline: boolean
): AudioErrorKind {
  if (!isOnline) return 'network';
  if (mediaErrorCode === 2) return 'network';
  if (mediaErrorCode === 3) return 'corrupt';
  if (mediaErrorCode === 4) return 'not-found';
  return 'unknown';
}