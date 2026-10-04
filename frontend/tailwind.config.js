/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Identidade de marca (FASE 1)
        ml: { yellow: '#FFE600', blue: '#3483FA', 'blue-hover': '#2968C8', green: '#00A650' },
        ink: { primary: 'rgba(0, 0, 0, 0.9)', secondary: 'rgba(0, 0, 0, 0.55)' },
        page: '#EBEBEB',
        line: 'rgba(0, 0, 0, 0.1)',
        // Tokens semânticos (FASE 2) — única fonte de verdade de cor; nada de hex nos componentes
        background: '#EBEBEB',
        surface: '#FFFFFF',
        foreground: 'rgba(0, 0, 0, 0.9)',
        'muted-foreground': 'rgba(0, 0, 0, 0.55)',
        border: 'rgba(0, 0, 0, 0.1)',
        primary: { DEFAULT: '#3483FA', hover: '#2968C8', foreground: '#FFFFFF' },
        secondary: { DEFAULT: '#FFE600', hover: '#F2DC00', foreground: 'rgba(0, 0, 0, 0.9)' },
        success: { DEFAULT: '#00A650', hover: '#00914A', soft: '#E6F5EC', foreground: '#FFFFFF', 'soft-foreground': '#0A6B37' },
        warning: { DEFAULT: '#B45309', soft: '#FEF3C7', foreground: '#FFFFFF', 'soft-foreground': '#8A4208' },
        destructive: { DEFAULT: '#DC2626', hover: '#B91C1C', soft: '#FEE2E2', foreground: '#FFFFFF', 'soft-foreground': '#991B1B' },
        info: { DEFAULT: '#2968C8', soft: '#E3EDFF', foreground: '#FFFFFF', 'soft-foreground': '#1D4F9E' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      fontSize: {
        display: ['2.5rem', { lineHeight: '1.15', fontWeight: '700', letterSpacing: '-0.02em' }],
        h1: ['2rem', { lineHeight: '1.2', fontWeight: '700', letterSpacing: '-0.01em' }],
        h2: ['1.5rem', { lineHeight: '1.3', fontWeight: '600' }],
        h3: ['1.25rem', { lineHeight: '1.35', fontWeight: '600' }],
        h4: ['1.125rem', { lineHeight: '1.4', fontWeight: '600' }],
        body: ['1rem', { lineHeight: '1.5' }],
        'body-small': ['0.875rem', { lineHeight: '1.45' }],
        caption: ['0.75rem', { lineHeight: '1.4' }],
        label: ['0.875rem', { lineHeight: '1.2', fontWeight: '500' }],
      },
      borderRadius: { DEFAULT: '6px', xl: '14px' },
      boxShadow: {
        card: '0 1px 2px 0 rgba(0, 0, 0, 0.15)',
        'card-hover': '0 6px 16px 0 rgba(0, 0, 0, 0.12)',
        elevated: '0 12px 32px 0 rgba(0, 0, 0, 0.14)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-in-right': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        'slide-in-right': 'slide-in-right 200ms ease-out',
      },
    },
  },
  plugins: [],
}
