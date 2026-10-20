/**
 * مجموعهٔ آیه‌های منتخب برای «آیهٔ روز» و «تدبر روزانه».
 * فقط ارجاع (سوره، آیه) و موضوع کوتاه فارسی نگهداری می‌شود؛ متن عربی و ترجمه همیشه از بستهٔ
 * محلی قرآن خوانده می‌شود، نه از این فایل (تا هیچ متنی دستی تایپ نشود).
 */

export interface TadabburItem {
  surahId: number;
  verseNumber: number;
  theme: string;
}

export const TADABBUR_POOL: readonly TadabburItem[] = [
  // توحید و معرفت
  { surahId: 2, verseNumber: 255, theme: 'توحید و عظمت الهی (آیة الکرسی)' },
  { surahId: 24, verseNumber: 35, theme: 'آیه نور و فیض معرفت' },
  { surahId: 59, verseNumber: 22, theme: 'خدایی که غیب و شهادت را می‌داند' },
  { surahId: 57, verseNumber: 3, theme: 'اول و آخر و ظاهر و باطن' },
  { surahId: 50, verseNumber: 16, theme: 'نزدیکی خدا از رگ گردن' },
  // امید و گشایش
  { surahId: 94, verseNumber: 5, theme: 'همراهی آسانی با سختی' },
  { surahId: 39, verseNumber: 53, theme: 'رحمت بی‌کران و امید به مغفرت' },
  { surahId: 12, verseNumber: 87, theme: 'ناامید نشدن از رحمت خدا' },
  { surahId: 2, verseNumber: 286, theme: 'تکلیف به اندازهٔ توان' },
  // آرامش و ذکر
  { surahId: 13, verseNumber: 28, theme: 'آرامش دل با یاد پروردگار' },
  { surahId: 48, verseNumber: 4, theme: 'نزول آرامش بر دل مؤمنان' },
  { surahId: 2, verseNumber: 152, theme: 'یاد کردن خدا و یاد شدن' },
  { surahId: 33, verseNumber: 41, theme: 'ذکر فراوان' },
  // توکل
  { surahId: 65, verseNumber: 3, theme: 'توکل و کفایت پروردگار' },
  { surahId: 3, verseNumber: 173, theme: 'حسبنا الله و نعم الوکیل' },
  // دعا
  { surahId: 2, verseNumber: 186, theme: 'نزدیکی پروردگار و اجابت دعا' },
  { surahId: 40, verseNumber: 60, theme: 'دعا و وعدهٔ اجابت' },
  { surahId: 2, verseNumber: 201, theme: 'دعای خیر دنیا و آخرت' },
  { surahId: 3, verseNumber: 8, theme: 'دعا برای ثبات دل' },
  { surahId: 7, verseNumber: 23, theme: 'اعتراف و بازگشت' },
  { surahId: 21, verseNumber: 87, theme: 'دعای یونس در تاریکی‌ها' },
  { surahId: 25, verseNumber: 74, theme: 'دعا برای خانواده' },
  { surahId: 20, verseNumber: 114, theme: 'دعا برای افزایش علم' },
  // صبر و شکر
  { surahId: 2, verseNumber: 153, theme: 'یاری جستن از صبر و نماز' },
  { surahId: 39, verseNumber: 10, theme: 'پاداش بی‌حساب صابران' },
  { surahId: 3, verseNumber: 200, theme: 'صبر، مرابطه و تقوا' },
  { surahId: 14, verseNumber: 7, theme: 'شکر و افزایش نعمت' },
  { surahId: 2, verseNumber: 155, theme: 'آزمون و بشارت به صابران' },
  // احسان و اخلاق
  { surahId: 55, verseNumber: 60, theme: 'قاعده احسان و پاداش نیکوکاران' },
  { surahId: 16, verseNumber: 90, theme: 'فرمان به عدل و احسان' },
  { surahId: 17, verseNumber: 23, theme: 'نیکی به پدر و مادر' },
  { surahId: 49, verseNumber: 13, theme: 'کرامت به تقواست' },
  { surahId: 41, verseNumber: 34, theme: 'پاسخ بدی با بهترین' },
  { surahId: 3, verseNumber: 134, theme: 'فروخوردن خشم و گذشت' },
  { surahId: 24, verseNumber: 22, theme: 'بخشش و چشم‌پوشی' },
  { surahId: 25, verseNumber: 63, theme: 'بندگان رحمان؛ تواضع و سلام' },
  { surahId: 31, verseNumber: 18, theme: 'نهی از تکبر' },
  { surahId: 2, verseNumber: 177, theme: 'نیکی واقعی چیست' },
  { surahId: 3, verseNumber: 92, theme: 'نیکی با انفاق از دوست‌داشتنی‌ها' },
  { surahId: 2, verseNumber: 261, theme: 'برکت انفاق' },
  // عدالت
  { surahId: 4, verseNumber: 135, theme: 'عدالت حتی علیه خود' },
  { surahId: 5, verseNumber: 8, theme: 'عدالت با دشمن' },
  // علم و تفکر
  { surahId: 96, verseNumber: 1, theme: 'آغاز وحی: بخوان' },
  { surahId: 39, verseNumber: 9, theme: 'عبادت شبانه و برابر نبودن دانا و نادان' },
  { surahId: 58, verseNumber: 11, theme: 'رفعت اهل علم و ایمان' },
  { surahId: 3, verseNumber: 190, theme: 'نشانه‌ها برای اهل تفکر' },
  // نماز و بندگی
  { surahId: 29, verseNumber: 45, theme: 'اثر نماز در بازداشتن از زشتی' },
  { surahId: 20, verseNumber: 14, theme: 'نماز برای یاد خدا' },
  { surahId: 23, verseNumber: 1, theme: 'رستگاری مؤمنان' },
  // خانواده و مرگ و آخرت
  { surahId: 30, verseNumber: 21, theme: 'سکون و مودت در خانواده' },
  { surahId: 3, verseNumber: 185, theme: 'چشیدن مرگ و حقیقت دنیا' },
  { surahId: 99, verseNumber: 7, theme: 'ذره‌ای نیکی را هم می‌بینی' },
  { surahId: 112, verseNumber: 1, theme: 'اخلاص: خدای یگانه' },
  { surahId: 47, verseNumber: 7, theme: 'یاری خدا و ثبات قدم' },
];
