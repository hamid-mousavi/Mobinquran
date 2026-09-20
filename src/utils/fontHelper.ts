import { ArabicFont } from '../types';

export const getArabicFontFamily = (font?: ArabicFont): string => {
  switch (font) {
    case 'uthman-taha':
      return "'UthmanTaha', 'Amiri Quran', serif";
    case 'kfgqpc-hafs':
      return "'KFGQPC-Hafs', 'UthmanTaha', 'Amiri Quran', serif";
    case 'amiri-quran':
      return "'Amiri Quran', serif";
    case 'scheherazade':
      return "'Scheherazade New', 'Amiri Quran', serif";
    case 'amiri':
      return "'Amiri', serif";
    case 'system':
    default:
      return "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  }
};

export const ARABIC_FONT_OPTIONS: { id: ArabicFont; name: string; subtitle: string }[] = [
  {
    id: 'uthman-taha',
    name: 'عثمان طه (KFGQPC Smart)',
    subtitle: 'فونت رسمی و هوشمند مجمع ملک فهد',
  },
  {
    id: 'kfgqpc-hafs',
    name: 'رسم‌الخط مدینه منوره (Hafs)',
    subtitle: 'قلم اصیل مصحف شریف چاپ مدینه',
  },
  {
    id: 'amiri-quran',
    name: 'امیری مصحفی (Amiri Quran)',
    subtitle: 'قلم سنتی نسخ با اتصالات و اعراب کامل',
  },
  {
    id: 'scheherazade',
    name: 'شهرزاد مصحفی (Scheherazade)',
    subtitle: 'قلم چشم‌نواز و استاندارد قرآنی',
  },
  {
    id: 'amiri',
    name: 'امیری کلاسیک (Amiri)',
    subtitle: 'قلم نسخ وزین و هنری',
  },
  {
    id: 'system',
    name: 'قلم سیستم',
    subtitle: 'فونت پیش‌فرض سیستم‌عامل',
  },
];
