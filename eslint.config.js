import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // docs/legado-maxgames: codigo do Max Games guardado como referencia para as
  // fases 3 e 8 (TIME_11 §0.4). Vai ser portado para TypeScript em
  // src/lib/importacao/ e src/lib/jogos/ — nao e codigo deste projeto.
  {
    ignores: [
      "dist",
      ".netlify",
      ".output",
      ".vinxi",
      "docs/legado-maxgames",
      ".specify",
      "supabase/functions",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Variavel lida dentro de um closure antes de ser atribuida (handle de
      // setTimeout usado por um clearTimeout declarado acima) nao pode virar
      // const sem reordenar o codigo.
      "prefer-const": ["error", { ignoreReadBeforeAssign: true }],
    },
  },
  eslintPluginPrettier,
);
