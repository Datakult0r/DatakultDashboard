import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    colors: {
      /* Clinic of AI — warm editorial palette */
      base: '#fff8f3',
      surface: '#ffffff',
      elevated: '#f5ede6',
      border: '#e0d5ca',
      primary: '#001215',
      secondary: '#5a6b6e',
      accent: '#a14000',
      'accent-bright': '#ff7a32',
      danger: '#b91c1c',
      warning: '#a14000',
      success: '#166534',
      info: '#002a2e',
      white: '#ffffff',
      transparent: 'transparent',
      current: 'currentColor',
      /* Dark mode tokens */
      'base-dark': '#001215',
      'surface-dark': '#002a2e',
      'elevated-dark': '#003d42',
      'border-dark': '#1a4a4f',
      'primary-dark': '#fff8f3',
      'secondary-dark': '#8fa3a6',
      /* Semantic shades for component use */
      teal: {
        900: '#001215',
        800: '#002a2e',
        700: '#003d42',
        600: '#1a4a4f',
      },
      orange: {
        700: '#a14000',
        500: '#ff7a32',
        100: '#fff0e6',
        50: '#fff8f3',
      },
      green: {
        800: '#166534',
        600: '#16a34a',
        100: '#dcfce7',
        50: '#f0fdf4',
      },
      red: {
        700: '#b91c1c',
        500: '#ef4444',
        100: '#fee2e2',
        50: '#fef2f2',
      },
      gray: {
        500: '#5a6b6e',
        400: '#8fa3a6',
        300: '#e0d5ca',
        200: '#f5ede6',
        100: '#fff8f3',
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
