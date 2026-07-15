export const DEFERRED_CAPABILITIES = [
  "payment",
  "purchase",
  "power-up",
  "random-mode",
  "random-generation",
  "live-ops",
] as const;

export type DeferredCapability = (typeof DEFERRED_CAPABILITIES)[number];

export interface AgentChangeRequest {
  readonly scenario: string;
  readonly relevantSpecs: readonly string[];
  readonly relevantFiles: readonly string[];
  readonly requestedCapabilities: readonly string[];
}

export type AgentContextResult =
  | {
      readonly status: "ready";
      readonly scenario: string;
      readonly relevantSpecs: readonly string[];
      readonly relevantFiles: readonly string[];
    }
  | {
      readonly status: "blocked";
      readonly reason: string;
      readonly deferredCapabilities: readonly DeferredCapability[];
    };

export function createConstrainedAgentContext(request: AgentChangeRequest): AgentContextResult {
  const deferredCapabilities = request.requestedCapabilities.filter(
    (capability): capability is DeferredCapability =>
      DEFERRED_CAPABILITIES.includes(capability as DeferredCapability),
  );

  if (deferredCapabilities.length > 0) {
    return {
      status: "blocked",
      reason: "The request requires behavior intentionally deferred by the approved baseline.",
      deferredCapabilities,
    };
  }

  return {
    status: "ready",
    scenario: request.scenario,
    relevantSpecs: [...request.relevantSpecs].sort(),
    relevantFiles: [...request.relevantFiles].sort(),
  };
}
