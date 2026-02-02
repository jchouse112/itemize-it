/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  presets: [
    require("nativewind/preset"),
    require("@itemize-it/config/tailwind-preset"),
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
