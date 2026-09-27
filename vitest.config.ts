import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // server-only throws outside React Server Components; in tests use the
      // empty marker so server modules import cleanly under Node.
      "server-only": path.resolve(__dirname, "node_modules/server-only/empty.js"),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "database/**/*.test.ts"],
  },
});
