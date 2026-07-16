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
    case "cancel-selection":
    case "restart-level":
      throw new Error(`The Tux browser trace does not use ${command.type}`);
  }
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
  expect(
    await page.locator(".board-camera").evaluate((element) =>
      getComputedStyle(element, "::after").animationName,
    ),
  ).toBe("tux-victory-shimmer");
});

test("the playable surface stays wordless while the mute crystal remains external and accessible", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".game-board")).toBeVisible();

  const surface = await page.evaluate(() => {
    const workbench = document.querySelector(".crystal-workbench");
    const audioControl = document.querySelector(".audio-crystal-control");
    const clone = workbench?.cloneNode(true) as HTMLElement | undefined;
    clone?.querySelector(".activity-announcer")?.remove();
    return {
      visibleCopy: clone?.textContent?.trim() ?? "",
      auxiliaryControls:
        workbench?.querySelectorAll("button:not(.board-cell):not(.shelf-slot)").length ?? 0,
      audioOutsideStage: Boolean(audioControl && workbench && !workbench.contains(audioControl)),
    };
  });

  expect(surface).toEqual({ visibleCopy: "", auxiliaryControls: 0, audioOutsideStage: true });
  await expect(page.locator(".audio-crystal-control")).toHaveAttribute(
    "aria-label",
    "静音像素音乐",
  );
  await expect(page.locator(".audio-crystal-control")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".shelf-bank.bank-a")).toHaveAttribute("aria-label", "缓冲 Shelf A");
  await expect(page.locator(".shelf-bank.bank-b")).toHaveAttribute("aria-label", "缓冲 Shelf B");
});

test("authoritative movement uses one opaque aligned clone per moved gem and locks input until settlement", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 768 });
  await page.goto("/");
  await page.getByTestId("board-cell-10-7").click();
  const shelfSlot = page.getByTestId("shelf-slot-0");
  await shelfSlot.click();

  await expect.poll(() => page.locator(".gem-flight-clone").count(), { timeout: 500 }).toBe(16);
  await expect(shelfSlot).toBeDisabled();
  const motion = await page.evaluate(() => {
    const clones = [...document.querySelectorAll<HTMLElement>(".gem-flight-clone")];
    const flightIds = clones.map((clone) => clone.dataset.flightGemId ?? "");
    const aligned = clones.every((clone) => {
      const gemId = clone.dataset.flightGemId;
      const destination = gemId
        ? document.querySelector<HTMLElement>(`[data-gem-id="${CSS.escape(gemId)}"]`)
        : null;
      const animation = clone.getAnimations()[0];
      const frames = (animation?.effect as KeyframeEffect | null)?.getKeyframes() ?? [];
      const finalTransform = String(frames.at(-1)?.transform ?? "none");
      const matrix = new DOMMatrix(finalTransform);
      const destinationRect = destination?.getBoundingClientRect();
      return Boolean(
        destinationRect &&
          Math.abs(Number.parseFloat(clone.style.left) + matrix.e - destinationRect.left) <= 1 &&
          Math.abs(Number.parseFloat(clone.style.top) + matrix.f - destinationRect.top) <= 1,
      );
    });
    return {
      count: clones.length,
      unique: new Set(flightIds).size,
      aligned,
      opaque: clones.every(
        (clone) =>
          getComputedStyle(clone).opacity === "1" &&
          (clone.getAnimations()[0]?.effect as KeyframeEffect | null)
            ?.getKeyframes()
            .every((frame) => frame.opacity === undefined),
      ),
      avoidsPageOrigin: clones.every(
        (clone) => Number.parseFloat(clone.style.left) > 0 && Number.parseFloat(clone.style.top) > 0,
      ),
      hiddenDestinations: document.querySelectorAll('[data-motion-destination="hidden"]').length,
    };
  });

  expect(motion).toEqual({
    count: 16,
    unique: 16,
    aligned: true,
    opaque: true,
    avoidsPageOrigin: true,
    hiddenDestinations: 16,
  });
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
  const transitionDuration = await page.locator(".gem").first().evaluate((element) => {
    const value = getComputedStyle(element).transitionDuration;
    return value.endsWith("ms") ? Number.parseFloat(value) : Number.parseFloat(value) * 1_000;
  });
  expect(transitionDuration).toBeLessThanOrEqual(1);
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
