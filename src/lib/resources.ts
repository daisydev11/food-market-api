import type { Order, OrderItem, OrderStatus } from "@prisma/client";

// How database rows become API resources. Prisma returns the columns as
// they are for restaurants, menu items and customers; orders need shaping:
// the status is lower case in the API, and items carry only public fields.

export const ORDER_STATUSES = ["pending", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"] as const;
export type ApiOrderStatus = (typeof ORDER_STATUSES)[number];

export const toDbStatus = (status: ApiOrderStatus) => status.toUpperCase() as OrderStatus;

export function toOrder(order: Order & { items: OrderItem[] }) {
  return {
    id: order.id,
    customerId: order.customerId,
    restaurantId: order.restaurantId,
    status: order.status.toLowerCase() as ApiOrderStatus,
    items: order.items.map((item) => ({ menuItemId: item.menuItemId, name: item.name, unitPriceMinor: item.unitPriceMinor, quantity: item.quantity })),
    subtotalMinor: order.subtotalMinor,
    deliveryFeeMinor: order.deliveryFeeMinor,
    totalMinor: order.totalMinor,
    currency: order.currency,
    notes: order.notes,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

// Which status may follow which. Anything not listed is refused with 409.
export const NEXT_STATUS: Record<ApiOrderStatus, ApiOrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered"],
  delivered: [],
  cancelled: [],
};
