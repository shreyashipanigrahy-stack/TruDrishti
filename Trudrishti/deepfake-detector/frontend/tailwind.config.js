/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        // Brand palette
        brand: {
          50: '#edfcff',
          100: '#d0f6ff',
          200: '#a5edff',
          300: '#67e1ff',
          400: '#1eccff',
          500: '#00b4e6',
          600: '#008ec4',
          700: '#0071a0',
          800: '#065d83',
          900: '#0b4d6e',
          950: '#063248',
        },
        // Dark surface palette
        surface: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          700: '#1e293b',
          800: '#0f172a',
          900: '#090f1d',
          950: '#050a14',
        },
        // Accent purple
        violet: {
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
        },
        // Semantic
        success: '#22d3ee',
        danger: '#f43f5e',
        warning: '#fbbf24',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-brand': 'linear-gradient(135deg, #00b4e6 0%, #8b5cf6 100%)',
        'gradient-dark': 'linear-gradient(160deg, #090f1d 0%, #0f172a 50%, #090f1d 100%)',
      },
      boxShadow: {
        'glow-cyan': '0 0 20px 4px rgba(0,180,230,0.35)',
        'glow-violet': '0 0 20px 4px rgba(139,92,246,0.35)',
        'glass': '0 8px 32px rgba(0,0,0,0.35)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'slide-up': 'slideUp 0.5s cubic-bezier(0.16,1,0.3,1) forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'scan': 'scan 2s linear infinite',
        'shimmer': 'shimmer 1.6s infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(24px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        scan: { from: { top: '0%' }, to: { top: '100%' } },
        shimmer: {
          '0%': { backgroundPosition: '-500px 0' },
          '100%': { backgroundPosition: '500px 0' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
