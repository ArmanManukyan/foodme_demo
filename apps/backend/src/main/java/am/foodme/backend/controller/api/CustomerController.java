package am.foodme.backend.controller.api;

import am.foodme.backend.dto.CustomerProfileDto;
import am.foodme.backend.dto.OrderDto;
import am.foodme.backend.dto.OrderListResponseDto;
import am.foodme.backend.dto.OrderReviewRequestDto;
import am.foodme.backend.service.CustomerAuthService;
import am.foodme.backend.service.OrderReviewService;
import am.foodme.backend.service.OrderService;
import am.foodme.backend.utils.ControllerUtil;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ControllerUtil.API_CUSTOMER_CONTROLLER)
public class CustomerController {

    private final CustomerAuthService customerAuthService;
    private final OrderService orderService;
    private final OrderReviewService orderReviewService;

    public CustomerController(CustomerAuthService customerAuthService, OrderService orderService,
                              OrderReviewService orderReviewService) {
        this.customerAuthService = customerAuthService;
        this.orderService = orderService;
        this.orderReviewService = orderReviewService;
    }

    @GetMapping("/me")
    public CustomerProfileDto me(Authentication authentication) {
        return customerAuthService.me(authentication.getName());
    }

    @GetMapping("/orders")
    public OrderListResponseDto orders(Authentication authentication,
                                       @RequestParam(defaultValue = "0") int page,
                                       @RequestParam(defaultValue = "20") int size) {
        return orderService.listForCustomer(authentication.getName(), page, size);
    }

    @PostMapping("/orders/{number}/cancel")
    public OrderDto cancelOrder(Authentication authentication, @PathVariable String number) {
        return orderService.cancelOrder(number, authentication.getName());
    }

    @PostMapping("/orders/{number}/review")
    public OrderDto reviewOrder(Authentication authentication, @PathVariable String number,
                                @Valid @RequestBody OrderReviewRequestDto request) {
        return orderReviewService.reviewOrder(number, authentication.getName(), request);
    }
}
