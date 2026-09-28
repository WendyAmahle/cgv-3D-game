// Level 1 — Burger Truck: learn the core loop (grab → cook → assemble → serve).
export default {
  id: 1,
  name: 'Burger Truck',
  tagline: 'Sunny lunch rush at the park.',
  mechanic: 'The basics: grab ingredients, grill patties before they burn, stack them on the board and serve. Pour colas at the dispenser.',
  theme: 'truck',
  lighting: 'day',
  weather: 'none',
  post: { bloom: 0.15, threshold: 0.9, saturation: 1.1, vignette: 0.25, tint: 0xfff6ea },
  music: { tempo: 116, root: 60, scale: [0, 2, 4, 7, 9, 12], progression: [0, 5, 7, 5], wave: 'triangle' },

  duration: 150,
  targetMoney: 70,
  maxMisses: 4,
  customerSlots: 2,
  spawnInterval: [9, 13],
  patience: [45, 55],
  recipes: ['burger', 'burger', 'cheeseburger', 'cola', 'burgerCombo'],

  stations: [
    { type: 'crate', item: 'bun', row: 'back', x: -3.6 },
    { type: 'crate', item: 'patty', row: 'back', x: -1.2 },
    { type: 'crate', item: 'lettuce', row: 'back', x: 1.2 },
    { type: 'crate', item: 'cheese', row: 'back', x: 3.6 },
    { type: 'grill', row: 'front', x: -4.5 },
    { type: 'board', row: 'front', x: -1.5 },
    { type: 'dispenser', item: 'cola', row: 'front', x: 1.5 },
    { type: 'trash', row: 'front', x: 4.5 },
  ],
};
