// The storyline: a prologue shown right after loading, a chapter per level
// (intro and level-complete screens) and an epilogue after the last level.
// Kept out of the level config files, which other team members own.

export const PROLOGUE = [
  {
    eyebrow: 'Port Saffron',
    title: 'A town that loved to eat',
    text: [
      'Port Saffron never sleeps, and it never stops eating. For forty years the best kitchen in town was The Golden Ladle, run by your grandmother, Gran Nandi.',
      'Every kid in the neighbourhood learnt what real food tasted like at her counter, and you learnt to cook standing on a crate beside her stove.',
    ],
  },
  {
    eyebrow: 'Then came MegaMunch',
    title: 'The grey years',
    text: [
      'MegaMunch Corp rolled into town with microwaved patties, powdered broth and a kiosk on every corner. One by one, the little kitchens closed.',
      'The Golden Ladle was the last to go. Gran hung up her apron and the bank put a padlock on the door.',
    ],
  },
  {
    eyebrow: 'Today',
    title: 'One apron, one recipe book',
    text: [
      'Now it\'s your turn. You have Gran\'s battered recipe book, her old apron and a lot of nerve.',
      'Three kitchens across town are about to shut down for good: a burger truck in Sunset Park, a noodle bar in Lantern Alley and an all-night diner downtown. Their owners have one last hope, and that\'s you.',
    ],
  },
  {
    eyebrow: 'Your mission',
    title: 'Win back the town, one plate at a time',
    text: [
      'Work each shift, hit the earnings target and keep the customers happy. Every kitchen you save puts you closer to buying back The Golden Ladle.',
      'Cook fast, don\'t burn anything, and don\'t let them walk out. Ready, Chef?',
    ],
  },
];

// One chapter per level, keyed by the level's `id`.
export const CHAPTERS = {
  1: {
    chapter: 'Chapter 1',
    title: 'A truck called Hope',
    text: 'Old Sam has parked his burger truck in Sunset Park for twenty years, but these days the lunch crowd walks straight past it to the MegaMunch kiosk. He tosses you the keys: "Show them what a real burger tastes like, kid."',
    outro: 'The queue stretches past the fountain and the MegaMunch kiosk sits empty. Sam is grinning, and word of your burgers is already spreading across town.',
  },
  2: {
    chapter: 'Chapter 2',
    title: 'Lanterns after dark',
    text: 'Auntie Mei\'s noodle bar in Lantern Alley is three rent cheques away from closing. She heard about the burger truck and needs a second pair of hands at the pot, because tonight the late-night crowd is coming back.',
    outro: 'The last bowl is scraped clean and Auntie Mei turns off the lanterns with a full till. Before you leave she slips you a note: "The Neon Diner downtown is next. Be careful."',
  },
  3: {
    chapter: 'Chapter 3',
    title: 'The last diner downtown',
    text: 'The Neon Diner is the last independent kitchen in the shadow of the MegaMunch tower, and its wiring is falling apart. Survive one all-night shift and you\'ll have enough saved to buy back The Golden Ladle.',
    outro: 'Dawn breaks over the city and the diner is still standing, and still full.',
  },
};

export const EPILOGUE = [
  'The truck, the noodle bar and the diner are all packed every night, and MegaMunch has quietly pulled its kiosks out of Port Saffron.',
  'With your savings you buy back The Golden Ladle. On opening night Gran Nandi takes the seat by the window, tastes the first plate and smiles: "Now that\'s a real kitchen."',
];
