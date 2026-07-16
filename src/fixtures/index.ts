import prismLevelJson from "./prism-01.json";
import prismWinningTraceJson from "./traces/prism-01.win.json";
import tuxLevelJson from "./tux-01.json";
import tuxWinningTraceJson from "./traces/tux-01.win.json";
import type { GameCommand, LevelSpec } from "../core/types";

export const prismLevel = prismLevelJson as LevelSpec;
export const prismWinningTrace = prismWinningTraceJson as unknown as readonly GameCommand[];

export const tuxLevel = tuxLevelJson as LevelSpec;
export const tuxWinningTrace = tuxWinningTraceJson as unknown as readonly GameCommand[];
