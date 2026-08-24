import React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      id,
      ...props
    },
    ref,
  ) => {
    const inputId = id || (label ? `input-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);

    return (
      <div className="w-full space-y-1.5 text-right font-sans">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-bold text-navy-900 dark:text-slate-200 tracking-tight"
          >
            {label}
            {props.required && <span className="text-rose-500 mr-1">*</span>}
          </label>
        )}
        <div className="relative flex items-center">
          {rightIcon && (
            <div className="absolute right-3 text-slate-500 dark:text-slate-400 pointer-events-none">
              {rightIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              'w-full py-2.5 px-3.5 bg-white dark:bg-navy-950 border border-ivory-300 dark:border-navy-750 rounded-xl text-[15px] text-navy-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 transition-all shadow-2xs font-medium',
              'focus:outline-none focus:ring-2 focus:ring-gold-500/30 focus:border-gold-500 focus:bg-white dark:focus:bg-navy-950',
              'disabled:bg-ivory-200 dark:disabled:bg-navy-900 disabled:text-slate-500 dark:disabled:text-slate-400 disabled:border-ivory-300 dark:disabled:border-navy-800 disabled:cursor-not-allowed',
              error && 'border-rose-400 dark:border-rose-500 focus:ring-rose-500/20 focus:border-rose-500 bg-rose-50/20 dark:bg-rose-950/20',
              rightIcon ? 'pr-10' : 'pr-3.5',
              leftIcon ? 'pl-10' : 'pl-3.5',
              className,
            )}
            {...props}
          />
          {leftIcon && (
            <div className="absolute left-3 text-slate-500 dark:text-slate-400 pointer-events-none">
              {leftIcon}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-rose-700 dark:text-rose-400 font-extrabold tracking-tight">{error}</p>}
        {!error && helperText && (
          <p className="text-xs text-slate-600 dark:text-slate-400 font-bold">{helperText}</p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: Array<{ label: string; value: string | number }>;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, helperText, options, children, id, ...props }, ref) => {
    const selectId = id || (label ? `select-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);

    return (
      <div className="w-full space-y-1.5 text-right font-sans">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-xs font-bold text-navy-900 dark:text-slate-200 tracking-tight"
          >
            {label}
            {props.required && <span className="text-rose-500 mr-1">*</span>}
          </label>
        )}
        <select
          id={selectId}
          ref={ref}
          className={cn(
            'w-full py-2.5 px-3.5 bg-white dark:bg-navy-950 border border-ivory-300 dark:border-navy-750 rounded-xl text-[15px] text-navy-900 dark:text-slate-100 transition-all shadow-2xs cursor-pointer font-medium',
            'focus:outline-none focus:ring-2 focus:ring-gold-500/30 focus:border-gold-500 focus:bg-white dark:focus:bg-navy-950',
            'disabled:bg-ivory-200 dark:disabled:bg-navy-900 disabled:text-slate-500 dark:disabled:text-slate-400 disabled:border-ivory-300 dark:disabled:border-navy-800 disabled:cursor-not-allowed',
            error && 'border-rose-400 dark:border-rose-500 focus:ring-rose-500/20 focus:border-rose-500 bg-rose-50/20 dark:bg-rose-950/20',
            className,
          )}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-white dark:bg-navy-900 text-navy-900 dark:text-slate-100">
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        {error && <p className="text-xs text-rose-700 dark:text-rose-400 font-extrabold tracking-tight">{error}</p>}
        {!error && helperText && (
          <p className="text-xs text-slate-600 dark:text-slate-400 font-bold">{helperText}</p>
        )}
      </div>
    );
  },
);

Select.displayName = 'Select';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const textareaId = id || (label ? `textarea-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);

    return (
      <div className="w-full space-y-1.5 text-right font-sans">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-xs font-bold text-navy-900 dark:text-slate-200 tracking-tight"
          >
            {label}
            {props.required && <span className="text-rose-500 mr-1">*</span>}
          </label>
        )}
        <textarea
          id={textareaId}
          ref={ref}
          rows={props.rows || 3}
          className={cn(
            'w-full py-2.5 px-3.5 bg-white dark:bg-navy-950 border border-ivory-300 dark:border-navy-750 rounded-xl text-[15px] text-navy-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 transition-all shadow-2xs font-medium',
            'focus:outline-none focus:ring-2 focus:ring-gold-500/30 focus:border-gold-500 focus:bg-white dark:focus:bg-navy-950',
            'disabled:bg-ivory-200 dark:disabled:bg-navy-900 disabled:text-slate-500 dark:disabled:text-slate-400 disabled:border-ivory-300 dark:disabled:border-navy-800 disabled:cursor-not-allowed',
            error && 'border-rose-400 dark:border-rose-500 focus:ring-rose-500/20 focus:border-rose-500 bg-rose-50/20 dark:bg-rose-950/20',
            className,
          )}
          {...props}
        />
        {error && <p className="text-xs text-rose-700 dark:text-rose-400 font-extrabold tracking-tight">{error}</p>}
        {!error && helperText && (
          <p className="text-xs text-slate-600 dark:text-slate-400 font-bold">{helperText}</p>
        )}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';
