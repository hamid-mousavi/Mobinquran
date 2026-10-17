import { Request, Response, NextFunction } from 'express';

const AUDIO_PROXY_LIMIT = 120; // حداکثر ۱۲۰ درخواست در دقیقه برای هر IP (پخش + پیش‌بارگذاری آیه بعدی؛ شبکه‌های اشتراکی موبایل)
const audioProxyLimits = new Map<string, { count: number; resetAt: number }>();

export function getClientIp(req: Request): string {
  const vercelIp = req.header('x-vercel-forwarded-for')?.split(',')[0]?.trim();
  const realIp = req.header('x-real-ip')?.trim();
  return vercelIp || realIp || req.ip || 'unknown';
}

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // Same origin or non-browser request

  const publicAppUrl = (process.env.PUBLIC_APP_URL || '').trim();
  const allowedStatic = new Set([
    'https://localhost',
    'capacitor://localhost',
    'ionic://localhost',
    'http://localhost:3000',
    'http://localhost:5173',
  ]);

  if (publicAppUrl) {
    try {
      const publicOrigin = new URL(publicAppUrl).origin;
      allowedStatic.add(publicOrigin);
    } catch {
      allowedStatic.add(publicAppUrl);
    }
  }

  if (allowedStatic.has(origin)) {
    return true;
  }

  // Allow localhost with arbitrary ports in development
  if (process.env.NODE_ENV !== 'production') {
    if (/^https?:\/\/localhost(:\d+)?$/.test(origin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) {
      return true;
    }
  }

  return false;
}

export function securityHeadersMiddleware(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=(self)');

  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob: https:",
    "connect-src 'self' https: wss: ws:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; ');

  res.setHeader('Content-Security-Policy', csp);
  next();
}

export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.header('origin');

  if (origin) {
    if (isAllowedOrigin(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Device-ID');
      res.setHeader('Vary', 'Origin');
    } else if (req.method === 'OPTIONS') {
      res.status(403).send('CORS origin not allowed');
      return;
    }
  }

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
}

export function checkAudioProxyRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = audioProxyLimits.get(ip);

  if (!entry || now > entry.resetAt) {
    audioProxyLimits.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }

  if (entry.count >= AUDIO_PROXY_LIMIT) {
    return false;
  }

  entry.count += 1;
  return true;
}

export function resetAudioProxyLimits(): void {
  audioProxyLimits.clear();
}
