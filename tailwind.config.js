/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { ink: '#17202B', canvas: '#F5F1EA', clay: '#B9563E', moss: '#667A62', butter: '#E5C56B', line: '#E2DDD4', fog: '#EDE9E1' },
      fontFamily: { sans: ['Pontano Sans', 'ui-sans-serif', 'system-ui'], display: ['Scholar', 'Georgia', 'serif'] },
      boxShadow: { soft: '0 18px 46px rgba(23, 32, 43, 0.08)', lift: '0 12px 30px rgba(23, 32, 43, 0.12)' },
      borderRadius: { xl: '18px', '2xl': '24px' },
    },
  },
  plugins: [],
}
