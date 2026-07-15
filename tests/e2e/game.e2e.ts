import { expect, test } from "@playwright/test";

test("a player can complete the fixed prism level in the browser", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "关卡 01" })).toBeVisible();
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

  await expect(page.getByRole("heading", { name: "棱镜已归位" })).toBeVisible();
  await expect(page.getByText("已完成")).toBeVisible();

  await page.getByRole("button", { name: "再玩一次" }).click();
  await expect(page.getByRole("heading", { name: "棱镜已归位" })).toBeHidden();
  await expect(page.getByTestId("board-cell-0-0")).toHaveAttribute("aria-label", /冰蓝宝石/);
});

test("restart restores the deterministic initial board", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("board-cell-0-0").click();
  await page.getByTestId("shelf-slot-0").click();
  await expect(page.getByTestId("shelf-slot-0")).toHaveClass(/has-gem/);

  await page.getByRole("button", { name: "重新开始关卡" }).click();

  await expect(page.getByTestId("shelf-slot-0")).not.toHaveClass(/has-gem/);
  await expect(page.getByTestId("board-cell-0-0")).toHaveAttribute("aria-label", /冰蓝宝石/);
});

test("accepted spatial moves briefly serialize input before the next command", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("board-cell-0-0").click();
  const shelfSlot = page.getByTestId("shelf-slot-0");
  await shelfSlot.click();

  await expect(shelfSlot).toBeDisabled();
  await expect(shelfSlot).toBeEnabled({ timeout: 1_000 });
});

test("reduced-motion preference keeps the puzzle state readable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const transitionDuration = await page.locator(".gem").first().evaluate((element) => {
    const value = getComputedStyle(element).transitionDuration;
    return value.endsWith("ms") ? Number.parseFloat(value) : Number.parseFloat(value) * 1000;
  });

  await expect(page.getByRole("button", { name: "重新开始关卡" })).toBeVisible();
  expect(transitionDuration).toBeLessThanOrEqual(1);
});
