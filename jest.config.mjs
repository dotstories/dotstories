import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

// Packages that ship ESM only (pulled in by Carbon): compile them for Jest too.
const ESM_ONLY = ["temporal-polyfill"];

export default async function config() {
  const base = await createJestConfig({
    testEnvironment: "jsdom",
    setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
    testPathIgnorePatterns: ["<rootDir>/e2e/", "<rootDir>/.open-next/"],
  })();
  return {
    ...base,
    transformIgnorePatterns: [
      `/node_modules/(?!(\\.pnpm/)?(${ESM_ONLY.join("|")}))`,
      ...base.transformIgnorePatterns.filter((p) => !p.includes("node_modules")),
    ],
  };
}
