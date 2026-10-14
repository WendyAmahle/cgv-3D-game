// Level 3 — Cyberpunk Diner: molecular mixology (cocktails blended from syrup
// shots at the Mixology Bar), laser-seared plasma steaks (sear, flip, sear),
// fast customers and power-surge events.
export default {
  id: 3,
  name: 'Neon Diner',
  tagline: 'Rain-soaked cyberpunk diner, open all night.',
  mechanic: 'Molecular mixology: pour shots of cyan, magenta and yellow syrup in the right ratio and the stirrer blends them into a cocktail. Laser-seared plasma steaks: the laser sears one side, you flip the steak, it sears the other. Plus impatient night-owl customers and random power surges that overclock a cooker.',
  story: {
    chapter: 'Chapter 3',
    title: 'The last diner downtown',
    text: 'The Neon Diner is the last independent kitchen in the shadow of the MegaMunch tower, and its wiring is falling apart. Survive one all-night shift and you\'ll have enough saved to buy back The Golden Ladle.',
    outro: 'Dawn breaks over the city and the diner is still standing, and still full.',
  },
  theme: 'cyber',
  lighting: 'neon',
  weather: 'rain',
  ambience: { rain: 0.9, city: 0.35 }, // rain on the street, the city at night; cars and thunder come from the world
  footsteps: 'concrete',
  orderDisplay: 'hologram', // orders float over customers as holograms (see world/Models.js)
  post: { bloom: 0.55, threshold: 1.1, bloomRadius: 0.4, saturation: 1.15, vignette: 0.45, tint: 0xf0e6ff },
  exposure: 1.0,
  music: { tempo: 128, root: 50, scale: [0, 3, 7, 10, 12, 15], progression: [0, -2, -4, -5], wave: 'sawtooth' },

  duration: 180,
  targetMoney: 170,
  maxMisses: 5,
  customerSlots: 4,
  spawnInterval: [6, 9],
  patience: [38, 48],
  overclock: { interval: [18, 26], duration: 8 },
  recipes: ['megaStack', 'neonCombo', 'fries', 'plasmaSteak', 'plasmaSteak', 'plasmaPlatter', 'deepSpace', 'solarFlare', 'toxicLime', 'ultraviolet'],

  // Each cooker's ingredient sits right behind it on the back counter.
  stations: [
    { type: 'crate', item: 'patty', row: 'back', x: -5.4 },
    { type: 'crate', item: 'potato', row: 'back', x: -3.6 },
    { type: 'crate', item: 'steak', row: 'back', x: -1.8 },
    { type: 'crate', item: 'bun', row: 'back', x: 0 },
    { type: 'crate', item: 'cheese', row: 'back', x: 1.8 },
    { type: 'crate', item: 'lettuce', row: 'back', x: 3.6 },
    { type: 'grill', row: 'front', x: -5.4 },
    { type: 'fryer', row: 'front', x: -3.6 },
    { type: 'laser', row: 'front', x: -1.8 },
    { type: 'board', row: 'front', x: 0 },
    { type: 'mixer', row: 'front', x: 1.9 },
    { type: 'trash', row: 'front', x: 5.4 },
  ],
};
