import { readFileSync } from "node:fs";

const read = (file: string) => readFileSync(`${__dirname}/../${file}`, "utf8");
const CLA = "https://github.com/dotstories/cla/blob/main/dotstories_icla.md";

it("package, runner app and engine are AGPL-3.0-only", () => {
  expect(JSON.parse(read("package.json")).license).toBe("AGPL-3.0-only");
  expect(read("LICENSE")).toMatch(/^\s*GNU AFFERO GENERAL PUBLIC LICENSE/);
  expect(read("runner/app/src-tauri/Cargo.toml")).toMatch(/^license = "AGPL-3\.0-only"$/m);
  expect(read("runner/engine/pyproject.toml")).toMatch(/^license = "AGPL-3\.0-only"$/m);
});

it("README and CONTRIBUTING link the license and the CLA", () => {
  for (const f of ["README.md", "CONTRIBUTING.md"]) {
    expect(read(f)).toContain("(LICENSE)");
    expect(read(f)).toContain(CLA);
  }
});

it("README lists our promises", () => {
  expect(read("README.md")).toMatch(/## Our promises[\s\S]*Always open source[\s\S]*## License/);
});
