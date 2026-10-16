import React from 'react';

/** نشان ستارهٔ هشت‌پر (رُبع‌الحزب) برای شماره سوره و آیه */
export const StarBadge: React.FC<{ children?: React.ReactNode; size?: number; onDark?: boolean }> = ({
  children,
  size = 28,
  onDark = false,
}) => (
  <span
    className="relative inline-flex items-center justify-center shrink-0 font-black"
    style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
  >
    <svg
      viewBox="0 0 24 24"
      className="absolute inset-0 w-full h-full"
      fill={onDark ? 'none' : '#efe3b8'}
      stroke={onDark ? '#e8d9a8' : '#a8802c'}
      strokeWidth="1.2"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="5" width="14" height="14" />
      <rect x="5" y="5" width="14" height="14" transform="rotate(45 12 12)" />
    </svg>
    <span className="relative" style={{ color: onDark ? '#ffffff' : '#134e4a' }}>
      {children}
    </span>
  </span>
);
