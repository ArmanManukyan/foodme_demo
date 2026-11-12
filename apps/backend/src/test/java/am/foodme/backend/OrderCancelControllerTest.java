package am.foodme.backend;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * KAN-5 / KAN-6: customer cancellation of NEW orders and the order status transitions.
 * Every test registers its own customer and creates its own order, so it does not
 * depend on execution order or on data left by other test classes.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OrderCancelControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    // ---- helpers ----

    private String customerToken() throws Exception {
        String email = "cancel-test-" + UUID.randomUUID() + "@example.com";
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
        return objectMapper.readTree(response).get("token").asText();
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

    /** Creates a NEW takeaway order for the customer and returns its number. */
    private String createOrder(String customerToken) throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "chefId", 1,
                "receiverName", "Ann",
                "receiverPhoneNumber", "+37491234567",
                "receiverEmail", "ann@example.com",
                "paymentType", "CASH",
                "deliveryMethod", "TAKEAWAY",
                "note", "cancel test",
                "createOrderDishes", List.of(Map.of("dishId", 1, "quantity", 1))
        ));
        String response = mockMvc.perform(post("/api/order")
                        .header("Authorization", "Bearer " + customerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NEW"))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("number").asText();
    }

    private JsonNode orderByNumber(String number) throws Exception {
        String response = mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response);
    }

    private long orderId(String number) throws Exception {
        return orderByNumber(number).get("id").asLong();
    }

    private ResultActions cancel(String token, String number) throws Exception {
        return mockMvc.perform(post("/api/customer/orders/" + number + "/cancel")
                .header("Authorization", "Bearer " + token));
    }

    private ResultActions adminSetStatus(String adminToken, long orderId, String newStatus) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("status", newStatus);
        if ("REJECTED".equals(newStatus)) {
            body.put("rejectReason", "Out of ingredients");
        }
        return mockMvc.perform(patch("/admin/order/" + orderId + "/status")
                .header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body)));
    }

    // ---- customer cancel endpoint ----

    @Test
    void cancelOrder_ownNewOrder_returnsCancelled() throws Exception {
        String token = customerToken();
        String number = createOrder(token);

        cancel(token, number)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.number").value(number))
                .andExpect(jsonPath("$.status").value("CANCELLED"));

        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));
        mockMvc.perform(get("/api/customer/orders").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.list[0].number").value(number))
                .andExpect(jsonPath("$.list[0].status").value("CANCELLED"));
    }

    @Test
    void cancelOrder_withoutToken_unauthorized() throws Exception {
        String number = createOrder(customerToken());

        mockMvc.perform(post("/api/customer/orders/" + number + "/cancel"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(jsonPath("$.status").value("NEW"));
    }

    @Test
    void cancelOrder_otherCustomersOrder_notFound() throws Exception {
        String ownerToken = customerToken();
        String number = createOrder(ownerToken);
        String strangerToken = customerToken();

        cancel(strangerToken, number)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").exists());

        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(jsonPath("$.status").value("NEW"));
    }

    @Test
    void cancelOrder_unknownNumber_notFound() throws Exception {
        cancel(customerToken(), "FM-UNKNOWN-" + UUID.randomUUID())
                .andExpect(status().isNotFound());
    }

    @Test
    void cancelOrder_acceptedOrder_badRequest() throws Exception {
        String token = customerToken();
        String number = createOrder(token);
        adminSetStatus(adminToken(), orderId(number), "ACCEPTED").andExpect(status().isOk());

        cancel(token, number)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").exists());

        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(jsonPath("$.status").value("ACCEPTED"));
    }

    @Test
    void cancelOrder_rejectedOrder_badRequest() throws Exception {
        String token = customerToken();
        String number = createOrder(token);
        adminSetStatus(adminToken(), orderId(number), "REJECTED").andExpect(status().isOk());

        cancel(token, number).andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(jsonPath("$.status").value("REJECTED"));
    }

    @Test
    void cancelOrder_deliveredOrder_badRequest() throws Exception {
        String token = customerToken();
        String number = createOrder(token);
        String admin = adminToken();
        long id = orderId(number);
        adminSetStatus(admin, id, "ACCEPTED").andExpect(status().isOk());
        adminSetStatus(admin, id, "DELIVERED").andExpect(status().isOk());

        cancel(token, number).andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(jsonPath("$.status").value("DELIVERED"));
    }

    @Test
    void cancelOrder_alreadyCancelled_badRequest() throws Exception {
        String token = customerToken();
        String number = createOrder(token);
        cancel(token, number).andExpect(status().isOk());

        cancel(token, number).andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(jsonPath("$.status").value("CANCELLED"));
    }

    // ---- admin status transitions ----

    @Test
    void adminUpdateStatus_newToCancelled_badRequest() throws Exception {
        String number = createOrder(customerToken());

        adminSetStatus(adminToken(), orderId(number), "CANCELLED")
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(jsonPath("$.status").value("NEW"));
    }

    @Test
    void adminUpdateStatus_fromCancelled_badRequest() throws Exception {
        String token = customerToken();
        String number = createOrder(token);
        cancel(token, number).andExpect(status().isOk());
        String admin = adminToken();
        long id = orderId(number);

        for (String target : List.of("NEW", "ACCEPTED", "DELIVERED", "REJECTED", "CANCELLED")) {
            adminSetStatus(admin, id, target).andExpect(status().isBadRequest());
        }

        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(jsonPath("$.status").value("CANCELLED"));
    }

    @Test
    void adminUpdateStatus_newAcceptedDelivered_succeeds() throws Exception {
        String number = createOrder(customerToken());
        String admin = adminToken();
        long id = orderId(number);

        adminSetStatus(admin, id, "ACCEPTED")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACCEPTED"));
        adminSetStatus(admin, id, "DELIVERED")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DELIVERED"));
    }

    @Test
    void adminUpdateStatus_newToRejected_storesReason() throws Exception {
        String number = createOrder(customerToken());

        adminSetStatus(adminToken(), orderId(number), "REJECTED")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"))
                .andExpect(jsonPath("$.rejectReason").value("Out of ingredients"));
    }

    @Test
    void adminUpdateStatus_deliveredToRejected_badRequest() throws Exception {
        String number = createOrder(customerToken());
        String admin = adminToken();
        long id = orderId(number);
        adminSetStatus(admin, id, "ACCEPTED").andExpect(status().isOk());
        adminSetStatus(admin, id, "DELIVERED").andExpect(status().isOk());

        adminSetStatus(admin, id, "REJECTED").andExpect(status().isBadRequest());
    }

    @Test
    void adminListOrders_filterCancelled_containsCancelledOrder() throws Exception {
        String token = customerToken();
        String number = createOrder(token);
        cancel(token, number).andExpect(status().isOk());

        mockMvc.perform(get("/admin/order")
                        .param("status", "CANCELLED")
                        .param("size", "100")
                        .header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.list[*].number", hasItem(number)))
                .andExpect(jsonPath("$.list[*].status", everyItem(is("CANCELLED"))));
    }
}
