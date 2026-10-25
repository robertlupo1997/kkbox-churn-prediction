/**
 * Tailwind is compiled at build time. The page used to load the Play CDN
 * (cdn.tailwindcss.com), which Tailwind says not to use in production and
 * which left a hosted demo depending on a third-party script at runtime.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./index.html', './index.tsx', './App.tsx', './components/**/*.tsx', './services/**/*.ts'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: '#ff4d00',
        dark: '#000000',
        light: '#f4f4f4',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
};
