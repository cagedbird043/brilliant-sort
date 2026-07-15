import { expect, test } from "bun:test";
import { createConstrainedAgentContext } from "../../src/agent/context";

test("agent context contains only sorted relevant baseline inputs", () => {
  const context = createConstrainedAgentContext({
    scenario: "prism-01",
    relevantSpecs: ["core-gameplay", "game-harness"],
    relevantFiles: ["src/core/reducer.ts", "src/core/selectors.ts"],
    requestedCapabilities: ["core-gameplay"],
  });

  expect(context).toEqual({
    status: "ready",
    scenario: "prism-01",
    relevantSpecs: ["core-gameplay", "game-harness"],
    relevantFiles: ["src/core/reducer.ts", "src/core/selectors.ts"],
  });
});

test("deferred capability requests stop before speculative implementation", () => {
  const context = createConstrainedAgentContext({
    scenario: "prism-01",
    relevantSpecs: ["core-gameplay"],
    relevantFiles: ["src/core/reducer.ts"],
    requestedCapabilities: ["power-up", "payment"],
  });

  expect(context.status).toBe("blocked");
  if (context.status === "blocked") {
    expect(context.deferredCapabilities).toEqual(["power-up", "payment"]);
  }
});
