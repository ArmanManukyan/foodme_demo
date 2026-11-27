import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Package, Star } from "lucide-react";
import { foodmeApi } from "@/api/foodme";
import { Button } from "@/components/ui/button";
import { OrderReviewSummary } from "@/components/sections/order-review-summary";
import { RateOrderDialog } from "@/components/sections/rate-order-dialog";
import { useAuth } from "@/providers/auth-provider";
import { formatAmd } from "@/lib/utils";
import { ORDER_STATUS, statusBadgeClass, statusLabel } from "@/lib/order-status";
import type { FullOrderDto } from "@/types";

function formatOrderDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function Orders() {
  const { isAuthenticated, customer, logout } = useAuth();
  const [ratingOrder, setRatingOrder] = useState<FullOrderDto | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["my-orders", customer?.id],
    queryFn: () => foodmeApi.getMyOrders(),
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return <Navigate to="/login?next=/orders" replace />;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-8 md:py-14">
      <div className="mb-8 animate-fade-up">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-zinc-900 md:text-4xl">
          Your orders
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Signed in as <span className="font-semibold text-zinc-800">{customer?.email}</span>
        </p>
        <Button variant="outline" size="sm" className="mt-3" onClick={logout}>
          Sign out
        </Button>
      </div>

      {isLoading && (
        <div aria-label="Loading orders" aria-live="polite" className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-[1.5rem] bg-zinc-100" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-6 text-sm text-red-700" role="alert">
          <p>Couldn’t load your order history.</p>
          <Button variant="outline" size="sm" className="mt-3 border-red-200 bg-white" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      )}

      {data && data.list.length === 0 && (
        <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-zinc-50 ring-1 ring-zinc-100">
            <Package size={26} strokeWidth={1.5} className="text-zinc-400" />
          </div>
          <h2 className="font-display text-2xl font-bold text-zinc-900">No orders yet</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            When you check out, every order lands here so you can track it later.
          </p>
          <Button asChild className="mt-6 rounded-full" size="lg">
            <Link to="/explore">Browse chefs</Link>
          </Button>
        </div>
      )}

      {data && data.list.length > 0 && (
        <ul className="space-y-3">
          {data.list.map((order) => (
            <li
              key={order.number}
              data-testid={`order-${order.number}`}
              className="bezel-outer shadow-diffuse transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-px"
            >
              <div className="bezel-inner">
              <Link
                to={`/tracking/${order.number}`}
                className="block rounded-[inherit] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
              >
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-lg font-bold text-zinc-900">
                        {order.number}
                      </p>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${statusBadgeClass(order.status)}`}>
                        {statusLabel(order.status)}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm text-zinc-500">
                      {order.chefName}
                      {order.createdAt ? ` · ${formatOrderDate(order.createdAt)}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-semibold tabular-nums text-zinc-900">
                      {formatAmd(order.totalPrice)}
                    </span>
                    <ChevronRight size={16} strokeWidth={2} className="text-zinc-400" />
                  </div>
                </div>
              </Link>
              {/* Rating lives outside the link: a button can't sit inside an <a>. */}
              {order.status === ORDER_STATUS.DELIVERED && (
                <div className="flex items-center justify-between gap-3 border-t border-zinc-100 px-5 py-3">
                  {order.review ? (
                    <OrderReviewSummary review={order.review} />
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => setRatingOrder(order)}
                    >
                      <Star size={14} strokeWidth={2} aria-hidden="true" />
                      Rate order
                    </Button>
                  )}
                </div>
              )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <RateOrderDialog order={ratingOrder} onOpenChange={(open) => !open && setRatingOrder(null)} />
    </div>
  );
}
