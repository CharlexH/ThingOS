import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    target: "chrome69"
  },
  test: {
    environment: "node"
  }
});
