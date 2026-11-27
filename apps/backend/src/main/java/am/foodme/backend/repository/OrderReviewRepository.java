package am.foodme.backend.repository;

import am.foodme.backend.model.OrderReview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrderReviewRepository extends JpaRepository<OrderReview, Long> {

    boolean existsByOrderId(Long orderId);

    long countByChefId(Long chefId);

    @Query("SELECT COALESCE(SUM(r.stars), 0) FROM OrderReview r WHERE r.chef.id = :chefId")
    long sumStarsByChefId(@Param("chefId") Long chefId);
}
