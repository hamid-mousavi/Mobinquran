import React from 'react';

/**
 * نشان شمارهٔ آیه/سوره: همان دایرهٔ گل‌دار پایان آیه (مثل AyahEndMarker) با عدد ثابت در مرکز.
 * اندازهٔ عدد بر اساس تعداد ارقام کم می‌شود تا هیچ‌وقت از دایره بیرون نزند.
 */
export const StarBadge: React.FC<{ children?: React.ReactNode; size?: number; onDark?: boolean }> = ({
  children,
  size = 28,
  onDark = false,
}) => {
  const label = typeof children === 'number' || typeof children === 'string' ? String(children) : '';
  const digits = label.length;
  // قطر داخلی حلقه ≈ ۶۵٪ اندازهٔ نشان است
  const ratio = digits <= 1 ? 0.44 : digits === 2 ? 0.38 : 0.3;
  const stroke = onDark ? '#e8d9a8' : '#a8802c';
  const ink = onDark ? '#ffffff' : '#134e4a';

  return (
    <span
      className="relative inline-flex items-center justify-center shrink-0 select-none"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 40 40" className="absolute inset-0 w-full h-full" aria-hidden="true" strokeWidth="1.2" stroke={stroke} fill="none">
        <circle cx="20" cy="20" r="18" strokeDasharray="3 1.5" />
        <circle cx="20" cy="20" r="15" strokeWidth="0.8" opacity="0.85" fill={onDark ? 'none' : '#fbf3d6'} />
        <circle cx="20" cy="20" r="13" strokeWidth="0.5" opacity="0.4" />
        <g fill={stroke} stroke="none">
          <path d="M20 2 L21.5 5 L20 6 L18.5 5 Z" />
          <path d="M20 38 L21.5 35 L20 34 L18.5 35 Z" />
          <path d="M2 20 L5 21.5 L6 20 L5 18.5 Z" />
          <path d="M38 20 L35 21.5 L34 20 L35 18.5 Z" />
        </g>
      </svg>
      {label && (
        <span
          className="relative block text-center font-black tabular-nums whitespace-nowrap overflow-hidden"
          style={{ fontSize: Math.max(8, Math.round(size * ratio)), lineHeight: 1, color: ink, maxWidth: '64%', fontFamily: "'Vazirmatn', sans-serif" }}
        >
          {label}
        </span>
      )}
    </span>
  );
};
