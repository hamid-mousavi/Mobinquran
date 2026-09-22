import { z } from 'zod';

export const verseRefSchema = z.string().regex(/^([1-9]|[1-9][0-9]|1[01][0-4]):[1-9][0-9]{0,2}$/);

export const aiCandidateSchema = z.object({
  ref: verseRefSchema,
  text_fa: z.string().trim().min(1).max(1500),
});

export const aiAskRequestSchema = z.object({
  question: z.string().trim().min(1).max(500),
  candidates: z.array(aiCandidateSchema).min(1).max(12),
  lang: z.enum(['fa', 'en', 'ur']).default('fa'),
}).strict();

export const aiVerseAnswerSchema = z.object({
  ref: verseRefSchema,
  why_relevant: z.string().trim().min(1).max(500),
  practical_note: z.string().trim().min(1).max(500),
});

export const aiResponseSchema = z.object({
  language: z.enum(['fa', 'en', 'ur']),
  summary: z.string().trim().min(1).max(1200),
  verses: z.array(aiVerseAnswerSchema).min(1).max(12),
  tafsir_citations: z.array(z.never()).max(0),
  confidence: z.enum(['high', 'medium', 'low']),
  needs_human_scholar: z.boolean(),
  disclaimers: z.array(z.string().trim().min(1).max(300)).min(1).max(5),
});

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
