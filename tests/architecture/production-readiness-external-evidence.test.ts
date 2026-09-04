import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("GAP-044 external production-readiness evidence primitive", () => {
  it("fails closed on unsafe or unverifiable external evidence", () => {
    const repoRoot = resolve(process.cwd());
    const output = execFileSync(
      process.execPath,
      [
        resolve(repoRoot, "tooling/production-readiness-evidence.mjs"),
        "--self-test",
      ],
      {
        cwd: repoRoot,
        encoding: "utf8",
        env: process.env,
      },
    );

    expect(output).toContain(
      "LIHEN external production evidence primitive self-test: 8/8 PASS",
    );
  });
});
