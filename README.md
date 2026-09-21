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
