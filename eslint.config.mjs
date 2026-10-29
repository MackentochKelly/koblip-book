import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"
import importPlugin from "eslint-plugin-import"

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      import: importPlugin,
    },
    rules: {
      // One icon set: every icon comes from components/ui/icons.tsx.
      "no-restricted-imports": [
        "error",
        {
          paths: ["lucide-react", "@mynaui/icons-react"].map((name) => ({
            name,
            message: "Import icons from '@/components/ui/icons'.",
          })),
        },
      ],
      // Each new feature adds its own zone:
      // { target: "./features/<name>", from: "./features", except: ["./<name>"] }
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            // features/ cannot import from app/
            { target: "./features", from: "./app" },
            // features never import each other
            {
              target: "./features/business-page",
              from: "./features",
              except: ["./business-page"],
            },
            {
              target: "./features/place-import",
              from: "./features",
              except: ["./place-import"],
            },
            {
              target: "./features/booking",
              from: "./features",
              except: ["./booking"],
            },
            {
              target: "./features/dashboard",
              from: "./features",
              except: ["./dashboard"],
            },
            {
              target: "./features/owner-auth",
              from: "./features",
              except: ["./owner-auth"],
            },
            {
              target: "./features/assistant",
              from: "./features",
              except: ["./assistant"],
            },
            // onboarding imports the place importer, the business page
            // reader and the login form.
            {
              target: "./features/onboarding",
              from: "./features",
              except: [
                "./onboarding",
                "./place-import",
                "./business-page",
                "./owner-auth",
              ],
            },
            // shared code cannot import from features/ or app/
            { target: "./components", from: "./features" },
            { target: "./components", from: "./app" },
            { target: "./hooks", from: "./features" },
            { target: "./hooks", from: "./app" },
            { target: "./lib", from: "./features" },
            { target: "./lib", from: "./app" },
            { target: "./types", from: "./features" },
            { target: "./types", from: "./app" },
          ],
        },
      ],
    },
  },
  // The icon file is the one place the icon packages are imported.
  {
    files: ["components/ui/icons.tsx"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  // components/ui and hooks/use-mobile.ts are shadcn's code, kept as the
  // CLI writes it.
  {
    files: ["components/ui/**", "hooks/use-mobile.ts"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // ElevenLabs UI's Orb (https://ui.elevenlabs.io/docs/components/orb), kept
  // as its registry writes it: a three.js render loop that reads refs and
  // mutates shader uniforms by design.
  {
    files: ["components/ui/orb.tsx"],
    rules: {
      "react-hooks/immutability": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
])

export default eslintConfig
