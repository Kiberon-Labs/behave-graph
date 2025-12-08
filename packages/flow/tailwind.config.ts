/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './example/index.html',
    './example/**/*.{js,ts,jsx,tsx,css}',
    './src/**/*.{js,ts,jsx,tsx,css}'
  ],
  theme: {
    extend: {}
  },
  plugins: [
    {
      tailwindcss: {}
    },
    {
      autoprefixer: {}
    }
  ]
};
