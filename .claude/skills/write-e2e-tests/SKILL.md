---
name: write-e2e-tests
description: Write Playwright end-to-end tests for the FoodMe storefront (apps/web/e2e) or admin back office (apps/admin/e2e). Use when asked to test a user flow in the browser such as browsing chefs, the cart, checkout, login, or admin order management, or to fix a flaky UI test.
---

# Write Playwright e2e tests

## Steps

1. **Pick the suite:**
   - Storefront: `apps/web/e2e/<feature>.spec.ts`. The dev server runs on `:5180` (override with `PLAYWRIGHT_BASE_URL`). Routes: `/explore`, `/chef/:id`, `/checkout`, `/orders/success`.
   - Admin: `apps/admin/e2e/<feature>.spec.ts`. The dev server runs on `:5174` and tests run serially. It uses a hash router: `/#/login`. Seeded login is `admin` / `admin123`.

   Playwright starts the frontend dev server itself. **Start the backend first** on `http://localhost:8081` (`./gradlew bootRun` in `apps/backend` with a local Postgres). The tests also call it directly through `const API = process.env.VITE_API_BASE_URL || "http://localhost:8081"`.

2. **Reuse the helpers before writing new ones.** `apps/web/e2e/auth.ts` has `createAccountAtCheckout(page, name)` for UI sign-up and `registerCustomerViaApi(request, API)`, which returns `{ token }`. The admin spec has `loginAsAdmin(page)` and `createOrderViaApi(request)`.

3. **Set up data through the API, then test the UI.** Create customers and orders with `request.post(\`${API}/api/...\`)` and use unique emails (`Date.now()` plus a random suffix). Look up chef and dish ids through `GET /api/chef/active?page=0&size=12` and `GET /api/chef/:id`. Don't hardcode ids: the e2e backend uses Flyway seed data, not the unit-test `data.sql`.

4. **Locate elements in this order of preference:**
   1. `getByRole` / `getByLabel` / `getByText`, e.g. `getByRole("button", { name: "Add to cart" })` or `getByRole("form", { name: "Checkout" }).getByLabel("Email")`.
   2. The existing stable class hooks, when there's no accessible name: `a.cc_card` (chef card), `button.dc_card` (dish card), `aside.uc-panel` (cart panel), `.cic_root` (cart line).

   The app has no `data-testid` attributes. Ask before adding any.

5. **Wait for state, never for time.** The backend adds 200–1500 ms of random latency per request.
   - Don't use `page.waitForTimeout` (`FM-FLAKE-01` shows why).
   - Assert with auto-waiting matchers: `toBeVisible`, `toHaveCount`, `toHaveURL`, `toHaveText`.
   - Before an action that depends on async state, assert that state first. For example, wait for `cartPanel.locator(".cic_root")` to have count 1 before `page.reload()`, as `FM-FLAKE-05` does. For computed values, use `expect.poll(...)`.

6. **Cover edges, not just the happy path:** validation messages on empty or invalid checkout fields, the delivery vs takeaway branch, adding a dish from a second chef (cart mismatch), quantity at its minimum, and the last page of chef listings. Each test must be independent and pass with `fullyParallel: true` (storefront).

7. **Run:**
   ```bash
   cd apps/web
   npx playwright test e2e/<feature>.spec.ts            # one file
   npx playwright test -g "takeaway checkout"            # by title
   npx playwright test e2e/<feature>.spec.ts --repeat-each=5   # check for flakiness
   npm run test:e2e:all                                  # web, then admin
   ```
   For admin, run `cd apps/admin && npx playwright test e2e/<feature>.spec.ts`. On failure, open the trace or report with `npx playwright show-report`.
