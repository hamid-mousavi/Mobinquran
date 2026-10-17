مراحل (به همین ترتیب):

۱) فایل‌های این پوشه را روی پروژه کپی کنید (جایگزین فایل‌های هم‌نام).
   فایل قدیمی public/data/mushaf-layout-v1.json را حذف کنید.

۲) از ریپوی quran-qcf4 پوشهٔ fonts-woff2 را بگیرید و ۴۷ فایل QCF4_Hafs_NN_W.woff2 را
   در public/fonts/qcf4/ بگذارید (QCF4_QBSML لازم نیست).

۳) در ریشهٔ پروژه، با اینترنت:
   node scripts/generate-mushaf-layout.mjs --repo="مسیر پوشهٔ quran-qcf4"     # دادهٔ خام + گلیف‌ها → scripts/raw/
   node scripts/fix-mushaf-text.mjs            # اصلاح متن → public/data/mushaf-layout-v2.json
   node scripts/build-qcf4-manifest.mjs        # حجم فایل‌ها → public/fonts/qcf4/manifest.json

۴) npm run check   و بعد دیپلوی.

تا قبل از قدم ۲ و ۳ برنامه مثل مرحلهٔ ۱ کار می‌کند (بدون پیشنهاد دانلود).
