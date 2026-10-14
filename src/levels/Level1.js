// Level 1 — Burger Truck: learn the core loop (grab → cook → assemble → serve).
export default {
  id: 1,
  name: 'Burger Truck',
  tagline: 'Sunny lunch rush at the park.',
  mechanic: 'The basics: grab ingredients, grill patties before they burn, stack them on the board and serve. Pour colas at the dispenser.',
  story: {
    chapter: 'Chapter 1',
    title: 'A truck called Hope',
    text: 'Old Sam has parked his burger truck in Sunset Park for twenty years, but these days the lunch crowd walks straight past it to the MegaMunch kiosk. He tosses you the keys: "Show them what a real burger tastes like, kid."',
    outro: 'The queue stretches past the fountain and the MegaMunch kiosk sits empty. Sam is grinning, and word of your burgers is already spreading across town.',
  },
  theme: 'truck',
  lighting: 'day',
  weather: 'none',
  ambience: { park: 0.8 }, // birds and people in the park (audio/AudioManager.js LOOPS)
  footsteps: 'concrete',
  // Bloom runs on the linear image before tone mapping, so a low threshold
  // made every sunlit light surface glow. At 1.6 only real emitters (the
  // festoon bulbs) bloom; sunlit whites keep their texture and shading.
  post: { bloom: 0.12, threshold: 1.6, bloomRadius: 0.4, saturation: 1.08, vignette: 0.3, tint: 0xfff3df },
  exposure: 0.9,
  // Recorded track, with the synth tune as a fallback if it fails to load.
  // Volume 2.4 brings its -15.3 dB mean level in line with the other tracks.
  music: { file: 'music/feel-good-island', volume: 2.4, tempo: 116, root: 60, scale: [0, 2, 4, 7, 9, 12], progression: [0, 5, 7, 5], wave: 'triangle' },

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
    { type: 'board', row: 'front', x: -1.1 },
    { type: 'dispenser', item: 'cola', row: 'front', x: 1.1 },
    { type: 'trash', row: 'front', x: 4.5 },
  ],
};
