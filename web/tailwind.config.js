/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Tickfy brand colors
        tickfy: {
          DEFAULT: '#9C00FF',  // Primary purple
          50: '#F5E6FF',
          100: '#E6CCFF',
          200: '#CC99FF',
          300: '#B366FF',
          400: '#9933FF',
          500: '#9C00FF',      // Primary
          600: '#8A00E6',
          700: '#7800CC',
          800: '#6600B3',
          900: '#540099',
        },
        'tickfy-light': {
          DEFAULT: '#BAB6FF',  // Secondary/accent
          50: '#F5F4FF',
          100: '#EBEAFF',
          200: '#D7D5FF',
          300: '#C3C0FF',
          400: '#BAB6FF',      // Secondary
          500: '#A6A1FF',
          600: '#928CFF',
          700: '#7E77FF',
          800: '#6A62FF',
          900: '#564DFF',
        },
      },
    },
  },
  plugins: [],
}
