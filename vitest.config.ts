import { defineConfig } from "vitest/config";

// Config própria dos testes: o vite.config.ts do app carrega o preset do
// TanStack Start inteiro (nitro, SSR, devtools), que os testes não precisam.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
