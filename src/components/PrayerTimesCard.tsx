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

  // به‌روزرسانی زنده شهر انتخابی و تنظیمات اذان
  useEffect(() => {
    const handleCityChange = () => {
      setCity(getSavedCity());
      setCustomCoords(getSavedCustomCoords());
    };
    window.addEventListener('mobin-prayer-city-changed', handleCityChange);
    return () => {
      window.removeEventListener('mobin-prayer-city-changed', handleCityChange);
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
      activeCoords.timezone
    );
  }, [activeCoords, now.getDate(), now.getMonth(), now.getFullYear()]);

  const nextPrayer: NextPrayerInfo = useMemo(() => {
    return getNextPrayer(prayerTimes, now);
  }, [prayerTimes, now]);

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
      role="button"
      tabIndex={0}
      onClick={() => onOpenModal('times')}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenModal('times');
        }
      }}
      className="group flex items-center gap-3 rounded-2xl border border-stone-300/80 dark:border-slate-800 bg-stone-50 dark:bg-slate-900 px-4 py-3 cursor-pointer transition-all hover:border-teal-600/50 active:scale-[0.99]"
      dir="rtl"
    >
      <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
        <Moon className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 truncate">
          <span>وقت بعدی</span>
          <span>•</span>
          <MapPin className="w-3 h-3 shrink-0" />
          <span className="truncate">{customCoords ? 'موقعیت شما' : city.name}</span>
        </div>
        <div className="text-[15px] font-extrabold text-slate-900 dark:text-slate-100">
          {nextPrayer.name} {toPersianDigits(nextPrayer.time)}
        </div>
      </div>
      <div className="text-xs font-bold text-amber-700 dark:text-amber-300 text-left shrink-0">
        {nextPrayer.remainingMinutes > 0 ? (
          <span>{toPersianDigits(nextPrayer.formattedRemaining)} مانده</span>
        ) : (
          <span className="text-teal-700 dark:text-teal-300 animate-pulse">هم‌اکنون</span>
        )}
      </div>
      <ChevronLeft className="w-4 h-4 text-slate-400 shrink-0" />
    </section>
  );
};
