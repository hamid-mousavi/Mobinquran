import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Volume2, Search, User } from 'lucide-react';
import { ReciterId, RECITER_NAMES } from '../services/audioSources';

interface ReciterSelectorDropdownProps {
  selectedId: ReciterId;
  onSelect: (id: ReciterId) => void;
  darkMode: boolean;
  className?: string;
  label?: string;
}

export const ReciterSelectorDropdown: React.FC<ReciterSelectorDropdownProps> = ({
  selectedId,
  onSelect,
  darkMode,
  className = '',
  label = 'قاری ترتیل:',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const recitersList = (Object.keys(RECITER_NAMES) as ReciterId[]).map((id) => ({
    id,
    name: RECITER_NAMES[id].name,
  }));

  const filteredReciters = recitersList.filter((r) =>
    r.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  const currentReciter = RECITER_NAMES[selectedId] || RECITER_NAMES['parhizgar'];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className={`relative ${className}`} ref={dropdownRef} dir="rtl">
      {label && (
        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5 flex items-center gap-1.5">
          <Volume2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          <span>{label}</span>
        </label>
      )}

      {/* دکمه کشویی انتخاب قاری */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full p-3 rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-teal-500 transition-all flex items-center justify-between gap-3 text-right shadow-2xs active:scale-[0.99] cursor-pointer"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
            <User className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 block truncate">
              {currentReciter.name}
            </span>
            <span className="text-[10px] text-slate-400 block truncate">
              روایت حفص از عاصم • ترتیل آموزشی
            </span>
          </div>
        </div>

        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-teal-600' : ''
          }`}
        />
      </button>

      {/* منوی کشویی قاریان با جستجو و استایل شیک */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 rounded-2xl border border-stone-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xl p-2 space-y-2 animate-fadeIn max-h-72 flex flex-col">
          {/* کادر جستجوی سریع قاری */}
          <div className="relative shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجوی نام قاری…"
              className="w-full pr-8 pl-3 py-1.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500"
              autoFocus
            />
          </div>

          {/* لیست قاریان */}
          <div className="overflow-y-auto space-y-1 flex-1 pr-0.5">
            {filteredReciters.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-400">
                قاری با این نام یافت نشد.
              </div>
            ) : (
              filteredReciters.map((r) => {
                const isSelected = r.id === selectedId;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      onSelect(r.id);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={`w-full p-2.5 rounded-xl flex items-center justify-between text-xs font-bold transition-all text-right cursor-pointer ${
                      isSelected
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'hover:bg-stone-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="truncate">{r.name}</span>
                    {isSelected && <Check className="w-4 h-4 shrink-0 mr-1" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
