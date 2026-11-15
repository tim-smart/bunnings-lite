import * as path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    dedupe: ["effect"],
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
})
