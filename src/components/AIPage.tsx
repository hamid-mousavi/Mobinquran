import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowRight,
  Bot,
  Send,
  Sparkles,
  History,
  Plus,
  Trash2,
  BookOpen,
  Heart,
  Languages,
  ShieldCheck,
  Loader2,
  Home,
  Copy,
  Check,
  X,
  Share2,
  ExternalLink,
  Globe,
  Compass,
  MessageSquare,
  Quote,
  Lightbulb,
  Save,
} from 'lucide-react';
import { Verse, Surah } from '../types';
import { aiResponseSchema } from '../services/aiContract';
import { SourceItem, UserIntent } from '../services/aiAgent/types';
import {
  AiChatSession,
  AiChatMessage,
  getAiHistory,
  saveAiSession,
  deleteAiSession,
  clearAllAiHistory,
} from '../services/aiHistoryStorage';
import { toPersianDigits } from '../utils/textNormalization';
import { getVerseReflection, saveVerseReflection } from '../services/aiReflectionStorage';

interface AIPageProps {
  currentVerse?: Verse | null;
  currentSurah?: Surah | null;
  surahs: Surah[];
  darkMode: boolean;
  onBack: () => void;
  onNavigateHome?: () => void;
  onNavigateToVerse?: (surahId: number, verseNumber: number) => void;
}

export type AIAgentId = 'moral' | 'conceptual' | 'literary' | 'rational';

interface AIAgentInfo {
  id: AIAgentId;
  name: string;
  badge: string;
  description: string;
  icon: React.FC<{ className?: string }>;
}

const AI_AGENTS: AIAgentInfo[] = [
  {
    id: 'moral',
    name: 'اخلاقی و کاربردی',
    badge: 'سبک زندگی و آرامش دل',
    description: 'کاربرد آموزه‌های آیه در زندگی، آرامش دل، امیدبخشی و اخلاق فردی و اجتماعی',
    icon: Heart,
  },
  {
    id: 'conceptual',
    name: 'تدبّر مفهومی',
    badge: 'معارف و توحید',
    description: 'تأمل در پیام‌های کلی، پیوند آیه با سایر آموزه‌های قرآن و معارف توحیدی',
    icon: BookOpen,
  },
  {
    id: 'literary',
    name: 'ادبی و واژه‌شناسی',
    badge: 'فصاحت و واژگان',
    description: 'بررسی ریشه لغوی واژگان، اشتقاق، تناسب واژه‌ها و وجوه بلاغی آیه شریفه',
    icon: Languages,
  },
  {
    id: 'rational',
    name: 'عقلی و اعتقادی',
    badge: 'استدلال و باورها',
    description: 'پاسخ‌های استدلالی به پرسش‌های فکری و مبانی اعتقادی در پرتو آیه',
    icon: ShieldCheck,
  },
];

const SUGGESTED_QUESTIONS = [
  'پیام‌های کاربردی این آیه برای زندگی امروز چیست؟',
  'نکات تفسیری و لطایف معنایی آیه را توضیح دهید.',
  'ریشه واژگان کلیدی و مفاهیم بلاغی آیه چیست؟',
  'چگونه می‌توان به این آیه در هنگام سختی‌ها عمل کرد؟',
];

export const AIPage: React.FC<AIPageProps> = ({
  currentVerse,
  currentSurah,
  surahs,
  darkMode,
  onBack,
  onNavigateHome,
  onNavigateToVerse,
}) => {
  const [selectedAgentId, setSelectedAgentId] = useState<AIAgentId>('moral');
  const [historyList, setHistoryList] = useState<AiChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => `session_${Date.now()}`);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [reflectionText, setReflectionText] = useState('');
  const [savedReflection, setSavedReflection] = useState('');
  const [reflectionStatus, setReflectionStatus] = useState('');

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const reloadHistory = () => {
    setHistoryList(getAiHistory());
  };

  useEffect(() => {
    reloadHistory();
  }, []);

  useEffect(() => {
    if (!currentVerse) {
      setReflectionText('');
      setSavedReflection('');
      setReflectionStatus('');
      return;
    }

    const note = getVerseReflection(currentVerse.surahId, currentVerse.verseNumber);
    setReflectionText(note);
    setSavedReflection(note);
    setReflectionStatus('');
  }, [currentVerse?.surahId, currentVerse?.verseNumber]);

  useEffect(() => {
    if (messages.length === 0) {
      const initialText = currentVerse
        ? `سلام و درود بر شما. آماده‌ام تا در پرتو کلام نورانی آیه ${toPersianDigits(currentVerse.verseNumber)} سوره مبارکه ${currentSurah?.nameArabic || ''} با هم به تدبّر و گفتگو بنشینیم. چه نکته یا سؤالی در نظر دارید؟`
        : `سلام علیکم. من دستیار هوشمند تدبّر قرآنی هستم. آماده‌ام به پرسش‌های قرآنی، تفسیری، واژه‌شناسی و پیام‌های کاربردی آیات برای آرامش دل و زندگی پاسخ دهم.`;

      setMessages([
        {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: initialText,
          timestamp: Date.now(),
          agentName: AI_AGENTS.find((a) => a.id === selectedAgentId)?.name,
        },
      ]);
    }
  }, [currentVerse, currentSurah, selectedAgentId]);

  useEffect(() => {
    if (messages.length > 1 || isLoading) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleStartNewChat = () => {
    const newId = `session_${Date.now()}`;
    setCurrentSessionId(newId);
    setMessages([
      {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: `گفتگوی جدید آغاز شد. می‌توانید پرسش خود را پیرامون آیات یا مفاهیم قرآنی مطرح فرمایید.`,
        timestamp: Date.now(),
        agentName: AI_AGENTS.find((a) => a.id === selectedAgentId)?.name,
      },
    ]);
    setShowHistoryDrawer(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleLoadSession = (sess: AiChatSession) => {
    setCurrentSessionId(sess.id);
    setMessages(sess.messages);
    setShowHistoryDrawer(false);
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteAiSession(id);
    reloadHistory();
    if (currentSessionId === id) {
      handleStartNewChat();
    }
  };

  const handleClearAllHistory = () => {
    if (confirm('آیا از پاک‌سازی کامل تاریخچه گفتگوها اطمینان دارید؟')) {
      clearAllAiHistory();
      reloadHistory();
      handleStartNewChat();
    }
  };

  const handleSendMessage = async (textToSend: string) => {
    const query = textToSend.trim();
    if (!query || isLoading) return;

    const userMsg: AiChatMessage = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputText('');
    setIsLoading(true);

    try {
      const deviceStorageKey = 'quran_ai_device_id';
      let deviceId = localStorage.getItem(deviceStorageKey);
      if (!deviceId) {
        deviceId = typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem(deviceStorageKey, deviceId);
      }

      const response = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-ID': deviceId,
        },
        body: JSON.stringify({
          question: query,
          history: messages.slice(-4).map((m) => ({
            role: m.role,
            content: m.content,
          })),
          currentVerse: currentVerse
            ? {
                surahId: currentVerse.surahId,
                verseNumber: currentVerse.verseNumber,
                textArabic: currentVerse.textArabic,
                translationMakarem: currentVerse.translationMakarem,
              }
            : null,
          lang: 'fa',
          agent: selectedAgentId,
        }),
      });

      let assistantText = '';
      let summary: string | undefined;
      let directAnswer: string | undefined;
      let sourceQuote: string | undefined;
      let aiAnalysis: string | undefined;
      let practicalTakeaway: string | undefined;
      let tafsirCitations: string[] = [];
      let socraticQuestions: string[] = [];
      let sources: SourceItem[] = [];
      let intent: UserIntent | undefined;

      if (response.ok) {
        const json = await response.json();
        const parsed = aiResponseSchema.safeParse(json);
        const data = (parsed.success ? parsed.data : json) as any;

        assistantText = data.summary || data.direct_answer || '';
        summary = data.summary;
        directAnswer = data.direct_answer;
        sourceQuote = data.source_quote;
        aiAnalysis = data.ai_analysis;
        practicalTakeaway = data.practical_takeaway;
        tafsirCitations = data.tafsir_citations || [];
        socraticQuestions = data.socratic_questions || [];
        sources = data.sources || [];
        intent = data.intent;
      } else {
        const errorPayload = await response.json().catch(() => null);
        const errorMessages: Record<string, string> = {
          ai_unavailable: 'سرویس هوش مصنوعی روی سرور در دسترس یا پیکربندی نشده است.',
          daily_limit_reached: 'سهمیهٔ روزانهٔ گفتگو تمام شده است.',
          quota_unavailable: 'سرویس سهمیه‌بندی سرور در دسترس نیست.',
          provider_rate_limited: 'سرویس هوش مصنوعی موقتاً درخواست‌های زیادی دریافت کرده است.',
          invalid_model_output: 'پاسخ مدل با قالب مورد انتظار سازگار نبود. لطفاً دوباره تلاش کنید.',
          upstream_error: 'سرور نتوانست به سرویس هوش مصنوعی وصل شود.',
          invalid_request: 'درخواست گفتگو معتبر نبود. صفحه را تازه‌سازی و دوباره امتحان کنید.',
        };
        const code = typeof errorPayload?.code === 'string' ? errorPayload.code : '';
        assistantText = errorMessages[code]
          || (typeof errorPayload?.error === 'string'
            ? errorPayload.error
            : 'پاسخ سرور در دسترس نبود. اتصال اینترنت را بررسی و دوباره امتحان کنید.');
        if (typeof errorPayload?.provider === 'string' && Number.isInteger(errorPayload?.providerStatus)) {
          assistantText += `\nجزئیات اتصال: ${errorPayload.provider}، کد ${errorPayload.providerStatus}`;
        }
        if (typeof errorPayload?.requestId === 'string') {
          assistantText += `\nشناسهٔ پیگیری: ${errorPayload.requestId}`;
        }
      }

      const assistantMsg: AiChatMessage = {
        id: `msg_ai_${Date.now()}`,
        role: 'assistant',
        content: assistantText,
        summary,
        directAnswer,
        sourceQuote,
        aiAnalysis,
        practicalTakeaway,
        timestamp: Date.now(),
        agentName: AI_AGENTS.find((a) => a.id === selectedAgentId)?.name,
        tafsirCitations: tafsirCitations.length > 0 ? tafsirCitations : undefined,
        socraticQuestions: socraticQuestions.length > 0 ? socraticQuestions : undefined,
        sources: sources.length > 0 ? sources : undefined,
        intent,
      };

      const finalMessages = [...updatedMessages, assistantMsg];
      setMessages(finalMessages);

      const sessionTitle = query.length > 35 ? `${query.slice(0, 35)}…` : query;
      const sessionData: AiChatSession = {
        id: currentSessionId,
        title: sessionTitle,
        timestamp: Date.now(),
        verseRef: currentVerse
          ? {
              surahId: currentVerse.surahId,
              surahName: currentSurah?.nameArabic || '',
              verseNumber: currentVerse.verseNumber,
            }
          : undefined,
        messages: finalMessages,
      };
      saveAiSession(sessionData);
      reloadHistory();
    } catch (err) {
      console.error('AI chat error:', err);
      const errorMsg: AiChatMessage = {
        id: `msg_err_${Date.now()}`,
        role: 'assistant',
        content: 'متأسفانه در برقراری ارتباط خطایی رخ داد. لطفاً مجدداً امتحان فرمایید.',
        timestamp: Date.now(),
      };
      setMessages([...updatedMessages, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSourceClick = (src: SourceItem) => {
    if (src.isInternal || src.type === 'quran') {
      let sId = src.metadata?.surahId;
      let vNum = src.metadata?.verseNumber;
      if (!sId || !vNum) {
        const match = src.url.match(/\/quran\/(\d+)\/(\d+)/i) || src.id.match(/^quran:(\d+):(\d+)$/i);
        if (match) {
          sId = parseInt(match[1], 10);
          vNum = parseInt(match[2], 10);
        }
      }
      if (sId && vNum && onNavigateToVerse) {
        try {
          window.history.pushState(null, '', `/quran/${sId}/${vNum}`);
        } catch {}
        onNavigateToVerse(sId, vNum);
        return;
      }
    }

    if (src.url) {
      window.open(src.url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleSaveReflection = () => {
    if (!currentVerse) return;
    const normalizedText = reflectionText.trim();
    if (saveVerseReflection(currentVerse.surahId, currentVerse.verseNumber, normalizedText)) {
      setReflectionText(normalizedText);
      setSavedReflection(normalizedText);
      setReflectionStatus(normalizedText ? 'یادداشت شخصی به این آیه پیوند خورد.' : 'یادداشت این آیه حذف شد.');
    } else {
      setReflectionStatus('ذخیره انجام نشد. فضای ذخیره‌سازی مرورگر را بررسی کنید.');
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const activeAgent = AI_AGENTS.find((a) => a.id === selectedAgentId) || AI_AGENTS[0];
  const ActiveIcon = activeAgent.icon;

  const handleReturnHome = () => {
    if (onNavigateHome) {
      onNavigateHome();
    } else {
      onBack();
    }
  };

  return (
    <div
      id="ai-fullscreen-chat"
      className="fixed inset-0 z-50 flex flex-col h-screen h-dvh w-full bg-[#faf8f5] dark:bg-[#070b14] text-slate-800 dark:text-slate-100 overflow-hidden font-['Vazirmatn'] select-none"
      dir="rtl"
    >
      {/* سربرگ اختصاصی و مدرن فول‌اسکرین چت */}
      <header className="shrink-0 h-16 border-b border-stone-200/90 dark:border-slate-800/90 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between gap-2 shadow-xs">
        {/* سمت راست: دکمه صفحه اصلی، دکمه بازگشت و عنوان */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          {/* دکمه آیکونی رفتن به صفحه اصلی */}
          <button
            onClick={handleReturnHome}
            className="p-2 sm:p-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition-all active:scale-95 shrink-0"
            title="بازگشت به صفحه اصلی"
            aria-label="صفحه اصلی"
          >
            <Home className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* دکمه آیکونی بازگشت به نمای قبل */}
          <button
            onClick={onBack}
            className="p-2 sm:p-2.5 rounded-xl border border-stone-200 dark:border-slate-700/80 hover:bg-stone-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all active:scale-95 shrink-0"
            title="بازگشت به نمای قبل"
            aria-label="بازگشت"
          >
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* عنوان و آیکن دستیار */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <h1 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate">
                دستیار تدبّر قرآنی
              </h1>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {currentVerse && currentSurah ? (
                <span>
                  در پرتو سوره {currentSurah.nameArabic} (آیه {toPersianDigits(currentVerse.verseNumber)})
                </span>
              ) : (
                <span>پاسخگویی و تدبّر بر مبنای آیات قرآن کریم</span>
              )}
            </p>
          </div>
        </div>

        {/* سمت چپ: ابزارهای کاملاً آیکونی تاریخچه و گفتگوی جدید */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
            className={`p-2 sm:p-2.5 rounded-xl border relative transition-all active:scale-95 ${
              showHistoryDrawer
                ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                : 'border-stone-200 dark:border-slate-700 hover:bg-stone-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
            title="تاریخچه گفتگوها"
            aria-label="تاریخچه گفتگوها"
          >
            <History className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
            {historyList.length > 0 && (
              <span className="absolute -top-1 -right-1 px-1 rounded-full bg-amber-500 text-slate-950 font-bold text-[9px] leading-tight min-w-[16px] text-center">
                {toPersianDigits(historyList.length)}
              </span>
            )}
          </button>

          <button
            onClick={handleStartNewChat}
            className="p-2 sm:p-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition-all active:scale-95 shrink-0"
            title="گفتگوی جدید"
            aria-label="گفتگوی جدید"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          </button>
        </div>
      </header>

      {/* کشوی افقی یا پنل تاریخچه در صورت فعال بودن */}
      {showHistoryDrawer && (
        <div className="shrink-0 bg-stone-100/90 dark:bg-slate-900/90 border-b border-stone-200 dark:border-slate-800 p-3 sm:px-6 max-h-56 overflow-y-auto animate-fadeIn">
          <div className="max-w-3xl mx-auto space-y-2">
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                <History className="w-4 h-4 text-teal-600" />
                <span>جلسات گذشته گفتگو</span>
              </div>
              <div className="flex items-center gap-3">
                {historyList.length > 0 && (
                  <button
                    onClick={handleClearAllHistory}
                    className="text-[11px] text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>پاک کردن همه</span>
                  </button>
                )}
                <button
                  onClick={() => setShowHistoryDrawer(false)}
                  className="p-1 rounded-lg hover:bg-stone-200 dark:hover:bg-slate-800 text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {historyList.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">
                هنوز گفتگویی در تاریخچه ذخیره نشده است. با ارسال اولین پیام، تاریخچه محلی تشکیل می‌شود.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {historyList.map((sess) => {
                  const isActive = sess.id === currentSessionId;
                  const dateStr = new Date(sess.timestamp).toLocaleDateString('fa-IR');
                  return (
                    <div
                      key={sess.id}
                      onClick={() => handleLoadSession(sess)}
                      className={`p-2.5 rounded-xl border text-right cursor-pointer transition-all flex items-center justify-between gap-2 ${
                        isActive
                          ? 'border-teal-600 bg-teal-500/10 text-teal-900 dark:text-teal-200'
                          : 'border-stone-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800 bg-stone-50 dark:bg-slate-900/60'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs truncate">{sess.title}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                          <span>{toPersianDigits(dateStr)}</span>
                          {sess.verseRef && (
                            <span>
                              سوره {sess.verseRef.surahName} (آیه {toPersianDigits(sess.verseRef.verseNumber)})
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteSession(sess.id, e)}
                        className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* نوار انتخاب رویکرد تدبر (Agent Selector) - تمیز و بدون شلوغی */}
      <div className="shrink-0 bg-white/70 dark:bg-slate-900/50 border-b border-stone-200/60 dark:border-slate-800/60 px-3 sm:px-6 py-2 overflow-x-auto scrollbar-none">
        <div className="max-w-3xl mx-auto flex items-center gap-1.5 sm:gap-2">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0 ml-1">
            رویکرد:
          </span>
          {AI_AGENTS.map((agent) => {
            const isSelected = agent.id === selectedAgentId;
            const Icon = agent.icon;
            return (
              <button
                key={agent.id}
                onClick={() => setSelectedAgentId(agent.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all shrink-0 ${
                  isSelected
                    ? 'bg-teal-600 text-white font-bold shadow-xs'
                    : 'bg-stone-100 hover:bg-stone-200 dark:bg-slate-800/90 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
                title={agent.description}
              >
                <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-teal-600 dark:text-teal-400'}`} />
                <span>{agent.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ناحیه اسکرول پیام‌های گفتگو - فول‌اسکرین در سراسر ارتفاع صفحه */}
      <main className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 py-4 space-y-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {currentVerse && currentSurah && (
            <section className="rounded-2xl border border-teal-200/80 dark:border-teal-900 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-stone-100 dark:border-slate-800 bg-teal-50/70 dark:bg-teal-950/25">
                <div className="flex items-center gap-2 text-teal-800 dark:text-teal-300">
                  <Sparkles className="w-4 h-4" />
                  <h2 className="font-bold text-sm sm:text-base">با این آیه فکر کن</h2>
                </div>
                <p className="mt-3 text-right text-xl sm:text-2xl leading-loose font-['Amiri',serif] text-slate-900 dark:text-slate-100">
                  {currentVerse.textArabic}
                </p>
                <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  {currentVerse.translationMakarem}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      window.history.pushState(null, '', `/quran/${currentVerse.surahId}/${currentVerse.verseNumber}`);
                    } catch {}
                    onNavigateToVerse?.(currentVerse.surahId, currentVerse.verseNumber);
                  }}
                  className="mt-3 inline-flex items-center gap-1 text-[11px] text-teal-700 dark:text-teal-300 hover:underline"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>قرآن کریم، {currentSurah.namePersian}، آیه {toPersianDigits(currentVerse.verseNumber)}</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>

              <div className="p-4 sm:p-5 space-y-4">
                <div>
                  <label htmlFor="verse-reflection-note" className="block text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                    یک جمله‌ای که از این آیه با خودت می‌بری بنویس.
                  </label>
                  <textarea
                    id="verse-reflection-note"
                    value={reflectionText}
                    onChange={(event) => {
                      setReflectionText(event.target.value);
                      setReflectionStatus('');
                    }}
                    rows={2}
                    maxLength={500}
                    placeholder="مثلاً: قبل از واکنش، صبر کنم."
                    className="mt-2 w-full resize-y rounded-xl border border-stone-300 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 px-3 py-2.5 text-xs sm:text-sm leading-relaxed text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p aria-live="polite" className="text-[11px] text-slate-500 dark:text-slate-400">
                      {reflectionStatus || `یادداشت خصوصی و پیوندخورده به این آیه · ${toPersianDigits(reflectionText.length)}/۵۰۰`}
                    </p>
                    <button
                      type="button"
                      onClick={handleSaveReflection}
                      disabled={reflectionText.trim() === savedReflection}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-40"
                    >
                      {reflectionText.trim() === savedReflection && savedReflection ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      <span>ذخیره یادداشت</span>
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            const isCopied = copiedMsgId === msg.id;

            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 sm:gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                    <ActiveIcon className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`min-w-0 max-w-[88%] sm:max-w-[80%] break-words rounded-2xl p-3.5 sm:p-4 text-xs sm:text-sm leading-relaxed transition-all shadow-xs ${
                    isUser
                      ? 'bg-teal-600 text-white rounded-br-xs'
                      : darkMode
                      ? 'bg-slate-900/95 text-slate-100 border border-slate-800 rounded-bl-xs'
                      : 'bg-white text-slate-800 border border-stone-200/90 rounded-bl-xs'
                  }`}
                >
                  {/* نشانگر تشخیص هوشمند نیاز و مسیردهی (Intent) */}
                  {!isUser && msg.intent && (
                    <div className="mb-2.5">
                      {msg.intent === 'casual_chat' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-stone-100 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-300 font-medium">
                          <MessageSquare className="w-3 h-3 text-slate-500" />
                          <span>گفت‌وگوی صمیمانه</span>
                        </span>
                      )}
                      {msg.intent === 'quran_inquiry' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 border border-teal-200/60 dark:border-teal-800/60 text-[10px] text-teal-700 dark:text-teal-300 font-medium">
                          <BookOpen className="w-3 h-3 text-teal-600" />
                          <span>تدبّر در قرآن، تفسیر و حدیث</span>
                        </span>
                      )}
                      {msg.intent === 'current_info' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/60 border border-sky-200/60 dark:border-sky-800/60 text-[10px] text-sky-700 dark:text-sky-300 font-medium">
                          <Globe className="w-3 h-3 text-sky-600" />
                          <span>جستجوی مستند وب</span>
                        </span>
                      )}
                      {msg.intent === 'hybrid' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 border border-purple-200/60 dark:border-purple-800/60 text-[10px] text-purple-700 dark:text-purple-300 font-medium">
                          <Compass className="w-3 h-3 text-purple-600" />
                          <span>تحلیل تلفیقی معارف و مسائل روز</span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Keep the model's own response distinct from related sources. */}
                  <div className="whitespace-pre-line leading-relaxed font-normal">
                    {(msg.summary || msg.directAnswer || msg.content) && (
                      <>
                        {(msg.summary || msg.directAnswer) && (
                          <div className="mb-1 font-bold text-teal-700 dark:text-teal-300">پاسخ دستیار:</div>
                        )}
                        {msg.summary || msg.directAnswer || msg.content}
                      </>
                    )}
                  </div>

                  {/* ۲. تفکیک صریح: متن منبع وحیانی یا روایی */}
                  {msg.sourceQuote && msg.sourceQuote.trim() && (
                    <div className="mt-3 p-3 rounded-2xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200/80 dark:border-teal-800/80 space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-[11px] text-teal-800 dark:text-teal-300">
                        <Quote className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                        <span>متن صریح منبع:</span>
                      </div>
                      <p className="text-xs sm:text-[13px] leading-relaxed font-['Amiri',serif] text-slate-800 dark:text-slate-200 pr-1">
                        {msg.sourceQuote}
                      </p>
                    </div>
                  )}

                  {/* AI interpretation follows the linked source references. */}
                  {msg.aiAnalysis && msg.aiAnalysis.trim() && (
                    <div className="mt-3 p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-800/70 space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-[11px] text-indigo-800 dark:text-indigo-300">
                        <Lightbulb className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <span>تحلیل کوتاه هوش مصنوعی:</span>
                      </div>
                      <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300 pr-1 whitespace-pre-line">
                        {msg.aiAnalysis}
                      </p>
                    </div>
                  )}

                  {/* ۴. تفکیک صریح: پیشنهاد و برداشت کاربردی برای زندگی */}
                  {msg.practicalTakeaway && msg.practicalTakeaway.trim() && (
                    <div className="mt-3 p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/70 space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-[11px] text-emerald-800 dark:text-emerald-300">
                        <Heart className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>پیشنهاد و برداشت کاربردی برای زندگی:</span>
                      </div>
                      <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300 pr-1 whitespace-pre-line">
                        {msg.practicalTakeaway}
                      </p>
                    </div>
                  )}

                  {/* ۵. منابع و مراجع تفسیری معتبر سنتی */}
                  {msg.tafsirCitations && msg.tafsirCitations.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-stone-200/80 dark:border-slate-800 flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1 shrink-0">
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>منابع تفسیری:</span>
                      </span>
                      {msg.tafsirCitations.map((cite, cIdx) => (
                        <span
                          key={cIdx}
                          className="px-2 py-0.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-200/70 dark:border-teal-800/70 text-teal-800 dark:text-teal-300 font-medium"
                        >
                          {cite}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* ۶. پرسش‌های سقراطی برای تعمیق مفهوم */}
                  {msg.socraticQuestions && msg.socraticQuestions.length > 0 && (
                    <div className="mt-3 p-3 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 text-amber-950 dark:text-amber-200 space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-amber-700 dark:text-amber-400">
                        <Sparkles className="w-3.5 h-3.5 shrink-0" />
                        <span>💭 پرسش‌های سقراطی برای تأمل درونی:</span>
                      </div>
                      <div className="space-y-1.5 text-xs leading-relaxed pr-1">
                        {msg.socraticQuestions.map((q, qIdx) => (
                          <div key={qIdx} className="flex items-start gap-1.5">
                            <span className="text-amber-600 dark:text-amber-400 font-bold shrink-0">•</span>
                            <span>{q}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3.5 pt-3 border-t border-stone-200/80 dark:border-slate-800 space-y-2">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-teal-700 dark:text-teal-400">
                        <BookOpen className="w-3.5 h-3.5 shrink-0" />
                        <span>منابع مرتبط برای مطالعه (نه لزوماً منابع استفاده‌شده در پاسخ):</span>
                      </div>
                      {msg.sources.map((source) => {
                        const isQuran = source.type === 'quran' || source.isInternal;
                        return (
                          <button
                            key={source.id}
                            onClick={() => handleSourceClick(source)}
                            type="button"
                            className="flex w-full items-center justify-between gap-2 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800/60 p-2.5 text-right hover:border-teal-500/70 hover:bg-white dark:hover:bg-slate-800"
                            title={isQuran ? 'باز کردن آیه در قرآن مبین' : 'مشاهده منبع در پنجره جدید'}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{source.title}</span>
                              <span className="mt-0.5 block truncate text-[10px] text-slate-500 dark:text-slate-400">
                                {source.sourceName}{source.reference ? ` · ${source.reference}` : ''}
                              </span>
                            </span>
                            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-teal-700 dark:text-teal-300" />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div
                    className={`flex items-center justify-between mt-2 pt-1.5 border-t text-[10px] ${
                      isUser
                        ? 'border-white/20 text-teal-100'
                        : 'border-stone-100 dark:border-slate-800 text-slate-400'
                    }`}
                  >
                    <span>
                      {toPersianDigits(
                        new Date(msg.timestamp).toLocaleTimeString('fa-IR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      )}
                    </span>

                    {!isUser && (
                      <button
                        onClick={() => copyToClipboard(msg.content, msg.id)}
                        className="flex items-center gap-1 hover:text-teal-600 transition-colors"
                        title="کپی متن"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3 h-3 text-teal-600" />
                            <span>کپی شد</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>کپی</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-2.5 sm:gap-3 justify-start items-center">
              <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
              <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 text-xs text-slate-500 flex items-center gap-2">
                <span>دستیار در حال بررسی آیات و تنظیم پاسخ است…</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* نوار ورودی چت پایین صفحه - کاملاً سازگار با کیبورد مجازی موبایل و ناچ */}
      <footer className="shrink-0 border-t border-stone-200/90 dark:border-slate-800/90 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 sm:px-6 py-2.5 sm:py-3" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 10px)' }}>
        <div className="max-w-3xl mx-auto space-y-2">
          {/* پرسش‌های پیشنهادی سریع در صورت کم بودن پیام‌ها */}
          {messages.length <= 3 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {SUGGESTED_QUESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(q)}
                  disabled={isLoading}
                  className="whitespace-nowrap px-3 py-1 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium transition-all shrink-0"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* فرم ورودی پیام */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputText);
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="پرسش قرآنی، تفسیر، واژه یا موضوع تدبّر را بنویسید…"
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 sm:py-3 rounded-xl border border-stone-300/80 dark:border-slate-700 bg-stone-50/80 dark:bg-slate-950 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="p-2.5 sm:p-3 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white shadow-xs transition-all active:scale-95 shrink-0"
              title="ارسال پیام"
              aria-label="ارسال پیام"
            >
              <Send className="w-4 h-4 sm:w-5 sm:h-5 rotate-180" />
            </button>
          </form>

          <p className="text-[10px] text-center text-slate-400">
            پاسخ از دانش هوش مصنوعی است؛ منابع پیوندخورده برای مطالعه‌اند و لزوماً مبنای پاسخ نیستند. این گفتگو جایگزین فتوا یا نظر اجتهادی نیست.
          </p>
        </div>
      </footer>
    </div>
  );
};
