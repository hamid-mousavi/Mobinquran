import { describe, expect, it } from 'vitest';
import { createTafsirMizanSource, createTafsirNemonehSource } from '../services/aiAgent/sourceResolver';

describe('AI tafsir source links', () => {
  it('links commentary sources to the iNoor ayah commentary page', () => {
    expect(createTafsirMizanSource(1, 1).url).toBe('https://quran.inoor.ir/fa/ayah/1/1/commentary');
    expect(createTafsirNemonehSource(2, 255).url).toBe('https://quran.inoor.ir/fa/ayah/2/255/commentary');
  });
});