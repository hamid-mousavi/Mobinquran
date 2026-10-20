import { useEffect, useState } from 'react';
import { EVENT_AI_QUOTA, getCachedQuota, refreshAiQuota } from '../services/aiQuotaStore';
import type { AiQuotaStatus } from '../utils/aiQuotaStatus';

/** وضعیت زندهٔ سهمیهٔ هوش مصنوعی؛ هنگام نخستین استفاده (و هر ۶۰ ثانیه حداکثر) از سرور خوانده می‌شود */
export function useAiQuota(): AiQuotaStatus | null {
  const [status, setStatus] = useState<AiQuotaStatus | null>(getCachedQuota());
  useEffect(() => {
    const onUpdate = () => setStatus(getCachedQuota());
    window.addEventListener(EVENT_AI_QUOTA, onUpdate);
    void refreshAiQuota().then(onUpdate);
    return () => window.removeEventListener(EVENT_AI_QUOTA, onUpdate);
  }, []);
  return status;
}
