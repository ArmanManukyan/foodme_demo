import { test, expect } from "@playwright/test";

const API = process.env.VITE_API_BASE_URL || "http://localhost:8081";

test("cart: minus on a quantity-2 line leaves 1 item (FM-BUG-07)", async ({ page, request }) => {
  // Arrange: a dish with minimumOrderCount 1, so add-to-cart starts the line at 1.
  const chefs = await (await request.get(`${API}/api/chef/active?page=0&size=12`)).json();
  let chefId: number | undefined;
  let dishName: string | undefined;
  for (const chef of chefs.exploreChefResponseDtoList) {
    const detail = await (await request.get(`${API}/api/chef/${chef.id}`)).json();
    const dish = (detail.dishes ?? []).find((d: { minimumOrderCount: number }) => d.minimumOrderCount <= 1);
    if (dish) {
      chefId = chef.id;
      dishName = dish.nameEn;
      break;
    }
  }
  expect(chefId, "seed must contain a dish with minimumOrderCount <= 1").toBeTruthy();

  await page.goto(`/chef/${chefId}`);
  await page.locator("button.dc_card").filter({ hasText: dishName! }).first().click();
  await page.getByRole("button", { name: "Add to cart" }).click();

  const line = page.locator("aside.uc-panel .cic_root");
  const qty = line.locator(".fm-qty-grp p");
  await expect(line).toHaveCount(1);
  await expect(qty).toHaveText("1");

  // Act: bring the line to 2, then press minus once.
  await line.getByRole("button", { name: "Increase quantity" }).click();
  await expect(qty).toHaveText("2");
  await line.getByRole("button", { name: "Decrease quantity" }).click();

  // Assert: the line survives with exactly 1 item.
  await expect(line).toHaveCount(1);
  await expect(qty).toHaveText("1");
});
