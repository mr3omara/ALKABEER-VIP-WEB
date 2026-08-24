import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'gold' | 'secondary' | 'danger' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-bold rounded-xl transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.99] font-sans';

    const variants = {
      // Primary: Deep Navy / Slate with gold focus ring
      primary:
        'bg-navy-900 dark:bg-navy-800 text-white hover:bg-navy-850 dark:hover:bg-navy-750 border border-navy-750 dark:border-navy-700 focus-visible:ring-gold-500 shadow-2xs active:bg-navy-950',
      // Gold: Luxury Gold Accent for key primary actions (Sales, Create, Commit)
      gold:
        'bg-gradient-to-b from-gold-500 to-gold-600 text-white hover:from-gold-600 hover:to-gold-700 border border-gold-400/40 focus-visible:ring-gold-400 shadow-gold-sm',
      // Secondary: High contrast surface
      secondary:
        'bg-ivory-200 dark:bg-navy-800 text-navy-900 dark:text-slate-100 hover:bg-ivory-300 dark:hover:bg-navy-750 border border-ivory-300 dark:border-navy-700 focus-visible:ring-gold-500',
      // Danger: Serious financial destructive action
      danger:
        'bg-rose-600 text-white hover:bg-rose-700 border border-rose-500 focus-visible:ring-rose-500 shadow-2xs',
      // Outline: High-contrast border
      outline:
        'border border-ivory-300 dark:border-navy-750 bg-ivory-50 dark:bg-navy-850 text-navy-900 dark:text-slate-200 hover:bg-ivory-200 dark:hover:bg-navy-800 hover:text-navy-950 dark:hover:text-white focus-visible:ring-gold-500 shadow-2xs',
      // Ghost: Subtle hover surface
      ghost:
        'text-navy-900 dark:text-slate-200 hover:bg-ivory-200 dark:hover:bg-navy-800 hover:text-navy-950 dark:hover:text-white focus-visible:ring-gold-500',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-xs gap-1.5 h-8',
      md: 'px-4 py-2 text-sm gap-2 h-10',
      lg: 'px-5 py-2.5 text-base gap-2.5 h-12',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current shrink-0" />
        ) : (
          leftIcon
        )}
        <span>{children}</span>
        {!isLoading && rightIcon}
      </button>
    );
  },
);

Button.displayName = 'Button';
