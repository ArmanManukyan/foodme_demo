package am.foodme.backend.dto;

import am.foodme.backend.model.OrderReview;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class OrderReviewDto {
    private Integer stars;
    private String comment;
    private LocalDateTime createdAt;

    public static OrderReviewDto mapEntityToDto(OrderReview entity) {
        if (entity == null) {
            return null;
        }
        return new OrderReviewDto(entity.getStars(), entity.getComment(), entity.getCreatedAt());
    }
}
