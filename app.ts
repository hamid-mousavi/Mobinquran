import express from 'express';
import path from 'path';
import fs from 'node:fs';
import { GoogleGenAI } from '@google/genai';
import { randomUUID } from 'node:crypto';
import { aiAskRequestSchema, aiResponseSchema, extractJsonObject } from './src/services/aiContract';
import { generateWithFallback, hasConfiguredProvider, ProviderError } from './server/aiProviders';
import { consumeDailyQuota, hashRateLimitKey } from './server/aiRateLimit';
import { detectIntent } from './src/services/aiAgent/intentDetector';
import { createQuranSource, createTafsirMizanSource } from './src/services/aiAgent/sourceResolver';
import { SourceItem } from './src/services/aiAgent/types';

function getEnvKey(name: string): string {
  return (process.env[name] || '').trim();
}

function isAiEnabled(): boolean {
  const configured = getEnvKey('AI_ENABLED').toLowerCase();
  return configured !== 'false';
}

// ساخت اپلیکیشن Express با تمام اندپوینت‌های API (برای اجرای محلی و تابع سرورلس Vercel مشترک است)
export function createApp() {
  const app = express();

  app.use(express.json({ limit: '24kb' }));

  // اندپوینت سلامتی سرور
  app.get(['/api/health', '/health'], (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // سرویس استاندارد منیفست PWA با هدر اختصاصی application/manifest+json جهت پذیرش بدون نقص توسط کروم
  app.get('/manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.sendFile(path.join(process.cwd(), 'public', 'manifest.json'));
  });

  // سرویس استاندارد Service Worker PWA با هدر اختصاصی application/javascript جهت پذیرش بدون نقص توسط کروم و رفع مشکل شورت‌کات
  app.get(['/sw.js', '/dev-dist/sw.js'], (req, res) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Service-Worker-Allowed', '/');
    const devPath = path.join(process.cwd(), 'dev-dist', 'sw.js');
    const distPath = path.join(process.cwd(), 'dist', 'sw.js');
    const publicPath = path.join(process.cwd(), 'public', 'sw.js');
    if (fs.existsSync(devPath)) {
      return res.sendFile(devPath);
    } else if (fs.existsSync(distPath)) {
      return res.sendFile(distPath);
    } else if (fs.existsSync(publicPath)) {
      return res.sendFile(publicPath);
    }
    res.send(`
      self.addEventListener('install', (e) => self.skipWaiting());
      self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));
      self.addEventListener('fetch', (e) => {});
    `);
  });

  // فایل‌های کمکی Workbox در محیط توسعه
  app.use('/dev-dist', express.static(path.join(process.cwd(), 'dev-dist')));

  // پروکسی استریم فایل‌های صوتی قرآن جهت رفع مشکل فیلترینگ و عدم نیاز به فیلترشکن
  app.get(['/api/audio/proxy', '/audio/proxy'], async (req, res) => {
    const targetUrl = (req.query.url as string || '').trim();
    if (!targetUrl || !targetUrl.startsWith('https://')) {
      return res.status(400).send('Invalid audio URL');
    }

    const allowedHosts = [
      'everyayah.com',
      'www.everyayah.com',
      'islamic.network',
      'cdn.islamic.network',
      'huggingface.co',
      'qurancdn.com',
      'verses.quran.com',
      'quranicaudio.com',
      'download.quranicaudio.com',
    ];

    try {
      const parsed = new URL(targetUrl);
      const isAllowed = allowedHosts.some((h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`));
      if (!isAllowed) {
        return res.status(403).send('Audio host not permitted');
      }

      const audioRes = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'QuranMobinApp/2.0 (AudioProxy)',
          ...(req.headers.range ? { Range: req.headers.range } : {}),
        },
      });

      if (!audioRes.ok || !audioRes.body) {
        return res.status(audioRes.status).send('Failed to fetch audio stream');
      }

      res.status(audioRes.status);
      res.setHeader('Content-Type', audioRes.headers.get('content-type') || 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
      res.setHeader('Access-Control-Allow-Origin', '*');

      const contentLength = audioRes.headers.get('content-length');
      if (contentLength) res.setHeader('Content-Length', contentLength);
      const contentRange = audioRes.headers.get('content-range');
      if (contentRange) res.setHeader('Content-Range', contentRange);
      const acceptRanges = audioRes.headers.get('accept-ranges');
      if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);

      const reader = audioRes.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } catch (err: any) {
      console.warn('Audio proxy error:', err?.message || err);
      if (!res.headersSent) {
        res.status(502).send('Error streaming audio');
      }
    }
  });

  // وضعیت سرویس‌های هوش مصنوعی (بر اساس P0-T5 فقط اعلام فعال بودن کلی)
  app.get(['/api/ai/status', '/ai/status'], (req, res) => {
    res.json({
      enabled: isAiEnabled() && !['1', 'true'].includes(getEnvKey('AI_KILL_SWITCH').toLowerCase()) && hasConfiguredProvider(),
    });
  });

  // RAG endpoint: the model may select only candidate references; verse text is never returned by the model.
  app.post(['/api/ai/ask', '/ai/ask'], async (req, res) => {
    const requestId = randomUUID();
    const parsed = aiAskRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'درخواست دستیار معتبر نیست.', code: 'invalid_request', requestId });
    }

    if (!isAiEnabled() || ['1', 'true'].includes(getEnvKey('AI_KILL_SWITCH').toLowerCase())) {
      return res.status(503).json({ error: 'دستیار هوشمند در دسترس نیست.', code: 'ai_unavailable', requestId });
    }
    if (!hasConfiguredProvider()) {
      return res.status(503).json({ error: 'دستیار هوشمند در دسترس نیست.', code: 'ai_unavailable', requestId });
    }

    const forwardedIp = req.header('x-forwarded-for')?.split(',')[0]?.trim();
    const ip = forwardedIp || req.ip || 'unknown';
    const deviceId = (req.header('x-device-id') || '').trim();
    if (deviceId.length < 8 || deviceId.length > 128) {
      return res.status(400).json({ error: 'شناسهٔ دستگاه معتبر نیست.', code: 'invalid_device', requestId });
    }

    const quota = await consumeDailyQuota(hashRateLimitKey(ip, deviceId));
    if (!quota.allowed) {
      const status = quota.used === 0 ? 503 : 429;
      return res.status(status).json({
        error: status === 429 ? 'سهمیهٔ روزانهٔ دستیار تمام شده است.' : 'سرویس سهمیه در دسترس نیست.',
        code: status === 429 ? 'daily_limit_reached' : 'quota_unavailable',
        requestId,
        resetAt: quota.resetAt,
      });
    }

    const userQuestion = parsed.data.question.trim();
    const intent = detectIntent(userQuestion, !!parsed.data.currentVerse);
    const enableWebSearch = false;

    // Sources are related reading links, not claims about what the model used.
    const knownCatalog: SourceItem[] = [];
    if (parsed.data.currentVerse) {
      const sId = parsed.data.currentVerse.surahId;
      const vNum = parsed.data.currentVerse.verseNumber;
      knownCatalog.push(createQuranSource(sId, vNum), createTafsirMizanSource(sId, vNum));
    }

    let verseContext = '';
    if (parsed.data.currentVerse) {
      verseContext = `آیه‌ای که کاربر برای گفتگو انتخاب کرده است (فقط زمینهٔ گفتگو):\n${parsed.data.currentVerse.textArabic || ''}\nترجمهٔ نمایش‌داده‌شده در برنامه: ${parsed.data.currentVerse.translationMakarem || ''}`;
    }

    const historyContext = (parsed.data.history || [])
      .slice(-4)
      .map((m) => `${m.role === 'user' ? 'کاربر' : 'دستیار'}: ${m.content.slice(0, 250)}`)
      .join('\n');

    const agentApproachText = {
      moral: 'رویکرد کاربردی و اخلاقی: در سبک زندگی، آرامش دل، امیدبخشی و اخلاق فردی و اجتماعی متمرکز شو.',
      conceptual: 'رویکرد تدبّر مفهومی: در پیام‌های کلی، پیوند آیه با سایر آموزه‌های قرآن و معارف توحیدی متمرکز شو.',
      literary: 'رویکرد ادبی و واژه‌شناسی: بر وجوه بیانی، تناسب واژه‌ها و پیام‌های عمیق لغوی متمرکز شو.',
      rational: 'رویکرد عقلی و اعتقادی: بر پاسخ‌های استدلالی و باورهای فکری در پرتو آیه متمرکز شو.',
    }[parsed.data.agent || 'moral'];

    const system = `تو «دستیار مرکزی و هوشمند تدبّر در قرآن مبین» هستی.
ویژگی‌های بنیادین: گفت‌وگومحور، صمیمی، دانا، محترم، پاسخ‌های کوتاه و طبیعی، خردورزانه و آرامش‌بخش.
نوع نیاز تشخیص‌داده‌شده (Intent): ${intent}
${agentApproachText}

دستورالعمل‌های بسیار مهم و کلیدی:
۱. رفتار متناسب با نوع درخواست:
- اگر Intent برابر «casual_chat» است (سلام، احوال‌پرسی، تشکر، شوخی، سوال درباره هویت دستیار):
  به هیچ وجه پاسخ طولانی، آیات ناگهانی و متن‌های حجیم ارسال نکن! پاسخی کوتاه، بسیار گرم و صمیمانه بده (مثلاً: «سلام و درود پروردگار بر شما دوست گرامی...») و مشتاقانه بپرس مایل است امروز پیرامون کدام مفهوم، سوره، دغدغه زندگی یا موضوع قرآنی با هم گفتگو کنیم. آرایه used_source_ids را خالی [] بگذار.
- اگر Intent برابر «quran_inquiry» است:
  آزادانه بر پایهٔ دانش خودت پاسخ بده. اگر آیهٔ انتخاب‌شده در زمینه آمده، آن را موضوع گفتگو بدان؛ هیچ متن بازیابی‌شده یا منبعی در اختیار تو نیست. دربارهٔ نقل‌قول دقیق، شماره آیه یا انتساب دیدگاه به مفسر در صورت اطمینان نداشتن ادعای قطعی نکن.
- اگر Intent برابر «current_info» است:
  اگر اطلاعات از دانش خودت کافی نیست یا ممکن است تغییر کرده باشد، محدودیت دانسته‌هایت را شفاف بگو و ادعای جستجوی وب نکن.
- اگر Intent برابر «hybrid» است:
  پیوند موضوع را با مفاهیم معاصر به صورت خردورزانه و روشن تبیین کن، بدون ادعای دسترسی به منبع بیرونی.

۲. پاسخ کوتاه و مستند:
- summary: پاسخ مستقیم و کوتاه به پرسش، حداکثر سه جمله و بر پایهٔ دانش خودت؛ آن را به مفسری نسبت نده مگر کاربر متن مشخصی از او داده باشد.
- direct_answer: خالی بگذار؛ خلاصه در summary کافی است.
- source_quote: خالی بگذار مگر کاربر صریحاً متن آیه یا روایت را خواسته باشد. ترجمه‌ای را که رابط قبلاً نمایش داده تکرار نکن.
- ai_analysis: در صورت نیاز، حداکثر دو جمله تحلیل یا تأمل مستقل ارائه کن؛ روشن باشد برداشت خود هوش مصنوعی است، نه تفسیر رسمی.
- practical_takeaway: خالی بگذار مگر کاربر صریحاً کاربرد عملی خواسته باشد.
- socratic_questions: حداکثر یک پرسش کوتاه، فقط وقتی به گفتگو کمک می‌کند.
- used_source_ids: همیشه آرایهٔ خالی بگذار؛ هیچ منبع بیرونی برای این پاسخ بازیابی نشده است.

۳. قالب خروجی الزامی:
فقط یک شیء JSON معتبر مطابق ساختار زیر بدون هیچ متن اضافی:
{
  "intent": "${intent}",
  "language": "fa",
  "summary": "پاسخ مستقیم کوتاه بر پایه دانش مدل",
  "direct_answer": "",
  "source_quote": "",
  "ai_analysis": "حداکثر دو جمله تحلیل مستقل AI",
  "practical_takeaway": "",
  "socratic_questions": [],
  "used_source_ids": [],
  "confidence": "high",
  "needs_human_scholar": false,
  "disclaimers": ["تولیدشده با هوش مصنوعی؛ جهت فتاوا و احکام شرعی به مراجع عظام رجوع فرمایید."]
}`;
    const user = `${historyContext ? `تاریخچه گفتگو:\n${historyContext}\n\n` : ''}پرسش کاربر:\n${userQuestion}${verseContext ? `\n\n${verseContext}` : ''}`;

    try {
      let generated = await generateWithFallback({
        system,
        user,
        maxTokens: 800,
        enableWebSearch,
      });
      let output = aiResponseSchema.safeParse(extractJsonObject(generated.content));

      if (!output.success) {
        generated = await generateWithFallback({
          system,
          user: `پاسخ قبلی با قرارداد خروجی سازگار نبود. این خطاها را اصلاح کن و فقط JSON معتبر برگردان: ${output.error.issues.map((issue) => `${issue.path.join('.') || 'response'} (${issue.code})`).join(', ')}\nپاسخ قبلی:\n${generated.content}`,
          maxTokens: 800,
          enableWebSearch,
        });
        output = aiResponseSchema.safeParse(extractJsonObject(generated.content));
      }

      if (!output.success) {
        console.warn(JSON.stringify({
          event: 'ai_structured_output_invalid',
          requestId,
          issues: output.error.issues.map((issue) => ({ path: issue.path.join('.'), code: issue.code })),
        }));
        return res.status(502).json({ error: 'پاسخ ساخت‌یافتهٔ دستیار معتبر نبود.', code: 'invalid_model_output', requestId });
      }

      console.info(JSON.stringify({ event: 'ai_request', requestId, provider: generated.provider, used: quota.used, intent }));
      return res.json({
        ...output.data,
        intent,
        sources: knownCatalog,
        requestId,
      });
    } catch (error) {
      const status = error instanceof ProviderError && error.status === 429 ? 429 : 502;
      const provider = error instanceof ProviderError ? error.provider : undefined;
      const providerStatus = error instanceof ProviderError ? error.status : undefined;
      console.warn(JSON.stringify({ event: 'ai_provider_error', requestId, status, provider, providerStatus }));
      return res.status(status).json({
        error: status === 429 ? 'سرویس هوش مصنوعی موقتاً سهمیه ندارد.' : 'ارتباط با دستیار هوشمند برقرار نشد.',
        code: status === 429 ? 'provider_rate_limited' : 'upstream_error',
        provider,
        providerStatus,
        requestId,
      });
    }
  });

  // حافظه موقت کش سوره‌ها در سرور
  const surahCache = new Map<number, any[]>();

  // اندپوینت دریافت کامل متن، اعراب و ۳ ترجمه رسمی سوره
  app.get(['/api/quran/surah/:id', '/quran/surah/:id'], async (req, res) => {
    const surahId = parseInt(req.params.id, 10);
    if (isNaN(surahId) || surahId < 1 || surahId > 114) {
      return res.status(400).json({ error: 'شماره سوره باید عددی بین ۱ تا ۱۱۴ باشد.' });
    }

    // اگر در حافظه کش سرور موجود است، فوری تحویل می‌دهیم
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    if (surahCache.has(surahId)) {
      const cached = surahCache.get(surahId)!;
      return res.json({
        surahId,
        count: cached.length,
        fromCache: true,
        verses: cached,
      });
    }

    try {
      const response = await fetch(
        `https://api.alquran.cloud/v1/surah/${surahId}/editions/quran-uthmani,fa.makarem,fa.fooladvand,fa.ansarian`,
        { headers: { 'User-Agent': 'QuranMobinApp/1.0' } }
      );

      if (!response.ok) {
        throw new Error(`Quran Cloud API responded with status ${response.status}`);
      }

      const json = await response.json();
      if (!json.data || !Array.isArray(json.data) || json.data.length < 4) {
        throw new Error('ساختار اطلاعات دریافتی نامعتبر است.');
      }

      const [uthmaniEd, makaremEd, fooladvandEd, ansarianEd] = json.data;
      const ayahsCount = uthmaniEd.ayahs.length;
      const verses: any[] = [];

      for (let i = 0; i < ayahsCount; i++) {
        const uAyah = uthmaniEd.ayahs[i];
        const mAyah = makaremEd.ayahs[i] || {};
        const fAyah = fooladvandEd.ayahs[i] || {};
        const aAyah = ansarianEd.ayahs[i] || {};

        let textArabic = uAyah.text || '';
        // پاکسازی کاراکترهای نامرئی BOM یا فضای خالی ابتدا
        textArabic = textArabic.replace(/^[\uFEFF\u200B\s]+/g, '').trim();

        // حذف بسم الله اضافی از ابتدای آیه ۱ در سوره‌های ۲ تا ۱۱۴ (به جز سوره ۹ توبه که بسم‌الله ندارد)
        if (surahId > 1 && uAyah.numberInSurah === 1 && surahId !== 9) {
          textArabic = textArabic.replace(/^بِسْمِ\s+[\u0600-\u06FF\s]+?ٱلرَّحِيمِ\s*/u, '').trim();
          textArabic = textArabic.replace(/^بِسْمِ\s+[\u0600-\u06FF\s]+?الرَّحِيمِ\s*/u, '').trim();
        }

        verses.push({
          id: uAyah.number,
          surahId,
          verseNumber: uAyah.numberInSurah,
          juzNumber: uAyah.juz,
          pageNumber: uAyah.page,
          textArabic,
          translationMakarem: mAyah.text || '',
          translationFooladvand: fAyah.text || '',
          translationAnsarian: aAyah.text || '',
          tafsirNemoneh: `راهنمای تدبّر: این آیه را در پیوند با سیاق سوره و دیگر آیات هم‌موضوع مطالعه کنید. متن مستند تفسیر و ارجاع صفحه در نسخه‌های بعدی افزوده می‌شود.`,
          tafsirMizan: `راهنمای مفهومی: این متن، نقل یا چکیدهٔ مستندِ تفسیر نیست و صرفاً برای هدایت به مطالعهٔ بیشتر نمایش داده می‌شود.`,
          rootWords: []
        });
      }

      // ذخیره در حافظه کش
      surahCache.set(surahId, verses);

      return res.json({
        surahId,
        count: verses.length,
        fromCache: false,
        verses,
      });
    } catch (err: any) {
      console.error(`Error fetching surah ${surahId}:`, err);
      return res.status(502).json({
        error: `خطا در دریافت آیات سوره ${surahId}.`,
        details: err?.message || String(err)
      });
    }
  });

  // حافظه کش جستجوها
  const searchCache = new Map<string, any>();

  // اندپوینت جستجوی پیشرفته در متن عربی، اعراب‌زدایی شده و ترجمه‌ها
  app.get(['/api/quran/search', '/quran/search'], async (req, res) => {
    const rawQuery = (req.query.q as string || '').trim();
    const searchScope = (req.query.scope as string || 'all'); // 'all' | 'arabic' | 'translation'
    const surahFilter = req.query.surahId ? parseInt(req.query.surahId as string, 10) : undefined;

    if (!rawQuery || rawQuery.length < 2) {
      return res.status(400).json({ error: 'طول عبارت جستجو باید حداقل ۲ حرف باشد.' });
    }

    const cacheKey = `${rawQuery.toLowerCase()}_${searchScope}_${surahFilter || 0}`;
    if (searchCache.has(cacheKey)) {
      return res.json(searchCache.get(cacheKey));
    }

    try {
      const results: any[] = [];
      const encodedQuery = encodeURIComponent(rawQuery);

      const promises: Promise<any>[] = [];

      if (searchScope === 'all' || searchScope === 'arabic') {
        promises.push(
          fetch(`https://api.alquran.cloud/v1/search/${encodedQuery}/all/quran-simple`, {
            headers: { 'User-Agent': 'QuranMobinApp/1.0' }
          })
            .then(r => r.ok ? r.json() : null)
            .then(data => ({ type: 'arabic', data }))
            .catch(() => null)
        );
      }

      if (searchScope === 'all' || searchScope === 'translation') {
        promises.push(
          fetch(`https://api.alquran.cloud/v1/search/${encodedQuery}/all/fa.makarem`, {
            headers: { 'User-Agent': 'QuranMobinApp/1.0' }
          })
            .then(r => r.ok ? r.json() : null)
            .then(data => ({ type: 'translation', data }))
            .catch(() => null)
        );
      }

      const responses = await Promise.all(promises);

      const seenAyahKeys = new Set<string>();

      for (const resp of responses) {
        if (!resp || !resp.data || !resp.data.data || !Array.isArray(resp.data.data.matches)) continue;

        for (const match of resp.data.data.matches) {
          const sId = match.surah?.number;
          const vNum = match.numberInSurah;
          if (!sId || !vNum) continue;

          if (surahFilter && sId !== surahFilter) continue;

          const key = `${sId}:${vNum}`;
          if (!seenAyahKeys.has(key)) {
            seenAyahKeys.add(key);
            results.push({
              id: match.number,
              surahId: sId,
              surahNameArabic: match.surah.name || '',
              surahNamePersian: match.surah.englishNameTranslation || match.surah.name || '',
              verseNumber: vNum,
              pageNumber: match.page || 1,
              juzNumber: match.juz || 1,
              textArabic: resp.type === 'arabic' ? match.text : '',
              translation: resp.type === 'translation' ? match.text : '',
              matchedIn: resp.type,
            });
          }
        }
      }

      const responsePayload = {
        query: rawQuery,
        count: results.length,
        results: results.slice(0, 100), // حداکثر ۱۰۰ نتیجه نخست
      };

      searchCache.set(cacheKey, responsePayload);
      return res.json(responsePayload);
    } catch (err: any) {
      console.error('Search error:', err);
      return res.status(500).json({
        error: 'خطا در انجام جستجو.',
        details: err?.message || String(err)
      });
    }
  });

  // اندپوینت تخصصی تدبّر هوشمند قرآنی (سخت‌سازی کامل، بدون نشت کلید یا انتساب دروغین)
  app.post('/api/ai/tadabbur', async (_req, res) => {
    return res.status(410).json({
      error: 'این مسیر منسوخ شده است. از مسیر جدید دستیار استفاده کنید.',
      code: 'legacy_endpoint_removed',
    });
  });

  // مدیریت خطاهای پیش‌بینی‌نشده به‌صورت امن و بدون نشت اطلاعات داخلی
  app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled API Error:', err);
    if (res.headersSent) {
      return;
    }
    res.status(err?.statusCode || 500).json({
      error: 'خطا در پردازش درخواست.'
    });
  });

  return app;
}
