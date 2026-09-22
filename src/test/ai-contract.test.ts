import { describe, expect, it } from 'vitest';
import { aiAskRequestSchema, aiResponseSchema, extractJsonObject } from '../services/aiContract';

describe('AI RAG contract', () => {
  it('accepts bounded requests and rejects extra fields', () => {
    const valid = aiAskRequestSchema.safeParse({
      question: 'برای آرامش چه آیاتی مناسب است؟',
      candidates: [{ ref: '94:5', text_fa: 'متن کاندید' }],
      lang: 'fa',
    });
    expect(valid.success).toBe(true);

    const invalid = aiAskRequestSchema.safeParse({
      question: 'x',
      candidates: [{ ref: '999:1', text_fa: 'x' }],
      apiKey: 'must-not-be-accepted',
    });
    expect(invalid.success).toBe(false);
  });

  it('accepts only the structured response shape', () => {
    const result = aiResponseSchema.safeParse({
      language: 'fa',
      summary: 'خلاصه',
      verses: [{ ref: '94:5', why_relevant: 'مرتبط', practical_note: 'تأمل' }],
      tafsir_citations: [],
      confidence: 'medium',
      needs_human_scholar: false,
      disclaimers: ['تولیدشده با هوش مصنوعی.'],
    });
    expect(result.success).toBe(true);
  });

  it('extracts JSON from a fenced model response', () => {
    expect(extractJsonObject('```json\n{"ok":true}\n```')).toEqual({ ok: true });
  });
});
