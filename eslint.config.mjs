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
      // An open db.transaction() keeps the write lock while other code runs,
      // so every other save at that moment fails (see lib/db/save-all.ts).
      "no-restricted-properties": [
        "error",
        {
          object: "db",
          property: "transaction",
          message:
            "Use saveAll from '@/lib/db/save-all'; to check and then save, wrap it in runInTurn from '@/lib/run-in-turn'.",
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
            {
              target: "./features/legal",
              from: "./features",
              except: ["./legal"],
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
            // demo builds its copies with the booking feature's time-zone
            // helpers.
            {
              target: "./features/demo",
              from: "./features",
              except: ["./demo", "./booking"],
            },
            {
              target: "./features/admin",
              from: "./features",
              except: ["./admin"],
            },
            {
              target: "./features/billing",
              from: "./features",
              except: ["./billing"],
            },
            {
              target: "./features/notifications",
              from: "./features",
              except: ["./notifications"],
            },
            {
              target: "./features/team-calendar",
              from: "./features",
              except: ["./team-calendar"],
            },
            {
              target: "./features/starter-catalog",
              from: "./features",
              except: ["./starter-catalog"],
            },
            {
              target: "./features/team-area",
              from: "./features",
              except: ["./team-area"],
            },
            {
              target: "./features/customer-account",
              from: "./features",
              except: ["./customer-account"],
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
  // ElevenLabs UI's Orb, kept as their registry writes it: React Three Fiber
  // changes three.js objects in place every frame, by design
  // (https://r3f.docs.pmnd.rs/advanced/pitfalls), which these rules forbid.
  {
    files: ["components/ui/orb.tsx"],
    rules: {
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/immutability": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local agent worktrees: other copies of the app, linted in their own.
    ".claude/**",
  ]),
])

export default eslintConfig
