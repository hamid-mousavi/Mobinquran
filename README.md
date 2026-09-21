<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/19772b4f-bc6b-4d10-b101-596b7337b8ce

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set your AI keys in [.env.local](.env.local):
   - `GROQ_API_KEY` (پیش‌فرض — سرویس سریع و رایگان Groq از [console.groq.com](https://console.groq.com))
   - `OPENROUTER_API_KEY` (اختیاری — از [openrouter.ai/keys](https://openrouter.ai/keys))
   - `DEEPSEEK_API_KEY` (اختیاری — سرویس مستقیم DeepSeek از [platform.deepseek.com](https://platform.deepseek.com))

   کاربران همچنین می‌توانند کلید شخصی خودشان را از داخل برنامه، در مودال «دستیار هوشمند تدبّر» وارد کنند (روی همین دستگاه ذخیره می‌شود).
3. Run the app:
   `npm run dev`

## Deploy on Vercel

پروژه برای Vercel سازگار شده است: سایت (خروجی `vite build` در `dist/`) بهصورت استاتیک و اندپوینتهای `/api/*` بهصورت تابع سرورلس (`api/index.ts`) استقرار مییابند.

1. پروژه را به Git و سپس به Vercel وصل کنید (Framework Preset: **Vite**؛ نیازی به تنظیم `buildCommand` و `outputDirectory` نیست چون در `vercel.json` تعریف شده).
2. در Vercel: **Project → Settings → Environment Variables** برای هر محیط (Production/Preview) اضافه کنید:
   - `GROQ_API_KEY` (پیشفرض)
   - `OPENROUTER_API_KEY` (اختیاری)
   - `DEEPSEEK_API_KEY` (اختیاری)
3. Deploy کنید. متغیرها هنگام اجرا در `process.env` تابع سرورلس قرار میگیرند (فایل `.env.local` فقط برای اجرای محلی است و هرگز به Vercel فرستاده نمیشود).

نکته: در `vercel.json` بازنویسی SPA تعریف شده (`/(.*)` → `/index.html`) و پیش از آن `/api/*` به تابع سرورلس هدایت میشود.
