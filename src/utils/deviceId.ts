const DEVICE_ID_KEY = 'quran_ai_device_id';

export function getOrCreateDeviceId(): string {
  try {
    let deviceId = typeof localStorage !== 'undefined' ? localStorage.getItem(DEVICE_ID_KEY) : null;
    if (!deviceId || deviceId.length < 8) {
      deviceId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `dev_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(DEVICE_ID_KEY, deviceId);
      }
    }
    return deviceId;
  } catch {
    return `fallback_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
