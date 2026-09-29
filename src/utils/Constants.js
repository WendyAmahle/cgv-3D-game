// Shared layout numbers so the world, gameplay and cameras agree on where things are.
export const LAYOUT = {
  counterTopY: 1.1,
  counterLength: 13,
  frontRowZ: 1.2, // cooking / assembly stations (customer side)
  backRowZ: -1.0, // ingredient crates (chef side)
  backWallZ: -4.4,
  customerZ: 2.9,
};

// Objects on this layer are drawn only by the minimap camera.
export const MINIMAP_LAYER = 1;

export const STORAGE_KEY = 'bistro-rush-progress-v1';

// While developing, every level is playable from Level select.
// Set to false before the final submission so levels unlock in order.
export const UNLOCK_ALL_LEVELS = true;

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
  cycleCamera: ['KeyC'],
  minimap: ['KeyN'],
};

export const matches = (code, list) => list.includes(code);

export const randomRange = ([min, max]) => min + Math.random() * (max - min);

export const pick = (list) => list[Math.floor(Math.random() * list.length)];
