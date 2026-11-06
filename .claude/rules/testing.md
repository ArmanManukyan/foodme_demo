# Testing conventions

## Where tests live
| Kind | Location | Framework |
|---|---|---|
| Backend unit (one class, deps mocked) | `apps/backend/src/test/java/am/foodme/backend/<same package as class under test>/` | JUnit 5 + Mockito + AssertJ (all from `spring-boot-starter-test`) |
| Backend integration (HTTP → DB) | `apps/backend/src/test/java/am/foodme/backend/` (existing `*ControllerTest`) | `@SpringBootTest` + `@AutoConfigureMockMvc` + `@ActiveProfiles("test")`, H2 seeded by `src/test/resources/data.sql` |
| Storefront e2e | `apps/web/e2e/*.spec.ts` | Playwright |
| Admin e2e | `apps/admin/e2e/*.spec.ts` | Playwright |

Neither frontend has a unit-test runner yet (no Vitest/Jest). Don't add one unless the user asks.

## Naming
- Java test classes: `<ClassUnderTest>Test`. Test methods: `method_condition_expectedResult`, e.g. `createOrder_withoutToken_unauthorized`.
- Playwright spec files: kebab-case `<feature>.spec.ts`. Test titles describe user-visible behavior: `"takeaway checkout succeeds without address"`.
- The `flake-*.spec.ts` prefix and `FM-FLAKE-NN` comments mark the course's planted flaky tests. Don't use that prefix for new tests.

## Boundary values
For every numeric or length rule, test the value just below the limit, at the limit, and just above it. Real limits in this codebase:
- `CustomerRegisterRequestDto`: full name 2–120 characters, phone 8–32, password 8–72.
- Free delivery: a subtotal equal to `chef.freeDeliveryFrom` (seed: 8000.0 for chef 1). This is exactly where `FM-BUG-03` sits.
- Order quantity: 0, 1, `dish.minimumOrderCount`, and a negative value (see `FM-BUG-04`).
- Pagination: `page=0`, the last page, one past the last page, and `size=1`. The last page is where `FM-BUG-02` drops a chef.
- Empty, null and whitespace-only strings for required fields. Emails are compared trimmed and lowercased.

A test that exposes a planted `FM-BUG` should assert the **correct** behavior and fail. Don't weaken the assertion to match the bug.

## Determinism: no flaky sleeps
- Never use `Thread.sleep`, `page.waitForTimeout`, or fixed delays (`FM-FLAKE-01` is the counter-example). Use Playwright's auto-waiting assertions (`await expect(locator).toBeVisible()`, `toHaveCount`, `toHaveURL`) or `expect.poll`.
- The dev backend adds 200–1500 ms of random latency to every API call. Assertions must wait for state, not for time.
- Don't rely on test execution order or `@Order` (`FM-FLAKE-02`). Spring reuses one H2 database across all test classes in the run, so global counts and sequence numbers such as `FM-100001` depend on order. Create your own data with unique values (`UUID.randomUUID()`, `Date.now()`) and assert on it.
- Don't rely on result order the API doesn't guarantee (`FM-FLAKE-03`), or on the wall-clock date (`FM-FLAKE-04`).
- Every test must pass when run alone and when the whole suite runs.
