// Shared layout numbers so the world, gameplay and cameras agree on where things are.
export const LAYOUT = {
  counterTopY: 1.1,
  counterLength: 13,
  frontRowZ: 1.2, // cooking / assembly stations (customer side)
  backRowZ: -1.0, // ingredient crates (chef side)
  backWallZ: -4.4,
  customerZ: 4.2,
};

export const STORAGE_KEY = 'bistro-rush-progress-v1';

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
};

export const matches = (code, list) => list.includes(code);

export const randomRange = ([min, max]) => min + Math.random() * (max - min);

export const pick = (list) => list[Math.floor(Math.random() * list.length)];
