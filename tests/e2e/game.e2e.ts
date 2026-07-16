import { expect, test } from "@playwright/test";

test("a player can complete the fixed prism level in the browser", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator(".game-board")).toBeVisible();
  await expect(page.getByTestId("board-cell-0-0")).toHaveAttribute("aria-label", /冰蓝宝石/);

  await page.getByTestId("board-cell-0-0").click();
  await page.getByTestId("shelf-slot-0").click();

  await page.getByTestId("board-cell-3-3").click();
  await page.getByTestId("board-cell-0-0").click();

  await page.getByTestId("board-cell-3-0").click();
  await page.getByTestId("board-cell-3-3").click();

  await page.getByTestId("board-cell-0-3").click();
  await page.getByTestId("board-cell-3-0").click();

  await page.getByTestId("shelf-slot-0").click();
  await page.getByTestId("board-cell-0-3").click();

  await expect(page.locator(".activity-announcer")).toHaveText("所有宝石都已归位。");
  await expect(page.locator(".shelf-slot.has-gem")).toHaveCount(0);
  await expect(page.locator(".board-cell:not(:disabled)")).toHaveCount(0);
});

test("the playable surface stays wordless and chrome-free", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".game-board")).toBeVisible();

  const surface = await page.evaluate(() => {
    const workbench = document.querySelector(".crystal-workbench");
    const clone = workbench?.cloneNode(true) as HTMLElement | undefined;
    clone?.querySelector(".activity-announcer")?.remove();
    return {
      visibleCopy: clone?.textContent?.trim() ?? "",
      auxiliaryControls:
        workbench?.querySelectorAll("button:not(.board-cell):not(.shelf-slot)").length ?? 0,
    };
  });

  expect(surface.visibleCopy).toBe("");
  expect(surface.auxiliaryControls).toBe(0);
});

test("accepted spatial moves briefly serialize input before the next command", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("board-cell-0-0").click();
  const shelfSlot = page.getByTestId("shelf-slot-0");
  await shelfSlot.click();

  await expect(shelfSlot).toBeDisabled();
  await expect(shelfSlot).toBeEnabled({ timeout: 1_000 });
});

test("wide workbench docks the Shelf as a first-viewport vertical rail", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await expect(page.locator(".game-board")).toBeVisible();

  const layout = await page.evaluate(() => {
    const board = document.querySelector(".calibration-bay")?.getBoundingClientRect().toJSON() ?? null;
    const shelf = document.querySelector(".shelf-dock")?.getBoundingClientRect().toJSON() ?? null;
    const grid = document.querySelector(".shelf-grid");
    return {
      board,
      shelf,
      columns: grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").length : 0,
      hasVerticalOverflow: document.documentElement.scrollHeight > window.innerHeight,
    };
  });

  expect(layout.board).not.toBeNull();
  expect(layout.shelf).not.toBeNull();
  expect(layout.shelf!.left).toBeGreaterThan(layout.board!.right);
  expect(Math.abs(layout.shelf!.top - layout.board!.top)).toBeLessThanOrEqual(1);
  expect(layout.columns).toBe(1);
  expect(layout.hasVerticalOverflow).toBe(false);
});

test("narrow workbench preserves the horizontal twelve-slot Shelf", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".game-board")).toBeVisible();

  const layout = await page.evaluate(() => {
    const board = document.querySelector(".calibration-bay")?.getBoundingClientRect().toJSON() ?? null;
    const shelf = document.querySelector(".shelf-dock")?.getBoundingClientRect().toJSON() ?? null;
    const grid = document.querySelector(".shelf-grid");
    return {
      board,
      shelf,
      columns: grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").length : 0,
      hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });

  expect(layout.board).not.toBeNull();
  expect(layout.shelf).not.toBeNull();
  expect(layout.shelf!.top).toBeGreaterThan(layout.board!.bottom);
  expect(layout.columns).toBe(12);
  expect(layout.hasHorizontalOverflow).toBe(false);
});

test("reduced-motion preference keeps the puzzle state readable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const transitionDuration = await page.locator(".gem").first().evaluate((element) => {
    const value = getComputedStyle(element).transitionDuration;
    return value.endsWith("ms") ? Number.parseFloat(value) : Number.parseFloat(value) * 1000;
  });

  await expect(page.locator(".game-board")).toBeVisible();
  expect(transitionDuration).toBeLessThanOrEqual(1);
});
