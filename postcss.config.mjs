/** @type {import('postcss').ProcessOptions & { plugins: import('postcss').PluginCreator<any>[] }} */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
