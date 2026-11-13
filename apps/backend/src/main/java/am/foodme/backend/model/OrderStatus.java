package am.foodme.backend.model;

/** Values stored in {@link Order#getStatus()}. CANCELLED, DELIVERED and REJECTED are final. */
public final class OrderStatus {

    public static final String NEW = "NEW";
    public static final String ACCEPTED = "ACCEPTED";
    public static final String DELIVERED = "DELIVERED";
    public static final String REJECTED = "REJECTED";
    public static final String CANCELLED = "CANCELLED";

    private OrderStatus() {
    }
}
