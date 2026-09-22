import { ALL_SURAHS } from '../data/surahs';

export type ReciterId = 'parhizgar' | 'abdulbasit' | 'minshawi' | 'afasy';

/**
 * یک منبع صوت برای یک قاری؛ هر قاری چند منبع با fallback مرتب‌شده بر اساس priority دارد.
 * همه URLها از health-check واقعی عبور کرده‌اند (شواهد در docs/OPEN_QUESTIONS.md فاز ۵).
 */
export interface AudioSource {
  reciterId: ReciterId;
  /** نام منبع جهت نمایش صادقانه در رابط کاربری و صفحه 'منابع و مجوزها' */
  name: string;
  host: 'everyayah' | 'islamicNetwork' | 'maqra';
  format: 'mp3';
  bitrate: number;
  /** الگوی ساخت URL؛ می‌تواند null باشد اگر منبع برای این آیه در دسترس نیست */
  buildUrl: (surahId: number, verseNumber: number) => string | null;
  /** متن شرایط استفاده به فارسی (از تحقیق ثبت‌شده؛ هرگز حدس) */
  license: string;
  attribution: string;
  /** 0 = منبع اول/ترجیحی */
  priority: number;
}

/**
 * پد کردن شماره سوره/آیه به فرمت سه رقمی like everyayah: 001001.mp3
 */
export const padVerseKey = (surahId: number, verseNumber: number): string =>
  `${String(surahId).padStart(3, '0')}${String(verseNumber).padStart(3, '0')}`;

/**
 * شماره سراسری آیه (۱ تا ۶۲۳۶) برای CDN islamic.network که URL آن بر اساس شماره سراسری است.
 */
export const globalVerseNumber = (surahId: number, verseNumber: number): number => {
  let total = 0;
  for (let s = 1; s < surahId; s++) {
    const surah = ALL_SURAHS[s - 1];
    total += surah.versesCount;
  }
  return total + verseNumber;
};

const buildEveryayahUrl = (folderName: string, surahId: number, verseNumber: number) =>
  `https://everyayah.com/data/${folderName}/${padVerseKey(surahId, verseNumber)}.mp3`;

const buildIslamicNetworkUrl = (
  reciterHandle: string,
  bitrate: number,
  surahId: number,
  verseNumber: number
) =>
  `https://cdn.islamic.network/quran/audio/${bitrate}/ar.${reciterHandle}/${globalVerseNumber(surahId, verseNumber)}.mp3`;

const buildMaqraUrl = (huggingFacePath: string, surahId: number, verseNumber: number) =>
  `https://huggingface.co/datasets/maqra-project/${huggingFacePath}/resolve/main/${padVerseKey(surahId, verseNumber)}.mp3`;

/**
 * آیات غایب در Menshawi_32kbps on everyayah — استخراج‌شده از 000_unverified_checksum.md5
 * (مقایسه با ۶۲۳۶ آیهٔ استاندارد؛ نمونه‌ها روی سرور 404 تأیید شدند).
 */
const MISSING_MENSHAWI_32KBPS = new Set<string>([
  '007120', '007122', '012044', '012054', '015069', '015083', '015093', '018003',
  '018085', '018089', '018092', '019089', '020019', '020025', '020026', '020028',
  '020030', '020031', '020032', '020033', '020034', '020041', '020095', '026046',
  '026048', '026060', '026066', '026087', '026095', '026096', '026100', '026101',
  '026108', '026110', '026123', '026126', '026131', '026134', '026138', '026141',
  '026144', '026147', '026150', '026162', '026163', '026179', '026193', '026204',
  '026218', '026219', '027002', '030002', '035020', '035021', '035023', '036002',
  '036004', '037002', '037003', '037012', '037025', '037089', '037090', '037110',
  '037154', '037155', '037181', '038067', '038081', '043002', '044002', '044009',
  '044021', '044043', '044044', '044045', '044046', '044052', '047005', '051002',
  '051003', '051004', '051006', '051009', '051010', '052002', '052003', '052004',
  '052005', '052006', '052008', '052010', '052039', '053003', '053005', '053006',
  '053007', '053008', '053009', '053011', '053013', '053015', '053016', '053017',
  '053019', '053020', '053021', '053025', '053033', '053034', '053037', '053053',
  '053054', '053057', '053060', '053061', '053062', '054016', '054021', '054023',
  '054030', '054039', '055002', '055003', '055004', '055008', '055012', '055026',
  '055048', '055050', '056002', '056003', '056005', '056022', '056028', '056030',
  '056032', '056034', '056037', '056038', '056042', '056053', '056055', '056066',
  '056067', '056093', '056094', '068005', '068006', '068008', '068016', '068018',
  '068020', '068021', '068027', '068036', '069002', '069022', '069023', '069026',
  '069030', '069039', '070003', '070007', '070009', '070012', '070016', '070018',
  '070022', '073002', '074002', '074003', '074004', '074005', '074007', '074013',
  '074017', '074019', '074020', '074021', '074022', '074023', '074026', '074028',
  '074029', '074030', '074032', '074033', '074036', '074041', '074042', '074051',
  '075007', '075008', '075009', '075011', '075021', '075023', '075027', '075031',
  '075034', '077002', '077003', '077004', '077005', '077006', '077010', '077011',
  '077012', '077013', '078002', '078004', '078007', '078022', '078033', '078034',
  '079003', '079004', '079005', '079007', '079009', '079021', '079022', '079023',
  '079032', '080009', '080015', '080016', '080018', '080028', '080035', '080036',
  '080041', '081003', '081005', '081006', '081010', '081016', '081017', '081018',
  '081026', '082003', '082004', '082011', '083005', '083009', '083020', '084003',
  '084012', '084017', '084018', '085002', '085015', '085018', '086003', '086012',
  '086014', '086016', '087002', '087003', '088003', '088009', '088015', '089002',
  '089003', '089004', '089007', '089029', '090003', '090011', '090013', '092006',
  '092009', '092021', '093002', '094004', '094008', '095002', '095003', '096007',
  '096010', '096012', '096017', '096018', '100002', '100003', '100004', '100005',
  '101002', '101009', '101011', '102003', '102006', '107004', '107007', '108002',
  '109006', '112002', '112003', '113002', '114002', '114003',
]);

/**
 * هر دو منبع comprising هم‌خانواده؛ conditions ثبت‌شده در سند فاز ۵.
 */
const commonLicenseNote =
  'فهرست‌های رسمی everyayah به‌صورت آزاد برای مرور/دانلود در دسترس است؛ هیچ مجوز سراسری صریحی وجود ندارد و استفاده تجاری توسط ما انجام نمی‌شود. لینک و انتساب به هر منبع در صفحه منابع و مجوزها ذکر می‌شود.';

const maqraLicenseNote =
  'آینه تأییدشده Maqra روی Hugging Face (SHA-256 + انتساب + شرط عدم تغییر) استفاده می‌شود؛ در صفحه منابع و مجوزها انتساب کامل درج می‌شود.';

const islamicNetworkLicenseNote =
  'CDN متعلق به alquran.cloud (Islamic Network)؛ بسته‌های صوتی هر قاری به‌صورت عمومی سرو می‌شوند. در صفحه منابع و مجوزها انتساب کامل درج می‌شود.';

export const RECITER_SOURCES: Record<ReciterId, AudioSource[]> = {
  parhizgar: [
    {
      reciterId: 'parhizgar',
      name: 'everyayah (Parhizgar_48kbps)',
      host: 'everyayah',
      format: 'mp3',
      bitrate: 48,
      buildUrl: (s, v) => buildEveryayahUrl('Parhizgar_48kbps', s, v),
      license: commonLicenseNote,
      attribution: 'شهریار پرهیزگار — everyayah.com',
      priority: 0,
    },
    {
      reciterId: 'parhizgar',
      name: 'آینهٔ Maqra روی Hugging Face',
      host: 'maqra',
      format: 'mp3',
      bitrate: 48,
      buildUrl: (s, v) => buildMaqraUrl('parhizgar-48kbps', s, v),
      license: maqraLicenseNote,
      attribution: 'شهریار پرهیزگار — maqra-project / Hugging Face',
      priority: 1,
    },
    {
      reciterId: 'parhizgar',
      name: 'Islamic Network CDN (alquran.cloud)',
      host: 'islamicNetwork',
      format: 'mp3',
      bitrate: 48,
      buildUrl: (s, v) => buildIslamicNetworkUrl('parhizgar', 48, s, v),
      license: islamicNetworkLicenseNote,
      attribution: 'شهریار پرهیزگار — alquran.cloud (Islamic Network)',
      priority: 2,
    },
  ],
  abdulbasit: [
    {
      reciterId: 'abdulbasit',
      name: 'everyayah (Abdul_Basit_Murattal_64kbps)',
      host: 'everyayah',
      format: 'mp3',
      bitrate: 64,
      buildUrl: (s, v) => buildEveryayahUrl('Abdul_Basit_Murattal_64kbps', s, v),
      license: commonLicenseNote,
      attribution: 'عبدالباسط عبدالصمد — everyayah.com',
      priority: 0,
    },
    {
      reciterId: 'abdulbasit',
      name: 'آینهٔ Maqra روی Hugging Face',
      host: 'maqra',
      format: 'mp3',
      bitrate: 64,
      buildUrl: (s, v) => buildMaqraUrl('abdul-basit-murattal-64kbps', s, v),
      license: maqraLicenseNote,
      attribution: 'عبدالباسط عبدالصمد — maqra-project / Hugging Face',
      priority: 1,
    },
    {
      reciterId: 'abdulbasit',
      name: 'Islamic Network CDN (alquran.cloud)',
      host: 'islamicNetwork',
      format: 'mp3',
      bitrate: 64,
      buildUrl: (s, v) => buildIslamicNetworkUrl('abdulbasitmurattal', 64, s, v),
      license: islamicNetworkLicenseNote,
      attribution: 'عبدالباسط عبدالصمد — alquran.cloud (Islamic Network)',
      priority: 2,
    },
  ],
  minshawi: [
    {
      reciterId: 'minshawi',
      name: 'everyayah (Menshawi_32kbps — ناقص: ۳۰۲ آیه غایب)',
      host: 'everyayah',
      format: 'mp3',
      bitrate: 32,
      buildUrl: (s, v) => {
        if (MISSING_MENSHAWI_32KBPS.has(padVerseKey(s, v))) return null;
        return buildEveryayahUrl('Menshawi_32kbps', s, v);
      },
      license: commonLicenseNote,
      attribution: 'محمدصدیق منشاوی — everyayah.com (ناقص)',
      priority: 0,
    },
    {
      reciterId: 'minshawi',
      name: 'آینهٔ Maqra روی Hugging Face (کامل، 128kbps)',
      host: 'maqra',
      format: 'mp3',
      bitrate: 128,
      buildUrl: (s, v) => buildMaqraUrl('mohamed-siddiq-al-minshawi-murattal-128kbps', s, v),
      license: maqraLicenseNote,
      attribution: 'محمدصدیق منشاوی — maqra-project / Hugging Face',
      priority: 1,
    },
    {
      reciterId: 'minshawi',
      name: 'Islamic Network CDN (alquran.cloud)',
      host: 'islamicNetwork',
      format: 'mp3',
      bitrate: 128,
      buildUrl: (s, v) => buildIslamicNetworkUrl('minshawi', 128, s, v),
      license: islamicNetworkLicenseNote,
      attribution: 'محمدصدیق منشاوی — alquran.cloud (Islamic Network)',
      priority: 2,
    },
  ],
  afasy: [
    {
      reciterId: 'afasy',
      name: 'everyayah (Alafasy_64kbps)',
      host: 'everyayah',
      format: 'mp3',
      bitrate: 64,
      buildUrl: (s, v) => buildEveryayahUrl('Alafasy_64kbps', s, v),
      license: commonLicenseNote,
      attribution: 'مشاری العفاسی — everyayah.com',
      priority: 0,
    },
    {
      reciterId: 'afasy',
      name: 'آینهٔ Maqra روی Hugging Face',
      host: 'maqra',
      format: 'mp3',
      bitrate: 64,
      buildUrl: (s, v) => buildMaqraUrl('mishari-alafasy-64kbps', s, v),
      license: maqraLicenseNote,
      attribution: 'مشاری العفاسی — maqra-project / Hugging Face',
      priority: 1,
    },
    {
      reciterId: 'afasy',
      name: 'Islamic Network CDN (alquran.cloud)',
      host: 'islamicNetwork',
      format: 'mp3',
      bitrate: 64,
      buildUrl: (s, v) => buildIslamicNetworkUrl('alafasy', 64, s, v),
      license: islamicNetworkLicenseNote,
      attribution: 'مشاری العفاسی — alquran.cloud (Islamic Network)',
      priority: 2,
    },
  ],
};

/**
 * ترتیب fallback برای یک قاری (مرتب بر اساس priority صعودی).
 */
export const getSourcesForReciter = (reciterId: ReciterId): AudioSource[] =>
  [...RECITER_SOURCES[reciterId]].sort((a, b) => a.priority - b.priority);

/**
 * ساخت URL برای یک قاری/آیه از منبع با ایندکس مشخص.
 * اگر buildUrl برای آن آیه مقدار null بدهد (مثل آیه غایب منشاوی) null برگردانده می‌شود.
 */
export const getAudioSourceUrl = (
  reciterId: ReciterId,
  surahId: number,
  verseNumber: number,
  sourceIndex = 0
): string | null => {
  const sources = getSourcesForReciter(reciterId);
  if (sourceIndex < 0 || sourceIndex >= sources.length) return null;
  return sources[sourceIndex].buildUrl(surahId, verseNumber);
};