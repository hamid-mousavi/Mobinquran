import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * تشخیص گفتار مرورگر (Web Speech API) برای تلاوت از حفظ — هم‌رفتار با استودیوی مباحثهٔ صوتی:
 * ضبط پیوسته، حفظ متن در مکث‌ها و راه‌اندازی مجدد خودکار تا زمانی که کاربر خودش متوقف کند.
 */
export interface SpeechRecitation {
  supported: boolean;
  isRecording: boolean;
  transcript: string;
  /** شروع/توقف ضبط */
  toggle: () => void;
  /** توقف و پاک‌کردن متن */
  reset: () => void;
}

export function useSpeechRecitation(lang: string): SpeechRecitation {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const explicitRef = useRef(false);
  const accumulatedRef = useRef('');

  const Ctor =
    typeof window !== 'undefined'
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : undefined;
  const supported = Boolean(Ctor);

  useEffect(() => {
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    recognition.lang = lang;

    recognition.onresult = (event: any) => {
      let current = '';
      for (let i = 0; i < event.results.length; i++) {
        const res = event.results[i];
        if (res && res[0]) current += res[0].transcript + ' ';
      }
      setTranscript((accumulatedRef.current + ' ' + current).replace(/\s+/g, ' ').trim());
    };

    recognition.onerror = (event: any) => {
      if (event?.error === 'not-allowed' || event?.error === 'service-not-allowed') {
        explicitRef.current = false;
        setIsRecording(false);
      }
    };

    recognition.onend = () => {
      if (explicitRef.current) {
        // مکث یا نفس‌گیری: متن تا اینجا حفظ و ضبط دوباره آغاز می‌شود
        setTranscript((prev) => {
          accumulatedRef.current = prev;
          return prev;
        });
        setTimeout(() => {
          if (explicitRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch {
              // ضبط از قبل در جریان است
            }
          }
        }, 60);
      } else {
        setIsRecording(false);
      }
    };

    recognitionRef.current = recognition;
    return () => {
      explicitRef.current = false;
      try {
        recognition.stop();
      } catch {
        // متوقف شده است
      }
      recognitionRef.current = null;
    };
  }, [Ctor, lang]);

  const reset = useCallback(() => {
    explicitRef.current = false;
    accumulatedRef.current = '';
    setTranscript('');
    try {
      recognitionRef.current?.stop();
    } catch {
      // متوقف شده است
    }
    setIsRecording(false);
  }, []);

  const toggle = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (explicitRef.current) {
      explicitRef.current = false;
      try {
        rec.stop();
      } catch {
        // متوقف شده است
      }
      setIsRecording(false);
    } else {
      explicitRef.current = true;
      accumulatedRef.current = '';
      setTranscript('');
      try {
        rec.start();
        setIsRecording(true);
      } catch {
        setIsRecording(true);
      }
    }
  }, []);

  return { supported, isRecording, transcript, toggle, reset };
}
