import assert from "node:assert/strict";
import { test } from "node:test";
import { privateFiles, privateText } from "./check-private.mjs";

test("private files are flagged", () => {
  assert.deepEqual(
    privateFiles(["PLAN.md", "docs/hardware.md", "claude/handoff.md", "notes.private.md", "app/page.tsx", "docs/claude.md"]),
    ["PLAN.md", "claude/handoff.md", "notes.private.md"],
  );
});

test("plan files are flagged in any case and folder", () => {
  assert.deepEqual(privateFiles(["plan.md", "runner/PLAN.md", "docs/planning.md"]), ["plan.md", "runner/PLAN.md"]);
});

test("session lines and links are flagged in text", () => {
  assert.equal(privateText("feat: add x\n\nCo-Authored-By: Claude <noreply@anthropic.com>"), false);
  assert.equal(privateText("feat: add x\n\nClaude-Session: abc"), true);
  assert.equal(privateText("see https://claude.ai/code/session_01ABC"), true);
});
