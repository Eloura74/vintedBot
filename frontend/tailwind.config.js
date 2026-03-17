/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        vinted: {
          dark: '#0f172a',
          accent: '#007782',
          glow: '#00f2ff'
        }
      }
    },
  },
  plugins: [],
}
