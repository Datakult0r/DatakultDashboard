import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    colors: {
      base: 'rgb(11 13 20)',
      surface: 'rgb(18 21 31)',
      elevated: 'rgb(26 30 46)',
      border: 'rgb(39 45 66)',
      primary: 'rgb(238 240 246)',
      secondary: 'rgb(146 153 176)',
      accent: 'rgb(96 165 250)',
      danger: 'rgb(248 113 113)',
      warning: 'rgb(251 191 36)',
      success: 'rgb(52 211 153)',
      info: 'rgb(167 139 250)',
      white: '#fff',
      transparent: 'transparent',
      current: 'currentColor',
      blue: {
        500: 'rgb(59 130 246)',
        400: 'rgb(96 165 250)',
      },
      green: {
        400: 'rgb(74 222 128)',
        500: 'rgb(34 197 94)',
      },
      violet: {
        400: 'rgb(167 139 250)',
        500: 'rgb(139 92 246)',
      },
      amber: {
        400: 'rgb(251 191 36)',
        500: 'rgb(245 158 11)',
      },
      gray: {
        500: 'rgb(107 114 128)',
      },
    },
    fontFamily: {
      sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      mono: ['var(--font-mono)', 'monospace'],
    },
    fontSize: {
      xs: ['0.75rem', '1rem'],
      sm: ['0.875rem', '1.25rem'],
      base: ['1rem', '1.5rem'],
      lg: ['1.125rem', '1.75rem'],
      xl: ['1.25rem', '1.75rem'],
      '2xl': ['1.5rem', '2rem'],
      '3xl': ['1.875rem', '2.25rem'],
      '4xl': ['2.25rem', '2.5rem'],
    },
    spacing: {
      xs: '0.25rem',
      sm: '0.5rem',
      md: '1rem',
      lg: '1.5rem',
      xl: '2rem',
      '2xl': '3rem',
      0: '0',
      1: '0.25rem',
      2: '0.5rem',
      3: '0.75rem',
      4: '1rem',
      6: '1.5rem',
      8: '2rem',
      10: '2.5rem',
      12: '3rem',
      15: '3.75rem',
      16: '4rem',
      20: '5rem',
      24: '6rem',
      32: '8rem',
    },
    borderRadius: {
      none: '0',
      sm: '0.25rem',
      base: '0.5rem',
      lg: '0.75rem',
      xl: '1rem',
      full: '9999px',
    },
    boxShadow: {
      sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
      lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
      xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    },
    keyframes: {
      pulse: {
        '0%, 100%': { opacity: '1' },
        '50%': { opacity: '0.5' },
      },
    },
    animation: {
      pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
    },
    transitionDuration: {
      200: '200ms',
      300: '300ms',
    },
  },
  plugins: [],
};

export default config;
