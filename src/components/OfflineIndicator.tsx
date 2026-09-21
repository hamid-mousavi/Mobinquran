import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      id="pwa-offline-indicator"
      dir="rtl"
      className="fixed bottom-24 sm:bottom-28 left-4 z-40 flex items-center gap-2 rounded-xl bg-amber-600/95 text-white px-3 py-1.5 text-xs font-semibold shadow-lg backdrop-blur-sm border border-amber-400/40 animate-fadeIn"
    >
      <WifiOff className="w-3.5 h-3.5 animate-pulse shrink-0" />
      <span>حالت آفلاین — استفاده از داده‌های ذخیره‌شده دستگاه</span>
    </div>
  );
};
