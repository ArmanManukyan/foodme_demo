package am.foodme.backend.service;

import am.foodme.backend.dto.OrderDto;
import am.foodme.backend.exceptionHandler.BadRequestException;
import am.foodme.backend.exceptionHandler.NotFoundException;
import am.foodme.backend.model.Customer;
import am.foodme.backend.model.Order;
import am.foodme.backend.model.OrderStatus;
import am.foodme.backend.repository.ChefRepository;
import am.foodme.backend.repository.CustomerRepository;
import am.foodme.backend.repository.DishRepository;
import am.foodme.backend.repository.OrderRepository;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    private static final String EMAIL = "ann@example.com";
    private static final String NUMBER = "FM-100042";
    private static final long CUSTOMER_ID = 7L;

    @Mock
    private OrderRepository orderRepository;
    @Mock
    private ChefRepository chefRepository;
    @Mock
    private DishRepository dishRepository;
    @Mock
    private CustomerRepository customerRepository;

    private SimpleMeterRegistry meterRegistry;
    private OrderService orderService;

    @BeforeEach
    void setUp() {
        meterRegistry = new SimpleMeterRegistry();
        orderService = new OrderService(orderRepository, chefRepository, dishRepository,
                customerRepository, meterRegistry);
        Customer customer = new Customer();
        customer.setId(CUSTOMER_ID);
        when(customerRepository.findByEmail(EMAIL)).thenReturn(Optional.of(customer));
    }

    private static Order order(String status) {
        Order order = new Order();
        order.setId(42L);
        order.setNumber(NUMBER);
        order.setStatus(status);
        return order;
    }

    static Stream<String> notNewStatuses() {
        return Stream.of(OrderStatus.ACCEPTED, OrderStatus.DELIVERED, OrderStatus.REJECTED, OrderStatus.CANCELLED);
    }

    @Test
    void cancelOrder_newOrder_returnsCancelledAndCountsMetric() {
        when(orderRepository.findByNumberAndCustomerId(NUMBER, CUSTOMER_ID))
                .thenReturn(Optional.of(order(OrderStatus.NEW)), Optional.of(order(OrderStatus.CANCELLED)));
        when(orderRepository.updateStatusForCustomer(NUMBER, CUSTOMER_ID, OrderStatus.NEW, OrderStatus.CANCELLED))
                .thenReturn(1);

        OrderDto result = orderService.cancelOrder(NUMBER, "  Ann@Example.com ");

        assertThat(result.getStatus()).isEqualTo(OrderStatus.CANCELLED);
        assertThat(meterRegistry.counter("foodme.orders.cancelled").count()).isEqualTo(1.0);
    }

    @Test
    void cancelOrder_foreignOrMissingOrder_notFound() {
        when(orderRepository.findByNumberAndCustomerId(NUMBER, CUSTOMER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> orderService.cancelOrder(NUMBER, EMAIL))
                .isInstanceOf(NotFoundException.class);
        verify(orderRepository, never()).updateStatusForCustomer(anyString(), anyLong(), anyString(), anyString());
    }

    @ParameterizedTest(name = "cancel from {0} is refused")
    @MethodSource("notNewStatuses")
    void cancelOrder_notNewOrder_badRequest(String status) {
        when(orderRepository.findByNumberAndCustomerId(NUMBER, CUSTOMER_ID)).thenReturn(Optional.of(order(status)));

        assertThatThrownBy(() -> orderService.cancelOrder(NUMBER, EMAIL))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining(status);
        verify(orderRepository, never()).updateStatusForCustomer(anyString(), anyLong(), anyString(), anyString());
    }

    @Test
    void cancelOrder_kitchenAcceptedConcurrently_badRequest() {
        // The order was NEW when read, but the admin accepted it before the conditional UPDATE ran.
        when(orderRepository.findByNumberAndCustomerId(NUMBER, CUSTOMER_ID)).thenReturn(Optional.of(order(OrderStatus.NEW)));
        when(orderRepository.updateStatusForCustomer(NUMBER, CUSTOMER_ID, OrderStatus.NEW, OrderStatus.CANCELLED))
                .thenReturn(0);

        assertThatThrownBy(() -> orderService.cancelOrder(NUMBER, EMAIL))
                .isInstanceOf(BadRequestException.class);
        assertThat(meterRegistry.counter("foodme.orders.cancelled").count()).isZero();
        verify(orderRepository, never()).save(any());
    }
}
