import { expect, test } from "@playwright/test";

test("a player can complete the fixed prism level in the browser", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Brilliant Sort" })).toBeVisible();
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
  await expect(page.getByText("状态")).toBeVisible();
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
