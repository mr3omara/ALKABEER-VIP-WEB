import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  size = 'md',
  children,
  footer,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-5xl',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-xs animate-in fade-in duration-150 font-sans"
      dir="rtl"
    >
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative w-full bg-ivory-50 dark:bg-navy-850 text-navy-900 dark:text-slate-100 rounded-2xl shadow-navy-lg border border-ivory-300 dark:border-navy-750 overflow-hidden z-10 flex flex-col max-h-[90vh] transition-colors',
          sizeClasses[size],
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-ivory-300 dark:border-navy-750 bg-ivory-200/70 dark:bg-navy-950/70">
          <div>
            <h3 className="text-base font-kufi font-extrabold text-navy-900 dark:text-slate-100 tracking-tight">{title}</h3>
            {description && (
              <p className="text-xs text-slate-700 dark:text-slate-300 font-bold mt-0.5">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="إغلاق النافذة"
            className="p-1.5 text-slate-600 hover:text-navy-900 dark:text-slate-400 dark:hover:text-white hover:bg-ivory-200 dark:hover:bg-navy-800 rounded-xl transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 custom-scrollbar text-[15px]">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-3.5 bg-ivory-200/70 dark:bg-navy-950/70 border-t border-ivory-300 dark:border-navy-750 flex items-center justify-end gap-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
