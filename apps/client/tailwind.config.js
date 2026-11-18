/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Alegreya SC"', 'Georgia', 'serif'],
        body: ['"Alegreya Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        parchment: { 50: '#fbf4e4', 100: '#f3e3c3', 200: '#e6cd9a', 300: '#d4b274' },
        wood: { 700: '#4a2f1b', 800: '#33200f', 900: '#21140a', 950: '#140b05' },
        gold: { 300: '#f6d98e', 400: '#e8c06a', 500: '#c99a3e', 600: '#9c7428' },
      },
      boxShadow: {
        panel: '0 10px 30px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,230,180,.08)',
      },
    },
  },
  plugins: [],
};
