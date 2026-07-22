/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F5F6FA',
        ink: {
          DEFAULT: '#1B2540',
          light: '#3A4566',
          50: '#EEF1FA'
        },
        copper: {
          DEFAULT: '#B5702F',
          dark: '#8C561F'
        },
        mustard: {
          DEFAULT: '#B5702F',
          dark: '#8C561F'
        },
        success: '#0E7C6B',
        danger: '#DC2626',
        line: '#E2E5ED'
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
