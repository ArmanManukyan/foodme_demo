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
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;

/** KAN-10: customers rate their delivered orders; each rating recalculates the chef's average. */
@Service
public class OrderReviewService {

    static final String NOT_DELIVERED_MESSAGE = "Only delivered orders can be reviewed.";
    static final String ALREADY_REVIEWED_MESSAGE = "Order already reviewed.";

    private final OrderRepository orderRepository;
    private final OrderReviewRepository orderReviewRepository;
    private final ChefRepository chefRepository;
    private final CustomerRepository customerRepository;
    private final MeterRegistry meterRegistry;

    public OrderReviewService(OrderRepository orderRepository, OrderReviewRepository orderReviewRepository,
                              ChefRepository chefRepository, CustomerRepository customerRepository,
                              MeterRegistry meterRegistry) {
        this.orderRepository = orderRepository;
        this.orderReviewRepository = orderReviewRepository;
        this.chefRepository = chefRepository;
        this.customerRepository = customerRepository;
        this.meterRegistry = meterRegistry;
    }

    /**
     * Saves the customer's rating of their own DELIVERED order. Someone else's order and a
     * missing order both give 404, so order numbers can't be probed.
     */
    @Transactional
    public OrderDto reviewOrder(String number, String customerEmail, OrderReviewRequestDto request) {
        Customer customer = customerRepository.findByEmail(customerEmail == null ? "" : customerEmail.trim().toLowerCase())
                .orElseThrow(() -> new NotFoundException("Customer not found"));
        Order order = orderRepository.findByNumberAndCustomerId(number, customer.getId())
                .orElseThrow(() -> new NotFoundException("Order " + number + " not found"));
        if (!OrderStatus.DELIVERED.equals(order.getStatus())) {
            throw new BadRequestException(NOT_DELIVERED_MESSAGE);
        }

        // Lock the chef first: reviews of the same chef (and so of the same order) run one at a time,
        // which keeps the average correct and makes the duplicate check below reliable.
        Long chefId = order.getChef().getId();
        Chef chef = chefRepository.findByIdForUpdate(chefId)
                .orElseThrow(() -> new NotFoundException("Chef " + chefId + " not found"));
        if (orderReviewRepository.existsByOrderId(order.getId())) {
            throw new BadRequestException(ALREADY_REVIEWED_MESSAGE);
        }

        OrderReview review = new OrderReview();
        review.setOrder(order);
        review.setCustomer(customer);
        review.setChef(chef);
        review.setStars(request.getStars().intValueExact());
        review.setComment(normalizeComment(request.getComment()));
        review.setCreatedAt(LocalDateTime.now());
        try {
            // Flush now so the UNIQUE(order_id) constraint fires here, not at commit.
            review = orderReviewRepository.saveAndFlush(review);
        } catch (DataIntegrityViolationException e) {
            throw new BadRequestException(ALREADY_REVIEWED_MESSAGE);
        }

        chef.setRating(averageRating(
                orderReviewRepository.sumStarsByChefId(chefId),
                orderReviewRepository.countByChefId(chefId)));

        order.setReview(review);
        meterRegistry.counter("foodme.orders.reviewed").increment();
        return OrderDto.mapEntityToDto(order);
    }

    /** Average of all star ratings, rounded half-up to one decimal place (e.g. 13 / 3 -> 4.3). */
    static double averageRating(long starsSum, long reviewCount) {
        return BigDecimal.valueOf(starsSum)
                .divide(BigDecimal.valueOf(reviewCount), 1, RoundingMode.HALF_UP)
                .doubleValue();
    }

    private static String normalizeComment(String comment) {
        if (comment == null || comment.isBlank()) {
            return null;
        }
        return comment.trim();
    }
}
