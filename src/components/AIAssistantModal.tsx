import React, { useState, useEffect, useRef } from 'react';
import { X, Send, BookOpen, Heart, RefreshCw, Languages, ShieldCheck, Bot, Server } from 'lucide-react';
import { Verse, Surah } from '../types';
import { aiResponseSchema, AiResponse } from '../services/aiContract';
import { AiCandidateForRequest, retrieveAiCandidates } from '../services/aiRetrieval';

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVerse?: Verse | null;
  currentSurah?: Surah | null;
  darkMode: boolean;
  onOpenVerse?: (verse: Verse) => void;
}

export type AIAgentId = 'moral' | 'conceptual' | 'literary' | 'rational';

interface AIAgentInfo {
  id: AIAgentId;
  name: string;
  badge: string;
  description: string;
  icon: React.FC<{ className?: string }>;
  color: string;
}

const AI_AGENTS: AIAgentInfo[] = [
  {
    id: 'moral',
    name: 'رویکرد کاربردی و اخلاقی',
    badge: 'تربیت و سبک زندگی',
    description: 'کاربرد آموزه‌های آیه در زندگی روزمره، آرامش دل، امیدبخشی و اخلاق فردی و اجتماعی',
    icon: Heart,
    color: 'from-emerald-500 to-teal-600',
  },
  {
    id: 'conceptual',
    name: 'رویکرد تدبّر مفهومی',
    badge: 'معارف و توحید',
    description: 'تأمل در پیام‌های کلی، پیوند آیه با سایر آموزه‌های قرآن و معارف توحیدی',
    icon: BookOpen,
    color: 'from-amber-500 to-amber-600',
  },
  {
    id: 'literary',
    name: 'رویکرد ادبی و واژه‌شناسی',
    badge: 'فصاحت و واژگان',
    description: 'بررسی ریشه لغوی واژگان، اشتقاق، تناسب واژه‌ها و وجوه بلاغی آیه شریفه',
    icon: Languages,
    color: 'from-blue-500 to-indigo-600',
  },
  {
    id: 'rational',
    name: 'رویکرد عقلی و اعتقادی',
    badge: 'استدلال و باورها',
    description: 'پاسخ‌های عقلانی و استدلالی به پرسش‌های فکری و مبانی اعتقادی در پرتو آیه',
    icon: ShieldCheck,
    color: 'from-purple-500 to-indigo-700',
  },
];

interface Message {
  role: 'user' | 'assistant';
  content: string;
  agentId?: AIAgentId;
  response?: AiResponse;
  localCandidates?: AiCandidateForRequest[];
}

function describeAiFailure(error: unknown, status?: number, code?: string): string {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'اتصال اینترنت قطع است. نتایج جستجوی محلی نمایش داده می‌شود.';
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'زمان پاسخ‌گویی دستیار تمام شد. لطفاً دوباره تلاش کنید.';
  }
  if (code === 'daily_limit_reached' || status === 429) {
    return 'سهمیهٔ دستیار تمام شده یا سرویس موقتاً محدود است. نتایج جستجوی محلی نمایش داده می‌شود.';
  }
  if (code === 'ai_unavailable' || code === 'quota_unavailable' || status === 503) {
    return 'دستیار هوشمند در حال حاضر در دسترس نیست. نتایج جستجوی محلی نمایش داده می‌شود.';
  }
  return 'ارتباط با دستیار برقرار نشد. نتایج جستجوی محلی نمایش داده می‌شود.';
}

const QUICK_TOPICS = [
  'آرامش دل در هنگام اضطراب و نگرانی',
  'صبر در برابر سختی‌ها و گشایش کارها',
  'امید به رحمت پروردگار و بخشش گناهان',
  'برکت در کسب و کار و رزق حلال',
  'اخلاق نیکو و شکیبایی در خانواده',
];

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
  isOpen,
  onClose,
  currentVerse,
  currentSurah,
  darkMode,
  onOpenVerse,
}) => {
  const [selectedAgentId, setSelectedAgentId] = useState<AIAgentId>('moral');
  const [showAgentList, setShowAgentList] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      agentId: 'moral',
      content: currentVerse
        ? `سلام و درود بر شما. آماده‌ام تا با رویکرد کاربردی و اخلاقی در پرتو کلام نورانی آیه ${currentVerse.verseNumber} سوره مبارکه ${currentSurah?.nameArabic || ''} با هم به تدبّر بنشینیم. چه پرسش یا نکته‌ای مد نظرتان است؟`
        : `سلام علیکم. من دستیار هوشمند تدبّر قرآنی هستم. می‌توانید رویکرد تدبّر مورد نظر خود (اخلاقی، مفهومی، ادبی یا عقلی) را از نوار بالا انتخاب فرمایید تا متناسب با آن به تأمل در آیات بپردازیم.`,
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isServerAiEnabled, setIsServerAiEnabled] = useState<boolean | null>(null);
  const [candidates, setCandidates] = useState<AiCandidateForRequest[]>([]);
  const autoReflectionKey = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/ai/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setIsServerAiEnabled(data?.enabled === true);
      })
      .catch(() => setIsServerAiEnabled(false));
  }, [isOpen]);

  const activeAgent = AI_AGENTS.find((a) => a.id === selectedAgentId) || AI_AGENTS[0];
  const ActiveAgentIcon = activeAgent.icon;

  const handleSendMessage = async (customPrompt?: string, automatic = false) => {
    const textToSend = customPrompt || inputText.trim();
    if (!textToSend || isLoading) return;

    const newMessages: Message[] = automatic
      ? messages
      : [...messages, { role: 'user', content: textToSend }];
    if (!automatic) {
      setMessages(newMessages);
      if (!customPrompt) setInputText('');
    }
    setIsLoading(true);
    let fallbackCandidates: AiCandidateForRequest[] = [];

    try {
      try {
        const nextCandidates = await retrieveAiCandidates(textToSend, currentVerse);
        fallbackCandidates = nextCandidates;
        setCandidates(nextCandidates);
        if (nextCandidates.length === 0) {
          throw new Error('no_local_candidates');
        }
        const deviceStorageKey = 'quran_ai_device_id';
        let deviceId = localStorage.getItem(deviceStorageKey);
        if (!deviceId) {
          deviceId = crypto.randomUUID();
          localStorage.setItem(deviceStorageKey, deviceId);
        }
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 20_000);
        let response: Response;
        try {
          response = await fetch('/api/ai/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Device-ID': deviceId },
          signal: controller.signal,
          body: JSON.stringify({
            question: textToSend,
            candidates: nextCandidates.map(({ ref, text_fa }) => ({ ref, text_fa })),
            lang: 'fa',
          }),
          });
        } finally {
          window.clearTimeout(timeoutId);
        }

        const rawBody = await response.text();
        let body: { error?: string; code?: string; requestId?: string } | AiResponse | null = null;
        try {
          body = rawBody ? JSON.parse(rawBody) : null;
        } catch {
          // Non-JSON response
        }

        const validatedResponse = aiResponseSchema.safeParse(body);
        if (!response.ok || !validatedResponse.success) {
          const serverError = body && 'error' in body ? body : null;
          const failure = new Error('ai_request_failed') as Error & { status?: number; code?: string };
          failure.status = response.status;
          failure.code = serverError?.code;
          throw failure;
        }
        const candidateRefs = new Set(nextCandidates.map((candidate) => candidate.ref));
        const safeResponse = {
          ...validatedResponse.data,
          verses: validatedResponse.data.verses.filter((verse) => candidateRefs.has(verse.ref)),
        };
        if (safeResponse.verses.length === 0) throw new Error('invalid_references');
        setMessages([...newMessages, { role: 'assistant', content: safeResponse.summary, agentId: selectedAgentId, response: safeResponse }]);
      } catch (err: unknown) {
        console.error('AI request failed:', err);
        setMessages([
          ...newMessages,
          {
            role: 'assistant',
            agentId: selectedAgentId,
            content: describeAiFailure(
              err,
              (err as { status?: number })?.status,
              (err as { code?: string })?.code,
            ),
            localCandidates: fallbackCandidates,
          },
        ]);
        return;
      }

    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !currentVerse) return;
    const reflectionKey = `${currentVerse.id}:${selectedAgentId}`;
    if (autoReflectionKey.current === reflectionKey) return;
    autoReflectionKey.current = reflectionKey;

    const reflectionPrompt = `این آیه را با «${activeAgent.name}» تدبر کن. یک جمع‌بندی کوتاه و محتاطانه، یک نکته کاربردی برای زندگی امروز و یک پرسش تأملی ارائه بده. متن آیه را بازنویسی نکن و فقط به آیه‌های کاندید ارجاع بده.`;
    void handleSendMessage(reflectionPrompt, true);
  }, [isOpen, currentVerse, selectedAgentId]);

  if (!isOpen) return null;

  return (
    <div
      id="modal-ai-assistant-backdrop"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
    >
      <div
        id="modal-ai-assistant-content"
        className={`w-full sm:max-w-xl h-[88vh] sm:h-[84vh] flex flex-col rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden transition-all ${
          darkMode ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-800'
        }`}
      >
        {/* سربرگ هوش مصنوعی */}
        <div
          className={`p-3.5 border-b flex items-center justify-between ${
            darkMode
              ? 'border-slate-800 bg-slate-900 text-slate-100'
              : 'bg-linear-to-r from-teal-800 to-emerald-900 text-white'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl bg-linear-to-br ${activeAgent.color} text-white flex items-center justify-center shadow`}>
              <ActiveAgentIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-sm sm:text-base leading-tight">
                  دستیار قرآنی: {activeAgent.name}
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/20 font-medium">
                  {activeAgent.badge}
                </span>
              </div>
              <p className="text-[11px] opacity-75 leading-none mt-0.5">
                {activeAgent.description.slice(0, 48)}...
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowAgentList(!showAgentList)}
              className="px-2 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition-colors flex items-center gap-1"
              title="تغییر ایجنت هوش مصنوعی"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>تغییر ایجنت</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-white/10 transition-colors"
              title="بستن"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* نوار انتخاب رویکرد تخصصی */}
        <div className={`border-b px-3 py-2 ${
          darkMode ? 'bg-slate-950/80 border-slate-800' : 'bg-stone-50 border-stone-200'
        }`}>
          <div className="flex items-center justify-between mb-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
            <span>انتخاب رویکرد تدبّر:</span>
            <span className="text-[10px] text-teal-600 dark:text-teal-400 font-normal">
              تحلیل و تأمل متناسب با زاویه دید انتخابی
            </span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {AI_AGENTS.map((agent) => {
              const isSelected = agent.id === selectedAgentId;
              const Icon = agent.icon;
              return (
                <button
                  key={agent.id}
                  onClick={() => {
                    setSelectedAgentId(agent.id);
                    setShowAgentList(false);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all border ${
                    isSelected
                      ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                      : darkMode
                      ? 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700'
                      : 'bg-white hover:bg-stone-100 text-slate-700 border-stone-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{agent.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* وضعیت کلی سرویس */}
        <div className={`border-b px-3 py-2 flex items-center justify-end ${
          darkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-stone-50/80 border-stone-200'
        }`}>
          <div className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg ${
            isServerAiEnabled === true
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : isServerAiEnabled === false
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              : 'bg-slate-500/10 text-slate-500'
          }`}>
            <Server className="w-3 h-3" />
            <span>
              {isServerAiEnabled === true ? 'سرویس هوش مصنوعی فعال' : isServerAiEnabled === false ? 'دستیار در دسترس نیست' : 'بررسی وضعیت...'}
            </span>
          </div>
        </div>

        <div className={`px-3 py-2 text-[10px] leading-relaxed border-b ${
          darkMode ? 'bg-amber-950/20 border-amber-900/50 text-amber-200' : 'bg-amber-50 border-amber-100 text-amber-900'
        }`}>
          پاسخ‌ها با هوش مصنوعی تولید می‌شوند و ممکن است خطا داشته باشند؛ این دستیار مرجع فتوا یا تفسیر رسمی نیست.
        </div>

        {currentVerse && (
          <div className={`px-4 py-2 text-xs border-b flex items-center justify-between ${
            darkMode ? 'bg-slate-800/60 border-slate-800 text-amber-300' : 'bg-amber-50 border-amber-100 text-teal-900'
          }`}>
            <span className="font-bold">آیه {currentVerse.verseNumber} سوره {currentSurah?.nameArabic}:</span>
            <span className="truncate max-w-55 opacity-75 font-['Amiri_Quran']">{currentVerse.textArabic}</span>
          </div>
        )}

        {/* لیست پیام‌ها */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, idx) => {
            const msgAgent = AI_AGENTS.find((a) => a.id === m.agentId) || activeAgent;
            const MsgIcon = msgAgent.icon;
            return (
              <div
                key={idx}
                className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.role === 'assistant' && (
                  <div
                    className={`w-7 h-7 rounded-lg bg-linear-to-br ${msgAgent.color} text-white flex items-center justify-center shrink-0 mt-1 shadow-sm`}
                    title={msgAgent.name}
                  >
                    <MsgIcon className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`p-3.5 rounded-2xl max-w-[85%] text-xs sm:text-sm leading-relaxed whitespace-pre-line ${
                    m.role === 'user'
                      ? 'bg-teal-600 text-white rounded-br-none'
                      : darkMode
                      ? 'bg-slate-800 text-slate-200 border border-slate-700/80 rounded-bl-none'
                      : 'bg-stone-100 text-slate-800 rounded-bl-none border border-stone-200/70'
                  }`}
                >
                  {m.role === 'assistant' && (
                    <div className="text-[10px] font-bold text-teal-600 dark:text-teal-400 mb-1 flex items-center gap-1">
                      <span>{msgAgent.name}</span>
                      <span className="opacity-60 font-normal">({msgAgent.badge})</span>
                    </div>
                  )}
                  {m.content}
                  {m.response && (
                    <div className="mt-3 space-y-2">
                      <div className="text-[10px] font-bold text-slate-500">ارجاع‌های معتبر از متن محلی قرآن</div>
                      {m.response.verses.map((answer) => {
                        const candidate = candidates.find((item) => item.ref === answer.ref);
                        if (!candidate) return null;
                        return (
                          <button
                            key={answer.ref}
                            type="button"
                            onClick={() => onOpenVerse?.(candidate.verse)}
                            className="w-full text-right rounded-xl border border-teal-500/30 bg-teal-500/5 p-2.5 hover:bg-teal-500/10"
                          >
                            <div className="flex items-center justify-between text-[11px] font-bold text-teal-700 dark:text-teal-300">
                              <span>{answer.ref}</span>
                              <span>متن آیه از حافظهٔ محلی</span>
                            </div>
                            <p className="mt-1 font-['Amiri_Quran'] leading-7 text-slate-700 dark:text-slate-200">{candidate.verse.textArabic}</p>
                            <p className="mt-1 text-[11px]">{answer.why_relevant}</p>
                            <p className="mt-1 text-[11px] text-slate-500">نکته: {answer.practical_note}</p>
                          </button>
                        );
                      })}
                      <div className="text-[10px] text-amber-600">سطح اطمینان: {m.response.confidence} · تولیدشده با هوش مصنوعی</div>
                    </div>
                  )}
                  {m.localCandidates && m.localCandidates.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <div className="text-[10px] font-bold text-slate-500">نتایج جستجوی محلی (بدون توضیح AI)</div>
                      {m.localCandidates.map((candidate) => (
                        <button
                          key={candidate.ref}
                          type="button"
                          onClick={() => onOpenVerse?.(candidate.verse)}
                          className="w-full text-right rounded-xl border border-slate-400/30 bg-slate-500/5 p-2.5 hover:bg-slate-500/10"
                        >
                          <div className="text-[11px] font-bold text-teal-700 dark:text-teal-300">{candidate.ref}</div>
                          <p className="mt-1 font-['Amiri_Quran'] leading-7 text-slate-700 dark:text-slate-200">{candidate.verse.textArabic}</p>
                          <p className="mt-1 text-[11px] text-slate-500">{candidate.text_fa}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
              <RefreshCw className="w-4 h-4 animate-spin text-teal-600" />
              <span>{activeAgent.name} در حال نگارش تدبّر و تحلیل معارف قرآنی...</span>
            </div>
          )}
        </div>

        {/* پیشنهاد موضوعات سریع */}
        {!currentVerse && messages.length <= 2 && (
          <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800">
            <div className="text-[11px] font-bold text-slate-400 mb-1.5 flex items-center gap-1">
              <Heart className="w-3 h-3 text-red-500" />
              <span>موضوعات پیشنهادی برای هدایت و آرامش:</span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {QUICK_TOPICS.map((topic, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(topic)}
                  className="text-xs px-2.5 py-1 rounded-lg whitespace-nowrap bg-teal-500/10 hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 font-medium transition-colors"
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* کادر ورود متن پرسش */}
        <div
          className={`p-3 border-t flex items-center gap-2 ${
            darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSendMessage();
            }}
            placeholder={`از ${activeAgent.name} بپرسید (مثلاً: پیام اخلاقی، ریشه لغوی یا آرامش دل)...`}
            className={`flex-1 px-3.5 py-2 text-xs sm:text-sm rounded-xl outline-none border transition-all ${
              darkMode
                ? 'bg-slate-800 border-slate-700 focus:border-teal-500 text-white placeholder-slate-400'
                : 'bg-white border-slate-200 focus:border-teal-600 text-slate-900 placeholder-slate-400'
            }`}
          />

          <button
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim() || isLoading}
            className="p-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white transition-all active:scale-95"
            title="ارسال"
          >
            <Send className="w-4 h-4 rotate-180" />
          </button>
        </div>
      </div>
    </div>
  );
};
