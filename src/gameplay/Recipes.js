// Item + recipe data. Dishes are compared by "tags": plain items use their type
// ('bun'), cookable items append their cook stage ('patty:cooked').

export const ITEMS = {
  bun: { label: 'Bun' },
  lettuce: { label: 'Lettuce' },
  cheese: { label: 'Cheese' },
  egg: { label: 'Soft Egg' },
  nori: { label: 'Nori' },

  patty: {
    label: 'Patty',
    cook: { station: 'grill', cookedAt: 5, burntAt: 11 },
    stages: { raw: 'Raw Patty', cooked: 'Cooked Patty', burnt: 'Burnt Patty' },
  },
  pork: {
    label: 'Pork',
    cook: { station: 'grill', cookedAt: 4, burntAt: 10 },
    stages: { raw: 'Raw Pork', cooked: 'Chashu Pork', burnt: 'Charred Pork' },
  },
  potato: {
    label: 'Potato',
    cook: { station: 'fryer', cookedAt: 4, burntAt: 10 },
    stages: { raw: 'Cut Potatoes', cooked: 'Fries', burnt: 'Burnt Fries' },
  },
  noodles: {
    label: 'Noodles',
    cook: { station: 'pot', cookedAt: 6, burntAt: 13 },
    stages: { raw: 'Dry Noodles', cooked: 'Noodles', burnt: 'Soggy Noodles' },
  },

  cola: { label: 'Cola', liquid: { vessel: 'cup', pourTime: 3, color: 0x4a1f0a, foam: 0xe8d3b0 } },
  tea: { label: 'Green Tea', liquid: { vessel: 'cup', pourTime: 3, color: 0x8fb34a, foam: 0xd9ecb0 } },
  broth: { label: 'Broth', liquid: { vessel: 'bowl', pourTime: 4, color: 0xb9773a, foam: 0xf1d9a8 } },
  neonSoda: { label: 'Neon Soda', liquid: { vessel: 'cup', pourTime: 2.5, color: 0x19e3ff, foam: 0xe0fbff } },
};

export const RECIPES = {
  // Level 1 — Burger Truck
  burger: { name: 'Burger', ingredients: ['bun', 'patty:cooked', 'lettuce'], price: 12 },
  cheeseburger: { name: 'Cheeseburger', ingredients: ['bun', 'patty:cooked', 'cheese'], price: 14 },
  cola: { name: 'Cola', ingredients: ['cola'], price: 5 },
  burgerCombo: { name: 'Burger + Cola', ingredients: ['bun', 'patty:cooked', 'lettuce', 'cola'], price: 20 },

  // Level 2 — Ramen Izakaya
  shoyuRamen: { name: 'Shoyu Ramen', ingredients: ['broth', 'noodles:cooked', 'egg', 'nori'], price: 18 },
  chashuRamen: { name: 'Chashu Ramen', ingredients: ['broth', 'noodles:cooked', 'pork:cooked'], price: 20 },
  greenTea: { name: 'Green Tea', ingredients: ['tea'], price: 6 },

  // Level 3 — Cyberpunk Diner
  megaStack: {
    name: 'Mega Stack',
    ingredients: ['bun', 'patty:cooked', 'patty:cooked', 'cheese', 'lettuce'],
    price: 26,
  },
  neonCombo: {
    name: 'Neon Combo',
    ingredients: ['bun', 'patty:cooked', 'potato:cooked', 'neonSoda'],
    price: 28,
  },
  cyberRamen: { name: 'Cyber Ramen', ingredients: ['broth', 'noodles:cooked', 'egg'], price: 20 },
  fries: { name: 'Fries', ingredients: ['potato:cooked'], price: 8 },
};

export function cookStage(type, seconds) {
  const { cookedAt, burntAt } = ITEMS[type].cook;
  if (seconds >= burntAt) return 'burnt';
  if (seconds >= cookedAt) return 'cooked';
  return 'raw';
}

// 0..1 raw → cooked, 1..2 cooked → burnt. Drives the cooking shader's uCook uniform.
export function cookAmount(type, seconds) {
  const { cookedAt, burntAt } = ITEMS[type].cook;
  if (seconds < cookedAt) return seconds / cookedAt;
  return 1 + Math.min(1, (seconds - cookedAt) / (burntAt - cookedAt));
}

export function itemTag(item) {
  return ITEMS[item.type].cook ? `${item.type}:${item.stage}` : item.type;
}

export function tagLabel(tag) {
  const [type, stage] = tag.split(':');
  const def = ITEMS[type];
  return stage ? def.stages[stage] : def.label;
}

export function matchesRecipe(tags, recipeId) {
  const wanted = [...RECIPES[recipeId].ingredients].sort();
  const given = [...tags].sort();
  return wanted.length === given.length && wanted.every((tag, index) => tag === given[index]);
}
