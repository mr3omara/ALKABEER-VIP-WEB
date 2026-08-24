import React, { useState, useEffect } from 'react';
import { Search, X, Filter } from 'lucide-react';
import { useDebounce } from '../../hooks/use-debounce';

export interface ContextualSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  totalCount?: number;
  filteredCount?: number;
  debounceMs?: number;
  filterSlots?: React.ReactNode;
  autoFocus?: boolean;
}

export const ContextualSearchBar: React.FC<ContextualSearchBarProps> = ({
  value,
  onChange,
  placeholder = 'بحث فوري في البيانات (اسم، رقم هاتف، كود، أو ملاحظات)...',
  totalCount,
  filteredCount,
  debounceMs = 250,
  filterSlots,
  autoFocus = false,
}) => {
  const [internalValue, setInternalValue] = useState(value);
  const debouncedValue = useDebounce(internalValue, debounceMs);
  const onChangeRef = React.useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onChangeRef.current(debouncedValue);
  }, [debouncedValue]);

  // Sync if parent clears value externally
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  const handleClear = () => {
    setInternalValue('');
    onChange('');
  };

  return (
    <div className="bg-ivory-50 dark:bg-navy-850 p-4 rounded-2xl border border-ivory-300 dark:border-navy-750 shadow-warm-xs flex flex-col md:flex-row items-center justify-between gap-4 transition-colors font-sans" dir="rtl">
      {/* Search Input Container */}
      <div className="relative flex-1 w-full flex items-center">
        <Search className="w-4.5 h-4.5 text-slate-500 dark:text-slate-400 absolute right-3.5 pointer-events-none" />
        <input
          type="text"
          value={internalValue}
          onChange={(e) => setInternalValue(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full pl-10 pr-11 py-2.5 bg-white dark:bg-navy-950 border border-ivory-300 dark:border-navy-750 rounded-xl text-sm text-navy-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-gold-500/30 focus:border-gold-500 transition-all font-medium"
        />
        {internalValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute left-3 p-1 text-slate-400 hover:text-navy-900 dark:hover:text-white rounded-lg transition-colors"
            title="مسح النص"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter Slots & Result Count Badge */}
      <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
        {filterSlots && (
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gold-600 dark:text-gold-400 hidden sm:block" />
            {filterSlots}
          </div>
        )}

        {/* Visual Count Badge */}
        {typeof filteredCount === 'number' && (
          <div className="px-3 py-1.5 bg-ivory-200/80 dark:bg-navy-950 border border-ivory-300 dark:border-navy-750 rounded-xl text-xs font-bold text-navy-900 dark:text-slate-200 whitespace-nowrap">
            عرض <span className="font-extrabold text-gold-700 dark:text-gold-400">{filteredCount}</span>
            {typeof totalCount === 'number' && (
              <>
                {' '}من أصل <span className="font-extrabold">{totalCount}</span> نتيجة
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
