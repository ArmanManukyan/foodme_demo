const OrderStatus = {
    NEW: 'NEW',
    ACCEPTED: 'ACCEPTED',
    DELIVERED: 'DELIVERED',
    REJECTED: 'REJECTED',
    // Set only by the customer while the order is NEW (KAN-5). Final.
    CANCELLED: 'CANCELLED',
};

const OrderStatusColors = {
    [OrderStatus.NEW]: 'info',
    [OrderStatus.ACCEPTED]: 'warning',
    [OrderStatus.DELIVERED]: 'success',
    [OrderStatus.REJECTED]: 'error',
    [OrderStatus.CANCELLED]: 'default',
};

// Allowed forward transitions per current status
const OrderStatusTransitions = {
    [OrderStatus.NEW]: [OrderStatus.ACCEPTED, OrderStatus.REJECTED],
    [OrderStatus.ACCEPTED]: [OrderStatus.DELIVERED, OrderStatus.REJECTED],
    [OrderStatus.DELIVERED]: [],
    [OrderStatus.REJECTED]: [],
    [OrderStatus.CANCELLED]: [],
};

// Orders in these statuses bring no money and are left out of revenue.
const NON_REVENUE_STATUSES = [OrderStatus.REJECTED, OrderStatus.CANCELLED];

export { OrderStatus, OrderStatusColors, OrderStatusTransitions, NON_REVENUE_STATUSES };
