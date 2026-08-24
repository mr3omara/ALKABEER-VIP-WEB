import React from 'react';

export type Icon3DName =
  | 'dashboard'
  | 'customers'
  | 'lines'
  | 'inventory'
  | 'packages'
  | 'sales'
  | 'payments'
  | 'treasury'
  | 'expenses'
  | 'company-liabilities'
  | 'daily-closing'
  | 'reports'
  | 'users'
  | 'companies'
  | 'settings'
  | 'audit'
  | 'backup'
  | 'crown'
  | 'wallet'
  | 'check'
  | 'alert'
  | 'plus'
  | 'trash'
  | 'edit'
  | 'search'
  | 'share'
  | 'download'
  | 'printer'
  | 'eye'
  | 'filter'
  | 'lock'
  | 'chart'
  | 'sim'
  | 'receipt';

export interface Icon3DProps extends React.SVGProps<SVGSVGElement> {
  name: Icon3DName;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | number;
  className?: string;
}

const sizeMap = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 40,
  '2xl': 48,
  '3xl': 64,
};

export const Icon3D: React.FC<Icon3DProps> = ({
  name,
  size = 'md',
  className = '',
  ...props
}) => {
  const pixelSize = typeof size === 'number' ? size : sizeMap[size] || 24;

  return (
    <svg
      width={pixelSize}
      height={pixelSize}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block select-none shrink-0 transition-transform duration-200 ${className}`}
      {...props}
    >
      <defs>
        {/* Universal Luxury Filters & Gradients */}
        <filter id="glow-gold" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#F59E0B" floodOpacity="0.35" />
        </filter>
        <filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#070F1E" floodOpacity="0.45" />
        </filter>
        <filter id="inner-shadow">
          <feComponentTransfer in="SourceAlpha">
            <feFuncA type="linear" slope="0.7"/>
          </feComponentTransfer>
        </filter>

        {/* 3D Gold Gradient Palette */}
        <linearGradient id="gold-primary" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF2A3" />
          <stop offset="35%" stopColor="#F59E0B" />
          <stop offset="70%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#92400E" />
        </linearGradient>

        <linearGradient id="gold-light" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FEF3C7" />
          <stop offset="100%" stopColor="#FBBF24" />
        </linearGradient>

        {/* 3D Royal Navy Palette */}
        <linearGradient id="navy-primary" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="50%" stopColor="#1E3A8A" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>

        <linearGradient id="navy-accent" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>

        {/* 3D Emerald Palette */}
        <linearGradient id="emerald-primary" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6EE7B7" />
          <stop offset="50%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#065F46" />
        </linearGradient>

        {/* 3D Rose/Ruby Palette */}
        <linearGradient id="rose-primary" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDA4AF" />
          <stop offset="50%" stopColor="#F43F5E" />
          <stop offset="100%" stopColor="#881337" />
        </linearGradient>

        {/* 3D Purple/Violet Palette */}
        <linearGradient id="purple-primary" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E9D5FF" />
          <stop offset="50%" stopColor="#A855F7" />
          <stop offset="100%" stopColor="#581C87" />
        </linearGradient>

        {/* Specular Highlight */}
        <linearGradient id="gloss-overlay" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.6" />
          <stop offset="40%" stopColor="#FFFFFF" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.0" />
        </linearGradient>
      </defs>

      {render3DIconPath(name)}
    </svg>
  );
};

function render3DIconPath(name: Icon3DName) {
  switch (name) {
    case 'dashboard':
    case 'chart':
      return (
        <g filter="url(#soft-shadow)">
          {/* Base Platform */}
          <ellipse cx="32" cy="52" rx="26" ry="7" fill="#0E203C" opacity="0.4" />
          <path d="M8 44L32 54L56 44L32 34L8 44Z" fill="url(#navy-primary)" />
          {/* Bar 1 (Left Emerald) */}
          <path d="M16 40V24L24 20V36L16 40Z" fill="url(#emerald-primary)" />
          <path d="M24 20L28 22V38L24 36V20Z" fill="#047857" />
          <path d="M16 24L20 22L28 22L24 20L16 24Z" fill="#A7F3D0" />
          {/* Bar 2 (Center Gold - Highest) */}
          <path d="M28 35V12L36 8V31L28 35Z" fill="url(#gold-primary)" filter="url(#glow-gold)" />
          <path d="M36 8L40 10V33L36 31V8Z" fill="#B45309" />
          <path d="M28 12L32 10L40 10L36 8L28 12Z" fill="#FEF08A" />
          {/* Bar 3 (Right Navy/Cyan) */}
          <path d="M40 33V20L48 16V29L40 33Z" fill="url(#navy-accent)" />
          <path d="M48 16L52 18V31L48 29V16Z" fill="#1E40AF" />
          <path d="M40 20L44 18L52 18L48 16L40 20Z" fill="#BAE6FD" />
          {/* Trending Line Sphere */}
          <circle cx="36" cy="8" r="3.5" fill="#FFFBEB" filter="url(#glow-gold)" />
        </g>
      );

    case 'customers':
    case 'users':
      return (
        <g filter="url(#soft-shadow)">
          {/* Base Pedestal */}
          <ellipse cx="32" cy="54" rx="24" ry="6" fill="#0E203C" opacity="0.3" />
          {/* User Torso 3D Spherical Volume */}
          <path
            d="M14 50C14 41 22 36 32 36C42 36 50 41 50 50C50 53 47 55 32 55C17 55 14 53 14 50Z"
            fill="url(#navy-primary)"
          />
          <path
            d="M20 48C21 43 26 39 32 39C38 39 43 43 44 48C40 50 36 51 32 51C28 51 24 50 20 48Z"
            fill="url(#navy-accent)"
            opacity="0.8"
          />
          {/* Golden VIP Neck Tie / Brooch */}
          <path d="M30 38L32 46L34 38L32 36L30 38Z" fill="url(#gold-primary)" />
          {/* 3D Sphere Head */}
          <circle cx="32" cy="22" r="13" fill="url(#gold-primary)" filter="url(#glow-gold)" />
          {/* Gloss Highlight on Head */}
          <ellipse cx="28" cy="17" rx="5" ry="3" fill="#FFFFFF" opacity="0.6" transform="rotate(-25 28 17)" />
          {/* Mini VIP Crown atop Head */}
          <path d="M26 11L28 14L32 9L36 14L38 11L36 16H28L26 11Z" fill="#FFFBEB" />
        </g>
      );

    case 'lines':
    case 'sim':
      return (
        <g filter="url(#soft-shadow)">
          {/* 3D Luxury SIM Card / Smartphone Base */}
          <ellipse cx="32" cy="55" rx="22" ry="5" fill="#0E203C" opacity="0.3" />
          {/* Phone Body with Rounded Bevels */}
          <rect x="18" y="8" width="28" height="46" rx="8" fill="url(#navy-primary)" stroke="#38BDF8" strokeWidth="1.5" />
          {/* Glass Screen */}
          <rect x="21" y="13" width="22" height="34" rx="4" fill="#0B1B36" />
          {/* Screen Holographic Waves */}
          <path d="M23 38C26 34 30 34 33 38C36 42 40 42 41 38" stroke="url(#gold-primary)" strokeWidth="2" strokeLinecap="round" />
          <path d="M25 32C28 28 32 28 35 32C37 34 39 34 40 32" stroke="#38BDF8" strokeWidth="1.5" strokeLinecap="round" />
          {/* 3D Gold Signal Antenna & Crown Top */}
          <circle cx="32" cy="22" r="5" fill="url(#gold-primary)" filter="url(#glow-gold)" />
          <circle cx="32" cy="22" r="2" fill="#FFFFFF" />
          {/* Home Button Indicator */}
          <circle cx="32" cy="50" r="1.5" fill="#94A3B8" />
        </g>
      );

    case 'inventory':
      return (
        <g filter="url(#soft-shadow)">
          {/* 3D Isometric Cube / Package Box */}
          <ellipse cx="32" cy="54" rx="24" ry="6" fill="#0E203C" opacity="0.4" />
          {/* Left Face */}
          <path d="M12 24L32 35V53L12 42V24Z" fill="url(#gold-primary)" />
          {/* Right Face */}
          <path d="M32 35L52 24V42L32 53V35Z" fill="#B45309" />
          {/* Top Face */}
          <path d="M12 24L32 13L52 24L32 35L12 24Z" fill="url(#gold-light)" />
          {/* 3D Cyan VIP Ribbon / Tape */}
          <path d="M32 13L22 18.5L42 29.5L52 24L32 13Z" fill="url(#navy-accent)" opacity="0.85" />
          <path d="M32 35V53L27 50V32L32 35Z" fill="#1D4ED8" />
          <path d="M32 35V53L37 50V32L32 35Z" fill="#1E40AF" />
          {/* Gloss Top */}
          <circle cx="32" cy="24" r="3" fill="#FFFFFF" opacity="0.8" />
        </g>
      );

    case 'packages':
      return (
        <g filter="url(#soft-shadow)">
          {/* 3 Floating Holographic Layers */}
          <ellipse cx="32" cy="56" rx="22" ry="5" fill="#0E203C" opacity="0.3" />
          {/* Layer 1 (Bottom Navy) */}
          <path d="M14 43L32 51L50 43L32 35L14 43Z" fill="url(#navy-primary)" />
          <path d="M14 43V47L32 55L50 47V43L32 51L14 43Z" fill="#0F172A" />
          {/* Layer 2 (Middle Emerald) */}
          <path d="M14 31L32 39L50 31L32 23L14 31Z" fill="url(#emerald-primary)" />
          <path d="M14 31V35L32 43L50 35V31L32 39L14 31Z" fill="#065F46" />
          {/* Layer 3 (Top Gold - VIP) */}
          <path d="M14 19L32 27L50 19L32 11L14 19Z" fill="url(#gold-primary)" filter="url(#glow-gold)" />
          <path d="M14 19V23L32 31L50 23V19L32 27L14 19Z" fill="#B45309" />
          {/* Top Floating Diamond Crystal */}
          <path d="M32 4L37 10L32 16L27 10L32 4Z" fill="#FEF08A" />
        </g>
      );

    case 'sales':
      return (
        <g filter="url(#soft-shadow)">
          {/* 3D Shopping Cart & Gold VIP Tag */}
          <ellipse cx="32" cy="56" rx="22" ry="5" fill="#0E203C" opacity="0.3" />
          {/* Cart Basket */}
          <path d="M16 16H22L28 38H46L51 21H23" stroke="url(#gold-primary)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M26 21H48L44 34H28L26 21Z" fill="url(#navy-primary)" opacity="0.7" />
          {/* Cart Wheels */}
          <circle cx="30" cy="46" r="4.5" fill="url(#gold-primary)" />
          <circle cx="30" cy="46" r="2" fill="#0E203C" />
          <circle cx="43" cy="46" r="4.5" fill="url(#gold-primary)" />
          <circle cx="43" cy="46" r="2" fill="#0E203C" />
          {/* Gold Sparkle / VIP Tag inside Cart */}
          <circle cx="36" cy="24" r="6" fill="url(#emerald-primary)" filter="url(#glow-gold)" />
          <path d="M36 21V27M33 24H39" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      );

    case 'payments':
    case 'wallet':
      return (
        <g filter="url(#soft-shadow)">
          {/* 3D Stack of Gold Coins & VIP Credit Card */}
          <ellipse cx="32" cy="55" rx="22" ry="5" fill="#0E203C" opacity="0.3" />
          {/* Credit Card Floating */}
          <rect x="12" y="14" width="38" height="24" rx="4" fill="url(#navy-primary)" stroke="#F59E0B" strokeWidth="1.5" transform="rotate(-10 31 26)" />
          <rect x="16" y="24" width="8" height="6" rx="1.5" fill="url(#gold-light)" transform="rotate(-10 20 27)" />
          <line x1="10" y1="20" x2="47" y2="13" stroke="#38BDF8" strokeWidth="2" />
          {/* 3D Gold Coins Stack in Front */}
          {/* Coin 1 */}
          <ellipse cx="38" cy="44" rx="13" ry="5" fill="#92400E" />
          <path d="M25 44V48C25 50.76 30.82 53 38 53C45.18 53 51 50.76 51 48V44Z" fill="#B45309" />
          <ellipse cx="38" cy="44" rx="13" ry="5" fill="url(#gold-primary)" />
          {/* Coin 2 Top */}
          <ellipse cx="38" cy="38" rx="13" ry="5" fill="#92400E" />
          <path d="M25 38V42C25 44.76 30.82 47 38 47C45.18 47 51 44.76 51 42V38Z" fill="#B45309" />
          <ellipse cx="38" cy="38" rx="13" ry="5" fill="url(#gold-light)" filter="url(#glow-gold)" />
          {/* EGP Currency Symbol / Stamp */}
          <circle cx="38" cy="38" r="4" fill="url(#gold-primary)" />
        </g>
      );

    case 'treasury':
      return (
        <g filter="url(#soft-shadow)">
          {/* 3D High-Security Bank Vault */}
          <ellipse cx="32" cy="56" rx="22" ry="5" fill="#0E203C" opacity="0.3" />
          {/* Vault Outer Chassis */}
          <rect x="12" y="10" width="40" height="42" rx="7" fill="url(#navy-primary)" stroke="#38BDF8" strokeWidth="1.5" />
          {/* Vault Door Bevel */}
          <circle cx="32" cy="31" r="15" fill="#0F172A" stroke="url(#gold-primary)" strokeWidth="2.5" />
          {/* Gold Rotary Dial Mechanism */}
          <circle cx="32" cy="31" r="8" fill="url(#gold-primary)" filter="url(#glow-gold)" />
          <circle cx="32" cy="31" r="3.5" fill="#0E203C" />
          {/* Wheel Spokes */}
          <line x1="32" y1="19" x2="32" y2="23" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="32" y1="39" x2="32" y2="43" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="20" y1="31" x2="24" y2="31" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="40" y1="31" x2="44" y2="31" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      );

    case 'expenses':
    case 'receipt':
      return (
        <g filter="url(#soft-shadow)">
          {/* 3D Paper Bill / Receipt with Tear Off Edges */}
          <ellipse cx="32" cy="56" rx="20" ry="5" fill="#0E203C" opacity="0.3" />
          <path
            d="M18 10C18 7.79 19.79 6 22 6H42C44.21 6 46 7.79 46 10V52L41.5 48.5L37 52L32 48.5L27 52L22.5 48.5L18 52V10Z"
            fill="#F8FAFC"
          />
          {/* Receipt Lines */}
          <rect x="23" y="14" width="18" height="3" rx="1.5" fill="#CBD5E1" />
          <rect x="23" y="21" width="14" height="2.5" rx="1.2" fill="#E2E8F0" />
          <rect x="23" y="27" width="16" height="2.5" rx="1.2" fill="#E2E8F0" />
          {/* Total Highlight Bar */}
          <rect x="23" y="34" width="18" height="4" rx="2" fill="url(#rose-primary)" />
          {/* Red/Gold Official Seal */}
          <circle cx="38" cy="42" r="5.5" fill="url(#gold-primary)" filter="url(#glow-gold)" />
          <path d="M36 42L37.5 43.5L40.5 40.5" stroke="#0E203C" strokeWidth="1.2" strokeLinecap="round" />
        </g>
      );

    case 'company-liabilities':
    case 'companies':
      return (
        <g filter="url(#soft-shadow)">
          {/* 3D Telecom Headquarters Towers */}
          <ellipse cx="32" cy="56" rx="24" ry="5" fill="#0E203C" opacity="0.3" />
          {/* Tower 1 (Left Cyan) */}
          <rect x="14" y="22" width="16" height="30" rx="3" fill="url(#navy-primary)" />
          <rect x="18" y="26" width="3" height="3" rx="0.5" fill="#38BDF8" />
          <rect x="23" y="26" width="3" height="3" rx="0.5" fill="#38BDF8" />
          <rect x="18" y="32" width="3" height="3" rx="0.5" fill="#38BDF8" />
          <rect x="23" y="32" width="3" height="3" rx="0.5" fill="#38BDF8" />
          <rect x="18" y="38" width="3" height="3" rx="0.5" fill="#38BDF8" />
          <rect x="23" y="38" width="3" height="3" rx="0.5" fill="#38BDF8" />
          {/* Tower 2 (Center Gold - Tallest HQ) */}
          <rect x="28" y="10" width="22" height="42" rx="4" fill="url(#navy-primary)" stroke="url(#gold-primary)" strokeWidth="1.5" />
          {/* HQ Roof Spire */}
          <line x1="39" y1="4" x2="39" y2="10" stroke="url(#gold-primary)" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="39" cy="4" r="2" fill="#FEF08A" filter="url(#glow-gold)" />
          {/* Windows Gold Grid */}
          <rect x="33" y="16" width="4" height="4" rx="0.8" fill="url(#gold-light)" />
          <rect x="41" y="16" width="4" height="4" rx="0.8" fill="url(#gold-light)" />
          <rect x="33" y="24" width="4" height="4" rx="0.8" fill="url(#gold-light)" />
          <rect x="41" y="24" width="4" height="4" rx="0.8" fill="url(#gold-light)" />
          <rect x="33" y="32" width="4" height="4" rx="0.8" fill="url(#gold-light)" />
          <rect x="41" y="32" width="4" height="4" rx="0.8" fill="url(#gold-light)" />
          {/* Front Entrance */}
          <rect x="36" y="44" width="6" height="8" rx="1" fill="url(#gold-primary)" />
        </g>
      );

    case 'daily-closing':
      return (
        <g filter="url(#soft-shadow)">
          {/* 3D Chronometer / Clock with Gold Trim */}
          <ellipse cx="32" cy="56" rx="20" ry="5" fill="#0E203C" opacity="0.3" />
          {/* Outer Bezel */}
          <circle cx="32" cy="30" r="22" fill="url(#navy-primary)" stroke="url(#gold-primary)" strokeWidth="3" filter="url(#glow-gold)" />
          {/* Clock Face */}
          <circle cx="32" cy="30" r="16.5" fill="#0B1B36" />
          {/* Hour Marks */}
          <circle cx="32" cy="17" r="1.2" fill="#FEF08A" />
          <circle cx="45" cy="30" r="1.2" fill="#FEF08A" />
          <circle cx="32" cy="43" r="1.2" fill="#FEF08A" />
          <circle cx="19" cy="30" r="1.2" fill="#FEF08A" />
          {/* Clock Hands */}
          <line x1="32" y1="30" x2="32" y2="20" stroke="url(#gold-light)" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="32" y1="30" x2="40" y2="30" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
          <circle cx="32" cy="30" r="2.5" fill="#FFFFFF" />
          {/* Top Stopwatch Push Button */}
          <rect x="29" y="4" width="6" height="4" rx="1.5" fill="url(#gold-primary)" />
        </g>
      );

    case 'reports':
      return (
        <g filter="url(#soft-shadow)">
          {/* 3D Pie Chart & Floating Graph */}
          <ellipse cx="32" cy="56" rx="22" ry="5" fill="#0E203C" opacity="0.3" />
          {/* 3D Pie Slice 1 (Gold Big) */}
          <path d="M32 30L32 12C41.94 12 50 20.06 50 30C50 39.94 41.94 48 32 48L32 30Z" fill="url(#gold-primary)" filter="url(#glow-gold)" />
          <path d="M32 30L32 48C22.06 48 14 39.94 14 30C14 20.06 22.06 12 32 12V30Z" fill="url(#navy-primary)" />
          {/* Exploded Emerald Sector */}
          <path d="M28 26L14 16C18 10 24 8 28 8V26Z" fill="url(#emerald-primary)" transform="translate(-2 -2)" />
          {/* Gloss Center Ring */}
          <circle cx="32" cy="30" r="6" fill="#070F1E" />
          <circle cx="32" cy="30" r="3" fill="#FFFFFF" />
        </g>
      );

    case 'settings':
      return (
        <g filter="url(#soft-shadow)">
          {/* 3D Interlocking Precision Gear */}
          <ellipse cx="32" cy="56" rx="20" ry="5" fill="#0E203C" opacity="0.3" />
          <path
            d="M36 6H28L26.5 13C24.7 13.7 23 14.7 21.5 15.9L15 13L10.8 17.2L13.7 23.7C12.5 25.2 11.5 26.9 10.8 28.7L4 30.2V36.2L10.8 37.7C11.5 39.5 12.5 41.2 13.7 42.7L10.8 49.2L15 53.4L21.5 50.5C23 51.7 24.7 52.7 26.5 53.4L28 60.4H36L37.5 53.4C39.3 52.7 41 51.7 42.5 50.5L49 53.4L53.2 49.2L50.3 42.7C51.5 41.2 52.5 39.5 53.2 37.7L60 36.2V30.2L53.2 28.7C52.5 26.9 51.5 25.2 50.3 23.7L53.2 17.2L49 13L42.5 15.9C41 14.7 39.3 13.7 37.5 13L36 6Z"
            fill="url(#gold-primary)"
            filter="url(#glow-gold)"
          />
          {/* Inner Depth Hole */}
          <circle cx="32" cy="33.2" r="10" fill="url(#navy-primary)" stroke="#FEF08A" strokeWidth="2" />
          <circle cx="32" cy="33.2" r="4.5" fill="#0E203C" />
        </g>
      );

    case 'audit':
    case 'lock':
      return (
        <g filter="url(#soft-shadow)">
          {/* 3D Security Shield & Keyhole */}
          <ellipse cx="32" cy="56" rx="22" ry="5" fill="#0E203C" opacity="0.3" />
          <path
            d="M32 6L14 13V28C14 41 21.8 51.5 32 55C42.2 51.5 50 41 50 28V13L32 6Z"
            fill="url(#navy-primary)"
            stroke="url(#gold-primary)"
            strokeWidth="2.5"
          />
          {/* Inner Gloss Shield */}
          <path
            d="M32 11L18 16.5V28C18 38.5 24.2 46.8 32 49.8C39.8 46.8 46 38.5 46 28V16.5L32 11Z"
            fill="url(#emerald-primary)"
            opacity="0.85"
          />
          {/* 3D Lock Center */}
          <rect x="25" y="27" width="14" height="11" rx="3" fill="url(#gold-primary)" filter="url(#glow-gold)" />
          <path d="M28 27V23C28 20.8 29.8 19 32 19C34.2 19 36 20.8 36 23V27" stroke="#FEF08A" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <circle cx="32" cy="32.5" r="1.5" fill="#0E203C" />
        </g>
      );

    case 'backup':
      return (
        <g filter="url(#soft-shadow)">
          {/* 3D Cloud Server Cylinders */}
          <ellipse cx="32" cy="56" rx="22" ry="5" fill="#0E203C" opacity="0.3" />
          {/* Cylinder 1 (Bottom) */}
          <ellipse cx="32" cy="45" rx="18" ry="6" fill="#1E3A8A" />
          <path d="M14 45V51C14 54.3 22.06 57 32 57C41.94 57 50 54.3 50 51V45Z" fill="url(#navy-primary)" />
          <ellipse cx="32" cy="45" rx="18" ry="6" fill="url(#navy-accent)" />
          <circle cx="20" cy="48" r="1.5" fill="#34D399" />
          {/* Cylinder 2 (Middle) */}
          <ellipse cx="32" cy="33" rx="18" ry="6" fill="#1E3A8A" />
          <path d="M14 33V39C14 42.3 22.06 45 32 45C41.94 45 50 42.3 50 39V33Z" fill="url(#navy-primary)" />
          <ellipse cx="32" cy="33" rx="18" ry="6" fill="url(#navy-accent)" />
          <circle cx="20" cy="36" r="1.5" fill="#34D399" />
          {/* Cylinder 3 (Top Gold Master) */}
          <ellipse cx="32" cy="21" rx="18" ry="6" fill="#92400E" />
          <path d="M14 21V27C14 30.3 22.06 33 32 33C41.94 33 50 30.3 50 27V21Z" fill="url(#gold-primary)" filter="url(#glow-gold)" />
          <ellipse cx="32" cy="21" rx="18" ry="6" fill="url(#gold-light)" />
          <circle cx="20" cy="24" r="1.5" fill="#10B981" />
          {/* Upload/Download 3D Arrow */}
          <path d="M32 8L26 14H30V20H34V14H38L32 8Z" fill="#FFFFFF" />
        </g>
      );

    case 'crown':
      return (
        <g filter="url(#soft-shadow)">
          <ellipse cx="32" cy="54" rx="22" ry="5" fill="#0E203C" opacity="0.3" />
          {/* 3D Imperial Gold Crown */}
          <path
            d="M12 44L16 20L25 32L32 14L39 32L48 20L52 44H12Z"
            fill="url(#gold-primary)"
            filter="url(#glow-gold)"
          />
          {/* Base Rim */}
          <rect x="12" y="44" width="40" height="8" rx="3" fill="#B45309" stroke="#FEF08A" strokeWidth="1.5" />
          {/* Gems on Base */}
          <circle cx="20" cy="48" r="2.5" fill="url(#rose-primary)" />
          <circle cx="32" cy="48" r="3" fill="url(#emerald-primary)" />
          <circle cx="44" cy="48" r="2.5" fill="url(#navy-accent)" />
          {/* Jewels atop Spikes */}
          <circle cx="16" cy="19" r="3" fill="#FFFBEB" />
          <circle cx="32" cy="13" r="4" fill="#FFFBEB" />
          <circle cx="48" cy="19" r="3" fill="#FFFBEB" />
        </g>
      );

    case 'check':
      return (
        <g filter="url(#soft-shadow)">
          <ellipse cx="32" cy="56" rx="18" ry="4" fill="#0E203C" opacity="0.3" />
          {/* 3D Emerald Sphere */}
          <circle cx="32" cy="30" r="22" fill="url(#emerald-primary)" filter="url(#glow-gold)" />
          {/* Gloss highlight */}
          <ellipse cx="26" cy="20" rx="9" ry="5" fill="#FFFFFF" opacity="0.4" transform="rotate(-30 26 20)" />
          {/* Checkmark */}
          <path d="M22 30L29 37L43 23" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );

    case 'alert':
      return (
        <g filter="url(#soft-shadow)">
          <ellipse cx="32" cy="56" rx="20" ry="4" fill="#0E203C" opacity="0.3" />
          {/* 3D Amber Warning Triangle */}
          <path
            d="M32 8L8 50C7.2 51.5 8.3 53.5 10 53.5H54C55.7 53.5 56.8 51.5 56 50L32 8Z"
            fill="url(#gold-primary)"
            filter="url(#glow-gold)"
          />
          {/* Inner Bevel */}
          <path d="M32 14L13 49H51L32 14Z" fill="#0E203C" opacity="0.85" />
          {/* Exclamation */}
          <rect x="30" y="24" width="4" height="13" rx="2" fill="url(#gold-light)" />
          <circle cx="32" cy="43" r="2.5" fill="url(#gold-light)" />
        </g>
      );

    case 'search':
      return (
        <g filter="url(#soft-shadow)">
          <ellipse cx="40" cy="56" rx="18" ry="4" fill="#0E203C" opacity="0.3" />
          {/* 3D Glass Lens & Gold Rim */}
          <circle cx="28" cy="26" r="16" fill="#0E203C" stroke="url(#gold-primary)" strokeWidth="4" filter="url(#glow-gold)" />
          {/* Glass Reflection */}
          <path d="M19 26C19 21.03 23.03 17 28 17" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />
          {/* 3D Heavy Handle */}
          <path d="M40 38L54 52C55.5 53.5 55.5 56 54 57.5C52.5 59 50 59 48.5 57.5L34.5 43.5" stroke="url(#gold-primary)" strokeWidth="6" strokeLinecap="round" />
        </g>
      );

    case 'plus':
      return (
        <g filter="url(#soft-shadow)">
          <ellipse cx="32" cy="56" rx="18" ry="4" fill="#0E203C" opacity="0.3" />
          <circle cx="32" cy="30" r="22" fill="url(#gold-primary)" filter="url(#glow-gold)" />
          <circle cx="32" cy="30" r="18" fill="#0E203C" opacity="0.4" />
          <path d="M32 18V42M20 30H44" stroke="#FFFBEB" strokeWidth="5" strokeLinecap="round" />
        </g>
      );

    case 'trash':
      return (
        <g filter="url(#soft-shadow)">
          <ellipse cx="32" cy="56" rx="18" ry="4" fill="#0E203C" opacity="0.3" />
          <rect x="18" y="20" width="28" height="32" rx="4" fill="url(#rose-primary)" stroke="#FDA4AF" strokeWidth="1.5" />
          {/* Can Ribs */}
          <line x1="25" y1="26" x2="25" y2="44" stroke="#881337" strokeWidth="2" strokeLinecap="round" />
          <line x1="32" y1="26" x2="32" y2="44" stroke="#881337" strokeWidth="2" strokeLinecap="round" />
          <line x1="39" y1="26" x2="39" y2="44" stroke="#881337" strokeWidth="2" strokeLinecap="round" />
          {/* Lid */}
          <rect x="14" y="14" width="36" height="5" rx="2" fill="#FDA4AF" />
          <rect x="27" y="9" width="10" height="4" rx="2" fill="#F43F5E" />
        </g>
      );

    case 'edit':
      return (
        <g filter="url(#soft-shadow)">
          <ellipse cx="36" cy="56" rx="18" ry="4" fill="#0E203C" opacity="0.3" />
          {/* 3D Stylus / Pen */}
          <path d="M48 8L56 16L24 48L14 52L18 42L48 8Z" fill="url(#gold-primary)" filter="url(#glow-gold)" />
          <path d="M44 12L52 20L48 24L40 16L44 12Z" fill="#FEF08A" />
          <path d="M14 52L18 42L24 48L14 52Z" fill="#0E203C" />
          <circle cx="15" cy="51" r="1.5" fill="#38BDF8" />
        </g>
      );

    case 'share':
      return (
        <g filter="url(#soft-shadow)">
          <ellipse cx="32" cy="56" rx="18" ry="4" fill="#0E203C" opacity="0.3" />
          {/* Connecting Links */}
          <line x1="22" y1="32" x2="42" y2="20" stroke="url(#gold-primary)" strokeWidth="4" strokeLinecap="round" />
          <line x1="22" y1="32" x2="42" y2="44" stroke="url(#gold-primary)" strokeWidth="4" strokeLinecap="round" />
          {/* 3 Orbs */}
          <circle cx="20" cy="32" r="9" fill="url(#gold-primary)" filter="url(#glow-gold)" />
          <circle cx="44" cy="18" r="7" fill="url(#navy-accent)" />
          <circle cx="44" cy="46" r="7" fill="url(#emerald-primary)" />
        </g>
      );

    case 'download':
      return (
        <g filter="url(#soft-shadow)">
          <ellipse cx="32" cy="56" rx="18" ry="4" fill="#0E203C" opacity="0.3" />
          {/* Arrow */}
          <path d="M32 8V38M20 26L32 38L44 26" stroke="url(#gold-primary)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow-gold)" />
          {/* Tray Base */}
          <path d="M14 44V50H50V44" stroke="url(#navy-accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );

    case 'printer':
      return (
        <g filter="url(#soft-shadow)">
          <ellipse cx="32" cy="56" rx="20" ry="4" fill="#0E203C" opacity="0.3" />
          {/* Printer Body */}
          <rect x="14" y="22" width="36" height="22" rx="4" fill="url(#navy-primary)" stroke="#38BDF8" strokeWidth="1.5" />
          {/* Paper Top */}
          <path d="M22 10H42V22H22V10Z" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" />
          {/* Paper Out Bottom */}
          <path d="M20 38H44V50H20V38Z" fill="#FEF08A" stroke="url(#gold-primary)" strokeWidth="1" />
          {/* Status LED */}
          <circle cx="44" cy="28" r="2" fill="#10B981" filter="url(#glow-gold)" />
        </g>
      );

    case 'eye':
      return (
        <g filter="url(#soft-shadow)">
          <ellipse cx="32" cy="56" rx="20" ry="4" fill="#0E203C" opacity="0.3" />
          {/* Eye Almond Contour */}
          <path
            d="M8 32C8 32 17 14 32 14C47 14 56 32 56 32C56 32 47 50 32 50C17 50 8 32 8 32Z"
            fill="url(#navy-primary)"
            stroke="url(#gold-primary)"
            strokeWidth="2.5"
          />
          {/* Iris Gold & Navy */}
          <circle cx="32" cy="32" r="10" fill="url(#gold-primary)" filter="url(#glow-gold)" />
          <circle cx="32" cy="32" r="5" fill="#0E203C" />
          <circle cx="35" cy="29" r="2" fill="#FFFFFF" />
        </g>
      );

    case 'filter':
      return (
        <g filter="url(#soft-shadow)">
          <ellipse cx="32" cy="56" rx="18" ry="4" fill="#0E203C" opacity="0.3" />
          {/* Funnel */}
          <path
            d="M10 12H54L38 34V48L26 54V34L10 12Z"
            fill="url(#gold-primary)"
            stroke="#FEF08A"
            strokeWidth="1.5"
            filter="url(#glow-gold)"
          />
          <ellipse cx="32" cy="12" rx="22" ry="4" fill="url(#gold-light)" />
        </g>
      );

    default:
      return (
        <g filter="url(#soft-shadow)">
          <circle cx="32" cy="32" r="20" fill="url(#gold-primary)" />
        </g>
      );
  }
}
