import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initServiceWorker } from './services/pwaManager';
import { initPWAInstallTracker } from './services/pwaInstallService';

// راه‌اندازی Service Worker مدیریت‌شده مبتنی بر Workbox بدون رفرش ناخواسته
initServiceWorker();
initPWAInstallTracker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);


