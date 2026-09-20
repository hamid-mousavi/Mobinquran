import React, { useState } from 'react';
import { X, Sparkles, Send, BookOpen, Heart, RefreshCw, Languages, ShieldCheck, Database, Bot } from 'lucide-react';
import { Verse, Surah } from '../types';

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVerse?: Verse | null;
  currentSurah?: Surah | null;
  darkMode: boolean;
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

  if (!isOpen) return null;

  const activeAgent = AI_AGENTS.find((a) => a.id === selectedAgentId) || AI_AGENTS[0];
  const ActiveAgentIcon = activeAgent.icon;

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
      };

      const response = await fetch('/api/ai/tadabbur', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('خطا در ارتباط با سرور');
      }

      const data = await response.json();
      setMessages([...newMessages, { role: 'assistant', content: data.reply, agentId: selectedAgentId }]);
    } catch (err: any) {
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          agentId: selectedAgentId,
          content: 'متأسفانه در ارتباط اینترنتی مشکلی رخ داد. می‌توانید از ایجنت «دانا (دانشنامه آفلاین)» استفاده فرمایید که بدون نیاز به اینترنت پاسخ می‌دهد.',
        },
      ]);
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
