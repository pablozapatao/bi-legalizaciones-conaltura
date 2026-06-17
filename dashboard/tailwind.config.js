/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary:      '#125160',
        'primary-lt': '#1a6b7a',
        beige:        '#F4F0E5',
        'beige-dk':   '#EAE5D8',
        accent:       '#A1D81A',
        'accent-lt':  '#DBFF69',
        coral:        '#FF795A',
        success:      '#166534',
        warning:      '#92400E',
        stage1:       '#125160',
        stage2:       '#1a6b7a',
        stage3:       '#1a7d6e',
        stage4:       '#1e8f62',
        stage5:       '#166534',
        stage6:       '#4d7c0f',
        stage7:       '#FF795A',
        stage8:       '#991B1B',
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body:    ['Funnel Sans', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
      },
    },
  },
  plugins: [],
}
