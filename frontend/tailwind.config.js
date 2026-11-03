/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    screens: {
      'xs': '480px',
      'sm': '640px',
      'md': '768px',
      'lg': '992px',
      'xl': '1200px',
      '2xl': '1440px',
    },
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0B1F4B',
          dark: '#071533',
          light: '#142b63',
        },
        indigo: {
          DEFAULT: '#3B4FE0',
          hover: '#2f3fc0',
          light: '#eef1ff',
        },
        pink: {
          DEFAULT: '#E91E7B',
          light: '#fdf2f8',
        },
        teal: {
          DEFAULT: '#12b39a',
          dark: '#0e8f7b',
          light: '#e6f8f5',
        },
        surface: {
          bg: '#f4f6fb',
          card: '#ffffff',
          line: '#e3e7f0',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
        'modal': '0 20px 40px -8px rgba(11, 31, 75, 0.22), 0 8px 16px -4px rgba(11, 31, 75, 0.12)',
        'dropdown': '0 10px 25px -4px rgba(11, 31, 75, 0.14), 0 4px 8px -2px rgba(11, 31, 75, 0.06)',
      }
    },
  },
  plugins: [],
}

