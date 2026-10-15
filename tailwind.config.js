/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#121317',
        surface: '#121317',
        'surface-lowest': '#0d0e12',
        'surface-low': '#1a1b20',
        'surface-container': '#1e1f24',
        'surface-high': '#292a2e',
        'surface-bright': '#38393e',
        'cyan-hud': '#00eefc',
        'amber-hud': '#ffb800',
        'magenta-hud': '#ff007f',
        'hazard-hud': '#ff0055',
        'matrix-hud': '#00FF66',
        'muted-aa': '#9ca3af',
      },
      fontFamily: {
        headline: ['Sora', 'sans-serif'],
        body: ['Sora', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
