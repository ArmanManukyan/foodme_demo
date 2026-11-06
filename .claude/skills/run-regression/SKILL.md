---
name: run-regression
description: Run the full FoodMe regression (backend JUnit, web and admin unit tests if present, storefront and admin Playwright e2e) in dependency order and report a passed/failed/skipped table per suite.
when_to_use: Use when asked to run all tests, run the regression, check whether everything passes, or verify the repo before a release or merge.
argument-hint: "[backend|web|admin|e2e] (default: all)"
allowed-tools: Bash(./gradlew test*) Bash(npx playwright test *) Bash(npm ci*) Bash(curl *) Bash(java -version) Bash(node -v)
---

# Run the FoodMe regression

Scope: $ARGUMENTS. Run everything if empty. Never stop at the first failing suite: record it and continue with the next suite that can still run. Do not commit, and do not edit tests or app code to make them pass.

## 1. Preflight: decide what can run

Run each check and record the result. If a suite can't run, mark it **not run** in the report with the reason. Don't install system software without asking the user.

| Need | Check | Required by |
|---|---|---|
| JDK 17 | `java -version` (or `$JAVA_HOME`) | Backend JUnit, and the backend server for e2e. Gradle has no toolchain auto-download configured, so a local JDK 17 is required. |
| Node.js 22 + npm | `node -v`, `npm -v` | Web and admin tests |
| PostgreSQL on `localhost:5432`, db/user/password `foodme` | `pg_isready -h localhost -p 5432` if available; otherwise step 3's health check decides | e2e only. JUnit uses in-memory H2. |
| Free ports 8081, 5180, 5174 | | e2e |

## 2. Order

Run the cheapest, most isolated suites first. e2e runs last because it needs a live backend and database.

1. **Backend JUnit**, from `apps/backend`:
   ```bash
   ./gradlew test --continue
   ```
   Count results from `apps/backend/build/test-results/test/TEST-*.xml`. Each `<testsuite>` has `tests`, `failures`, `errors` and `skipped` attributes. Passed = tests − failures − errors − skipped, and failed = failures + errors.

2. **Web and admin unit tests.** Neither `apps/web/package.json` nor `apps/admin/package.json` defines a unit-test script today, only `test:e2e`. If a `test` script has been added, run `npm ci && npm test` in that app. Otherwise report the suite as **none present**. Never treat that as a failure.

3. **Start the e2e backend.** Skip this and the next two steps if Postgres or the JDK is missing.
   - From `apps/backend`, start `./gradlew bootRun` **in the background** (in Claude Code, use Bash `run_in_background`).
   - Wait for health with a loop instead of a fixed sleep: `curl -sf http://localhost:8081/actuator/health` until it returns `{"status":"UP"}`. Give it up to about 3 minutes, since Flyway migrates and seeds images on the first start.
   - If it never comes up, report both e2e suites as **not run** with the last backend log lines.

4. **Storefront e2e**, from `apps/web`:
   ```bash
   npm ci
   npx playwright install chromium
   PLAYWRIGHT_JSON_OUTPUT_NAME=e2e-results.json npx playwright test --reporter=line,json
   ```

5. **Admin e2e**, from `apps/admin`: the same three commands. Run it even if the storefront e2e failed.

6. **Stop the backend** you started (kill the background task), even if earlier steps failed.

For Playwright, count results from each `e2e-results.json` `stats` object: passed = `expected`, failed = `unexpected`, skipped = `skipped`, and flaky = `flaky`. A flaky test passed only on retry, which happens only on CI. List it under failures. List each failed test's file, title and first error line from `suites[].specs[].tests[].results[].error.message`.

## 3. Report

Always print this table, with every row filled in, even when a suite didn't run:

| Suite | Passed | Failed | Skipped | Notes |
|---|---|---|---|---|
| Backend JUnit | | | | |
| Web unit | — | — | — | none present / not run: reason |
| Admin unit | — | — | — | |
| Web e2e (Playwright) | | | | |
| Admin e2e (Playwright) | | | | |

Then list the **failures**, one line each: `suite | test | first error line | tag`. Set the tag to the `FM-BUG-NN` or `FM-FLAKE-NN` comment next to the failing test, or the bug the assertion targets. Planted failures are expected in this course repo. Label them as planted, not as regressions, and call out any failure that has no tag as a **new regression**.

For flaky-tagged tests (`FM-FLAKE-*`), say that the result may vary between runs. Don't rerun them until they pass.
