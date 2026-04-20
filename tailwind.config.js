/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Barlow Condensed"', 'system-ui', 'sans-serif'],
        body: ['Barlow', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        // Tokens del sistema (UI/UX Pro Max → fitness/deportivo)
        brand: {
          50: '#FFF7ED',
          400: '#FB923C',
          500: '#F97316', // primary
          600: '#EA580C',
          700: '#C2410C',
        },
        cta: {
          400: '#4ADE80',
          500: '#22C55E', // CTA success
          600: '#16A34A',
        },
        surface: {
          950: '#0C0A09',
          900: '#1C1917',
          800: '#292524',
          700: '#44403C',
        },
      },
      boxShadow: {
        glow: '0 0 40px rgba(249, 115, 22, 0.35)',
        'glow-cta': '0 0 30px rgba(34, 197, 94, 0.35)',
      },
      spacing: {
        'touch': '2.75rem', // 44px touch target mínimo
      },
    },
  },
  plugins: [],
}
