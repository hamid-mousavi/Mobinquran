import { describe, it, expect } from 'vitest';
import { classifyAudioError, describeAudioError } from '../services/audioErrorLog';

describe('Audio error classification (Phase 5 - P5-T5)', () => {
  it('classifies offline as network error regardless of media code', () => {
    expect(classifyAudioError(null, false)).toBe('network');
    expect(classifyAudioError(3, false)).toBe('network');
  });

  it('maps media error codes to kinds', () => {
    expect(classifyAudioError(2, true)).toBe('network'); // MEDIA_ERR_NETWORK
    expect(classifyAudioError(3, true)).toBe('corrupt'); // MEDIA_ERR_DECODE
    expect(classifyAudioError(4, true)).toBe('not-found'); // MEDIA_ERR_SRC_NOT_SUPPORTED
    expect(classifyAudioError(null, true)).toBe('unknown');
    expect(classifyAudioError(undefined, true)).toBe('unknown');
  });

  it('provides Persian messages for each kind', () => {
    expect(describeAudioError('network')).toContain('ارتباط');
    expect(describeAudioError('not-found')).toContain('منبع');
    expect(describeAudioError('corrupt')).toContain('خراب');
    expect(describeAudioError('cors')).toContain('CORS');
    expect(describeAudioError('unknown')).toContain('ناشناخته');
  });
});