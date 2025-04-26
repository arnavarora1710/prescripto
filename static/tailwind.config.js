/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dark-bg': '#0a0a0a', // Very dark background
        'terminal-green': '#00ff00', // Classic green
        'electric-blue': '#00ffff', // Cyan/Electric blue
        'off-white': '#e0e0e0', // For body text
        'dark-card': '#1a1a1a', // Darker card background
        'border-color': '#333333', // Subtle border
      },
      fontFamily: {
        'mono': ['"Source Code Pro"', 'ui-monospace', 'Menlo', 'Monaco', '"Cascadia Mono"', '"Segoe UI Mono"', '"Roboto Mono"', '"Oxygen Mono"', '"Ubuntu Monospace"', '"Fira Mono"', '"Droid Sans Mono"', '"Courier New"', 'monospace'],
        'sans': ['Inter', 'system-ui', 'sans-serif'], // Keep sans for potential fallbacks or specific elements
      },
      animation: {
        'scanline': 'scanline 10s linear infinite',
        'glitch': 'glitch 1.5s infinite steps(8)',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
      keyframes: {
        scanline: {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '0 100px' }, // Adjust distance
        },
        glitch: {
          '0%, 100%': { transform: 'translate(0)', opacity: '1' },
          '10%': { transform: 'translate(-2px, 2px)', opacity: '0.8' },
          '20%': { transform: 'translate(2px, -2px)', opacity: '1' },
          '30%': { transform: 'translate(-2px, -2px)', opacity: '0.9' },
          '40%': { transform: 'translate(2px, 2px)', opacity: '1' },
          '50%': { transform: 'skewX(-5deg)', opacity: '0.7' },
          '60%': { transform: 'skewX(5deg)', opacity: '1' },
          '70%': { transform: 'translate(-1px, 1px)', opacity: '0.85' },
          '80%': { transform: 'translate(1px, -1px)', opacity: '1' },
          '90%': { transform: 'translate(0)', opacity: '0.9' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: 0.7, filter: 'blur(2px)' },
          '50%': { opacity: 1, filter: 'blur(4px)' },
        }
      }
    },
  },
  plugins: [],
} 