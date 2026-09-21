import React, { useState, useEffect } from 'react';
import { X, Sparkles, Send, BookOpen, Heart, RefreshCw, Languages, ShieldCheck, Database, Bot, KeyRound, Eye, EyeOff, Save, Trash2, CheckCircle2, Server, WifiOff } from 'lucide-react';
import { Verse, Surah, AISettings, AIProvider } from '../types';
import { OPENROUTER_MODELS } from '../services/aiSettings';

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVerse?: Verse | null;
  currentSurah?: Surah | null;
  darkMode: boolean;
  aiSettings: AISettings;
  onUpdateAISettings: (settings: AISettings) => void;
}

export type AIAgentId = 'nemoneh' | 'allameh' | 'adib' | 'kalam' | 'offline_knowledge';

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
    id: 'nemoneh',
    name: 'ایجنت نمونه',
    badge: 'تفسیر نمونه و اخلاق',
    description: 'کاربرد آیات در زندگی امروز، آرامش دل، امیدبخشی و تربیت اخلاقی',
    icon: Heart,
    color: 'from-emerald-500 to-teal-600',
  },
  {
    id: 'allameh',
    name: 'ایجنت علامه',
    badge: 'تفسیر المیزان',
    description: 'تفسیر قرآن به قرآن، بطون عمیق معنوی، توحید و حقایق باطنی',
    icon: BookOpen,
    color: 'from-amber-500 to-amber-600',
  },
  {
    id: 'adib',
    name: 'ایجنت ادیب',
    badge: 'صرف، نحو و بلاغت',
    description: 'ریشه‌شناسی واژه‌ها، اعجاز بیانی الفاظ وحی و ساختار نحوی',
    icon: Languages,
    color: 'from-blue-500 to-indigo-600',
  },
  {
    id: 'kalam',
    name: 'ایجنت پژوهش',
    badge: 'کلام و پاسخ به شبهات',
    description: 'پاسخ‌های عقلانی، متقن و منطقی به سوالات فکری و اعتقادی',
    icon: ShieldCheck,
    color: 'from-purple-500 to-indigo-700',
  },
  {
    id: 'offline_knowledge',
    name: 'ایجنت دانا (آفلاین)',
    badge: 'دانشنامه آفلاین',
    description: 'پاسخ بر اساس گنجینه تفاسیر آفلاین دستگاه بدون نیاز به اینترنت',
    icon: Database,
    color: 'from-stone-600 to-slate-700',
  },
];

interface Message {
  role: 'user' | 'assistant';
  content: string;
  agentId?: AIAgentId;
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
  aiSettings,
  onUpdateAISettings,
}) => {
  const [selectedAgentId, setSelectedAgentId] = useState<AIAgentId>('nemoneh');
  const [showAgentList, setShowAgentList] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      agentId: 'nemoneh',
      content: currentVerse
        ? `سلام و درود بر شما. آماده‌ام تا در پرتو کلام نورانی آیه ${currentVerse.verseNumber} سوره مبارکه ${currentSurah?.nameArabic || ''} با هم به تدبّر بنشینیم. چه پرسش یا نکته‌ای مد نظرتان است؟`
        : `سلام علیکم. من دستیار هوشمند تدبّر قرآنی هستم. می‌توانید ایجنت مورد نظر خود (علامه، نمونه، ادیب یا پژوهش) را از نوار بالا انتخاب فرمایید تا متناسب با نیاز شما پاسخ دهم.`,
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // تنظیمات سرویس هوش مصنوعی
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [showKeyChar, setShowKeyChar] = useState(false);
  const [serverStatus, setServerStatus] = useState<{ openrouter: boolean; deepseek: boolean; groq: boolean } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setApiKeyDraft('');
    fetch('/api/ai/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.providers) {
          setServerStatus({
            openrouter: !!data.providers.openrouter?.hasServerKey,
            deepseek: !!data.providers.deepseek?.hasServerKey,
            groq: !!data.providers.groq?.hasServerKey,
          });
        }
      })
      .catch(() => setServerStatus(null));
  }, [isOpen]);

  if (!isOpen) return null;

  const activeAgent = AI_AGENTS.find((a) => a.id === selectedAgentId) || AI_AGENTS[0];
  const ActiveAgentIcon = activeAgent.icon;

  const activeProvider = aiSettings.provider;
  const providerLabel = activeProvider === 'deepseek' ? 'DeepSeek' : activeProvider === 'groq' ? 'Groq' : 'OpenRouter';
  const currentKey = activeProvider === 'deepseek'
    ? aiSettings.deepseekKey
    : activeProvider === 'groq'
    ? aiSettings.groqKey
    : aiSettings.openrouterKey;
  const hasPersonalKey = typeof currentKey === 'string' && currentKey.trim().length > 0;
  const hasServerKey = serverStatus
    ? activeProvider === 'deepseek'
      ? serverStatus.deepseek
      : activeProvider === 'groq'
      ? serverStatus.groq
      : serverStatus.openrouter
    : false;

  const currentModel = aiSettings.model || 'deepseek/deepseek-chat-v3-0324';

  const setProvider = (provider: AIProvider) => {
    onUpdateAISettings({ ...aiSettings, provider });
  };

  const withProviderKey = (key: string): AISettings =>
    activeProvider === 'deepseek'
      ? { ...aiSettings, deepseekKey: key }
      : activeProvider === 'groq'
      ? { ...aiSettings, groqKey: key }
      : { ...aiSettings, openrouterKey: key };

  const saveApiKey = () => {
    const key = apiKeyDraft.trim();
    onUpdateAISettings(withProviderKey(key));
    setApiKeyDraft('');
    setShowKeyInput(false);
  };

  const clearApiKey = () => {
    onUpdateAISettings(withProviderKey(''));
    setApiKeyDraft('');
    setShowKeyInput(false);
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputText.trim();
    if (!textToSend || isLoading) return;

    const newMessages: Message[] = [...messages, { role: 'user', content: textToSend }];
    setMessages(newMessages);
    if (!customPrompt) setInputText('');
    setIsLoading(true);

    try {
      const payload = {
        surahName: currentSurah?.nameArabic || '',
        verseNumber: currentVerse?.verseNumber || 0,
        arabicText: currentVerse?.textArabic || '',
        translation: currentVerse?.translationMakarem || '',
        userQuestion: textToSend,
        mode: currentVerse ? 'verse_reflection' : 'topic_guidance',
        agentId: selectedAgentId,
        provider: aiSettings.provider,
        model: currentModel,
        apiKey: currentKey,
      };

      let replyText = '';
      try {
        const response = await fetch('/api/ai/tadabbur', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        // A Vercel Function that fails before Express starts can return HTML/text,
        // so retain it for diagnosis instead of collapsing every failure to 500.
        const rawBody = await response.text();
        let body: { reply?: string; details?: string; error?: string } | null = null;
        try {
          body = rawBody ? JSON.parse(rawBody) : null;
        } catch {
          // Non-JSON Vercel error response.
        }

        if (!response.ok || !body) {
          const plainTextDetail = rawBody
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 300);
          const detail = body?.details || body?.error || plainTextDetail || `خطای غیرمنتظره سرور (${response.status})`;
          throw new Error(detail);
        }

        replyText = body.reply || 'پاسخی دریافت نشد.';
      } catch (err: any) {
        const rawDetail = err?.message || String(err);
        console.error('AI request failed:', err);
        setMessages([
          ...newMessages,
          {
            role: 'assistant',
            agentId: selectedAgentId,
            content: `اتصال به دستیار هوش مصنوعی ناموفق بود:\n«${rawDetail}»\n\nنکته: در صورت نامعتبر بودن کلید، رفع انقضا یا عدم موجودی حساب ${providerLabel}، می‌توانید از ایجنت «دانا (دانشنامه آفلاین)» بدون اینترنت استفاده فرمایید.`,
          },
        ]);
        return;
      }

      setMessages([...newMessages, { role: 'assistant', content: replyText, agentId: selectedAgentId }]);
    } finally {
      setIsLoading(false);
    }
  };

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
              : 'bg-gradient-to-r from-teal-800 to-emerald-900 text-white'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${activeAgent.color} text-white flex items-center justify-center shadow`}>
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

        {/* نوار انتخاب ایجنت تخصصی */}
        <div className={`border-b px-3 py-2 ${
          darkMode ? 'bg-slate-950/80 border-slate-800' : 'bg-stone-50 border-stone-200'
        }`}>
          <div className="flex items-center justify-between mb-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
            <span>انتخاب ایجنت تخصصی:</span>
            <span className="text-[10px] text-teal-600 dark:text-teal-400 font-normal">
              هر ایجنت پاسخ را با نگرش تخصصی خود تحلیل می‌کند
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

        {/* نوار تنظیمات سرویس هوش مصنوعی (انتخاب سرویس، مدل و کلید شخصی) */}
        <div className={`border-b px-3 py-2 space-y-2 ${
          darkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-stone-50/80 border-stone-200'
        }`}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>سرویس هوش مصنوعی</span>
            </div>
            <div className="flex items-center gap-1.5">
              {(['openrouter', 'deepseek', 'groq'] as AIProvider[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setProvider(p)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border ${
                    aiSettings.provider === p
                      ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                      : darkMode
                      ? 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700'
                      : 'bg-white hover:bg-stone-100 text-slate-700 border-stone-200'
                  }`}
                >
                  {p === 'deepseek' ? 'DeepSeek' : p === 'groq' ? 'Groq' : 'OpenRouter'}
                </button>
              ))}
              {aiSettings.provider === 'openrouter' && (
                <>
                  <label htmlFor="or-model-input" className="text-[10px] font-semibold text-slate-400 shrink-0">
                    مدل:
                  </label>
                  <input
                    id="or-model-input"
                    list="or-models-list"
                    value={currentModel}
                    onChange={(e) => onUpdateAISettings({ ...aiSettings, model: e.target.value })}
                    placeholder="deepseek/deepseek-chat-v3-0324"
                    className={`w-52 px-2.5 py-1 text-[11px] rounded-lg outline-none border transition-all ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700 focus:border-teal-500 text-white placeholder-slate-500'
                        : 'bg-white border-slate-200 focus:border-teal-600 text-slate-900 placeholder-slate-400'
                    }`}
                    title="تایپ یا انتخاب نام مدل OpenRouter (مثال: deepseek/deepseek-r1)"
                  />
                  <datalist id="or-models-list">
                    {OPENROUTER_MODELS.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowKeyInput((prev) => !prev);
                if (!showKeyInput) setApiKeyDraft('');
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all border ${
                hasPersonalKey
                  ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : darkMode
                  ? 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700'
                  : 'bg-white hover:bg-stone-100 text-slate-700 border-stone-200'
              }`}
              title={`وارد کردن کلید API شخصی ${providerLabel}`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{hasPersonalKey ? 'کلید شخصی فعال' : 'کلید API شخصی'}</span>
            </button>

            <div className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg ${
              hasPersonalKey
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : hasServerKey
                ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
            }`}>
              {hasPersonalKey ? (
                <>
                  <CheckCircle2 className="w-3 h-3" />
                  <span>در حال استفاده از کلید شخصی شما</span>
                </>
              ) : hasServerKey ? (
                <>
                  <Server className="w-3 h-3" />
                  <span>استفاده از کلید سرور برنامه</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3" />
                  <span>بدون کلید → پاسخ از دانشنامه آفلاین</span>
                </>
              )}
            </div>
          </div>

          {showKeyInput && (
            <div className={`p-2 rounded-xl border ${
              darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-stone-200'
            }`}>
              <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                <KeyRound className="w-3 h-3" />
                <span>کلید API {providerLabel} ({activeProvider === 'deepseek' ? 'از platform.deepseek.com' : activeProvider === 'groq' ? 'از console.groq.com' : 'از openrouter.ai/keys'})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <input
                    type={showKeyChar ? 'text' : 'password'}
                    value={apiKeyDraft}
                    onChange={(e) => setApiKeyDraft(e.target.value)}
                    placeholder={hasPersonalKey ? `در حال استفاده از کلید ذخیره‌شده (...${currentKey.slice(-4)})` : activeProvider === 'deepseek' ? 'sk-...' : 'gsk_...'}
                    className={`w-full px-3 py-1.5 text-xs rounded-lg outline-none border transition-all ${
                      darkMode
                        ? 'bg-slate-800 border-slate-700 focus:border-teal-500 text-white placeholder-slate-500'
                        : 'bg-slate-50 border-slate-200 focus:border-teal-600 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                  <button
                    onClick={() => setShowKeyChar((prev) => !prev)}
                    className="absolute inset-y-0 left-2 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    title={showKeyChar ? 'پنهان کردن' : 'نمایش'}
                  >
                    {showKeyChar ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <button
                  onClick={saveApiKey}
                  disabled={!apiKeyDraft.trim()}
                  className="px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white text-[11px] font-bold transition-all flex items-center gap-1"
                >
                  <Save className="w-3 h-3" />
                  <span>ذخیره</span>
                </button>
                {hasPersonalKey && (
                  <button
                    onClick={clearApiKey}
                    className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[11px] font-bold transition-all flex items-center gap-1 border border-red-500/30"
                    title="حذف کلید ذخیره‌شده"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span className="hidden sm:inline">حذف</span>
                  </button>
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                کلید شما فقط روی همین دستگاه (مرورگر) ذخیره می‌شود و برای پاسخ‌گویی به سرور ارسال می‌گردد.
                در صورت خالی بودن، از کلید سرور برنامه یا حالت آفلاین استفاده می‌شود.
              </p>
            </div>
          )}
        </div>

        {/* برچسب آیه انتخابی اگر وجود دارد */}
        {currentVerse && (
          <div
            className={`px-4 py-2 text-xs border-b flex items-center justify-between ${
              darkMode
                ? 'bg-slate-800/60 border-slate-800 text-amber-300'
                : 'bg-amber-50 border-amber-100 text-teal-900'
            }`}
          >
            <span className="font-bold">
              تدبّر آیه {currentVerse.verseNumber} سوره {currentSurah?.nameArabic}:
            </span>
            <span className="truncate max-w-[220px] opacity-75 font-['Amiri_Quran']">
              {currentVerse.textArabic}
            </span>
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
                    className={`w-7 h-7 rounded-lg bg-gradient-to-br ${msgAgent.color} text-white flex items-center justify-center shrink-0 mt-1 shadow-sm`}
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
