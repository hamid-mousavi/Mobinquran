import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY || '';
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // اندپوینت سلامتی سرور
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
          tafsirNemoneh: `چکیده تفسیر نمونه: این آیه شریفه متضمن هدایت‌های توحیدی، اخلاقی و احکام روشن الهی است. برای تبیین عمیق‌تر روی دکمه «تدبّر هوشمند» کلیک فرمایید.`,
          tafsirMizan: `نکات المیزان: علامه طباطبایی در ذیل این آیه بر بطون معنوی، تقوا و اخلاص در بندگی تأکید می‌فرمایند.`,
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

  // اندپوینت تخصصی تدبّر هوشمند قرآنی با پشتیبانی از چند ایجنت تخصصی
  app.post('/api/ai/tadabbur', async (req, res) => {
    try {
      const {
        surahName,
        verseNumber,
        arabicText,
        translation,
        userQuestion,
        mode,
        agentId = 'nemoneh'
      } = req.body;

      // پاسخ‌های پیش‌فرض و جامع بر اساس ایجنت انتخابی در حالت آفلاین یا ایجنت دانشنامه درون‌برنامه
      if (agentId === 'offline_knowledge' || !process.env.GEMINI_API_KEY) {
        let offlineReply = '';
        if (agentId === 'allameh') {
          offlineReply = `[دیدگاه ایجنت علامه - مبتنی بر تفسیر المیزان]:\n\nدر تدبر آیه شریفه «${arabicText || 'آیه مبارکه'}» (سوره ${surahName || ''}، آیه ${verseNumber || ''}):\n\nعلامه طباطبایی (ره) در تبیین این آیه بر بطون توحیدی، حقیقت اخلاص و اتصال وجودی انسان با مبدأ آفرینش تأکید می‌فرمایند. در روش «تفسیر قرآن به قرآن»، این مفهوم هم‌افق با آیات دیگری است که اصالت را به تقوا و طهارت باطن می‌دهند. پیام محوری آیه، زدودن غبار غفلت و بازگشت به فطرت توحیدی است.`;
        } else if (agentId === 'adib') {
          offlineReply = `[دیدگاه ایجنت ادیب - پژوهشگر لغوی و اعجاز بیانی]:\n\nتحلیل لغوی و بلاغی آیه «${arabicText || ''}»:\n\n۱. ساختار واژگان: گزینش کلمات در این آیه دارای تناسب آوایی و هماهنگی موسیقیایی شگفت‌انگیزی است.\n۲. فصاحت و بلاغت: ایجاز و اختصار در بیان، در عین انتقال عمیق‌ترین مفاهیم معنوی، از نشانه‌های روشن اعجاز کلام الهی در این آیه است.\n۳. بار معنایی: ریشه کلمات نشان می‌دهد که هدایت الهی پیوسته و فزاینده است و هر واژه نقشی بی‌بدیل در فهم سیاق دارد.`;
        } else if (agentId === 'kalam') {
          offlineReply = `[دیدگاه ایجنت پژوهش - مباحث کلامی و پاسخ به شبهات]:\n\nپاسخ مستدل و تبیین عقلی پیرامون آیه «${arabicText || ''}»:\n\nاین آیه شریف پاسخی قاطع به تردیدها درباره حکمت و عدل الهی است. عقل سلیم درمی‌یابد که نظام تکوین و تشریع بر مقتضای رحمت و آزمون سرشته شده است. آیات هم‌افق تصریح دارند که هیچ بنده‌ای فراتر از وسعش مکلف نبوده و هدایت برای جویندگان حقیقت تضمین شده است.`;
        } else {
          // nemoneh or default
          offlineReply = `[دیدگاه ایجنت نمونه - هدایت اخلاقی و آرامش زندگی]:\n\nنکات کاربردی و پیام‌های آیه «${arabicText || ''}» برای زندگی امروز:\n\n۱. آرامش در طوفان‌ها: یاد خداوند و توکل بر او، اضطراب‌های روزمره را به اطمینان بدل می‌سازد.\n۲. راهکار عملی: در مواجهه با چالش‌ها، صبوری همراه با عمل صالح و پرهیز از شتابزدگی توصیه شده است.\n۳. نگاه امیدوارانه: در تفسیر نمونه تصریح شده که درهای رحمت پروردگار همواره باز است و بن‌بستی در مدار توحید وجود ندارد.`;
        }

        return res.json({
          reply: offlineReply,
          agentId,
          isOfflineKnowledge: true
        });
      }

      const ai = getAIClient();

      // ساخت پرامپت سیستمی متناسب با ایجنت انتخاب‌شده
      let systemInstruction = '';
      let agentTitle = '';

      switch (agentId) {
        case 'allameh':
          agentTitle = 'علامه (مفسر المیزان)';
          systemInstruction = `شما «ایجنت علامه»، متخصص در مکتب تفسیری علامه طباطبایی و رویکرد «تفسیر قرآن به قرآن» و مباحث عمیق فلسفی، باطنی و معرفتی هستید.
وظیفه شما:
۱. تبیین بطون عمیق آیات، غایات توحیدی و پیوند این آیه با سایر آیات قرآن کریم.
۲. استفاده از نثری فاخر، عمیق، محققانه و مستدل.
۳. پرهیز از سطحی‌نگری و پرداختن به ریشه‌های وجودی و اخلاص در بندگی.`;
          break;

        case 'adib':
          agentTitle = 'ادیب (پژوهشگر لغوی و صرف و نحو)';
          systemInstruction = `شما «ایجنت ادیب»، پژوهشگر فصاحت، بلاغت، ریشه‌شناسی واژگان قرآنی و وجوه اعجاز بیانی الفاظ وحی هستید.
وظیفه شما:
۱. تحلیل ریشه لغوی واژگان کلیدی آیه، اشتقاق و دلالت‌های معنایی دقیق آن‌ها.
۲. اشاره به نکات صرفی، نحوی و زیبایی‌های استعاره و بلاغت قرآنی.
۳. پاسخ با دقتی ادیبانه و آموزشی در قالب بخش‌های منظم.`;
          break;

        case 'kalam':
          agentTitle = 'پژوهش (پاسخ به سوالات کلامی و شبهات)';
          systemInstruction = `شما «ایجنت پژوهش»، متکلم و پاسخ‌دهنده به پرسش‌های فکری، فلسفی، شبهات پیرامون عدل الهی، قضا و قدر و معارف اسلامی هستید.
وظیفه شما:
۱. پاسخ عقلانی، متقن، صبورانه و منطقی با اتکا به براهین روشن قرآنی و عقلی.
۲. تشریح سوءتفاهم‌ها با لحنی علمی، احترام‌آمیز و اقناع‌کننده.`;
          break;

        case 'nemoneh':
        default:
          agentTitle = 'نمونه (هدایت اخلاقی و سبک زندگی)';
          systemInstruction = `شما «ایجنت نمونه»، متخصص در مکتب تفسیری تفسیر نمونه و راهکارهای عملی زندگی امروز هستید.
وظیفه شما:
۱. تطبیق آموزه‌های آیه بر زندگی روزمره، رهایی از اضطراب، روابط انسانی و تربیت اخلاقی.
۲. ارائه پاسخ با لحنی گرم، صمیمی، امیدبخش، سرشار از آرامش و نثر فارسی بسیار روان.
۳. ارائه راهکارهای گام‌به‌گام و ملموس قرآنی برای پرسش‌های کاربر.`;
          break;
      }

      let userPrompt = '';
      if (mode === 'verse_reflection') {
        userPrompt = `لطفاً از دیدگاه تخصصی خود (${agentTitle}) پیرامون این آیه مبارکه تدبّر و راهنمایی فرمایید:
سوره: ${surahName}
شماره آیه: ${verseNumber}
متن عربی: ${arabicText}
ترجمه: ${translation}
${userQuestion ? `پرسش خاص کاربر: ${userQuestion}` : ''}`;
      } else if (mode === 'topic_guidance') {
        userPrompt = `کاربر در خصوص این موضوع از شما (${agentTitle}) هدایت و بینش قرآنی می‌طلبد:
«${userQuestion}»
لطفاً با استناد به آیات و رویکرد تخصصی خود تبیین فرمایید.`;
      } else {
        userPrompt = userQuestion || `درباره آیه ${verseNumber} سوره ${surahName} تحلیل خود را به عنوان ${agentTitle} ارائه دهید.`;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: userPrompt,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.65,
        }
      });

      const replyText = response.text || 'پاسخی دریافت نشد.';
      return res.json({ reply: replyText, agentId, agentTitle });
    } catch (error: any) {
      console.error('Gemini Tadabbur API Error:', error);
      return res.status(500).json({
        error: 'خطا در برقراری ارتباط با سرویس تدبّر هوشمند.',
        details: error?.message || String(error)
      });
    }
  });

  // Vite middleware برای توسعه و سرو استاتیک در پروداکشن
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Quran Mobin Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
