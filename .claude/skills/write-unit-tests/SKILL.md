---
name: write-unit-tests
description: Write fast, isolated JUnit 5 + Mockito unit tests for FoodMe backend classes (services, DTO logic, utils) in apps/backend. Use when asked to unit test a Java class or method, cover business logic such as delivery pricing or order validation, or add boundary-value tests without starting Spring.
---

# Write backend unit tests

Unit tests here test **one Java class with its collaborators mocked**. They don't start Spring, MockMvc or a database. To test the whole HTTP stack, use the `write-integration-tests` skill.

The frontends (`apps/web`, `apps/admin`) have no unit-test runner. If the user asks for frontend unit tests, say so and ask before adding Vitest. Don't install it silently.

## Steps

1. **Read the class under test** and list its branches, thrown exceptions (`BadRequestException`, `NotFoundException`) and numeric or length limits. Note any `FM-BUG-NN` comment: your test should assert the *correct* behavior.

2. **Create the test file** in the same package as the class, under `src/test`:
   `apps/backend/src/test/java/am/foodme/backend/service/OrderServiceTest.java` for `service/OrderService.java`.

3. **Use this skeleton.** It needs no Spring annotations; everything comes from `spring-boot-starter-test`:
   ```java
   package am.foodme.backend.service;

   import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
   import org.junit.jupiter.api.BeforeEach;
   import org.junit.jupiter.api.Test;
   import org.junit.jupiter.api.extension.ExtendWith;
   import org.mockito.Mock;
   import org.mockito.junit.jupiter.MockitoExtension;

   import static org.assertj.core.api.Assertions.assertThat;
   import static org.assertj.core.api.Assertions.assertThatThrownBy;
   import static org.mockito.Mockito.when;

   @ExtendWith(MockitoExtension.class)
   class OrderServiceTest {
       @Mock ChefRepository chefRepository;
       // ...one @Mock per constructor dependency

       private OrderService service;

       @BeforeEach
       void setUp() {
           // Services use constructor injection, so build them directly.
           // Pass a real SimpleMeterRegistry where a MeterRegistry is needed.
           service = new OrderService(orderRepository, chefRepository, dishRepository,
                   customerRepository, new SimpleMeterRegistry());
       }
   }
   ```

4. **Write one test per behavior**, named `method_condition_expectedResult`, with arrange / act / assert:
   - Stub only what the path needs: `when(chefRepository.findById(1L)).thenReturn(Optional.of(chef))`. Mockito strict stubs fail on unused stubbing, so don't add extras.
   - Check exceptions with `assertThatThrownBy(...).isInstanceOf(BadRequestException.class).hasMessage("Only CASH payment is supported")`.
   - Build entities and DTOs with their Lombok setters or all-args constructors.

5. **Add boundary-value cases** for each limit, below, at and above it. For example, `calculateDeliveryPrice` with subtotal `freeDeliveryFrom - 1`, `== freeDeliveryFrom` and `+ 1`, plus a `TAKEAWAY` case and a null subtotal. Use `@ParameterizedTest` with `@CsvSource` when only the inputs change.

6. **Keep it deterministic.** Don't use `Thread.sleep`, `LocalDate.now()` or `Random` in assertions, and don't depend on test order. If the code reads the clock, assert against values you control.

7. **Run it** from `apps/backend`:
   ```bash
   ./gradlew test --tests 'am.foodme.backend.service.OrderServiceTest'
   ./gradlew test --tests 'am.foodme.backend.service.OrderServiceTest.calculateDeliveryPrice_subtotalEqualsThreshold_isFree'
   ```
   Then run `./gradlew test` to make sure nothing else broke. If a test fails because of a planted `FM-BUG`, leave it failing and report which bug it exposes. Don't change the assertion to match the bug.
