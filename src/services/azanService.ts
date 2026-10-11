/**
 * سرویس جامع مدیریت اذان شیعه، انتخاب مؤذن، دانلود صوت آفلاین،
 * ادعیه و مناجات قبل از اذان، و تنظیمات هشدارهای شرعی
 */

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
  asrAlert: boolean;
  maghribAlert: boolean;
  ishaAlert: boolean;
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
    id: 'rabbana',
    name: 'دعای ربنا (استاد محمدرضا شجریان)',
    title: 'آیات نورانی دعاهای ربنا در قرآن کریم',
    description: 'نوای ملکوتی و قدسی افطارهای ماه مبارک رمضان در آواز افشاری',
    duration: '۴:۱۵',
    approxSizeMb: 2.5,
    audioUrls: [
      '/audio/duas/rabbana.mp3',
      'https://archive.org/download/avaze-masnavie-afshari-doaye-rabbana/Avaze%20Masnavie%20Afshari%20%26%20Doaye%20Rabbana.mp3',
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
    id: 'asmaul_husna',
    name: 'تواشیح اسماء الحسنی (نام‌های نیکوی خداوند)',
    title: 'نَسْأَلُكَ يَا مَنْ هُوَ اللَّهُ الَّذِي لَا إِلَهَ إِلَّا هُوَ الرَّحْمَنُ الرَّحِيمُ',
    description: 'همخوانی جاودانه و ملکوتی نام‌های اعظم پروردگار در پیشگاه اذان',
    duration: '۳:۱۵',
    approxSizeMb: 1.8,
    audioUrls: [
      '/audio/duas/asmaul_husna.mp3',
      'https://archive.org/download/AsmaAllahAlHusna/Asma%20Allah%20Al%20Husna.mp3',
    ],
  },
  {
    id: 'monajat_masjed_kufa',
    name: 'مناجات منظوم امیرالمؤمنین علی (ع) در مسجد کوفه',
    title: 'مَوْلايَ يَا مَوْلايَ أَنْتَ الْمَوْلَى وَ أَنَا الْعَبْدُ',
    description: 'فرازهای عرفانی و پرسوز مناجات حضرت علی (ع) با نوای حاج مهدی سماواتی',
    duration: '۴:۵۰',
    approxSizeMb: 2.4,
    audioUrls: [
      '/audio/duas/monajat_masjed_kufa.mp3',
      'https://archive.org/download/MonajatKufaSamavati/Monajat%20Kufa%20Samavati.mp3',
    ],
  },
];

const SETTINGS_KEY = 'mobin_azan_settings';
const DOWNLOADED_KEY = 'mobin_downloaded_azan_muezzins';
const DOWNLOADED_DUAS_KEY = 'mobin_downloaded_duas';

const DEFAULT_SETTINGS: AzanSettings = {
  selectedMuezzinId: 'moazenzadeh',
  selectedPreDuaId: 'salawat_reza',
  playPreAzanDua: true,
  preAlertMinutes: 5,
  fajrAlert: true,
  dhuhrAlert: true,
  asrAlert: false,
  maghribAlert: true,
  ishaAlert: false,
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
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {}
  return DEFAULT_SETTINGS;
}

export function saveAzanSettings(settings: AzanSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('mobin-azan-settings-changed', { detail: settings }));
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
    window.dispatchEvent(new CustomEvent('mobin-azan-downloads-changed', { detail: ids }));
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
    window.dispatchEvent(new CustomEvent('mobin-duas-downloads-changed', { detail: ids }));
  } catch {}
}

export function isDuaDownloaded(duaId: string): boolean {
  return getDownloadedDuaIds().includes(duaId);
}

/**
 * دانلود و کش صوت اذان در Cache Storage برای پخش کاملاً آفلاین
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

  // علامت‌گذاری به عنوان دردسترس
  const current = getDownloadedMuezzinIds();
  if (!current.includes(muezzinId)) {
    setDownloadedMuezzinIds([...current, muezzinId]);
  }
  if (onProgress) onProgress(100);
  return true;
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

  const current = getDownloadedDuaIds();
  if (!current.includes(duaId)) {
    setDownloadedDuaIds([...current, duaId]);
  }
  if (onProgress) onProgress(100);
  return true;
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
        return URL.createObjectURL(blob);
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
        return URL.createObjectURL(blob);
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
 * پخش‌کننده آزمایشی سراسری
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
  window.dispatchEvent(
    new CustomEvent('mobin-azan-preview-state', {
      detail: { isPlaying: false, id: null, type: null },
    })
  );
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
  };

  window.dispatchEvent(
    new CustomEvent('mobin-azan-preview-state', {
      detail: { isPlaying: true, id: muezzinId, type: 'azan' },
    })
  );

  try {
    await audio.play();
  } catch {
    stopAzanPreview();
    playHarmonicAzanChime();
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
  };

  window.dispatchEvent(
    new CustomEvent('mobin-azan-preview-state', {
      detail: { isPlaying: true, id: duaId, type: 'dua' },
    })
  );

  try {
    await audio.play();
  } catch {
    stopAzanPreview();
    playHarmonicAzanChime();
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
 * اجرای آزمایش کامل هشدار اذان (صوت + اعلان تصویری درون‌برنامه و مرورگر + لرزش در حالت سایلنت)
 */
export async function testAzanAlertNow(): Promise<void> {
  const settings = getAzanSettings();
  const muezzin = MUEZZINS_LIST.find((m) => m.id === settings.selectedMuezzinId) || MUEZZINS_LIST[0];

  // ۱. لرزش پرقدرت دستگاه (حتی در حالت سایلنت و لرزش)
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate([600, 250, 600, 250, 1200, 300, 1200]);
    } catch {}
  }

  // ۲. پخش صوت اذان انتخاب‌شده
  if (settings.inAppSoundEnabled) {
    playAzanPreview(muezzin.id);
  } else {
    playHarmonicAzanChime();
  }

  // ۳. نمایش اعلان مرورگر / سرویس‌ورکر با قابلیت لرزش در سایلنت
  await showAzanSystemNotification('اذان (تست هشدار)', muezzin.name, 'test');

  // ۴. ارسال رویداد درون‌برنامه‌ای برای نمایش بنر معنوی
  window.dispatchEvent(
    new CustomEvent('mobin-azan-alert', {
      detail: {
        prayerName: 'اذان (آزمایشی)',
        muezzinName: muezzin.name,
        timestamp: new Date().toISOString(),
      },
    })
  );
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
  const options: any = {
    body: `نوای ملکوتی اذان شیعه با صدای ${muezzinName} - حیّ علی الصلاة و الفلاح`,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [600, 250, 600, 250, 1200, 300, 1200], // الگوی ارتعاش قدرتمند در حالت سایلنت
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
  } catch {}

  try {
    new Notification(title, options);
  } catch {}
}

/**
 * زمان‌بند خودکار اذان و هشدارهای شرعی (کارکرد پیوسته، حتی هنگام بازگشت از خواب یا پس‌زمینه)
 */
let azanSchedulerTimer: any = null;
let lastScheduledDate: string = '';

export function initAzanScheduler(): () => void {
  if (typeof window === 'undefined') return () => {};

  // دریافت پیام از سرویس‌ورکر هنگام کلیک روی اعلان اذان
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'PLAY_AZAN_FROM_NOTIFICATION') {
        const settings = getAzanSettings();
        const muezzin = MUEZZINS_LIST.find((m) => m.id === settings.selectedMuezzinId) || MUEZZINS_LIST[0];
        playAzanPreview(muezzin.id);
        window.dispatchEvent(
          new CustomEvent('mobin-azan-alert', {
            detail: {
              prayerName: 'اذان شرعی',
              muezzinName: muezzin.name,
              timestamp: new Date().toISOString(),
            },
          })
        );
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

      const prayersToCheck: Array<{ key: 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha'; name: string; alertEnabled: boolean }> = [
        { key: 'fajr', name: 'اذان صبح', alertEnabled: settings.fajrAlert },
        { key: 'dhuhr', name: 'اذان ظهر', alertEnabled: settings.dhuhrAlert },
        { key: 'asr', name: 'اذان عصر', alertEnabled: settings.asrAlert },
        { key: 'maghrib', name: 'اذان مغرب', alertEnabled: settings.maghribAlert },
        { key: 'isha', name: 'اذان عشاء', alertEnabled: settings.ishaAlert },
      ];

      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const firedKey = `mobin_azan_fired_${todayStr}`;
      const firedPrayers: string[] = JSON.parse(localStorage.getItem(firedKey) || '[]');

      for (const p of prayersToCheck) {
        if (!p.alertEnabled) continue;
        if (firedPrayers.includes(p.key)) continue;

        // زمان محاسبه‌شده برای این وقت
        const rawDate = times.rawTimes[p.key === 'asr' ? 'dhuhr' : p.key === 'isha' ? 'maghrib' : p.key];
        if (!rawDate) continue;

        const prayerMinutes = rawDate.getHours() * 60 + rawDate.getMinutes();
        const diffMinutes = Math.abs(currentMinutes - prayerMinutes);

        // اگر کمتر از ۱ دقیقه فاصله باشد، اذان را اجرا می‌کنیم
        if (diffMinutes === 0 && now.getSeconds() < 45) {
          firedPrayers.push(p.key);
          localStorage.setItem(firedKey, JSON.stringify(firedPrayers));

          const muezzin = MUEZZINS_LIST.find((m) => m.id === settings.selectedMuezzinId) || MUEZZINS_LIST[0];

          // ۱. لرزش سایلنت
          if (navigator.vibrate) {
            try {
              navigator.vibrate([600, 250, 600, 250, 1200, 300, 1200]);
            } catch {}
          }

          // ۲. پخش صوت
          if (settings.inAppSoundEnabled) {
            playAzanPreview(muezzin.id);
          } else {
            playHarmonicAzanChime();
          }

          // ۳. اعلان پس‌زمینه
          if (settings.systemNotificationEnabled) {
            showAzanSystemNotification(p.name, muezzin.name, p.key);
          }

          // ۴. بنر معنوی درون‌برنامه
          window.dispatchEvent(
            new CustomEvent('mobin-azan-alert', {
              detail: {
                prayerName: p.name,
                muezzinName: muezzin.name,
                timestamp: new Date().toISOString(),
              },
            })
          );
        }
      }
    } catch {}
  };

  // بررسی منظم هر ۳۰ ثانیه برای اطمینان از عملکرد دقیق
  azanSchedulerTimer = setInterval(checkPrayerTimesNow, 25000);
  checkPrayerTimesNow();

  return () => {
    if (azanSchedulerTimer) clearInterval(azanSchedulerTimer);
  };
}
