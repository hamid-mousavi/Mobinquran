import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// ثبت سرویس ورکر جهت کارکرد آفلاین PWA و مدیریت بروزرسانی فوری
if ('serviceWorker' in navigator && typeof window !== 'undefined') {
  // پاکسازی خودکار کش‌های قدیمی نسخه ۱ در صورت وجود
  if ('caches' in window) {
    caches.keys().then((names) => {
      names.forEach((name) => {
        if (name === 'quran-mobin-cache-v1' || name === 'quran-mobin-cache-v2') {
          console.log('Purging legacy cache:', name);
          caches.delete(name);
        }
      });
    });
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('Quran PWA ServiceWorker registered with scope:', reg.scope);
        // بررسی فعال برای دریافت آخرین فایل‌ها
        reg.update();
      })
      .catch((err) => {
        console.warn('ServiceWorker registration skipped:', err);
      });
  });

  // هنگام فعال شدن نسخه جدید سرویس ورکر، صفحه را یکبار رفرش کن تا تغییرات سریع دیده شود
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

