package am.foodme.backend.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "\"order\"", schema = "foodme")
@Getter
@Setter
public class Order {

    @Id
    @SequenceGenerator(name = "order_id_seq", sequenceName = "foodme.order_id_seq", allocationSize = 1)
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "order_id_seq")
    @Column(name = "id", nullable = false)
    private Long id;

    @Column(name = "number")
    private String number;

    /** NEW | ACCEPTED | DELIVERED | REJECTED | CANCELLED, see {@link OrderStatus}. */
    @Column(name = "status")
    private String status;

    @OneToOne(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "address_id", referencedColumnName = "id")
    private Address address;

    @Column(name = "receiver_name")
    private String receiverName;

    @Column(name = "receiver_phone_number")
    private String receiverPhoneNumber;

    @Column(name = "receiver_email")
    private String receiverEmail;

    @Column(name = "total_price")
    private Double totalPrice;

    @Column(name = "delivery_price")
    private Double deliveryPrice;

    @Column(name = "note", length = 2000)
    private String note;

    @Column(name = "reject_reason")
    private String rejectReason;

    /** CASH only. */
    @Column(name = "payment_type")
    private String paymentType;

    /** DELIVERY | TAKEAWAY */
    @Column(name = "delivery_method")
    private String deliveryMethod;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @ManyToOne
    @JoinColumn(name = "chef_id")
    private Chef chef;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id")
    private Customer customer;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderDish> orderDishList;
}
