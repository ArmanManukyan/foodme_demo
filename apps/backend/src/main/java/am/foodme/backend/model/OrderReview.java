package am.foodme.backend.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/** A customer's 1–5 star rating of one delivered order (KAN-9). Never edited or deleted. */
@Entity
@Table(name = "order_review", schema = "foodme")
@Getter
@Setter
public class OrderReview {

    public static final int MIN_STARS = 1;
    public static final int MAX_STARS = 5;
    public static final int MAX_COMMENT_LENGTH = 1000;

    // Must match V4__order_review.sql (sequence name and INCREMENT BY = allocationSize),
    // checked by OrderReviewMigrationTest.
    @Id
    @SequenceGenerator(name = "order_review_id_seq", sequenceName = "foodme.order_review_id_seq", allocationSize = 1)
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "order_review_id_seq")
    @Column(name = "id", nullable = false)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false, unique = true)
    private Order order;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "chef_id", nullable = false)
    private Chef chef;

    @Column(name = "stars", nullable = false)
    private Integer stars;

    @Column(name = "comment", length = MAX_COMMENT_LENGTH)
    private String comment;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
