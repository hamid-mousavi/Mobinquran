import React from 'react';
import { mushafPalette } from './MushafFrame';
import { toPersianDigits } from '../utils/textNormalization';

/** نام فارسی نشانهٔ ربع: ۱ = آغاز حزب، ۲ = ربع، ۳ = نصف، ۴ = سه‌ربع */
const LABELS = ['الحزب', 'ربع الحزب', 'نصف الحزب', 'ثلاثة أرباع الحزب'];

const starPoints = (cx: number, cy: number, ro: number, ri: number, n: number) =>
  Array.from({ length: n * 2 }, (_, i) => {
    const r = i % 2 === 0 ? ro : ri;
    const ang = (Math.PI * i) / n - Math.PI / 2;
    return `${(cx + r * Math.cos(ang)).toFixed(2)},${(cy + r * Math.sin(ang)).toFixed(2)}`;
  }).join(' ');

const STAR = starPoints(12, 12, 11, 8.6, 8);

/**
 * نشانگر حزب/ربع حزب داخل متن مصحف.
 * hizbQuarter: شمارهٔ ربع از ۱ تا ۲۴۰ (ربع ۱ = آغاز حزب ۱).
 * آغاز حزب: عدد حزب؛ ربع/نصف/سه‌ربع: دایره‌ای که همان کسر از آن پر شده است.
 */
export const HizbBadge: React.FC<{ hizbQuarter: number; darkMode: boolean }> = ({ hizbQuarter, darkMode }) => {
  const c = mushafPalette(darkMode);
  const hizb = Math.ceil(hizbQuarter / 4);
  const r = (hizbQuarter - 1) % 4; // 0 = آغاز حزب
  const pies = [
    '',
    'M12 12L12 5.2A6.8 6.8 0 0 1 18.8 12Z', // ربع
    'M12 5.2A6.8 6.8 0 0 1 12 18.8Z', // نصف
    'M12 12L12 5.2A6.8 6.8 0 1 1 5.2 12Z', // سه‌ربع
  ];
  const title = r === 0 ? `${LABELS[0]} ${toPersianDigits(hizb)}` : `${LABELS[r]} ${toPersianDigits(hizb)}`;
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label={title}
      className="shrink-0 select-none"
      style={{ width: '1.2em', height: '1.2em' }}
    >
      <title>{title}</title>
      <polygon points={STAR} fill={c.band} stroke={c.gold} strokeWidth="1" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="7.4" fill="none" stroke={c.teal} strokeWidth=".9" />
      {r === 0 ? (
        <text
          x="12"
          y="15.2"
          textAnchor="middle"
          fontSize={hizb >= 10 ? 8.6 : 10}
          fontWeight="700"
          fill={darkMode ? '#fcd34d' : '#0f4c47'}
          style={{ fontFamily: "'Vazirmatn', sans-serif" }}
        >
          {toPersianDigits(hizb)}
        </text>
      ) : (
        <path d={pies[r]} fill={c.gold} />
      )}
    </svg>
  );
};
