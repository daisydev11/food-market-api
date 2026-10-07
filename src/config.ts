// Every tunable number for the API lives here, not in a handler.

export const config = {
  pagination: {
    defaultLimit: 20,
    // A larger limit is clamped to this, never honoured and never an error.
    maxLimit: 100,
  },
  rateLimit: {
    // Per IP address, per window.
    read: { max: 100, windowMs: 60_000 },
    // POST, PATCH and DELETE change data for everyone, so they get a tighter allowance.
    write: { max: 20, windowMs: 60_000 },
  },
  orders: {
    maxItemsPerOrder: 20,
    maxQuantityPerItem: 20,
    maxNotesLength: 500,
  },
} as const;

export type RateLimitRule = { max: number; windowMs: number };
