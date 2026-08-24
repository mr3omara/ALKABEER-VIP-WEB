/**
 * ALKABEER VIP WEB — Design Tokens
 * Luxury Business / Financial Identity
 * Palette: Deep Navy (#0A192F / #070F1E), Warm Ivory Canvas (#F8F3E6), Cream Card Surface (#FFFDF9), Warm Border (#E8DECE)
 * Typography: Tajawal (font-tajawal 80%) + Noto Kufi Arabic (font-kufi 20%)
 */

export const tokens = {
  colors: {
    // Brand Core — Deep Navy
    brandNavy: {
      950: '#070F1E', // Canvas (Dark Mode)
      900: '#0A192F', // Primary shell & sidebar background
      850: '#0E203C', // Card & elevated surface background (Dark Mode)
      800: '#152C50', // Hover & highlighted surfaces
      750: '#1E3A5F', // Soft borders & dividers (Dark Mode)
      700: '#2A4D7A',
    },
    // Restrained Luxury Gold Accents
    brandGold: {
      50: '#FBF8F0',
      100: '#F4EAD3',
      200: '#E7D5AA',
      300: '#DABF7E',
      400: '#D4AF37', // Primary bright gold
      500: '#C5A059', // Restrained luxury gold
      600: '#A4813F',
      700: '#836329',
      800: '#644A1B',
      900: '#483410',
    },
    // Warm Ivory Light Mode Palette
    lightSurface: {
      canvas: '#F8F3E6',      // Distinct Warm Ivory / Soft Cream
      card: '#FFFDF9',        // Cream Card Surface
      cardSubtle: '#F2EBDC',  // Subtle warm card background
      border: '#E8DECE',      // Warm neutral border
      borderDark: '#D8CAB3',  // High-contrast warm border
    },
    // Typography Colors
    text: {
      lightPrimary: '#0A192F',    // Deep Navy
      lightSecondary: '#4A5568',  // Muted Navy / Slate
      darkPrimary: '#F1F5F9',     // Soft Off-White
      darkSecondary: '#94A3B8',
    },
  },
  fontFamily: {
    tajawal: ['"Tajawal"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
    kufi: ['"Noto Kufi Arabic"', '"Tajawal"', 'sans-serif'],
  },
};
