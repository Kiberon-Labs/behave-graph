export default {
  content: [
    './public/index.html',
    './src/**/*.{js,ts,jsx,tsx,css}',
    './node_modules/@kinforge/**/*.{astro,html,js,jsx,ts,tsx}',
    '../packages/flow/dist/**/*.{js,ts,jsx,tsx,css}'
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
