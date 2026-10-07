// Seed script. Repeatable: run it as many times as you like and the row
// counts do not change.
//
//   npm run seed                              (uses DATABASE_URL from .env)
//   DATABASE_URL="<production url>" npm run seed
//
// How it stays repeatable: Faker is given a fixed seed, so every run generates
// exactly the same records with exactly the same identifiers, and every insert
// uses skipDuplicates. A second run finds every id already present and inserts
// nothing. Orders created later through the API have other ids and are left alone.
import { faker } from "@faker-js/faker";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

try {
  process.loadEnvFile(".env");
} catch {}
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set.");
const schema = new URL(url).searchParams.get("schema") ?? "public";
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }, { schema }) });

faker.seed(20261007);
const NOW = new Date("2026-10-01T12:00:00Z"); // fixed, so dates are identical on every run
const id = (prefix) => `${prefix}_${faker.string.alphanumeric({ length: 20, casing: "lower" })}`;
const pick = (list) => faker.helpers.arrayElement(list);
const naira = (min, max) => faker.number.int({ min: min / 50, max: max / 50 }) * 50 * 100; // kobo, in steps of NGN 50
const daysAgo = (max) => new Date(NOW.getTime() - faker.number.int({ min: 0, max: max * 24 * 60 }) * 60_000);

const CITIES = ["Lagos", "Abuja", "Port Harcourt", "Ibadan", "Kano", "Enugu", "Benin City", "Kaduna"];
const CUISINES = {
  nigerian: { places: ["Buka", "Kitchen", "Canteen", "Pot"], mains: ["Jollof Rice and Chicken", "Egusi Soup with Pounded Yam", "Ofada Rice and Ayamase", "Amala and Ewedu", "Efo Riro with Semo", "Pepper Soup", "Fried Rice and Turkey", "Beans and Dodo", "Okra Soup with Eba", "Native Rice"] },
  grill: { places: ["Grill", "Suya Spot", "Barbecue", "Smokehouse"], mains: ["Beef Suya", "Chicken Suya", "Grilled Catfish", "Asun", "Barbecue Ribs", "Grilled Half Chicken", "Kilishi Platter", "Peppered Gizzard", "Mixed Grill Platter", "Grilled Tilapia"] },
  pizza: { places: ["Pizzeria", "Pizza House", "Slice", "Oven"], mains: ["Margherita Pizza", "Pepperoni Pizza", "Suya Pizza", "Chicken BBQ Pizza", "Veggie Supreme Pizza", "Meat Feast Pizza", "Hawaiian Pizza", "Four Cheese Pizza", "Seafood Pizza", "Calzone"] },
  burgers: { places: ["Burgers", "Burger Joint", "Patty Bar", "Diner"], mains: ["Classic Beef Burger", "Double Cheeseburger", "Crispy Chicken Burger", "Spicy Zinger Burger", "Veggie Burger", "Fish Burger", "Bacon Burger", "Loaded Hot Dog", "Chicken Wrap", "Beef Wrap"] },
  chinese: { places: ["Wok", "Dragon", "Noodle Bar", "Garden"], mains: ["Special Fried Rice", "Chicken Chow Mein", "Sweet and Sour Chicken", "Beef in Black Bean Sauce", "Singapore Noodles", "Szechuan Prawns", "Kung Pao Chicken", "Egg Fried Rice", "Crispy Shredded Beef", "Vegetable Stir Fry"] },
  indian: { places: ["Tandoor", "Curry House", "Spice Room", "Masala"], mains: ["Chicken Tikka Masala", "Butter Chicken", "Lamb Rogan Josh", "Vegetable Biryani", "Chicken Biryani", "Paneer Butter Masala", "Dal Tadka", "Prawn Curry", "Chana Masala", "Tandoori Chicken"] },
  seafood: { places: ["Seafood", "Fish Market", "Catch", "Harbour"], mains: ["Peppered Prawns", "Seafood Okra", "Grilled Lobster", "Fisherman Soup", "Calamari and Chips", "Fish and Chips", "Seafood Pasta", "Crab Claws", "Prawn Fried Rice", "Grilled Croaker"] },
  shawarma: { places: ["Shawarma", "Wraps", "Shawarma Hub", "Roll"], mains: ["Chicken Shawarma", "Beef Shawarma", "Double Sausage Shawarma", "Mixed Shawarma", "Chicken Shawarma Plate", "Falafel Wrap", "Chicken Kebab", "Beef Kebab", "Shawarma Rice Bowl", "Loaded Fries with Chicken"] },
  vegan: { places: ["Greens", "Plant Kitchen", "Leaf", "Garden Table"], mains: ["Plantain and Bean Bowl", "Jollof Quinoa", "Grilled Vegetable Wrap", "Mushroom Stir Fry", "Lentil Curry", "Tofu Suya Bowl", "Vegan Egusi", "Chickpea Salad", "Coconut Rice with Vegetables", "Stuffed Peppers"] },
  bakery: { places: ["Bakery", "Bakehouse", "Pastries", "Oven House"], mains: ["Meat Pie", "Chicken Pie", "Sausage Roll", "Chicken Sandwich", "Club Sandwich", "Egg Roll", "Fish Roll", "Beef Sandwich", "Tuna Sandwich", "Scotch Egg"] },
};
const SHARED = {
  starter: ["Spring Rolls", "Samosas", "Chicken Wings", "Peppered Snails", "Puff Puff", "Garden Salad", "Soup of the Day"],
  side: ["Fried Plantain", "Coleslaw", "French Fries", "Moi Moi", "Steamed Rice", "Yam Chips", "Garlic Bread"],
  dessert: ["Chocolate Cake Slice", "Ice Cream Cup", "Fruit Salad", "Doughnut", "Banana Bread", "Parfait"],
  drink: ["Zobo", "Chapman", "Bottled Water", "Soft Drink", "Fresh Orange Juice", "Smoothie", "Malt Drink"],
};
const PRICE = { starter: [800, 3500], main: [2000, 12000], side: [500, 2500], dessert: [800, 3500], drink: [300, 2500] };

const restaurants = [];
const menuItems = [];
for (let i = 0; i < 200; i++) {
  const cuisine = pick(Object.keys(CUISINES));
  const restaurant = {
    id: id("rst"),
    name: `${faker.person.firstName()}'s ${pick(CUISINES[cuisine].places)}`,
    cuisine,
    city: pick(CITIES),
    address: `${faker.number.int({ min: 1, max: 180 })} ${faker.person.lastName()} Street`,
    rating: faker.number.int({ min: 28, max: 50 }) / 10,
    deliveryFeeMinor: naira(300, 2500),
    currency: "NGN",
    isOpen: faker.datatype.boolean({ probability: 0.85 }),
    createdAt: daysAgo(720),
    updatedAt: NOW,
  };
  restaurants.push(restaurant);
  const menu = [
    ...faker.helpers.arrayElements(CUISINES[cuisine].mains, { min: 5, max: 8 }).map((name) => ["main", name]),
    ...Object.entries(SHARED).flatMap(([category, names]) => faker.helpers.arrayElements(names, { min: 1, max: 3 }).map((name) => [category, name])),
  ];
  for (const [category, name] of menu) {
    menuItems.push({
      id: id("itm"),
      restaurantId: restaurant.id,
      name,
      description: faker.food.description(),
      category,
      priceMinor: naira(...PRICE[category]),
      currency: "NGN",
      isAvailable: faker.datatype.boolean({ probability: 0.9 }),
      createdAt: restaurant.createdAt,
      updatedAt: NOW,
    });
  }
}

const customers = Array.from({ length: 300 }, () => ({ id: id("cus"), name: faker.person.fullName(), city: pick(CITIES), createdAt: daysAgo(540), updatedAt: NOW }));

const menuByRestaurant = new Map();
for (const item of menuItems) menuByRestaurant.set(item.restaurantId, [...(menuByRestaurant.get(item.restaurantId) ?? []), item]);
const orders = [];
const orderItems = [];
for (let i = 0; i < 500; i++) {
  const restaurant = pick(restaurants);
  const chosen = faker.helpers.arrayElements(menuByRestaurant.get(restaurant.id), { min: 1, max: 4 });
  const order = { id: id("ord"), customerId: pick(customers).id, restaurantId: restaurant.id };
  let subtotalMinor = 0;
  for (const item of chosen) {
    const quantity = faker.number.int({ min: 1, max: 3 });
    subtotalMinor += item.priceMinor * quantity;
    // The relationship lesson of this script: an order item copies the name and price,
    // so the order still adds up after the restaurant edits its menu.
    orderItems.push({ id: id("oit"), orderId: order.id, menuItemId: item.id, name: item.name, unitPriceMinor: item.priceMinor, quantity });
  }
  const createdAt = daysAgo(90);
  orders.push({
    ...order,
    status: faker.helpers.weightedArrayElement([
      { weight: 55, value: "DELIVERED" }, { weight: 10, value: "CANCELLED" }, { weight: 10, value: "PENDING" },
      { weight: 8, value: "CONFIRMED" }, { weight: 9, value: "PREPARING" }, { weight: 8, value: "OUT_FOR_DELIVERY" },
    ]),
    subtotalMinor,
    deliveryFeeMinor: restaurant.deliveryFeeMinor,
    totalMinor: subtotalMinor + restaurant.deliveryFeeMinor,
    currency: "NGN",
    notes: faker.datatype.boolean({ probability: 0.2 }) ? pick(["No pepper please", "Call on arrival", "Leave at the gate", "Extra cutlery", "Less oil"]) : null,
    createdAt,
    updatedAt: createdAt,
  });
}

// Parents before children, so every foreign key already has its target.
const tables = [
  ["restaurant", restaurants], ["menuItem", menuItems], ["customer", customers], ["order", orders], ["orderItem", orderItems],
];
console.log(`Seeding schema "${schema}"`);
for (const [model, rows] of tables) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    inserted += (await db[model].createMany({ data: rows.slice(i, i + 500), skipDuplicates: true })).count;
  }
  console.log(`  ${model.padEnd(11)} generated ${String(rows.length).padStart(5)}  inserted ${String(inserted).padStart(5)}  total in table ${await db[model].count()}`);
}
await db.$disconnect();
