import { config } from "@/config";
import { ok, preflight, route } from "@/lib/http";

// The API's front door: what exists and how lists behave.
export const GET = route(async () =>
  ok({
    name: "Food Market API",
    version: "v1",
    resources: {
      restaurants: "/api/v1/restaurants",
      restaurantMenu: "/api/v1/restaurants/{id}/menu",
      menuItems: "/api/v1/menu-items",
      customers: "/api/v1/customers",
      orders: "/api/v1/orders",
    },
    pagination: { defaultLimit: config.pagination.defaultLimit, maxLimit: config.pagination.maxLimit, modes: ["cursor", "offset"] },
    rateLimit: { readsPerMinute: config.rateLimit.read.max, writesPerMinute: config.rateLimit.write.max },
  }),
);
export const OPTIONS = preflight;
