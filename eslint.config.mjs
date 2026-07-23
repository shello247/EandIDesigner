import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [
      ".next/**",
      "coverage/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**"
    ]
  },
  {
    files: [
      "src/features/drawing_canvas/ui/**/*.{ts,tsx}",
      "src/features/drawing_panel_reports/logic/**/*.ts",
      "src/features/drawing_panel_reports/ui/**/*.{ts,tsx}"
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/features/bom_creator/api/public",
              message:
                "Client-reachable drawing modules must import browser-safe BOM logic and types directly."
            }
          ]
        }
      ]
    }
  }
];

export default eslintConfig;
