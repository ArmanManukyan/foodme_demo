---
name: write-integration-tests
description: Write Spring Boot integration tests for the FoodMe REST API (/api/** and /admin/**) using @SpringBootTest, MockMvc and the H2 "test" profile in apps/backend. Use when asked to test an endpoint, request validation, JWT security rules, or controller-service-repository behavior end to end on the backend.
---

# Write backend API integration tests

These tests send real HTTP requests through MockMvc. The full chain runs: security filter, controller, service, JPA and an H2 database seeded from `src/test/resources/data.sql`. Follow the existing `*ControllerTest` classes in `apps/backend/src/test/java/am/foodme/backend/`.

## Steps

1. **Find the endpoint.** The route prefix is in `utils/ControllerUtil` and the controller is in `controller/api` or `controller/admin`. Check the access rule in `security/SecurityConfig`: public, `ROLE_CUSTOMER`, or admin JWT.

2. **Check the seed data** in `src/test/resources/data.sql`: chefs 1–2 are ACTIVE and chef 3 is INACTIVE, chef 1 has `free_delivery_from` 8000.0, and there are known dishes. Add rows there only if no existing row fits. Other test classes share this data, so never change existing rows.

3. **Create or extend** `<Controller>Test.java` in `am.foodme.backend`:
   ```java
   @SpringBootTest
   @AutoConfigureMockMvc
   @ActiveProfiles("test")
   class ChefControllerTest {
       @Autowired private MockMvc mockMvc;
       @Autowired private ObjectMapper objectMapper;
   }
   ```
   The `test` profile turns off Flyway, image seeding, simulated latency, the flaky heartbeat job and HTTP logging.

4. **Authenticate when needed.** Register a fresh customer with a unique email and use the returned token, as in `OrderControllerTest.customerToken()`:
   ```java
   String email = "x-" + UUID.randomUUID() + "@example.com";
   // POST /api/auth/register {fullName, email, phoneNumber, password} -> $.token
   mockMvc.perform(post("/api/order").header("Authorization", "Bearer " + token) ...)
   ```

5. **Cover these cases for each endpoint:**
   - The success path: assert the status and key fields with `jsonPath`.
   - Missing or invalid token → `isUnauthorized()`.
   - Validation failures → `isBadRequest()` and `jsonPath("$.message")`.
   - Unknown id → `isNotFound()`.
   - Boundary values on every `@Size` and numeric limit. For example, register with `fullName` lengths 1, 2, 120 and 121, and `password` lengths 7, 8, 72 and 73.

6. **Keep tests independent** (this is how `FM-FLAKE-02/03/04` fail):
   - Don't use `@Order`. Each test must pass alone and in any order.
   - All test classes in a run share one H2 database. Never assert global counts or sequence-derived values like `FM-100001`. Assert on data your test created, such as the order `number` returned to you.
   - Don't assert list order unless the endpoint sorts explicitly. Don't compare against `LocalDate.now()`.
   - Don't use `Thread.sleep`.

7. **Run** from `apps/backend`:
   ```bash
   ./gradlew test --tests ChefControllerTest
   ./gradlew test --tests 'ChefControllerTest.getActiveChefs_lastPage_returnsRemainingChefs'
   ./gradlew test
   ```
   A test that fails because of a planted `FM-BUG` is a valid finding. Report it and don't weaken the assertion.
