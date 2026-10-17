import { ArabicFont } from '../types';

export const getArabicFontFamily = (font?: ArabicFont | string): string => {
  switch (font) {
    case 'ir-mushaf':
      return "'IranMushaf', 'Amiri Quran', serif";
    case 'scheherazade':
      return "'Scheherazade New', 'Amiri Quran', serif";
    case 'alqalam':
      return "'AlQalamQuran', 'Scheherazade New', 'Amiri Quran', serif";
    case 'uthman-taha':
    case 'simple':
    default:
      return "'IranMushaf', 'Scheherazade New', serif";
  }
};

export const ARABIC_FONT_OPTIONS: { id: ArabicFont; name: string }[] = [
  {
    id: 'ir-mushaf',
    name: 'مصحف ایران',
  },
  {
    id: 'scheherazade',
    name: 'شهرزاد قرآنی',
  },
  {
    id: 'alqalam',
    name: 'قلم قرآن مجید',
  },
];

