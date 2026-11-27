package am.foodme.backend.service;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

import static org.assertj.core.api.Assertions.assertThat;

/** R10 / R11: the chef rating is the average of all stars, rounded half-up to one decimal. */
class OrderReviewAverageRatingTest {

    @ParameterizedTest
    @MethodSource("am.foodme.backend.service.OrderReviewServiceTest#averages")
    void averageRating_roundsHalfUpToOneDecimal(long starsSum, long reviewCount, double expected) {
        assertThat(OrderReviewService.averageRating(starsSum, reviewCount)).isEqualTo(expected);
    }
}
