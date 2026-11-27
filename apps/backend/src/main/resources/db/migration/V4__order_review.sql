-- KAN-10: customer ratings of delivered orders (one per order, kept permanently).
-- The id comes from order_review_id_seq: OrderReview uses GenerationType.SEQUENCE with
-- allocationSize = 1, so INCREMENT BY must stay 1. The DEFAULT also covers inserts made
-- outside Hibernate.

CREATE SEQUENCE foodme.order_review_id_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE foodme.order_review (
    id BIGINT NOT NULL PRIMARY KEY DEFAULT nextval('foodme.order_review_id_seq'),
    order_id BIGINT NOT NULL UNIQUE REFERENCES foodme."order"(id),
    customer_id BIGINT NOT NULL REFERENCES foodme.customer(id),
    chef_id BIGINT NOT NULL REFERENCES foodme.chef(id),
    stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
    comment VARCHAR(1000),
    created_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_order_review_chef_id ON foodme.order_review(chef_id);
CREATE INDEX idx_order_review_customer_id ON foodme.order_review(customer_id);
