import { z } from "zod";
import { config } from "@/config";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/http";
import { isId, newId } from "@/lib/ids";
import { NEXT_STATUS, ORDER_STATUSES, toDbStatus, toOrder, type ApiOrderStatus } from "@/lib/resources";

const { maxItemsPerOrder, maxQuantityPerItem, maxNotesLength } = config.orders;
const required = (name: string) => ({ required_error: `${name} is required.`, invalid_type_error: `${name} has the wrong type.` });
const notes = z.string(required("notes")).trim().max(maxNotesLength, `notes must be at most ${maxNotesLength} characters.`);

export const createOrderSchema = z
  .object({
    customerId: z.string(required("customerId")).refine((v) => isId("customer", v), "customerId is not a valid customer id."),
    restaurantId: z.string(required("restaurantId")).refine((v) => isId("restaurant", v), "restaurantId is not a valid restaurant id."),
    items: z
      .array(
        z
          .object({
            menuItemId: z.string(required("menuItemId")).refine((v) => isId("menuItem", v), "menuItemId is not a valid menu item id."),
            quantity: z.number(required("quantity")).int("quantity must be a whole number.").min(1, "quantity must be at least 1.").max(maxQuantityPerItem, `quantity must be at most ${maxQuantityPerItem}.`),
          })
          .strict(),
        required("items"),
      )
      .min(1, "items must contain at least one item.")
      .max(maxItemsPerOrder, `items must contain at most ${maxItemsPerOrder} items.`),
    notes: notes.nullable().optional(),
  })
  .strict();

export const updateOrderSchema = z
  .object({
    status: z.enum(ORDER_STATUSES, { errorMap: () => ({ message: `status must be one of: ${ORDER_STATUSES.join(", ")}.` }) }).optional(),
    notes: notes.nullable().optional(),
  })
  .strict()
  .refine((body) => body.status !== undefined || body.notes !== undefined, { message: "Send status, notes, or both.", path: ["body"] });

const invalid = (fields: Record<string, string>) => new ApiError(422, "VALIDATION_FAILED", "The request body is invalid.", fields);

/** Creates an order. Prices come from the menu, never from the client. */
export async function createOrder(input: z.infer<typeof createOrderSchema>) {
  const ids = input.items.map((item) => item.menuItemId);
  const repeated = ids.findIndex((id, index) => ids.indexOf(id) !== index);
  if (repeated !== -1) throw invalid({ [`items.${repeated}.menuItemId`]: "This menu item appears more than once. Use quantity instead." });

  const [customer, restaurant, menuItems] = await Promise.all([
    db.customer.findUnique({ where: { id: input.customerId }, select: { id: true } }),
    db.restaurant.findUnique({ where: { id: input.restaurantId }, select: { id: true, isOpen: true, deliveryFeeMinor: true, currency: true } }),
    db.menuItem.findMany({ where: { id: { in: ids } } }),
  ]);
  if (!customer) throw invalid({ customerId: "No customer has this id." });
  if (!restaurant) throw invalid({ restaurantId: "No restaurant has this id." });
  if (!restaurant.isOpen) throw invalid({ restaurantId: "This restaurant is closed and is not taking orders." });

  const byId = new Map(menuItems.map((item) => [item.id, item]));
  const lines = input.items.map((line, index) => {
    const item = byId.get(line.menuItemId);
    if (!item) throw invalid({ [`items.${index}.menuItemId`]: "No menu item has this id." });
    if (item.restaurantId !== restaurant.id) throw invalid({ [`items.${index}.menuItemId`]: "This menu item belongs to a different restaurant." });
    if (!item.isAvailable) throw invalid({ [`items.${index}.menuItemId`]: "This menu item is currently unavailable." });
    // Name and price are copied onto the order, so it stays correct if the menu changes later.
    return { id: newId("orderItem"), menuItemId: item.id, name: item.name, unitPriceMinor: item.priceMinor, quantity: line.quantity };
  });

  const subtotalMinor = lines.reduce((sum, line) => sum + line.unitPriceMinor * line.quantity, 0);
  const order = await db.order.create({
    data: {
      id: newId("order"),
      customerId: customer.id,
      restaurantId: restaurant.id,
      subtotalMinor,
      deliveryFeeMinor: restaurant.deliveryFeeMinor,
      totalMinor: subtotalMinor + restaurant.deliveryFeeMinor,
      currency: restaurant.currency,
      notes: input.notes || null,
      items: { create: lines },
    },
    include: { items: true },
  });
  return toOrder(order);
}

/** Partial update: status (only along an allowed transition) and/or notes. */
export async function updateOrder(id: string, input: z.infer<typeof updateOrderSchema>) {
  const existing = await db.order.findUnique({ where: { id }, select: { status: true } });
  if (!existing) throw new ApiError(404, "NOT_FOUND", "Order not found");
  const current = existing.status.toLowerCase() as ApiOrderStatus;

  if (input.status && input.status !== current && !NEXT_STATUS[current].includes(input.status)) {
    const allowed = NEXT_STATUS[current];
    throw new ApiError(409, "INVALID_TRANSITION", `An order that is ${current} cannot become ${input.status}. ${allowed.length ? `Allowed: ${allowed.join(", ")}.` : "It is final."}`);
  }
  // The WHERE repeats the status we read, so two simultaneous updates cannot both apply.
  const changed = await db.order.updateMany({
    where: { id, status: existing.status },
    data: { ...(input.status ? { status: toDbStatus(input.status) } : {}), ...(input.notes !== undefined ? { notes: input.notes || null } : {}) },
  });
  if (changed.count !== 1) throw new ApiError(409, "CONFLICT", "The order was changed by another request. Read it again and retry.");
  return toOrder(await db.order.findUniqueOrThrow({ where: { id }, include: { items: true } }));
}

/** Removes an order. Only one that has not started (pending) or was cancelled. */
export async function deleteOrder(id: string) {
  const removed = await db.order.deleteMany({ where: { id, status: { in: ["PENDING", "CANCELLED"] } } });
  if (removed.count === 1) return;
  const exists = await db.order.count({ where: { id } });
  if (!exists) throw new ApiError(404, "NOT_FOUND", "Order not found");
  throw new ApiError(409, "ORDER_IN_PROGRESS", "Only a pending or cancelled order can be deleted.");
}
