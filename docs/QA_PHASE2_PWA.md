# گزارش آزمون و صحه‌گذاری فاز ۲ (PWA و Service Worker)

**تاریخ اجرا:** ۲۱ سپتامبر ۲۰۲۶  
**پروژه:** قرآن مبین (Quran Mobin)  
**نسخه:** PWA 1.3.0  
**محیط اجرا:** Vite 8.3 + Workbox + Vitest  

---

## ۱. خلاصه نتایج آزمون‌های خودکار

کلیهٔ آزمون‌های واحد و صحه‌گذاری فاز ۲ در مجموعهٔ `src/test/pwa-offline.test.ts`، `src/test/quran-core.test.ts` و `src/test/search-normalization.test.ts` با موفقیت ۱۰۰٪ پاس شدند:

```text
✓ src/test/search-normalization.test.ts (8 tests)
✓ src/test/pwa-offline.test.ts (5 tests)
✓ src/test/quran-core.test.ts (7 tests)
Test Files  3 passed (3)
Tests       20 passed (20)
```

---

## ۲. بررسی موارد وظایف فاز ۲ (Checklist)

| کد وظیفه | عنوان | وضعیت | شواهد و جزئیات پیاده‌سازی |
|---|---|---|---|
| **P2-T1** | بازنویسی Service Worker با Workbox و `vite-plugin-pwa` | ✅ تکمیل شد | پلاگین `VitePWA` در `vite.config.ts` با سیاست `NetworkOnly` برای `/api/` و `CacheFirst` برای `/fonts/`، `/data/` و تصاویر؛ پیش‌کش (Precache) خودکار تمام ۲۷ فایل استاتیک و بستهٔ داده در زمان build. |
| **P2-T2** | چرخهٔ به‌روزرسانی بدون رفرش ناخواسته | ✅ تکمیل شد | حذف فراخوانی‌های مخرب `skipWaiting()` و `location.reload()` از `main.tsx`؛ پیاده‌سازی `src/services/pwaManager.ts` و کامپوننت `PWAUpdateBanner.tsx` با کنترل وضعیت پخش صوت. |
| **P2-T3** | خودمیزبان‌سازی کامل فونت‌ها و حذف CDN | ✅ تکمیل شد | حذف کامل تگ‌های `fonts.googleapis.com` و `fonts.gstatic.com` از `index.html`؛ خودمیزبانی فونت‌های Vazirmatn، Amiri Quran، UthmanTaha و KFGQPC-Hafs در `/public/fonts/` با `font-display: swap`؛ ثبت کامل مجوزها در `docs/CONTENT_SOURCES.md`. |
| **P2-T4** | استانداردسازی مانیفست و آیکون‌های Maskable | ✅ تکمیل شد | ساخت آیکون‌های استاندارد ماسکبل با حاشیه امن ۲۰٪ (`icon-maskable-192.png` و `icon-maskable-512.png`)؛ حذف فایل تکراری `icon.png`؛ افزودن میانبرهای سریع (سوره یس، واقعه، جستجو، ختم) به `manifest.json`. |
| **P2-T5** | مدیریت ماندگاری حافظه (`persist` و `estimate`) | ✅ تکمیل شد | افزودن توابع `getStorageStatus` و `requestStoragePersistence`؛ نمایش حجم مصرفی و سهمیهٔ کل در `SettingsModal` و `OfflineDownloadModal` همراه با دکمه درخواست ثبت حافظهٔ پایدار. |
| **P2-T6** | سناریوهای آفلاین و معیارهای پذیرش | ✅ تکمیل شد | تست‌های خودکار پوشش مانیفست، دارایی‌ها، فونت‌های محلی و عدم وجود پیوندهای خارجی را تضمین می‌کنند. |

---

## ۳. سناریوی آزمون آفلاین (Offline Acceptance Test)

1. **بازدید اولیه:**
   - کاربر برای نخستین بار صفحه را باز می‌کند.
   - بستهٔ آیات قرآن (`/data/quran-core-v1.json`) و دارایی‌های برنامه و فونت‌ها به‌طور خودکار در کش Workbox قرار می‌گیرند.
2. **قطع شبکه (حالت پرواز / Airplane Mode):**
   - اتصال اینترنت دستگاه قطع می‌شود.
   - نوار وضعیت آفلاین با پیام «حالت آفلاین — استفاده از داده‌های ذخیره‌شده دستگاه» فعال می‌گردد.
   - کاربر می‌تواند بدون هیچ خطایی بین سوره‌ها ناوبری کند، جستجو کند و بدون وابستگی به سرورهای خارجی از قرآن کریم استفاده نماید.
3. **به‌روزرسانی نامحسوس:**
   - با انتشار نسخه جدید، بنر «نسخهٔ جدید آماده است — اعمال» نمایش می‌یابد و تا زمان تأیید کاربر یا پایان صوت، پخش کاربر قطع نمی‌گردد.
