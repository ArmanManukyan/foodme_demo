---
name: write-e2e-tests
description: Write Playwright end-to-end tests for the FoodMe storefront (apps/web/e2e) or admin back office (apps/admin/e2e), including boundary-value cases.
when_to_use: Use when asked to test a browser user flow (explore chefs, dish modal, cart quantities, checkout, login, admin orders/chefs/dishes), reproduce or guard a UI bug such as FM-BUG-07, or fix a flaky Playwright test.
argument-hint: "[web|admin] <flow or bug to test>"
allowed-tools: Bash(npx playwright test *) Bash(npm run test:e2e*)
---

# Write Playwright e2e tests

Target: $ARGUMENTS. If no suite is named, use `web` for storefront flows and `admin` for back-office flows.

## 1. Know the setup

| | Storefront | Admin |
|---|---|---|
| Specs | `apps/web/e2e/<feature>.spec.ts` | `apps/admin/e2e/<feature>.spec.ts` |
| Dev server Playwright starts | `npm run dev -- --port 5180` | `npm run dev -- --port 5174 --strictPort` |
| Base URL override | `PLAYWRIGHT_BASE_URL` | `ADMIN_BASE_URL` |
| Parallelism | `fullyParallel: true` | `fullyParallel: false` |
| Retries | 2 on CI, 0 locally | 1 on CI, 0 locally |
| Routing | `/explore`, `/chef/:id`, `/checkout`, `/orders/success`, `/login`, `/orders` | hash router: `/#/login`, login `admin` / `admin123` |

Both suites run in Chromium only, with an HTML reporter and `trace: "on-first-retry"`. Both reuse a dev server that's already running when not on CI.

Prerequisites (Playwright does **not** start these for you):
1. `npm ci` in the app folder, then `npx playwright install chromium` the first time.
2. The backend on `http://localhost:8081`: `./gradlew bootRun` in `apps/backend` with a local Postgres. Specs call it directly through `const API = process.env.VITE_API_BASE_URL || "http://localhost:8081";`. Copy that line. Don't hardcode the URL.

The e2e backend uses the **Flyway seed** (`db/migration/V*.sql`), not the JUnit `src/test/resources/data.sql`. Never hardcode chef or dish ids. Look them up through the API.

## 2. Reuse existing helpers

- `apps/web/e2e/auth.ts` (exported): `createAccountAtCheckout(page, name?)` signs up through the checkout UI. `registerCustomerViaApi(request, API)` returns `{ token, email }`.
- Local helpers that are **not exported**: `addFirstDishToCart(page)` in `storefront-flows.spec.ts`, and `loginAsAdmin(page)` / `createOrderViaApi(request)` in `admin-flows.spec.ts`. To reuse one, add your test to that file, or move the helper into a shared module (`e2e/auth.ts`, or a new `apps/admin/e2e/helpers.ts`) and update its callers.

## 3. Arrange data through the API, act and assert in the UI

```ts
const chefs = await (await request.get(`${API}/api/chef/active?page=0&size=12`)).json();
const detail = await (await request.get(`${API}/api/chef/${chefs.exploreChefResponseDtoList[0].id}`)).json();
const dish = detail.dishes.find((d: { minimumOrderCount: number }) => d.minimumOrderCount <= 1);
```
- Use unique emails: `` `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com` ``.
- Every test gets a fresh browser context, so its IndexedDB cart (`FoodMeCart`) starts empty. Don't clear it manually, and don't rely on a cart left by another test.
- Admin pages tested from the web suite through `${API}/backoffice/` only work when the backend serves the built SPAs (Docker image). A local `bootRun` has none. Put admin UI tests in `apps/admin/e2e`.

## 4. Locators

Use these in order of preference:
1. Role, label or text: `getByRole("button", { name: "Add to cart" })`, `getByRole("form", { name: "Checkout" }).getByLabel("Email")`.
2. Existing hooks where there's no accessible name:

| Element | Locator |
|---|---|
| Chef card | `a.cc_card` |
| Dish card | `button.dc_card` (filter with `{ hasText: dish.nameEn }`) |
| Cart panel | `aside.uc-panel` |
| Cart line | `.cic_root` |
| Line quantity value | `.fm-qty-grp p` |
| Quantity buttons | `getByRole("button", { name: "Increase quantity" \| "Decrease quantity" })` |
| Remove line | `getByRole("button", { name: "Remove item" })` |

There are no `data-testid` attributes. Ask before adding any.

## 5. Wait for state, never for time

The dev backend adds 200–1500 ms of random latency to each API call.
- Never use `page.waitForTimeout` (`FM-FLAKE-01`).
- Use auto-waiting assertions: `toBeVisible`, `toHaveCount`, `toHaveText`, `toHaveURL`. For computed values, use `expect.poll(...)`.
- Assert async state before acting on it. For example, the cart line count must be 1 before `page.reload()` (`FM-FLAKE-05`).
- Don't read a value with `count()` or `textContent()` and then compare it once. That doesn't retry. Use `await expect(locator).toHaveCount(n)` instead.

## 6. Boundary-value checklist

For each limit the flow touches, cover below, at and above it. Tick off what applies:

- [ ] **Cart quantity decrement**: line at 2 → minus → line still present with **1** (FM-BUG-07, example below). Line at 1 → minus → the line is removed (current behavior, because `cart-item-card.tsx` passes `min={0}`).
- [ ] **Dish minimum order** (`minimumOrderCount` > 1): the line is added at the minimum, and minus at the minimum removes it.
- [ ] **Increment**: 1 → 2 updates the line total and shows "· <price> each".
- [ ] **Free delivery**: subtotal one dram below, equal to, and above the chef's `freeDeliveryFrom` (`FM-BUG-03` sits at "equal").
- [ ] **Registration fields**: full name 1/2/120/121 characters, phone 7/8/32/33, password 7/8/72/73, and empty or whitespace-only values.
- [ ] **Checkout**: delivery requires City and Street; takeaway hides them. An empty cart shows "Your cart is empty".
- [ ] **Explore pagination**: the last page shows every remaining chef (`FM-BUG-02`).
- [ ] **Cart from a second chef**: triggers the mismatch flow instead of mixing chefs.

Example, FM-BUG-07: decrementing from 2 must leave 1. Before the fix, `decrementCartItem` in `src/hooks/useCart.ts` deleted the line when `quantity <= min + 1`. The test guards against that regression:

```ts
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
    if (dish) { chefId = chef.id; dishName = dish.nameEn; break; }
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
```

Put it in `apps/web/e2e/cart-quantity.spec.ts`. It should fail if `FM-BUG-07` is reintroduced and pass on current `main`.

## 7. Run and check for flakiness

```bash
cd apps/web                                                # or apps/admin
npx playwright test e2e/cart-quantity.spec.ts              # one file
npx playwright test -g "FM-BUG-07"                         # by title
npx playwright test e2e/cart-quantity.spec.ts --repeat-each=10 --retries=0   # flakiness check
npx playwright test e2e/cart-quantity.spec.ts --trace on   # traces are only recorded on retries by default
npx playwright show-report                                 # opens playwright-report/
npm run test:e2e:all                                       # from apps/web: web, then admin
```

A new test is done when it passes alone, passes in the full suite, and passes `--repeat-each=10` with no retries. If it fails because of a planted `FM-BUG`, report which bug. Don't weaken the assertion.
