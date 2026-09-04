import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import { isAbsolute, relative, resolve, sep } from "node:path";

export function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function containsForbiddenEvidenceMaterial(value) {
  const text = JSON.stringify(value);
  const forbidden = [
    /service[_-]?role/i,
    /sb_secret_/i,
    /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\./,
    /VITE_SUPABASE_PUBLISHABLE_KEY/i,
    /SUPABASE_SERVICE_ROLE/i,
  ];
  return forbidden.some((pattern) => pattern.test(text));
}

export function resolveExternalEvidencePath(rawPath, repoRoot) {
  if (typeof rawPath !== "string" || !rawPath.trim()) {
    throw new Error("Evidence path is required.");
  }

  const root = resolve(repoRoot);
  const evidencePath = isAbsolute(rawPath)
    ? resolve(rawPath)
    : resolve(root, rawPath);

  const rel = relative(root, evidencePath);

  if (rel === "" || (!rel.startsWith(`..${sep}`) && rel !== "..")) {
    throw new Error("Evidence must remain outside the repository.");
  }

  return evidencePath;
}

function requiredString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing evidence field: ${label}`);
  }
  return value.trim();
}

export function verifyExternalProductionEvidence({
  rawPath,
  repoRoot,
  expectedSha256,
  expectedSchemaVersion,
  expectedGitCommitSha,
  expectedReleaseCandidate,
  allowedEnvironments,
}) {
  const evidencePath = resolveExternalEvidencePath(rawPath, repoRoot);

  if (!/^[0-9a-f]{64}$/i.test(String(expectedSha256 ?? ""))) {
    throw new Error("Expected evidence SHA-256 is invalid.");
  }

  const bytes = readFileSync(evidencePath);
  const actualSha256 = sha256(bytes);

  if (actualSha256 !== expectedSha256.toLowerCase()) {
    throw new Error("Evidence SHA-256 mismatch.");
  }

  const evidence = JSON.parse(bytes.toString("utf8"));

  if (containsForbiddenEvidenceMaterial(evidence)) {
    throw new Error("Evidence contains forbidden sensitive material.");
  }

  if (evidence.schemaVersion !== expectedSchemaVersion) {
    throw new Error("Evidence schema mismatch.");
  }

  if (requiredString(evidence.gitCommitSha, "gitCommitSha") !== expectedGitCommitSha) {
    throw new Error("Evidence Git commit mismatch.");
  }

  if (
    requiredString(evidence.releaseCandidate, "releaseCandidate") !==
    expectedReleaseCandidate
  ) {
    throw new Error("Evidence Release Candidate mismatch.");
  }

  const environment = requiredString(evidence.environment, "environment").toUpperCase();

  if (
    !Array.isArray(allowedEnvironments) ||
    !allowedEnvironments.map((value) => String(value).toUpperCase()).includes(environment)
  ) {
    throw new Error("Evidence environment is not allowed.");
  }

  if (String(evidence.result ?? "").toUpperCase() !== "PASS") {
    throw new Error("Evidence result is not PASS.");
  }

  requiredString(evidence.generatedAt, "generatedAt");
  requiredString(evidence.verifiedAt, "verifiedAt");

  if (evidence.productionTouched !== false) {
    throw new Error("Evidence indicates production was touched.");
  }

  const safety = evidence.safety ?? {};
  if (safety.deploymentPerformed !== false) {
    throw new Error("Evidence indicates deployment was performed.");
  }
  if (safety.databaseMutationPerformed !== false) {
    throw new Error("Evidence indicates database mutation was performed.");
  }
  if (safety.secretsStored !== false) {
    throw new Error("Evidence indicates secrets were stored.");
  }

  return {
    evidence,
    evidencePath,
    sha256: actualSha256,
  };
}

function selfTest() {
  const repoRoot = resolve(process.cwd());
  const temp = mkdtempSync(resolve(os.tmpdir(), "lihen-pr-evidence-"));
  const evidencePath = resolve(temp, "evidence.json");

  const base = {
    schemaVersion: "LIHEN_TEST_EVIDENCE_V1",
    generatedAt: "2026-09-04T00:00:00.000Z",
    verifiedAt: "2026-09-04T00:01:00.000Z",
    environment: "STAGING",
    releaseCandidate: "LIHEN-RC-TEST",
    gitCommitSha: "abc123",
    result: "PASS",
    productionTouched: false,
    evidence: {},
    limitations: [],
    safety: {
      deploymentPerformed: false,
      databaseMutationPerformed: false,
      secretsStored: false,
    },
  };

  const write = (value) => {
    const text = `${JSON.stringify(value, null, 2)}\n`;
    writeFileSync(evidencePath, text, "utf8");
    return sha256(Buffer.from(text, "utf8"));
  };

  const verify = (value) => {
    const hash = write(value);
    return verifyExternalProductionEvidence({
      rawPath: evidencePath,
      repoRoot,
      expectedSha256: hash,
      expectedSchemaVersion: "LIHEN_TEST_EVIDENCE_V1",
      expectedGitCommitSha: "abc123",
      expectedReleaseCandidate: "LIHEN-RC-TEST",
      allowedEnvironments: ["DEV", "STAGING"],
    });
  };

  verify(base);

  const failures = [
    [{ ...base, result: "FAIL" }, "result"],
    [{ ...base, productionTouched: true }, "production"],
    [{ ...base, gitCommitSha: "wrong" }, "commit"],
    [{ ...base, environment: "PRODUCTION" }, "environment"],
    [{ ...base, evidence: { token: "sb_secret_forbidden" } }, "sensitive"],
  ];

  for (const [value, label] of failures) {
    let blocked = false;
    try {
      verify(value);
    } catch {
      blocked = true;
    }
    if (!blocked) throw new Error(`Self-test failed to block ${label}.`);
  }

  {
    const hash = write(base);
    let blocked = false;
    try {
      verifyExternalProductionEvidence({
        rawPath: evidencePath,
        repoRoot,
        expectedSha256: "0".repeat(64),
        expectedSchemaVersion: "LIHEN_TEST_EVIDENCE_V1",
        expectedGitCommitSha: "abc123",
        expectedReleaseCandidate: "LIHEN-RC-TEST",
        allowedEnvironments: ["DEV", "STAGING"],
      });
    } catch {
      blocked = true;
    }
    if (!blocked || hash === "0".repeat(64)) {
      throw new Error("Self-test failed to block SHA-256 mismatch.");
    }
  }

  {
    const insideRepoPath = resolve(repoRoot, "tooling/production-readiness-evidence.mjs");
    let blocked = false;
    try {
      verifyExternalProductionEvidence({
        rawPath: insideRepoPath,
        repoRoot,
        expectedSha256: sha256(readFileSync(insideRepoPath)),
        expectedSchemaVersion: "LIHEN_TEST_EVIDENCE_V1",
        expectedGitCommitSha: "abc123",
        expectedReleaseCandidate: "LIHEN-RC-TEST",
        allowedEnvironments: ["DEV", "STAGING"],
      });
    } catch {
      blocked = true;
    }
    if (!blocked) {
      throw new Error("Self-test failed to block evidence inside repository.");
    }
  }

  rmSync(temp, { recursive: true, force: true });
  console.log("LIHEN external production evidence primitive self-test: 8/8 PASS");
}

if (process.argv.includes("--self-test")) {
  selfTest();
}
