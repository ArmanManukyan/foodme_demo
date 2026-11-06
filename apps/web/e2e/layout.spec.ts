import { test, expect } from "@playwright/test";
import { createAccountAtCheckout } from "./auth";

const API = process.env.VITE_API_BASE_URL || "http://localhost:8081";

test.describe("Layout Tests", () => {
  test("Home page structure and sections", async ({ page }) => {
    await page.goto("/");

    const heroHeading = page.getByRole("heading", { name: /Real food, made by/i, level: 1 });
    await expect(heroHeading).toBeVisible();

    const orderNowBtn = page.getByRole("link", { name: "Order now" }).first();
    await expect(orderNowBtn).toBeVisible();

    const howItWorksHeading = page.getByRole("heading", { name: /Three steps to/i, level: 2 });
    await expect(howItWorksHeading).toBeVisible();

    await expect(page.getByRole("heading", { name: "Find your chef", level: 3 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pick your dishes", level: 3 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Fresh at the door", level: 3 })).toBeVisible();

    const popularChefsHeading = page.getByRole("heading", { name: "Chefs worth knowing", level: 2 });
    await expect(popularChefsHeading).toBeVisible();

    const chefsGrid = page.locator("section:has-text('Chefs worth knowing') .grid").first();
    const chefCards = chefsGrid.locator("a.cc_card");
    // Seed has 6 ACTIVE chefs; list endpoint drops one on the last page (FM-BUG-02).
    await expect(chefCards.first()).toBeVisible();
    expect(await chefCards.count()).toBeGreaterThanOrEqual(4);

    const ctaHeading = page.getByRole("heading", {
      name: /Your next favourite meal is one tap away/i,
      level: 2,
    });
    await expect(ctaHeading).toBeVisible();
    const browseChefsBtn = page.getByRole("link", { name: /Browse chefs/i });
    await expect(browseChefsBtn).toBeVisible();
  });

  test("Explore page layout", async ({ page }) => {
    await page.goto("/explore");

    const exploreHeading = page.getByRole("heading", { name: "Explore chefs", level: 1 });
    await expect(exploreHeading).toBeVisible();

    const chefsGrid = page.locator(".ep_wrap .grid").first();
    await expect(chefsGrid).toBeVisible();

    const chefCards = chefsGrid.locator("a.cc_card");
    await expect(chefCards.first()).toBeVisible();
    expect(await chefCards.count()).toBeGreaterThanOrEqual(4);

    const firstCard = chefCards.first();
    await expect(firstCard.locator("img")).toBeVisible();
    await expect(firstCard.locator("p.truncate").first()).toBeVisible();
    await expect(firstCard.locator(".text-amber-500")).toBeVisible();

    const cardName = (await firstCard.locator("p.truncate").first().textContent())?.trim();
    const metadata = (await firstCard.locator("p.truncate").nth(1).textContent())?.trim();
    expect(metadata).not.toBe(`${cardName} · 25–40 min`);
  });

  test("Responsive layout check - Mobile view", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");

    const heroHeading = page.getByRole("heading", { name: /Real food, made by/i, level: 1 });
    await expect(heroHeading).toBeVisible();

    await page.goto("/explore?q=Argentinean");
    await expect(page.getByRole("searchbox")).toHaveCount(1);
    await expect(page.getByRole("searchbox")).toHaveValue("Argentinean");
  });

  test("cart and checkout item details stay aligned", async ({ page }) => {
    const chefs = await (await page.request.get(`${API}/api/chef/active?page=0&size=12`)).json();
    let chefId: number | undefined;
    let dishName: string | undefined;

    for (const chef of chefs.exploreChefResponseDtoList) {
      const detail = await (await page.request.get(`${API}/api/chef/${chef.id}`)).json();
      const dish = (detail.dishes || [])
        .slice(0, 12)
        .find((candidate: { additions?: unknown[] }) => candidate.additions?.length);
      if (dish) {
        chefId = chef.id;
        dishName = dish.nameEn;
        break;
      }
    }

    expect(chefId).toBeTruthy();
    expect(dishName).toBeTruthy();

    await page.goto(`/chef/${chefId}`);
    await page.locator("button.dc_card").filter({ hasText: dishName! }).first().click();
    await page.locator('input[type="checkbox"]').first().check();
    await page.getByRole("button", { name: "Add to cart" }).click();

    const cartItem = page.locator("aside.uc-panel .cic_root").first();
    const cartNameBox = await cartItem.getByText(dishName!, { exact: true }).boundingBox();
    const removeBox = await cartItem.getByRole("button", { name: "Remove item" }).boundingBox();
    expect(Math.abs(cartNameBox!.y - removeBox!.y)).toBeLessThanOrEqual(6);

    await page.getByRole("link", { name: "Go to checkout" }).click();
    await createAccountAtCheckout(page);
    const summary = page.locator(".cs_wrap");
    const quantityBox = await summary.locator(".tabular-nums.text-zinc-400").first().boundingBox();
    const additionsBox = await summary.getByText(/^\+ /).first().boundingBox();
    expect(additionsBox!.x).toBeGreaterThan(quantityBox!.x + 16);
  });
});
