const sharedPreset = require("@itemize-it/config/tailwind-preset");

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [sharedPreset],
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      // Web-specific extensions can go here
    },
  },
  plugins: [],
};
