import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"
import { NodeGlobalsPolyfillPlugin } from "@esbuild-plugins/node-globals-polyfill"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {},
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
      plugins: [NodeGlobalsPolyfillPlugin({ buffer: true, process: true })],
    },
  },
  define: {
    "process.env": JSON.stringify(process.env),
  },
})
