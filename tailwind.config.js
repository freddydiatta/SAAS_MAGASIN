export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#111827', // Gray 900
        secondary: '#4B5563', // Gray 600
        accent: '#D96645', // Brand Orange
        accentHover: '#C25637', // Darker Orange
        surface: '#FBF9F6', // Soft cream background
      },
      fontFamily: {
        sans: ['"Space Grotesk"', 'sans-serif'],
      },
      boxShadow: {
        'neo': '6px 6px 0px 0px rgba(0,0,0,1)',
        'neo-sm': '3px 3px 0px 0px rgba(0,0,0,1)',
      }
    }
  },
  plugins: [],
}
