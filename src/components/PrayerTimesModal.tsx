import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Compass,
  MapPin,
  Clock,
  Search,
  Crosshair,
  Sunrise,
  Sun,
  Sunset,
  Moon,
  Info,
  Check,
  Volume2,
  CheckCircle2,
  AlertCircle,
  Navigation,
} from 'lucide-react';
import {
  CityInfo,
  PrayerTimes,
  calculatePrayerTimes,
  getNextPrayer,
  calculateQiblaDirection,
  searchCities,
  getSavedCity,
  saveSelectedCity,
  getSavedCustomCoords,
  detectUserLocation,
  Coordinates,
  CITIES_LIST,
  PROVINCES_LIST,
} from '../services/prayerTimesService';
import { toPersianDigits } from '../utils/textNormalization';
import { AzanSettingsSection } from './AzanSettingsSection';

export type PrayerModalTab = 'times' | 'azan' | 'qibla' | 'cities';

interface PrayerTimesModalProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  initialTab?: PrayerModalTab;
}

const PRAYER_NAMES: Record<string, string> = {
  fajr: 'اذان صبح',
  sunrise: 'طلوع آفتاب',
  dhuhr: 'اذان ظهر',
  sunset: 'غروب آفتاب',
  maghrib: 'اذان مغرب',
  midnight: 'نیمه‌شب شرعی',
};

const PRAYER_DETAILS: Record<string, { icon: any; desc: string }> = {
  fajr: { icon: Sunrise, desc: 'طلوع فجر صادق و آغاز وقت نماز صبح' },
  sunrise: { icon: Sun, desc: 'پایان وقت نماز صبح و برآمدن خورشید' },
  dhuhr: { icon: Sun, desc: 'زوال ظهر و هنگام نماز ظهر و عصر' },
  sunset: { icon: Sunset, desc: 'ناپدید شدن قرص خورشید در افق مغرب' },
  maghrib: { icon: Sunset, desc: 'اذان مغرب و زوال حمره مشرقیه' },
  midnight: { icon: Moon, desc: 'پایان وقت ادای نماز عشاء و میانه شب شرعی' },
};

export const PrayerTimesModal: React.FC<PrayerTimesModalProps> = ({
  isOpen,
  onClose,
  darkMode,
  initialTab = 'times',
}) => {
  const [city, setCity] = useState<CityInfo>(getSavedCity());
  const [customCoords, setCustomCoords] = useState(getSavedCustomCoords());
  const [citySearch, setCitySearch] = useState('');
  const [selectedProvince, setSelectedProvince] = useState<string>('همه');
  const [activeTab, setActiveTab] = useState<PrayerModalTab>(initialTab);
  const [now, setNow] = useState<Date>(new Date());
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);
  const [liveCompassMode, setLiveCompassMode] = useState<boolean>(true);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsMessage, setGpsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // هماهنگ‌سازی تب با initialTab هنگام باز شدن
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setGpsMessage(null);
    }
  }, [isOpen, initialTab]);

  // ثانیه‌شمار برای شمارش معکوس زنده
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // سنسور قطب‌نما و جهت‌یابی گوشی
  useEffect(() => {
    if (!isOpen || activeTab !== 'qibla') return;

    const handleOrientation = (e: any) => {
      if (typeof e.webkitCompassHeading === 'number') {
        // iOS Safari: webkitCompassHeading جهت مغناطیسی مستقیم قطب‌نما است
        setDeviceHeading(Math.round(e.webkitCompassHeading));
      } else if (e.absolute === true && typeof e.alpha === 'number') {
        // Android Chrome Absolute
        const heading = (360 - e.alpha) % 360;
        setDeviceHeading(Math.round(heading));
      } else if (typeof e.alpha === 'number') {
        const heading = (360 - e.alpha) % 360;
        setDeviceHeading(Math.round(heading));
      }
    };

    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientationabsolute' as any, handleOrientation, true);
      window.addEventListener('deviceorientation', handleOrientation, true);
    }

    return () => {
      window.removeEventListener('deviceorientationabsolute' as any, handleOrientation, true);
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [isOpen, activeTab]);

  const requestCompassSensorPermission = async () => {
    if (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof (DeviceOrientationEvent as any).requestPermission === 'function'
    ) {
      try {
        const res = await (DeviceOrientationEvent as any).requestPermission();
        if (res === 'granted') {
          setLiveCompassMode(true);
        }
      } catch {}
    } else {
      setLiveCompassMode(true);
    }
  };

  // محاسبه اوقات شرعی بر مبنای شهر یا مختصات دستی
  const effectiveCoords = useMemo(() => {
    if (customCoords) {
      return {
        latitude: customCoords.latitude,
        longitude: customCoords.longitude,
        elevation: customCoords.elevation || 0,
      };
    }
    return {
      latitude: city.latitude,
      longitude: city.longitude,
      elevation: city.elevation,
    };
  }, [city, customCoords]);

  const prayerTimes: PrayerTimes = useMemo(() => {
    return calculatePrayerTimes(effectiveCoords, now);
  }, [now, effectiveCoords]);

  const nextPrayer = useMemo(() => {
    return getNextPrayer(prayerTimes, now);
  }, [prayerTimes, now]);

  // زاویه دقیق قبله (درجه از شمال در جهت عقربه‌های ساعت)
  const qiblaAngle = useMemo(() => {
    return calculateQiblaDirection(effectiveCoords.latitude, effectiveCoords.longitude);
  }, [effectiveCoords]);

  const qiblaSouthDeviation = useMemo(() => {
    const dev = qiblaAngle - 180;
    return Math.round(dev * 10) / 10;
  }, [qiblaAngle]);

  // انحراف مطلق گوشی از قبله
  const deltaDegrees = useMemo(() => {
    if (deviceHeading === null) return null;
    const diff = Math.abs(((deviceHeading - qiblaAngle + 540) % 360) - 180);
    return Math.round(diff);
  }, [deviceHeading, qiblaAngle]);

  // رو به قبله بودن (خطای کمتر از ۴ درجه)
  const isFacingQibla = deltaDegrees !== null && deltaDegrees <= 4;

  useEffect(() => {
    if (isFacingQibla && typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([40, 50, 40]);
      } catch {}
    }
  }, [isFacingQibla]);

  const handleGetLocation = async () => {
    setGpsLoading(true);
    setGpsMessage(null);
    try {
      const result = await detectUserLocation();
      setCustomCoords(result.coords);
      setCity(result.matchedCity);
      setGpsMessage({
        type: 'success',
        text: result.message || `موقعیت مکانی شما با موفقیت به عنوان «${result.matchedCity.name}» شناسایی شد.`,
      });
    } catch {
      setGpsMessage({
        type: 'error',
        text: 'مکان‌یاب (GPS) دستگاه خاموش است یا اجازه دسترسی داده نشده است. لطفاً GPS را روشن و تأیید کنید یا نام شهر خود را از کادر زیر جستجو نمایید.',
      });
    } finally {
      setGpsLoading(false);
    }
  };

  const handleSelectCity = (c: CityInfo) => {
    saveSelectedCity(c.id);
    setCity(c);
    setCustomCoords(null);
    setActiveTab('times');
  };

  const filteredCities = useMemo(() => {
    return searchCities(citySearch, selectedProvince);
  }, [citySearch, selectedProvince]);

  if (!isOpen) return null;

  // محاسبات زاویه چرخش دایره قطب‌نما و عقربه قبله در حالت‌های مختلف
  // در حالت زنده: صفحه با -deviceHeading می‌چرخد تا شمال واقعی رو به بالا بماند
  // عقربه قبله رو به (qiblaAngle - deviceHeading) می‌چرخد؛ وقتی رو به قبله باشید عقربه دقیقاً رو به جلو (۰ درجه) قرار می‌گیرد
  const dialRotation = liveCompassMode && deviceHeading !== null ? -deviceHeading : 0;
  const needleRotation =
    liveCompassMode && deviceHeading !== null
      ? (qiblaAngle - deviceHeading + 360) % 360
      : qiblaAngle;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs animate-fadeIn select-none"
      onClick={onClose}
      dir="rtl"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-xl bg-white dark:bg-slate-900 h-full sm:h-[90vh] max-h-screen sm:max-h-[90vh] rounded-none sm:rounded-3xl shadow-2xl border border-stone-200 dark:border-slate-800 flex flex-col overflow-hidden animate-slideUp"
      >
        {/* ۱. سربرگ مودال */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-stone-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                اوقات شرعی، اذان و قبله‌نما
              </h2>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                محاسبه آفلاین، نوای مؤذنان شیعه و قبله‌نمای دقیق
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-stone-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ۲. چهار زبانه اصلی (Tabs) */}
        <div className="grid grid-cols-4 border-b border-stone-100 dark:border-slate-800 bg-stone-50/70 dark:bg-slate-800/40 p-1 gap-1 text-center shrink-0 w-full min-w-0">
          <button
            onClick={() => setActiveTab('times')}
            className={`py-2 px-1 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer min-w-0 truncate ${
              activeTab === 'times'
                ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">اوقات</span>
          </button>
          <button
            onClick={() => setActiveTab('azan')}
            className={`py-2 px-1 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer min-w-0 truncate ${
              activeTab === 'azan'
                ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">تنظیمات اذان</span>
          </button>
          <button
            onClick={() => setActiveTab('qibla')}
            className={`py-2 px-1 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer min-w-0 truncate ${
              activeTab === 'qibla'
                ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">قبله‌نما</span>
          </button>
          <button
            onClick={() => setActiveTab('cities')}
            className={`py-2 px-1 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer min-w-0 truncate ${
              activeTab === 'cities'
                ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">انتخاب شهر</span>
          </button>
        </div>

        {/* نوار موقعیت فعلی */}
        <div className="flex items-center justify-between px-3.5 py-2 bg-teal-500/10 dark:bg-teal-500/15 border-b border-teal-500/20 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <MapPin className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
            <span className="text-[11px] text-slate-500 dark:text-slate-400">موقعیت:</span>
            <span className="font-bold text-slate-800 dark:text-slate-100 text-xs truncate">
              {customCoords ? 'موقعیت GPS شما' : `${city.name} (${city.province})`}
            </span>
          </div>

          {activeTab !== 'cities' && (
            <button
              onClick={() => setActiveTab('cities')}
              className="text-[11px] text-teal-600 dark:text-teal-400 font-bold hover:underline shrink-0 mr-2 cursor-pointer"
            >
              تغییر شهر
            </button>
          )}
        </div>

        {/* ۳. بدنه محتوا بر اساس تب فعال */}
        {activeTab === 'cities' ? (
          /* تب انتخاب شهر و مکان: ساختار مجزا با اسکرول مستقل جهت جلوگیری قطعی از پوشش کیبورد موبایل */
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white dark:bg-slate-900">
            {/* بخش جستجو و دکمه موقعیت‌یابی پین‌شده در بالا */}
            <div className="p-3 sm:p-4 space-y-2.5 shrink-0 border-b border-stone-100 dark:border-slate-800 bg-stone-50/50 dark:bg-slate-900">
              <button
                onClick={handleGetLocation}
                disabled={gpsLoading}
                className="w-full p-2.5 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/30 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Crosshair className={`w-4 h-4 ${gpsLoading ? 'animate-spin' : ''}`} />
                <span>
                  {gpsLoading ? 'در حال دریافت موقعیت مکانی...' : 'تشخیص موقعیت از مکان‌یاب (GPS)'}
                </span>
              </button>

              {gpsMessage && (
                <div
                  className={`p-2.5 rounded-xl text-xs flex items-start gap-2 ${
                    gpsMessage.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                      : 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 border border-amber-500/20'
                  }`}
                >
                  {gpsMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <span className="leading-relaxed">{gpsMessage.text}</span>
                </div>
              )}

              {/* کادر جستجوی شهر */}
              <div className="relative">
                <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="جستجوی نام شهر، مرکز استان یا شهرستان..."
                  value={citySearch}
                  onChange={(e) => setCitySearch(e.target.value)}
                  className="w-full pr-9 pl-8 py-2 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                />
                {citySearch && (
                  <button
                    onClick={() => setCitySearch('')}
                    className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* فیلتر استان‌ها */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar select-none">
                <button
                  onClick={() => setSelectedProvince('همه')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-all cursor-pointer ${
                    selectedProvince === 'همه'
                      ? 'bg-teal-600 text-white'
                      : 'bg-stone-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  همه ({toPersianDigits(CITIES_LIST.length)})
                </button>
                {PROVINCES_LIST.map((prov) => (
                  <button
                    key={prov}
                    onClick={() => setSelectedProvince(prov)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-all cursor-pointer ${
                      selectedProvince === prov
                        ? 'bg-teal-600 text-white'
                        : 'bg-stone-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {prov}
                  </button>
                ))}
              </div>
            </div>

            {/* فهرست نتایج شهرها - این بخش مستقل از کیبورد اسکرول می‌شود و روی نتایج پوشانده نمی‌شود */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain divide-y divide-stone-100 dark:divide-slate-800">
              {filteredCities.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  شهری با نام «{citySearch}» یافت نشد.
                </div>
              ) : (
                filteredCities.map((c) => {
                  const isSelected = !customCoords && city.id === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => handleSelectCity(c)}
                      className={`w-full flex items-center justify-between p-3.5 text-right hover:bg-stone-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer ${
                        isSelected ? 'bg-teal-50 dark:bg-teal-950/30 font-bold text-teal-700 dark:text-teal-300' : ''
                      }`}
                    >
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                          {c.name}
                        </div>
                        <div className="text-[11px] text-slate-400">استان {c.province}</div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-teal-600 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 sm:p-5 space-y-4 w-full max-w-full">
            {/* ۱. تب اوقات شرعی */}
            {activeTab === 'times' && (
              <div className="space-y-3.5">
                {/* کارت شمارش معکوس نماز بعدی */}
                <div className="relative overflow-hidden p-4 rounded-2xl bg-gradient-to-br from-teal-600 to-teal-800 text-white shadow-md">
                  <div className="relative z-10 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-teal-100/90 font-medium">زمان تا وقت نماز بعدی:</span>
                      <div className="text-lg sm:text-xl font-black mt-0.5">
                        {nextPrayer.name}
                      </div>
                      <div className="text-xs text-teal-100 mt-0.5">
                        ساعت شرعی: {toPersianDigits(nextPrayer.time)}
                      </div>
                    </div>

                    <div className="text-left bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/20">
                      <div className="text-[10px] text-teal-100">مانده:</div>
                      <div className="text-lg sm:text-xl font-black font-mono tracking-wider">
                        {toPersianDigits(nextPrayer.formattedRemaining)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* فهرست اوقات ۶ گانه */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(['fajr', 'sunrise', 'dhuhr', 'sunset', 'maghrib', 'midnight'] as const).map((key) => {
                    const timeStr = prayerTimes[key];
                    const details = PRAYER_DETAILS[key];
                    const Icon = details.icon;
                    const isNext = nextPrayer.key === key;

                    return (
                      <div
                        key={key}
                        className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                          isNext
                            ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-500/50 shadow-xs'
                            : 'bg-stone-50/70 dark:bg-slate-800/40 border-stone-200/60 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isNext
                                ? 'bg-teal-600 text-white'
                                : 'bg-stone-200/70 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100">
                                {PRAYER_NAMES[key]}
                              </span>
                              {isNext && (
                                <span className="text-[9px] font-bold text-teal-700 dark:text-teal-300 bg-teal-500/20 px-1.5 py-0.5 rounded">
                                  در پیش رو
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                              {details.desc}
                            </p>
                          </div>
                        </div>

                        <div className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 shrink-0 mr-2">
                          {toPersianDigits(timeStr)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-slate-800/40 border border-stone-200/60 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400 flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                  <span>
                    محاسبات به صورت ۱۰۰٪ آفلاین بر اساس فرمول رسمی مؤسسه ژئوفیزیک دانشگاه تهران انجام شده است.
                  </span>
                </div>
              </div>
            )}

            {/* ۲. تب تنظیمات اذان (فشرده و بدون کارت‌های حجیم) */}
            {activeTab === 'azan' && <AzanSettingsSection darkMode={darkMode} />}

            {/* ۳. تب قبله‌نما با قبله‌نمای دقیق ریاضی SVG و سنسور */}
            {activeTab === 'qibla' && (
              <div className="space-y-3.5 flex flex-col items-center">
                {/* دکمه‌های سوئیچ حالت قطب‌نما */}
                <div className="w-full flex items-center justify-between p-1 rounded-xl bg-stone-100 dark:bg-slate-800 text-xs">
                  <button
                    onClick={() => {
                      setLiveCompassMode(true);
                      requestCompassSensorPermission();
                    }}
                    className={`flex-1 py-1.5 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      liveCompassMode
                        ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                    }`}
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>قطب‌نمای چرخان زنده</span>
                  </button>
                  <button
                    onClick={() => setLiveCompassMode(false)}
                    className={`flex-1 py-1.5 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      !liveCompassMode
                        ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                    }`}
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>نمای ثابت (شمال بالا)</span>
                  </button>
                </div>

                {/* بنر تطبیق دقیق با قبله */}
                {isFacingQibla && (
                  <div className="px-4 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg animate-bounce">
                    <span>🕋 شما هم‌اکنون دقیقاً رو به قبله هستید!</span>
                  </div>
                )}

                {/* صفحه قبله‌نما (SVG مهندسی‌شده با دقت بالا) */}
                <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
                  <svg
                    viewBox="0 0 260 260"
                    className="w-full h-full drop-shadow-xl"
                  >
                    <defs>
                      {/* گرادیان پس‌زمینه قطب‌نما */}
                      <radialGradient id="dialBg" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor={darkMode ? '#1e293b' : '#ffffff'} />
                        <stop offset="85%" stopColor={darkMode ? '#0f172a' : '#f1f5f9'} />
                        <stop offset="100%" stopColor={darkMode ? '#020617' : '#e2e8f0'} />
                      </radialGradient>
                      {/* گرادیان عقربه قبله */}
                      <linearGradient id="qiblaNeedleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#0d9488" />
                        <stop offset="50%" stopColor="#14b8a6" />
                        <stop offset="100%" stopColor="#0f766e" />
                      </linearGradient>
                      {/* گرادیان عقربه شمال */}
                      <linearGradient id="northNeedleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#ef4444" />
                        <stop offset="100%" stopColor="#b91c1c" />
                      </linearGradient>
                    </defs>

                    {/* حلقه بیرونی طلایی / نقره‌ای */}
                    <circle
                      cx="130"
                      cy="130"
                      r="126"
                      fill="url(#dialBg)"
                      stroke={isFacingQibla ? '#10b981' : '#14b8a6'}
                      strokeWidth={isFacingQibla ? '4' : '2.5'}
                      className="transition-colors duration-300"
                    />

                    {/* دایره مدرج مدرج ۳۶۰ درجه که در حالت زنده می‌چرخد */}
                    <g transform={`rotate(${dialRotation} 130 130)`} className="transition-transform duration-300 ease-out">
                      {/* خطوط درجه‌بندی هر ۳۰ درجه */}
                      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
                        <g key={deg} transform={`rotate(${deg} 130 130)`}>
                          <line
                            x1="130"
                            y1="10"
                            x2="130"
                            y2={deg % 90 === 0 ? '22' : '16'}
                            stroke={deg % 90 === 0 ? '#0d9488' : '#94a3b8'}
                            strokeWidth={deg % 90 === 0 ? '2.5' : '1'}
                          />
                        </g>
                      ))}

                      {/* نوشته‌های ۴ جهت اصلی */}
                      {/* شمال ۰° */}
                      <text
                        x="130"
                        y="34"
                        textAnchor="middle"
                        fill="#ef4444"
                        fontSize="11"
                        fontWeight="900"
                      >
                        N شمال ۰°
                      </text>

                      {/* شرق ۹۰° (سمت راست دایره) */}
                      <text
                        x="232"
                        y="134"
                        textAnchor="middle"
                        fill={darkMode ? '#cbd5e1' : '#475569'}
                        fontSize="10"
                        fontWeight="bold"
                      >
                        E ۹۰°
                      </text>

                      {/* جنوب ۱۸۰° */}
                      <text
                        x="130"
                        y="238"
                        textAnchor="middle"
                        fill={darkMode ? '#cbd5e1' : '#475569'}
                        fontSize="10"
                        fontWeight="bold"
                      >
                        S جنوب ۱۸۰°
                      </text>

                      {/* غرب ۲۷۰° (سمت چپ دایره) */}
                      <text
                        x="28"
                        y="134"
                        textAnchor="middle"
                        fill={darkMode ? '#cbd5e1' : '#475569'}
                        fontSize="10"
                        fontWeight="bold"
                      >
                        W ۲۷۰°
                      </text>

                      {/* موقعیت کعبه روی لبه مدرج دایره */}
                      <g transform={`rotate(${qiblaAngle} 130 130)`}>
                        <circle cx="130" cy="18" r="9" fill="#0d9488" stroke="#f59e0b" strokeWidth="2" />
                        <text x="130" y="22" textAnchor="middle" fontSize="10">
                          🕋
                        </text>
                      </g>
                    </g>

                    {/* عقربه شمال (در حالت زنده رو به شمال می‌چرخد) */}
                    <g transform={`rotate(${dialRotation} 130 130)`} opacity={liveCompassMode ? 0.8 : 0.4}>
                      <polygon points="130,48 134,130 126,130" fill="url(#northNeedleGrad)" />
                    </g>

                    {/* عقربه اصلی قبله‌نما (رو به کعبه) */}
                    <g transform={`rotate(${needleRotation} 130 130)`} className="transition-transform duration-300 ease-out">
                      {/* نوک پیکان قبله */}
                      <polygon
                        points="130,36 142,122 130,114 118,122"
                        fill="url(#qiblaNeedleGrad)"
                        stroke="#f59e0b"
                        strokeWidth="1.5"
                      />
                      {/* ته پیکان قبله (پشت) */}
                      <polygon
                        points="130,130 136,160 130,175 124,160"
                        fill="#64748b"
                        opacity="0.8"
                      />

                      {/* نشان کعبه در نوک عقربه */}
                      <circle cx="130" cy="46" r="11" fill="#0d9488" stroke="#fbbf24" strokeWidth="2" />
                      <text x="130" y="50" textAnchor="middle" fontSize="11">
                        🕋
                      </text>
                    </g>

                    {/* مرکز فلزی قطب‌نما */}
                    <circle cx="130" cy="130" r="16" fill={darkMode ? '#334155' : '#e2e8f0'} stroke="#0d9488" strokeWidth="2" />
                    <circle cx="130" cy="130" r="8" fill="#0d9488" />
                    <circle cx="130" cy="130" r="3" fill="#ffffff" />
                  </svg>

                  {/* نشانگر بالای گوشی در حالت زنده */}
                  {liveCompassMode && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 flex flex-col items-center pointer-events-none z-10">
                      <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[10px] border-t-rose-500 drop-shadow" />
                      <span className="text-[9px] font-bold text-rose-500 bg-white/80 dark:bg-slate-900/80 px-1 rounded -mt-0.5">
                        بالای گوشی
                      </span>
                    </div>
                  )}
                </div>

                {/* اطلاعات آماری زاویه قبله */}
                <div className="text-center space-y-1">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">زاویه قبله از شمال حقیقی:</span>
                    <span className="text-2xl font-black text-teal-600 dark:text-teal-400">
                      {toPersianDigits(qiblaAngle)}°
                    </span>
                  </div>
                  <div className="flex items-center justify-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 font-bold">
                    <span>جهت: <b>جنوب‌غربی</b></span>
                    <span>•</span>
                    <span>انحراف از جنوب: <b>{toPersianDigits(qiblaSouthDeviation)}° به سمت غرب</b></span>
                  </div>

                  {liveCompassMode && deviceHeading !== null && (
                    <div className="text-[11px] text-teal-700 dark:text-teal-300 font-medium pt-1">
                      جهت فعلی گوشی: {toPersianDigits(deviceHeading)}° | انحراف تا قبله:{' '}
                      {deltaDegrees !== null ? `${toPersianDigits(deltaDegrees)}°` : '—'}
                    </div>
                  )}
                </div>

                {/* راهنمای کاربردی نحوه ایستادن */}
                <div className="p-3 rounded-xl bg-stone-50 dark:bg-slate-800/50 border border-stone-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 text-center max-w-sm space-y-1">
                  {liveCompassMode && deviceHeading !== null ? (
                    <p className="text-[11px]">
                      دستگاه را بچرخانید تا نشانگر <b>🕋</b> دقیقاً به سمت <b>بالای گوشی</b> (روبروی شما) قرار گیرد.
                    </p>
                  ) : (
                    <p className="text-[11px] leading-relaxed">
                      رو به جنوب بایستید؛ سپس به اندازه <b>{toPersianDigits(qiblaSouthDeviation)} درجه به سمت راست (غرب)</b> متمایل شوید تا دقیقاً رو به قبله قرار گیرید.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
