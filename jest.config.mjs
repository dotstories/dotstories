import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

// Packages Jest must compile too: ESM-only ones (pulled in by Carbon), and the web engine (TypeScript source).
// pnpm keeps a package at node_modules/.pnpm/<name with / as +>@<version>/.
const ESM_ONLY = ["temporal-", "@dotstories/web-engine", "@dotstories\\+web-engine"];

export default async function config() {
  const base = await createJestConfig({
    testEnvironment: "jsdom",
    setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
    testPathIgnorePatterns: ["<rootDir>/e2e/", "<rootDir>/.open-next/", "<rootDir>/blog/", "<rootDir>/scripts/"], // blog + scripts: node --test
    // SWC rewrites "@/" in imports, not in jest.mock("@/..."): map it for Jest too.
    moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
  })();
  return {
    ...base,
    transformIgnorePatterns: [
      `/node_modules/(?!(\\.pnpm/)?(${ESM_ONLY.join("|")}))`,
      ...base.transformIgnorePatterns.filter((p) => !p.includes("node_modules")),
    ],
  };
}
