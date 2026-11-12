import { defineConfig } from "vite";
import { offlinePlugin } from "./offline-plugin.js";

export default defineConfig({
  plugins: [offlinePlugin()],
  define: {
    global: "globalThis",
    "import.meta.env.VITE_BUILD_ID": JSON.stringify(Date.now().toString(36)),
  },
  resolve: { alias: { events: "events/" } },
  build: {
    rolldownOptions: {
      onwarn(warning, defaultHandler) {
        // This app renders entirely in the browser; React Server Component
        // boundaries in React Router do not need to survive bundling.
        if (
          warning.code === "MODULE_LEVEL_DIRECTIVE" &&
          warning.message.includes('"use client"') &&
          /node_modules[/\\]react-router[/\\]/.test(warning.id ?? warning.message)
        ) {
          return;
        }
        defaultHandler(warning);
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/setupTests.js",
    include: ["src/**/*.test.{js,jsx}"],
  },
});
