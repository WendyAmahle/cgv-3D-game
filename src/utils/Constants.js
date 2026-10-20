// Shared layout numbers so the world, gameplay and cameras agree on where things are.
export const LAYOUT = {
  counterTopY: 1.1,
  counterLength: 13,
  frontRowZ: 1.2, // cooking / assembly stations (customer side)
  backRowZ: -1.0, // ingredient crates (chef side)
  backWallZ: -4.4,
  customerZ: 2.9,
};

// Level 3's street: a two-lane road running along x in front of the diner,
// sunk below the pavements on both sides. Cars keep left, as on South African
// roads, so +x traffic uses the lane nearer the diner.
export const STREET = {
  roadY: -0.15,
  kerbNearZ: 6.6, // diner-side kerb (customers walk in along z ≈ 5.4)
  kerbFarZ: 13.6,
  facadeZ: 18.6, // shopfronts across the road
  halfLength: 64, // cars wrap around at x = ±halfLength
  lanes: [
    { z: 8.35, direction: 1 },
    { z: 11.85, direction: -1 },
  ],
  walkways: [
    { z: 15.0, direction: 1 },
    { z: 16.2, direction: -1 },
  ],
};

// Objects on this layer are drawn only by the minimap camera.
export const MINIMAP_LAYER = 1;

export const STORAGE_KEY = 'bistro-rush-progress-v1';

// On the dev server every level is playable from Level select, so the team can
// test any of them; the production build (what is submitted) unlocks them in order.
export const UNLOCK_ALL_LEVELS = import.meta.env.DEV;

// Serving (all levels): drinks can be handed over on their own and the food
// as one plate, in any order; the customer pays once everything has arrived.
// Set to false to go back to serving the whole order at once.
export const SERVE_DRINKS_SEPARATELY = true;

// Keyboard bindings (KeyboardEvent.code values).
export const KEYS = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  interact: ['Space', 'Enter'],
  discard: ['KeyX'],
  pause: ['Escape', 'KeyP'],
  mute: ['KeyM'],
  orbitLeft: ['KeyQ'],
  orbitRight: ['KeyE'],
  recenterCamera: ['KeyR'],
  cycleCamera: ['KeyC'],
  minimap: ['KeyN'],
};

export const matches = (code, list) => list.includes(code);

export const randomRange = ([min, max]) => min + Math.random() * (max - min);

export const pick = (list) => list[Math.floor(Math.random() * list.length)];
