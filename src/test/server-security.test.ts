import { describe, expect, it, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';
import { resetAudioProxyLimits } from '../../server/security';

describe('Server Security & Hardening (Phase 1)', () => {
  const app = createApp();

  beforeEach(() => {
    resetAudioProxyLimits();
  });

  describe('Security Headers', () => {
    it('sends essential security headers on responses', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(res.headers['permissions-policy']).toContain('microphone=(self)');
      expect(res.headers['content-security-policy']).toBeDefined();
    });
  });

  describe('CORS Restrictions', () => {
    it('rejects disallowed origin on OPTIONS preflight', async () => {
      const res = await request(app)
        .options('/api/health')
        .set('Origin', 'https://malicious-site.example.com');

      expect(res.status).toBe(403);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('permits authorized native/local origins and echoes Origin', async () => {
      const res = await request(app)
        .options('/api/health')
        .set('Origin', 'capacitor://localhost');

      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe('capacitor://localhost');
    });

    it('does not send wildcard Access-Control-Allow-Origin: *', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['access-control-allow-origin']).not.toBe('*');
    });
  });

  describe('Audio Proxy (/api/audio/proxy)', () => {
    it('rejects non-https URLs', async () => {
      const res = await request(app).get('/api/audio/proxy?url=http://everyayah.com/data/test.mp3');
      expect(res.status).toBe(400);
    });

    it('rejects hosts not in whitelist', async () => {
      const res = await request(app).get('/api/audio/proxy?url=https://attacker-evil.com/audio.mp3');
      expect(res.status).toBe(403);
      expect(res.text).toContain('Audio host not permitted');
    });

    it('rate limits excessive audio proxy requests', async () => {
      // Simulate multiple requests exceeding the limit
      for (let i = 0; i < 60; i++) {
        await request(app).get('/api/audio/proxy?url=https://attacker.com/fake.mp3');
      }

      const res = await request(app).get('/api/audio/proxy?url=https://attacker.com/fake.mp3');
      expect(res.status).toBe(429);
      expect(res.text).toContain('Too many audio proxy requests');
    });
  });

  describe('Search & Surah Bounds & Error Sanitization', () => {
    it('rejects search query shorter than 2 characters', async () => {
      const res = await request(app).get('/api/quran/search?q=a');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('rejects search query longer than 100 characters', async () => {
      const longQuery = 'a'.repeat(101);
      const res = await request(app).get(`/api/quran/search?q=${longQuery}`);
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('rejects invalid surah id without leaking stack or internal details', async () => {
      const res = await request(app).get('/api/quran/surah/999');
      expect(res.status).toBe(400);
      expect(res.body.details).toBeUndefined();
    });
  });

  describe('Recitation Verification (/api/ai/verify-recitation)', () => {
    it('rejects requests missing valid X-Device-ID', async () => {
      const res = await request(app)
        .post('/api/ai/verify-recitation')
        .send({
          targetText: 'بسم الله الرحمن الرحيم',
          spokenText: 'بسم الله',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('invalid_device');
    });

    it('rejects request when targetText or spokenText exceeds 500 characters', async () => {
      const res = await request(app)
        .post('/api/ai/verify-recitation')
        .set('X-Device-ID', 'valid-device-uuid-12345678')
        .send({
          targetText: 'کلمه '.repeat(150), // > 500 chars
          spokenText: 'بسم الله',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('invalid_request');
    });

    it('fails closed when quota is exhausted or unconfigured in production', async () => {
      const originalEnv = { ...process.env };
      process.env.NODE_ENV = 'production';
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
      delete process.env.ALLOW_MEMORY_RATE_LIMIT;

      try {
        const res = await request(app)
          .post('/api/ai/verify-recitation')
          .set('X-Device-ID', 'valid-device-uuid-12345678')
          .send({
            targetText: 'بسم الله الرحمن الرحيم',
            spokenText: 'بسم الله الرحمن الرحيم',
          });

        expect([429, 503]).toContain(res.status);
        expect(res.body.details).toBeUndefined();
      } finally {
        process.env = originalEnv;
      }
    });
  });
});
