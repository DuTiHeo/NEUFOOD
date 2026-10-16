/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: '#003f87',
        'brand-dark': '#002b5e',
        'brand-light': '#0056b3',
      },
    },
  },
  plugins: [],
}
