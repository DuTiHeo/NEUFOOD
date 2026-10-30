// Reads seed SQL as data only and prints a patch for the local frontend menu.
import { readFileSync } from 'node:fs';
const sql = readFileSync(process.argv[2], 'utf8');
function rows(table) {
  const block = sql.match(new RegExp(`INSERT INTO ${table} \\([^]*?\\)\\s*VALUES([^]*?)ON CONFLICT`))?.[1];
  if (!block) throw new Error(`Missing ${table}`);
  return [...block.replace(/^\s*--.*$/gm, '').matchAll(/\(((?:'(?:[^']|'')*'|[^()'])*)\)/g)].map((row) =>
    [...row[1].matchAll(/'(?:[^']|'')*'|[^,\s][^,]*/g)].map(([token]) => {
      token = token.trim();
      if (token.startsWith("'")) return token.slice(1, -1).replaceAll("''", "'");
      if (/^(TRUE|FALSE)$/i.test(token)) return token.toUpperCase() === 'TRUE';
      if (token === 'NULL') return null;
      return Number(token);
    }));
}
const categories = rows('categories').map(([id, label, description, display_order, is_active]) => ({ id, label, description, display_order, is_active }));
const mappings = rows('dish_categories');
const badges = rows('dish_badges');
const dishes = rows('dishes').map(([id, name, shortDescription, description, basePrice, systemFee, price, rating, reviewCount, image, is_available, is_active, is_deleted]) => ({
  id, name, shortDescription, description, basePrice, systemFee, price, rating, reviewCount, image, is_available, is_active, is_deleted,
  categoryIds: mappings.filter(([dishId]) => dishId === id).map(([, category]) => category),
  badges: badges.filter(([, dishId]) => dishId === id).map(([, , badge]) => badge),
}));
if (!dishes.length || new Set(dishes.map(({ id }) => id)).size !== dishes.length) throw new Error('Invalid dish IDs');
const content = `// Synced from the supplied sample_data.sql; prices include the system fee.\nexport const MENU_CATEGORIES = ${JSON.stringify(categories, null, 2)}\n\nexport const dishes = ${JSON.stringify(dishes, null, 2)}\n\nexport const combos = dishes.filter((dish) => dish.categoryIds.includes('combos'))\nexport const getComboById = (id) => combos.find((dish) => dish.id === id)\nexport const getDishById = (id) => dishes.find((dish) => dish.id === id)\nexport const suggestedDishes = dishes.filter((dish) => ['pho', 'bun-cha', 'com-tam'].includes(dish.id))\n`;
const old = readFileSync(new URL('../src/data/dishes.js', import.meta.url), 'utf8');
console.log('*** Begin Patch\n*** Update File: C:/Users/ManhDuc/Desktop/NEUFOOD/frontend/src/data/dishes.js\n@@\n' + old.trimEnd().split(/\r?\n/).map((line) => '-' + line).join('\n') + '\n' + content.trimEnd().split('\n').map((line) => '+' + line).join('\n') + '\n*** End Patch');
