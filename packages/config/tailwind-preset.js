// Precision Industrial Design System - Tailwind Preset
// Dark mode default, tabular numbers, high-contrast Safety Orange accents

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        asphalt: '#0F1115',
        gunmetal: '#1C1F26',
        'edge-steel': '#2A2F3A',
        'safety-orange': '#FF5F00',
        white: '#FFFFFF',
        concrete: '#9CA3AF',
        safe: '#10B981',
        warn: '#F59E0B',
        critical: '#EF4444',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      transitionTimingFunction: {
        mechanical: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
