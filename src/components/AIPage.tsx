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
  ChevronRight,
  MessageSquare,
  Copy,
  Check,
  RotateCcw,
} from 'lucide-react';
import { Verse, Surah } from '../types';
import { QuranService } from '../services/quranService';
import { aiResponseSchema, AiResponse } from '../services/aiContract';
import { retrieveAiCandidates, AiCandidateForRequest } from '../services/aiRetrieval';
import {
  AiChatSession,
  AiChatMessage,
  getAiHistory,
  saveAiSession,
  deleteAiSession,
  clearAllAiHistory,
} from '../services/aiHistoryStorage';
import { toPersianDigits } from '../utils/textNormalization';
import { QuranicCard } from './QuranicOrnament';

interface AIPageProps {
  currentVerse?: Verse | null;
  currentSurah?: Surah | null;
  surahs: Surah[];
  darkMode: boolean;
  onBack: () => void;
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
    name: 'رویکرد کاربردی و اخلاقی',
    badge: 'تربیت و سبک زندگی',
    description: 'کاربرد آموزه‌های آیه در زندگی، آرامش دل، امیدبخشی و اخلاق فردی و اجتماعی',
    icon: Heart,
  },
  {
    id: 'conceptual',
    name: 'رویکرد تدبّر مفهومی',
    badge: 'معارف و توحید',
    description: 'تأمل در پیام‌های کلی، پیوند آیه با سایر آموزه‌های قرآن و معارف توحیدی',
    icon: BookOpen,
  },
  {
    id: 'literary',
    name: 'رویکرد ادبی و واژه‌شناسی',
    badge: 'فصاحت و واژگان',
    description: 'بررسی ریشه لغوی واژگان، اشتقاق، تناسب واژه‌ها و وجوه بلاغی آیه شریفه',
    icon: Languages,
  },
  {
    id: 'rational',
    name: 'رویکرد عقلی و اعتقادی',
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

  // بارگذاری تاریخچه محلی از مرورگر
  const reloadHistory = () => {
    setHistoryList(getAiHistory());
  };

  useEffect(() => {
    reloadHistory();
  }, []);

  // شروع جلسه جدید یا تنظیم پیام خوش‌آمد اولیه
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
      // جمع‌آوری سرنخ‌های تدبر و آیات مشابه
      const candidates = await retrieveAiCandidates(query, currentVerse);

      const deviceStorageKey = 'quran_ai_device_id';
      let deviceId = localStorage.getItem(deviceStorageKey);
      if (!deviceId) {
        deviceId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
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
        // حالت پاسخ هوشمند محلی بر پایه گزیده‌های قرآن در صورت عدم دسترسی به سرور
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

      // ذخیره در تاریخچه محلی مرورگر (بدون نیاز به لاگین)
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
        content: 'خطایی در برقراری ارتباط رخ داد. لطفاً دوباره تلاش نمایید.',
        timestamp: Date.now(),
      };
      setMessages([...updatedMessages, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const activeAgent = AI_AGENTS.find((a) => a.id === selectedAgentId) || AI_AGENTS[0];
  const ActiveIcon = activeAgent.icon;

  const copyToClipboard = (text: string, msgId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  return (
    <div className="w-full max-w-4xl min-w-0 mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-28 space-y-4 relative overflow-x-hidden" dir="rtl">
      {/* سربرگ صفحه با دکمه‌های ناوبری و دسترسی به تاریخچه */}
      <div className="flex min-w-0 items-center justify-between gap-2 sm:gap-3 pb-3 border-b border-stone-200 dark:border-slate-800">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            onClick={onBack}
            className="p-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all active:scale-95"
            title="بازگشت به قرائت قرآن"
            aria-label="بازگشت"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="flex min-w-0 items-center gap-2 text-lg sm:text-2xl font-bold text-slate-800 dark:text-slate-100">
              <Bot className="w-6 h-6 text-teal-600 dark:text-teal-400" />
              <span className="min-w-0 truncate">دستیار هوشمند تدبّر قرآنی</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              پاسخ به پرسش‌های قرآنی، تفسیر، واژه‌شناسی و سبک زندگی با ذخیره خودکار تاریخچه در مرورگر
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <button
            onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
            className={`px-3 py-2 rounded-2xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
              showHistoryDrawer
                ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                : 'border-stone-200 dark:border-slate-800 hover:bg-stone-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
            title="مشاهده تاریخچه گفتگوها"
          >
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">تاریخچه</span>
            {historyList.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-teal-500/20 text-teal-700 dark:text-teal-300 text-[10px]">
                {toPersianDigits(historyList.length)}
              </span>
            )}
          </button>

          <button
            onClick={handleStartNewChat}
            className="p-2 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition-all active:scale-95"
            title="گفتگوی جدید"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* کشوی تاریخچه گفتگوی محلی */}
      {showHistoryDrawer && (
        <QuranicCard darkMode={darkMode} className="p-4 space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-stone-200 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-teal-600" />
              <h3 className="font-bold text-xs text-slate-800 dark:text-slate-100">
                تاریخچه گفتگوهای شما (ذخیره‌شده در مرورگر بدون نیاز به ثبت‌نام)
              </h3>
            </div>
            {historyList.length > 0 && (
              <button
                onClick={handleClearAllHistory}
                className="text-[11px] text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>پاک‌سازی کامل</span>
              </button>
            )}
          </div>

          {historyList.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400">
              هنوز گفتگویی در تاریخچه ذخیره نشده است. با ارسال اولین پرسش، گفتگو به‌طور خودکار در مرورگرتان نگهداری می‌شود.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
              {historyList.map((sess) => {
                const isActive = sess.id === currentSessionId;
                const dateStr = new Date(sess.timestamp).toLocaleDateString('fa-IR');
                return (
                  <div
                    key={sess.id}
                    onClick={() => handleLoadSession(sess)}
                    className={`p-2.5 rounded-xl border text-right cursor-pointer transition-all flex items-center justify-between gap-2 ${
                      isActive
                        ? 'border-teal-600 bg-teal-500/10'
                        : 'border-stone-200 dark:border-slate-800 hover:bg-stone-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">
                        {sess.title}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>{toPersianDigits(dateStr)}</span>
                        {sess.verseRef && (
                          <span>
                            سوره {sess.verseRef.surahName} : آیه {toPersianDigits(sess.verseRef.verseNumber)}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteSession(sess.id, e)}
                      className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                      title="حذف این گفتگو"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </QuranicCard>
      )}

      {/* انتخاب رویکرد تدبر (Agents) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {AI_AGENTS.map((agent) => {
          const isSelected = agent.id === selectedAgentId;
          const Icon = agent.icon;
          return (
            <button
              key={agent.id}
              onClick={() => setSelectedAgentId(agent.id)}
              className={`p-3 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                isSelected
                  ? 'border-teal-600 bg-teal-600 text-white shadow-xs'
                  : 'border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-teal-500/40'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-teal-600 dark:text-teal-400'}`} />
                <span className="font-bold text-xs truncate">{agent.name}</span>
              </div>
              <span className={`text-[10px] ${isSelected ? 'text-teal-100' : 'text-slate-400'}`}>
                {agent.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* پنجره گفتگو */}
      <QuranicCard darkMode={darkMode} contentClassName="h-full min-h-0 flex flex-col" className="w-full min-w-0 h-[calc(100dvh-12rem)] min-h-[420px] max-h-[600px] p-3 sm:p-5 flex flex-col overflow-hidden">
        {/* لیست پیام‌ها */}
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden space-y-4 pr-1 pl-1">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            const isCopied = copiedMsgId === msg.id;

            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-2xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <ActiveIcon className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`min-w-0 max-w-[85%] break-words rounded-3xl p-3 sm:p-4 text-xs sm:text-sm leading-relaxed transition-all shadow-xs ${
                    isUser
                      ? 'bg-teal-600 text-white rounded-br-xs'
                      : darkMode
                      ? 'bg-slate-800/90 text-slate-100 border border-slate-700/80 rounded-bl-xs'
                      : 'bg-stone-50 text-slate-800 border border-stone-200 rounded-bl-xs'
                  }`}
                >
                  <div className="whitespace-pre-line leading-relaxed">{msg.content}</div>

                  <div
                    className={`flex items-center justify-between mt-2 pt-1 border-t text-[10px] ${
                      isUser
                        ? 'border-white/20 text-teal-100'
                        : 'border-black/5 dark:border-white/5 text-slate-400'
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
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-2xl bg-teal-600 text-white flex items-center justify-center shrink-0">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
              <div className="p-3.5 rounded-2xl bg-stone-100 dark:bg-slate-800 text-xs text-slate-500 flex items-center gap-2">
                <span>دستیار در حال تأمل و نگارش پاسخ است…</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* پرسش‌های پیشنهادی سریع */}
        <div className="pt-3 border-t border-stone-200 dark:border-slate-800 mt-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
            {SUGGESTED_QUESTIONS.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(q)}
                disabled={isLoading}
                className="whitespace-nowrap px-3 py-1 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-medium transition-all"
              >
                {q}
              </button>
            ))}
          </div>

          {/* فیلد ورودی متن و ارسال */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputText);
            }}
            className="flex items-center gap-2 mt-1"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="سؤال یا موضوع تدبّر خود را بنویسید…"
              disabled={isLoading}
              className="flex-1 px-4 py-3 rounded-2xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-900 text-xs sm:text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="p-3 rounded-2xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white shadow-md transition-all active:scale-95 shrink-0"
              title="ارسال پیام"
            >
              <Send className="w-5 h-5 rotate-180" />
            </button>
          </form>
        </div>
      </QuranicCard>
    </div>
  );
};
