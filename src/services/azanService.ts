/**
 * سرویس جامع مدیریت اذان شیعه، انتخاب مؤذن، دانلود صوت آفلاین،
 * ادعیه و مناجات قبل از اذان، و تنظیمات هشدارهای شرعی
 */

import type { PrayerTimes } from './prayerTimesService';
import { Capacitor } from '@capacitor/core';

export interface AzanMuezzin {
  id: string;
  name: string;
  title: string;
  description: string;
  maqam: string;
  duration: string;
  approxSizeMb: number;
  audioUrls: string[];
  isShia: true;
}

export interface PreAzanDua {
  id: string;
  name: string;
  title: string;
  description: string;
  duration: string;
  approxSizeMb: number;
  audioUrls: string[];
}

export interface AzanSettings {
  selectedMuezzinId: string;
  selectedPreDuaId: string;
  playPreAzanDua: boolean;
  preAlertMinutes: 0 | 5 | 10 | 15;
  fajrAlert: boolean;
  dhuhrAlert: boolean;
  maghribAlert: boolean;
  inAppSoundEnabled: boolean;
  systemNotificationEnabled: boolean;
  playPostAzanDua: boolean;
  calculationMethod: 'tehran' | 'taghrib' | 'mwl' | 'makkah';
  safetyMarginMinutes: number;
  volume: number;
}

export const AZAN_CACHE_NAME = 'mobin-azan-audio-v2';

/**
 * فهرست مؤذنان معتبر شیعه (همگی با ذکر «أشهد أنّ علیاً ولیّ‌الله» و «حیّ علی خیر العمل»)
 */
export const MUEZZINS_LIST: AzanMuezzin[] = [
  {
    id: 'moazenzadeh',
    name: 'رحیم مؤذن‌زاده اردبیلی',
    title: 'نوای جاودانه بیات ترک (اثر ثبت‌شده ملی)',
    description: 'ماندگارترین و دلنشین‌ترین اذان تاریخ معاصر ایران با نوای آسمانی رحیم مؤذن‌زاده',
    maqam: 'بیات ترک (روح‌الارواح)',
    duration: '۴:۲۵',
    approxSizeMb: 0.3,
    audioUrls: [
      '/audio/azan/moazenzadeh.mp3',
      'https://static.ahlolbait.com/files/ahlolbait/old/u12/download/rahim_moazenzadeh.mp3',
    ],
    isShia: true,
  },
  {
    id: 'salim_moazenzadeh',
    name: 'سلیم مؤذن‌زاده اردبیلی',
    title: 'نوای پرشور و داوودی فخرالذاکرین',
    description: 'نوای حماسی، قدرتمند و دلنشین فخرالذاکرین سلیم مؤذن‌زاده اردبیلی',
    maqam: 'بیات ترک و ماهور',
    duration: '۴:۵۰',
    approxSizeMb: 0.4,
    audioUrls: [
      '/audio/azan/salim_moazenzadeh.mp3',
      'https://static.ahlolbait.com/files/ahlolbait/old/u12/download/salim_moazenzadeh.mp3',
    ],
    isShia: true,
  },
  {
    id: 'entezar_kazemzadeh',
    name: 'روح‌الله کاظم‌زاده (اذان انتظار)',
    title: 'اذان بسیار دلنشین و معروف انتظار',
    description: 'نوای گوش‌نواز و آرامش‌بخش اذان انتظار با نوای روح‌الله کاظم‌زاده',
    maqam: 'حجاز و دشتی',
    duration: '۵:۲۰',
    approxSizeMb: 2.6,
    audioUrls: [
      '/audio/azan/entezar_kazemzadeh.mp3',
      'https://static.ahlolbait.com/files/ahlolbait/old/u12/download/entezar_2.mp3',
    ],
    isShia: true,
  },
  {
    id: 'aghati',
    name: 'مرحوم محمد آقاتی',
    title: 'نوای قدسی آستان قدس رضوی',
    description: 'اذان تاریخی و ماندگار حرم مطهر امام رضا (ع) در دستگاه افشاری',
    maqam: 'افشاری',
    duration: '۴:۳۵',
    approxSizeMb: 2.7,
    audioUrls: [
      '/audio/azan/aghati.mp3',
      'https://static.ahlolbait.com/files/ahlolbait/old/u12/download/13920305000948.mp3',
    ],
    isShia: true,
  },
  {
    id: 'sobhdel',
    name: 'مرحوم حسین صبحدل',
    title: 'مؤذن انقلاب و نوای آرامش‌بخش سحر',
    description: 'اذان سنتی، لطیف و بیات ترک در خاطره مردم مؤمن ایران',
    maqam: 'بیات ترک',
    duration: '۴:۴۰',
    approxSizeMb: 2.8,
    audioUrls: [
      '/audio/azan/sobhdel.mp3',
      'https://static.ahlolbait.com/files/ahlolbait/old/u12/download/13920305000909.mp3',
    ],
    isShia: true,
  },
  {
    id: 'gheloush',
    name: 'استاد راغب مصطفی غلوش',
    title: 'اذان ماندگار شیعه با شهادت به ولایت',
    description: 'اذان جاودانه استاد غلوش در سفر به ایران با ذکر «أشهد أن علیاً ولی‌الله»',
    maqam: 'سه‌گاه و حجاز',
    duration: '۴:۵۵',
    approxSizeMb: 3.0,
    audioUrls: [
      '/audio/azan/gheloush.mp3',
      'https://static.ahlolbait.com/files/ahlolbait/old/u12/download/13920305000921.mp3',
    ],
    isShia: true,
  },
  {
    id: 'raziei',
    name: 'دکتر قاسم رضیعی',
    title: 'اذان حماسی با طنین دلنشین',
    description: 'نوای رسا، استوار و شکوهمند دکتر قاسم رضیعی با تجوید عالی',
    maqam: 'رست و کرد',
    duration: '۴:۱۵',
    approxSizeMb: 2.6,
    audioUrls: [
      '/audio/azan/raziei.mp3',
      'https://static.ahlolbait.com/files/ahlolbait/old/u12/download/13920230000576.mp3',
    ],
    isShia: true,
  },
  {
    id: 'mansoori',
    name: 'استاد کریم منصوری',
    title: 'نوای فصیح و ملکوتی قاری بین‌المللی',
    description: 'اذان فاخر و گوش‌نواز استاد کریم منصوری با لحن قرآنی اصیل',
    maqam: 'بیات و حجاز',
    duration: '۳:۳۰',
    approxSizeMb: 2.1,
    audioUrls: [
      '/audio/azan/mansoori.mp3',
      'https://static.ahlolbait.com/files/ahlolbait/old/u12/download/13920305000946.mp3',
    ],
    isShia: true,
  },
  {
    id: 'sharif',
    name: 'استاد حسینعلی شریف',
    title: 'اذان رسا و آموزشی صدا و سیما',
    description: 'اذان منظم و دقیق آموزشی با فصاحت کلام و طنین دلنشین',
    maqam: 'حجاز',
    duration: '۴:۱۰',
    approxSizeMb: 3.9,
    audioUrls: [
      '/audio/azan/sharif.mp3',
      'https://static.ahlolbait.com/files/ahlolbait/old/u12/download/13920305000915.mp3',
    ],
    isShia: true,
  },
  {
    id: 'sadat_fatemi',
    name: 'سید مرتضی سادات فاطمی',
    title: 'نوای آستان مقدس امام رضا (ع)',
    description: 'اذان سنتی، محزون و باصلابت حرم مطهر رضوی مشهد مقدس',
    maqam: 'بیات ترک',
    duration: '۴:۵۰',
    approxSizeMb: 2.9,
    audioUrls: [
      '/audio/azan/sadat_fatemi.mp3',
      'https://static.ahlolbait.com/files/ahlolbait/old/u12/download/13920305000927.mp3',
    ],
    isShia: true,
  },
  {
    id: 'shia_athan',
    name: 'اذان شیعه (کربلایی محمدجواد بوستانی)',
    title: 'نوای طنین‌انداز و باصلابت شیعه',
    description: 'اذان کامل با تجوید اصیل اسلامی و ادای کامل شهادت به ولایت امیرالمؤمنین (ع)',
    maqam: 'حجاز و رست',
    duration: '۵:۳۰',
    approxSizeMb: 5.2,
    audioUrls: [
      '/audio/azan/shia_athan.mp3',
      'https://archive.org/download/karbalaiimohammadjavadboostaniathandoasalavat/karbalaii%20mohammad%20javad%20boostani%20athan.mp3',
    ],
    isShia: true,
  },
];

/**
 * فهرست ادعیه و مناجات‌های معتبر قبل از اذان
 */
export const PRE_AZAN_DUAS_LIST: PreAzanDua[] = [
  {
    id: 'salawat_reza',
    name: 'صلوات خاصه امام رضا (ع)',
    title: 'اللّهمَّ صَلِّ عَلی عَلی بنِ مُوسَی الرِّضا المُرتَضی',
    description: 'نوای ملکوتی صلوات خاصه امام هشتم شیعیان همراه با طنین نقاره‌خانه حرم مطهر',
    duration: '۲:۳۰',
    approxSizeMb: 1.2,
    audioUrls: [
      '/audio/duas/salawat_reza.mp3',
      'https://archive.org/download/SalavatKhaseEmamReza/Salavat%20Khase%20Emam%20Reza.mp3',
    ],
  },
  {
    id: 'dua_faraj',
    name: 'دعای فرج (الهی عظم البلاء)',
    title: 'دعای استغاثه به امام زمان (عج) با نوای علی فانی',
    description: 'نوای روح‌بخش، آرامش‌بخش و التماس دعای فرج صاحب‌الزمان ارواحنا فداه',
    duration: '۳:۴۰',
    approxSizeMb: 1.9,
    audioUrls: [
      '/audio/duas/dua_faraj.mp3',
      'https://archive.org/download/20240530_20240530_1944/%D8%AF%D8%B9%D8%A7%D9%8A%20%D9%81%D8%B1%D8%AC%20-%20%D8%B9%D9%84%D9%8A%20%D9%81%D8%A7%D9%86%D9%8A.mp3',
    ],
  },
];

const SETTINGS_KEY = 'mobin_azan_settings';
const DOWNLOADED_KEY = 'mobin_downloaded_azan_muezzins';
const DOWNLOADED_DUAS_KEY = 'mobin_downloaded_duas';

export const DEFAULT_SETTINGS: AzanSettings = {
  selectedMuezzinId: 'moazenzadeh',
  selectedPreDuaId: 'salawat_reza',
  playPreAzanDua: true,
  preAlertMinutes: 5,
  fajrAlert: true,
  dhuhrAlert: true,
  maghribAlert: true,
  inAppSoundEnabled: true,
  systemNotificationEnabled: true,
  playPostAzanDua: true,
  calculationMethod: 'tehran',
  safetyMarginMinutes: 0,
  volume: 1.0,
};

export function getAzanSettings(): AzanSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      // اگر دعای ذخیره‌شده جزو موارد حذف‌شده بود، جایگزین با صلوات خاصه
      if (!PRE_AZAN_DUAS_LIST.some((d) => d.id === parsed.selectedPreDuaId)) {
        parsed.selectedPreDuaId = 'salawat_reza';
      }
      return parsed;
    }
  } catch {}
  return DEFAULT_SETTINGS;
}

function safeDispatchEvent(name: string, detail?: unknown): void {
  if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail }));
    } catch {
      // Ignored if window event dispatching is unavailable (e.g. headless/ssr)
    }
  }
}

export function saveAzanSettings(settings: AzanSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    safeDispatchEvent('mobin-azan-settings-changed', settings);
    syncPrayerAlarmsWithServiceWorker().catch(() => {});
  } catch {}
}

export function getDownloadedMuezzinIds(): string[] {
  try {
    const raw = localStorage.getItem(DOWNLOADED_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return ['moazenzadeh', 'shia_athan', 'sobhdel']; // این فایل‌ها به صورت باندل محلی وجود دارند
}

function setDownloadedMuezzinIds(ids: string[]): void {
  try {
    localStorage.setItem(DOWNLOADED_KEY, JSON.stringify(ids));
    safeDispatchEvent('mobin-azan-downloads-changed', ids);
  } catch {}
}

export function isMuezzinDownloaded(muezzinId: string): boolean {
  return getDownloadedMuezzinIds().includes(muezzinId);
}

export function getDownloadedDuaIds(): string[] {
  try {
    const raw = localStorage.getItem(DOWNLOADED_DUAS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return ['salawat_reza', 'dua_faraj']; // فایل‌های محلی باندل‌شده
}

function setDownloadedDuaIds(ids: string[]): void {
  try {
    localStorage.setItem(DOWNLOADED_DUAS_KEY, JSON.stringify(ids));
    safeDispatchEvent('mobin-duas-downloads-changed', ids);
  } catch {}
}

export function isDuaDownloaded(duaId: string): boolean {
  return getDownloadedDuaIds().includes(duaId);
}

/**
 * دانلود و کش صوت اذان در Cache Storage برای پخش کاملاً آفلاین
 */
/**
 * دانلود و کش صوت اذان در Cache Storage برای پخش کاملاً آفلاین
 * فایل فقط در صورت موفقیت واقعی دانلود علامت‌گذاری می‌شود
 */
export async function downloadMuezzinAudio(
  muezzinId: string,
  onProgress?: (percent: number) => void
): Promise<boolean> {
  const muezzin = MUEZZINS_LIST.find((m) => m.id === muezzinId);
  if (!muezzin) throw new Error('مؤذن مورد نظر یافت نشد');

  const cacheKey = `/azan-audio/${muezzinId}.mp3`;

  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(AZAN_CACHE_NAME);
      if (onProgress) onProgress(20);

      for (const url of muezzin.audioUrls) {
        try {
          const resp = await fetch(url);
          if (resp.ok) {
            if (onProgress) onProgress(70);
            await cache.put(cacheKey, resp.clone());
            const current = getDownloadedMuezzinIds();
            if (!current.includes(muezzinId)) {
              setDownloadedMuezzinIds([...current, muezzinId]);
            }
            if (onProgress) onProgress(100);
            return true;
          }
        } catch {}
      }
    } catch {}
  }

  throw new Error(`خطا در دانلود صوت اذان «${muezzin.name}». لطفاً اتصال اینترنت خود را بررسی کنید.`);
}

export async function deleteDownloadedMuezzin(muezzinId: string): Promise<void> {
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(AZAN_CACHE_NAME);
      await cache.delete(`/azan-audio/${muezzinId}.mp3`);
    } catch {}
  }
  const current = getDownloadedMuezzinIds();
  setDownloadedMuezzinIds(current.filter((id) => id !== muezzinId));
}

export async function downloadDuaAudio(
  duaId: string,
  onProgress?: (percent: number) => void
): Promise<boolean> {
  const dua = PRE_AZAN_DUAS_LIST.find((d) => d.id === duaId);
  if (!dua) throw new Error('دعای مورد نظر یافت نشد');

  const cacheKey = `/duas-audio/${duaId}.mp3`;

  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(AZAN_CACHE_NAME);
      if (onProgress) onProgress(30);

      for (const url of dua.audioUrls) {
        try {
          const resp = await fetch(url);
          if (resp.ok) {
            if (onProgress) onProgress(70);
            await cache.put(cacheKey, resp.clone());
            const current = getDownloadedDuaIds();
            if (!current.includes(duaId)) {
              setDownloadedDuaIds([...current, duaId]);
            }
            if (onProgress) onProgress(100);
            return true;
          }
        } catch {}
      }
    } catch {}
  }

  throw new Error(`خطا در دانلود نوای «${dua.name}». لطفاً اتصال اینترنت خود را بررسی کنید.`);
}

export async function deleteDownloadedDua(duaId: string): Promise<void> {
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(AZAN_CACHE_NAME);
      await cache.delete(`/duas-audio/${duaId}.mp3`);
    } catch {}
  }
  const current = getDownloadedDuaIds();
  setDownloadedDuaIds(current.filter((id) => id !== duaId));
}

// مدیریت آدرس‌های blob تولیدشده برای جلوگیری کامل از نشت حافظه (Memory Leak)
const activeObjectUrls = new Map<string, string>();

function createAndTrackObjectURL(key: string, blob: Blob): string {
  const existing = activeObjectUrls.get(key);
  if (existing) {
    try {
      URL.revokeObjectURL(existing);
    } catch {}
  }
  const url = URL.createObjectURL(blob);
  activeObjectUrls.set(key, url);
  return url;
}

export function revokeAllPlayableUrls(): void {
  for (const url of activeObjectUrls.values()) {
    try {
      URL.revokeObjectURL(url);
    } catch {}
  }
  activeObjectUrls.clear();
}

/**
 * دریافت آدرس قابل پخش (کش آفلاین، سپس فایل محلی یا استریم)
 */
export async function getMuezzinPlayableUrl(muezzinId: string): Promise<string> {
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(AZAN_CACHE_NAME);
      const cached = await cache.match(`/azan-audio/${muezzinId}.mp3`);
      if (cached) {
        const blob = await cached.blob();
        return createAndTrackObjectURL(`muezzin_${muezzinId}`, blob);
      }
    } catch {}
  }

  const muezzin = MUEZZINS_LIST.find((m) => m.id === muezzinId);
  if (muezzin && muezzin.audioUrls.length > 0) {
    return muezzin.audioUrls[0];
  }
  return '/audio/azan/moazenzadeh.mp3';
}

export async function getDuaPlayableUrl(duaId: string): Promise<string> {
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(AZAN_CACHE_NAME);
      const cached = await cache.match(`/duas-audio/${duaId}.mp3`);
      if (cached) {
        const blob = await cached.blob();
        return createAndTrackObjectURL(`dua_${duaId}`, blob);
      }
    } catch {}
  }

  const dua = PRE_AZAN_DUAS_LIST.find((d) => d.id === duaId);
  if (dua && dua.audioUrls.length > 0) {
    return dua.audioUrls[0];
  }
  return '/audio/duas/salawat_reza.mp3';
}

/**
 * پخش‌کننده پیش‌نمایش در صفحه تنظیمات (با منطق Toggle برای تست توسط کاربر)
 */
let previewAudio: HTMLAudioElement | null = null;
let currentPreviewId: string | null = null;
let currentPreviewType: 'azan' | 'dua' | null = null;

export function stopAzanPreview(): void {
  if (previewAudio) {
    previewAudio.pause();
    previewAudio.currentTime = 0;
    previewAudio = null;
  }
  currentPreviewId = null;
  currentPreviewType = null;
  safeDispatchEvent('mobin-azan-preview-state', { isPlaying: false, id: null, type: null });
}

export async function playAzanPreview(muezzinId: string, onEnd?: () => void): Promise<void> {
  if (previewAudio && currentPreviewId === muezzinId) {
    stopAzanPreview();
    return;
  }

  stopAzanPreview();

  const url = await getMuezzinPlayableUrl(muezzinId);
  const audio = new Audio(url);
  const settings = getAzanSettings();
  audio.volume = settings.volume;
  previewAudio = audio;
  currentPreviewId = muezzinId;
  currentPreviewType = 'azan';

  audio.onended = () => {
    stopAzanPreview();
    if (onEnd) onEnd();
  };

  audio.onerror = () => {
    stopAzanPreview();
    playHarmonicAzanChime();
    if (onEnd) onEnd();
  };

  safeDispatchEvent('mobin-azan-preview-state', { isPlaying: true, id: muezzinId, type: 'azan' });

  try {
    await audio.play();
  } catch {
    stopAzanPreview();
    playHarmonicAzanChime();
    if (onEnd) onEnd();
  }
}

export async function playDuaPreview(duaId: string, onEnd?: () => void): Promise<void> {
  if (previewAudio && currentPreviewId === duaId) {
    stopAzanPreview();
    return;
  }

  stopAzanPreview();

  const url = await getDuaPlayableUrl(duaId);
  const audio = new Audio(url);
  const settings = getAzanSettings();
  audio.volume = settings.volume;
  previewAudio = audio;
  currentPreviewId = duaId;
  currentPreviewType = 'dua';

  audio.onended = () => {
    stopAzanPreview();
    if (onEnd) onEnd();
  };

  audio.onerror = () => {
    stopAzanPreview();
    playHarmonicAzanChime();
    if (onEnd) onEnd();
  };

  safeDispatchEvent('mobin-azan-preview-state', { isPlaying: true, id: duaId, type: 'dua' });

  try {
    await audio.play();
  } catch {
    stopAzanPreview();
    playHarmonicAzanChime();
    if (onEnd) onEnd();
  }
}

export function getCurrentPreviewState() {
  return {
    isPlaying: previewAudio !== null,
    id: currentPreviewId,
    type: currentPreviewType,
  };
}

/**
 * پخش‌کننده اذان واقعی / رسمی (بدون رفتار Toggle و جدا از پیش‌نمایش)
 * پشتیبانی کامل از دعای قبل از اذان (صلوات خاصه / دعای فرج) و دعای پس از اذان
 */
let actualAzanAudio: HTMLAudioElement | null = null;
let currentActualStage: 'pre_dua' | 'azan' | 'post_dua' | null = null;

export function stopActualAzan(): void {
  if (actualAzanAudio) {
    actualAzanAudio.pause();
    actualAzanAudio.currentTime = 0;
    actualAzanAudio = null;
  }
  currentActualStage = null;
  safeDispatchEvent('mobin-azan-playback-state', { isPlaying: false, stage: null });
}

export function stopAllAzanAudio(): void {
  stopAzanPreview();
  stopActualAzan();
}

export async function playActualAzan(options?: {
  prayerName?: string;
  muezzinId?: string;
  skipPreDua?: boolean;
  onEnd?: () => void;
}): Promise<void> {
  stopAllAzanAudio();

  const settings = getAzanSettings();
  const muezzinId = options?.muezzinId || settings.selectedMuezzinId;
  const muezzin = MUEZZINS_LIST.find((m) => m.id === muezzinId) || MUEZZINS_LIST[0];

  const playAzanCore = async () => {
    currentActualStage = 'azan';
    const azanUrl = await getMuezzinPlayableUrl(muezzin.id);
    const audio = new Audio(azanUrl);
    audio.volume = settings.volume;
    actualAzanAudio = audio;

    safeDispatchEvent('mobin-azan-playback-state', {
      isPlaying: true,
      stage: 'azan',
      muezzinName: muezzin.name,
    });

    audio.onended = () => {
      stopActualAzan();
      if (settings.playPostAzanDua) {
        playHarmonicAzanChime();
      }
      if (options?.onEnd) options.onEnd();
    };

    audio.onerror = () => {
      stopActualAzan();
      playHarmonicAzanChime();
      if (options?.onEnd) options.onEnd();
    };

    try {
      await audio.play();
    } catch {
      stopActualAzan();
      playHarmonicAzanChime();
      if (options?.onEnd) options.onEnd();
    }
  };

  // بررسی پخش دعای قبل از اذان در صورت فعال بودن
  if (settings.playPreAzanDua && !options?.skipPreDua && settings.selectedPreDuaId) {
    const dua = PRE_AZAN_DUAS_LIST.find((d) => d.id === settings.selectedPreDuaId);
    if (dua) {
      currentActualStage = 'pre_dua';
      try {
        const duaUrl = await getDuaPlayableUrl(dua.id);
        const duaAudio = new Audio(duaUrl);
        duaAudio.volume = settings.volume;
        actualAzanAudio = duaAudio;

        safeDispatchEvent('mobin-azan-playback-state', {
          isPlaying: true,
          stage: 'pre_dua',
          duaName: dua.name,
        });

        duaAudio.onended = () => {
          actualAzanAudio = null;
          playAzanCore();
        };

        duaAudio.onerror = () => {
          actualAzanAudio = null;
          playAzanCore();
        };

        await duaAudio.play();
        return;
      } catch {
        actualAzanAudio = null;
      }
    }
  }

  // پخش مستقیم صوت اذان
  await playAzanCore();
}

/**
 * پخش نوای ملکوتی سنتز شده توسط Web Audio API بدون نیاز به دانلود یا اینترنت
 */
export function playHarmonicAzanChime(): void {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const notes = [392, 440, 523.25, 659.25, 587.33]; // G4, A4, C5, E5, D5 (نغمه بیات ترک / حجاز)
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.35);

      gain.gain.setValueAtTime(0, now + idx * 0.35);
      gain.gain.linearRampToValueAtTime(0.35, now + idx * 0.35 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.35 + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.35);
      osc.stop(now + idx * 0.35 + 1.2);
    });
  } catch {}
}

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export function getNotificationPermissionStatus(): NotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission as NotificationPermissionState;
}

/**
 * درخواست مجوز نمایش اعلان مرورگر
 */
export async function requestAzanNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission === 'granted') return true;
  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch {
    return false;
  }
}

/**
 * ساختار آلارم‌های زمان‌بندی‌شده اذان و هشدارهای شرعی
 */
export interface ScheduledPrayerAlarm {
  id: string;
  prayerKey: 'fajr' | 'dhuhr' | 'maghrib';
  prayerName: string;
  timestamp: number;
  type: 'azan' | 'pre_alert';
  preAlertMinutes?: number;
  muezzinName?: string;
}

/**
 * تابع خالص استخراج و زمان‌بندی هشدارهای امروز و فردا
 * تست‌پذیر و قابل استفاده در محیط Web، Service Worker و Native Capacitor
 */
export function getPrayersToSchedule(
  todayTimes: PrayerTimes,
  tomorrowTimes: PrayerTimes,
  now: Date = new Date(),
  settings: AzanSettings = getAzanSettings(),
  muezzinName?: string
): ScheduledPrayerAlarm[] {
  const nowMs = now.getTime();
  const alarms: ScheduledPrayerAlarm[] = [];

  const prayerDefs: Array<{
    key: 'fajr' | 'dhuhr' | 'maghrib';
    name: string;
    enabled: boolean;
  }> = [
    { key: 'fajr', name: 'اذان صبح', enabled: settings.fajrAlert },
    { key: 'dhuhr', name: 'اذان ظهر', enabled: settings.dhuhrAlert },
    { key: 'maghrib', name: 'اذان مغرب', enabled: settings.maghribAlert },
  ];

  const processDay = (times: PrayerTimes, dayTag: 'today' | 'tomorrow') => {
    for (const p of prayerDefs) {
      if (!p.enabled) continue;
      const rawDate = times.rawTimes[p.key];
      if (!rawDate) continue;
      const prayerMs = rawDate.getTime();

      // ۱. هشدار قبل از اذان در صورت تنظیم
      if (settings.preAlertMinutes > 0) {
        const preAlertMs = prayerMs - settings.preAlertMinutes * 60 * 1000;
        if (preAlertMs > nowMs) {
          alarms.push({
            id: `${p.key}_pre_${dayTag}_${preAlertMs}`,
            prayerKey: p.key,
            prayerName: p.name,
            timestamp: preAlertMs,
            type: 'pre_alert',
            preAlertMinutes: settings.preAlertMinutes,
            muezzinName,
          });
        }
      }

      // ۲. وقت اذان اصلی
      if (prayerMs > nowMs) {
        alarms.push({
          id: `${p.key}_azan_${dayTag}_${prayerMs}`,
          prayerKey: p.key,
          prayerName: p.name,
          timestamp: prayerMs,
          type: 'azan',
          muezzinName,
        });
      }
    }
  };

  processDay(todayTimes, 'today');
  processDay(tomorrowTimes, 'tomorrow');

  alarms.sort((a, b) => a.timestamp - b.timestamp);
  return alarms;
}

/**
 * اجرای آزمایش کامل هشدار اذان (صوت + اعلان تصویری درون‌برنامه و مرورگر + لرزش در حالت سایلنت)
 */
export async function testAzanAlertNow(): Promise<void> {
  const settings = getAzanSettings();
  const muezzin = MUEZZINS_LIST.find((m) => m.id === settings.selectedMuezzinId) || MUEZZINS_LIST[0];

  // ۱. لرزش پرقدرت دستگاه
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate([600, 250, 600, 250, 1200, 300, 1200]);
    } catch {}
  }

  // ۲. پخش واقعی اذان با پشتیبانی از صلوات/دعای قبل از اذان
  if (settings.inAppSoundEnabled) {
    playActualAzan({ prayerName: 'اذان (آزمایشی)', muezzinId: muezzin.id });
  } else {
    playHarmonicAzanChime();
  }

  // ۳. نمایش اعلان مرورگر
  await showAzanSystemNotification('اذان (تست هشدار)', muezzin.name, 'test');

  // ۴. ارسال رویداد درون‌برنامه‌ای برای نمایش بنر معنوی
  safeDispatchEvent('mobin-azan-alert', {
    prayerName: 'اذان (آزمایشی)',
    muezzinName: muezzin.name,
    timestamp: new Date().toISOString(),
  });
}

/**
 * نمایش اعلان سیستم عامل از طریق Service Worker (کارکرد در پس‌زمینه و حالت سایلنت)
 */
export async function showAzanSystemNotification(
  prayerName: string,
  muezzinName: string,
  prayerKey: string
): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const title = `هنگام ${prayerName} - قرآن مبین`;
  type ExtendedNotificationOptions = NotificationOptions & {
    vibrate?: number[];
    renotify?: boolean;
    requireInteraction?: boolean;
    silent?: boolean;
  };
  const options: ExtendedNotificationOptions = {
    body: `نوای ملکوتی اذان شیعه با صدای ${muezzinName} - حیّ علی الصلاة و الفلاح`,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [600, 250, 600, 250, 1200, 300, 1200],
    tag: `mobin-azan-${prayerKey}`,
    renotify: true,
    requireInteraction: true,
    silent: false,
    data: { prayerKey, url: `/?action=azan&prayer=${prayerKey}` },
  };

  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, options);
      return;
    }
  } catch {
    // Fallback to standard window Notification if SW registration is not available
  }

  try {
    new Notification(title, options);
  } catch {
    // Ignored if notifications are denied or unsupported
  }
}

/**
 * همگام‌سازی و ارسال زمان‌بندی اوقات شرعی به Service Worker برای اعلان در پس‌زمینه و بسته بودن برنامه
 */
export async function syncPrayerAlarmsWithServiceWorker(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  try {
    const { calculatePrayerTimes, getSavedCity, getSavedCustomCoords } = await import('./prayerTimesService');
    const city = getSavedCity();
    const customCoords = getSavedCustomCoords();
    const coords = customCoords || {
      latitude: city.latitude,
      longitude: city.longitude,
      elevation: city.elevation,
    };
    const settings = getAzanSettings();
    const muezzin = MUEZZINS_LIST.find((m) => m.id === settings.selectedMuezzinId) || MUEZZINS_LIST[0];

    const now = new Date();
    const todayTimes = calculatePrayerTimes(
      coords,
      now,
      coords.timezone,
      settings.calculationMethod,
      settings.safetyMarginMinutes
    );

    const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
    const tomorrowTimes = calculatePrayerTimes(
      coords,
      tomorrow,
      coords.timezone,
      settings.calculationMethod,
      settings.safetyMarginMinutes
    );

    const alarms = getPrayersToSchedule(todayTimes, tomorrowTimes, now, settings, muezzin.name);
    const payload = { alarms, muezzinName: muezzin.name };

    const sendMsg = (workerOrReg: ServiceWorker | ServiceWorkerRegistration | null | undefined) => {
      const sw =
        navigator.serviceWorker.controller ||
        (workerOrReg && 'active' in workerOrReg ? workerOrReg.active : (workerOrReg as ServiceWorker | null));
      if (sw) {
        sw.postMessage({
          type: 'SCHEDULE_PRAYER_ALARMS',
          payload,
        });
      }
    };

    if (navigator.serviceWorker.controller) {
      sendMsg(navigator.serviceWorker.controller);
    } else {
      navigator.serviceWorker.ready.then(sendMsg).catch(() => {});
    }

    // ثبت دوره‌ای PeriodicSync در صورت پشتیبانی مرورگر
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((reg: ServiceWorkerRegistration) => {
          if ('periodicSync' in reg) {
            (reg as unknown as { periodicSync: { register: (tag: string, opt: { minInterval: number }) => Promise<void> } }).periodicSync
              .register('azan-check', { minInterval: 60 * 60 * 1000 })
              .catch(() => {});
          }
        })
        .catch(() => {});
    }
  } catch (err) {
    console.warn('[Azan] Could not sync alarms to SW:', err);
  }
}

/**
 * زمان‌بند خودکار اذان و هشدارهای شرعی با کارکرد در پس‌زمینه و حالت خواب
 */
let azanSchedulerTimer: ReturnType<typeof setInterval> | null = null;
let bgWorker: Worker | null = null;

export function initAzanScheduler(): () => void {
  if (typeof window === 'undefined') return () => {};

  // در پلتفرم native، زمان‌بندی از طریق آلارم‌های دقیق سیستم‌عامل انجام می‌شود
  // تایمر ورکر و بررسی‌های تکراری غیرفعال می‌شوند تا اذان دو بار پخش نشود.
  if (Capacitor.isNativePlatform()) {
    import('./notifications').then(({ initNotificationWatchers }) => {
      initNotificationWatchers();
    }).catch(() => {});
    return () => {};
  }

  // دریافت پیام از سرویس‌ورکر هنگام کلیک روی اعلان اذان
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'PLAY_AZAN_FROM_NOTIFICATION') {
        const settings = getAzanSettings();
        const muezzin = MUEZZINS_LIST.find((m) => m.id === settings.selectedMuezzinId) || MUEZZINS_LIST[0];
        playActualAzan({ prayerName: event.data.prayerName || 'اذان شرعی', muezzinId: muezzin.id });
        safeDispatchEvent('mobin-azan-alert', {
          prayerName: event.data.prayerName || 'اذان شرعی',
          muezzinName: muezzin.name,
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  // بررسی وضعیت اجرای اذان بر مبنای اوقات جاری
  const checkPrayerTimesNow = async () => {
    try {
      const { calculatePrayerTimes, getSavedCity, getSavedCustomCoords } = await import('./prayerTimesService');
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

      const city = getSavedCity();
      const customCoords = getSavedCustomCoords();
      const coords = customCoords || {
        latitude: city.latitude,
        longitude: city.longitude,
        elevation: city.elevation,
      };

      const settings = getAzanSettings();
      const times = calculatePrayerTimes(
        coords,
        now,
        coords.timezone,
        settings.calculationMethod,
        settings.safetyMarginMinutes
      );

      const prayersToCheck: Array<{ key: 'fajr' | 'dhuhr' | 'maghrib'; name: string; alertEnabled: boolean }> = [
        { key: 'fajr', name: 'اذان صبح', alertEnabled: settings.fajrAlert },
        { key: 'dhuhr', name: 'اذان ظهر', alertEnabled: settings.dhuhrAlert },
        { key: 'maghrib', name: 'اذان مغرب', alertEnabled: settings.maghribAlert },
      ];

      const firedKey = `mobin_azan_fired_${todayStr}`;
      const firedPrayers: string[] = JSON.parse(localStorage.getItem(firedKey) || '[]');
      const firedPreKey = `mobin_azan_pre_fired_${todayStr}`;
      const firedPrePrayers: string[] = JSON.parse(localStorage.getItem(firedPreKey) || '[]');
      const nowMs = now.getTime();

      for (const p of prayersToCheck) {
        if (!p.alertEnabled) continue;

        const rawDate = times.rawTimes[p.key];
        if (!rawDate) continue;

        const prayerMs = rawDate.getTime();

        // ۱. بررسی هشدار قبل از اذان (preAlertMinutes)
        if (settings.preAlertMinutes > 0 && !firedPrePrayers.includes(p.key)) {
          const preAlertMs = prayerMs - settings.preAlertMinutes * 60 * 1000;
          const isPreAlertDue = nowMs >= preAlertMs && (nowMs - preAlertMs) <= 3 * 60 * 1000;

          if (isPreAlertDue) {
            firedPrePrayers.push(p.key);
            localStorage.setItem(firedPreKey, JSON.stringify(firedPrePrayers));

            if (navigator.vibrate) {
              try {
                navigator.vibrate([300, 150, 300]);
              } catch {}
            }

            if (settings.systemNotificationEnabled) {
              showAzanSystemNotification(
                `نزدیک به ${p.name} (${settings.preAlertMinutes} دقیقه مانده)`,
                'قرآن مبین',
                `pre_${p.key}`
              );
            }

            safeDispatchEvent('mobin-azan-alert', {
              prayerName: `نزدیک به ${p.name} (${settings.preAlertMinutes} دقیقه مانده)`,
              muezzinName: 'آمادگی اقامه نماز',
              timestamp: new Date().toISOString(),
            });
          }
        }

        // ۲. بررسی فرارسیدن وقت اذان
        if (!firedPrayers.includes(p.key)) {
          const isDue = nowMs >= prayerMs && (nowMs - prayerMs) <= 15 * 60 * 1000;

          if (isDue) {
            firedPrayers.push(p.key);
            localStorage.setItem(firedKey, JSON.stringify(firedPrayers));

            const muezzin = MUEZZINS_LIST.find((m) => m.id === settings.selectedMuezzinId) || MUEZZINS_LIST[0];

            if (navigator.vibrate) {
              try {
                navigator.vibrate([600, 250, 600, 250, 1200, 300, 1200]);
              } catch {}
            }

            // پخش واقعی اذان با رعایت دعای قبل و بعد
            if (settings.inAppSoundEnabled) {
              playActualAzan({ prayerName: p.name, muezzinId: muezzin.id });
            } else {
              playHarmonicAzanChime();
            }

            if (settings.systemNotificationEnabled) {
              showAzanSystemNotification(p.name, muezzin.name, p.key);
            }

            safeDispatchEvent('mobin-azan-alert', {
              prayerName: p.name,
              muezzinName: muezzin.name,
              timestamp: new Date().toISOString(),
            });
          }
        }
      }
    } catch {}
  };

  // ۱. ایجاد وب‌ورکر پس‌زمینه برای عدم فریز شدن تایمر توسط بهینه‌ساز باتری مرورگر
  try {
    const workerScript = `
      let timer = null;
      self.onmessage = function(e) {
        if (e.data === 'start') {
          if (timer) clearInterval(timer);
          timer = setInterval(function() {
            self.postMessage('tick');
          }, 10000); // تیک هر ۱۰ ثانیه
        } else if (e.data === 'stop') {
          if (timer) clearInterval(timer);
          timer = null;
        }
      };
    `;
    const blob = new Blob([workerScript], { type: 'application/javascript' });
    bgWorker = new Worker(URL.createObjectURL(blob));
    bgWorker.onmessage = () => {
      checkPrayerTimesNow();
    };
    bgWorker.postMessage('start');
  } catch {
    // بازگشت به تایمر معمولی در صورت عدم پشتیبانی ورکر
    azanSchedulerTimer = setInterval(checkPrayerTimesNow, 12000);
  }

  // ۲. بررسی فوری هنگام بیدار شدن گوشی و روشن شدن صفحه (Visibility / Focus)
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      checkPrayerTimesNow();
      syncPrayerAlarmsWithServiceWorker().catch(() => {});
    }
  };
  const handleFocus = () => {
    checkPrayerTimesNow();
    syncPrayerAlarmsWithServiceWorker().catch(() => {});
  };

  document.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('focus', handleFocus);

  // بررسی اولیه و همگام‌سازی با سرویس‌ورکر
  checkPrayerTimesNow();
  syncPrayerAlarmsWithServiceWorker().catch(() => {});

  return () => {
    if (azanSchedulerTimer) clearInterval(azanSchedulerTimer);
    if (bgWorker) {
      bgWorker.postMessage('stop');
      bgWorker.terminate();
      bgWorker = null;
    }
    document.removeEventListener('visibilitychange', handleVisibility);
    window.removeEventListener('focus', handleFocus);
  };
}
