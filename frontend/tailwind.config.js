/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F7F8FB',
        ink: {
          DEFAULT: '#1E2A5E',
          light: '#374873',
          50: '#EEF1FA'
        },
        mustard: {
          DEFAULT: '#D9A441',
          dark: '#B8842E'
        },
        success: '#0F9D58',
        danger: '#DC2626',
        line: '#E4E7F1'
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
