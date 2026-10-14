// Level 2 — Lantern Noodle Bar: boiling + broth, three customers at once, rush hour.
export default {
  id: 2,
  name: 'Lantern Noodle Bar',
  tagline: 'Late-night noodle bar on a Tokyo side street.',
  mechanic: 'Boil noodles in the pot, ladle broth into bowls and juggle three customers at once. Halfway through, rush hour hits.',
  story: {
    chapter: 'Chapter 2',
    title: 'Lanterns after dark',
    text: 'Auntie Mei\'s noodle bar in Lantern Alley is three rent cheques away from closing. She heard about the burger truck and needs a second pair of hands at the pot, because tonight the late-night crowd is coming back.',
    outro: 'The last bowl is scraped clean and Auntie Mei turns off the lanterns with a full till. Before you leave she slips you a note: "The Neon Diner downtown is next. Be careful."',
  },
  theme: 'izakaya',
  lighting: 'night',
  weather: 'none',
  ambience: { insects: 0.1, city: 0.25 }, // faint crickets over a distant city
  footsteps: 'concrete', // slate-tile floor
  post: { bloom: 0.6, threshold: 1.0, bloomRadius: 0.45, saturation: 1.12, vignette: 0.35, tint: 0xf3f0ff },
  exposure: 0.9,
  // "Japanese Modern Loop" (credited in ui/Credits.js); the synth settings play if it fails to load.
  music: { file: 'music/japanese-modern-loop', volume: 3, tempo: 92, root: 57, scale: [0, 3, 5, 7, 10, 12], progression: [0, -4, -2, 0], wave: 'sine' },

  duration: 165,
  targetMoney: 120,
  maxMisses: 5,
  customerSlots: 3,
  spawnInterval: [7, 10],
  patience: [50, 62],
  rushHour: { at: 0.55, spawnScale: 0.65 },
  recipes: ['shoyuRamen', 'chashuRamen', 'chashuRamen', 'greenTea', 'shoyuRamen'],

  stations: [
    { type: 'crate', item: 'noodles', row: 'back', x: -4.5 },
    { type: 'crate', item: 'egg', row: 'back', x: -1.5 },
    { type: 'crate', item: 'pork', row: 'back', x: 1.5 },
    { type: 'crate', item: 'nori', row: 'back', x: 4.5 },
    { type: 'pot', row: 'front', x: -5.3 },
    { type: 'grill', row: 'front', x: -3.2 },
    { type: 'dispenser', item: 'broth', row: 'front', x: -1.05 },
    { type: 'board', row: 'front', x: 1.1 },
    { type: 'dispenser', item: 'tea', row: 'front', x: 3.2 },
    { type: 'trash', row: 'front', x: 5.3 },
  ],
};
