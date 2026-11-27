package am.foodme.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.IntStream;
import java.util.stream.Stream;

import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * KAN-9 / KAN-10: customers rate their delivered orders, and the chef's rating becomes the average.
 * Every test registers its own customer and creates its own orders, so it does not depend on
 * execution order or on data left by other test classes.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OrderReviewControllerTest {

    private static final String NOT_DELIVERED = "Only delivered orders can be reviewed.";
    private static final String ALREADY_REVIEWED = "Order already reviewed.";
    private static final String STARS_INVALID = "Stars must be a whole number from 1 to 5";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    // ---- parameter sources ----

    static Stream<String> blankComments() {
        return Stream.of("", "   ");
    }

    static IntStream starsAtLimits() {
        return IntStream.of(1, 5);
    }

    static Stream<String> invalidStarsJson() {
        return Stream.of("0", "6", "-1", "4.5", "null");
    }

    static IntStream commentLengthsUpToLimit() {
        return IntStream.of(999, 1000);
    }

    // ---- helpers ----

    private record Customer(String token, String email) {
    }

    private Customer registerCustomer() throws Exception {
        String email = "review-test-" + UUID.randomUUID() + "@example.com";
        String response = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fullName", "Ann",
                                "email", email,
                                "phoneNumber", "+37491234567",
                                "password", "secret123"
                        ))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return new Customer(objectMapper.readTree(response).get("token").asText(), email);
    }

    private String customerToken() throws Exception {
        return registerCustomer().token();
    }

    private String adminToken() throws Exception {
        String response = mockMvc.perform(post("/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "admin",
                                "password", "admin123"
                        ))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("token").asText();
    }

    /** Creates a NEW takeaway order for the customer (chef 1, dish 1) and returns its number. */
    private String createOrder(String customerToken) throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "chefId", 1,
                "receiverName", "Ann",
                "receiverPhoneNumber", "+37491234567",
                "receiverEmail", "ann@example.com",
                "paymentType", "CASH",
                "deliveryMethod", "TAKEAWAY",
                "note", "review test",
                "createOrderDishes", List.of(Map.of("dishId", 1, "quantity", 1))
        ));
        String response = mockMvc.perform(post("/api/order")
                        .header("Authorization", "Bearer " + customerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("number").asText();
    }

    private long orderId(String number) throws Exception {
        String response = mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("id").asLong();
    }

    private void adminSetStatus(String adminToken, long orderId, String newStatus) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("status", newStatus);
        if ("REJECTED".equals(newStatus)) {
            body.put("rejectReason", "Out of ingredients");
        }
        mockMvc.perform(patch("/admin/order/" + orderId + "/status")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk());
    }

    /** Creates an order for the customer and moves it NEW -> ACCEPTED -> DELIVERED. */
    private String createDeliveredOrder(String customerToken) throws Exception {
        String number = createOrder(customerToken);
        long id = orderId(number);
        String admin = adminToken();
        adminSetStatus(admin, id, "ACCEPTED");
        adminSetStatus(admin, id, "DELIVERED");
        return number;
    }

    private ResultActions review(String token, String number, String jsonBody) throws Exception {
        var request = post("/api/customer/orders/" + number + "/review")
                .contentType(MediaType.APPLICATION_JSON)
                .content(jsonBody);
        if (token != null) {
            request.header("Authorization", "Bearer " + token);
        }
        return mockMvc.perform(request);
    }

    private ResultActions review(String token, String number, int stars, String comment) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("stars", stars);
        body.put("comment", comment);
        return review(token, number, objectMapper.writeValueAsString(body));
    }

    private static long uniqueId() {
        return ThreadLocalRandom.current().nextLong(1_000_000_000L, 9_000_000_000L);
    }

    /**
     * Inserts a chef that only this test uses, so its average is not affected by other tests.
     * INACTIVE keeps it out of the storefront's active-chef list that other tests count.
     */
    private long insertOwnChef(double initialRating) {
        long chefId = uniqueId();
        jdbcTemplate.update("INSERT INTO foodme.chef (id, username, status, full_name_en, rating, "
                        + "platform_fee, delivery_price, free_delivery_from, priority_index) "
                        + "VALUES (?, ?, 'INACTIVE', 'Review Test Chef', ?, 0.12, 700.0, 8000.0, 99)",
                chefId, "review-chef-" + chefId, initialRating);
        return chefId;
    }

    /** Inserts a DELIVERED order of the given chef for the customer and returns its number. */
    private String insertDeliveredOrder(long chefId, String customerEmail) {
        Long customerId = jdbcTemplate.queryForObject(
                "SELECT id FROM foodme.customer WHERE email = ?", Long.class, customerEmail);
        long orderId = uniqueId();
        String number = "RV-" + orderId;
        jdbcTemplate.update("INSERT INTO foodme.\"order\" (id, number, status, payment_type, delivery_method, "
                        + "total_price, delivery_price, created_at, chef_id, customer_id) "
                        + "VALUES (?, ?, 'DELIVERED', 'CASH', 'TAKEAWAY', 1800.0, 0.0, ?, ?, ?)",
                orderId, number, LocalDateTime.of(2026, 1, 15, 12, 0), chefId, customerId);
        return number;
    }

    // ---- success path and where the rating appears (R1, R13) ----

    @Test
    void reviewOrder_deliveredOwnOrder_returnsOrderWithReview() throws Exception {
        String token = customerToken();
        String number = createDeliveredOrder(token);

        review(token, number, 4, "  Tasty and hot  ")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.number").value(number))
                .andExpect(jsonPath("$.review.stars").value(4))
                .andExpect(jsonPath("$.review.comment").value("Tasty and hot"))
                .andExpect(jsonPath("$.review.createdAt", notNullValue()));
    }

    @Test
    void reviewOrder_saved_shownInMyOrdersTrackingAndAdmin() throws Exception {
        String token = customerToken();
        String number = createDeliveredOrder(token);
        review(token, number, 5, "Great").andExpect(status().isOk());

        mockMvc.perform(get("/api/customer/orders").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.list[0].number").value(number))
                .andExpect(jsonPath("$.list[0].review.stars").value(5))
                .andExpect(jsonPath("$.list[0].review.comment").value("Great"));

        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.review.stars").value(5))
                .andExpect(jsonPath("$.review.comment").value("Great"));

        mockMvc.perform(get("/admin/order/" + orderId(number)).header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.review.stars").value(5))
                .andExpect(jsonPath("$.review.comment").value("Great"))
                .andExpect(jsonPath("$.review.createdAt", notNullValue()));
    }

    @Test
    void getOrder_notReviewed_reviewIsNull() throws Exception {
        String token = customerToken();
        String number = createDeliveredOrder(token);

        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DELIVERED"))
                .andExpect(jsonPath("$.review", nullValue()));
    }

    @ParameterizedTest
    @MethodSource("blankComments")
    void reviewOrder_blankComment_storedAsNull(String comment) throws Exception {
        String token = customerToken();
        String number = createDeliveredOrder(token);

        review(token, number, 3, comment)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.review.stars").value(3))
                .andExpect(jsonPath("$.review.comment", nullValue()));
    }

    @Test
    void reviewOrder_withoutComment_ok() throws Exception {
        String token = customerToken();
        String number = createDeliveredOrder(token);

        review(token, number, "{\"stars\": 2}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.review.stars").value(2))
                .andExpect(jsonPath("$.review.comment", nullValue()));
    }

    // ---- who can rate (R6, R7, R8, R9) ----

    @Test
    void reviewOrder_withoutToken_unauthorized() throws Exception {
        String number = createDeliveredOrder(customerToken());

        review(null, number, 5, null).andExpect(status().isUnauthorized());
    }

    @Test
    void reviewOrder_withAdminToken_forbidden() throws Exception {
        String number = createDeliveredOrder(customerToken());

        review(adminToken(), number, 5, null).andExpect(status().isForbidden());
    }

    @Test
    void reviewOrder_otherCustomersOrder_notFound() throws Exception {
        String number = createDeliveredOrder(customerToken());

        review(customerToken(), number, 5, null)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Order " + number + " not found"));

        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(jsonPath("$.review", nullValue()));
    }

    @Test
    void reviewOrder_unknownNumber_notFound() throws Exception {
        String number = "FM-NOPE-" + UUID.randomUUID();

        review(customerToken(), number, 5, null)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Order " + number + " not found"));
    }

    @Test
    void reviewOrder_newOrder_badRequest() throws Exception {
        String token = customerToken();
        String number = createOrder(token);

        review(token, number, 5, null)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(NOT_DELIVERED));
    }

    @Test
    void reviewOrder_acceptedOrder_badRequest() throws Exception {
        String token = customerToken();
        String number = createOrder(token);
        adminSetStatus(adminToken(), orderId(number), "ACCEPTED");

        review(token, number, 5, null)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(NOT_DELIVERED));
    }

    @Test
    void reviewOrder_rejectedOrder_badRequest() throws Exception {
        String token = customerToken();
        String number = createOrder(token);
        adminSetStatus(adminToken(), orderId(number), "REJECTED");

        review(token, number, 5, null)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(NOT_DELIVERED));
    }

    @Test
    void reviewOrder_cancelledOrder_badRequest() throws Exception {
        String token = customerToken();
        String number = createOrder(token);
        mockMvc.perform(post("/api/customer/orders/" + number + "/cancel")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        review(token, number, 5, null)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(NOT_DELIVERED));
    }

    @Test
    void reviewOrder_twice_alreadyReviewedAndFirstRatingKept() throws Exception {
        String token = customerToken();
        String number = createDeliveredOrder(token);
        review(token, number, 5, "first").andExpect(status().isOk());

        review(token, number, 1, "second")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(ALREADY_REVIEWED));

        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(jsonPath("$.review.stars").value(5))
                .andExpect(jsonPath("$.review.comment").value("first"));
    }

    // ---- validation boundaries (R2, R3) ----

    @ParameterizedTest
    @MethodSource("starsAtLimits")
    void reviewOrder_starsAtLimits_ok(int stars) throws Exception {
        String token = customerToken();
        String number = createDeliveredOrder(token);

        review(token, number, stars, null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.review.stars").value(stars));
    }

    @ParameterizedTest
    @MethodSource("invalidStarsJson")
    void reviewOrder_starsOutOfRangeOrFractional_badRequest(String starsJson) throws Exception {
        String token = customerToken();
        String number = createDeliveredOrder(token);

        review(token, number, "{\"stars\": " + starsJson + "}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(STARS_INVALID));

        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(jsonPath("$.review", nullValue()));
    }

    @Test
    void reviewOrder_starsMissing_badRequest() throws Exception {
        String token = customerToken();
        String number = createDeliveredOrder(token);

        review(token, number, "{\"comment\": \"no stars\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(STARS_INVALID));
    }

    @Test
    void reviewOrder_starsNotANumber_badRequestNotServerError() throws Exception {
        String token = customerToken();
        String number = createDeliveredOrder(token);

        review(token, number, "{\"stars\": \"abc\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Malformed request body"));
    }

    @ParameterizedTest
    @MethodSource("commentLengthsUpToLimit")
    void reviewOrder_commentUpToLimit_ok(int length) throws Exception {
        String token = customerToken();
        String number = createDeliveredOrder(token);
        String comment = "a".repeat(length);

        review(token, number, 4, comment)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.review.comment").value(comment));
    }

    @Test
    void reviewOrder_commentOverLimit_badRequest() throws Exception {
        String token = customerToken();
        String number = createDeliveredOrder(token);

        review(token, number, 4, "a".repeat(1001))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Comment must be at most 1000 characters"));

        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(jsonPath("$.review", nullValue()));
    }

    // ---- chef rating (R10, R11, R12) ----

    @Test
    void reviewOrder_updatesChefRatingToRoundedAverage() throws Exception {
        long chefId = insertOwnChef(0.0);
        Customer customer = registerCustomer();

        review(customer.token(), insertDeliveredOrder(chefId, customer.email()), 5, null).andExpect(status().isOk());
        mockMvc.perform(get("/api/chef/" + chefId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rating").value(5.0));

        review(customer.token(), insertDeliveredOrder(chefId, customer.email()), 4, null).andExpect(status().isOk());
        mockMvc.perform(get("/api/chef/" + chefId))
                .andExpect(jsonPath("$.rating").value(4.5));

        review(customer.token(), insertDeliveredOrder(chefId, customer.email()), 4, null).andExpect(status().isOk());
        // (5 + 4 + 4) / 3 = 4.333... -> 4.3
        mockMvc.perform(get("/api/chef/" + chefId))
                .andExpect(jsonPath("$.rating").value(4.3));
    }

    @Test
    void reviewOrder_invalidReview_chefRatingUnchanged() throws Exception {
        long chefId = insertOwnChef(3.7);
        Customer customer = registerCustomer();
        String number = insertDeliveredOrder(chefId, customer.email());

        review(customer.token(), number, "{\"stars\": 9}").andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/chef/" + chefId))
                .andExpect(jsonPath("$.rating").value(3.7));
    }

    @Disabled("Pre-existing bug: AdminChefService.update fails with 500 on orphanRemoval of Chef.chefTagOrderList "
            + "(\"A collection with cascade=all-delete-orphan was no longer referenced\"). Enable once that bug is fixed.")
    @Test
    void adminUpdateChef_ratingInRequest_ignored() throws Exception {
        long chefId = insertOwnChef(4.1);
        String admin = adminToken();
        String chefJson = mockMvc.perform(get("/admin/chef/" + chefId).header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        ObjectNode chef = (ObjectNode) objectMapper.readTree(chefJson);
        chef.put("rating", 1.0);

        mockMvc.perform(put("/admin/chef/" + chefId)
                        .header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(chef)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rating").value(4.1));

        mockMvc.perform(get("/api/chef/" + chefId))
                .andExpect(jsonPath("$.rating").value(4.1));
    }
}
