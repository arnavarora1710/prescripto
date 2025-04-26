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
        'dark-card': '#1a1a1a', // Slightly darker card for better contrast
        'dark-input': '#252525', // Darker input background
        'border-color': '#383838', // Subtly lighter border
        // Pastels
        'pastel-lavender': '#d1c4e9',
        'pastel-mint': '#c8e6c9',
        'pastel-peach': '#ffccbc',
        'pastel-blue': '#bbdefb',
      },
      fontFamily: {
        'mono': ['"Source Code Pro"', 'ui-monospace', 'Menlo', 'Monaco', '"Cascadia Mono"', '"Segoe UI Mono"', '"Roboto Mono"', '"Oxygen Mono"', '"Ubuntu Monospace"', '"Fira Mono"', '"Droid Sans Mono"', '"Courier New"', 'monospace'],
        'sans': ['Lato', 'system-ui', 'sans-serif'], // Keep Lato for sans-serif text
      },
      animation: {
        'scanline': 'scanline 10s linear infinite',
        'glitch': 'glitch 1.5s infinite steps(8)',
        'pulse-glow': 'pulse-glow 2.5s ease-in-out infinite', // Slightly slower pulse
        'fade-in': 'fadeIn 0.6s ease-out forwards', // Slightly slower fade-in
        'subtle-pulse': 'subtlePulse 3s infinite ease-in-out', // Add subtle pulse for specific elements
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
          '0%, 100%': { opacity: 0.7, filter: 'blur(3px)' }, // Slightly stronger blur
          '50%': { opacity: 1, filter: 'blur(6px)' }, // Stronger glow peak
        },
        fadeIn: {
          '0%': { opacity: 0, transform: 'translateY(15px)' }, // Slightly more movement
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        subtlePulse: { // Keyframe for subtle pulse
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.02)' },
        },
      },
      boxShadow: {
        'pastel-glow-sm': '0 0 10px 2px rgba(209, 196, 233, 0.35)', // Enhanced lavender glow
        'pastel-glow-md': '0 0 18px 4px rgba(209, 196, 233, 0.35)',
        'blue-glow-sm': '0 0 10px 2px rgba(0, 255, 255, 0.3)', // Electric blue glow
        'blue-glow-md': '0 0 18px 4px rgba(0, 255, 255, 0.3)',
      },
      backgroundImage: { // Add subtle gradients
        'dark-gradient': 'linear-gradient(180deg, #1a1a1a 0%, #0f0f0f 100%)',
        'blue-highlight-gradient': 'linear-gradient(90deg, rgba(0, 255, 255, 0.1) 0%, rgba(0, 255, 255, 0) 100%)',
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'), // Ensure forms plugin is added for better default styles
  ],
} 