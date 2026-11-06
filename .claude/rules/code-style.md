# Code style

Follow the style of the surrounding file. There is no Prettier or EditorConfig in the repo, so match existing formatting by hand.

## Backend (Java, `apps/backend`)
- Layering: `controller/api` (storefront) and `controller/admin` → `service` → `repository`. Controllers stay thin. Entities live in `model`, request/response shapes in `dto`.
- Use constructor injection with `private final` fields. Lombok (`@Getter @Setter @NoArgsConstructor @AllArgsConstructor`) is used on DTOs.
- Report client errors by throwing `BadRequestException` or `NotFoundException`. `GlobalExceptionHandler` turns them into `ErrorResponseDto` with a `message` field. Don't build error `ResponseEntity`s in controllers.
- Route prefixes come from `utils/ControllerUtil` constants.
- Use Bean Validation annotations (`@NotBlank`, `@Size`, `@Email`) on request DTOs.
- Schema changes go in a new Flyway migration `V<n>__description.sql`. Never edit an applied migration.

## Storefront (`apps/web`, TypeScript)
- Use double quotes, semicolons, 2-space indent and trailing commas. Import from `src` through the `@/` alias, and use `import type` for type-only imports (`verbatimModuleSyntax` is on).
- Component files are kebab-case (`dish-card.tsx`) with named exports. Pages live in `pages/<Name>/index.tsx`. Primitives go in `components/ui`, feature pieces in `components/sections`.
- Server data goes through TanStack Query and `api/foodme.ts` → `api/client.ts`. Forms use react-hook-form with zod schemas in `schemas/`.
- `npm run build` must pass: `noUnusedLocals` and `noUnusedParameters` are on. `npm run lint` (oxlint) must also pass.

## Admin (`apps/admin`, JSX)
- Use single quotes, 4-space indent, and PascalCase component files under `pages/<resource>/`.
- Use react-admin and MUI components. HTTP calls go through `api/base-api.js` (adds the `/admin` prefix and JWT), wired into `providers/dataProvider.js`.
- `npm run lint` (eslint) must pass.
