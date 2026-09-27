import React, { useState } from 'react';
import {
  X,
  Info,
  Mail,
  Share2,
  Star,
  ShieldCheck,
  Check,
  Copy,
  ExternalLink,
  Heart,
  Sparkles,
  BookOpen,
  MessageSquare,
  Send,
  HelpCircle,
} from 'lucide-react';
import { QuranLogo } from './QuranicOrnament';
import { toPersianDigits } from '../utils/textNormalization';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
}

export const AboutModal: React.FC<AboutModalProps> = ({
  isOpen,
  onClose,
  darkMode,
}) => {
  const [activeTab, setActiveTab] = useState<'about' | 'contact' | 'privacy' | 'sources'>('about');
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'suggestion' | 'bug' | 'appreciation'>('suggestion');
  const [feedbackText, setFeedbackText] = useState('');
  const [senderContact, setSenderContact] = useState('');

  const appVersion = '1.0.0';
  const packageName = 'app.vercel.mobinquran.twa';
  const supportEmail = 'hamid63.ms@gmail.com';
  const myketAppUrl = `https://myket.ir/app/${packageName}`;
  const myketCommentIntent = `myket://comment?id=${packageName}`;

  if (!isOpen) return null;

  const handleCopyEmail = () => {
    navigator.clipboard?.writeText(supportEmail);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  const handleShareApp = async () => {
    const shareData = {
      title: 'قرآن مبین | قرائت، ترجمه و تدبّر',
      text: 'اپلیکیشن جامع و آفلاین قرآن مبین با رسم‌الخط عثمان طه، ۳ ترجمه فارسی، ترتیل صوتی و دستیار تدبّر قرآنی. دریافت رایگان از مایکت:',
      url: myketAppUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // کاربر انصراف داد
      }
    } else {
      navigator.clipboard?.writeText(`${shareData.text}\n${shareData.url}`);
      alert('پیوند برنامه در حافظه کپی شد.');
    }
  };

  const handleOpenMyketRating = () => {
    // تلاش برای باز کردن مایکت در اپلیکیشن اندروید یا مرورگر
    window.location.href = myketCommentIntent;
    setTimeout(() => {
      window.open(myketAppUrl, '_blank');
    }, 500);
  };

  const handleSubmitFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim()) return;

    // ذخیره محلی یا ارسال از طریق mailto
    const subject = encodeURIComponent(`[بازخورد قرآن مبین] ${feedbackType === 'bug' ? 'گزارش اشکال' : feedbackType === 'suggestion' ? 'پیشنهاد' : 'قدردانی'}`);
    const body = encodeURIComponent(`نوع پیام: ${feedbackType}\nارسال‌کننده: ${senderContact || 'ناشناس'}\nنسخه برنامه: ${appVersion}\n\nمتن پیام:\n${feedbackText}`);
    
    // باز کردن کلاینت ایمیل کاربر
    window.location.href = `mailto:${supportEmail}?subject=${subject}&body=${body}`;
    setFeedbackSent(true);
    setFeedbackText('');
  };

  return (
    <div
      id="modal-about-backdrop"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn select-none font-['Vazirmatn']"
      onClick={onClose}
      dir="rtl"
    >
      <div
        id="modal-about-content"
        className={`w-full max-w-xl rounded-t-3xl sm:rounded-3xl border border-stone-200 dark:border-slate-800 shadow-2xl transition-all flex flex-col ${
          darkMode ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-800'
        }`}
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '90vh' }}
      >
        {/* دستگیره کشویی در موبایل */}
        <div className="w-12 h-1 bg-stone-300 dark:bg-slate-700 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />

        {/* سربرگ معرفی اپلیکیشن */}
        <div className={`p-4 sm:p-5 border-b flex items-center justify-between shrink-0 ${
          darkMode ? 'border-slate-800 bg-slate-900/90' : 'border-stone-100 bg-stone-50/80'
        }`}>
          <div className="flex items-center gap-3">
            <QuranLogo size="md" darkMode={darkMode} />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-slate-100">
                  قرآن مبین
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold border border-teal-500/20">
                  نسخه {toPersianDigits(appVersion)}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                قرائت، ۳ ترجمه فارسی، ترتیل صوتی و تدبّر هوشمند
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-stone-200/60 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            aria-label="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* دکمه‌های ناوبری تب‌ها */}
        <div className="flex items-center px-4 pt-3 border-b border-stone-200/80 dark:border-slate-800 gap-1.5 shrink-0 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('about')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-bold border-b-2 transition-all shrink-0 ${
              activeTab === 'about'
                ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Info className="w-4 h-4" />
            <span>درباره برنامه</span>
          </button>

          <button
            onClick={() => setActiveTab('contact')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-bold border-b-2 transition-all shrink-0 ${
              activeTab === 'contact'
                ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>تماس و پشتیبانی</span>
          </button>

          <button
            onClick={() => setActiveTab('privacy')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-bold border-b-2 transition-all shrink-0 ${
              activeTab === 'privacy'
                ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>حریم خصوصی</span>
          </button>

          <button
            onClick={() => setActiveTab('sources')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-bold border-b-2 transition-all shrink-0 ${
              activeTab === 'sources'
                ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>منابع و اسناد</span>
          </button>
        </div>

        {/* محتوای تب‌ها */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs sm:text-sm leading-relaxed flex-1">
          {/* تب درباره برنامه */}
          {activeTab === 'about' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-3.5 rounded-2xl border border-teal-500/20 bg-teal-500/5 text-slate-700 dark:text-slate-300">
                <p className="font-medium">
                  <strong>قرآن مبین</strong> یک نرم‌افزار قرآنی جامع، سبک، سریع و کاملاً رایگان است که با هدف تسهیل ارتباط روزانه با کلام الهی، تدبّر در مفاهیم و نشر معارف قرآن کریم طراحی شده است.
                </p>
                <div className="mt-2.5 flex items-center gap-1.5 text-xs text-teal-700 dark:text-teal-300 font-bold">
                  <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                  <span>بدون هیچ‌گونه تبلیغات، وقف فرهنگی جهت خدمت به جامعه قرآنی</span>
                </div>
              </div>

              {/* امکانات کلیدی */}
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 mb-2.5 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>قابلیت‌های شاخص قرآن مبین:</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl border border-stone-100 dark:border-slate-800 bg-stone-50/70 dark:bg-slate-800/40">
                    <span className="font-bold text-teal-600 dark:text-teal-400 block mb-0.5">📖 رسم‌الخط عثمان طه</span>
                    متن دقیق مصحف مدینه منوره با اعراب‌گذاری کامل و قلم‌های چشم‌نواز
                  </div>

                  <div className="p-2.5 rounded-xl border border-stone-100 dark:border-slate-800 bg-stone-50/70 dark:bg-slate-800/40">
                    <span className="font-bold text-teal-600 dark:text-teal-400 block mb-0.5">🇮🇷 ۳ ترجمه معتبر فارسی</span>
                    ترجمه‌های روان استاد انصاریان، دکتر فولادوند و آیت‌الله مکارم شیرازی
                  </div>

                  <div className="p-2.5 rounded-xl border border-stone-100 dark:border-slate-800 bg-stone-50/70 dark:bg-slate-800/40">
                    <span className="font-bold text-teal-600 dark:text-teal-400 block mb-0.5">🎧 ترتیل صوتی قاریان</span>
                    تلاوت آیه‌به‌آیه با صدای اساتید پرهیزگار، منشاوی، عبدالباسط و حصری
                  </div>

                  <div className="p-2.5 rounded-xl border border-stone-100 dark:border-slate-800 bg-stone-50/70 dark:bg-slate-800/40">
                    <span className="font-bold text-teal-600 dark:text-teal-400 block mb-0.5">🤖 دستیار تدبّر قرآنی</span>
                    پاسخ به پرسش‌های مفهومی و ریشه‌یابی معارف با هوش مصنوعی
                  </div>

                  <div className="p-2.5 rounded-xl border border-stone-100 dark:border-slate-800 bg-stone-50/70 dark:bg-slate-800/40">
                    <span className="font-bold text-teal-600 dark:text-teal-400 block mb-0.5">🔍 جستجوی پیشرفته متنی</span>
                    کاوش بلادرنگ در واژگان قرآن، ریشه‌ها و معانی فارسی
                  </div>

                  <div className="p-2.5 rounded-xl border border-stone-100 dark:border-slate-800 bg-stone-50/70 dark:bg-slate-800/40">
                    <span className="font-bold text-teal-600 dark:text-teal-400 block mb-0.5">⚡ ۱۰۰٪ آفلاین و ماندگار</span>
                    کارکرد کامل بدون نیاز به اینترنت، با مدیریت دانلود صوت
                  </div>
                </div>
              </div>

              {/* اکشن‌های مارکت مایکت */}
              <div className="pt-2 border-t border-stone-200/80 dark:border-slate-800 space-y-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={handleOpenMyketRating}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs sm:text-sm shadow-md transition-all active:scale-[0.98]"
                  >
                    <Star className="w-4 h-4 fill-slate-950" />
                    <span>ثبت نظر و امتیاز در مایکت</span>
                  </button>

                  <button
                    onClick={handleShareApp}
                    className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 font-bold text-xs sm:text-sm transition-all active:scale-[0.98]"
                  >
                    <Share2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    <span>معرفی به دوستان</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* تب تماس با ما و پشتیبانی */}
          {activeTab === 'contact' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-3 rounded-2xl border border-stone-100 dark:border-slate-800 bg-stone-50 dark:bg-slate-800/40">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">پل ارتباطی مستقیم توسعه‌دهنده:</div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 font-mono" dir="ltr">
                    <Mail className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>{supportEmail}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={handleCopyEmail}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold hover:border-teal-500 transition-colors"
                      title="کپی آدرس ایمیل"
                    >
                      {copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                      <span>{copiedEmail ? 'کپی شد' : 'کپی'}</span>
                    </button>

                    <a
                      href={`mailto:${supportEmail}?subject=پشتیبانی اپلیکیشن قرآن مبین`}
                      className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1"
                    >
                      <span>ارسال</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>

              {/* فرم ارسال بازخورد مستقیم */}
              <form onSubmit={handleSubmitFeedback} className="space-y-3 pt-1">
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-slate-200">
                  <MessageSquare className="w-4 h-4 text-teal-600" />
                  <span>ارسال نظر، پیشنهاد یا گزارش اشکال:</span>
                </div>

                {/* انتخاب نوع پیام */}
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setFeedbackType('suggestion')}
                    className={`py-1.5 px-2 rounded-xl border text-center font-semibold transition-all ${
                      feedbackType === 'suggestion'
                        ? 'border-teal-500 bg-teal-500/10 text-teal-600 dark:text-teal-400'
                        : 'border-stone-200 dark:border-slate-800 text-slate-500'
                    }`}
                  >
                    💡 پیشنهاد قابلیت
                  </button>

                  <button
                    type="button"
                    onClick={() => setFeedbackType('bug')}
                    className={`py-1.5 px-2 rounded-xl border text-center font-semibold transition-all ${
                      feedbackType === 'bug'
                        ? 'border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        : 'border-stone-200 dark:border-slate-800 text-slate-500'
                    }`}
                  >
                    🐞 گزارش اشکال
                  </button>

                  <button
                    type="button"
                    onClick={() => setFeedbackType('appreciation')}
                    className={`py-1.5 px-2 rounded-xl border text-center font-semibold transition-all ${
                      feedbackType === 'appreciation'
                        ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        : 'border-stone-200 dark:border-slate-800 text-slate-500'
                    }`}
                  >
                    🌸 قدردانی و نظر
                  </button>
                </div>

                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="دیدگاه، پیشنهاد یا مشکلی که مشاهده کردید را بنویسید…"
                  rows={3}
                  required
                  className="w-full p-3 rounded-xl border border-stone-200 dark:border-slate-800 bg-stone-50/50 dark:bg-slate-800/50 focus:border-teal-500 focus:bg-white dark:focus:bg-slate-900 text-xs sm:text-sm outline-none transition-all resize-none"
                />

                <input
                  type="text"
                  value={senderContact}
                  onChange={(e) => setSenderContact(e.target.value)}
                  placeholder="ایمیل یا شماره شما جهت پاسخگویی (اختیاری)"
                  className="w-full p-2.5 rounded-xl border border-stone-200 dark:border-slate-800 bg-stone-50/50 dark:bg-slate-800/50 focus:border-teal-500 focus:bg-white dark:focus:bg-slate-900 text-xs outline-none transition-all"
                />

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-400">
                    {feedbackSent ? 'با تشکر! پنجره ایمیل باز شد.' : 'پیام شما مستقیماً برای توسعه‌دهنده ارسال می‌شود.'}
                  </span>

                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md transition-all active:scale-95"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>ارسال بازخورد</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* تب حریم خصوصی و امنیت (الزام مایکت) */}
          {activeTab === 'privacy' && (
            <div className="space-y-3.5 animate-fadeIn">
              <div className="p-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <span>حریم خصوصی شما برای ما مقدس است؛ قرآن مبین هیچ اطلاعات هویتی، مکانی یا شماره تلفنی از شما جمع‌آوری نمی‌کند.</span>
              </div>

              <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                <div className="p-2.5 rounded-xl border border-stone-100 dark:border-slate-800 bg-stone-50/60 dark:bg-slate-800/30">
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-1">۱. ذخیره‌سازی محلی داده‌ها:</h4>
                  تمام نشانه‌گذاری‌ها، پیشرفت ختم قرآن، تاریخچه جستجو و تنظیمات قلم صرفاً در حافظه اختصاصی مرورگر و دستگاه خودتان (IndexedDB / LocalStorage) نگهداری می‌شوند و به هیچ سرور خارجی منتقل نمی‌گردند.
                </div>

                <div className="p-2.5 rounded-xl border border-stone-100 dark:border-slate-800 bg-stone-50/60 dark:bg-slate-800/30">
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-1">۲. عدم وجود تبلیغات و ردیاب:</h4>
                  هیچ شبکه تبلیغاتی، تحلیل‌گر شخص‌ثالث یا کد رهگیری در برنامه گنجانده نشده است.
                </div>

                <div className="p-2.5 rounded-xl border border-stone-100 dark:border-slate-800 bg-stone-50/60 dark:bg-slate-800/30">
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-1">۳. گفتگوی تدبّر و هوش مصنوعی:</h4>
                  پرسش‌های مطرح‌شده در بخش تدبّر قرآنی بدون ذخیره هویت یا اطلاعات کاربری، تنها برای ساخت پاسخ تفسیری پردازش می‌گردند و محرمانگی آن محفوظ است.
                </div>
              </div>
            </div>
          )}

          {/* تب منابع و اسناد */}
          {activeTab === 'sources' && (
            <div className="space-y-3 animate-fadeIn text-xs text-slate-600 dark:text-slate-300">
              <p className="text-slate-500 dark:text-slate-400">
                قرآن مبین بر پایه معتبرترین پایگاه‌های داده باز قرآنی و مراجع علمی توسعه یافته است:
              </p>

              <div className="space-y-2">
                <div className="p-2.5 rounded-xl border border-stone-100 dark:border-slate-800 bg-stone-50/70 dark:bg-slate-800/40">
                  <div className="font-bold text-slate-900 dark:text-slate-100">پایگاه Tanzil Project</div>
                  متن مصحف عثمان طه، اعراب‌گذاری و ترجمه‌های استاد انصاریان و فولادوند
                </div>

                <div className="p-2.5 rounded-xl border border-stone-100 dark:border-slate-800 bg-stone-50/70 dark:bg-slate-800/40">
                  <div className="font-bold text-slate-900 dark:text-slate-100">مجمع ملک فهد لطباعة المصحف الشریف</div>
                  فونت استاندارد و رسم‌الخط معتبر مصحف مدینه منوره (QCF)
                </div>
                
                 <div className="p-2.5 rounded-xl border border-stone-100 dark:border-slate-800 bg-stone-50/70 dark:bg-slate-800/40">
                  <div className="font-bold text-slate-900 dark:text-slate-100">دانشنامه پایگاه جامع قرآنی نور </div>
                 
                </div>

                <div className="p-2.5 rounded-xl border border-stone-100 dark:border-slate-800 bg-stone-50/70 dark:bg-slate-800/40">
                  <div className="font-bold text-slate-900 dark:text-slate-100">پایگاه EveryAyah و Quran.com</div>
                  سرورهای توزیع صوت ترتیل قاریان برجسته جهان اسلام
                </div>

                <div className="p-2.5 rounded-xl border border-stone-100 dark:border-slate-800 bg-stone-50/70 dark:bg-slate-800/40">
                  <div className="font-bold text-slate-900 dark:text-slate-100">قلم‌های نرم‌افزاری</div>
                  فونت‌های وزیرمتن (صابر راستی‌کردار) و قلم قرآنی امیری تحت مجوز آزاد SIL OFL
                </div>
              </div>
            </div>
          )}
        </div>

        {/* پاورقی مودال */}
        <div className={`p-3.5 sm:p-4 border-t flex items-center justify-between shrink-0 text-xs ${
          darkMode ? 'border-slate-800 bg-slate-950/70' : 'border-stone-100 bg-stone-50/80'
        }`}>
          <div className="flex items-center gap-1.5 text-slate-400">
            <HelpCircle className="w-3.5 h-3.5 text-teal-600" />
            <span>پشتیبانی و توسعه: قرآن مبین</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm transition-all"
          >
            بستن پنجره
          </button>
        </div>
      </div>
    </div>
  );
};
