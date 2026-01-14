/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "var(--color-primary, #e63946)",
        "background-light": "#fdf8f4",
        "background-dark": "#1a0f0a",
        "accent-orange": "#fb8500",
      },
      fontFamily: {
        display: ["'DM Serif Display'", "serif"],
        sans: ["'Inter'", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.5rem",
      },
    },
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/typography")],
};
