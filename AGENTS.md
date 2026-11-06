# AGENTS.md

Guidance for AI coding agents (Codex, Cursor, Claude Code, etc.) working in this repository.

**Also read before changing code or tests:** `.claude/rules/testing.md` and `.claude/rules/code-style.md`. Claude Code loads them automatically; other agents should read them. For writing tests, use the skills `write-unit-tests`, `write-integration-tests` and `write-e2e-tests`. The full instructions are in `.claude/skills/<name>/SKILL.md`, and `.agents/skills/` holds discovery stubs that point there.

## What this repo is

FoodMe is a food-ordering demo app used as teaching material for a QA course ("AI in QA"). It is deliberately imperfect: it contains **planted bugs and flaky tests**, tagged in code comments as `FM-BUG-NN` (product defects, mostly in `OrderService`, `ChefService`, order DTOs, admin `OrderShow.jsx`) and `FM-FLAKE-NN` (flaky backend/e2e tests). Fix commits reference the tag, e.g. `fix(web): ... (FM-BUG-07)`. Don't "clean up" a tagged spot unless the task is to fix that specific bug/flake.

Other intentional demo behaviors (not bugs):
- `SimulatedLatencyConfig` adds 200–1500 ms random delay to `/api/**` and `/admin/**` (not `/api/images/**`); disabled in the `test` profile.
- `FlakyHeartbeatJob` (backend) and `lib/flakyHeartbeat` (web/admin) report a fake failure to Sentry/GlitchTip ~1 in 10 ticks.
- `GET /api/debug/boom` always throws, to test error tracking.

## Layout

- `apps/backend` — Spring Boot 3.3 / Java 17 / Gradle, Postgres + Flyway (schema `foodme`), JWT auth, Sentry, Prometheus, Loki log shipping.
- `apps/web` — customer storefront: React 19 + TypeScript + Vite + Tailwind 4 + shadcn-style `components/ui`, TanStack Query, react-hook-form + zod, i18next. Cart is stored client-side in IndexedDB via Dexie (`lib/db.ts`, `hooks/useCart.ts`). `@/` aliases `src/`.
- `apps/admin` — back office: React 18 + react-admin 5 + MUI, plain JS/JSX, axios.
- `infra/monitoring/stack` — single Docker image running Prometheus + Loki + Grafana + Grafana MCP behind nginx (see `infra/monitoring/README.md`).
- `render.yaml` (app + Postgres) and `render-monitoring.yaml` (monitoring, `autoDeploy: false` because redeploys wipe data) are Render blueprints. The root README is a no-code student deploy guide.

## Single-origin architecture

In production, one container serves everything. `apps/backend/Dockerfile` (build context = repo root) builds both SPAs and copies them into the backend's `static/` resources:
- storefront → `/`
- admin → `/backoffice` (Vite `base` is `/backoffice/` only in production mode)

`SpaWebConfig` serves static files and falls back to the right `index.html` for client-side routes, but never for `api/`, `admin/`, `actuator/`, `swagger-ui`, `v3/`.

API path conventions:
- `/api/**` — public storefront API; `/api/auth/**` open, `/api/customer/**` and `POST /api/order` need `ROLE_CUSTOMER`.
- `/admin/**` — JWT-protected admin REST API (`/admin/auth/login` open; `GET /admin/dish/**` is public). The admin client prefixes every call with `/admin` (`apps/admin/src/api/base-api.js`).
- Path constants live in `utils/ControllerUtil`.

Both frontends resolve the API base the same way: `VITE_API_BASE_URL` if set, otherwise `http://localhost:8081` in dev and relative (`""`) in production builds.

Images are stored in Postgres (`foodme.image`), served from `/api/images/**`, and seeded on first start from `src/main/resources/img-seed` by `ImageSeedRunner`. `ImageUrlResponseAdvice` rewrites image URLs in responses.

Database config: `DATABASE_URL` (a `postgresql://` URI, e.g. from Render/Neon) is converted to JDBC by `DatabaseUrlEnvironmentPostProcessor`. Otherwise `SPRING_DATASOURCE_URL`, then `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD` (default `localhost:5432/foodme`, user/password `foodme`). JPA runs with `ddl-auto=validate`, so **schema changes need a new Flyway migration** in `src/main/resources/db/migration` (`V4__...sql` next).

## Commands

Backend (from `apps/backend`; needs a local Postgres for `bootRun`):
```bash
./gradlew bootRun                     # serves on :8081 (or $PORT); Swagger at /swagger-ui.html
./gradlew test                        # JUnit 5 + MockMvc, H2 in PostgreSQL mode, profile "test"
./gradlew test --tests OrderControllerTest
./gradlew test --tests 'OrderControllerTest.someMethod'
./gradlew bootJar
```
Tests are `@SpringBootTest` + `@ActiveProfiles("test")`. The test profile uses Hibernate `create-drop` instead of Flyway, seeds from `src/test/resources/data.sql`, and turns off latency, the heartbeat job, and HTTP logging.

Web (from `apps/web`):
```bash
npm run dev        # Vite
npm run build      # tsc -b && vite build (type errors fail the build)
npm run lint       # oxlint
npm run test:e2e   # Playwright; starts its own dev server on :5180
npx playwright test e2e/happy-path.spec.ts
npx playwright test -g "test name"
npm run test:e2e:all   # web e2e, then admin e2e
```

Admin (from `apps/admin`):
```bash
npm run dev | npm run build | npm run lint   # eslint
npm run test:e2e   # Playwright; dev server on :5174 (--strictPort), runs serially
```

The Playwright suites start the frontend dev server themselves, but they also call the backend directly at `http://localhost:8081` (override with `VITE_API_BASE_URL`; `layout.spec.ts` hardcodes it). Start the backend first. You can override the frontend URL with `PLAYWRIGHT_BASE_URL` (web) or `ADMIN_BASE_URL` (admin).

## Observability

- Backend logs are JSON (`logback-spring.xml`, logstash encoder). The Loki appender is active only when `LOKI_PUSH_URL` is set.
- `HttpLoggingFilter` logs every `/api/**` and `/admin/**` request and response, with secrets redacted. Set `HTTP_LOGGING_ENABLED=false` to turn it off.
- Prometheus metrics are at `/actuator/prometheus`, with HTTP latency histograms enabled. The health check is `/actuator/health`.
- Sentry/GlitchTip: the backend uses `SENTRY_DSN`. The frontends read `VITE_SENTRY_DSN` at build time. On Render this is mapped from `VITE_SENTRY_DSN_WEB` / `VITE_SENTRY_DSN_ADMIN` via Docker build args.

## Gotchas

- The root `.env.example` refers to `infra/docker-compose.yml`, Jenkins, and `docs/deployment.md`. None of these exist in the repo anymore, so there is currently no local docker-compose setup.
- The Dockerfile's JVM flags are tuned for Render's free tier (512 MB, 0.1 CPU) to stay inside the deploy health-check window. Don't remove them casually.
