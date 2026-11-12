package am.foodme.backend.service;

import am.foodme.backend.dto.OrderDto;
import am.foodme.backend.exceptionHandler.BadRequestException;
import am.foodme.backend.exceptionHandler.NotFoundException;
import am.foodme.backend.model.Order;
import am.foodme.backend.model.OrderStatus;
import am.foodme.backend.repository.OrderRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.Set;
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
class AdminOrderServiceTest {

    private static final long ID = 42L;
    private static final List<String> ALL_STATUSES = List.of(
            OrderStatus.NEW, OrderStatus.ACCEPTED, OrderStatus.DELIVERED, OrderStatus.REJECTED, OrderStatus.CANCELLED);
    private static final Set<String> ALLOWED = Set.of(
            OrderStatus.NEW + "->" + OrderStatus.ACCEPTED,
            OrderStatus.NEW + "->" + OrderStatus.REJECTED,
            OrderStatus.ACCEPTED + "->" + OrderStatus.DELIVERED,
            OrderStatus.ACCEPTED + "->" + OrderStatus.REJECTED);

    @Mock
    private OrderRepository orderRepository;

    @InjectMocks
    private AdminOrderService adminOrderService;

    private static Order order(String status) {
        Order order = new Order();
        order.setId(ID);
        order.setNumber("FM-100042");
        order.setStatus(status);
        return order;
    }

    static Stream<Arguments> allowedTransitions() {
        return ALL_STATUSES.stream()
                .flatMap(from -> ALL_STATUSES.stream().map(to -> Arguments.of(from, to)))
                .filter(args -> ALLOWED.contains(args.get()[0] + "->" + args.get()[1]));
    }

    static Stream<Arguments> forbiddenTransitions() {
        return ALL_STATUSES.stream()
                .flatMap(from -> ALL_STATUSES.stream().map(to -> Arguments.of(from, to)))
                .filter(args -> !ALLOWED.contains(args.get()[0] + "->" + args.get()[1]));
    }

    @ParameterizedTest(name = "{0} -> {1} is allowed")
    @MethodSource("allowedTransitions")
    void updateStatus_allowedTransition_updatesStatus(String from, String to) {
        when(orderRepository.findById(ID)).thenReturn(Optional.of(order(from)), Optional.of(order(to)));
        String reason = OrderStatus.REJECTED.equals(to) ? "Out of ingredients" : null;
        when(orderRepository.updateStatusIfCurrent(ID, from, to, reason)).thenReturn(1);

        OrderDto result = adminOrderService.updateStatus(ID, to, reason);

        assertThat(result.getStatus()).isEqualTo(to);
    }

    @ParameterizedTest(name = "{0} -> {1} is forbidden")
    @MethodSource("forbiddenTransitions")
    void updateStatus_forbiddenTransition_badRequest(String from, String to) {
        when(orderRepository.findById(ID)).thenReturn(Optional.of(order(from)));

        assertThatThrownBy(() -> adminOrderService.updateStatus(ID, to, null))
                .isInstanceOf(BadRequestException.class);
        verify(orderRepository, never()).updateStatusIfCurrent(anyLong(), anyString(), anyString(), any());
    }

    @Test
    void updateStatus_customerCancelledConcurrently_badRequest() {
        // The order was NEW when read, but the customer cancelled it before the conditional UPDATE ran.
        when(orderRepository.findById(ID)).thenReturn(Optional.of(order(OrderStatus.NEW)));
        when(orderRepository.updateStatusIfCurrent(ID, OrderStatus.NEW, OrderStatus.ACCEPTED, null)).thenReturn(0);

        assertThatThrownBy(() -> adminOrderService.updateStatus(ID, OrderStatus.ACCEPTED, null))
                .isInstanceOf(BadRequestException.class);
        verify(orderRepository, never()).save(any());
    }

    @Test
    void updateStatus_unknownOrder_notFound() {
        when(orderRepository.findById(ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> adminOrderService.updateStatus(ID, OrderStatus.ACCEPTED, null))
                .isInstanceOf(NotFoundException.class);
    }
}
