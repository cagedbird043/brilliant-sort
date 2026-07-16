import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { GameCommand } from "../../src/core";
const tuxWinningTrace = JSON.parse(
  readFileSync(new URL("../../src/fixtures/traces/tux-01.win.json", import.meta.url), "utf8"),
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
    case "cancel-selection":
    case "restart-level":
      throw new Error(`The Tux browser trace does not use ${command.type}`);
  }
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
  await expect(page.getByTestId("victory-finale")).toHaveCount(0, { timeout: 2_000 });
  await expect(page.getByTestId("replay-level")).toHaveAttribute(
    "aria-label",
    "重新玩这一关",
  );
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
test("onboarding persists only after an accepted keyboard wand and the global flight stays bounded", async ({
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
  await expect(page.locator(".gem-flight-clone")).toHaveCount(0, { timeout: 2_000 });
  await expect(page.locator('[data-motion-destination="hidden"]')).toHaveCount(0);
  await expect(page.locator(".crystal-workbench")).toHaveClass(/is-won/);
  await expect(page.locator(".shelf-slot.has-gem")).toHaveCount(0);
  await expect(page.getByTestId("victory-finale")).toHaveCount(0, { timeout: 2_000 });
  const replay = page.getByTestId("replay-level");
  await expect(replay).toHaveAttribute("aria-label", "重新玩这一关");
  await replay.focus();
  await replay.press("Enter");
  await expect(page.locator(".crystal-workbench")).not.toHaveClass(/is-won/);
  await expect(page.locator(".activity-announcer")).toHaveText("校准台已重置。");
  await expect(page.locator(".board-cell")).toHaveCount(546);
  await expect(page.locator(".board-cell.is-empty")).toHaveCount(0);
  await expect(page.locator(".board-cell:not(:disabled)")).toHaveCount(136);
  await expect(page.locator(".shelf-slot.has-gem")).toHaveCount(0);
  await expect(page.getByTestId("global-wand")).toBeVisible();
  await expect(replay).toHaveCount(0);
  await expect(audioControl).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => localStorage.getItem("brilliant-sort:onboarding:v1"))).toBe(
    "seen",
  );

  await page.reload();
  await expect(page.getByRole("note")).toHaveCount(0);
  await expect(page.locator(".audio-crystal-control")).toHaveAttribute("aria-pressed", "true");
});

test("unavailable storage keeps onboarding and the reduced-motion wand playable", async ({ page }) => {
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
  const replay = page.getByTestId("replay-level");
  await expect(replay).toBeVisible();
  await replay.click();
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

test("desktop, square, and portrait stages stay centered without page overflow", async ({ page }) => {
  const cases = [
    { width: 1280, height: 720, orientation: "side" },
    { width: 768, height: 768, orientation: "side" },
    { width: 390, height: 844, orientation: "stacked" },
  ] as const;

  for (const viewport of cases) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.locator(".game-board")).toBeVisible();
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

test("portrait camera exposes bounded keyboard zoom, pan, and reset semantics", async ({ page }) => {
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
  const replay = page.getByTestId("replay-level");
  await expect(replay).toBeVisible();
  await replay.click();
  await expect(camera).not.toHaveClass(/is-zoomed/);
  await expect(camera).toHaveAttribute("aria-label", "Tux 棋盘视图，当前 1 倍缩放");
  await expect(camera.locator(".board-camera-content")).toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, 0)",
  );
});

test("reduced motion commits the authoritative state immediately without flight clones", async ({ page }) => {
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
  const replay = page.getByTestId("replay-level");
  await expect(replay).toBeVisible();
  await replay.click();
  await expect(page.locator(".crystal-workbench")).not.toHaveClass(/is-won/);
  await expect(page.locator(".board-cell.is-empty")).toHaveCount(0);
  await expect(page.getByTestId("global-wand")).toBeVisible();
});

test("audio starts on a puzzle gesture, reports suspension, resumes, and persists mute", async ({ page }) => {
  await page.addInitScript(() => {
    const NativeAudioContext = window.AudioContext;
    const TestAudioContext = new Proxy(NativeAudioContext, {
      construct(target, argumentsList, newTarget) {
        const context = Reflect.construct(target, argumentsList, newTarget) as AudioContext;
        (window as typeof window & { __testAudioContext?: AudioContext }).__testAudioContext = context;
        return context;
      },
    });
    Object.defineProperty(window, "AudioContext", { configurable: true, value: TestAudioContext });
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
