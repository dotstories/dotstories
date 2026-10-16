import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import CodeOfConduct from "../app/code-of-conduct/page";

const read = (file: string) => readFileSync(`${__dirname}/../${file}`, "utf8");
/** Markdown bullets as plain text: "- [Terms](url)." -> "Terms." */
const bullets = (md: string) =>
  md
    .split("\n")
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"));

it("CODE_OF_CONDUCT.md says the same as the site's Code of Conduct", () => {
  render(<CodeOfConduct />);
  const site = screen.getAllByRole("listitem").map((li) => li.textContent);
  expect(bullets(read("CODE_OF_CONDUCT.md"))).toEqual(site);
});

it("README links the community files and has no private plan", () => {
  const readme = read("README.md");
  for (const f of ["CONTRIBUTING.md", "CODE_OF_CONDUCT.md", "SECURITY.md", "LICENSE"]) expect(readme).toContain(`(${f})`);
  expect(readme).not.toMatch(/PLAN\.md/);
});

it("SECURITY.md sends reports to private vulnerability reporting", () => {
  expect(read("SECURITY.md")).toContain("https://github.com/dotstories/dotstories/security/advisories/new");
});

it("no file links the old repository (it moved to the dotstories org)", () => {
  const files = execSync("git ls-files", { cwd: `${__dirname}/..`, encoding: "utf8" })
    .split("\n")
    .filter((f) => f && f !== "__tests__/repo-docs.test.tsx" && !/\.(png|jpe?g|ico|flac|woff2?|ttf)$/.test(f));
  const old = files.filter((f) => /github\.com\/(repos\/)?Dayonel\/dotstories\b/i.test(read(f)));
  expect(old).toEqual([]);
});
