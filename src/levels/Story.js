// The storyline: a prologue played before the player first sees the levels,
// and an epilogue after the last one. Each level's own chapter lives in its
// config file as `story` (shown on the intro and level-complete screens).

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

export const EPILOGUE = [
  'The truck, the noodle bar and the diner are all packed every night, and MegaMunch has quietly pulled its kiosks out of Port Saffron.',
  'With your savings you buy back The Golden Ladle. On opening night Gran Nandi takes the seat by the window, tastes the first plate and smiles: "Now that\'s a real kitchen."',
];
