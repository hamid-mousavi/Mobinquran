/**
 * سرویس سبک، دقیق و آفلاین برای پیگیری زنجیره پیوستگی روزانه (Daily Streak)،
 * فعالیت‌های انس با قرآن و مرور هوشمند (Spaced Repetition / لایتنر)
 */

import { localDateKey, daysSinceStart } from '../utils/date';

export type ActivityType = 'read' | 'listen' | 'memorize' | 'quiz' | 'khatm';

export interface DayActivity {
  date: string; // YYYY-MM-DD
  types: ActivityType[];
  count: number;
}

export interface StreakData {
  currentStreak: number;
  bestStreak: number;
  lastActiveDate: string | null;
  totalDaysActive: number;
  todayCompleted: boolean;
}

export interface ReviewAyahItem {
  id: string; // `${surahId}:${verseNumber}`
  surahId: number;
  surahNameArabic: string;
  verseNumber: number;
  addedAt: number; // timestamp
  box: number; // 1 (1 day), 2 (3 days), 3 (7 days), 4 (14 days), 5 (mastered)
  nextReviewDate: string; // YYYY-MM-DD
}

const STORAGE_KEY_ACTIVITY = 'mobin_daily_activity_v1';
const STORAGE_KEY_STREAK = 'mobin_streak_data_v1';
const STORAGE_KEY_REVIEW = 'mobin_review_deck_v1';

// نام روزهای هفته به تقویم فارسی (شنبه تا جمعه)
export const PERSIAN_WEEK_DAYS = [
  { key: 6, label: 'ش', name: 'شنبه' },
  { key: 0, label: 'ی', name: 'یکشنبه' },
  { key: 1, label: 'د', name: 'دوشنبه' },
  { key: 2, label: 'س', name: 'سه‌شنبه' },
  { key: 3, label: 'چ', name: 'چهارشنبه' },
  { key: 4, label: 'پ', name: 'پنج‌شنبه' },
  { key: 5, label: 'ج', name: 'جمعه' },
];

/** دریافت تاریخچه فعالیت‌ها از حافظه محلی */
export function getActivities(): Record<string, DayActivity> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACTIVITY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** دریافت وضعیت زنجیره همراهی */
export function getStreakData(): StreakData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STREAK);
    if (raw) {
      const data: StreakData = JSON.parse(raw);
      const today = localDateKey();
      
      // بررسی پایداری زنجیره: اگر آخرین فعالیت دیروز یا امروز نبوده، زنجیره شکسته شده
      if (data.lastActiveDate) {
        const diff = daysSinceStart(data.lastActiveDate, new Date());
        if (diff > 1) {
          data.currentStreak = 0;
        }
      }
      data.todayCompleted = data.lastActiveDate === today;
      return data;
    }
  } catch {
    // fallback
  }

  return {
    currentStreak: 0,
    bestStreak: 0,
    lastActiveDate: null,
    totalDaysActive: 0,
    todayCompleted: false,
  };
}

/** ثبت یک فعالیت انس با قرآن برای امروز */
export function recordUserActivity(type: ActivityType): StreakData {
  const today = localDateKey();
  const activities = getActivities();
  const existing = activities[today] || { date: today, types: [], count: 0 };

  if (!existing.types.includes(type)) {
    existing.types.push(type);
  }
  existing.count += 1;
  activities[today] = existing;

  try {
    localStorage.setItem(STORAGE_KEY_ACTIVITY, JSON.stringify(activities));
  } catch (err) {
    console.warn('Failed to save activity:', err);
  }

  // محاسبه و به‌روزرسانی زنجیره
  const currentStreakData = getStreakData();
  let newCurrentStreak = currentStreakData.currentStreak;
  let newBestStreak = currentStreakData.bestStreak;
  let newTotalDays = currentStreakData.totalDaysActive;

  if (currentStreakData.lastActiveDate !== today) {
    if (!currentStreakData.lastActiveDate) {
      newCurrentStreak = 1;
      newTotalDays = 1;
    } else {
      const diff = daysSinceStart(currentStreakData.lastActiveDate, new Date());
      if (diff === 1) {
        // دیروز فعال بوده، افزایش زنجیره
        newCurrentStreak += 1;
        newTotalDays += 1;
      } else if (diff === 0) {
        // همان امروز
      } else {
        // فاصله افتاده
        newCurrentStreak = 1;
        newTotalDays += 1;
      }
    }

    if (newCurrentStreak > newBestStreak) {
      newBestStreak = newCurrentStreak;
    }
  }

  const updatedStreak: StreakData = {
    currentStreak: newCurrentStreak,
    bestStreak: newBestStreak,
    lastActiveDate: today,
    totalDaysActive: newTotalDays,
    todayCompleted: true,
  };

  try {
    localStorage.setItem(STORAGE_KEY_STREAK, JSON.stringify(updatedStreak));
    window.dispatchEvent(new CustomEvent('mobin-activity-updated', { detail: updatedStreak }));
  } catch (err) {
    console.warn('Failed to save streak:', err);
  }

  return updatedStreak;
}

/** وضعیت ۷ روز هفته جاری (شنبه تا جمعه) */
export interface WeekDayStatus {
  dayLabel: string;
  dayName: string;
  dateKey: string;
  isToday: boolean;
  isCompleted: boolean;
}

export function getCurrentWeekStatus(): WeekDayStatus[] {
  const activities = getActivities();
  const today = new Date();
  const todayKey = localDateKey(today);
  const currentDayOfWeek = today.getDay(); // 0 is Sunday, 6 is Saturday

  // در ایران شنبه روز ۰ است:
  // Saturday = 6 -> distance = 0
  // Sunday = 0 -> distance = 1
  // Friday = 5 -> distance = 6
  const persianDayIndex = (currentDayOfWeek + 1) % 7;

  // محاسبه تاریخ شنبه هفته جاری
  const saturday = new Date(today);
  saturday.setDate(today.getDate() - persianDayIndex);

  const result: WeekDayStatus[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(saturday);
    d.setDate(saturday.getDate() + i);
    const dateKey = localDateKey(d);
    const item = PERSIAN_WEEK_DAYS[i];

    result.push({
      dayLabel: item.label,
      dayName: item.name,
      dateKey,
      isToday: dateKey === todayKey,
      isCompleted: Boolean(activities[dateKey] && activities[dateKey].count > 0),
    });
  }

  return result;
}

// -------------------------------------------------------------
// سیستم لایتنر و آیات نیازمند مرور (Spaced Repetition)
// -------------------------------------------------------------

export function getReviewDeck(): ReviewAyahItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REVIEW);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addAyahToReview(
  surahId: number,
  surahNameArabic: string,
  verseNumber: number,
  dueImmediately = true
): void {
  const deck = getReviewDeck();
  const id = `${surahId}:${verseNumber}`;
  const existing = deck.find((item) => item.id === id);
  const today = new Date();

  const reviewDate = dueImmediately ? today : new Date(today.getTime() + 86400000);

  if (existing) {
    existing.box = 1;
    existing.nextReviewDate = localDateKey(reviewDate);
  } else {
    deck.push({
      id,
      surahId,
      surahNameArabic,
      verseNumber,
      addedAt: Date.now(),
      box: 1,
      nextReviewDate: localDateKey(reviewDate),
    });
  }

  try {
    localStorage.setItem(STORAGE_KEY_REVIEW, JSON.stringify(deck));
    window.dispatchEvent(new CustomEvent('mobin-review-deck-updated'));
  } catch {}
}

/** دریافت کل آیات موجود در جعبه لایتنر */
export function getAllReviewAyahs(): ReviewAyahItem[] {
  return getReviewDeck();
}

/** افزودن چند آیه نمونه برای تست سریع سیستم لایتنر */
export function seedSampleReviewAyahs(): void {
  addAyahToReview(2, 'البَقَرَة', 255, true); // آیة الکرسی
  addAyahToReview(112, 'الإِخْلَاص', 1, true); // توحید
  addAyahToReview(94, 'الشَّرْح', 5, true); // إن مع العسر یسرا
}

export function advanceAyahReview(id: string, isCorrect: boolean): void {
  const deck = getReviewDeck();
  const item = deck.find((x) => x.id === id);
  if (!item) return;

  const today = new Date();
  if (isCorrect) {
    item.box += 1;
    // فواصل لایتنر: جعبه ۱: ۱ روز، جعبه ۲: ۳ روز، جعبه ۳: ۷ روز، جعبه ۴: ۱۴ روز
    const daysToAdd = item.box === 2 ? 3 : item.box === 3 ? 7 : item.box === 4 ? 14 : 30;
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + daysToAdd);
    item.nextReviewDate = localDateKey(nextDate);
  } else {
    // بازگشت به جعبه ۱
    item.box = 1;
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    item.nextReviewDate = localDateKey(tomorrow);
  }

  try {
    localStorage.setItem(STORAGE_KEY_REVIEW, JSON.stringify(deck));
    window.dispatchEvent(new CustomEvent('mobin-review-deck-updated'));
  } catch {}
}

export function removeAyahFromReview(id: string): void {
  const deck = getReviewDeck().filter((x) => x.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY_REVIEW, JSON.stringify(deck));
    window.dispatchEvent(new CustomEvent('mobin-review-deck-updated'));
  } catch {}
}

/** آیاتی که موعد مرور آنها امروز یا قبل از آن است */
export function getDueReviewAyahs(): ReviewAyahItem[] {
  const deck = getReviewDeck();
  const todayKey = localDateKey();
  return deck.filter((item) => item.nextReviewDate <= todayKey);
}
