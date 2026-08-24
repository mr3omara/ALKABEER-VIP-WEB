import React from 'react';
import { cn } from '../../lib/utils';

export type BadgeVariant =
  | 'default'
  | 'gold'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'outline';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-ivory-200 dark:bg-[#0E203C] text-slate-900 dark:text-slate-100 border-ivory-300 dark:border-[#1E3A5F] font-bold',
  gold: 'bg-gold-50 dark:bg-gold-950/60 text-gold-900 dark:text-gold-300 border-gold-300 dark:border-gold-700/60 font-extrabold',
  success: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800/60 font-bold',
  warning: 'bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800/60 font-bold',
  danger: 'bg-rose-50 dark:bg-rose-950/60 text-rose-900 dark:text-rose-300 border-rose-300 dark:border-rose-800/60 font-bold',
  info: 'bg-purple-50 dark:bg-purple-950/60 text-purple-900 dark:text-purple-300 border-purple-300 dark:border-purple-800/60 font-bold',
  neutral: 'bg-ivory-200 dark:bg-[#0E203C] text-slate-900 dark:text-slate-200 border-ivory-300 dark:border-[#1E3A5F] font-bold',
  outline: 'bg-transparent text-slate-900 dark:text-slate-200 border-ivory-400 dark:border-navy-700 font-bold',
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  className,
  children,
  ...props
}) => {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs border tracking-tight transition-colors select-none font-sans',
        variantStyles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
};

export function getStatusBadgeVariant(status: string): BadgeVariant {
  switch (status?.toUpperCase()) {
    case 'ACTIVE':
    case 'IN_STOCK':
    case 'COMPLETED':
    case 'PAID':
    case 'CLOSED':
      return 'success';
    case 'VIP':
    case 'PREMIUM':
      return 'gold';
    case 'RESERVED':
    case 'PARTIALLY_PAID':
    case 'OPEN':
      return 'warning';
    case 'BLOCKED':
    case 'CANCELLED':
    case 'SUSPENDED':
      return 'danger';
    case 'SOLD':
    case 'DUE':
    case 'REOPENED':
      return 'info';
    case 'INACTIVE':
    case 'RETURNED':
    case 'WAIVED':
    default:
      return 'neutral';
  }
}

export interface CompanyBadgeProps {
  companyNameOrCode?: string;
  color?: string;
  className?: string;
  showDot?: boolean;
}

export const CompanyBadge: React.FC<CompanyBadgeProps> = ({
  companyNameOrCode = '',
  color,
  className,
  showDot = true,
}) => {
  const norm = companyNameOrCode.toLowerCase().trim();

  let badgeStyle = 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20';
  let dotColor = color || '#64748b';

  if (norm.includes('vodafone') || norm.includes('فودافون') || norm === 'vf') {
    badgeStyle = 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20';
    dotColor = '#ef4444';
  } else if (norm.includes('orange') || norm.includes('أورانج') || norm.includes('اورانج') || norm === 'or') {
    badgeStyle = 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20';
    dotColor = '#f97316';
  } else if (norm.includes('we') || norm.includes('وي') || norm.includes('المصرية للاتصالات') || norm === 'te') {
    badgeStyle = 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20';
    dotColor = '#a855f7';
  } else if (norm.includes('etisalat') || norm.includes('اتصالات') || norm === 'et' || norm === 'e&') {
    badgeStyle = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
    dotColor = '#10b981';
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold transition-colors select-none font-sans',
        badgeStyle,
        className,
      )}
    >
      {showDot && (
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: dotColor }}
        />
      )}
      <span>{companyNameOrCode}</span>
    </span>
  );
};
