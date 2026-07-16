import { canonicalDump } from "../core";
import { prismLevel, prismWinningTrace, tuxLevel, tuxWinningTrace } from "../fixtures";
import { GameCoreFactory } from "../wasm/game-core";
import { replayDifferential } from "./differential";
import { replayCommandLog } from "./replay";
import { listScenarioNames, loadScenario } from "./scenario";

const [operation = "list", scenarioName = "prism-01"] = Bun.argv.slice(2);
const replayFixture =
  scenarioName === prismLevel.id
    ? { level: prismLevel, commands: prismWinningTrace }
    : scenarioName === tuxLevel.id
      ? { level: tuxLevel, commands: tuxWinningTrace }
      : null;

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
    if (replayFixture === null) {
      throw new Error(`No committed replay trace for scenario: ${scenarioName}`);
    }
    const core = await GameCoreFactory.load(replayFixture.level);
    try {
      const replay = replayCommandLog(core, replayFixture.commands);
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
    } finally {
      core.destroy();
    }
    break;
  }
  case "differential": {
    if (replayFixture === null) {
      throw new Error(`No committed differential trace for scenario: ${scenarioName}`);
    }
    const replay = await replayDifferential({
      name: scenarioName,
      level: replayFixture.level,
      commands: replayFixture.commands,
    });
    console.log(
      JSON.stringify(
        {
          scenario: replay.scenario,
          commands: replay.commandCount,
          final: JSON.parse(replay.final),
        },
        null,
        2,
      ),
    );
    break;
  }
  default:
    throw new Error("Usage: bun run harness [list | dump <scenario> | replay <scenario> | differential <scenario>]");
}
