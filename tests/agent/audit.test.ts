import { expect, test } from "bun:test";
import { createAgentAuditRecord, serializeAgentAuditRecord } from "../../src/agent/audit";

test("agent audit records preserve validation evidence and sort changed files", () => {
  const record = createAgentAuditRecord({
    specVersion: "add-brilliant-sort-core",
    scenario: "prism-01",
    changedFiles: ["src/core/reducer.ts", "src/app/App.tsx"],
    validations: [
      { command: "bun test tests/core", status: "passed", detail: "7 tests" },
      { command: "bun run typecheck", status: "passed", detail: "no diagnostics" },
    ],
    nextDecision: "Run browser replay",
    timestamp: "2026-07-15T00:00:00.000Z",
  });

  expect(record.changedFiles).toEqual(["src/app/App.tsx", "src/core/reducer.ts"]);
  expect(JSON.parse(serializeAgentAuditRecord(record))).toMatchObject({
    scenario: "prism-01",
    validations: [{ status: "passed" }, { status: "passed" }],
  });
});
