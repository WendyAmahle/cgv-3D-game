// The storyline: a prologue shown right after loading, before the main menu,
// and an epilogue after the last level. Each level's own chapter lives in its
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

// A proper ending, shown after the final level rather than compressed into
// the score screen. The amount is supplied by CampaignFund.
export const finale = (fund, cost) => [
  {
    eyebrow: 'Port Saffron - The fund is full',
    title: 'You made it',
    visual: '💰',
    text: [
      'Your best shifts raised $' + fund + ' for the buy-back fund. You pay the $' + cost + ' asking price and sign the kitchen back into your family name.',
      'The truck, the noodle bar and the diner are packed every night, and MegaMunch has quietly pulled its kiosks out of Port Saffron.',
    ],
  },
  {
    eyebrow: 'The Golden Ladle',
    title: 'The keys are yours',
    visual: '🔑',
    text: [
      'You sign the papers, lift the old padlock from the door and take the keys to the kitchen that started everything.',
      'Gran Nandi puts her recipe book on the counter. This time, the restaurant belongs to your family again.',
    ],
  },
  {
    eyebrow: 'Opening night',
    title: 'The Golden Ladle - Open Again',
    visual: '🏪',
    text: [
      'The lights come on. The first customers fill the tables, and the smell of real food reaches the street.',
      'Gran Nandi takes the seat by the window, tastes the first plate and smiles: "Now that is a real kitchen."',
      'Three kitchens saved. One home restored.',
    ],
  },
];
