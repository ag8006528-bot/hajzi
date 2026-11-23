import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        pitch: {
          DEFAULT: '#1B7A3D', // Grass Green (primary)
          dark: '#0F4D26', // Dark Pitch Green
          light: '#2E9E55', // Light Turf Green
          deep: '#0A3A1C',
        },
        chalk: '#FFFFFF',
        card: '#FFD60A', // Referee-card yellow accent
        ink: '#1A1A1A',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Oswald', 'sans-serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 10px 30px -10px rgba(0,0,0,0.35)',
        glow: '0 0 0 4px rgba(255,214,10,0.35)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
};

export default config;
