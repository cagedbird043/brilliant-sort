export type ValidationStatus = "passed" | "failed" | "blocked";

export interface ValidationRecord {
  readonly command: string;
  readonly status: ValidationStatus;
  readonly detail: string;
}

export interface AgentAuditInput {
  readonly specVersion: string;
  readonly scenario: string;
  readonly changedFiles: readonly string[];
  readonly validations: readonly ValidationRecord[];
  readonly nextDecision: string;
  readonly timestamp: string;
}

export interface AgentAuditRecord extends AgentAuditInput {
  readonly changedFiles: readonly string[];
  readonly validations: readonly ValidationRecord[];
}

export function createAgentAuditRecord(input: AgentAuditInput): AgentAuditRecord {
  return {
    ...input,
    changedFiles: [...input.changedFiles].sort(),
    validations: input.validations.map((validation) => ({ ...validation })),
  };
}

export function serializeAgentAuditRecord(record: AgentAuditRecord): string {
  return JSON.stringify(
    {
      specVersion: record.specVersion,
      scenario: record.scenario,
      changedFiles: [...record.changedFiles].sort(),
      validations: record.validations,
      nextDecision: record.nextDecision,
      timestamp: record.timestamp,
    },
    null,
    2,
  );
}
