package am.foodme.backend.service;

import am.foodme.backend.dto.OrderDto;
import am.foodme.backend.dto.OrderReviewRequestDto;
import am.foodme.backend.exceptionHandler.BadRequestException;
import am.foodme.backend.exceptionHandler.NotFoundException;
import am.foodme.backend.model.Chef;
import am.foodme.backend.model.Customer;
import am.foodme.backend.model.Order;
import am.foodme.backend.model.OrderReview;
import am.foodme.backend.model.OrderStatus;
import am.foodme.backend.repository.ChefRepository;
import am.foodme.backend.repository.CustomerRepository;
import am.foodme.backend.repository.OrderRepository;
import am.foodme.backend.repository.OrderReviewRepository;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderReviewServiceTest {

    private static final String EMAIL = "ann@example.com";
    private static final String NUMBER = "FM-100042";
    private static final long CUSTOMER_ID = 7L;
    private static final long ORDER_ID = 42L;
    private static final long CHEF_ID = 3L;

    @Mock
    private OrderRepository orderRepository;
    @Mock
    private OrderReviewRepository orderReviewRepository;
    @Mock
    private ChefRepository chefRepository;
    @Mock
    private CustomerRepository customerRepository;

    private SimpleMeterRegistry meterRegistry;
    private OrderReviewService service;
    private Customer customer;
    private Chef chef;

    @BeforeEach
    void setUp() {
        meterRegistry = new SimpleMeterRegistry();
        service = new OrderReviewService(orderRepository, orderReviewRepository, chefRepository,
                customerRepository, meterRegistry);
        customer = new Customer();
        customer.setId(CUSTOMER_ID);
        chef = new Chef();
        chef.setId(CHEF_ID);
        chef.setRating(0.0);
        // lenient: reviewOrder_unknownCustomer_notFound calls findByEmail with another email.
        lenient().when(customerRepository.findByEmail(EMAIL)).thenReturn(Optional.of(customer));
    }

    private Order order(String status) {
        Order order = new Order();
        order.setId(ORDER_ID);
        order.setNumber(NUMBER);
        order.setStatus(status);
        order.setChef(chef);
        order.setCustomer(customer);
        return order;
    }

    private static OrderReviewRequestDto request(int stars, String comment) {
        return new OrderReviewRequestDto(BigDecimal.valueOf(stars), comment);
    }

    /** Stubs everything a successful review touches; the chef ends up with the given totals. */
    private void stubSuccessfulReview(Order order, long starsSum, long reviewCount) {
        when(orderRepository.findByNumberAndCustomerId(NUMBER, CUSTOMER_ID)).thenReturn(Optional.of(order));
        when(chefRepository.findByIdForUpdate(CHEF_ID)).thenReturn(Optional.of(chef));
        when(orderReviewRepository.existsByOrderId(ORDER_ID)).thenReturn(false);
        when(orderReviewRepository.saveAndFlush(any(OrderReview.class))).thenAnswer(inv -> inv.getArgument(0));
        when(orderReviewRepository.sumStarsByChefId(CHEF_ID)).thenReturn(starsSum);
        when(orderReviewRepository.countByChefId(CHEF_ID)).thenReturn(reviewCount);
    }

    static Stream<String> notDeliveredStatuses() {
        return Stream.of(OrderStatus.NEW, OrderStatus.ACCEPTED, OrderStatus.REJECTED, OrderStatus.CANCELLED);
    }

    /** Also used by OrderReviewAverageRatingTest. */
    static Stream<Arguments> averages() {
        return Stream.of(
                Arguments.of(5L, 1L, 5.0),   // a single review
                Arguments.of(9L, 2L, 4.5),   // exact
                Arguments.of(13L, 3L, 4.3),  // 4.333 rounds down
                Arguments.of(14L, 3L, 4.7),  // 4.666 rounds up
                Arguments.of(17L, 4L, 4.3),  // 4.25 rounds half up
                Arguments.of(3L, 3L, 1.0)    // lowest possible
        );
    }

    @Test
    void reviewOrder_deliveredOwnOrder_savesReviewWithOrderCustomerChefAndTime() {
        Order order = order(OrderStatus.DELIVERED);
        stubSuccessfulReview(order, 4L, 1L);

        OrderDto result = service.reviewOrder(NUMBER, "  Ann@Example.com ", request(4, "  Nice  "));

        ArgumentCaptor<OrderReview> saved = ArgumentCaptor.forClass(OrderReview.class);
        verify(orderReviewRepository).saveAndFlush(saved.capture());
        assertThat(saved.getValue().getOrder()).isSameAs(order);
        assertThat(saved.getValue().getCustomer()).isSameAs(customer);
        assertThat(saved.getValue().getChef()).isSameAs(chef);
        assertThat(saved.getValue().getStars()).isEqualTo(4);
        assertThat(saved.getValue().getComment()).isEqualTo("Nice");
        assertThat(saved.getValue().getCreatedAt()).isNotNull();
        assertThat(result.getReview().getStars()).isEqualTo(4);
        assertThat(result.getReview().getComment()).isEqualTo("Nice");
        assertThat(meterRegistry.counter("foodme.orders.reviewed").count()).isEqualTo(1.0);
    }

    @Test
    void reviewOrder_blankComment_storedAsNull() {
        stubSuccessfulReview(order(OrderStatus.DELIVERED), 5L, 1L);

        OrderDto result = service.reviewOrder(NUMBER, EMAIL, request(5, "   "));

        assertThat(result.getReview().getComment()).isNull();
    }

    @Test
    void reviewOrder_foreignOrMissingOrder_notFound() {
        when(orderRepository.findByNumberAndCustomerId(NUMBER, CUSTOMER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.reviewOrder(NUMBER, EMAIL, request(5, null)))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Order " + NUMBER + " not found");
        verify(orderReviewRepository, never()).saveAndFlush(any());
    }

    @Test
    void reviewOrder_unknownCustomer_notFound() {
        when(customerRepository.findByEmail("ghost@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.reviewOrder(NUMBER, "ghost@example.com", request(5, null)))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Customer not found");
        verify(orderReviewRepository, never()).saveAndFlush(any());
    }

    @ParameterizedTest
    @MethodSource("notDeliveredStatuses")
    void reviewOrder_notDelivered_badRequest(String status) {
        when(orderRepository.findByNumberAndCustomerId(NUMBER, CUSTOMER_ID)).thenReturn(Optional.of(order(status)));

        assertThatThrownBy(() -> service.reviewOrder(NUMBER, EMAIL, request(5, null)))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Only delivered orders can be reviewed.");
        verify(orderReviewRepository, never()).saveAndFlush(any());
        assertThat(chef.getRating()).isEqualTo(0.0);
    }

    @Test
    void reviewOrder_alreadyReviewed_badRequest() {
        when(orderRepository.findByNumberAndCustomerId(NUMBER, CUSTOMER_ID))
                .thenReturn(Optional.of(order(OrderStatus.DELIVERED)));
        when(chefRepository.findByIdForUpdate(CHEF_ID)).thenReturn(Optional.of(chef));
        when(orderReviewRepository.existsByOrderId(ORDER_ID)).thenReturn(true);

        assertThatThrownBy(() -> service.reviewOrder(NUMBER, EMAIL, request(5, null)))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Order already reviewed.");
        verify(orderReviewRepository, never()).saveAndFlush(any());
    }

    @Test
    void reviewOrder_uniqueConstraintViolation_alreadyReviewed() {
        when(orderRepository.findByNumberAndCustomerId(NUMBER, CUSTOMER_ID))
                .thenReturn(Optional.of(order(OrderStatus.DELIVERED)));
        when(chefRepository.findByIdForUpdate(CHEF_ID)).thenReturn(Optional.of(chef));
        when(orderReviewRepository.existsByOrderId(ORDER_ID)).thenReturn(false);
        when(orderReviewRepository.saveAndFlush(any(OrderReview.class)))
                .thenThrow(new DataIntegrityViolationException("duplicate order_id"));

        assertThatThrownBy(() -> service.reviewOrder(NUMBER, EMAIL, request(5, null)))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Order already reviewed.");
        assertThat(chef.getRating()).isEqualTo(0.0);
    }

    @ParameterizedTest
    @MethodSource("averages")
    void reviewOrder_recalculatesChefRating_roundedToOneDecimal(long starsSum, long reviewCount, double expected) {
        stubSuccessfulReview(order(OrderStatus.DELIVERED), starsSum, reviewCount);

        service.reviewOrder(NUMBER, EMAIL, request(5, null));

        assertThat(chef.getRating()).isEqualTo(expected);
    }
}
