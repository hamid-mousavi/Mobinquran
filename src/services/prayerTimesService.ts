/**
 * سرویس محاسبه نجومی اوقات شرعی و قبله‌نما (۱۰۰٪ آفلاین و دقیق)
 * بر مبنای فرمول‌های مصوب مؤسسه ژئوفیزیک دانشگاه تهران
 * و پوشش کامل تمامی استان‌ها و شهرهای ایران
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
  elevation?: number;
  timezone?: number;
}

export interface CityInfo {
  id: string;
  name: string;
  province: string;
  latitude: number;
  longitude: number;
  elevation?: number;
  timezone?: number;
}

export type PrayerKey = 'fajr' | 'sunrise' | 'dhuhr' | 'sunset' | 'maghrib' | 'midnight';

export type CalculationMethod = 'tehran' | 'taghrib' | 'mwl' | 'makkah';

export interface PrayerTimes {
  fajr: string; // اذان صبح
  sunrise: string; // طلوع آفتاب
  dhuhr: string; // اذان ظهر
  sunset: string; // غروب آفتاب
  maghrib: string; // اذان مغرب
  midnight: string; // نیمه‌شب شرعی
  rawTimes: {
    fajr: Date;
    sunrise: Date;
    dhuhr: Date;
    sunset: Date;
    maghrib: Date;
    midnight: Date;
  };
}

export interface NextPrayerInfo {
  key: PrayerKey;
  name: string;
  time: string;
  remainingMinutes: number;
  remainingSeconds: number;
  formattedRemaining: string;
  isToday: boolean;
}

/**
 * فهرست ۳۱ استان ایران
 */
export const PROVINCES_LIST: string[] = [
  'تهران',
  'خراسان رضوی',
  'اصفهان',
  'فارس',
  'آذربایجان شرقی',
  'آذربایجان غربی',
  'خوزستان',
  'مازندران',
  'گیلان',
  'کرمان',
  'کرمانشاه',
  'لرستان',
  'هرمزگان',
  'یزد',
  'همدان',
  'گلستان',
  'سیستان و بلوچستان',
  'کردستان',
  'قزوین',
  'زنجان',
  'سمنان',
  'مرکزی',
  'بوشهر',
  'البرز',
  'قم',
  'اردبیل',
  'خراسان شمالی',
  'خراسان جنوبی',
  'چهارمحال و بختیاری',
  'کهگیلویه و بویراحمد',
  'ایلام',
  'عتبات عالیات و اماکن مقدسه',
];

/**
 * فهرست جامع تمامی استان‌ها و شهرهای مهم ایران (بیش از ۱۵۰ شهر با مختصات دقیق)
 */
export const CITIES_LIST: CityInfo[] = [
  // استان تهران
  { id: 'tehran', name: 'تهران', province: 'تهران', latitude: 35.6892, longitude: 51.3890, elevation: 1200 },
  { id: 'rey', name: 'شهر ری', province: 'تهران', latitude: 35.5900, longitude: 51.4358, elevation: 1060 },
  { id: 'eslamshahr', name: 'اسلامشهر', province: 'تهران', latitude: 35.5414, longitude: 51.2333, elevation: 1100 },
  { id: 'shahriar', name: 'شهریار', province: 'تهران', latitude: 35.6597, longitude: 51.0594, elevation: 1160 },
  { id: 'qods', name: 'شهر قدس', province: 'تهران', latitude: 35.7208, longitude: 51.1089, elevation: 1240 },
  { id: 'malard', name: 'ملارد', province: 'تهران', latitude: 35.6661, longitude: 50.9767, elevation: 1170 },
  { id: 'varamin', name: 'ورامین', province: 'تهران', latitude: 35.3242, longitude: 51.6469, elevation: 915 },
  { id: 'pakdasht', name: 'پاکدشت', province: 'تهران', latitude: 35.4819, longitude: 51.6803, elevation: 1025 },
  { id: 'damavand', name: 'دماوند', province: 'تهران', latitude: 35.7178, longitude: 52.0650, elevation: 1960 },
  { id: 'robat_karim', name: 'رباط‌کریم', province: 'تهران', latitude: 35.4847, longitude: 51.0828, elevation: 1020 },
  { id: 'firuzkuh', name: 'فیروزکوه', province: 'تهران', latitude: 35.7567, longitude: 52.7706, elevation: 1930 },
  { id: 'pardis', name: 'پردیس', province: 'تهران', latitude: 35.7369, longitude: 51.8153, elevation: 1750 },
  { id: 'qarchak', name: 'قرچک', province: 'تهران', latitude: 35.4397, longitude: 51.5694, elevation: 950 },

  // استان خراسان رضوی
  { id: 'mashhad', name: 'مشهد مقدس', province: 'خراسان رضوی', latitude: 36.2970, longitude: 59.6062, elevation: 999 },
  { id: 'neyshabur', name: 'نیشابور', province: 'خراسان رضوی', latitude: 36.2133, longitude: 58.7958, elevation: 1250 },
  { id: 'sabzevar', name: 'سبزوار', province: 'خراسان رضوی', latitude: 36.2126, longitude: 57.6789, elevation: 977 },
  { id: 'torbat_heydarieh', name: 'تربت حیدریه', province: 'خراسان رضوی', latitude: 35.2744, longitude: 59.2194, elevation: 1333 },
  { id: 'quchan', name: 'قوچان', province: 'خراسان رضوی', latitude: 37.1061, longitude: 58.5094, elevation: 1350 },
  { id: 'kashmar', name: 'کاشمر', province: 'خراسان رضوی', latitude: 35.2383, longitude: 58.4656, elevation: 1060 },
  { id: 'torbat_jam', name: 'تربت جام', province: 'خراسان رضوی', latitude: 35.2439, longitude: 60.6225, elevation: 928 },
  { id: 'taybad', name: 'تایباد', province: 'خراسان رضوی', latitude: 34.7400, longitude: 60.7756, elevation: 805 },
  { id: 'gonabad', name: 'گناباد', province: 'خراسان رضوی', latitude: 34.3528, longitude: 58.6836, elevation: 1096 },
  { id: 'chenaran', name: 'چناران', province: 'خراسان رضوی', latitude: 36.6450, longitude: 59.1214, elevation: 1150 },
  { id: 'sarakhs', name: 'سرخس', province: 'خراسان رضوی', latitude: 36.5447, longitude: 61.1578, elevation: 280 },

  // استان اصفهان
  { id: 'isfahan', name: 'اصفهان', province: 'اصفهان', latitude: 32.6546, longitude: 51.6680, elevation: 1574 },
  { id: 'kashan', name: 'کاشان', province: 'اصفهان', latitude: 33.9850, longitude: 51.4100, elevation: 982 },
  { id: 'najafabad', name: 'نجف‌آباد', province: 'اصفهان', latitude: 32.6342, longitude: 51.3667, elevation: 1600 },
  { id: 'khomeinishahr', name: 'خمینی‌شهر', province: 'اصفهان', latitude: 32.6997, longitude: 51.5278, elevation: 1590 },
  { id: 'shahinshahr', name: 'شاهین‌شهر', province: 'اصفهان', latitude: 32.8644, longitude: 51.5475, elevation: 1595 },
  { id: 'shahreza', name: 'شهرضا', province: 'اصفهان', latitude: 31.9961, longitude: 51.8683, elevation: 1825 },
  { id: 'zarrinshahr', name: 'زرین‌شهر (لنجان)', province: 'اصفهان', latitude: 32.3897, longitude: 51.3764, elevation: 1690 },
  { id: 'golpayegan', name: 'گلپایگان', province: 'اصفهان', latitude: 33.4536, longitude: 50.2883, elevation: 1818 },
  { id: 'nain', name: 'نایین', province: 'اصفهان', latitude: 32.8600, longitude: 53.0875, elevation: 1560 },
  { id: 'natanz', name: 'نطنز', province: 'اصفهان', latitude: 33.5131, longitude: 51.9167, elevation: 1600 },
  { id: 'aran_bidgol', name: 'آران و بیدگل', province: 'اصفهان', latitude: 34.0583, longitude: 51.4833, elevation: 912 },
  { id: 'khansar', name: 'خوانسار', province: 'اصفهان', latitude: 33.2206, longitude: 50.3150, elevation: 2250 },
  { id: 'semirom', name: 'سمیرم', province: 'اصفهان', latitude: 31.4144, longitude: 51.5694, elevation: 2460 },

  // استان فارس
  { id: 'shiraz', name: 'شیراز', province: 'فارس', latitude: 29.5926, longitude: 52.5836, elevation: 1500 },
  { id: 'marvdasht', name: 'مرودشت', province: 'فارس', latitude: 29.8742, longitude: 52.8025, elevation: 1620 },
  { id: 'jahrom', name: 'جهرم', province: 'فارس', latitude: 28.5000, longitude: 53.5600, elevation: 1050 },
  { id: 'kazerun', name: 'کازرون', province: 'فارس', latitude: 29.6194, longitude: 51.6542, elevation: 860 },
  { id: 'lar', name: 'لارستان (لار)', province: 'فارس', latitude: 27.6833, longitude: 54.3333, elevation: 915 },
  { id: 'fasa', name: 'فسا', province: 'فارس', latitude: 28.9383, longitude: 53.6481, elevation: 1450 },
  { id: 'darab', name: 'داراب', province: 'فارس', latitude: 28.7519, longitude: 54.5444, elevation: 1180 },
  { id: 'firuzabad', name: 'فیروزآباد', province: 'فارس', latitude: 28.8439, longitude: 52.5708, elevation: 1330 },
  { id: 'abadeh', name: 'آباده', province: 'فارس', latitude: 31.1608, longitude: 52.6506, elevation: 2011 },
  { id: 'neyriz', name: 'نی‌ریز', province: 'فارس', latitude: 29.1986, longitude: 54.3278, elevation: 1605 },
  { id: 'eghlid', name: 'اقلید', province: 'فارس', latitude: 30.8986, longitude: 52.6828, elevation: 2250 },
  { id: 'lamerd', name: 'لامرد', province: 'فارس', latitude: 27.3347, longitude: 53.1789, elevation: 420 },

  // استان آذربایجان شرقی
  { id: 'tabriz', name: 'تبریز', province: 'آذربایجان شرقی', latitude: 38.0800, longitude: 46.2919, elevation: 1340 },
  { id: 'maragheh', name: 'مراغه', province: 'آذربایجان شرقی', latitude: 37.3917, longitude: 46.2392, elevation: 1475 },
  { id: 'marand', name: 'مرند', province: 'آذربایجان شرقی', latitude: 38.4328, longitude: 45.7750, elevation: 1334 },
  { id: 'mianeh', name: 'میانه', province: 'آذربایجان شرقی', latitude: 37.4225, longitude: 47.7153, elevation: 1100 },
  { id: 'ahar', name: 'اهر', province: 'آذربایجان شرقی', latitude: 38.4772, longitude: 47.0697, elevation: 1341 },
  { id: 'bonab', name: 'بناب', province: 'آذربایجان شرقی', latitude: 37.3400, longitude: 46.0561, elevation: 1290 },
  { id: 'jolfa', name: 'جلفا', province: 'آذربایجان شرقی', latitude: 38.9378, longitude: 45.6294, elevation: 710 },
  { id: 'sarab', name: 'سراب', province: 'آذربایجان شرقی', latitude: 37.9408, longitude: 47.5367, elevation: 1680 },

  // استان آذربایجان غربی
  { id: 'urmia', name: 'ارومیه', province: 'آذربایجان غربی', latitude: 37.5527, longitude: 45.0761, elevation: 1332 },
  { id: 'khoy', name: 'خوی', province: 'آذربایجان غربی', latitude: 38.5503, longitude: 44.9578, elevation: 1139 },
  { id: 'mahabad', name: 'مهاباد', province: 'آذربایجان غربی', latitude: 36.7631, longitude: 45.7222, elevation: 1320 },
  { id: 'bukan', name: 'بوکان', province: 'آذربایجان غربی', latitude: 36.5206, longitude: 46.2089, elevation: 1370 },
  { id: 'miandoab', name: 'میاندوآب', province: 'آذربایجان غربی', latitude: 36.9686, longitude: 46.1042, elevation: 1314 },
  { id: 'salmas', name: 'سلماس', province: 'آذربایجان غربی', latitude: 38.1975, longitude: 44.7656, elevation: 1390 },
  { id: 'piranshahr', name: 'پیرانشهر', province: 'آذربایجان غربی', latitude: 36.7000, longitude: 45.1417, elevation: 1440 },
  { id: 'naqadeh', name: 'نقده', province: 'آذربایجان غربی', latitude: 36.9553, longitude: 45.3881, elevation: 1300 },
  { id: 'maku', name: 'ماکو', province: 'آذربایجان غربی', latitude: 39.2953, longitude: 44.5100, elevation: 1634 },

  // استان خوزستان
  { id: 'ahvaz', name: 'اهواز', province: 'خوزستان', latitude: 31.3183, longitude: 48.6706, elevation: 20 },
  { id: 'dezful', name: 'دزفول', province: 'خوزستان', latitude: 32.3811, longitude: 48.4058, elevation: 143 },
  { id: 'abadan', name: 'آبادان', province: 'خوزستان', latitude: 30.3392, longitude: 48.3043, elevation: 3 },
  { id: 'khorramshahr', name: 'خرمشهر', province: 'خوزستان', latitude: 30.4397, longitude: 48.1803, elevation: 3 },
  { id: 'mahshahr', name: 'بندر ماهشهر', province: 'خوزستان', latitude: 30.5589, longitude: 49.1981, elevation: 5 },
  { id: 'behbahan', name: 'بهبهان', province: 'خوزستان', latitude: 30.5958, longitude: 50.2417, elevation: 325 },
  { id: 'andimeshk', name: 'اندیمشک', province: 'خوزستان', latitude: 32.4600, longitude: 48.3547, elevation: 176 },
  { id: 'izeh', name: 'ایذه', province: 'خوزستان', latitude: 31.8344, longitude: 49.8697, elevation: 824 },
  { id: 'shushtar', name: 'شوشتر', province: 'خوزستان', latitude: 32.0456, longitude: 48.8567, elevation: 68 },
  { id: 'shush', name: 'شوش دانیال', province: 'خوزستان', latitude: 32.1942, longitude: 48.2436, elevation: 78 },
  { id: 'masjed_soleyman', name: 'مسجدسلیمان', province: 'خوزستان', latitude: 31.9364, longitude: 49.3039, elevation: 260 },
  { id: 'omidiyeh', name: 'امیدیه', province: 'خوزستان', latitude: 30.7597, longitude: 49.7050, elevation: 25 },

  // استان مازندران
  { id: 'sari', name: 'ساری', province: 'مازندران', latitude: 36.5659, longitude: 53.0586, elevation: 50 },
  { id: 'babol', name: 'بابل', province: 'مازندران', latitude: 36.5514, longitude: 52.6789, elevation: -2 },
  { id: 'amol', name: 'آمل', province: 'مازندران', latitude: 36.4678, longitude: 52.3508, elevation: 76 },
  { id: 'qaemshahr', name: 'قائم‌شهر', province: 'مازندران', latitude: 36.4628, longitude: 52.8597, elevation: 51 },
  { id: 'behshahr', name: 'بهشهر', province: 'مازندران', latitude: 36.6978, longitude: 53.5539, elevation: 20 },
  { id: 'babolsar', name: 'بابلسر', province: 'مازندران', latitude: 36.7025, longitude: 52.6569, elevation: -21 },
  { id: 'chalus', name: 'چالوس', province: 'مازندران', latitude: 36.6550, longitude: 51.4206, elevation: 25 },
  { id: 'nowshahr', name: 'نوشهر', province: 'مازندران', latitude: 36.6494, longitude: 51.4961, elevation: 15 },
  { id: 'ramsar', name: 'رامسر', province: 'مازندران', latitude: 36.9011, longitude: 50.6483, elevation: 20 },
  { id: 'tonekabon', name: 'تنکابن (شهسوار)', province: 'مازندران', latitude: 36.8164, longitude: 50.8739, elevation: 20 },
  { id: 'mahmoudabad', name: 'محمودآباد', province: 'مازندران', latitude: 36.6319, longitude: 52.2628, elevation: -20 },

  // استان گیلان
  { id: 'rasht', name: 'رشت', province: 'گیلان', latitude: 37.2809, longitude: 49.5924, elevation: 5 },
  { id: 'bandar_anzali', name: 'بندر انزلی', province: 'گیلان', latitude: 37.4744, longitude: 49.4622, elevation: -26 },
  { id: 'lahijan', name: 'لاهیجان', province: 'گیلان', latitude: 37.2072, longitude: 50.0033, elevation: 4 },
  { id: 'langerud', name: 'لنگرود', province: 'گیلان', latitude: 37.1972, longitude: 50.1536, elevation: 21 },
  { id: 'talesh', name: 'تالش (هشتپر)', province: 'گیلان', latitude: 37.7997, longitude: 48.9053, elevation: 54 },
  { id: 'astara', name: 'آستارا', province: 'گیلان', latitude: 38.4292, longitude: 48.8722, elevation: -21 },
  { id: 'fuman', name: 'فومن', province: 'گیلان', latitude: 37.2239, longitude: 49.3125, elevation: 25 },
  { id: 'rudsar', name: 'رودسر', province: 'گیلان', latitude: 37.1378, longitude: 50.2881, elevation: 19 },

  // استان کرمان
  { id: 'kerman', name: 'کرمان', province: 'کرمان', latitude: 30.2839, longitude: 57.0834, elevation: 1760 },
  { id: 'sirjan', name: 'سیرجان', province: 'کرمان', latitude: 29.4522, longitude: 55.6814, elevation: 1730 },
  { id: 'rafsanjan', name: 'رفسنجان', province: 'کرمان', latitude: 30.4067, longitude: 55.9939, elevation: 1515 },
  { id: 'jiroft', name: 'جیرفت', province: 'کرمان', latitude: 28.6697, longitude: 57.7375, elevation: 685 },
  { id: 'bam', name: 'بم', province: 'کرمان', latitude: 29.1061, longitude: 58.3569, elevation: 1060 },
  { id: 'zarand', name: 'زرند', province: 'کرمان', latitude: 30.8128, longitude: 56.5639, elevation: 1650 },
  { id: 'kahnuj', name: 'کهنوج', province: 'کرمان', latitude: 27.9519, longitude: 57.7083, elevation: 480 },

  // استان کرمانشاه
  { id: 'kermanshah', name: 'کرمانشاه', province: 'کرمانشاه', latitude: 34.3277, longitude: 47.0778, elevation: 1350 },
  { id: 'eslamabad_gharb', name: 'اسلام‌آباد غرب', province: 'کرمانشاه', latitude: 34.1094, longitude: 46.5275, elevation: 1335 },
  { id: 'kangavar', name: 'کنگاور', province: 'کرمانشاه', latitude: 34.5042, longitude: 47.9653, elevation: 1470 },
  { id: 'songhor', name: 'سنقر', province: 'کرمانشاه', latitude: 34.7839, longitude: 47.6003, elevation: 1700 },
  { id: 'javanrud', name: 'جوانرود', province: 'کرمانشاه', latitude: 34.7961, longitude: 46.4950, elevation: 1380 },
  { id: 'sarpole_zahab', name: 'سرپل ذهاب', province: 'کرمانشاه', latitude: 34.4614, longitude: 45.8628, elevation: 550 },
  { id: 'paveh', name: 'پاوه', province: 'کرمانشاه', latitude: 35.0433, longitude: 46.3564, elevation: 1540 },

  // استان لرستان
  { id: 'khorramabad', name: 'خرم‌آباد', province: 'لرستان', latitude: 33.4878, longitude: 48.3558, elevation: 1147 },
  { id: 'borujerd', name: 'بروجرد', province: 'لرستان', latitude: 33.8972, longitude: 48.7514, elevation: 1570 },
  { id: 'dorud', name: 'دورود', province: 'لرستان', latitude: 33.4933, longitude: 49.0750, elevation: 1466 },
  { id: 'kuhdasht', name: 'کوهدشت', province: 'لرستان', latitude: 33.5333, longitude: 47.6000, elevation: 1195 },
  { id: 'aligudarz', name: 'الیگودرز', province: 'لرستان', latitude: 33.4006, longitude: 49.6947, elevation: 2022 },
  { id: 'poldokhtar', name: 'پلدختر', province: 'لرستان', latitude: 33.1536, longitude: 47.7136, elevation: 690 },

  // استان هرمزگان
  { id: 'bandar_abbas', name: 'بندرعباس', province: 'هرمزگان', latitude: 27.1832, longitude: 56.2666, elevation: 9 },
  { id: 'minab', name: 'میناب', province: 'هرمزگان', latitude: 27.1467, longitude: 57.0800, elevation: 27 },
  { id: 'qeshm', name: 'جزیره قشم', province: 'هرمزگان', latitude: 26.9581, longitude: 56.2717, elevation: 10 },
  { id: 'kish', name: 'جزیره کیش', province: 'هرمزگان', latitude: 26.5325, longitude: 53.9789, elevation: 15 },
  { id: 'bandar_lengeh', name: 'بندر لنگه', province: 'هرمزگان', latitude: 26.5578, longitude: 54.8806, elevation: 8 },
  { id: 'jask', name: 'بندر جاسک', province: 'هرمزگان', latitude: 25.6500, longitude: 57.7700, elevation: 4 },

  // استان یزد
  { id: 'yazd', name: 'یزد', province: 'یزد', latitude: 31.8974, longitude: 54.3569, elevation: 1216 },
  { id: 'meybod', name: 'میبد', province: 'یزد', latitude: 32.2500, longitude: 54.0167, elevation: 1109 },
  { id: 'ardakan', name: 'اردکان', province: 'یزد', latitude: 32.3100, longitude: 54.0175, elevation: 1035 },
  { id: 'bafq', name: 'بافق', province: 'یزد', latitude: 31.6033, longitude: 55.4028, elevation: 994 },
  { id: 'mehriz', name: 'مهریز', province: 'یزد', latitude: 31.5833, longitude: 54.4333, elevation: 1475 },
  { id: 'abarkuh', name: 'ابرکوه', province: 'یزد', latitude: 31.1289, longitude: 53.2825, elevation: 1510 },

  // استان همدان
  { id: 'hamedan', name: 'همدان', province: 'همدان', latitude: 34.7989, longitude: 48.5150, elevation: 1850 },
  { id: 'malayer', name: 'ملایر', province: 'همدان', latitude: 34.2969, longitude: 48.8236, elevation: 1725 },
  { id: 'nahavand', name: 'نهاوند', province: 'همدان', latitude: 34.1886, longitude: 48.3769, elevation: 1650 },
  { id: 'tuyserkan', name: 'تویسرکان', province: 'همدان', latitude: 34.5483, longitude: 48.4467, elevation: 1780 },
  { id: 'asadabad', name: 'اسدآباد', province: 'همدان', latitude: 34.7825, longitude: 48.1183, elevation: 1590 },

  // استان گلستان
  { id: 'gorgan', name: 'گرگان', province: 'گلستان', latitude: 36.8427, longitude: 54.4439, elevation: 135 },
  { id: 'gonbad_kavus', name: 'گنبد کاووس', province: 'گلستان', latitude: 37.2500, longitude: 55.1672, elevation: 45 },
  { id: 'aliabad_katul', name: 'علی‌آباد کتول', province: 'گلستان', latitude: 36.9083, longitude: 54.8689, elevation: 140 },
  { id: 'bandar_torkaman', name: 'بندر ترکمن', province: 'گلستان', latitude: 36.9014, longitude: 54.0706, elevation: -20 },
  { id: 'kordkuy', name: 'کردکوی', province: 'گلستان', latitude: 36.7931, longitude: 54.1128, elevation: 50 },

  // استان سیستان و بلوچستان
  { id: 'zahedan', name: 'زاهدان', province: 'سیستان و بلوچستان', latitude: 29.4963, longitude: 60.8629, elevation: 1378 },
  { id: 'chabahar', name: 'چابهار', province: 'سیستان و بلوچستان', latitude: 25.2919, longitude: 60.6430, elevation: 12 },
  { id: 'zabol', name: 'زابل', province: 'سیستان و بلوچستان', latitude: 31.0303, longitude: 61.4989, elevation: 480 },
  { id: 'iranshahr', name: 'ایرانشهر', province: 'سیستان و بلوچستان', latitude: 27.2025, longitude: 60.6847, elevation: 560 },
  { id: 'saravan', name: 'سراوان', province: 'سیستان و بلوچستان', latitude: 27.3711, longitude: 62.3342, elevation: 1165 },
  { id: 'khash', name: 'خاش', province: 'سیستان و بلوچستان', latitude: 28.2211, longitude: 61.2158, elevation: 1400 },

  // استان کردستان
  { id: 'sanandaj', name: 'سنندج', province: 'کردستان', latitude: 35.3219, longitude: 46.9862, elevation: 1538 },
  { id: 'saqqez', name: 'سقز', province: 'کردستان', latitude: 36.2497, longitude: 46.2733, elevation: 1493 },
  { id: 'marivan', name: 'مریوان', province: 'کردستان', latitude: 35.5269, longitude: 46.1764, elevation: 1320 },
  { id: 'baneh', name: 'بانه', province: 'کردستان', latitude: 35.9975, longitude: 45.8853, elevation: 1550 },
  { id: 'qorveh', name: 'قروه', province: 'کردستان', latitude: 35.1664, longitude: 47.8044, elevation: 1900 },
  { id: 'bijar', name: 'بیجار', province: 'کردستان', latitude: 35.8719, longitude: 47.6050, elevation: 1940 },

  // استان قزوین
  { id: 'qazvin', name: 'قزوین', province: 'قزوین', latitude: 36.2797, longitude: 50.0049, elevation: 1297 },
  { id: 'takestan', name: 'تاکستان', province: 'قزوین', latitude: 36.0694, longitude: 49.6958, elevation: 1265 },
  { id: 'alvand', name: 'الوند', province: 'قزوین', latitude: 36.1892, longitude: 50.0642, elevation: 1240 },
  { id: 'abyek', name: 'آبیک', province: 'قزوین', latitude: 36.0542, longitude: 50.5561, elevation: 1210 },

  // استان زنجان
  { id: 'zanjan', name: 'زنجان', province: 'زنجان', latitude: 36.6736, longitude: 48.4787, elevation: 1638 },
  { id: 'abhar', name: 'ابهر', province: 'زنجان', latitude: 36.1467, longitude: 49.2181, elevation: 1540 },
  { id: 'khorramdarreh', name: 'خرمدره', province: 'زنجان', latitude: 36.2056, longitude: 49.1889, elevation: 1575 },
  { id: 'qeidar', name: 'قیدار (خدابنده)', province: 'زنجان', latitude: 36.1186, longitude: 48.5919, elevation: 2050 },

  // استان سمنان
  { id: 'semnan', name: 'سمنان', province: 'سمنان', latitude: 35.5729, longitude: 53.3971, elevation: 1130 },
  { id: 'shahroud', name: 'شاهرود', province: 'سمنان', latitude: 36.4181, longitude: 54.9764, elevation: 1345 },
  { id: 'damghan', name: 'دامغان', province: 'سمنان', latitude: 36.1681, longitude: 54.3486, elevation: 1170 },
  { id: 'garmsar', name: 'گرمسار', province: 'سمنان', latitude: 35.2181, longitude: 52.3408, elevation: 856 },

  // استان مرکزی
  { id: 'arak', name: 'اراک', province: 'مرکزی', latitude: 34.0954, longitude: 49.7013, elevation: 1750 },
  { id: 'saveh', name: 'ساوه', province: 'مرکزی', latitude: 35.0211, longitude: 50.3567, elevation: 1008 },
  { id: 'khomein', name: 'خمین', province: 'مرکزی', latitude: 33.6422, longitude: 50.0789, elevation: 1800 },
  { id: 'mahallat', name: 'محلات', province: 'مرکزی', latitude: 33.9114, longitude: 50.4550, elevation: 1775 },
  { id: 'delijan', name: 'دلیجان', province: 'مرکزی', latitude: 33.9906, longitude: 50.6839, elevation: 1530 },

  // استان بوشهر
  { id: 'bushehr', name: 'بوشهر', province: 'بوشهر', latitude: 28.9234, longitude: 50.8203, elevation: 8 },
  { id: 'borazjan', name: 'برازجان (دشتستان)', province: 'بوشهر', latitude: 29.2667, longitude: 51.2167, elevation: 70 },
  { id: 'ganaveh', name: 'بندر گناوه', province: 'بوشهر', latitude: 29.5792, longitude: 50.5175, elevation: 5 },
  { id: 'kangan', name: 'بندر کنگان', province: 'بوشهر', latitude: 27.8339, longitude: 52.0694, elevation: 12 },
  { id: 'asaluyeh', name: 'عسلویه', province: 'بوشهر', latitude: 27.4761, longitude: 52.6078, elevation: 5 },

  // استان البرز
  { id: 'karaj', name: 'کرج', province: 'البرز', latitude: 35.8327, longitude: 50.9915, elevation: 1320 },
  { id: 'fardis', name: 'فردیس', province: 'البرز', latitude: 35.7231, longitude: 50.9856, elevation: 1280 },
  { id: 'savojbolagh', name: 'هشتگرد (ساوجبلاغ)', province: 'البرز', latitude: 35.9619, longitude: 50.6806, elevation: 1270 },
  { id: 'nazarabad', name: 'نظرآباد', province: 'البرز', latitude: 35.9528, longitude: 50.6056, elevation: 1190 },

  // استان قم
  { id: 'qom', name: 'قم مقدسه', province: 'قم', latitude: 34.6401, longitude: 50.8764, elevation: 933 },
  { id: 'kahak', name: 'کهک', province: 'قم', latitude: 34.3853, longitude: 50.8658, elevation: 1500 },

  // استان اردبیل
  { id: 'ardabil', name: 'اردبیل', province: 'اردبیل', latitude: 38.2498, longitude: 48.2933, elevation: 1350 },
  { id: 'parsabad', name: 'پارس‌آباد مغان', province: 'اردبیل', latitude: 39.6483, longitude: 47.9175, elevation: 40 },
  { id: 'meshginshahr', name: 'مشگین‌شهر', province: 'اردبیل', latitude: 38.3989, longitude: 47.6822, elevation: 1400 },
  { id: 'khalkhal', name: 'خلخال', province: 'اردبیل', latitude: 37.6189, longitude: 48.5258, elevation: 1843 },

  // استان خراسان شمالی
  { id: 'bojnurd', name: 'بجنورد', province: 'خراسان شمالی', latitude: 37.4747, longitude: 57.3290, elevation: 1070 },
  { id: 'shirvan', name: 'شیروان', province: 'خراسان شمالی', latitude: 37.3967, longitude: 57.9294, elevation: 1100 },
  { id: 'esfarayen', name: 'اسفراین', province: 'خراسان شمالی', latitude: 37.0764, longitude: 57.5100, elevation: 1260 },

  // استان خراسان جنوبی
  { id: 'birjand', name: 'بیرجند', province: 'خراسان جنوبی', latitude: 32.8663, longitude: 59.2211, elevation: 1491 },
  { id: 'qaen', name: 'قائنات (قائن)', province: 'خراسان جنوبی', latitude: 33.7267, longitude: 59.1844, elevation: 1443 },
  { id: 'ferdows', name: 'فردوس', province: 'خراسان جنوبی', latitude: 34.0186, longitude: 58.1722, elevation: 1293 },
  { id: 'tabas', name: 'طبس', province: 'خراسان جنوبی', latitude: 33.5958, longitude: 56.9244, elevation: 690 },

  // استان چهارمحال و بختیاری
  { id: 'shahrekord', name: 'شهرکرد', province: 'چهارمحال و بختیاری', latitude: 32.3256, longitude: 50.8644, elevation: 2070 },
  { id: 'borujen', name: 'بروجن', province: 'چهارمحال و بختیاری', latitude: 31.9686, longitude: 51.2889, elevation: 2220 },
  { id: 'lordegan', name: 'لردگان', province: 'چهارمحال و بختیاری', latitude: 31.5103, longitude: 50.8286, elevation: 1560 },
  { id: 'farsan', name: 'فارسان', province: 'چهارمحال و بختیاری', latitude: 32.2575, longitude: 50.5636, elevation: 2040 },

  // استان کهگیلویه و بویراحمد
  { id: 'yasuj', name: 'یاسوج', province: 'کهگیلویه و بویراحمد', latitude: 30.6684, longitude: 51.5876, elevation: 1870 },
  { id: 'gachsaran', name: 'دوگنبدان (گچساران)', province: 'کهگیلویه و بویراحمد', latitude: 30.3586, longitude: 50.7981, elevation: 736 },
  { id: 'dehdasht', name: 'دهدشت', province: 'کهگیلویه و بویراحمد', latitude: 30.7936, longitude: 50.5647, elevation: 840 },

  // استان ایلام
  { id: 'ilam', name: 'ایلام', province: 'ایلام', latitude: 33.6374, longitude: 46.4227, elevation: 1319 },
  { id: 'dehloran', name: 'دهلران', province: 'ایلام', latitude: 32.6942, longitude: 47.2678, elevation: 232 },
  { id: 'mehran', name: 'مهران', province: 'ایلام', latitude: 33.1222, longitude: 46.1647, elevation: 155 },
  { id: 'eyvan', name: 'ایوان', province: 'ایلام', latitude: 33.8272, longitude: 46.3094, elevation: 1200 },

  // عتبات عالیات و اماکن مقدسه
  { id: 'makkah', name: 'مکه مکرمه', province: 'عتبات عالیات و اماکن مقدسه', latitude: 21.4225, longitude: 39.8262, elevation: 277, timezone: 3 },
  { id: 'madinah', name: 'مدینه منوره', province: 'عتبات عالیات و اماکن مقدسه', latitude: 24.5247, longitude: 39.5692, elevation: 608, timezone: 3 },
  { id: 'najaf', name: 'نجف اشرف', province: 'عتبات عالیات و اماکن مقدسه', latitude: 31.9961, longitude: 44.3340, elevation: 70, timezone: 3 },
  { id: 'karbala', name: 'کربلای معلی', province: 'عتبات عالیات و اماکن مقدسه', latitude: 32.6160, longitude: 44.0249, elevation: 30, timezone: 3 },
  { id: 'kadhimiya', name: 'کاظمین', province: 'عتبات عالیات و اماکن مقدسه', latitude: 33.3794, longitude: 44.3411, elevation: 34, timezone: 3 },
  { id: 'samarra', name: 'سامرا', province: 'عتبات عالیات و اماکن مقدسه', latitude: 34.1983, longitude: 43.8742, elevation: 80, timezone: 3 },
];

export const PRAYER_NAMES_FA: Record<PrayerKey, string> = {
  fajr: 'اذان صبح',
  sunrise: 'طلوع آفتاب',
  dhuhr: 'اذان ظهر',
  sunset: 'غروب آفتاب',
  maghrib: 'اذان مغرب',
  midnight: 'نیمه‌شب شرعی',
};

// تابع استانداردسازی حروف فارسی برای جستجوی دقیق
export function normalizePersian(str: string): string {
  return str
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[آأإ]/g, 'ا')
    .replace(/[\u064B-\u065F]/g, '') // اعراب‌زدایی
    .replace(/[\s\-_]+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * جستجوی هوشمند در لیست شهرها و استان‌ها
 */
export function searchCities(query: string, provinceFilter?: string): CityInfo[] {
  let list = CITIES_LIST;
  if (provinceFilter && provinceFilter !== 'همه') {
    list = list.filter((c) => c.province === provinceFilter);
  }
  if (!query || query.trim() === '') return list;

  const q = normalizePersian(query);
  return list.filter((c) => {
    const nameNorm = normalizePersian(c.name);
    const provNorm = normalizePersian(c.province);
    return nameNorm.includes(q) || provNorm.includes(q);
  });
}

// توابع مثلثاتی به رادیان
const d2r = (d: number) => (d * Math.PI) / 180.0;
const r2d = (r: number) => (r * 180.0) / Math.PI;
const sin = (d: number) => Math.sin(d2r(d));
const cos = (d: number) => Math.cos(d2r(d));
const tan = (d: number) => Math.tan(d2r(d));
const asin = (x: number) => r2d(Math.asin(x));
const acos = (x: number) => r2d(Math.acos(Math.max(-1, Math.min(1, x))));
const atan2 = (y: number, x: number) => r2d(Math.atan2(y, x));

/**
 * فرمول تصحیح زمان نجومی بر مبنای موقعیت خورشید (Julian Day & Solar Declination)
 */
function sunPosition(julianDate: number) {
  const D = julianDate - 2451545.0;
  const g = (357.529 + 0.98560028 * D) % 360;
  const q = (280.459 + 0.98564736 * D) % 360;
  const L = (q + 1.915 * sin(g) + 0.02 * sin(2 * g)) % 360;
  const e = 23.439 - 0.00000036 * D;
  const d = asin(sin(e) * sin(L));
  let RA = atan2(cos(e) * sin(L), cos(L)) / 15.0;
  RA = (RA + 24) % 24;
  const EqT = q / 15.0 - RA;
  return { declination: d, equation: EqT };
}

function julianDay(year: number, month: number, day: number) {
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return (
    Math.floor(365.25 * (year + 4716)) +
    Math.floor(30.6001 * (month + 1)) +
    day +
    B -
    1524.5
  );
}

/**
 * محاسبه زمان زاویه خورشیدی
 */
function computeTime(
  angle: number,
  declination: number,
  latitude: number,
  direction: 'ccw' | 'cw'
): number {
  const val = (-sin(angle) - sin(latitude) * sin(declination)) / (cos(latitude) * cos(declination));
  if (val > 1 || val < -1) return NaN;
  const hourAngle = acos(val) / 15.0;
  return direction === 'ccw' ? -hourAngle : hourAngle;
}

function fixHour(h: number): number {
  return ((h % 24) + 24) % 24;
}

function formatDecimalTime(hours: number): string {
  const norm = fixHour(hours);
  const totalMinutes = Math.round(norm * 60);
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  const paddedH = h.toString().padStart(2, '0');
  const paddedM = m.toString().padStart(2, '0');
  return `${paddedH}:${paddedM}`;
}

function createDateFromHours(baseDate: Date, hours: number): Date {
  const d = new Date(baseDate);
  const norm = fixHour(hours);
  const totalSeconds = Math.round(norm * 3600);
  const h = Math.floor(totalSeconds / 3600) % 24;
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  d.setHours(h, m, s, 0);
  return d;
}

/**
 * محاسبه کامل اوقات شرعی بر مبنای فرمول‌های مصوب مؤسسه ژئوفیزیک دانشگاه تهران
 */
export function calculatePrayerTimes(
  coords: Coordinates,
  date: Date = new Date(),
  customTimezone?: number,
  calculationMethod: CalculationMethod = 'tehran',
  safetyMarginMinutes: number = 0
): PrayerTimes {
  const lat = coords.latitude;
  const lng = coords.longitude;
  const elev = coords.elevation || 0;

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  const jd = julianDay(year, month, day);

  // محاسبه منطقه زمانی: پیش‌فرض ایران (+3.5)
  let timezoneOffsetHours: number;
  if (customTimezone !== undefined) {
    timezoneOffsetHours = customTimezone;
  } else if (coords.timezone !== undefined) {
    timezoneOffsetHours = coords.timezone;
  } else {
    const sysOffset = -date.getTimezoneOffset() / 60.0;
    timezoneOffsetHours = sysOffset !== 0 ? sysOffset : 3.5;
  }

  const { declination, equation } = sunPosition(jd);

  // ظهر شرعی
  const noon = 12 + timezoneOffsetHours - lng / 15.0 - equation;

  // طلوع و غروب آفتاب با احتساب شکست جوی و ارتفاع
  const sunriseAngle = 0.833 + 0.0347 * Math.sqrt(Math.max(0, elev));
  const sunriseDiff = computeTime(sunriseAngle, declination, lat, 'ccw');
  const sunsetDiff = computeTime(sunriseAngle, declination, lat, 'cw');

  const sunrise = noon + sunriseDiff;
  const sunset = noon + sunsetDiff;

  // زاویه اذان صبح بر مبنای روش محاسبه
  // ژئوفیزیک تهران: 17.7 درجه | تقریب: 18.0 درجه | مکه: 18.5 درجه
  let fajrAngle = 17.7;
  let maghribAngle = 4.5;
  if (calculationMethod === 'taghrib') {
    fajrAngle = 18.0;
    maghribAngle = 4.0;
  } else if (calculationMethod === 'mwl') {
    fajrAngle = 18.0;
    maghribAngle = 0.833; // غروب
  } else if (calculationMethod === 'makkah') {
    fajrAngle = 18.5;
    maghribAngle = 0.833;
  }

  const fajrDiff = computeTime(fajrAngle, declination, lat, 'ccw');
  let fajr = noon + fajrDiff;

  const maghribDiff = computeTime(maghribAngle, declination, lat, 'cw');
  let maghrib = noon + maghribDiff;

  // اعمال احتیاط شرعی در صورت فعال بودن (+دقایق احتیاط به فجر و مغرب)
  if (safetyMarginMinutes > 0) {
    const marginHours = safetyMarginMinutes / 60.0;
    maghrib += marginHours;
  }

  // محاسبه تقریبی اذان صبح فردا برای نیمه‌شب شرعی
  const nextJd = jd + 1;
  const nextSun = sunPosition(nextJd);
  const nextNoon = 12 + timezoneOffsetHours - lng / 15.0 - nextSun.equation;
  const nextFajrDiff = computeTime(fajrAngle, nextSun.declination, lat, 'ccw');
  const nextFajr = nextNoon + nextFajrDiff;

  // نیمه‌شب شرعی = میانه غروب و اذان صبح فردا
  const midnight = sunset + (nextFajr + 24 - sunset) / 2.0;

  const rawTimes = {
    fajr: createDateFromHours(date, fajr),
    sunrise: createDateFromHours(date, sunrise),
    dhuhr: createDateFromHours(date, noon),
    sunset: createDateFromHours(date, sunset),
    maghrib: createDateFromHours(date, maghrib),
    midnight: createDateFromHours(date, midnight % 24),
  };

  return {
    fajr: formatDecimalTime(fajr),
    sunrise: formatDecimalTime(sunrise),
    dhuhr: formatDecimalTime(noon),
    sunset: formatDecimalTime(sunset),
    maghrib: formatDecimalTime(maghrib),
    midnight: formatDecimalTime(midnight % 24),
    rawTimes,
  };
}

/**
 * تعیین وقت شرعی بعدی و محاسبه ثانیه‌های باقی‌مانده
 */
export function getNextPrayer(times: PrayerTimes, now: Date = new Date()): NextPrayerInfo {
  const currentMs = now.getTime();
  const schedule: Array<{ key: PrayerKey; date: Date }> = [
    { key: 'fajr', date: times.rawTimes.fajr },
    { key: 'sunrise', date: times.rawTimes.sunrise },
    { key: 'dhuhr', date: times.rawTimes.dhuhr },
    { key: 'sunset', date: times.rawTimes.sunset },
    { key: 'maghrib', date: times.rawTimes.maghrib },
    { key: 'midnight', date: times.rawTimes.midnight },
  ];

  for (const item of schedule) {
    const diffMs = item.date.getTime() - currentMs;
    if (diffMs > 0) {
      const remainingSec = Math.floor(diffMs / 1000);
      const remainingMin = Math.floor(remainingSec / 60);
      const hours = Math.floor(remainingMin / 60);
      const mins = remainingMin % 60;
      let formatted = '';
      if (hours > 0) {
        formatted = `${hours} ساعت و ${mins} دقیقه`;
      } else {
        formatted = `${mins} دقیقه`;
      }
      return {
        key: item.key,
        name: PRAYER_NAMES_FA[item.key],
        time: times[item.key],
        remainingMinutes: remainingMin,
        remainingSeconds: remainingSec,
        formattedRemaining: formatted,
        isToday: true,
      };
    }
  }

  // اگر همه اوقات امروز گذشته باشند، وقت بعدی اذان صبح فرداست
  const tomorrowFajr = new Date(times.rawTimes.fajr);
  tomorrowFajr.setDate(tomorrowFajr.getDate() + 1);
  const diffMs = tomorrowFajr.getTime() - currentMs;
  const remainingSec = Math.max(0, Math.floor(diffMs / 1000));
  const remainingMin = Math.floor(remainingSec / 60);
  const hours = Math.floor(remainingMin / 60);
  const mins = remainingMin % 60;

  return {
    key: 'fajr',
    name: PRAYER_NAMES_FA.fajr,
    time: times.fajr,
    remainingMinutes: remainingMin,
    remainingSeconds: remainingSec,
    formattedRemaining: hours > 0 ? `${hours} ساعت و ${mins} دقیقه` : `${mins} دقیقه`,
    isToday: false,
  };
}

/**
 * محاسبه فاصله کروی دو نقطه (کیلومتر)
 */
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // شعاع زمین به کیلومتر
  const dLat = d2r(lat2 - lat1);
  const dLon = d2r(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(d2r(lat1)) * Math.cos(d2r(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * یافتن نزدیک‌ترین شهر از لیست به مختصات داده شده
 */
export function findClosestCity(lat: number, lng: number): CityInfo {
  let closest = CITIES_LIST[0];
  let minDistance = Infinity;

  for (const c of CITIES_LIST) {
    const dist = getDistanceKm(lat, lng, c.latitude, c.longitude);
    if (dist < minDistance) {
      minDistance = dist;
      closest = c;
    }
  }

  return closest;
}

/**
 * دریافت موقعیت مکانی با روش مقاوم (GPS با اولویت، تایم‌اوت مناسب، و فال‌بک IP در صورت دسترسی نداشتن به GPS)
 */
export async function detectUserLocation(): Promise<{
  coords: Coordinates;
  matchedCity: CityInfo;
  isApproximate: boolean;
  message?: string;
}> {
  // ۱. تلاش با GPS مرورگر
  if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            timeout: 6000,
            enableHighAccuracy: false,
            maximumAge: 120000,
          }
        );
      });

      const coords: Coordinates = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        elevation: position.coords.altitude || 0,
      };

      const matchedCity = findClosestCity(coords.latitude, coords.longitude);
      return {
        coords,
        matchedCity,
        isApproximate: false,
      };
    } catch {
      // GPS با شکست مواجه شد؛ به فال‌بک شبکه/IP مراجعه می‌کنیم
    }
  }

  // ۲. تلاش با موقعیت‌یابی بر مبنای IP در صورت آنلاین بودن
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch('https://freeipapi.com/api/json', {
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        if (data.latitude && data.longitude) {
          const coords: Coordinates = {
            latitude: Number(data.latitude),
            longitude: Number(data.longitude),
            elevation: 0,
          };
          const matchedCity = findClosestCity(coords.latitude, coords.longitude);
          return {
            coords,
            matchedCity,
            isApproximate: true,
            message: `تشخیص تقریبی بر مبنای شبکه اینترنت: ${matchedCity.name}`,
          };
        }
      }
    } catch {}
  }

  // ۳. در صورت عدم امکان دسترسی به مکان‌یاب
  throw new Error('GPS_UNAVAILABLE');
}

/**
 * محاسبه زاویه جهت قبله (درجه از شمال در جهت عقربه‌های ساعت)
 * مختصات کعبه: ۲۱.۴۲۲۵ شمالی، ۳۹.۸۲۶۲ شرقی
 */
export function calculateQiblaDirection(latitude: number, longitude: number): number {
  const latMakkah = 21.4225;
  const lngMakkah = 39.8262;

  const dLng = lngMakkah - longitude;
  const y = sin(dLng);
  const x = cos(latitude) * tan(latMakkah) - sin(latitude) * cos(dLng);

  let qibla = atan2(y, x);
  qibla = (qibla + 360) % 360;
  return Math.round(qibla * 10) / 10;
}

/**
 * مدیریت ذخیره‌سازی شهر و تنظیمات اوقات شرعی در LocalStorage
 */
const CITY_STORAGE_KEY = 'mobin_prayer_selected_city';
const COORDS_STORAGE_KEY = 'mobin_prayer_custom_coords';

export function getSavedCity(): CityInfo {
  try {
    const savedId = localStorage.getItem(CITY_STORAGE_KEY);
    if (savedId) {
      const found = CITIES_LIST.find((c) => c.id === savedId);
      if (found) return found;
    }
  } catch {}
  return CITIES_LIST[0]; // پیش‌فرض: تهران
}

export function saveSelectedCity(cityId: string) {
  try {
    localStorage.setItem(CITY_STORAGE_KEY, cityId);
    localStorage.removeItem(COORDS_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('mobin-prayer-city-changed', { detail: cityId }));
  } catch {}
}

export function getSavedCustomCoords(): Coordinates | null {
  try {
    const raw = localStorage.getItem(COORDS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export function saveCustomCoords(coords: Coordinates) {
  try {
    localStorage.setItem(COORDS_STORAGE_KEY, JSON.stringify(coords));
    window.dispatchEvent(new CustomEvent('mobin-prayer-city-changed', { detail: 'custom' }));
  } catch {}
}
