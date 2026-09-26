import { z } from 'zod';

export const verseRefSchema = z.string().regex(/^([1-9]|[1-9][0-9]|1[01][0-4]):[1-9][0-9]{0,2}$/);

export const aiCandidateSchema = z.object({
  ref: verseRefSchema,
  text_fa: z.string().trim().min(1).max(1500),
});

export const sourceItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(['quran', 'tafsir', 'hadith', 'web']),
  reference: z.string(),
  sourceName: z.string(),
  url: z.string(),
  isInternal: z.boolean(),
  metadata: z
    .object({
      surahId: z.number().optional(),
      verseNumber: z.number().optional(),
      surahName: z.string().optional(),
    })
    .optional(),
});

export const ragCandidateSchema = z.object({
  sourceId: z.string(),
  type: z.enum(['quran', 'tafsir', 'hadith', 'web']),
  title: z.string(),
  reference: z.string(),
  sourceName: z.string(),
  content: z.string(),
  sourceItem: sourceItemSchema.optional(),
});

export const aiAskRequestSchema = z.object({
  question: z.string().trim().min(1).max(1000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .optional()
    .default([]),
  currentVerse: z
    .object({
      surahId: z.number(),
      verseNumber: z.number(),
      textArabic: z.string().optional(),
      translationMakarem: z.string().optional(),
    })
    .optional()
    .nullable(),
  ragCandidates: z.array(ragCandidateSchema).max(16).optional().default([]),
  sourcesCatalog: z.array(sourceItemSchema).max(20).optional().default([]),
  candidates: z.array(aiCandidateSchema).max(12).optional().default([]),
  lang: z.enum(['fa', 'en', 'ur']).default('fa'),
  agent: z.enum(['moral', 'conceptual', 'literary', 'rational']).optional().default('moral'),
});

export const aiVerseAnswerSchema = z.object({
  ref: verseRefSchema,
  why_relevant: z.string().trim().min(1).max(1000),
  practical_note: z.string().trim().min(1).max(1000),
});

export const aiResponseSchema = z.object({
  intent: z.enum(['casual_chat', 'quran_inquiry', 'current_info', 'hybrid']).default('quran_inquiry'),
  language: z.enum(['fa', 'en', 'ur']).default('fa'),
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
  confidence: z
    .string()
    .transform((val) => val.toLowerCase())
    .pipe(z.enum(['high', 'medium', 'low']))
    .default('medium'),
  needs_human_scholar: z.boolean().default(false),
  disclaimers: z
    .array(z.string().trim().min(1).max(300))
    .min(1)
    .max(5)
    .default(['تولیدشده با هوش مصنوعی؛ این دستیار مرجع فتوا نیست.']),
});

export type SourceItemContract = z.infer<typeof sourceItemSchema>;
export type AiAskRequest = z.infer<typeof aiAskRequestSchema>;
export type AiResponse = z.infer<typeof aiResponseSchema>;
export type AiCandidate = z.infer<typeof aiCandidateSchema>;

export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const withoutFence = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(withoutFence);
  } catch {
    const start = withoutFence.indexOf('{');
    const end = withoutFence.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(withoutFence.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}
