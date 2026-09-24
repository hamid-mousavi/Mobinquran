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
} from 'lucide-react';
import { Verse, Surah } from '../types';
import { aiResponseSchema } from '../services/aiContract';
import { retrieveAiCandidates } from '../services/aiRetrieval';
import {
  AiChatSession,
  AiChatMessage,
  getAiHistory,
  saveAiSession,
  deleteAiSession,
  clearAllAiHistory,
} from '../services/aiHistoryStorage';
import { toPersianDigits } from '../utils/textNormalization';

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

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const reloadHistory = () => {
    setHistoryList(getAiHistory());
  };

  useEffect(() => {
    reloadHistory();
  }, []);

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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
      const candidates = await retrieveAiCandidates(query, currentVerse);

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
          candidates: candidates.map(({ ref, text_fa }) => ({ ref, text_fa })),
          lang: 'fa',
          agent: selectedAgentId,
        }),
      });

      let assistantText = '';
      if (response.ok) {
        const json = await response.json();
        const parsed = aiResponseSchema.safeParse(json);
        if (parsed.success && parsed.data.summary) {
          assistantText = parsed.data.summary;
        } else if (json.summary) {
          assistantText = json.summary;
        } else {
          assistantText = 'پاسخ دریافت شد اما قالب آن نامعتبر بود.';
        }
      } else {
        if (candidates.length > 0) {
          assistantText = `در پرتو پرسش شما و آیات متناظر، این آموزه‌ها را می‌توان تدبّر کرد:\n\n${candidates
            .map(
              (c) =>
                `• سوره ${toPersianDigits(c.verse.surahId)}، آیه ${toPersianDigits(c.verse.verseNumber)}:\n«${c.verse.textArabic}»\n${c.text_fa}`
            )
            .join('\n\n')}`;
        } else {
          assistantText =
            'پاسخ سرور در دسترس نبود. لطفاً اتصال اینترنت خود را بررسی فرمایید و مجدداً امتحان کنید.';
        }
      }

      const assistantMsg: AiChatMessage = {
        id: `msg_ai_${Date.now()}`,
        role: 'assistant',
        content: assistantText,
        timestamp: Date.now(),
        agentName: AI_AGENTS.find((a) => a.id === selectedAgentId)?.name,
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
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* دکمه برجسته رفتن به صفحه اصلی */}
          <button
            onClick={handleReturnHome}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95 shrink-0"
            title="بازگشت به صفحه اصلی"
            aria-label="صفحه اصلی"
          >
            <Home className="w-4 h-4" />
            <span className="inline">صفحه اصلی</span>
          </button>

          {/* دکمه بازگشت قبلی */}
          <button
            onClick={onBack}
            className="p-2 rounded-xl border border-stone-200 dark:border-slate-700/80 hover:bg-stone-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all active:scale-95 shrink-0"
            title="بازگشت به نمای قبل"
            aria-label="بازگشت"
          >
            <ArrowRight className="w-4 h-4" />
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

        {/* سمت چپ: ابزارهای تاریخچه و گفتگوی جدید */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
              showHistoryDrawer
                ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                : 'border-stone-200 dark:border-slate-700 hover:bg-stone-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
            title="تاریخچه گفتگوها"
          >
            <History className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">تاریخچه</span>
            {historyList.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-teal-500/20 text-teal-700 dark:text-teal-300 text-[10px]">
                {toPersianDigits(historyList.length)}
              </span>
            )}
          </button>

          <button
            onClick={handleStartNewChat}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95"
            title="گفتگوی جدید"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span className="hidden xs:inline sm:inline">گفتگوی نو</span>
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
                  <div className="whitespace-pre-line leading-relaxed font-normal">{msg.content}</div>

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
            پاسخ‌ها جنبهٔ تدبّر و انس با قرآن دارند و جایگزین فتوای فقهی یا نظرات اجتهادی علما نیستند.
          </p>
        </div>
      </footer>
    </div>
  );
};
