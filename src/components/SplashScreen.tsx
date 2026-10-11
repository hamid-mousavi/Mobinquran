import React, { useState, useEffect } from 'react';
import { Sparkles, Heart } from 'lucide-react';

interface SplashScreenProps {
  onFinish: () => void;
  darkMode: boolean;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish, darkMode }) => {
  // مراحل انیمیشن:
  // 0: ورود آرام با هاله نور
  // 1: نمایش آیکون قرآن مبین
  // 2: پیوند و ظهور نشان متبرک موکب حضرت فاطمه الزهرا (س)
  // 3: اتحاد هر دو نشان و خروج نرم
  const [stage, setStage] = useState<number>(0);

  useEffect(() => {
    // توالی زمانی انیمیشن‌های معنوی
    const t1 = setTimeout(() => setStage(1), 250);
    const t2 = setTimeout(() => setStage(2), 1600);
    const t3 = setTimeout(() => setStage(3), 3200);
    const t4 = setTimeout(() => onFinish(), 4000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [onFinish]);

  return (
    <div
      id="mobin-splash-screen"
      dir="rtl"
      className="fixed inset-0 z-[200] flex flex-col items-center justify-between p-6 sm:p-10 bg-gradient-to-b from-teal-950 via-slate-950 to-slate-950 text-white select-none overflow-hidden"
    >
      {/* دکمه رد شدن سریع (Skip) در گوشه بالا */}
      <div className="w-full flex justify-end items-center max-w-md z-20">
        <button
          onClick={onFinish}
          className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-stone-300 hover:text-white text-xs font-bold transition-all backdrop-blur-md border border-white/10 cursor-pointer"
        >
          ورود به برنامه (رد شدن)
        </button>
      </div>

      {/* ذرات و جلوه‌های پس‌زمینه معنوی */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* هاله نور طلایی و سبز در مرکز */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] sm:w-[460px] h-[340px] sm:h-[460px] bg-gradient-to-tr from-teal-500/20 via-emerald-500/15 to-amber-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-amber-400/10 rounded-full blur-2xl" />
      </div>

      {/* محتوای مرکزی با انیمیشن‌های تدریجی */}
      <div className="relative z-10 flex flex-col items-center justify-center my-auto w-full max-w-sm text-center">
        {/* بخش نشان‌ها */}
        <div className="relative flex items-center justify-center min-h-[190px] w-full">
          {/* حالت مرحله ۱: آیکون قرآن مبین به صورت تکی */}
          {stage === 1 && (
            <div className="flex flex-col items-center animate-fadeIn transform transition-all duration-700">
              <div className="relative group">
                <div className="absolute -inset-3 bg-gradient-to-r from-teal-500 to-amber-400 rounded-3xl blur-lg opacity-40 animate-pulse" />
                <img
                  src="/quran-logo-cropped.png"
                  alt="قرآن مبین"
                  className="relative w-28 h-28 sm:w-32 sm:h-32 object-contain rounded-3xl shadow-2xl border-2 border-amber-400/40"
                />
              </div>
              <h1 className="mt-4 text-2xl sm:text-3xl font-black text-amber-300 drop-shadow-md">
                قرآن مبین
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-emerald-200/90 font-medium font-['UthmanTaha'] text-stone-300">
                «كِتَابٌ أَنزَلْنَاهُ إِلَيْكَ مُبَارَكٌ لِّيَدَّبَّرُوا آيَاتِهِ»
              </p>
            </div>
          )}

          {/* حالت مرحله ۲ و ۳: ظهور با شکوه نشان موکب فاطمه‌الزهرا (س) در کنار قرآن مبین */}
          {stage >= 2 && (
            <div className="flex flex-col items-center animate-fadeIn transition-all duration-700">
              <div className="flex items-center justify-center gap-4 sm:gap-6">
                {/* آیکون برنامه بدون کادر اضافه */}
                <div className="flex flex-col items-center transform hover:scale-105 transition-transform">
                  <div className="relative">
                    <div className="absolute -inset-2 bg-teal-500/30 rounded-2xl blur-md" />
                    <img
                      src="/quran-logo-cropped.png"
                      alt="قرآن مبین"
                      className="relative w-20 h-20 sm:w-24 sm:h-24 object-contain rounded-2xl shadow-xl border border-teal-400/40"
                    />
                  </div>
                  <span className="mt-2 text-xs font-bold text-teal-300">قرآن مبین</span>
                </div>

                {/* نماد پیوند معنوی */}
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-teal-500 p-0.5 shadow-md flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white animate-spin" style={{ animationDuration: '6s' }} />
                  </div>
                </div>

                {/* نشان متبرک موکب حضرت فاطمه‌الزهرا (سلام‌الله‌علیها) */}
                <div className="flex flex-col items-center transform hover:scale-105 transition-transform">
                  <div className="relative">
                    <div className="absolute -inset-2 bg-gradient-to-r from-emerald-500 to-amber-500 rounded-2xl blur-md opacity-60" />
                    <img
                      src="/mokeb-logo.jpg"
                      alt="موکب حضرت فاطمه الزهرا (س)"
                      className="relative w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-2xl shadow-xl border-2 border-amber-400/60"
                    />
                  </div>
                  <span className="mt-2 text-xs font-bold text-amber-300">موکب فاطمه‌الزهرا (س)</span>
                </div>
              </div>

              {/* متن اختصاصی موکب */}
              <div className="mt-5 space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-[11px] sm:text-xs font-bold text-emerald-300">
                  <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400/50" />
                  <span>موکب حضرت فاطمه‌الزهرا (سلام‌الله‌علیها)</span>
                </div>
                <p className="text-xs text-stone-300 leading-relaxed font-medium">
                  نذرِ ترویج معارف قرآن کریم و کلام وحی
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* بخش پایین اسپلش */}
      <div className="relative z-10 flex flex-col items-center gap-2 text-center text-[11px] text-stone-400">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-medium text-stone-300">در حال بارگذاری کلام وحی و اوقات شرعی...</span>
        </div>
        <p className="text-[10px] text-stone-500">
          نسخهٔ آفلاین با رسم‌الخط عثمان طه و ترتیل قاریان برجسته
        </p>
      </div>
    </div>
  );
};
