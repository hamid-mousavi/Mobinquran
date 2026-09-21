import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Phase 2 - PWA & Offline Verification', () => {
  it('validates Web App Manifest completeness and structure', () => {
    const manifestPath = path.resolve(process.cwd(), 'public/manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    expect(manifest.id).toBe('/');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.short_name.length).toBeLessThanOrEqual(12);
    expect(manifest.theme_color).toBe('#134e4a');
    expect(manifest.background_color).toBe('#0b1120');

    // بررسی آیکون‌ها
    expect(manifest.icons).toBeDefined();
    expect(manifest.icons.length).toBeGreaterThanOrEqual(4);

    const has192Any = manifest.icons.some((i: any) => i.sizes === '192x192' && i.purpose === 'any');
    const has512Any = manifest.icons.some((i: any) => i.sizes === '512x512' && i.purpose === 'any');
    const has192Maskable = manifest.icons.some((i: any) => i.sizes === '192x192' && i.purpose === 'maskable');
    const has512Maskable = manifest.icons.some((i: any) => i.sizes === '512x512' && i.purpose === 'maskable');

    expect(has192Any).toBe(true);
    expect(has512Any).toBe(true);
    expect(has192Maskable).toBe(true);
    expect(has512Maskable).toBe(true);

    // بررسی وجود فیزیکی تمام فایل‌های آیکون
    for (const icon of manifest.icons) {
      const relPath = icon.src.replace(/^\//, '');
      const fullPath = path.resolve(process.cwd(), 'public', relPath);
      expect(fs.existsSync(fullPath), `Icon file missing: ${fullPath}`).toBe(true);
    }

    // بررسی میانبرها (shortcuts)
    expect(manifest.shortcuts).toBeDefined();
    expect(manifest.shortcuts.length).toBeGreaterThanOrEqual(2);
  });

  it('ensures no duplicate icon.png remains in public directory', () => {
    const duplicateIconPath = path.resolve(process.cwd(), 'public/icon.png');
    expect(fs.existsSync(duplicateIconPath)).toBe(false);
  });

  it('validates 100% self-hosted fonts and no external font CDN links in index.html', () => {
    const indexHtml = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
    expect(indexHtml).not.toContain('fonts.googleapis.com');
    expect(indexHtml).not.toContain('fonts.gstatic.com');

    // بررسی وجود فونت‌های محلی woff2
    const fontFiles = [
      'public/fonts/vazirmatn-arabic.woff2',
      'public/fonts/vazirmatn-latin.woff2',
      'public/fonts/uthman-taha.woff2',
      'public/fonts/kfgqpc-hafs.woff2',
      'public/fonts/amiri-quran.woff2',
    ];

    for (const file of fontFiles) {
      const exists = fs.existsSync(path.resolve(process.cwd(), file));
      expect(exists, `Required self-hosted font missing: ${file}`).toBe(true);
    }
  });

  it('validates documentation of content sources and font licenses', () => {
    const docPath = path.resolve(process.cwd(), 'docs/CONTENT_SOURCES.md');
    expect(fs.existsSync(docPath)).toBe(true);

    const docContent = fs.readFileSync(docPath, 'utf8');
    expect(docContent).toContain('Vazirmatn');
    expect(docContent).toContain('Amiri Quran');
    expect(docContent).toContain('KFGQPC');
    expect(docContent).toContain('SIL Open Font License');
  });

  it('ensures index.css defines font-face with font-display: swap for all local fonts', () => {
    const css = fs.readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8');
    expect(css).toContain("font-family: 'Vazirmatn'");
    expect(css).toContain("font-family: 'UthmanTaha'");
    expect(css).toContain("font-family: 'KFGQPC-Hafs'");
    expect(css).toContain("font-family: 'Amiri Quran'");
    expect(css).toContain('font-display: swap');
    expect(css).not.toContain('jsdelivr.net');
  });
});
