import { expect, test } from "@playwright/test";

test("public landing page explains the product and links to real entry points", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /moderation, under control/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /add to discord/i }).first()).toHaveAttribute("href", "/api/discord/invite");
  await expect(page.getByRole("link", { name: /open dashboard/i })).toHaveAttribute("href", "/api/auth/discord");
  await expect(page.getByText(/waiting for the bot handshake/i)).toBeVisible();
});

test("integration guide explains how the included bot adapter synchronizes", async ({ page }) => {
  await page.goto("/docs");
  await expect(page.getByRole("heading", { name: /connect the rust bot/i })).toBeVisible();
  await expect(page.getByText(/adapter included/i)).toBeVisible();
  await expect(page.getByText("/api/internal/bot/heartbeat")).toBeVisible();
  await expect(page.getByText("/api/internal/bot/configs?after={sequence}&limit=100")).toBeVisible();
});
