/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ide: {
          darkBg: '#1e1e1e',
          darkSidebar: '#252526',
          darkActivity: '#333333',
          darkTab: '#2d2d2d',
          darkActiveTab: '#1e1e1e',
          darkBorder: '#3c3c3c',
          darkText: '#cccccc',
          darkHeader: '#181818',
        }
      }
    },
  },
  plugins: [],
}
