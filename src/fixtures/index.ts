import prismLevelJson from "./prism-01.json";
import prismWinningTraceJson from "./traces/prism-01.win.json";
import type { GameCommand, LevelSpec } from "../core/types";

export const prismLevel = prismLevelJson as LevelSpec;
export const prismWinningTrace = prismWinningTraceJson as unknown as readonly GameCommand[];
