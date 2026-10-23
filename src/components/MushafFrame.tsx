import React, { useMemo } from 'react';

/** پهنای قاب تزئینی دور صفحهٔ مصحف (px) */
export const MUSHAF_FRAME_W = 14;

export function mushafPalette(dark: boolean) {
  return dark
    ? { band: '#0f2a2a', gold: '#c9a24a', teal: '#2dd4bf' }
    : { band: '#f3ecd6', gold: '#b08d3c', teal: '#0f766e' };
}

type Palette = ReturnType<typeof mushafPalette>;

const uri = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

/** یک کاشی تکرارشونده: لوزی‌های زنجیره‌ای با نقطهٔ طلایی؛ نسخهٔ عمودی با چرخش ۹۰ درجه */
function stripImage(c: Palette, vertical: boolean) {
  const base =
    `<rect width="24" height="14" fill="${c.band}"/>` +
    `<path d="M0 .6H24M0 13.4H24" stroke="${c.gold}" stroke-width=".8"/>` +
    `<path d="M12 2.2L16.8 7L12 11.8L7.2 7Z" fill="none" stroke="${c.teal}" stroke-width="1"/>` +
    `<circle cx="12" cy="7" r="1.5" fill="${c.gold}"/>` +
    `<circle cx="0" cy="7" r="1" fill="${c.teal}"/><circle cx="24" cy="7" r="1" fill="${c.teal}"/>` +
    `<path d="M3.5 7H6M18 7H20.5" stroke="${c.gold}" stroke-width=".8"/>`;
  const svg = vertical
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="24" viewBox="0 0 14 24"><g transform="translate(14 0) rotate(90)">${base}</g></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="14" viewBox="0 0 24 14">${base}</svg>`;
  return uri(svg);
}

/** گوشه: ستارهٔ هشت‌پر (دو مربع) */
function cornerImage(c: Palette) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14">` +
    `<rect width="14" height="14" fill="${c.band}"/>` +
    `<rect x=".6" y=".6" width="12.8" height="12.8" fill="none" stroke="${c.gold}" stroke-width=".8"/>` +
    `<rect x="3.6" y="3.6" width="6.8" height="6.8" fill="none" stroke="${c.teal}" stroke-width="1"/>` +
    `<rect x="3.6" y="3.6" width="6.8" height="6.8" fill="none" stroke="${c.teal}" stroke-width="1" transform="rotate(45 7 7)"/>` +
    `<circle cx="7" cy="7" r="1.3" fill="${c.gold}"/></svg>`;
  return uri(svg);
}

/** قاب تزئینی دور صفحه (سبک، بدون تصویر خارجی؛ فقط SVG درون‌خطی) */
export const MushafFrame: React.FC<{ darkMode: boolean }> = ({ darkMode }) => {
  const c = mushafPalette(darkMode);
  const img = useMemo(
    () => ({ h: stripImage(c, false), v: stripImage(c, true), corner: cornerImage(c) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [darkMode]
  );
  const W = MUSHAF_FRAME_W;
  const strip = (extra: React.CSSProperties, vertical: boolean): React.CSSProperties => ({
    position: 'absolute',
    backgroundImage: vertical ? img.v : img.h,
    backgroundRepeat: vertical ? 'repeat-y' : 'repeat-x',
    backgroundPosition: 'center',
    ...extra,
  });
  const corner = (extra: React.CSSProperties): React.CSSProperties => ({
    position: 'absolute',
    width: W,
    height: W,
    backgroundImage: img.corner,
    backgroundSize: '100% 100%',
    ...extra,
  });
  return (
    <div className="absolute inset-0 pointer-events-none z-[5]" aria-hidden="true">
      <div style={strip({ top: 0, left: W, right: W, height: W }, false)} />
      <div style={strip({ bottom: 0, left: W, right: W, height: W }, false)} />
      <div style={strip({ left: 0, top: W, bottom: W, width: W }, true)} />
      <div style={strip({ right: 0, top: W, bottom: W, width: W }, true)} />
      <div style={corner({ top: 0, left: 0 })} />
      <div style={corner({ top: 0, right: 0 })} />
      <div style={corner({ bottom: 0, left: 0 })} />
      <div style={corner({ bottom: 0, right: 0 })} />
      <div style={{ position: 'absolute', inset: W, border: `1px solid ${c.gold}`, opacity: 0.55 }} />
    </div>
  );
};
