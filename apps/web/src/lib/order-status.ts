// Single source of order status codes and their storefront labels.
// Codes mirror the backend's am.foodme.backend.model.OrderStatus.
export const ORDER_STATUS = {
  NEW: "NEW",
  ACCEPTED: "ACCEPTED",
  DELIVERED: "DELIVERED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
} as const;

export type OrderStatusCode = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export const STATUS_LABEL: Record<OrderStatusCode, string> = {
  NEW: "Received",
  ACCEPTED: "Preparing",
  DELIVERED: "Delivered",
  REJECTED: "Declined",
  CANCELLED: "Cancelled",
};

export function statusLabel(status: string): string {
  return STATUS_LABEL[status as OrderStatusCode] ?? status;
}

export function statusBadgeClass(status: string): string {
  if (status === ORDER_STATUS.DELIVERED) return "bg-emerald-50 text-emerald-800 ring-emerald-100";
  if (status === ORDER_STATUS.REJECTED) return "bg-red-50 text-red-700 ring-red-100";
  if (status === ORDER_STATUS.ACCEPTED) return "bg-amber-50 text-amber-800 ring-amber-100";
  if (status === ORDER_STATUS.CANCELLED) return "bg-zinc-100 text-zinc-500 ring-zinc-200/80";
  return "bg-zinc-100 text-zinc-700 ring-zinc-200/80";
}

/** The customer may cancel only while the kitchen hasn't accepted the order yet. */
export function isCancellable(status: string): boolean {
  return status === ORDER_STATUS.NEW;
}

/** Final states where the order won't be fulfilled. */
export function isTerminatedUnfulfilled(status: string): boolean {
  return status === ORDER_STATUS.REJECTED || status === ORDER_STATUS.CANCELLED;
}
