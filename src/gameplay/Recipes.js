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

  // Level 3 molecular cocktail: built shot by shot at the Mixology Bar
  // (item.shots holds the syrup keys in pour order, item.mix 0 → 1 blended).
  cocktail: { label: 'Cocktail', mix: true, vessel: 'cup' },
};

// ---- Molecular mixology (Level 3) ------------------------------------------

export const MIX_SHOTS = 4; // shots in a full glass
export const SYRUP_KEYS = ['c', 'm', 'y'];
export const SYRUPS = {
  c: { label: 'Cyan', color: 0x00e5ff },
  m: { label: 'Magenta', color: 0xff2bd6 },
  y: { label: 'Yellow', color: 0xffd60a },
};

// Cocktails by mix key (shot counts in c, m, y order; pour order doesn't matter).
export const COCKTAILS = {
  c2m2: 'Deep Space',
  m1y3: 'Solar Flare',
  c2y2: 'Toxic Lime',
  c1m3: 'Ultraviolet',
};

// 'c2m2' for two cyan and two magenta shots.
export function mixKey(shots) {
  return SYRUP_KEYS.map((key) => [key, shots.filter((shot) => shot === key).length])
    .filter(([, count]) => count)
    .map(([key, count]) => `${key}${count}`)
    .join('');
}

// 'c2m2' → '2 Cyan + 2 Magenta'
export function mixFormula(key) {
  return [...key.matchAll(/([a-z])(\d)/g)].map(([, syrup, count]) => `${count} ${SYRUPS[syrup].label}`).join(' + ');
}

// Blended colour of a mix as an sRGB hex: the same subtractive mixing as the
// cocktail shader (weighted geometric mean in linear space, like dyes absorbing light).
export function mixColor(key) {
  const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
  const sums = [0, 0, 0];
  let total = 0;
  for (const [, syrup, count] of key.matchAll(/([a-z])(\d)/g)) {
    const hex = SYRUPS[syrup].color;
    [16, 8, 0].forEach((shift, channel) => {
      sums[channel] += Number(count) * Math.log(Math.max(toLinear(((hex >> shift) & 255) / 255), 0.03));
    });
    total += Number(count);
  }
  if (!total) return 0xffffff;
  const [r, g, b] = sums.map((sum) => Math.round(toSrgb(Math.exp(sum / total)) * 255));
  return (r << 16) | (g << 8) | b;
}

const cocktailTag = (item) => (item.shots.length === MIX_SHOTS && item.mix >= 1 ? mixKey(item.shots) : 'unfinished');

export const RECIPES = {
  // Level 1 — Burger Truck
  burger: { name: 'Burger', ingredients: ['bun', 'patty:cooked', 'lettuce'], price: 12 },
  cheeseburger: { name: 'Cheeseburger', ingredients: ['bun', 'patty:cooked', 'cheese'], price: 14 },
  cola: { name: 'Cola', ingredients: ['cola'], price: 5 },
  burgerCombo: { name: 'Burger + Cola', ingredients: ['bun', 'patty:cooked', 'lettuce', 'cola'], price: 20 },

  // Level 2 — Lantern Noodle Bar
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
    ingredients: ['bun', 'patty:cooked', 'potato:cooked', 'cocktail:c2m2'],
    price: 32,
  },
  cyberRamen: { name: 'Cyber Ramen', ingredients: ['broth', 'noodles:cooked', 'egg'], price: 20 },
  fries: { name: 'Fries', ingredients: ['potato:cooked'], price: 8 },
  deepSpace: { name: 'Deep Space', ingredients: ['cocktail:c2m2'], price: 15 },
  solarFlare: { name: 'Solar Flare', ingredients: ['cocktail:m1y3'], price: 15 },
  toxicLime: { name: 'Toxic Lime', ingredients: ['cocktail:c2y2'], price: 15 },
  ultraviolet: { name: 'Ultraviolet', ingredients: ['cocktail:c1m3'], price: 15 },
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
  if (ITEMS[item.type].mix) return `${item.type}:${cocktailTag(item)}`;
  return ITEMS[item.type].cook ? `${item.type}:${item.stage}` : item.type;
}

export function tagLabel(tag) {
  const [type, stage] = tag.split(':');
  const def = ITEMS[type];
  if (def.mix) {
    if (stage === 'unfinished') return 'Unfinished Mix';
    return `${COCKTAILS[stage] ?? 'Mystery Mix'} (${mixFormula(stage)})`;
  }
  return stage ? def.stages[stage] : def.label;
}

// Swatch colour for an order chip, or null for ordinary ingredients.
export function tagColor(tag) {
  const [type, stage] = tag.split(':');
  return ITEMS[type]?.mix && stage !== 'unfinished' ? mixColor(stage) : null;
}

export function matchesRecipe(tags, recipeId) {
  const wanted = [...RECIPES[recipeId].ingredients].sort();
  const given = [...tags].sort();
  return wanted.length === given.length && wanted.every((tag, index) => tag === given[index]);
}
