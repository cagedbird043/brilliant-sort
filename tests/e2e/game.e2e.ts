import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { GameCommand } from "../../src/core";
const tuxWinningTrace = JSON.parse(
  readFileSync(new URL("../../src/fixtures/traces/tux-01.win.json", import.meta.url), "utf8"),
) as readonly GameCommand[];
const chromeWinningTrace = JSON.parse(
  readFileSync(new URL("../../src/fixtures/traces/chrome-01.win.json", import.meta.url), "utf8"),
) as readonly GameCommand[];

async function clickCommand(page: Page, command: GameCommand): Promise<void> {
  switch (command.type) {
    case "select-board-gem":
    case "place-selection-at-target":
      await page.getByTestId(`board-cell-${command.coord.row}-${command.coord.col}`).click();
      break;
    case "select-shelf-gem":
      await page.getByTestId(`shelf-slot-${command.index}`).click();
      break;
    case "place-selection-in-shelf":
      await page.getByTestId("shelf-slot-0").click();
      break;
    case "apply-global-wand":
      await page.getByTestId("global-wand").click();
      break;
    case "cancel-selection":
    case "restart-level":
      throw new Error(`A winning browser trace does not use ${command.type}`);
  }
}

type VictoryActionTestId = "next-level" | "replay-level";

async function waitForSettledVictory(page: Page, actionTestId: VictoryActionTestId) {
  await expect(page.locator(".crystal-workbench")).toHaveClass(/is-won/);
  await expect(page.locator(".gem-flight-clone")).toHaveCount(0, { timeout: 2_000 });
  await expect(page.locator('[data-motion-destination="hidden"]')).toHaveCount(0);
  await expect(page.getByTestId("victory-finale")).toHaveCount(0, { timeout: 2_000 });
  const action = page.getByTestId(actionTestId);
  await expect(action).toBeVisible();
  return action;
}

async function advanceFromSettledTux(page: Page): Promise<void> {
  const nextLevel = await waitForSettledVictory(page, "next-level");
  await nextLevel.click();
  await expect(page.locator(".workbench-shell")).toHaveAttribute("data-level-id", "chrome-01");
}

async function readFlightSnapshot(page: Page) {
  return page.evaluate(() => {
    const clones = [...document.querySelectorAll<HTMLElement>(".gem-flight-clone")];
    const flightIds = clones.map((clone) => clone.dataset.flightGemId ?? "");
    const scales: number[] = [];
    const durations: number[] = [];
    const keyframeCounts: number[] = [];
    let curvedMidpoints = 0;
    let maxAlignmentError = 0;
    for (const clone of clones) {
      const gemId = clone.dataset.flightGemId;
      const destination = gemId
        ? document.querySelector<HTMLElement>(`[data-gem-id="${CSS.escape(gemId)}"]`)
        : null;
      const effect = clone.getAnimations()[0]?.effect as KeyframeEffect | null;
      const frames = effect?.getKeyframes() ?? [];
      const finalMatrix = new DOMMatrix(String(frames.at(-1)?.transform ?? "none"));
      const midpointMatrix = new DOMMatrix(String(frames.at(1)?.transform ?? "none"));
      const destinationRect = destination?.getBoundingClientRect();
      const sourceWidth = Number.parseFloat(clone.style.width);
      const sourceHeight = Number.parseFloat(clone.style.height);
      scales.push(finalMatrix.a, finalMatrix.d);
      durations.push(Number(effect?.getTiming().duration ?? 0));
      keyframeCounts.push(frames.length);
      if (
        frames.length === 3 &&
        (Math.abs(midpointMatrix.e - finalMatrix.e * 0.54) > 0.5 ||
          Math.abs(midpointMatrix.f - finalMatrix.f * 0.54) > 0.5)
      ) {
        curvedMidpoints += 1;
      }
      const alignmentErrors = destinationRect
        ? [
            Math.abs(Number.parseFloat(clone.style.left) + finalMatrix.e - destinationRect.left),
            Math.abs(Number.parseFloat(clone.style.top) + finalMatrix.f - destinationRect.top),
            Math.abs(sourceWidth * finalMatrix.a - destinationRect.width),
            Math.abs(sourceHeight * finalMatrix.d - destinationRect.height),
          ]
        : [Number.POSITIVE_INFINITY];
      maxAlignmentError = Math.max(maxAlignmentError, ...alignmentErrors);
    }
    const aligned = maxAlignmentError <= 1;
    const waveDelays = clones.map((clone) => Number(clone.dataset.waveDelay ?? 0));
    return {
      count: clones.length,
      unique: new Set(flightIds).size,
      aligned,
      maxAlignmentError,
      opaque: clones.every(
        (clone) =>
          getComputedStyle(clone).opacity === "1" &&
          ((clone.getAnimations()[0]?.effect as KeyframeEffect | null)?.getKeyframes() ?? [])
            .every((frame) => frame.opacity === undefined),
      ),
      avoidsPageOrigin: clones.every(
        (clone) => Number.parseFloat(clone.style.left) > 0 && Number.parseFloat(clone.style.top) > 0,
      ),
      hiddenDestinations: document.querySelectorAll('[data-motion-destination="hidden"]').length,
      flightKinds: [...new Set(clones.map((clone) => clone.dataset.flightKind))],
      familyTransitions: [
        ...new Set(
          clones.map(
            (clone) =>
              `${clone.dataset.flightSourceFamily}->${clone.dataset.flightDestinationFamily}`,
          ),
        ),
      ],
      lodLayerCounts: [...new Set(clones.map((clone) => clone.querySelectorAll(".gem-flight-layer").length))],
      durationValues: [...new Set(durations)],
      keyframeCounts: [...new Set(keyframeCounts)],
      curvedMidpoints,
      minWaveDelay: Math.min(...waveDelays),
      maxWaveDelay: Math.max(...waveDelays),
      waveDelayVariants: new Set(waveDelays).size,
      minScale: Math.min(...scales),
      maxScale: Math.max(...scales),
    };
  });
}

test("a player can complete the committed Tux level in the browser", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".game-board")).toBeVisible();
  await expect(page.locator(".board-cell")).toHaveCount(546);

  for (const command of tuxWinningTrace) {
    await clickCommand(page, command);
  }

  const stage = page.locator(".crystal-workbench");
  await expect(stage).toHaveClass(/is-won/);
  await expect(page.locator(".activity-announcer")).toHaveText("所有宝石都已归位。");
  await expect(page.locator(".shelf-slot.has-gem")).toHaveCount(0);
  await expect(page.locator(".board-cell:not(:disabled)")).toHaveCount(0);
  await expect(page.getByTestId("victory-finale")).toHaveCount(1);
  await expect(page.locator(".victory-arc path")).toHaveCount(1);
  await expect(page.locator(".pixel-firework")).toHaveCount(3);
  await expect(page.locator(".pixel-firework-spark")).toHaveCount(24);
  await expect(page.getByTestId("replay-level")).toHaveCount(0);
  const nextLevel = await waitForSettledVictory(page, "next-level");
  await expect(nextLevel).toHaveAttribute("aria-label", "进入下一关");
});

test("Tux advances to Chrome in the same document and Chrome replays canonically", async ({ page }) => {
  await page.goto("/");
  const initialDocument = await page.evaluate(() => ({
    href: window.location.href,
    timeOrigin: performance.timeOrigin,
  }));

  await page.getByTestId("global-wand").click();
  const nextLevel = await waitForSettledVictory(page, "next-level");
  await nextLevel.focus();
  await nextLevel.press("Enter");

  const shell = page.locator(".workbench-shell");
  await expect(shell).toHaveAttribute("data-level-id", "chrome-01");
  await expect.poll(() =>
    page.evaluate(() => ({
      href: window.location.href,
      timeOrigin: performance.timeOrigin,
    })),
  ).toEqual(initialDocument);
  await expect(page.locator(".calibration-bay")).toHaveAttribute("aria-label", "Chrome 宝石棋盘");
  await expect(page.locator(".board-cell")).toHaveCount(562);
  await expect(page.locator(".board-cell.target-coral")).toHaveCount(154);
  await expect(page.locator(".board-cell.target-amber")).toHaveCount(154);
  await expect(page.locator(".board-cell.target-jade")).toHaveCount(158);
  await expect(page.locator(".board-cell.target-navy")).toHaveCount(96);
  await expect(page.locator(".shelf-slot.has-gem")).toHaveCount(0);
  await expect(page.locator(".board-cell.is-selected, .shelf-slot.is-selected")).toHaveCount(0);

  expect(chromeWinningTrace.map((command) => command.type)).toEqual([
    "select-board-gem",
    "place-selection-in-shelf",
    "apply-global-wand",
  ]);
  for (const command of chromeWinningTrace) {
    await clickCommand(page, command);
  }

  const replay = await waitForSettledVictory(page, "replay-level");
  await expect(replay).toHaveAttribute("aria-label", "重新玩这一关");
  await replay.focus();
  await replay.press("Enter");
  await expect(shell).toHaveAttribute("data-level-id", "chrome-01");
  await expect(page.locator(".crystal-workbench")).not.toHaveClass(/is-won/);
  await expect(page.locator(".board-cell")).toHaveCount(562);
  await expect(page.locator(".board-cell.is-empty")).toHaveCount(0);
  await expect(page.locator(".board-cell:not(:disabled)")).toHaveCount(140);
  await expect(page.locator(".shelf-slot.has-gem")).toHaveCount(0);
  await expect(page.locator(".board-cell.is-selected, .shelf-slot.is-selected")).toHaveCount(0);
  await expect(replay).toHaveCount(0);
  await expect(page.getByTestId("global-wand")).toBeVisible();
});

test("the victory shimmer crosses the completed pixel art", async ({ page }) => {
  await page.goto("/");
  const camera = page.locator(".board-camera");
  await expect(camera).toBeVisible();

  await page.getByTestId("global-wand").click();
  await expect(page.locator(".crystal-workbench")).toHaveClass(/is-won/);

  const shimmer = await camera.evaluate((element) => {
    const animation = element
      .getAnimations({ subtree: true })
      .find(
        (candidate) =>
          (candidate as Animation & { readonly animationName?: string }).animationName ===
          "mosaic-victory-shimmer",
      );
    if (!animation || !(animation.effect instanceof KeyframeEffect)) {
      return null;
    }

    animation.pause();
    animation.currentTime = 570;
    const style = getComputedStyle(element, "::after");
    return {
      animationName: (animation as Animation & { readonly animationName: string }).animationName,
      currentTime: Number(animation.currentTime),
      playState: animation.playState,
      progress: animation.effect.getComputedTiming().progress,
      opacity: Number(style.opacity),
      backgroundImage: style.backgroundImage,
      mixBlendMode: style.mixBlendMode,
    };
  });

  expect(shimmer).toMatchObject({
    animationName: "mosaic-victory-shimmer",
    currentTime: 570,
    playState: "paused",
    opacity: 1,
    mixBlendMode: "screen",
  });
  expect(shimmer?.progress).toBeCloseTo(0.5, 5);
  expect(shimmer?.backgroundImage).toContain("linear-gradient");

  await expect(page.locator(".gem-flight-clone")).toHaveCount(0, { timeout: 2_000 });
  await expect(page.getByTestId("victory-finale")).toHaveCount(0, { timeout: 2_000 });
  await expect(camera).toHaveScreenshot("victory-shimmer.png", {
    animations: "allow",
    caret: "hide",
    maxDiffPixelRatio: 0.002,
    scale: "css",
  });
});

test("solved Chrome uses the existing gem renderer", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("global-wand").click();
  await advanceFromSettledTux(page);
  await page.getByTestId("global-wand").click();
  await waitForSettledVictory(page, "replay-level");

  await expect(page.locator(".board-camera")).toHaveScreenshot("chrome-solved.png", {
    animations: "disabled",
    caret: "hide",
    maxDiffPixelRatio: 0.002,
    scale: "css",
  });
});

test("the playable surface stays wordless while the mute crystal remains external and accessible", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".game-board")).toBeVisible();

  const surface = await page.evaluate(() => {
    const workbench = document.querySelector(".crystal-workbench");
    const audioControl = document.querySelector(".audio-crystal-control");
    const wandControl = document.querySelector(".global-wand-control");
    const clone = workbench?.cloneNode(true) as HTMLElement | undefined;
    clone?.querySelector(".activity-announcer")?.remove();
    return {
      visibleCopy: clone?.textContent?.trim() ?? "",
      auxiliaryControls:
        workbench?.querySelectorAll("button:not(.board-cell):not(.shelf-slot)").length ?? 0,
      audioOutsideStage: Boolean(audioControl && workbench && !workbench.contains(audioControl)),
      wandOutsideStage: Boolean(wandControl && workbench && !workbench.contains(wandControl)),
    };
  });

  expect(surface).toEqual({
    visibleCopy: "",
    auxiliaryControls: 0,
    audioOutsideStage: true,
    wandOutsideStage: true,
  });
  await expect(page.locator(".audio-crystal-control")).toHaveAttribute(
    "aria-label",
    "静音像素音乐",
  );
  await expect(page.locator(".audio-crystal-control")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("global-wand")).toHaveAttribute("aria-label", "一键完成关卡");
  await expect(page.getByTestId("replay-level")).toHaveCount(0);
  await expect(page.locator(".shelf-bank.bank-a")).toHaveAttribute("aria-label", "缓冲 Shelf A");
  await expect(page.locator(".shelf-bank.bank-b")).toHaveAttribute("aria-label", "缓冲 Shelf B");
});
test("onboarding persists through Tux→Chrome and Chrome replay after an accepted keyboard wand", async ({
  page,
}) => {
  const copy = "点击同色宝石，经缓冲槽放回同色空位；也可以点魔法棒一键修复整幅 Tux。";
  await page.goto("/");
  const hint = page.getByRole("note");
  await expect(hint).toHaveText(copy);

  await page.getByTestId("shelf-slot-0").click();
  await expect(hint).toHaveText(copy);
  expect(await page.evaluate(() => localStorage.getItem("brilliant-sort:onboarding:v1"))).toBeNull();
  await page.reload();
  await expect(hint).toHaveText(copy);
  const audioControl = page.locator(".audio-crystal-control");
  await expect(audioControl).toHaveAttribute("data-audio-status", "ready");
  await audioControl.click();
  await expect(audioControl).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => localStorage.getItem("brilliant-sort:audio-muted"))).toBe(
    "true",
  );

  const wand = page.getByTestId("global-wand");
  await wand.focus();
  await wand.press("Enter");
  await expect(hint).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("brilliant-sort:onboarding:v1"))).toBe(
    "seen",
  );
  await expect.poll(() => page.locator(".gem-flight-clone").count(), { timeout: 800 }).toBe(136);
  await page.locator(".gem-flight-clone").evaluateAll((clones) => {
    for (const clone of clones) {
      clone.getAnimations().forEach((animation) => animation.pause());
    }
  });

  await expect(wand).toBeDisabled();
  await expect(page.getByTestId("victory-finale")).toHaveCount(1);
  await expect(page.getByTestId("replay-level")).toHaveCount(0);
  await expect(page.locator(".victory-arc path")).toHaveCount(1);
  await expect(page.locator(".pixel-firework")).toHaveCount(3);
  await expect(page.locator(".pixel-firework-spark")).toHaveCount(24);
  const flight = await readFlightSnapshot(page);
  expect(flight).toMatchObject({
    count: 136,
    unique: 136,
    aligned: true,
    opaque: true,
    avoidsPageOrigin: true,
    hiddenDestinations: 136,
    flightKinds: ["global-wand"],
    familyTransitions: ["micro->micro"],
    lodLayerCounts: [1],
    durationValues: [460],
    keyframeCounts: [3],
    curvedMidpoints: 136,
    minWaveDelay: 0,
    maxWaveDelay: 520,
  });
  expect(flight.waveDelayVariants).toBeGreaterThan(2);

  await page.locator(".gem-flight-clone").evaluateAll((clones) => {
    for (const clone of clones) {
      clone.getAnimations().forEach((animation) => animation.play());
    }
  });
  const nextLevel = await waitForSettledVictory(page, "next-level");
  await expect(nextLevel).toHaveAttribute("aria-label", "进入下一关");
  await nextLevel.focus();
  await nextLevel.press("Enter");

  const shell = page.locator(".workbench-shell");
  await expect(shell).toHaveAttribute("data-level-id", "chrome-01");
  await expect(page.locator(".crystal-workbench")).not.toHaveClass(/is-won/);
  await expect(page.locator(".board-cell")).toHaveCount(562);
  await expect(page.locator(".board-cell.is-empty")).toHaveCount(0);
  await expect(page.locator(".board-cell:not(:disabled)")).toHaveCount(140);
  await expect(page.locator(".shelf-slot.has-gem")).toHaveCount(0);
  await expect(page.locator(".board-cell.is-selected, .shelf-slot.is-selected")).toHaveCount(0);
  await expect(hint).toHaveCount(0);
  await expect(audioControl).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => localStorage.getItem("brilliant-sort:onboarding:v1"))).toBe(
    "seen",
  );

  await page.getByTestId("global-wand").click();
  const replay = await waitForSettledVictory(page, "replay-level");
  await expect(replay).toHaveAttribute("aria-label", "重新玩这一关");
  await replay.focus();
  await replay.press("Enter");
  await expect(shell).toHaveAttribute("data-level-id", "chrome-01");
  await expect(page.locator(".crystal-workbench")).not.toHaveClass(/is-won/);
  await expect(page.locator(".activity-announcer")).toHaveText("校准台已重置。");
  await expect(page.locator(".board-cell")).toHaveCount(562);
  await expect(page.locator(".board-cell.is-empty")).toHaveCount(0);
  await expect(page.locator(".board-cell:not(:disabled)")).toHaveCount(140);
  await expect(page.locator(".shelf-slot.has-gem")).toHaveCount(0);
  await expect(page.getByTestId("global-wand")).toBeVisible();
  await expect(replay).toHaveCount(0);
  await expect(audioControl).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => localStorage.getItem("brilliant-sort:onboarding:v1"))).toBe(
    "seen",
  );

  await page.reload();
  await expect(page.locator(".workbench-shell")).toHaveAttribute("data-level-id", "tux-01");
  await expect(page.getByRole("note")).toHaveCount(0);
  await expect(page.locator(".audio-crystal-control")).toHaveAttribute("aria-pressed", "true");
});

test("unavailable storage keeps onboarding and reduced-motion Tux→Chrome playability", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const unavailable = () => {
      throw new DOMException("Storage unavailable", "SecurityError");
    };
    Object.defineProperties(Storage.prototype, {
      getItem: { configurable: true, value: unavailable },
      setItem: { configurable: true, value: unavailable },
    });
  });
  await page.goto("/");

  const hint = page.getByRole("note");
  await expect(hint).toBeVisible();
  const hintAnimationDuration = await hint.evaluate((element) => {
    const value = getComputedStyle(element).animationDuration;
    return value.endsWith("ms") ? Number.parseFloat(value) : Number.parseFloat(value) * 1_000;
  });
  expect(hintAnimationDuration).toBeLessThanOrEqual(1);
  await page.getByTestId("shelf-slot-0").click();
  await expect(hint).toBeVisible();

  await page.getByTestId("global-wand").click();
  await expect(hint).toHaveCount(0);
  await expect(page.locator(".crystal-workbench")).toHaveClass(/is-won/);
  await expect(page.locator(".gem-flight-clone")).toHaveCount(0);
  await expect(page.getByTestId("victory-finale")).toHaveCount(0);
  const nextLevel = await waitForSettledVictory(page, "next-level");
  await nextLevel.click();
  await expect(page.locator(".workbench-shell")).toHaveAttribute("data-level-id", "chrome-01");
  await expect(hint).toHaveCount(0);
  await expect(page.getByTestId("global-wand")).toBeVisible();

  await page.getByTestId("global-wand").click();
  const replay = await waitForSettledVictory(page, "replay-level");
  await replay.click();
  await expect(page.locator(".workbench-shell")).toHaveAttribute("data-level-id", "chrome-01");
  await expect(page.locator(".crystal-workbench")).not.toHaveClass(/is-won/);
  await expect(hint).toHaveCount(0);
  await expect(page.getByTestId("global-wand")).toBeVisible();
});

test("a mid-game wand morphs Shelf gems back to Micro destinations", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 768 });
  await page.goto("/");
  await page.getByTestId("board-cell-10-7").click();
  const shelfSlot = page.getByTestId("shelf-slot-0");
  await shelfSlot.click();
  await expect(shelfSlot).toBeEnabled({ timeout: 1_000 });
  await expect(page.locator(".shelf-slot.has-gem")).toHaveCount(16);

  await page.getByTestId("global-wand").click();
  await expect.poll(() => page.locator(".gem-flight-clone").count(), { timeout: 800 }).toBe(136);
  await page.locator(".gem-flight-clone").evaluateAll((clones) => {
    for (const clone of clones) {
      clone.getAnimations().forEach((animation) => animation.pause());
    }
  });
  const flight = await readFlightSnapshot(page);
  expect(flight.flightKinds).toEqual(["global-wand"]);
  expect(flight.familyTransitions).toEqual(expect.arrayContaining(["large->micro"]));
  expect(flight.lodLayerCounts).toEqual(expect.arrayContaining([2]));
  expect(flight.minScale).toBeLessThan(1);
  await expect(page.locator(".shelf-slot.has-gem")).toHaveCount(0);
  await expect(page.getByTestId("victory-finale")).toHaveCount(1);

  await page.locator(".gem-flight-clone").evaluateAll((clones) => {
    for (const clone of clones) {
      clone.getAnimations().forEach((animation) => animation.play());
    }
  });
  await expect(page.locator(".gem-flight-clone")).toHaveCount(0, { timeout: 2_000 });
  await expect(page.locator('[data-motion-destination="hidden"]')).toHaveCount(0);
});

test("authoritative movement morphs one opaque gem between Micro and Large rectangles", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 768 });
  await page.goto("/");
  await page.getByTestId("board-cell-10-7").click();
  const shelfSlot = page.getByTestId("shelf-slot-0");
  await shelfSlot.click();

  await expect.poll(() => page.locator(".gem-flight-clone").count(), { timeout: 800 }).toBe(16);
  await expect(shelfSlot).toBeDisabled();
  const boardToShelf = await readFlightSnapshot(page);
  expect(boardToShelf).toMatchObject({
    count: 16,
    unique: 16,
    aligned: true,
    opaque: true,
    avoidsPageOrigin: true,
    hiddenDestinations: 16,
    familyTransitions: ["micro->large"],
    lodLayerCounts: [2],
  });
  expect(boardToShelf.minScale).toBeGreaterThan(1);

  await expect(shelfSlot).toBeEnabled({ timeout: 1_000 });
  await expect(page.locator(".gem-flight-clone")).toHaveCount(0);
  await expect(page.locator('[data-motion-destination="hidden"]')).toHaveCount(0);
  const shelfVisual = await shelfSlot.evaluate((slot) => {
    const slotRect = slot.getBoundingClientRect();
    const trayRect = slot.querySelector(".shelf-sprite")!.getBoundingClientRect();
    const gemRect = slot.querySelector(".gem")!.getBoundingClientRect();
    return {
      trayRatio: trayRect.width / slotRect.width,
      gemRatio: gemRect.width / slotRect.width,
    };
  });
  expect(shelfVisual.trayRatio).toBeCloseTo(0.92, 2);
  expect(shelfVisual.gemRatio).toBeCloseTo(0.56, 2);
  await expect(page.locator(".board-cell.is-empty")).toHaveCount(16);
  await expect(page.locator(".empty-socket-mark")).toHaveCount(0);
  await expect(page.locator(".board-cell.is-empty .socket-sprite").first()).toHaveCSS(
    "opacity",
    "0.38",
  );

  await page.getByTestId("board-cell-10-2").click();
  await page.getByTestId("board-cell-10-7").click();
  await expect(page.locator(".gem-flight-clone")).toHaveCount(0, { timeout: 1_000 });
  await shelfSlot.click();
  await page.getByTestId("board-cell-10-2").click();

  await expect.poll(() => page.locator(".gem-flight-clone").count(), { timeout: 800 }).toBe(10);
  await expect(shelfSlot).toBeDisabled();
  const shelfToBoard = await readFlightSnapshot(page);
  expect(shelfToBoard).toMatchObject({
    count: 10,
    unique: 10,
    aligned: true,
    opaque: true,
    avoidsPageOrigin: true,
    hiddenDestinations: 10,
    familyTransitions: ["large->micro"],
    lodLayerCounts: [2],
  });
  expect(shelfToBoard.maxScale).toBeLessThan(1);

  await expect(shelfSlot).toBeEnabled({ timeout: 1_000 });
  await expect(page.locator(".gem-flight-clone")).toHaveCount(0);
  await expect(page.locator('[data-motion-destination="hidden"]')).toHaveCount(0);
});

test("desktop, square, and portrait Tux and Chrome stages stay centered without page overflow", async ({
  page,
}) => {
  const cases = [
    { width: 1280, height: 720, orientation: "side", levelId: "tux-01", cells: 546 },
    { width: 768, height: 768, orientation: "side", levelId: "tux-01", cells: 546 },
    { width: 390, height: 844, orientation: "stacked", levelId: "tux-01", cells: 546 },
    { width: 1280, height: 720, orientation: "side", levelId: "chrome-01", cells: 562 },
    { width: 390, height: 844, orientation: "stacked", levelId: "chrome-01", cells: 562 },
  ] as const;

  for (const viewport of cases) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.locator(".game-board")).toBeVisible();
    if (viewport.levelId === "chrome-01") {
      await page.getByTestId("global-wand").click();
      await advanceFromSettledTux(page);
    }
    await expect(page.locator(".workbench-shell")).toHaveAttribute("data-level-id", viewport.levelId);
    await expect(page.locator(".board-cell")).toHaveCount(viewport.cells);
    const layout = await page.evaluate(() => {
      const stage = document.querySelector(".crystal-workbench")!;
      const camera = document.querySelector(".board-camera")!;
      const bankA = document.querySelector(".shelf-bank.bank-a")!;
      const bankB = document.querySelector(".shelf-bank.bank-b")!;
      const rect = (element: Element) => element.getBoundingClientRect().toJSON();
      return {
        stageClass: stage.className,
        stage: rect(stage),
        camera: rect(camera),
        bankA: rect(bankA),
        bankB: rect(bankB),
        bankASlots: bankA.querySelectorAll(".shelf-slot").length,
        bankBSlots: bankB.querySelectorAll(".shelf-slot").length,
        overflowX: document.documentElement.scrollWidth > window.innerWidth,
        overflowY: document.documentElement.scrollHeight > window.innerHeight,
      };
    });

    expect(layout.stageClass).toContain(`stage-${viewport.orientation}`);
    expect(Math.abs(layout.stage.left + layout.stage.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(1);
    expect(layout.bankASlots).toBe(8);
    expect(layout.bankBSlots).toBe(8);
    expect(layout.overflowX).toBe(false);
    expect(layout.overflowY).toBe(false);
    if (viewport.orientation === "side") {
      expect(layout.bankA.right).toBeLessThan(layout.camera.left);
      expect(layout.bankB.left).toBeGreaterThan(layout.camera.right);
    } else {
      expect(layout.bankA.bottom).toBeLessThan(layout.camera.top);
      expect(layout.bankB.top).toBeGreaterThan(layout.camera.bottom);
    }
  }
});

test("portrait camera resets on Tux→Chrome advance and Chrome replay", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const camera = page.locator(".board-camera");

  await expect(camera).toHaveAttribute("aria-label", "Tux 棋盘视图，当前 1 倍缩放");
  await camera.focus();
  await camera.press("Equal");
  await expect(camera).toHaveClass(/is-zoomed/);
  await expect(camera).toHaveAttribute("aria-label", "Tux 棋盘视图，当前 2 倍缩放");
  await camera.press("ArrowRight");
  await camera.press("ArrowDown");
  await expect(camera.locator(".board-camera-content")).not.toHaveCSS(
    "transform",
    "matrix(2, 0, 0, 2, 0, 0)",
  );
  await camera.press("Escape");
  await expect(camera).not.toHaveClass(/is-zoomed/);
  await expect(camera).toHaveAttribute("aria-label", "Tux 棋盘视图，当前 1 倍缩放");
  await camera.focus();
  await camera.press("Equal");
  await camera.press("ArrowRight");
  await camera.press("ArrowDown");
  await expect(camera).toHaveClass(/is-zoomed/);

  await page.getByTestId("global-wand").click();
  await advanceFromSettledTux(page);
  await expect(page.locator(".calibration-bay")).toHaveAttribute("aria-label", "Chrome 宝石棋盘");
  await expect(camera).toHaveAttribute("aria-label", "Chrome 棋盘视图，当前 1 倍缩放");
  await expect(camera).not.toHaveClass(/is-zoomed/);
  await expect(camera.locator(".board-camera-content")).toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, 0)",
  );

  await camera.focus();
  await camera.press("Equal");
  await camera.press("ArrowRight");
  await camera.press("ArrowDown");
  await expect(camera).toHaveClass(/is-zoomed/);
  await expect(camera.locator(".board-camera-content")).not.toHaveCSS(
    "transform",
    "matrix(2, 0, 0, 2, 0, 0)",
  );

  await page.getByTestId("global-wand").click();
  const replay = await waitForSettledVictory(page, "replay-level");
  await replay.click();
  await expect(page.locator(".workbench-shell")).toHaveAttribute("data-level-id", "chrome-01");
  await expect(camera).not.toHaveClass(/is-zoomed/);
  await expect(camera.locator(".board-camera-content")).toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, 0)",
  );
});

test("reduced motion commits Tux→Chrome state immediately without flight clones", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByTestId("board-cell-10-7").click();
  const shelfSlot = page.getByTestId("shelf-slot-0");
  await shelfSlot.click();

  await expect(page.locator(".shelf-slot.has-gem")).toHaveCount(16);
  await expect(shelfSlot).toBeEnabled();
  await expect(page.locator(".gem-flight-clone")).toHaveCount(0);
  await expect(page.locator(".board-cell.is-empty")).toHaveCount(16);
  await expect(page.locator(".empty-socket-mark")).toHaveCount(0);
  const transitionDuration = await page.locator(".gem").first().evaluate((element) => {
    const value = getComputedStyle(element).transitionDuration;
    return value.endsWith("ms") ? Number.parseFloat(value) : Number.parseFloat(value) * 1_000;
  });
  expect(transitionDuration).toBeLessThanOrEqual(1);
  await page.getByTestId("global-wand").click();
  await expect(page.locator(".crystal-workbench")).toHaveClass(/is-won/);
  await expect(page.locator(".shelf-slot.has-gem")).toHaveCount(0);
  await expect(page.locator(".gem-flight-clone")).toHaveCount(0);
  await expect(page.getByTestId("victory-finale")).toHaveCount(0);
  const nextLevel = await waitForSettledVictory(page, "next-level");
  await nextLevel.click();
  await expect(page.locator(".workbench-shell")).toHaveAttribute("data-level-id", "chrome-01");
  await expect(page.locator(".board-cell")).toHaveCount(562);
  await expect(page.locator(".shelf-slot.has-gem")).toHaveCount(0);
  await expect(page.locator(".gem-flight-clone")).toHaveCount(0);
  await expect(page.getByTestId("victory-finale")).toHaveCount(0);

  await page.getByTestId("global-wand").click();
  const replay = await waitForSettledVictory(page, "replay-level");
  await replay.click();
  await expect(page.locator(".workbench-shell")).toHaveAttribute("data-level-id", "chrome-01");
  await expect(page.locator(".crystal-workbench")).not.toHaveClass(/is-won/);
  await expect(page.locator(".board-cell")).toHaveCount(562);
  await expect(page.locator(".board-cell.is-empty")).toHaveCount(0);
  await expect(page.locator(".board-cell:not(:disabled)")).toHaveCount(140);
  await expect(page.getByTestId("global-wand")).toBeVisible();
});

test("audio resumes, persists mute, and resets transport across Tux→Chrome and Chrome replay", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const NativeAudioContext = window.AudioContext;
    const TestAudioContext = new Proxy(NativeAudioContext, {
      construct(target, argumentsList, newTarget) {
        const context = Reflect.construct(target, argumentsList, newTarget) as AudioContext;
        (window as typeof window & { __testAudioContext?: AudioContext }).__testAudioContext = context;
        return context;
      },
    });
    const cueKinds: number[] = [];
    (
      window as typeof window & {
        __testAudioCueKinds?: number[];
      }
    ).__testAudioCueKinds = cueKinds;
    const NativeAudioWorkletNode = window.AudioWorkletNode;
    const TestAudioWorkletNode = new Proxy(NativeAudioWorkletNode, {
      construct(target, argumentsList, newTarget) {
        const node = Reflect.construct(target, argumentsList, newTarget) as AudioWorkletNode;
        const nativePostMessage = node.port.postMessage.bind(node.port);
        Object.defineProperty(node.port, "postMessage", {
          configurable: true,
          value(
            message: unknown,
            transferOrOptions?: StructuredSerializeOptions | Transferable[],
          ) {
            const cueMessage = message as { type?: string; bytes?: ArrayBuffer };
            if (cueMessage.type === "cue" && cueMessage.bytes instanceof ArrayBuffer) {
              cueKinds.push(new Uint8Array(cueMessage.bytes)[4] ?? -1);
            }
            const argumentsList =
              transferOrOptions === undefined ? [message] : [message, transferOrOptions];
            Reflect.apply(nativePostMessage, node.port, argumentsList);
          },
        });
        return node;
      },
    });
    Object.defineProperties(window, {
      AudioContext: { configurable: true, value: TestAudioContext },
      AudioWorkletNode: { configurable: true, value: TestAudioWorkletNode },
    });
  });
  await page.goto("/");
  const audioControl = page.locator(".audio-crystal-control");
  await expect(audioControl).toHaveAttribute("data-audio-status", "ready");

  await page.getByTestId("board-cell-10-7").click();
  await expect(audioControl).toHaveAttribute("data-audio-status", "running");
  await page.evaluate(async () => {
    await (window as typeof window & { __testAudioContext: AudioContext }).__testAudioContext.suspend();
  });
  await expect(audioControl).toHaveAttribute("data-audio-status", "suspended");
  await page.getByTestId("board-cell-16-7").click();
  await expect(audioControl).toHaveAttribute("data-audio-status", "running");

  await audioControl.click();
  await expect(audioControl).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => localStorage.getItem("brilliant-sort:audio-muted"))).toBe("true");
  await page.reload();
  await expect(audioControl).toHaveAttribute("aria-pressed", "true");
  await audioControl.click();
  await expect(audioControl).toHaveAttribute("aria-pressed", "false");

  await page.getByTestId("global-wand").click();
  const nextLevel = await waitForSettledVictory(page, "next-level");
  await nextLevel.click();
  await expect(page.locator(".workbench-shell")).toHaveAttribute("data-level-id", "chrome-01");
  await page.getByTestId("global-wand").click();
  const replay = await waitForSettledVictory(page, "replay-level");
  await replay.click();
  await page.getByTestId("global-wand").click();
  await waitForSettledVictory(page, "replay-level");
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { __testAudioCueKinds: number[] }).__testAudioCueKinds,
    ),
  ).toEqual([6, 7, 6, 7, 6]);
});

test("audio initialization failure degrades silently without blocking gameplay", async ({ page }) => {
  await page.addInitScript(() => {
    class FailingAudioWorkletNode {
      constructor() {
        throw new Error("intentional worklet failure");
      }
    }
    Object.defineProperty(window, "AudioWorkletNode", {
      configurable: true,
      value: FailingAudioWorkletNode,
    });
  });
  await page.goto("/");
  const audioControl = page.locator(".audio-crystal-control");
  await expect(audioControl).toHaveAttribute("data-audio-status", "failed");
  await expect(page.locator(".game-board")).toBeVisible();

  await page.getByTestId("board-cell-10-7").click();
  await expect(page.locator(".board-cell.is-selected")).toHaveCount(58);
  await expect(page.locator(".activity-announcer")).toHaveText("已选中 58 颗同色宝石。");
});
