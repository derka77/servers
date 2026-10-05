/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Theme-driven via CSS vars
        tc: 'var(--tc)',
        'tc-lg': 'var(--tc-lg)',
        'tc-30': 'var(--tc-30)',
        'tc-20': 'var(--tc-20)',
        'tc-10': 'var(--tc-10)',
        'tc-07': 'var(--tc-07)',
        'tc-04': 'var(--tc-04)',
        paper: 'var(--paper)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        'surface-3': 'var(--surface-3)',
        ink: 'var(--ink)',
        'ink-2': 'var(--ink-2)',
        'ink-3': 'var(--ink-3)',
        line: 'var(--line)',
        accent: 'var(--accent)',
        brass: 'var(--brass)',
        // Fixed warm neutrals
        warm: {
          50: '#fdfaf5',
          100: '#f8f0e4',
          200: '#fdf8f0',
          300: '#fafaf5',
        },
        gold: {
          light: '#f9d490',
          DEFAULT: '#e8a840',
          dark: '#c08020',
        },
        amber: '#B8792A',
        rose: '#c84068',
        bronze: '#907030',
        // Text colors
        text: {
          primary: '#3a2030',
          secondary: '#9a8090',
          dark: '#2a1828',
          mid: '#5a3040',
        },
      },
      fontFamily: {
        display: ['Fraunces', 'Noto Naskh Arabic', 'serif'],
        serif: ['Fraunces', 'Noto Naskh Arabic', 'serif'],
        sans: ['Inter', 'Noto Sans Arabic', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'xl': '14px',
        '2xl': '18px',
        '3xl': '22px',
        '4xl': '28px',
      },
    },
  },
  plugins: [],
}
