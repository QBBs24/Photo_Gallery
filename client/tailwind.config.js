/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        flickr: {
          blue: '#0063dc',
          pink: '#ff0084',
          dark: '#121212',
          backdrop: '#080808',
        }
      }
    },
  },
  plugins: [],
}
