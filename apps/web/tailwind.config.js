/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Tajawal"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        tajawal: ['"Tajawal"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Noto Kufi Arabic"', '"Tajawal"', 'sans-serif'],
        kufi: ['"Noto Kufi Arabic"', '"Tajawal"', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        // Warm Ivory Canvas & Surfaces (Light Mode)
        ivory: {
          50: '#FFFDF9', // Cream Card Surface
          100: '#F8F3E6', // App Canvas / Distinct Warm Ivory
          200: '#F2EBDC', // Card Subtle Surface
          300: '#E8DECE', // Subtle Warm Border
          400: '#D8CAB3', // Darker Warm Border
        },
        // Deep Navy Theme Palette (Dark Mode)
        navy: {
          950: '#070F1E', // Canvas (Dark Mode)
          900: '#0A192F', // Primary Shell & Sidebar
          850: '#0E203C', // Elevated Card Surface
          800: '#152C50', // Hover Surface
          750: '#1E3A5F', // Soft Border
          700: '#2A4D7A',
        },
        // Luxury Gold Palette
        gold: {
          50: '#FBF8F0',
          100: '#F4EAD3',
          200: '#E7D5AA',
          300: '#DABF7E',
          400: '#D4AF37', // Luxury Gold
          500: '#C5A059', // Restrained Luxury Gold
          600: '#A4813F',
          700: '#836329',
          800: '#644A1B',
          900: '#483410',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        '2xl': '1rem',
        xl: '0.75rem',
        lg: '0.5rem',
        md: '0.375rem',
        sm: '0.25rem',
      },
      boxShadow: {
        'gold-sm': '0 1px 2px 0 rgba(197, 160, 89, 0.15)',
        'gold-md': '0 4px 12px -2px rgba(212, 175, 55, 0.20)',
        'warm-xs': '0 1px 3px 0 rgba(10, 25, 47, 0.04)',
        'warm-sm': '0 2px 6px 0 rgba(10, 25, 47, 0.06)',
        'navy-lg': '0 10px 25px -3px rgba(7, 15, 30, 0.5)',
      },
    },
  },
  plugins: [],
};
