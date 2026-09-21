import express from 'express';
import { GoogleGenAI } from '@google/genai';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

class UpstreamApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'UpstreamApiError';
  }
}

function getEnvKey(name: string): string {
  return (process.env[name] || '').trim();
}

async function callOpenRouter(apiKey: string, model: string, systemInstruction: string, userPrompt: string): Promise<string> {
  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(20000),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      // اطلاعات نمایشی برای توسعه‌دهندگان OpenRouter (فقط ASCII)
      'HTTP-Referer': 'https://quran-mobin.app',
      'X-Title': 'QuranMobinApp',
    },
    body: JSON.stringify({
      model: model || 'deepseek/deepseek-chat-v3-0324',
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.65,
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new UpstreamApiError(`OpenRouter API responded with status ${response.status}`, response.status);
  }

  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenRouter API returned an empty response.');
  }
  return content;
}

async function callDeepSeek(apiKey: string, systemInstruction: string, userPrompt: string): Promise<string> {
  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(20000),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.65,
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    throw new UpstreamApiError(`DeepSeek API responded with status ${response.status}`, response.status);
  }

  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('DeepSeek API returned an empty response.');
  }
  return content;
}

async function callGroq(apiKey: string, model: string, systemInstruction: string, userPrompt: string): Promise<string> {
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(20000),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.65,
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    throw new UpstreamApiError(`Groq API responded with status ${response.status}`, response.status);
  }

  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Groq API returned an empty response.');
  }
  return content;
}

let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(apiKey?: string): GoogleGenAI {
  const key = (apiKey || getEnvKey('GEMINI_API_KEY')).trim();
  if (apiKey || !geminiClient) {
    const client = new GoogleGenAI(key ? { apiKey: key } : {});
    if (!apiKey) geminiClient = client;
    return client;
  }
  return geminiClient;
}

async function callGemini(apiKey: string, systemInstruction: string, userPrompt: string): Promise<string> {
  const ai = getGeminiClient(apiKey);
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: userPrompt,
    config: {
      systemInstruction,
      temperature: 0.65,
      maxOutputTokens: 1500,
    },
  });

  const content = response.text;
  if (!content) {
    throw new Error('Gemini API returned an empty response.');
  }
  return content;
}

// ساخت اپلیکیشن Express با تمام اندپوینت‌های API (برای اجرای محلی و تابع سرورلس Vercel مشترک است)
export function createApp() {
  const app = express();

  app.use(express.json({ limit: '16kb' }));

  // اندپوینت سلامتی سرور
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // وضعیت سرویس‌های هوش مصنوعی (بر اساس P0-T5 فقط اعلام فعال بودن کلی)
  app.get('/api/ai/status', (req, res) => {
    const isAiEnabled = getEnvKey('AI_ENABLED') !== 'false';
    const hasAnyKey = !!(
      getEnvKey('GEMINI_API_KEY') ||
      getEnvKey('OPENROUTER_API_KEY') ||
      getEnvKey('DEEPSEEK_API_KEY') ||
      getEnvKey('GROQ_API_KEY')
    );
    res.json({
      enabled: isAiEnabled && hasAnyKey,
    });
  });

  // حافظه موقت کش سوره‌ها در سرور
  const surahCache = new Map<number, any[]>();

  // اندپوینت دریافت کامل متن، اعراب و ۳ ترجمه رسمی سوره
  app.get('/api/quran/surah/:id', async (req, res) => {
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
  app.get('/api/quran/search', async (req, res) => {
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

  // حافظه کش صفحات ۶۰۴ گانه مصحف
  const pageCache = new Map<number, any>();

  // اندپوینت دریافت آیات یک صفحه از مصحف ۶۰۴ صفحه‌ای
  app.get('/api/quran/page/:num', async (req, res) => {
    const pageNumber = parseInt(req.params.num, 10);
    if (isNaN(pageNumber) || pageNumber < 1 || pageNumber > 604) {
      return res.status(400).json({ error: 'شماره صفحه مصحف باید بین ۱ تا ۶۰۴ باشد.' });
    }

    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    if (pageCache.has(pageNumber)) {
      return res.json(pageCache.get(pageNumber));
    }

    try {
      const [uRes, mRes] = await Promise.all([
        fetch(`https://api.alquran.cloud/v1/page/${pageNumber}/quran-uthmani`, {
          headers: { 'User-Agent': 'QuranMobinApp/1.0' }
        }),
        fetch(`https://api.alquran.cloud/v1/page/${pageNumber}/fa.makarem`, {
          headers: { 'User-Agent': 'QuranMobinApp/1.0' }
        })
      ]);

      if (!uRes.ok) {
        throw new Error(`Failed to fetch page ${pageNumber}`);
      }

      const uData = await uRes.json();
      const mData = mRes.ok ? await mRes.json() : null;

      const ayahs = uData.data?.ayahs || [];
      const mAyahs = mData?.data?.ayahs || [];

      const verses = ayahs.map((uA: any, idx: number) => {
        let text = uA.text || '';
        text = text.replace(/^[\uFEFF\u200B\s]+/g, '').trim();
        const sId = uA.surah?.number;
        if (sId > 1 && uA.numberInSurah === 1 && sId !== 9) {
          text = text.replace(/^بِسْمِ\s+[\u0600-\u06FF\s]+?ٱلرَّحِيمِ\s*/u, '').trim();
          text = text.replace(/^بِسْمِ\s+[\u0600-\u06FF\s]+?الرَّحِيمِ\s*/u, '').trim();
        }

        return {
          id: uA.number,
          surahId: sId,
          surahNameArabic: uA.surah?.name || '',
          surahNamePersian: uA.surah?.englishNameTranslation || '',
          verseNumber: uA.numberInSurah,
          juzNumber: uA.juz,
          pageNumber: uA.page,
          textArabic: text,
          translationMakarem: mAyahs[idx]?.text || '',
        };
      });

      const payload = {
        pageNumber,
        count: verses.length,
        juzNumber: verses[0]?.juzNumber || 1,
        surahsOnPage: Array.from(new Set(verses.map((v: any) => v.surahNameArabic))),
        verses,
      };

      pageCache.set(pageNumber, payload);
      return res.json(payload);
    } catch (err: any) {
      console.error(`Error loading page ${pageNumber}:`, err);
      return res.status(502).json({
        error: `خطا در بارگذاری صفحه ${pageNumber}`,
        details: err?.message || String(err)
      });
    }
  });

  // اندپوینت تخصصی تدبّر هوشمند قرآنی (سخت‌سازی کامل، بدون نشت کلید یا انتساب دروغین)
  app.post('/api/ai/tadabbur', async (req, res) => {
    try {
      const isAiEnabled = getEnvKey('AI_ENABLED') !== 'false';
      if (!isAiEnabled) {
        return res.status(503).json({
          error: 'سرویس هوش مصنوعی در حال حاضر غیرفعال است.',
          code: 'ai_unavailable'
        });
      }

      const rawUserQuestion = typeof req.body?.userQuestion === 'string' ? req.body.userQuestion.trim() : '';
      const rawArabicText = typeof req.body?.arabicText === 'string' ? req.body.arabicText.trim() : '';
      const rawTranslation = typeof req.body?.translation === 'string' ? req.body.translation.trim() : '';
      const surahName = typeof req.body?.surahName === 'string' ? req.body.surahName.trim().slice(0, 50) : '';
      const verseNumber = typeof req.body?.verseNumber === 'number' ? req.body.verseNumber : 0;
      const mode = req.body?.mode;
      const agentId = typeof req.body?.agentId === 'string' ? req.body.agentId.trim() : 'moral';

      // سقف طول ورودی‌ها بر اساس P0-T5
      if (rawUserQuestion.length > 500) {
        return res.status(400).json({ error: 'طول پرسش نباید بیش از ۵۰۰ نویسه باشد.' });
      }
      if (rawArabicText.length > 1500) {
        return res.status(400).json({ error: 'طول متن عربی نباید بیش از ۱۵۰۰ نویسه باشد.' });
      }
      if (rawTranslation.length > 1000) {
        return res.status(400).json({ error: 'طول ترجمه نباید بیش از ۱۰۰۰ نویسه باشد.' });
      }

      // تعیین ارائه‌دهنده و کلید معتبر سمت سرور (کلید کلاینت پذیرفته نمی‌شود)
      const requestedProvider = typeof req.body?.provider === 'string' ? req.body.provider.trim() : '';
      let effectiveProvider: 'gemini' | 'groq' | 'deepseek' | 'openrouter' = 'gemini';

      if (requestedProvider === 'groq' && getEnvKey('GROQ_API_KEY')) {
        effectiveProvider = 'groq';
      } else if (requestedProvider === 'deepseek' && getEnvKey('DEEPSEEK_API_KEY')) {
        effectiveProvider = 'deepseek';
      } else if (requestedProvider === 'openrouter' && getEnvKey('OPENROUTER_API_KEY')) {
        effectiveProvider = 'openrouter';
      } else if (getEnvKey('GEMINI_API_KEY')) {
        effectiveProvider = 'gemini';
      } else if (getEnvKey('GROQ_API_KEY')) {
        effectiveProvider = 'groq';
      } else if (getEnvKey('OPENROUTER_API_KEY')) {
        effectiveProvider = 'openrouter';
      } else if (getEnvKey('DEEPSEEK_API_KEY')) {
        effectiveProvider = 'deepseek';
      }

      const serverKey = effectiveProvider === 'gemini'
        ? getEnvKey('GEMINI_API_KEY')
        : effectiveProvider === 'deepseek'
        ? getEnvKey('DEEPSEEK_API_KEY')
        : effectiveProvider === 'groq'
        ? getEnvKey('GROQ_API_KEY')
        : getEnvKey('OPENROUTER_API_KEY');

      if (!serverKey) {
        return res.status(503).json({
          error: 'سرویس هوش مصنوعی در دسترس نیست (کلید معتبر در سرور تنظیم نشده است).',
          code: 'ai_unavailable'
        });
      }

      // رویکردهای تدبر بدون انتساب ناروا به مؤلفان خاص (بر اساس P0-T2)
      let systemInstruction = '';
      let approachTitle = '';

      switch (agentId) {
        case 'conceptual':
        case 'allameh':
          approachTitle = 'رویکرد تدبّر مفهومی و معارفی';
          systemInstruction = `شما دستیار تدبّر قرآنی با رویکرد تأمل مفهومی، معارفی و توحیدی هستید.
وظایف:
۱. تبیین پیام‌های معنوی، توحیدی و پیوند مفهومی این آیه با آموزه‌های کلی قرآن کریم.
۲. کمک به تعمیق اندیشه و افق‌گشایی برای مخاطب.
۳. پرهیز از ادعای کشف قطعی بطون یا انتساب نامعتبر به تفاسیر خاص.`;
          break;

        case 'literary':
        case 'adib':
          approachTitle = 'رویکرد ادبی و واژه‌شناسی';
          systemInstruction = `شما دستیار تدبّر قرآنی با رویکرد واژه‌شناسی و ظرافت‌های ادبی هستید.
وظایف:
۱. تحلیل ریشه‌شناسی واژگان کلیدی آیه، اشتقاق و معانی لغوی.
۲. بیان تناسب واژه‌ها و ساختار بیانی آیه شریفه.
۳. نگارش با لحنی علمی، آموزشی و ساختاریافته.`;
          break;

        case 'rational':
        case 'kalam':
          approachTitle = 'رویکرد عقلی و استدلالی';
          systemInstruction = `شما دستیار تدبّر قرآنی با رویکرد عقلانی و استدلالی هستید.
وظایف:
۱. پاسخ عقلانی، متقن، صبورانه و منطقی به پرسش‌های فکری و اعتقادی در سیاق آیه.
۲. پرهیز از تعصب و مجادله؛ تکیه بر استدلال متین و مشترکات توحیدی.`;
          break;

        case 'moral':
        case 'nemoneh':
        default:
          approachTitle = 'رویکرد اخلاقی، تربیتی و کاربردی';
          systemInstruction = `شما دستیار تدبّر قرآنی با رویکرد اخلاقی، تربیتی و سبک زندگی هستید.
وظایف:
۱. استخراج نکات کاربردی آیه برای زندگی امروز، امیدبخشی و آرامش خاطر.
۲. پرهیز مطلق از صدور فتوای فقهی یا ادعای نقل متن از کتابی خاص بدون استناد.
۳. نگارش با لحنی گرم، محترمانه، صمیمی و فارسی سلیس.`;
          break;
      }

      let userPrompt = '';
      if (mode === 'verse_reflection') {
        userPrompt = `با رویکرد «${approachTitle}» پیرامون آیه مبارکه زیر تدبّر و راهنمایی فرمایید:
سوره: ${surahName}
شماره آیه: ${verseNumber}
متن عربی: ${rawArabicText}
ترجمه: ${rawTranslation}
${rawUserQuestion ? `پرسش خاص کاربر: ${rawUserQuestion}` : ''}`;
      } else if (mode === 'topic_guidance') {
        userPrompt = `پرسش یا موضوع کاربر:
«${rawUserQuestion}»
لطفاً با رویکرد «${approachTitle}» و بر مدار هدایت‌های قرآنی پاسخ دهید.`;
      } else {
        userPrompt = rawUserQuestion || `درباره آیه ${verseNumber} سوره ${surahName} با رویکرد «${approachTitle}» تحلیل خود را ارائه دهید.`;
      }

      // مدل‌های مجاز سمت سرور (فهرست مجاز سخت‌گیرانه)
      const replyText = effectiveProvider === 'gemini'
        ? await callGemini(serverKey, systemInstruction, userPrompt)
        : effectiveProvider === 'deepseek'
        ? await callDeepSeek(serverKey, systemInstruction, userPrompt)
        : effectiveProvider === 'groq'
        ? await callGroq(serverKey, 'openai/gpt-oss-120b', systemInstruction, userPrompt)
        : await callOpenRouter(serverKey, 'deepseek/deepseek-chat-v3-0324', systemInstruction, userPrompt);

      return res.json({
        reply: replyText,
        approachTitle,
        provider: effectiveProvider,
      });
    } catch (error: any) {
      console.error('AI Tadabbur API Error:', error);
      const status = error instanceof UpstreamApiError ? error.status : 502;
      return res.status(status).json({
        error: 'خطا در برقراری ارتباط با سرویس تدبّر هوشمند.',
        code: 'upstream_error'
      });
    }
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
