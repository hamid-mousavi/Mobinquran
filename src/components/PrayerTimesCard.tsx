import React, { useState, useEffect, useMemo } from 'react';
import {
  Compass,
  Clock,
  MapPin,
  Sunrise,
  Sun,
  Sunset,
  Moon,
  ChevronLeft,
  Sparkles,
  Volume2,
} from 'lucide-react';
import {
  calculatePrayerTimes,
  getNextPrayer,
  getSavedCity,
  getSavedCustomCoords,
  PrayerTimes,
  NextPrayerInfo,
  CityInfo,
  PrayerKey,
} from '../services/prayerTimesService';
import { getAzanSettings, MUEZZINS_LIST } from '../services/azanService';
import { toPersianDigits } from '../utils/textNormalization';
import type { PrayerModalTab } from './PrayerTimesModal';

interface PrayerTimesCardProps {
  onOpenModal: (tab?: PrayerModalTab) => void;
  darkMode: boolean;
}

const PRAYER_ICONS: Record<PrayerKey, React.ComponentType<{ className?: string }>> = {
  fajr: Sunrise,
  sunrise: Sun,
  dhuhr: Sun,
  sunset: Sunset,
  maghrib: Sunset,
  midnight: Moon,
};

export const PrayerTimesCard: React.FC<PrayerTimesCardProps> = ({
  onOpenModal,
  darkMode,
}) => {
  const [city, setCity] = useState<CityInfo>(getSavedCity());
  const [customCoords, setCustomCoords] = useState(getSavedCustomCoords());
  const [now, setNow] = useState<Date>(new Date());
  const [azanSettings, setAzanSettings] = useState(getAzanSettings());

  // به‌روزرسانی زنده شهر انتخابی و تنظیمات اذان
  useEffect(() => {
    const handleCityChange = () => {
      setCity(getSavedCity());
      setCustomCoords(getSavedCustomCoords());
    };
    const handleSettingsChange = () => {
      setAzanSettings(getAzanSettings());
    };
    window.addEventListener('mobin-prayer-city-changed', handleCityChange);
    window.addEventListener('mobin-azan-settings-changed', handleSettingsChange);
    return () => {
      window.removeEventListener('mobin-prayer-city-changed', handleCityChange);
      window.removeEventListener('mobin-azan-settings-changed', handleSettingsChange);
    };
  }, []);

  // تیک ثانیه‌ای ساعت برای شمارش معکوس دقیق
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const activeCoords = useMemo(() => {
    if (customCoords) return customCoords;
    return {
      latitude: city.latitude,
      longitude: city.longitude,
      elevation: city.elevation,
    };
  }, [city, customCoords]);

  const prayerTimes: PrayerTimes = useMemo(() => {
    return calculatePrayerTimes(
      activeCoords,
      now,
      activeCoords.timezone,
      azanSettings.calculationMethod,
      azanSettings.safetyMarginMinutes
    );
  }, [activeCoords, now.getDate(), now.getMonth(), now.getFullYear(), azanSettings.calculationMethod, azanSettings.safetyMarginMinutes]);

  const nextPrayer: NextPrayerInfo = useMemo(() => {
    return getNextPrayer(prayerTimes, now);
  }, [prayerTimes, now]);

  const currentMuezzin = useMemo(() => {
    return MUEZZINS_LIST.find((m) => m.id === azanSettings.selectedMuezzinId) || MUEZZINS_LIST[0];
  }, [azanSettings.selectedMuezzinId]);

  const prayersList: Array<{ key: PrayerKey; name: string; time: string }> = [
    { key: 'fajr', name: 'صبح', time: prayerTimes.fajr },
    { key: 'sunrise', name: 'طلوع', time: prayerTimes.sunrise },
    { key: 'dhuhr', name: 'ظهر', time: prayerTimes.dhuhr },
    { key: 'sunset', name: 'غروب', time: prayerTimes.sunset },
    { key: 'maghrib', name: 'مغرب', time: prayerTimes.maghrib },
    { key: 'midnight', name: 'نیمه‌شب', time: prayerTimes.midnight },
  ];

  return (
    <section
      aria-label="اوقات شرعی و قبله‌نما"
      onClick={() => onOpenModal('times')}
      className="group rounded-2xl border border-stone-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 px-3.5 py-3 sm:px-4 sm:py-3.5 shadow-xs hover:shadow-sm backdrop-blur-md transition-all hover:border-teal-500/40 cursor-pointer"
      dir="rtl"
    >
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-stone-100 dark:border-slate-800/60">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100">
                اوقات شرعی
              </span>
              <span className="text-stone-300 dark:text-slate-700">•</span>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-300 truncate">
                <MapPin className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                {customCoords ? 'موقعیت شما' : city.name}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* دکمه سریع تنظیمات اذان (فعلاً طبق درخواست کامنت شده است)
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenModal('times');
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 hover:bg-teal-100 text-teal-700 dark:text-teal-300 text-xs font-bold transition-all cursor-pointer border border-teal-500/20"
            title="تنظیمات اذان و دانلود مؤذن"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">اذان: {currentMuezzin.name.split(' ')[0]}</span>
          </button>
          */}

          <div className="flex items-center gap-1 text-xs font-extrabold text-teal-700 dark:text-teal-300 group-hover:translate-x-[-2px] transition-transform">
            <span>قبله‌نما</span>
            <ChevronLeft className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* بخش زمان‌بندی و هایلایت اذان بعدی */}
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 px-2.5 py-1 rounded-full border border-amber-500/20">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>وقت بعدی: {nextPrayer.name}</span>
          </span>
          <span className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 font-mono">
            {toPersianDigits(nextPrayer.time)}
          </span>
        </div>

        <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
          {nextPrayer.remainingMinutes > 0 ? (
            <span>
              {toPersianDigits(nextPrayer.formattedRemaining)} مانده
            </span>
          ) : (
            <span className="text-emerald-600 dark:text-emerald-400 font-bold animate-pulse">
              هم‌اکنون در وقت فضیلت
            </span>
          )}
        </div>
      </div>

      {/* نوار فشرده ۶ وقت شرعی روز */}
      <div className="mt-3 grid grid-cols-6 gap-1.5 sm:gap-2 pt-1">
        {prayersList.map((item) => {
          const isNext = nextPrayer.key === item.key;
          return (
            <div
              key={item.key}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all ${
                isNext
                  ? 'bg-teal-500/15 dark:bg-teal-500/25 border border-teal-500/50 font-black text-teal-900 dark:text-teal-100 shadow-2xs'
                  : 'bg-stone-50/80 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 border border-stone-200/50 dark:border-slate-800'
              }`}
            >
              <span className="text-[11px] sm:text-xs font-bold truncate">{item.name}</span>
              <span className={`text-xs sm:text-sm mt-0.5 font-black ${isNext ? 'text-teal-700 dark:text-teal-300' : 'text-slate-800 dark:text-slate-200'}`}>
                {toPersianDigits(item.time)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
};
