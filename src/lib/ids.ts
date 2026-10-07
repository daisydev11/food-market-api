import { randomBytes } from "node:crypto";

// Identifiers are generated, not sequential. A sequential id (1, 2, 3...) lets
// anyone walk the whole dataset by counting and tells them how many records
// exist. These are a type prefix plus 20 random characters.

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
export const ID_PREFIX = { restaurant: "rst", menuItem: "itm", customer: "cus", order: "ord", orderItem: "oit" } as const;
type Kind = keyof typeof ID_PREFIX;

export function newId(kind: Kind): string {
  const bytes = randomBytes(20);
  let out = "";
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length];
  return `${ID_PREFIX[kind]}_${out}`;
}

/** True if the string has the shape of an id of this kind. Anything else is answered 404 without a query. */
export function isId(kind: Kind, value: string): boolean {
  return new RegExp(`^${ID_PREFIX[kind]}_[0-9a-z]{20}$`).test(value);
}
