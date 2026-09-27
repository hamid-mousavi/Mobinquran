// app.ts
import express from "express";
import path from "path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

// src/services/aiContract.ts
import { z } from "zod";
var verseRefSchema = z.string().regex(/^([1-9]|[1-9][0-9]|1[01][0-4]):[1-9][0-9]{0,2}$/);
var aiCandidateSchema = z.object({
  ref: verseRefSchema,
  text_fa: z.string().trim().min(1).max(1500)
});
var sourceItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(["quran", "tafsir", "hadith", "web"]),
  reference: z.string(),
  sourceName: z.string(),
  url: z.string(),
  isInternal: z.boolean(),
  metadata: z.object({
    surahId: z.number().optional(),
    verseNumber: z.number().optional(),
    surahName: z.string().optional()
  }).optional()
});
var ragCandidateSchema = z.object({
  sourceId: z.string(),
  type: z.enum(["quran", "tafsir", "hadith", "web"]),
  title: z.string(),
  reference: z.string(),
  sourceName: z.string(),
  content: z.string(),
  sourceItem: sourceItemSchema.optional()
});
var aiAskRequestSchema = z.object({
  question: z.string().trim().min(1).max(1e3),
  history: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string()
    })
  ).optional().default([]),
  currentVerse: z.object({
    surahId: z.number(),
    verseNumber: z.number(),
    textArabic: z.string().optional(),
    translationMakarem: z.string().optional()
  }).optional().nullable(),
  ragCandidates: z.array(ragCandidateSchema).max(16).optional().default([]),
  sourcesCatalog: z.array(sourceItemSchema).max(20).optional().default([]),
  candidates: z.array(aiCandidateSchema).max(12).optional().default([]),
  lang: z.enum(["fa", "en", "ur"]).default("fa"),
  agent: z.enum(["moral", "conceptual", "literary", "rational"]).optional().default("moral")
});
var aiVerseAnswerSchema = z.object({
  ref: verseRefSchema,
  why_relevant: z.string().trim().min(1).max(1e3),
  practical_note: z.string().trim().min(1).max(1e3)
});
var aiResponseSchema = z.object({
  intent: z.enum(["casual_chat", "quran_inquiry", "current_info", "hybrid"]).default("quran_inquiry"),
  language: z.enum(["fa", "en", "ur"]).default("fa"),
  summary: z.string().trim().min(1).max(600),
  direct_answer: z.string().trim().max(250).optional(),
  source_quote: z.string().trim().max(400).optional(),
  ai_analysis: z.string().trim().max(600).optional(),
  practical_takeaway: z.string().trim().max(250).optional(),
  socratic_questions: z.array(z.string().trim().max(160)).max(1).optional().default([]),
  used_source_ids: z.array(z.string().trim()).max(8).optional().default([]),
  sources: z.array(sourceItemSchema).default([]),
  tafsir_citations: z.array(z.string().trim()).optional().default([]),
  verses: z.array(aiVerseAnswerSchema).max(12).optional().default([]),
  confidence: z.string().transform((val) => val.toLowerCase()).pipe(z.enum(["high", "medium", "low"])).default("medium"),
  needs_human_scholar: z.boolean().default(false),
  disclaimers: z.array(z.string().trim().min(1).max(300)).min(1).max(5).default(["\u062A\u0648\u0644\u06CC\u062F\u0634\u062F\u0647 \u0628\u0627 \u0647\u0648\u0634 \u0645\u0635\u0646\u0648\u0639\u06CC\u061B \u0627\u06CC\u0646 \u062F\u0633\u062A\u06CC\u0627\u0631 \u0645\u0631\u062C\u0639 \u0641\u062A\u0648\u0627 \u0646\u06CC\u0633\u062A."])
});
function extractJsonObject(text) {
  const trimmed = text.trim();
  const withoutFence = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    return JSON.parse(withoutFence);
  } catch {
    const start = withoutFence.indexOf("{");
    const end = withoutFence.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(withoutFence.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

// server/aiProviders.ts
import { GoogleGenAI } from "@google/genai";
var ProviderError = class extends Error {
  constructor(provider, status, message) {
    super(message);
    this.provider = provider;
    this.status = status;
    this.name = "ProviderError";
  }
};
var providerOrder = ["gemini", "groq", "deepseek", "openrouter"];
var urls = {
  groq: "https://api.groq.com/openai/v1/chat/completions",
  deepseek: "https://api.deepseek.com/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions"
};
function env(name) {
  return (process.env[name] || "").trim();
}
function getProviderKey(provider) {
  if (provider === "gemini") {
    return env("GEMINI_API_KEY") || env("API_KEY");
  }
  return env(`${provider.toUpperCase()}_API_KEY`);
}
function configuredProviders() {
  const configured = env("AI_PROVIDER_ORDER").split(",").map((value) => value.trim()).filter((value) => providerOrder.includes(value));
  const order = configured.length > 0 ? configured : providerOrder;
  return order.filter((provider) => !!getProviderKey(provider));
}
function modelFor(provider) {
  return env(`AI_MODEL_${provider.toUpperCase()}`) || {
    gemini: "gemini-3.8-flash",
    groq: "qwen/qwen3.8-27b",
    deepseek: "deepseek-chat",
    openrouter: "deepseek/deepseek-chat-v3-0324"
  }[provider];
}
async function callOpenAiStyle(provider, key, request) {
  const response = await fetch(urls[provider], {
    method: "POST",
    signal: AbortSignal.timeout(Number(env("AI_PROVIDER_TIMEOUT_MS") || 2e4)),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      ...provider === "openrouter" ? { "HTTP-Referer": env("PUBLIC_APP_URL") || "https://quran-mobin.app", "X-Title": "QuranMobinApp" } : {}
    },
    body: JSON.stringify({
      model: modelFor(provider),
      messages: [
        { role: "system", content: request.system },
        { role: "user", content: request.user }
      ],
      temperature: request.temperature ?? 0.2,
      max_tokens: request.maxTokens,
      response_format: { type: "json_object" }
    })
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new ProviderError(provider, response.status, `${provider} returned ${response.status}: ${errText.slice(0, 100)}`);
  }
  const body = await response.json();
  const content = body.choices?.[0]?.message?.content?.trim();
  if (!content) throw new ProviderError(provider, 502, `${provider} returned an empty response`);
  return { content };
}
async function callGemini(key, request) {
  const ai = new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
  try {
    const config = {
      systemInstruction: request.system,
      temperature: request.temperature ?? 0.2,
      maxOutputTokens: request.maxTokens,
      responseMimeType: "application/json"
    };
    if (request.enableWebSearch) {
      config.tools = [{ googleSearch: {} }];
    }
    const response = await ai.models.generateContent({
      model: modelFor("gemini"),
      contents: request.user,
      config
    });
    const content = response.text?.trim();
    if (!content) throw new ProviderError("gemini", 502, "gemini returned an empty response");
    const webChunks = [];
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (Array.isArray(groundingChunks)) {
      for (const ch of groundingChunks) {
        if (ch?.web?.uri) {
          webChunks.push({
            title: ch.web.title || ch.web.uri,
            uri: ch.web.uri
          });
        }
      }
    }
    return { content, webChunks };
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    const status = typeof error?.status === "number" ? error.status : typeof error?.statusCode === "number" ? error.statusCode : 502;
    throw new ProviderError("gemini", status, error?.message || "gemini request failed");
  }
}
async function callProvider(provider, request) {
  const key = getProviderKey(provider);
  if (!key) throw new ProviderError(provider, 503, `${provider} is not configured`);
  return provider === "gemini" ? callGemini(key, request) : callOpenAiStyle(provider, key, request);
}
async function generateWithFallback(request) {
  const providers = configuredProviders();
  if (providers.length === 0) throw new ProviderError("gemini", 503, "no AI provider is configured");
  let lastError;
  for (const provider of providers) {
    try {
      const res = await callProvider(provider, request);
      return { content: res.content, provider, webChunks: res.webChunks };
    } catch (error) {
      lastError = error;
      if (error instanceof ProviderError && error.status !== 404 && error.status !== 408 && error.status !== 429 && error.status < 500) {
        break;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("all AI providers failed");
}
function hasConfiguredProvider() {
  return configuredProviders().length > 0;
}

// server/aiRateLimit.ts
import crypto from "node:crypto";
var memoryCounters = /* @__PURE__ */ new Map();
function env2(name) {
  return (process.env[name] || "").trim();
}
function isProduction() {
  return env2("NODE_ENV") === "production";
}
function dayWindow() {
  const now = Date.now();
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  return { start: start.getTime(), resetAt: start.getTime() + 864e5 };
}
function hashRateLimitKey(ip, deviceId) {
  return crypto.createHash("sha256").update(`${ip}|${deviceId}`).digest("hex");
}
async function incrementUpstash(key, resetAt) {
  const url = env2("UPSTASH_REDIS_REST_URL");
  const token = env2("UPSTASH_REDIS_REST_TOKEN");
  if (!url || !token) return null;
  const response = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIREAT", key, Math.ceil(resetAt / 1e3)]
    ])
  });
  if (!response.ok) throw new Error("rate-limit store unavailable");
  const result = await response.json();
  return Number(result?.[0]?.result || 0);
}
async function consumeDailyQuota(key) {
  const limit = Math.max(1, Number(env2("AI_DAILY_LIMIT") || 20));
  const { resetAt } = dayWindow();
  const allowMemoryFallback = env2("ALLOW_MEMORY_RATE_LIMIT") === "true";
  if (isProduction() && (!env2("UPSTASH_REDIS_REST_URL") || !env2("UPSTASH_REDIS_REST_TOKEN"))) {
    if (!allowMemoryFallback) {
      return { allowed: false, used: 0, limit, resetAt };
    }
  }
  const storageKey = `quran-ai:${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}:${key}`;
  let used;
  try {
    const persisted = await incrementUpstash(storageKey, resetAt);
    if (persisted !== null) {
      used = persisted;
    } else {
      if (isProduction() && !allowMemoryFallback) {
        return { allowed: false, used: 0, limit, resetAt };
      }
      const existing = memoryCounters.get(storageKey);
      const counter = existing && existing.resetAt > Date.now() ? existing : { count: 0, resetAt };
      counter.count += 1;
      memoryCounters.set(storageKey, counter);
      used = counter.count;
    }
  } catch {
    if (isProduction() && !allowMemoryFallback) {
      return { allowed: false, used: 0, limit, resetAt };
    }
    const existing = memoryCounters.get(storageKey);
    const counter = existing && existing.resetAt > Date.now() ? existing : { count: 0, resetAt };
    counter.count += 1;
    memoryCounters.set(storageKey, counter);
    used = counter.count;
  }
  return { allowed: used <= limit, used, limit, resetAt };
}

// src/services/aiAgent/intentDetector.ts
var CASUAL_PATTERNS = [
  /^(سلام|درود|سلام علیکم|سلام بر شما|سلامتی|خوبی|چطوری|درود بر شما|روز بخیر|صبح بخیر|عصر بخیر|شب بخیر|وقت بخیر|یا علی|یا حق|خسته نباشید|ممنون|تشکر|متشکرم|مرسی|دمت گرم|سپاس|قربانت|فدات|ارادت|خداحافظ|فعلا|بای|هی|الو)[\s!.,،؟?]*$/i,
  /^(تو کی هستی|اسمت چیه|خودتو معرفی کن|چیکار می\s*تونی بکنی|چه کمکی می\s*تونی بکنی|سازنده تو کیه|هوش مصنوعی هستی|سلام عزیزم|سلام دوست من)[\s!.,،؟?]*$/i
];
var CURRENT_INFO_PATTERNS = [
  /امروز\s*(چندم|چند شنبه|چه روزی|تاریخ|مناسبت)/i,
  /(اخبار|خبرهای|رویدادهای|اتفاقات|وضعیت)\s*(امروز|اخیر|روز|کشور|جهان)/i,
  /(قیمت|نرخ)\s*(دلار|ارز|طلا|سکه|بنزین)/i,
  /(آب و هوا|پیش\s*بینی هوا|دمای هوا)/i,
  /(جدیدترین|آخرین)\s*(دستاوردهای|اخبار|اکتشافات)/i
];
var QURAN_KEYWORDS = [
  "\u0642\u0631\u0622\u0646",
  "\u0622\u06CC\u0647",
  "\u0633\u0648\u0631\u0647",
  "\u062A\u0641\u0633\u06CC\u0631",
  "\u062D\u062F\u06CC\u062B",
  "\u0631\u0648\u0627\u06CC\u062A",
  "\u0645\u0639\u0627\u0631\u0641",
  "\u062E\u062F\u0627",
  "\u067E\u0631\u0648\u0631\u062F\u06AF\u0627\u0631",
  "\u0635\u0628\u0631",
  "\u062A\u0648\u06A9\u0644",
  "\u0631\u0632\u0642",
  "\u0631\u0648\u0632\u06CC",
  "\u062F\u0639\u0627",
  "\u0627\u0633\u062A\u063A\u0641\u0627\u0631",
  "\u0646\u0645\u0627\u0632",
  "\u0631\u0648\u0632\u0647",
  "\u0632\u06A9\u0627\u062A",
  "\u062D\u062C",
  "\u0645\u0639\u0627\u062F",
  "\u0642\u06CC\u0627\u0645\u062A",
  "\u0628\u0647\u0634\u062A",
  "\u062C\u0647\u0646\u0645",
  "\u0628\u0631\u0632\u062E",
  "\u0631\u0648\u062D",
  "\u062A\u0642\u0648\u0627",
  "\u0627\u062E\u0644\u0627\u0642",
  "\u0639\u062F\u0627\u0644\u062A",
  "\u0627\u062D\u0633\u0627\u0646",
  "\u0648\u0627\u0644\u062F\u06CC\u0646",
  "\u067E\u062F\u0631",
  "\u0645\u0627\u062F\u0631",
  "\u0638\u0644\u0645",
  "\u062D\u0631\u0627\u0645",
  "\u062D\u0644\u0627\u0644",
  "\u0645\u0648\u0645\u0646",
  "\u06A9\u0627\u0641\u0631",
  "\u0645\u0646\u0627\u0641\u0642",
  "\u067E\u06CC\u0627\u0645\u0628\u0631",
  "\u0631\u0633\u0648\u0644",
  "\u0627\u0645\u0627\u0645",
  "\u0627\u0647\u0644 \u0628\u06CC\u062A",
  "\u062A\u0648\u0628\u0647",
  "\u0634\u06A9\u0631",
  "\u0627\u0645\u06CC\u062F",
  "\u0646\u0627\u0627\u0645\u06CC\u062F\u06CC",
  "\u06CC\u0627\u0633",
  "\u0647\u062F\u0627\u06CC\u062A",
  "\u06AF\u0645\u0631\u0627\u0647\u06CC",
  "\u0641\u0631\u0634\u062A\u0647",
  "\u0634\u06CC\u0637\u0627\u0646",
  "\u0648\u0633\u0648\u0633\u0647",
  "\u0622\u0631\u0627\u0645\u0634",
  "\u0627\u0636\u0637\u0631\u0627\u0628",
  "\u0639\u0641\u0648",
  "\u0628\u062E\u0634\u0634",
  "\u062D\u062C\u0627\u0628",
  "\u0639\u0641\u062A",
  "\u062C\u0647\u0627\u062F",
  "\u0634\u0647\u0627\u062F\u062A",
  "\u0642\u0636\u0627 \u0648 \u0642\u062F\u0631",
  "\u062D\u0642 \u0627\u0644\u0646\u0627\u0633",
  "\u0627\u0645\u0627\u0646\u062A",
  "\u0635\u062F\u0627\u0642\u062A"
];
function detectIntent(question, hasCurrentVerseContext = false) {
  const q = question.trim();
  if (!q) return "casual_chat";
  if (hasCurrentVerseContext && !CASUAL_PATTERNS.some((p) => p.test(q))) {
    return "quran_inquiry";
  }
  if (CASUAL_PATTERNS.some((p) => p.test(q))) {
    return "casual_chat";
  }
  const isCurrent = CURRENT_INFO_PATTERNS.some((p) => p.test(q));
  const hasQuranKeywords = QURAN_KEYWORDS.some((kw) => q.includes(kw));
  if (isCurrent && hasQuranKeywords) {
    return "hybrid";
  }
  if (isCurrent) {
    return "current_info";
  }
  if (hasQuranKeywords) {
    return "quran_inquiry";
  }
  return "quran_inquiry";
}

// src/utils/textNormalization.ts
function toPersianDigits(input) {
  if (input === void 0 || input === null) return "";
  const str = String(input);
  const persianDigits = ["\u06F0", "\u06F1", "\u06F2", "\u06F3", "\u06F4", "\u06F5", "\u06F6", "\u06F7", "\u06F8", "\u06F9"];
  return str.replace(/[0-9]/g, (w) => persianDigits[+w]);
}

// src/services/aiAgent/sourceResolver.ts
var SURAH_NAMES = {
  1: { arabic: "\u0627\u0644\u0641\u0627\u062A\u062D\u0629", persian: "\u062D\u0645\u062F" },
  2: { arabic: "\u0627\u0644\u0628\u0642\u0631\u0629", persian: "\u0628\u0642\u0631\u0647" },
  3: { arabic: "\u0622\u0644 \u0639\u0645\u0631\u0627\u0646", persian: "\u0622\u0644 \u0639\u0645\u0631\u0627\u0646" },
  4: { arabic: "\u0627\u0644\u0646\u0633\u0627\u0621", persian: "\u0646\u0633\u0627\u0621" },
  5: { arabic: "\u0627\u0644\u0645\u0627\u0626\u062F\u0629", persian: "\u0645\u0627\u0626\u062F\u0647" },
  6: { arabic: "\u0627\u0644\u0623\u0646\u0639\u0627\u0645", persian: "\u0627\u0646\u0639\u0627\u0645" },
  7: { arabic: "\u0627\u0644\u0623\u0639\u0631\u0627\u0641", persian: "\u0627\u0639\u0631\u0627\u0641" },
  8: { arabic: "\u0627\u0644\u0623\u0646\u0641\u0627\u0644", persian: "\u0627\u0646\u0641\u0627\u0644" },
  9: { arabic: "\u0627\u0644\u062A\u0648\u0628\u0629", persian: "\u062A\u0648\u0628\u0647" },
  10: { arabic: "\u064A\u0648\u0646\u0633", persian: "\u06CC\u0648\u0646\u0633" },
  11: { arabic: "\u0647\u0648\u062F", persian: "\u0647\u0648\u062F" },
  12: { arabic: "\u064A\u0648\u0633\u0641", persian: "\u06CC\u0648\u0633\u0641" },
  13: { arabic: "\u0627\u0644\u0631\u0639\u062F", persian: "\u0631\u0639\u062F" },
  14: { arabic: "\u0625\u0628\u0631\u0627\u0647\u064A\u0645", persian: "\u0627\u0628\u0631\u0627\u0647\u06CC\u0645" },
  15: { arabic: "\u0627\u0644\u062D\u062C\u0631", persian: "\u062D\u062C\u0631" },
  16: { arabic: "\u0627\u0644\u0646\u062D\u0644", persian: "\u0646\u062D\u0644" },
  17: { arabic: "\u0627\u0644\u0625\u0633\u0631\u0627\u0621", persian: "\u0627\u0633\u0631\u0627\u0621" },
  18: { arabic: "\u0627\u0644\u0643\u0647\u0641", persian: "\u06A9\u0647\u0641" },
  19: { arabic: "\u0645\u0631\u064A\u0645", persian: "\u0645\u0631\u06CC\u0645" },
  20: { arabic: "\u0637\u0647", persian: "\u0637\u0647" },
  21: { arabic: "\u0627\u0644\u0623\u0646\u0628\u064A\u0627\u0621", persian: "\u0627\u0646\u0628\u06CC\u0627\u0621" },
  22: { arabic: "\u0627\u0644\u062D\u062C", persian: "\u062D\u062C" },
  23: { arabic: "\u0627\u0644\u0645\u0624\u0645\u0646\u0648\u0646", persian: "\u0645\u0624\u0645\u0646\u0648\u0646" },
  24: { arabic: "\u0627\u0644\u0646\u0648\u0631", persian: "\u0646\u0648\u0631" },
  25: { arabic: "\u0627\u0644\u0641\u0631\u0642\u0627\u0646", persian: "\u0641\u0631\u0642\u0627\u0646" },
  26: { arabic: "\u0627\u0644\u0634\u0639\u0631\u0627\u0621", persian: "\u0634\u0639\u0631\u0627\u0621" },
  27: { arabic: "\u0627\u0644\u0646\u0645\u0644", persian: "\u0646\u0645\u0644" },
  28: { arabic: "\u0627\u0644\u0642\u0635\u0635", persian: "\u0642\u0635\u0635" },
  29: { arabic: "\u0627\u0644\u0639\u0646\u0643\u0628\u0648\u062A", persian: "\u0639\u0646\u06A9\u0628\u0648\u062A" },
  30: { arabic: "\u0627\u0644\u0631\u0648\u0645", persian: "\u0631\u0648\u0645" },
  31: { arabic: "\u0644\u0642\u0645\u0627\u0646", persian: "\u0644\u0642\u0645\u0627\u0646" },
  32: { arabic: "\u0627\u0644\u0633\u062C\u062F\u0629", persian: "\u0633\u062C\u062F\u0647" },
  33: { arabic: "\u0627\u0644\u0623\u062D\u0632\u0627\u0628", persian: "\u0627\u062D\u0632\u0627\u0628" },
  34: { arabic: "\u0633\u0628\u0623", persian: "\u0633\u0628\u0623" },
  35: { arabic: "\u0641\u0627\u0637\u0631", persian: "\u0641\u0627\u0637\u0631" },
  36: { arabic: "\u064A\u0633", persian: "\u06CC\u0633" },
  37: { arabic: "\u0627\u0644\u0635\u0627\u0641\u0627\u062A", persian: "\u0635\u0627\u0641\u0627\u062A" },
  38: { arabic: "\u0635", persian: "\u0635" },
  39: { arabic: "\u0627\u0644\u0632\u0645\u0631", persian: "\u0632\u0645\u0631" },
  40: { arabic: "\u063A\u0627\u0641\u0631", persian: "\u063A\u0627\u0641\u0631" },
  41: { arabic: "\u0641\u0635\u0644\u062A", persian: "\u0641\u0635\u0644\u062A" },
  42: { arabic: "\u0627\u0644\u0634\u0648\u0631\u0649", persian: "\u0634\u0648\u0631\u06CC" },
  43: { arabic: "\u0627\u0644\u0632\u062E\u0631\u0641", persian: "\u0632\u062E\u0631\u0641" },
  44: { arabic: "\u0627\u0644\u062F\u062E\u0627\u0646", persian: "\u062F\u062E\u0627\u0646" },
  45: { arabic: "\u0627\u0644\u062C\u0627\u062B\u064A\u0629", persian: "\u062C\u0627\u062B\u06CC\u0647" },
  46: { arabic: "\u0627\u0644\u0623\u062D\u0642\u0627\u0641", persian: "\u0627\u062D\u0642\u0627\u0641" },
  47: { arabic: "\u0645\u062D\u0645\u062F", persian: "\u0645\u062D\u0645\u062F" },
  48: { arabic: "\u0627\u0644\u0641\u062A\u062D", persian: "\u0641\u062A\u062D" },
  49: { arabic: "\u0627\u0644\u062D\u062C\u0631\u0627\u062A", persian: "\u062D\u062C\u0631\u0627\u062A" },
  50: { arabic: "\u0642", persian: "\u0642" },
  51: { arabic: "\u0627\u0644\u0630\u0627\u0631\u064A\u0627\u062A", persian: "\u0630\u0627\u0631\u06CC\u0627\u062A" },
  52: { arabic: "\u0627\u0644\u0637\u0648\u0631", persian: "\u0637\u0648\u0631" },
  53: { arabic: "\u0627\u0644\u0646\u062C\u0645", persian: "\u0646\u062C\u0645" },
  54: { arabic: "\u0627\u0644\u0642\u0645\u0631", persian: "\u0642\u0645\u0631" },
  55: { arabic: "\u0627\u0644\u0631\u062D\u0645\u0646", persian: "\u0627\u0644\u0631\u062D\u0645\u0646" },
  56: { arabic: "\u0627\u0644\u0648\u0627\u0642\u0639\u0629", persian: "\u0648\u0627\u0642\u0639\u0647" },
  57: { arabic: "\u0627\u0644\u062D\u062F\u064A\u062F", persian: "\u062D\u062F\u06CC\u062F" },
  58: { arabic: "\u0627\u0644\u0645\u062C\u0627\u062F\u0644\u0629", persian: "\u0645\u062C\u0627\u062F\u0644\u0647" },
  59: { arabic: "\u0627\u0644\u062D\u0634\u0631", persian: "\u062D\u0634\u0631" },
  60: { arabic: "\u0627\u0644\u0645\u0645\u062A\u062D\u0646\u0629", persian: "\u0645\u0645\u062A\u062D\u0646\u0647" },
  61: { arabic: "\u0627\u0644\u0635\u0641", persian: "\u0635\u0641" },
  62: { arabic: "\u0627\u0644\u062C\u0645\u0639\u0629", persian: "\u062C\u0645\u0639\u0647" },
  63: { arabic: "\u0627\u0644\u0645\u0646\u0627\u0641\u0642\u0648\u0646", persian: "\u0645\u0646\u0627\u0641\u0642\u0648\u0646" },
  64: { arabic: "\u0627\u0644\u062A\u063A\u0627\u0628\u0646", persian: "\u062A\u063A\u0627\u0628\u0646" },
  65: { arabic: "\u0627\u0644\u0637\u0644\u0627\u0642", persian: "\u0637\u0644\u0627\u0642" },
  66: { arabic: "\u0627\u0644\u062A\u062D\u0631\u064A\u0645", persian: "\u062A\u062D\u0631\u06CC\u0645" },
  67: { arabic: "\u0627\u0644\u0645\u0644\u0643", persian: "\u0645\u0644\u06A9" },
  68: { arabic: "\u0627\u0644\u0642\u0644\u0645", persian: "\u0642\u0644\u0645" },
  69: { arabic: "\u0627\u0644\u062D\u0627\u0642\u0629", persian: "\u062D\u0627\u0642\u0647" },
  70: { arabic: "\u0627\u0644\u0645\u0639\u0627\u0631\u062C", persian: "\u0645\u0639\u0627\u0631\u062C" },
  71: { arabic: "\u0646\u0648\u062D", persian: "\u0646\u0648\u062D" },
  72: { arabic: "\u0627\u0644\u062C\u0646", persian: "\u062C\u0646" },
  73: { arabic: "\u0627\u0644\u0645\u0632\u0645\u0644", persian: "\u0645\u0632\u0645\u0644" },
  74: { arabic: "\u0627\u0644\u0645\u062F\u062B\u0631", persian: "\u0645\u062F\u062B\u0631" },
  75: { arabic: "\u0627\u0644\u0642\u064A\u0627\u0645\u0629", persian: "\u0642\u06CC\u0627\u0645\u062A" },
  76: { arabic: "\u0627\u0644\u0625\u0646\u0633\u0627\u0646", persian: "\u0627\u0646\u0633\u0627\u0646" },
  77: { arabic: "\u0627\u0644\u0645\u0631\u0633\u0644\u0627\u062A", persian: "\u0645\u0631\u0633\u0644\u0627\u062A" },
  78: { arabic: "\u0627\u0644\u0646\u0628\u0623", persian: "\u0646\u0628\u0623" },
  79: { arabic: "\u0627\u0644\u0646\u0627\u0632\u0639\u0627\u062A", persian: "\u0646\u0627\u0632\u0639\u0627\u062A" },
  80: { arabic: "\u0639\u0628\u0633", persian: "\u0639\u0628\u0633" },
  81: { arabic: "\u0627\u0644\u062A\u0643\u0648\u064A\u0631", persian: "\u062A\u06A9\u0648\u06CC\u0631" },
  82: { arabic: "\u0627\u0644\u0627\u0646\u0641\u0637\u0627\u0631", persian: "\u0627\u0646\u0641\u0637\u0627\u0631" },
  83: { arabic: "\u0627\u0644\u0645\u0637\u0641\u0641\u064A\u0646", persian: "\u0645\u0637\u0641\u0641\u06CC\u0646" },
  84: { arabic: "\u0627\u0644\u0627\u0646\u0634\u0642\u0627\u0642", persian: "\u0627\u0646\u0634\u0642\u0627\u0642" },
  85: { arabic: "\u0627\u0644\u0628\u0631\u0648\u062C", persian: "\u0628\u0631\u0648\u062C" },
  86: { arabic: "\u0627\u0644\u0637\u0627\u0631\u0642", persian: "\u0637\u0627\u0631\u0642" },
  87: { arabic: "\u0627\u0644\u0623\u0639\u0644\u0649", persian: "\u0627\u0639\u0644\u06CC" },
  88: { arabic: "\u0627\u0644\u063A\u0627\u0634\u064A\u0629", persian: "\u063A\u0627\u0634\u06CC\u0647" },
  89: { arabic: "\u0627\u0644\u0641\u062C\u0631", persian: "\u0641\u062C\u0631" },
  90: { arabic: "\u0627\u0644\u0628\u0644\u062F", persian: "\u0628\u0644\u062F" },
  91: { arabic: "\u0627\u0644\u0634\u0645\u0633", persian: "\u0634\u0645\u0633" },
  92: { arabic: "\u0627\u0644\u0644\u064A\u0644", persian: "\u0644\u06CC\u0644" },
  93: { arabic: "\u0627\u0644\u0636\u062D\u0649", persian: "\u0636\u062D\u06CC" },
  94: { arabic: "\u0627\u0644\u0634\u0631\u062D", persian: "\u0627\u0646\u0634\u0631\u0627\u062D" },
  95: { arabic: "\u0627\u0644\u062A\u064A\u0646", persian: "\u062A\u06CC\u0646" },
  96: { arabic: "\u0627\u0644\u0639\u0644\u0642", persian: "\u0639\u0644\u0642" },
  97: { arabic: "\u0627\u0644\u0642\u062F\u0631", persian: "\u0642\u062F\u0631" },
  98: { arabic: "\u0627\u0644\u0628\u064A\u0646\u0629", persian: "\u0628\u06CC\u0646\u0647" },
  99: { arabic: "\u0627\u0644\u0632\u0644\u0632\u0644\u0629", persian: "\u0632\u0644\u0632\u0644\u0647" },
  100: { arabic: "\u0627\u0644\u0639\u0627\u062F\u064A\u0627\u062A", persian: "\u0639\u0627\u062F\u06CC\u0627\u062A" },
  101: { arabic: "\u0627\u0644\u0642\u0627\u0631\u0639\u0629", persian: "\u0642\u0627\u0631\u0639\u0647" },
  102: { arabic: "\u0627\u0644\u062A\u0643\u0627\u062B\u0631", persian: "\u062A\u06A9\u0627\u062B\u0631" },
  103: { arabic: "\u0627\u0644\u0639\u0635\u0631", persian: "\u0639\u0635\u0631" },
  104: { arabic: "\u0627\u0644\u0647\u0645\u0632\u0629", persian: "\u0647\u0645\u0632\u0647" },
  105: { arabic: "\u0627\u0644\u0641\u064A\u0644", persian: "\u0641\u06CC\u0644" },
  106: { arabic: "\u0642\u0631\u064A\u0634", persian: "\u0642\u0631\u06CC\u0634" },
  107: { arabic: "\u0627\u0644\u0645\u0627\u0639\u0648\u0646", persian: "\u0645\u0627\u0639\u0648\u0646" },
  108: { arabic: "\u0627\u0644\u0643\u0648\u062B\u0631", persian: "\u06A9\u0648\u062B\u0631" },
  109: { arabic: "\u0627\u0644\u0643\u0627\u0641\u0631\u0648\u0646", persian: "\u06A9\u0627\u0641\u0631\u0648\u0646" },
  110: { arabic: "\u0627\u0644\u0646\u0635\u0631", persian: "\u0646\u0635\u0631" },
  111: { arabic: "\u0627\u0644\u0645\u0633\u062F", persian: "\u0645\u0633\u062F" },
  112: { arabic: "\u0627\u0644\u0625\u062E\u0644\u0627\u0635", persian: "\u062A\u0648\u062D\u06CC\u062F" },
  113: { arabic: "\u0627\u0644\u0641\u0644\u0642", persian: "\u0641\u0644\u0642" },
  114: { arabic: "\u0627\u0644\u0646\u0627\u0633", persian: "\u0646\u0627\u0633" }
};
function getSurahInfo(surahId) {
  return SURAH_NAMES[surahId] || { arabic: `\u0633\u0648\u0631\u0647 ${surahId}`, persian: `\u0633\u0648\u0631\u0647 ${surahId}` };
}
function createQuranSource(surahId, verseNumber) {
  const surah = getSurahInfo(surahId);
  return {
    id: `quran:${surahId}:${verseNumber}`,
    title: `\u0633\u0648\u0631\u0647 ${surah.arabic} (${surah.persian})\u060C \u0622\u06CC\u0647 ${toPersianDigits(verseNumber)}`,
    type: "quran",
    reference: `${surah.arabic}: ${toPersianDigits(verseNumber)}`,
    sourceName: "\u0642\u0631\u0622\u0646 \u06A9\u0631\u06CC\u0645 (\u062A\u0631\u062C\u0645\u0647 \u0622\u06CC\u062A\u200C\u0627\u0644\u0644\u0647 \u0627\u0644\u0639\u0638\u0645\u06CC \u0645\u06A9\u0627\u0631\u0645 \u0634\u06CC\u0631\u0627\u0632\u06CC)",
    url: `/quran/${surahId}/${verseNumber}`,
    isInternal: true,
    metadata: {
      surahId,
      verseNumber,
      surahName: surah.arabic
    }
  };
}
function createTafsirMizanSource(surahId, verseNumber) {
  const surah = getSurahInfo(surahId);
  return {
    id: `tafsir:mizan:${surahId}:${verseNumber}`,
    title: `\u062A\u0641\u0633\u06CC\u0631 \u0627\u0644\u0645\u06CC\u0632\u0627\u0646 \u2014 \u0630\u06CC\u0644 \u0622\u06CC\u0647 ${toPersianDigits(verseNumber)} \u0633\u0648\u0631\u0647 ${surah.arabic}`,
    type: "tafsir",
    reference: `\u0627\u0644\u0645\u06CC\u0632\u0627\u0646 \u0641\u06CC \u062A\u0641\u0633\u06CC\u0631 \u0627\u0644\u0642\u0631\u0622\u0646 (\u0639\u0644\u0627\u0645\u0647 \u0637\u0628\u0627\u0637\u0628\u0627\u06CC\u06CC)\u060C \u0630\u06CC\u0644 ${surah.arabic}:${toPersianDigits(verseNumber)}`,
    sourceName: "\u062A\u0641\u0633\u06CC\u0631 \u0627\u0644\u0645\u06CC\u0632\u0627\u0646 (\u0639\u0644\u0627\u0645\u0647 \u0633\u06CC\u062F \u0645\u062D\u0645\u062F\u062D\u0633\u06CC\u0646 \u0637\u0628\u0627\u0637\u0628\u0627\u06CC\u06CC)",
    url: `https://quran.inoor.ir/fa/ayah/${surahId}/${verseNumber}/commentary`,
    isInternal: false,
    metadata: {
      surahId,
      verseNumber,
      surahName: surah.arabic
    }
  };
}

// app.ts
function getEnvKey(name) {
  return (process.env[name] || "").trim();
}
function isAiEnabled() {
  const configured = getEnvKey("AI_ENABLED").toLowerCase();
  return configured !== "false";
}
function createApp() {
  const app2 = express();
  app2.set("trust proxy", true);
  app2.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Device-ID");
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    if (req.query && req.query.path) {
      const segments = Array.isArray(req.query.path) ? req.query.path.join("/") : String(req.query.path);
      const reconstructed = `/api/${segments.replace(/^\/+/, "")}`;
      if (req.url !== reconstructed && !req.url.startsWith(reconstructed)) {
        req.url = reconstructed;
      }
    } else {
      const matchedPath = req.headers["x-matched-path"] || "";
      if (matchedPath && matchedPath.startsWith("/api/")) {
        req.url = matchedPath;
      } else if (req.originalUrl && req.originalUrl.startsWith("/api/") && (req.url === "/api" || req.url === "/api/" || req.url === "/")) {
        req.url = req.originalUrl;
      } else if (req.query && (req.query["0"] || req.query["1"])) {
        const captured = String(req.query["0"] || req.query["1"]);
        req.url = `/api/${captured.replace(/^\/+/, "")}`;
      }
    }
    next();
  });
  app2.use(express.json({ limit: "24kb" }));
  app2.get(["/api", "/api/"], (_req, res) => {
    res.json({
      status: "ok",
      service: "Quran Mobin API",
      aiAvailable: isAiEnabled() && hasConfiguredProvider(),
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app2.get(["/api/health", "/health"], (req, res) => {
    res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app2.get("/manifest.json", (req, res) => {
    res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
    res.sendFile(path.join(process.cwd(), "public", "manifest.json"));
  });
  app2.get("/.well-known/assetlinks.json", (req, res) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    const distPath = path.join(process.cwd(), "dist", ".well-known", "assetlinks.json");
    const publicPath = path.join(process.cwd(), "public", ".well-known", "assetlinks.json");
    if (fs.existsSync(distPath)) {
      return res.sendFile(distPath);
    } else if (fs.existsSync(publicPath)) {
      return res.sendFile(publicPath);
    }
    res.json([]);
  });
  app2.get(["/sw.js", "/dev-dist/sw.js"], (req, res) => {
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Service-Worker-Allowed", "/");
    const devPath = path.join(process.cwd(), "dev-dist", "sw.js");
    const distPath = path.join(process.cwd(), "dist", "sw.js");
    const publicPath = path.join(process.cwd(), "public", "sw.js");
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
  app2.use("/dev-dist", express.static(path.join(process.cwd(), "dev-dist")));
  app2.get(["/api/audio/proxy", "/audio/proxy"], async (req, res) => {
    const targetUrl = (req.query.url || "").trim();
    if (!targetUrl || !targetUrl.startsWith("https://")) {
      return res.status(400).send("Invalid audio URL");
    }
    const allowedHosts = [
      "everyayah.com",
      "www.everyayah.com",
      "islamic.network",
      "cdn.islamic.network",
      "huggingface.co",
      "qurancdn.com",
      "verses.quran.com",
      "quranicaudio.com",
      "download.quranicaudio.com"
    ];
    try {
      const parsed = new URL(targetUrl);
      const isAllowed = allowedHosts.some((h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`));
      if (!isAllowed) {
        return res.status(403).send("Audio host not permitted");
      }
      const audioRes = await fetch(targetUrl, {
        headers: {
          "User-Agent": "QuranMobinApp/2.0 (AudioProxy)",
          ...req.headers.range ? { Range: req.headers.range } : {}
        }
      });
      if (!audioRes.ok || !audioRes.body) {
        return res.status(audioRes.status).send("Failed to fetch audio stream");
      }
      res.status(audioRes.status);
      res.setHeader("Content-Type", audioRes.headers.get("content-type") || "audio/mpeg");
      res.setHeader("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400");
      res.setHeader("Access-Control-Allow-Origin", "*");
      const contentLength = audioRes.headers.get("content-length");
      if (contentLength) res.setHeader("Content-Length", contentLength);
      const contentRange = audioRes.headers.get("content-range");
      if (contentRange) res.setHeader("Content-Range", contentRange);
      const acceptRanges = audioRes.headers.get("accept-ranges");
      if (acceptRanges) res.setHeader("Accept-Ranges", acceptRanges);
      const reader = audioRes.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } catch (err) {
      console.warn("Audio proxy error:", err?.message || err);
      if (!res.headersSent) {
        res.status(502).send("Error streaming audio");
      }
    }
  });
  app2.get(["/api/ai/status", "/ai/status"], (req, res) => {
    res.json({
      enabled: isAiEnabled() && !["1", "true"].includes(getEnvKey("AI_KILL_SWITCH").toLowerCase()) && hasConfiguredProvider()
    });
  });
  app2.post(["/api/ai/ask", "/ai/ask"], async (req, res) => {
    const requestId = randomUUID();
    const parsed = aiAskRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "\u062F\u0631\u062E\u0648\u0627\u0633\u062A \u062F\u0633\u062A\u06CC\u0627\u0631 \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A.", code: "invalid_request", requestId });
    }
    if (!isAiEnabled() || ["1", "true"].includes(getEnvKey("AI_KILL_SWITCH").toLowerCase())) {
      return res.status(503).json({ error: "\u062F\u0633\u062A\u06CC\u0627\u0631 \u0647\u0648\u0634\u0645\u0646\u062F \u062F\u0631 \u062F\u0633\u062A\u0631\u0633 \u0646\u06CC\u0633\u062A.", code: "ai_unavailable", requestId });
    }
    if (!hasConfiguredProvider()) {
      return res.status(503).json({ error: "\u062F\u0633\u062A\u06CC\u0627\u0631 \u0647\u0648\u0634\u0645\u0646\u062F \u062F\u0631 \u062F\u0633\u062A\u0631\u0633 \u0646\u06CC\u0633\u062A.", code: "ai_unavailable", requestId });
    }
    const forwardedIp = req.header("x-forwarded-for")?.split(",")[0]?.trim();
    const ip = forwardedIp || req.ip || "unknown";
    const deviceId = (req.header("x-device-id") || "").trim();
    if (deviceId.length < 8 || deviceId.length > 128) {
      return res.status(400).json({ error: "\u0634\u0646\u0627\u0633\u0647\u0654 \u062F\u0633\u062A\u06AF\u0627\u0647 \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A.", code: "invalid_device", requestId });
    }
    const quota = await consumeDailyQuota(hashRateLimitKey(ip, deviceId));
    if (!quota.allowed) {
      const status = quota.used === 0 ? 503 : 429;
      return res.status(status).json({
        error: status === 429 ? "\u0633\u0647\u0645\u06CC\u0647\u0654 \u0631\u0648\u0632\u0627\u0646\u0647\u0654 \u062F\u0633\u062A\u06CC\u0627\u0631 \u062A\u0645\u0627\u0645 \u0634\u062F\u0647 \u0627\u0633\u062A." : "\u0633\u0631\u0648\u06CC\u0633 \u0633\u0647\u0645\u06CC\u0647 \u062F\u0631 \u062F\u0633\u062A\u0631\u0633 \u0646\u06CC\u0633\u062A.",
        code: status === 429 ? "daily_limit_reached" : "quota_unavailable",
        requestId,
        resetAt: quota.resetAt
      });
    }
    const userQuestion = parsed.data.question.trim();
    const intent = detectIntent(userQuestion, !!parsed.data.currentVerse);
    const enableWebSearch = false;
    const knownCatalog = [];
    if (parsed.data.currentVerse) {
      const sId = parsed.data.currentVerse.surahId;
      const vNum = parsed.data.currentVerse.verseNumber;
      knownCatalog.push(createQuranSource(sId, vNum), createTafsirMizanSource(sId, vNum));
    }
    let verseContext = "";
    if (parsed.data.currentVerse) {
      verseContext = `\u0622\u06CC\u0647\u200C\u0627\u06CC \u06A9\u0647 \u06A9\u0627\u0631\u0628\u0631 \u0628\u0631\u0627\u06CC \u06AF\u0641\u062A\u06AF\u0648 \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0631\u062F\u0647 \u0627\u0633\u062A (\u0641\u0642\u0637 \u0632\u0645\u06CC\u0646\u0647\u0654 \u06AF\u0641\u062A\u06AF\u0648):
${parsed.data.currentVerse.textArabic || ""}
\u062A\u0631\u062C\u0645\u0647\u0654 \u0646\u0645\u0627\u06CC\u0634\u200C\u062F\u0627\u062F\u0647\u200C\u0634\u062F\u0647 \u062F\u0631 \u0628\u0631\u0646\u0627\u0645\u0647: ${parsed.data.currentVerse.translationMakarem || ""}`;
    }
    const historyContext = (parsed.data.history || []).slice(-4).map((m) => `${m.role === "user" ? "\u06A9\u0627\u0631\u0628\u0631" : "\u062F\u0633\u062A\u06CC\u0627\u0631"}: ${m.content.slice(0, 250)}`).join("\n");
    const agentApproachText = {
      moral: "\u0631\u0648\u06CC\u06A9\u0631\u062F \u06A9\u0627\u0631\u0628\u0631\u062F\u06CC \u0648 \u0627\u062E\u0644\u0627\u0642\u06CC: \u062F\u0631 \u0633\u0628\u06A9 \u0632\u0646\u062F\u06AF\u06CC\u060C \u0622\u0631\u0627\u0645\u0634 \u062F\u0644\u060C \u0627\u0645\u06CC\u062F\u0628\u062E\u0634\u06CC \u0648 \u0627\u062E\u0644\u0627\u0642 \u0641\u0631\u062F\u06CC \u0648 \u0627\u062C\u062A\u0645\u0627\u0639\u06CC \u0645\u062A\u0645\u0631\u06A9\u0632 \u0634\u0648.",
      conceptual: "\u0631\u0648\u06CC\u06A9\u0631\u062F \u062A\u062F\u0628\u0651\u0631 \u0645\u0641\u0647\u0648\u0645\u06CC: \u062F\u0631 \u067E\u06CC\u0627\u0645\u200C\u0647\u0627\u06CC \u06A9\u0644\u06CC\u060C \u067E\u06CC\u0648\u0646\u062F \u0622\u06CC\u0647 \u0628\u0627 \u0633\u0627\u06CC\u0631 \u0622\u0645\u0648\u0632\u0647\u200C\u0647\u0627\u06CC \u0642\u0631\u0622\u0646 \u0648 \u0645\u0639\u0627\u0631\u0641 \u062A\u0648\u062D\u06CC\u062F\u06CC \u0645\u062A\u0645\u0631\u06A9\u0632 \u0634\u0648.",
      literary: "\u0631\u0648\u06CC\u06A9\u0631\u062F \u0627\u062F\u0628\u06CC \u0648 \u0648\u0627\u0698\u0647\u200C\u0634\u0646\u0627\u0633\u06CC: \u0628\u0631 \u0648\u062C\u0648\u0647 \u0628\u06CC\u0627\u0646\u06CC\u060C \u062A\u0646\u0627\u0633\u0628 \u0648\u0627\u0698\u0647\u200C\u0647\u0627 \u0648 \u067E\u06CC\u0627\u0645\u200C\u0647\u0627\u06CC \u0639\u0645\u06CC\u0642 \u0644\u063A\u0648\u06CC \u0645\u062A\u0645\u0631\u06A9\u0632 \u0634\u0648.",
      rational: "\u0631\u0648\u06CC\u06A9\u0631\u062F \u0639\u0642\u0644\u06CC \u0648 \u0627\u0639\u062A\u0642\u0627\u062F\u06CC: \u0628\u0631 \u067E\u0627\u0633\u062E\u200C\u0647\u0627\u06CC \u0627\u0633\u062A\u062F\u0644\u0627\u0644\u06CC \u0648 \u0628\u0627\u0648\u0631\u0647\u0627\u06CC \u0641\u06A9\u0631\u06CC \u062F\u0631 \u067E\u0631\u062A\u0648 \u0622\u06CC\u0647 \u0645\u062A\u0645\u0631\u06A9\u0632 \u0634\u0648."
    }[parsed.data.agent || "moral"];
    const system = `\u062A\u0648 \xAB\u062F\u0633\u062A\u06CC\u0627\u0631 \u0645\u0631\u06A9\u0632\u06CC \u0648 \u0647\u0648\u0634\u0645\u0646\u062F \u062A\u062F\u0628\u0651\u0631 \u062F\u0631 \u0642\u0631\u0622\u0646 \u0645\u0628\u06CC\u0646\xBB \u0647\u0633\u062A\u06CC.
\u0648\u06CC\u0698\u06AF\u06CC\u200C\u0647\u0627\u06CC \u0628\u0646\u06CC\u0627\u062F\u06CC\u0646: \u06AF\u0641\u062A\u200C\u0648\u06AF\u0648\u0645\u062D\u0648\u0631\u060C \u0635\u0645\u06CC\u0645\u06CC\u060C \u062F\u0627\u0646\u0627\u060C \u0645\u062D\u062A\u0631\u0645\u060C \u067E\u0627\u0633\u062E\u200C\u0647\u0627\u06CC \u06A9\u0648\u062A\u0627\u0647 \u0648 \u0637\u0628\u06CC\u0639\u06CC\u060C \u062E\u0631\u062F\u0648\u0631\u0632\u0627\u0646\u0647 \u0648 \u0622\u0631\u0627\u0645\u0634\u200C\u0628\u062E\u0634.
\u0646\u0648\u0639 \u0646\u06CC\u0627\u0632 \u062A\u0634\u062E\u06CC\u0635\u200C\u062F\u0627\u062F\u0647\u200C\u0634\u062F\u0647 (Intent): ${intent}
${agentApproachText}

\u062F\u0633\u062A\u0648\u0631\u0627\u0644\u0639\u0645\u0644\u200C\u0647\u0627\u06CC \u0628\u0633\u06CC\u0627\u0631 \u0645\u0647\u0645 \u0648 \u06A9\u0644\u06CC\u062F\u06CC:
\u06F1. \u0631\u0641\u062A\u0627\u0631 \u0645\u062A\u0646\u0627\u0633\u0628 \u0628\u0627 \u0646\u0648\u0639 \u062F\u0631\u062E\u0648\u0627\u0633\u062A:
- \u0627\u06AF\u0631 Intent \u0628\u0631\u0627\u0628\u0631 \xABcasual_chat\xBB \u0627\u0633\u062A (\u0633\u0644\u0627\u0645\u060C \u0627\u062D\u0648\u0627\u0644\u200C\u067E\u0631\u0633\u06CC\u060C \u062A\u0634\u06A9\u0631\u060C \u0634\u0648\u062E\u06CC\u060C \u0633\u0648\u0627\u0644 \u062F\u0631\u0628\u0627\u0631\u0647 \u0647\u0648\u06CC\u062A \u062F\u0633\u062A\u06CC\u0627\u0631):
  \u0628\u0647 \u0647\u06CC\u0686 \u0648\u062C\u0647 \u067E\u0627\u0633\u062E \u0637\u0648\u0644\u0627\u0646\u06CC\u060C \u0622\u06CC\u0627\u062A \u0646\u0627\u06AF\u0647\u0627\u0646\u06CC \u0648 \u0645\u062A\u0646\u200C\u0647\u0627\u06CC \u062D\u062C\u06CC\u0645 \u0627\u0631\u0633\u0627\u0644 \u0646\u06A9\u0646! \u067E\u0627\u0633\u062E\u06CC \u06A9\u0648\u062A\u0627\u0647\u060C \u0628\u0633\u06CC\u0627\u0631 \u06AF\u0631\u0645 \u0648 \u0635\u0645\u06CC\u0645\u0627\u0646\u0647 \u0628\u062F\u0647 (\u0645\u062B\u0644\u0627\u064B: \xAB\u0633\u0644\u0627\u0645 \u0648 \u062F\u0631\u0648\u062F \u067E\u0631\u0648\u0631\u062F\u06AF\u0627\u0631 \u0628\u0631 \u0634\u0645\u0627 \u062F\u0648\u0633\u062A \u06AF\u0631\u0627\u0645\u06CC...\xBB) \u0648 \u0645\u0634\u062A\u0627\u0642\u0627\u0646\u0647 \u0628\u067E\u0631\u0633 \u0645\u0627\u06CC\u0644 \u0627\u0633\u062A \u0627\u0645\u0631\u0648\u0632 \u067E\u06CC\u0631\u0627\u0645\u0648\u0646 \u06A9\u062F\u0627\u0645 \u0645\u0641\u0647\u0648\u0645\u060C \u0633\u0648\u0631\u0647\u060C \u062F\u063A\u062F\u063A\u0647 \u0632\u0646\u062F\u06AF\u06CC \u06CC\u0627 \u0645\u0648\u0636\u0648\u0639 \u0642\u0631\u0622\u0646\u06CC \u0628\u0627 \u0647\u0645 \u06AF\u0641\u062A\u06AF\u0648 \u06A9\u0646\u06CC\u0645. \u0622\u0631\u0627\u06CC\u0647 used_source_ids \u0631\u0627 \u062E\u0627\u0644\u06CC [] \u0628\u06AF\u0630\u0627\u0631.
- \u0627\u06AF\u0631 Intent \u0628\u0631\u0627\u0628\u0631 \xABquran_inquiry\xBB \u0627\u0633\u062A:
  \u0622\u0632\u0627\u062F\u0627\u0646\u0647 \u0628\u0631 \u067E\u0627\u06CC\u0647\u0654 \u062F\u0627\u0646\u0634 \u062E\u0648\u062F\u062A \u067E\u0627\u0633\u062E \u0628\u062F\u0647. \u0627\u06AF\u0631 \u0622\u06CC\u0647\u0654 \u0627\u0646\u062A\u062E\u0627\u0628\u200C\u0634\u062F\u0647 \u062F\u0631 \u0632\u0645\u06CC\u0646\u0647 \u0622\u0645\u062F\u0647\u060C \u0622\u0646 \u0631\u0627 \u0645\u0648\u0636\u0648\u0639 \u06AF\u0641\u062A\u06AF\u0648 \u0628\u062F\u0627\u0646\u061B \u0647\u06CC\u0686 \u0645\u062A\u0646 \u0628\u0627\u0632\u06CC\u0627\u0628\u06CC\u200C\u0634\u062F\u0647 \u06CC\u0627 \u0645\u0646\u0628\u0639\u06CC \u062F\u0631 \u0627\u062E\u062A\u06CC\u0627\u0631 \u062A\u0648 \u0646\u06CC\u0633\u062A. \u062F\u0631\u0628\u0627\u0631\u0647\u0654 \u0646\u0642\u0644\u200C\u0642\u0648\u0644 \u062F\u0642\u06CC\u0642\u060C \u0634\u0645\u0627\u0631\u0647 \u0622\u06CC\u0647 \u06CC\u0627 \u0627\u0646\u062A\u0633\u0627\u0628 \u062F\u06CC\u062F\u06AF\u0627\u0647 \u0628\u0647 \u0645\u0641\u0633\u0631 \u062F\u0631 \u0635\u0648\u0631\u062A \u0627\u0637\u0645\u06CC\u0646\u0627\u0646 \u0646\u062F\u0627\u0634\u062A\u0646 \u0627\u062F\u0639\u0627\u06CC \u0642\u0637\u0639\u06CC \u0646\u06A9\u0646.
- \u0627\u06AF\u0631 Intent \u0628\u0631\u0627\u0628\u0631 \xABcurrent_info\xBB \u0627\u0633\u062A:
  \u0627\u06AF\u0631 \u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0627\u0632 \u062F\u0627\u0646\u0634 \u062E\u0648\u062F\u062A \u06A9\u0627\u0641\u06CC \u0646\u06CC\u0633\u062A \u06CC\u0627 \u0645\u0645\u06A9\u0646 \u0627\u0633\u062A \u062A\u063A\u06CC\u06CC\u0631 \u06A9\u0631\u062F\u0647 \u0628\u0627\u0634\u062F\u060C \u0645\u062D\u062F\u0648\u062F\u06CC\u062A \u062F\u0627\u0646\u0633\u062A\u0647\u200C\u0647\u0627\u06CC\u062A \u0631\u0627 \u0634\u0641\u0627\u0641 \u0628\u06AF\u0648 \u0648 \u0627\u062F\u0639\u0627\u06CC \u062C\u0633\u062A\u062C\u0648\u06CC \u0648\u0628 \u0646\u06A9\u0646.
- \u0627\u06AF\u0631 Intent \u0628\u0631\u0627\u0628\u0631 \xABhybrid\xBB \u0627\u0633\u062A:
  \u067E\u06CC\u0648\u0646\u062F \u0645\u0648\u0636\u0648\u0639 \u0631\u0627 \u0628\u0627 \u0645\u0641\u0627\u0647\u06CC\u0645 \u0645\u0639\u0627\u0635\u0631 \u0628\u0647 \u0635\u0648\u0631\u062A \u062E\u0631\u062F\u0648\u0631\u0632\u0627\u0646\u0647 \u0648 \u0631\u0648\u0634\u0646 \u062A\u0628\u06CC\u06CC\u0646 \u06A9\u0646\u060C \u0628\u062F\u0648\u0646 \u0627\u062F\u0639\u0627\u06CC \u062F\u0633\u062A\u0631\u0633\u06CC \u0628\u0647 \u0645\u0646\u0628\u0639 \u0628\u06CC\u0631\u0648\u0646\u06CC.

\u06F2. \u067E\u0627\u0633\u062E \u06A9\u0648\u062A\u0627\u0647 \u0648 \u0645\u0633\u062A\u0646\u062F:
- summary: \u067E\u0627\u0633\u062E \u0645\u0633\u062A\u0642\u06CC\u0645 \u0648 \u06A9\u0648\u062A\u0627\u0647 \u0628\u0647 \u067E\u0631\u0633\u0634\u060C \u062D\u062F\u0627\u06A9\u062B\u0631 \u0633\u0647 \u062C\u0645\u0644\u0647 \u0648 \u0628\u0631 \u067E\u0627\u06CC\u0647\u0654 \u062F\u0627\u0646\u0634 \u062E\u0648\u062F\u062A\u061B \u0622\u0646 \u0631\u0627 \u0628\u0647 \u0645\u0641\u0633\u0631\u06CC \u0646\u0633\u0628\u062A \u0646\u062F\u0647 \u0645\u06AF\u0631 \u06A9\u0627\u0631\u0628\u0631 \u0645\u062A\u0646 \u0645\u0634\u062E\u0635\u06CC \u0627\u0632 \u0627\u0648 \u062F\u0627\u062F\u0647 \u0628\u0627\u0634\u062F.
- direct_answer: \u062E\u0627\u0644\u06CC \u0628\u06AF\u0630\u0627\u0631\u061B \u062E\u0644\u0627\u0635\u0647 \u062F\u0631 summary \u06A9\u0627\u0641\u06CC \u0627\u0633\u062A.
- source_quote: \u062E\u0627\u0644\u06CC \u0628\u06AF\u0630\u0627\u0631 \u0645\u06AF\u0631 \u06A9\u0627\u0631\u0628\u0631 \u0635\u0631\u06CC\u062D\u0627\u064B \u0645\u062A\u0646 \u0622\u06CC\u0647 \u06CC\u0627 \u0631\u0648\u0627\u06CC\u062A \u0631\u0627 \u062E\u0648\u0627\u0633\u062A\u0647 \u0628\u0627\u0634\u062F. \u062A\u0631\u062C\u0645\u0647\u200C\u0627\u06CC \u0631\u0627 \u06A9\u0647 \u0631\u0627\u0628\u0637 \u0642\u0628\u0644\u0627\u064B \u0646\u0645\u0627\u06CC\u0634 \u062F\u0627\u062F\u0647 \u062A\u06A9\u0631\u0627\u0631 \u0646\u06A9\u0646.
- ai_analysis: \u062F\u0631 \u0635\u0648\u0631\u062A \u0646\u06CC\u0627\u0632\u060C \u062D\u062F\u0627\u06A9\u062B\u0631 \u062F\u0648 \u062C\u0645\u0644\u0647 \u062A\u062D\u0644\u06CC\u0644 \u06CC\u0627 \u062A\u0623\u0645\u0644 \u0645\u0633\u062A\u0642\u0644 \u0627\u0631\u0627\u0626\u0647 \u06A9\u0646\u061B \u0631\u0648\u0634\u0646 \u0628\u0627\u0634\u062F \u0628\u0631\u062F\u0627\u0634\u062A \u062E\u0648\u062F \u0647\u0648\u0634 \u0645\u0635\u0646\u0648\u0639\u06CC \u0627\u0633\u062A\u060C \u0646\u0647 \u062A\u0641\u0633\u06CC\u0631 \u0631\u0633\u0645\u06CC.
- practical_takeaway: \u062E\u0627\u0644\u06CC \u0628\u06AF\u0630\u0627\u0631 \u0645\u06AF\u0631 \u06A9\u0627\u0631\u0628\u0631 \u0635\u0631\u06CC\u062D\u0627\u064B \u06A9\u0627\u0631\u0628\u0631\u062F \u0639\u0645\u0644\u06CC \u062E\u0648\u0627\u0633\u062A\u0647 \u0628\u0627\u0634\u062F.
- socratic_questions: \u062D\u062F\u0627\u06A9\u062B\u0631 \u06CC\u06A9 \u067E\u0631\u0633\u0634 \u06A9\u0648\u062A\u0627\u0647\u060C \u0641\u0642\u0637 \u0648\u0642\u062A\u06CC \u0628\u0647 \u06AF\u0641\u062A\u06AF\u0648 \u06A9\u0645\u06A9 \u0645\u06CC\u200C\u06A9\u0646\u062F.
- used_source_ids: \u0647\u0645\u06CC\u0634\u0647 \u0622\u0631\u0627\u06CC\u0647\u0654 \u062E\u0627\u0644\u06CC \u0628\u06AF\u0630\u0627\u0631\u061B \u0647\u06CC\u0686 \u0645\u0646\u0628\u0639 \u0628\u06CC\u0631\u0648\u0646\u06CC \u0628\u0631\u0627\u06CC \u0627\u06CC\u0646 \u067E\u0627\u0633\u062E \u0628\u0627\u0632\u06CC\u0627\u0628\u06CC \u0646\u0634\u062F\u0647 \u0627\u0633\u062A.

\u06F3. \u0642\u0627\u0644\u0628 \u062E\u0631\u0648\u062C\u06CC \u0627\u0644\u0632\u0627\u0645\u06CC:
\u0641\u0642\u0637 \u06CC\u06A9 \u0634\u06CC\u0621 JSON \u0645\u0639\u062A\u0628\u0631 \u0645\u0637\u0627\u0628\u0642 \u0633\u0627\u062E\u062A\u0627\u0631 \u0632\u06CC\u0631 \u0628\u062F\u0648\u0646 \u0647\u06CC\u0686 \u0645\u062A\u0646 \u0627\u0636\u0627\u0641\u06CC:
{
  "intent": "${intent}",
  "language": "fa",
  "summary": "\u067E\u0627\u0633\u062E \u0645\u0633\u062A\u0642\u06CC\u0645 \u06A9\u0648\u062A\u0627\u0647 \u0628\u0631 \u067E\u0627\u06CC\u0647 \u062F\u0627\u0646\u0634 \u0645\u062F\u0644",
  "direct_answer": "",
  "source_quote": "",
  "ai_analysis": "\u062D\u062F\u0627\u06A9\u062B\u0631 \u062F\u0648 \u062C\u0645\u0644\u0647 \u062A\u062D\u0644\u06CC\u0644 \u0645\u0633\u062A\u0642\u0644 AI",
  "practical_takeaway": "",
  "socratic_questions": [],
  "used_source_ids": [],
  "confidence": "high",
  "needs_human_scholar": false,
  "disclaimers": ["\u062A\u0648\u0644\u06CC\u062F\u0634\u062F\u0647 \u0628\u0627 \u0647\u0648\u0634 \u0645\u0635\u0646\u0648\u0639\u06CC\u061B \u062C\u0647\u062A \u0641\u062A\u0627\u0648\u0627 \u0648 \u0627\u062D\u06A9\u0627\u0645 \u0634\u0631\u0639\u06CC \u0628\u0647 \u0645\u0631\u0627\u062C\u0639 \u0639\u0638\u0627\u0645 \u0631\u062C\u0648\u0639 \u0641\u0631\u0645\u0627\u06CC\u06CC\u062F."]
}`;
    const user = `${historyContext ? `\u062A\u0627\u0631\u06CC\u062E\u0686\u0647 \u06AF\u0641\u062A\u06AF\u0648:
${historyContext}

` : ""}\u067E\u0631\u0633\u0634 \u06A9\u0627\u0631\u0628\u0631:
${userQuestion}${verseContext ? `

${verseContext}` : ""}`;
    try {
      let generated = await generateWithFallback({
        system,
        user,
        maxTokens: 800,
        enableWebSearch
      });
      let output = aiResponseSchema.safeParse(extractJsonObject(generated.content));
      if (!output.success) {
        generated = await generateWithFallback({
          system,
          user: `\u067E\u0627\u0633\u062E \u0642\u0628\u0644\u06CC \u0628\u0627 \u0642\u0631\u0627\u0631\u062F\u0627\u062F \u062E\u0631\u0648\u062C\u06CC \u0633\u0627\u0632\u06AF\u0627\u0631 \u0646\u0628\u0648\u062F. \u0627\u06CC\u0646 \u062E\u0637\u0627\u0647\u0627 \u0631\u0627 \u0627\u0635\u0644\u0627\u062D \u06A9\u0646 \u0648 \u0641\u0642\u0637 JSON \u0645\u0639\u062A\u0628\u0631 \u0628\u0631\u06AF\u0631\u062F\u0627\u0646: ${output.error.issues.map((issue) => `${issue.path.join(".") || "response"} (${issue.code})`).join(", ")}
\u067E\u0627\u0633\u062E \u0642\u0628\u0644\u06CC:
${generated.content}`,
          maxTokens: 800,
          enableWebSearch
        });
        output = aiResponseSchema.safeParse(extractJsonObject(generated.content));
      }
      if (!output.success) {
        console.warn(JSON.stringify({
          event: "ai_structured_output_invalid",
          requestId,
          issues: output.error.issues.map((issue) => ({ path: issue.path.join("."), code: issue.code }))
        }));
        return res.status(502).json({ error: "\u067E\u0627\u0633\u062E \u0633\u0627\u062E\u062A\u200C\u06CC\u0627\u0641\u062A\u0647\u0654 \u062F\u0633\u062A\u06CC\u0627\u0631 \u0645\u0639\u062A\u0628\u0631 \u0646\u0628\u0648\u062F.", code: "invalid_model_output", requestId });
      }
      console.info(JSON.stringify({ event: "ai_request", requestId, provider: generated.provider, used: quota.used, intent }));
      return res.json({
        ...output.data,
        intent,
        sources: knownCatalog,
        requestId
      });
    } catch (error) {
      const status = error instanceof ProviderError && error.status === 429 ? 429 : 502;
      const provider = error instanceof ProviderError ? error.provider : void 0;
      const providerStatus = error instanceof ProviderError ? error.status : void 0;
      console.warn(JSON.stringify({ event: "ai_provider_error", requestId, status, provider, providerStatus }));
      return res.status(status).json({
        error: status === 429 ? "\u0633\u0631\u0648\u06CC\u0633 \u0647\u0648\u0634 \u0645\u0635\u0646\u0648\u0639\u06CC \u0645\u0648\u0642\u062A\u0627\u064B \u0633\u0647\u0645\u06CC\u0647 \u0646\u062F\u0627\u0631\u062F." : "\u0627\u0631\u062A\u0628\u0627\u0637 \u0628\u0627 \u062F\u0633\u062A\u06CC\u0627\u0631 \u0647\u0648\u0634\u0645\u0646\u062F \u0628\u0631\u0642\u0631\u0627\u0631 \u0646\u0634\u062F.",
        code: status === 429 ? "provider_rate_limited" : "upstream_error",
        provider,
        providerStatus,
        requestId
      });
    }
  });
  const surahCache = /* @__PURE__ */ new Map();
  app2.get(["/api/quran/surah/:id", "/quran/surah/:id"], async (req, res) => {
    const surahId = parseInt(req.params.id, 10);
    if (isNaN(surahId) || surahId < 1 || surahId > 114) {
      return res.status(400).json({ error: "\u0634\u0645\u0627\u0631\u0647 \u0633\u0648\u0631\u0647 \u0628\u0627\u06CC\u062F \u0639\u062F\u062F\u06CC \u0628\u06CC\u0646 \u06F1 \u062A\u0627 \u06F1\u06F1\u06F4 \u0628\u0627\u0634\u062F." });
    }
    res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
    if (surahCache.has(surahId)) {
      const cached = surahCache.get(surahId);
      return res.json({
        surahId,
        count: cached.length,
        fromCache: true,
        verses: cached
      });
    }
    try {
      const response = await fetch(
        `https://api.alquran.cloud/v1/surah/${surahId}/editions/quran-uthmani,fa.makarem,fa.fooladvand,fa.ansarian`,
        { headers: { "User-Agent": "QuranMobinApp/1.0" } }
      );
      if (!response.ok) {
        throw new Error(`Quran Cloud API responded with status ${response.status}`);
      }
      const json = await response.json();
      if (!json.data || !Array.isArray(json.data) || json.data.length < 4) {
        throw new Error("\u0633\u0627\u062E\u062A\u0627\u0631 \u0627\u0637\u0644\u0627\u0639\u0627\u062A \u062F\u0631\u06CC\u0627\u0641\u062A\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A.");
      }
      const [uthmaniEd, makaremEd, fooladvandEd, ansarianEd] = json.data;
      const ayahsCount = uthmaniEd.ayahs.length;
      const verses = [];
      for (let i = 0; i < ayahsCount; i++) {
        const uAyah = uthmaniEd.ayahs[i];
        const mAyah = makaremEd.ayahs[i] || {};
        const fAyah = fooladvandEd.ayahs[i] || {};
        const aAyah = ansarianEd.ayahs[i] || {};
        let textArabic = uAyah.text || "";
        textArabic = textArabic.replace(/^[\uFEFF\u200B\s]+/g, "").trim();
        if (surahId > 1 && uAyah.numberInSurah === 1 && surahId !== 9) {
          textArabic = textArabic.replace(/^بِسْمِ\s+[\u0600-\u06FF\s]+?ٱلرَّحِيمِ\s*/u, "").trim();
          textArabic = textArabic.replace(/^بِسْمِ\s+[\u0600-\u06FF\s]+?الرَّحِيمِ\s*/u, "").trim();
        }
        verses.push({
          id: uAyah.number,
          surahId,
          verseNumber: uAyah.numberInSurah,
          juzNumber: uAyah.juz,
          pageNumber: uAyah.page,
          textArabic,
          translationMakarem: mAyah.text || "",
          translationFooladvand: fAyah.text || "",
          translationAnsarian: aAyah.text || "",
          tafsirNemoneh: `\u0631\u0627\u0647\u0646\u0645\u0627\u06CC \u062A\u062F\u0628\u0651\u0631: \u0627\u06CC\u0646 \u0622\u06CC\u0647 \u0631\u0627 \u062F\u0631 \u067E\u06CC\u0648\u0646\u062F \u0628\u0627 \u0633\u06CC\u0627\u0642 \u0633\u0648\u0631\u0647 \u0648 \u062F\u06CC\u06AF\u0631 \u0622\u06CC\u0627\u062A \u0647\u0645\u200C\u0645\u0648\u0636\u0648\u0639 \u0645\u0637\u0627\u0644\u0639\u0647 \u06A9\u0646\u06CC\u062F. \u0645\u062A\u0646 \u0645\u0633\u062A\u0646\u062F \u062A\u0641\u0633\u06CC\u0631 \u0648 \u0627\u0631\u062C\u0627\u0639 \u0635\u0641\u062D\u0647 \u062F\u0631 \u0646\u0633\u062E\u0647\u200C\u0647\u0627\u06CC \u0628\u0639\u062F\u06CC \u0627\u0641\u0632\u0648\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F.`,
          tafsirMizan: `\u0631\u0627\u0647\u0646\u0645\u0627\u06CC \u0645\u0641\u0647\u0648\u0645\u06CC: \u0627\u06CC\u0646 \u0645\u062A\u0646\u060C \u0646\u0642\u0644 \u06CC\u0627 \u0686\u06A9\u06CC\u062F\u0647\u0654 \u0645\u0633\u062A\u0646\u062F\u0650 \u062A\u0641\u0633\u06CC\u0631 \u0646\u06CC\u0633\u062A \u0648 \u0635\u0631\u0641\u0627\u064B \u0628\u0631\u0627\u06CC \u0647\u062F\u0627\u06CC\u062A \u0628\u0647 \u0645\u0637\u0627\u0644\u0639\u0647\u0654 \u0628\u06CC\u0634\u062A\u0631 \u0646\u0645\u0627\u06CC\u0634 \u062F\u0627\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F.`,
          rootWords: []
        });
      }
      surahCache.set(surahId, verses);
      return res.json({
        surahId,
        count: verses.length,
        fromCache: false,
        verses
      });
    } catch (err) {
      console.error(`Error fetching surah ${surahId}:`, err);
      return res.status(502).json({
        error: `\u062E\u0637\u0627 \u062F\u0631 \u062F\u0631\u06CC\u0627\u0641\u062A \u0622\u06CC\u0627\u062A \u0633\u0648\u0631\u0647 ${surahId}.`,
        details: err?.message || String(err)
      });
    }
  });
  const searchCache = /* @__PURE__ */ new Map();
  app2.get(["/api/quran/search", "/quran/search"], async (req, res) => {
    const rawQuery = (req.query.q || "").trim();
    const searchScope = req.query.scope || "all";
    const surahFilter = req.query.surahId ? parseInt(req.query.surahId, 10) : void 0;
    if (!rawQuery || rawQuery.length < 2) {
      return res.status(400).json({ error: "\u0637\u0648\u0644 \u0639\u0628\u0627\u0631\u062A \u062C\u0633\u062A\u062C\u0648 \u0628\u0627\u06CC\u062F \u062D\u062F\u0627\u0642\u0644 \u06F2 \u062D\u0631\u0641 \u0628\u0627\u0634\u062F." });
    }
    const cacheKey = `${rawQuery.toLowerCase()}_${searchScope}_${surahFilter || 0}`;
    if (searchCache.has(cacheKey)) {
      return res.json(searchCache.get(cacheKey));
    }
    try {
      const results = [];
      const encodedQuery = encodeURIComponent(rawQuery);
      const promises = [];
      if (searchScope === "all" || searchScope === "arabic") {
        promises.push(
          fetch(`https://api.alquran.cloud/v1/search/${encodedQuery}/all/quran-simple`, {
            headers: { "User-Agent": "QuranMobinApp/1.0" }
          }).then((r) => r.ok ? r.json() : null).then((data) => ({ type: "arabic", data })).catch(() => null)
        );
      }
      if (searchScope === "all" || searchScope === "translation") {
        promises.push(
          fetch(`https://api.alquran.cloud/v1/search/${encodedQuery}/all/fa.makarem`, {
            headers: { "User-Agent": "QuranMobinApp/1.0" }
          }).then((r) => r.ok ? r.json() : null).then((data) => ({ type: "translation", data })).catch(() => null)
        );
      }
      const responses = await Promise.all(promises);
      const seenAyahKeys = /* @__PURE__ */ new Set();
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
              surahNameArabic: match.surah.name || "",
              surahNamePersian: match.surah.englishNameTranslation || match.surah.name || "",
              verseNumber: vNum,
              pageNumber: match.page || 1,
              juzNumber: match.juz || 1,
              textArabic: resp.type === "arabic" ? match.text : "",
              translation: resp.type === "translation" ? match.text : "",
              matchedIn: resp.type
            });
          }
        }
      }
      const responsePayload = {
        query: rawQuery,
        count: results.length,
        results: results.slice(0, 100)
        // حداکثر ۱۰۰ نتیجه نخست
      };
      searchCache.set(cacheKey, responsePayload);
      return res.json(responsePayload);
    } catch (err) {
      console.error("Search error:", err);
      return res.status(500).json({
        error: "\u062E\u0637\u0627 \u062F\u0631 \u0627\u0646\u062C\u0627\u0645 \u062C\u0633\u062A\u062C\u0648.",
        details: err?.message || String(err)
      });
    }
  });
  app2.post("/api/ai/tadabbur", async (_req, res) => {
    return res.status(410).json({
      error: "\u0627\u06CC\u0646 \u0645\u0633\u06CC\u0631 \u0645\u0646\u0633\u0648\u062E \u0634\u062F\u0647 \u0627\u0633\u062A. \u0627\u0632 \u0645\u0633\u06CC\u0631 \u062C\u062F\u06CC\u062F \u062F\u0633\u062A\u06CC\u0627\u0631 \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u06A9\u0646\u06CC\u062F.",
      code: "legacy_endpoint_removed"
    });
  });
  app2.all("/api/*", (req, res) => {
    res.status(404).json({
      error: `\u0645\u0633\u06CC\u0631 \u062F\u0631\u062E\u0648\u0627\u0633\u062A\u06CC \u062F\u0631 \u0633\u0631\u0648\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F (${req.method} ${req.url}).`,
      code: "not_found"
    });
  });
  app2.use((err, req, res, _next) => {
    console.error("Unhandled API Error:", err);
    if (res.headersSent) {
      return;
    }
    res.status(err?.statusCode || 500).json({
      error: "\u062E\u0637\u0627 \u062F\u0631 \u067E\u0631\u062F\u0627\u0632\u0634 \u062F\u0631\u062E\u0648\u0627\u0633\u062A."
    });
  });
  return app2;
}

// server/serverless.ts
var app = createApp();
var serverless_default = app;
export {
  serverless_default as default
};
