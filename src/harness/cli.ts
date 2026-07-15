import { canonicalDump } from "../core";
import { prismWinningTrace } from "../fixtures";
import { listScenarioNames, loadScenario } from "./scenario";
import { replayCommandLog } from "./replay";

const [operation = "list", scenarioName = "prism-01"] = Bun.argv.slice(2);

switch (operation) {
  case "list":
    console.log(listScenarioNames().join("\n"));
    break;
  case "dump": {
    const { initialState } = loadScenario(scenarioName);
    console.log(canonicalDump(initialState));
    break;
  }
  case "replay": {
    const { initialState } = loadScenario(scenarioName);
    if (scenarioName !== "prism-01") {
      throw new Error(`No committed replay trace for scenario: ${scenarioName}`);
    }
    const replay = replayCommandLog(initialState, prismWinningTrace);
    console.log(
      JSON.stringify(
        {
          scenario: scenarioName,
          commands: replay.transitions.length,
          status: replay.finalState.status,
          shelfSize: replay.finalState.shelf.gemIds.length,
          final: JSON.parse(replay.final),
        },
        null,
        2,
      ),
    );
    break;
  }
  default:
    throw new Error("Usage: bun run harness [list | dump <scenario> | replay <scenario>]");
}
