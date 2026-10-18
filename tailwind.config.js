/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Cairo', 'sans-serif'],
      },
      colors: {
        gray: {
          850: '#1f2937',
          900: '#111827',
          950: '#030712',
        },
        brand: {
          green: '#10B981',
          red: '#EF4444',
          blue: '#3B82F6',
          gold: '#F59E0B',
          pink: '#ec4899',
          cyan: '#06b6d4',
          neon: '#ccff00',
        },
      },
    },
  },
  plugins: [],
};
