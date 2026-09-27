import path from "node:path";
import { transpileModule, type TranspileOptions } from "typescript";
import { defineConfig } from "vitest/config";

/**
 * The repo tsconfig uses `"jsx": "preserve"` (required by Next.js), which the
 * installed bundler-based test pipeline cannot parse as JSX. This pre-plugin
 * transpiles repo .tsx sources with the automatic JSX runtime before the test
 * transform runs. Test-only affordance: production builds are unaffected
 * (Next.js handles JSX itself).
 */
const tsxShim = {
  name: "test-tsx-shim",
  enforce: "pre" as const,
  transform(code: string, id: string) {
    const clean = id.split("?")[0];
    if (clean.endsWith(".tsx") && !clean.includes("node_modules")) {
      const options: TranspileOptions = {
        compilerOptions: {
          jsx: "react-jsx" as never,
          target: "es2020" as never,
          module: "esnext" as never,
          esModuleInterop: true,
        },
        fileName: clean,
      };
      return { code: transpileModule(code, options).outputText, map: null };
    }
    return undefined;
  },
};

export default defineConfig({
  plugins: [tsxShim],
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
    setupFiles: ["./vitest.setup.ts"],
    include: ["lib/**/*.test.ts", "lib/**/*.test.tsx", "database/**/*.test.ts"],
  },
});
