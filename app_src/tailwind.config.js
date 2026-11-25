/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#07090c',
          900: '#0b0e13',
          850: '#0f131a',
          800: '#141922',
          700: '#1b2230',
        },
        mist: {
          100: '#eef2f7',
          300: '#b9c3d3',
          400: '#8b97a9',
          500: '#6b7789',
        },
        mint: {
          300: '#9df0d7',
          400: '#6ee7c8',
          500: '#3dd3ac',
        },
        ember: {
          300: '#ffd08a',
          400: '#f0b429',
          500: '#dd9410',
        },
      },
      fontFamily: {
        sans: ['"Inter"', '"Segoe UI"', '"Microsoft YaHei"', '"PingFang SC"', 'system-ui', 'sans-serif'],
        serif: ['"Georgia"', '"Songti SC"', '"SimSun"', 'serif'],
        mono: ['"Cascadia Code"', '"Consolas"', '"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 40px rgba(110,231,200,0.18)',
        ember: '0 0 32px rgba(240,180,41,0.16)',
        panel: '0 24px 60px rgba(0,0,0,0.45)',
      },
      keyframes: {
        breathe: {
          '0%,100%': { opacity: '0.35', transform: 'scale(1)' },
          '50%': { opacity: '0.75', transform: 'scale(1.06)' },
        },
        drift: {
          '0%,100%': { transform: 'translate3d(0,0,0)' },
          '50%': { transform: 'translate3d(2%, -3%, 0)' },
        },
        caret: {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
      animation: {
        breathe: 'breathe 7s ease-in-out infinite',
        drift: 'drift 22s ease-in-out infinite',
        caret: 'caret 1s step-end infinite',
      },
    },
  },
  plugins: [],
}
