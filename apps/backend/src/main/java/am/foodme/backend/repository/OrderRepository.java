package am.foodme.backend.repository;

import am.foodme.backend.model.Order;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface OrderRepository extends JpaRepository<Order, Long> {
    Optional<Order> findByNumber(String number);

    Optional<Order> findByNumberAndCustomerId(String number, Long customerId);

    Page<Order> findByStatus(String status, Pageable pageable);

    Page<Order> findByCustomerIdOrderByCreatedAtDesc(Long customerId, Pageable pageable);

    @Query(value = "SELECT nextval('foodme.order_number_seq')", nativeQuery = true)
    long nextOrderNumberSequenceValue();

    /**
     * Atomically moves the customer's order from {@code from} to {@code to}.
     * Returns 0 when the order is not theirs or its status has already changed.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Order o SET o.status = :to "
            + "WHERE o.number = :number AND o.customer.id = :customerId AND o.status = :from")
    int updateStatusForCustomer(@Param("number") String number,
                                @Param("customerId") Long customerId,
                                @Param("from") String from,
                                @Param("to") String to);

    /**
     * Atomically moves an order from {@code from} to {@code to}.
     * Returns 0 when its status has already changed (e.g. a concurrent cancel).
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Order o SET o.status = :to, o.rejectReason = :rejectReason "
            + "WHERE o.id = :id AND o.status = :from")
    int updateStatusIfCurrent(@Param("id") Long id,
                              @Param("from") String from,
                              @Param("to") String to,
                              @Param("rejectReason") String rejectReason);
}
