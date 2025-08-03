
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./index.tsx",
  ],
  theme: {
    extend: {
        fontFamily: {
            'prompt': ['"Prompt"', 'sans-serif'],
            'pixel': ['"Pixelify Sans"', 'sans-serif'],
        },
        colors: {
            'game-dark': '#1a1a2e',
            'game-medium': '#2c3e50',
            'game-light': '#34495e',
            'game-accent': '#e74c3c',
            'game-gold': '#f39c12',
            'game-blue': '#3498db',
            rarity: {
                common: '#ffffff',
                uncommon: '#2ecc71',
                rare: '#3498db',
                legendary: '#9b59b6',
                mythic: '#f39c12',
            },
        },
        animation: {
            'pixel-fade': 'pixel-fade 0.5s ease-out forwards',
            'float': 'float 3s ease-in-out infinite',
            'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            'portal-spin': 'portalSpin 10s linear infinite',
            'damage-shake': 'damage-shake 0.3s cubic-bezier(.36,.07,.19,.97) both',
            'item-drop': 'item-drop 0.5s cubic-bezier(0.250, 0.460, 0.450, 0.940) both',
        },
        keyframes: {
            'pixel-fade': {
                '0%': { opacity: 0, transform: 'scale(0.95)' },
                '100%': { opacity: 1, transform: 'scale(1)' },
            },
            'float': {
                '0%, 100%': { transform: 'translateY(0px)' },
                '50%': { transform: 'translateY(-8px)' },
            },
            'portalSpin': {
                'from': { transform: 'rotate(0deg)' },
                'to': { transform: 'rotate(360deg)' },
            },
            'damage-shake': {
                '10%, 90%': { transform: 'translateX(-1px)' },
                '20%, 80%': { transform: 'translateX(2px)' },
                '30%, 50%, 70%': { transform: 'translateX(-4px)' },
                '40%, 60%': { transform: 'translateX(4px)' },
            },
            'item-drop': {
              '0%': { transform: 'translateY(-100px) scale(0)', opacity: '0' },
              '50%': { transform: 'translateY(10px) scale(1.1)', opacity: '1' },
              '100%': { transform: 'translateY(0) scale(1)', opacity: '1' },
            },
        },
    },
  },
  plugins: [],
}
