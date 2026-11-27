package am.foodme.backend.dto;

import am.foodme.backend.model.Order;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class OrderDto {
    private Long id;
    private String number;
    private Long chefId;
    private String chefName;
    private String receiverName;
    private String receiverPhoneNumber;
    private String receiverEmail;
    private String paymentType;
    private String deliveryMethod;
    private String note;
    private String status;
    private String rejectReason;
    private Double totalPrice;
    private Double deliveryPrice;
    private AddressDto addressDto;
    private List<CreateOrderDishDto> createOrderDishes;
    private List<OrderDishDto> orderDishList;
    private LocalDateTime createdAt;
    /** Response only: the customer's rating, null while the order has not been reviewed. */
    private OrderReviewDto review;

    public static OrderDto mapEntityToDto(Order entity) {
        if (entity == null) {
            return null;
        }
        OrderDto dto = new OrderDto();
        dto.setId(entity.getId());
        dto.setNumber(entity.getNumber());
        dto.setChefId(entity.getChef() != null ? entity.getChef().getId() : null);
        dto.setChefName(entity.getChef() != null ? entity.getChef().getFullNameEn() : null);
        dto.setReceiverName(entity.getReceiverName());
        dto.setReceiverPhoneNumber(entity.getReceiverPhoneNumber());
        dto.setReceiverEmail(entity.getReceiverEmail());
        dto.setPaymentType(entity.getPaymentType());
        dto.setDeliveryMethod(entity.getDeliveryMethod());
        dto.setNote(entity.getNote());
        dto.setStatus(entity.getStatus());
        dto.setRejectReason(entity.getRejectReason());
        dto.setTotalPrice(entity.getTotalPrice());
        dto.setDeliveryPrice(entity.getDeliveryPrice());
        dto.setAddressDto(AddressDto.mapEntityToDto(entity.getAddress()));
        if (entity.getOrderDishList() != null) {
            dto.setOrderDishList(entity.getOrderDishList().stream()
                    .map(OrderDishDto::mapEntityToDto)
                    .collect(Collectors.toList()));
        }
        // FM-BUG-06
        dto.setCreatedAt(entity.getCreatedAt());
        dto.setReview(OrderReviewDto.mapEntityToDto(entity.getReview()));
        return dto;
    }
}
