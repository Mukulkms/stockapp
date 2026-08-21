/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F5F3FF',
        ink: {
          DEFAULT: '#211C4D',
          light: '#4A4380',
          50: '#EEECFB'
        },
        indigo: {
          DEFAULT: '#4F46E5',
          dark: '#3730A3'
        },
        violet: {
          DEFAULT: '#7C3AED',
          dark: '#5B21B6'
        },
        haze: {
          50: '#F1EEFC',
          400: '#9891BC',
          500: '#6E6693'
        },
        success: '#0D9488',
        danger: '#DC2626',
        line: '#E3DFFA'
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace']
      },
      borderRadius: {
        DEFAULT: '10px'
      }
    }
  },
  plugins: []
}
