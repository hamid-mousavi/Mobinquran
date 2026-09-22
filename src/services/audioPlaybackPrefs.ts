import { ReciterId } from './audioSources';

export interface AudioResumePosition {
  surahId: number;
  verseNumber: number;
  reciterId: ReciterId;
  playbackRate: number;
  updatedAt: number;
}

export interface SleepTimerPrefs {
  mode: 'time' | 'verses';
  value: number;
}

const RESUME_KEY = 'quran_audio_resume';
const SLEEP_PREFS_KEY = 'quran_audio_sleep_prefs';

export function saveAudioResumePosition(pos: AudioResumePosition): void {
  try {
    localStorage.setItem(RESUME_KEY, JSON.stringify(pos));
  } catch {
    // نادیده گرفتن خطای فضای ذخیره‌سازی
  }
}

export function loadAudioResumePosition(): AudioResumePosition | null {
  try {
    const raw = localStorage.getItem(RESUME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AudioResumePosition;
    if (!parsed || !parsed.surahId || !parsed.verseNumber || !parsed.reciterId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearAudioResumePosition(): void {
  try {
    localStorage.removeItem(RESUME_KEY);
  } catch {
    // نادیده گرفتن خطا
  }
}

export function saveSleepTimerPrefs(prefs: SleepTimerPrefs): void {
  try {
    localStorage.setItem(SLEEP_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // نادیده گرفتن
  }
}

export function loadSleepTimerPrefs(): SleepTimerPrefs | null {
  try {
    const raw = localStorage.getItem(SLEEP_PREFS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SleepTimerPrefs;
    if (!parsed || (parsed.mode !== 'time' && parsed.mode !== 'verses') || !parsed.value) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function formatSleepTimeRemaining(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const minutes = Math.floor(s / 60);
  const seconds = Math.round(s % 60);
  const fa = (n: number) => n.toLocaleString('fa-IR');
  if (minutes === 0) return `${fa(seconds)} ثانیه`;
  if (minutes < 60) {
    if (seconds === 0) return `${fa(minutes)} دقیقه`;
    return `${fa(minutes)} دقیقه و ${fa(seconds)} ثانیه`;
  }
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  if (remMinutes === 0) return `${fa(hours)} ساعت`;
  if (seconds === 0) return `${fa(hours)} ساعت و ${fa(remMinutes)} دقیقه`;
  return `${fa(hours)} ساعت و ${fa(remMinutes)} دقیقه و ${fa(seconds)} ثانیه`;
}