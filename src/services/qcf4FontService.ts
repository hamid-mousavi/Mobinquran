/**
 * فونت‌های QCF4 (مصحف مدینه ۱۴۴۱) — ۴۷ فایل woff2 که فقط با تأیید کاربر دانلود می‌شوند.
 * فایل‌ها در Cache Storage (quran-qcf4-v1) نگه‌داری می‌شوند؛ Service Worker هم همان کش را می‌خواند.
 */
export const QCF4_CACHE = 'quran-qcf4-v1';
const BASE = `${import.meta.env.BASE_URL}fonts/qcf4/`;
const MANIFEST_URL = `${BASE}manifest.json`;
const DISMISS_KEY = 'mobin-qcf4-prompt-dismissed';

export interface Qcf4Manifest {
  version: number;
  count: number;
  totalBytes: number;
  fonts: Record<string, { file: string; bytes: number }>;
}

let manifestPromise: Promise<Qcf4Manifest | null> | null = null;
const loadedFaces = new Set<string>();
const pendingFaces = new Map<string, Promise<boolean>>();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* noop */
    }
  });
}

/** برای رندر دوباره‌ی صفحه‌ی مصحف بعد از آماده‌شدن یک فونت */
export function onQcf4Change(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function isQcf4Supported(): boolean {
  return typeof window !== 'undefined' && 'caches' in window && typeof FontFace !== 'undefined';
}

export function loadQcf4Manifest(): Promise<Qcf4Manifest | null> {
  if (!manifestPromise) {
    manifestPromise = (async () => {
      try {
        const res = await fetch(MANIFEST_URL, { cache: 'no-cache' });
        if (!res.ok) return null;
        const m = (await res.json()) as Qcf4Manifest;
        return m && m.fonts && m.totalBytes > 0 ? m : null;
      } catch {
        // آفلاین: از کش (اگر قبلاً ذخیره شده) می‌خوانیم
        try {
          const cache = await caches.open(QCF4_CACHE);
          const cached = await cache.match(MANIFEST_URL);
          return cached ? ((await cached.json()) as Qcf4Manifest) : null;
        } catch {
          return null;
        }
      }
    })();
    manifestPromise.then((m) => {
      if (!m) manifestPromise = null; // دفعهٔ بعد دوباره تلاش شود
    });
  }
  return manifestPromise;
}

export async function getDownloadedFontNames(): Promise<Set<string>> {
  const names = new Set<string>();
  if (!isQcf4Supported()) return names;
  try {
    const cache = await caches.open(QCF4_CACHE);
    const keys = await cache.keys();
    for (const req of keys) {
      const m = /\/(QCF4_Hafs_\d+)_W\.woff2$/.exec(new URL(req.url).pathname);
      if (m) names.add(m[1]);
    }
  } catch {
    /* noop */
  }
  return names;
}

export async function isFullyDownloaded(): Promise<boolean> {
  const manifest = await loadQcf4Manifest();
  if (!manifest) return false;
  const have = await getDownloadedFontNames();
  return Object.keys(manifest.fonts).every((n) => have.has(n));
}

/** فونت را از کش می‌خواند و در document ثبت می‌کند. اگر دانلود نشده باشد false می‌دهد. */
export function ensureQcf4Font(name: string): Promise<boolean> {
  if (loadedFaces.has(name)) return Promise.resolve(true);
  const pending = pendingFaces.get(name);
  if (pending) return pending;
  const task = (async () => {
    try {
      if (!isQcf4Supported()) return false;
      const manifest = await loadQcf4Manifest();
      const entry = manifest?.fonts[name];
      if (!entry) return false;
      const cache = await caches.open(QCF4_CACHE);
      const res = await cache.match(`${BASE}${entry.file}`);
      if (!res) return false;
      const face = new FontFace(name, await res.arrayBuffer());
      await face.load();
      document.fonts.add(face);
      loadedFaces.add(name);
      notify();
      return true;
    } catch (e) {
      console.warn('[QCF4] font load failed:', name, e);
      return false;
    } finally {
      pendingFaces.delete(name);
    }
  })();
  pendingFaces.set(name, task);
  return task;
}

export function isQcf4FontLoaded(name: string): boolean {
  return loadedFaces.has(name);
}

export interface DownloadProgress {
  doneBytes: number;
  totalBytes: number;
  doneFiles: number;
  totalFiles: number;
}

/** دانلود همه‌ی فونت‌های باقی‌مانده؛ قابل لغو و قابل ادامه (فایل‌های کامل‌شده دوباره دانلود نمی‌شوند) */
export async function downloadAllQcf4Fonts(
  onProgress: (p: DownloadProgress) => void,
  signal?: AbortSignal
): Promise<void> {
  const manifest = await loadQcf4Manifest();
  if (!manifest) throw new Error('manifest-unavailable');
  const cache = await caches.open(QCF4_CACHE);
  const have = await getDownloadedFontNames();
  const entries = Object.entries(manifest.fonts);
  const progress: DownloadProgress = {
    doneBytes: 0,
    totalBytes: manifest.totalBytes,
    doneFiles: 0,
    totalFiles: entries.length,
  };
  for (const [name, e] of entries) {
    if (have.has(name)) {
      progress.doneBytes += e.bytes;
      progress.doneFiles++;
    }
  }
  onProgress({ ...progress });

  const queue = entries.filter(([name]) => !have.has(name));
  const worker = async () => {
    while (queue.length > 0) {
      if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
      const [, e] = queue.shift()!;
      const url = `${BASE}${e.file}`;
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${e.file}`);
      const buf = await res.arrayBuffer();
      if (buf.byteLength < 1024) throw new Error(`فایل ناقص: ${e.file}`);
      await cache.put(url, new Response(buf, { headers: { 'Content-Type': 'font/woff2' } }));
      progress.doneBytes += e.bytes;
      progress.doneFiles++;
      onProgress({ ...progress });
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  try {
    // manifest هم برای حالت آفلاین ذخیره شود
    const m = await fetch(MANIFEST_URL, { cache: 'no-cache' });
    if (m.ok) await cache.put(MANIFEST_URL, m);
  } catch {
    /* noop */
  }
  notify();
}

export async function removeAllQcf4Fonts(): Promise<void> {
  loadedFaces.clear();
  await caches.delete(QCF4_CACHE);
  notify();
}

export function formatMB(bytes: number): string {
  return (bytes / 1048576).toFixed(bytes >= 10 * 1048576 ? 0 : 1);
}

export function wasPromptDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1' || localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissPrompt(permanent: boolean): void {
  try {
    (permanent ? localStorage : sessionStorage).setItem(DISMISS_KEY, '1');
  } catch {
    /* noop */
  }
}
