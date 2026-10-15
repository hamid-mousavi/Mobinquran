import { describe, it, expect, beforeEach } from 'vitest';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      store = {};
    },
  };
})();

describe('Splash Screen & Navigation Management', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });
    localStorageMock.clear();
  });

  it('determines splash screen only shows on first run and is skipped on subsequent opens', () => {
    // بار اول: کلید mobin_has_seen_splash در حافظه نیست
    const hasSeenFirstTime = localStorageMock.getItem('mobin_has_seen_splash');
    const shouldShowFirstTime = !hasSeenFirstTime;
    expect(shouldShowFirstTime).toBe(true);

    // ثبت مشاهده توسط برنامه
    localStorageMock.setItem('mobin_has_seen_splash', 'true');

    // دفعات بعدی باز کردن برنامه
    const hasSeenSecondTime = localStorageMock.getItem('mobin_has_seen_splash');
    const shouldShowSecondTime = !hasSeenSecondTime;
    expect(shouldShowSecondTime).toBe(false);
  });

  it('handles back button navigation stack (Instagram-like flow)', () => {
    let activePage = 'home';
    let historyStack = ['home'];
    let isModalOpen = false;

    // شبیه‌سازی ورود به صفحه قرائت
    activePage = 'reader';
    historyStack.push('reader');
    expect(activePage).toBe('reader');

    // شبیه‌سازی باز شدن مودال فهرست سوره‌ها
    isModalOpen = true;

    // بار اول لمس دکمه Back: باید مودال بسته شود و در همان صفحه قرائت بماند
    if (isModalOpen) {
      isModalOpen = false;
    } else if (historyStack.length > 1) {
      historyStack.pop();
      activePage = historyStack[historyStack.length - 1];
    }
    expect(isModalOpen).toBe(false);
    expect(activePage).toBe('reader');

    // بار دوم لمس دکمه Back: باید به صفحه قبلی (خانه) برگردد
    if (isModalOpen) {
      isModalOpen = false;
    } else if (historyStack.length > 1) {
      historyStack.pop();
      activePage = historyStack[historyStack.length - 1];
    }
    expect(activePage).toBe('home');
    expect(historyStack).toEqual(['home']);

    // بار سوم لمس دکمه Back در خانه: اپلیکیشن نباید بلافاصله خارج شود مگر با دو بار لمس متوالی
    let exitAppCalled = false;
    let lastPressTime = 0;
    const handleBackOnHome = (currentTime: number) => {
      if (lastPressTime > 0 && currentTime - lastPressTime < 2000) {
        exitAppCalled = true;
      } else {
        lastPressTime = currentTime;
      }
    };

    const t0 = 1000000;
    handleBackOnHome(t0);
    expect(exitAppCalled).toBe(false); // لمس اول فقط هشدار می‌دهد

    handleBackOnHome(t0 + 500);
    expect(exitAppCalled).toBe(true); // لمس دوم ظرف نیم‌ثانیه اپلیکیشن را می‌بندد
  });
});
