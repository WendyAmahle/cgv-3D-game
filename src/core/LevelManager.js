import Level1 from '../levels/Level1.js';
import Level2 from '../levels/Level2.js';
import Level3 from '../levels/Level3.js';
import { buildEnvironment } from '../world/Environment.js';
import { applyLighting } from '../world/Lighting.js';
import { disposeObject } from '../utils/Dispose.js';
import { STORAGE_KEY } from '../utils/Constants.js';

export const LEVELS = [Level1, Level2, Level3];

function loadUnlocked() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Math.min(LEVELS.length, Math.max(1, saved?.unlocked ?? 1));
  } catch {
    return 1;
  }
}

// Level list, unlock progress and building/tearing down level worlds.
export class LevelManager {
  constructor() {
    this.unlocked = loadUnlocked(); // number of playable levels
  }

  get highestUnlocked() {
    return this.unlocked - 1;
  }

  isUnlocked(index) {
    return index < this.unlocked;
  }

  unlockAfter(index) {
    this.unlocked = Math.min(LEVELS.length, Math.max(this.unlocked, index + 2));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ unlocked: this.unlocked }));
    } catch {
      // Progress just won't persist (private mode etc.).
    }
  }

  build(level, scene) {
    const world = buildEnvironment(level);
    const lighting = applyLighting(level.lighting, scene, world.root, world.theme, level.theme);
    scene.add(world.root);
    world.update = (dt, time) => {
      world.animate?.(dt, time);
      lighting.update(dt, time);
    };
    return world;
  }

  dispose(world) {
    world.root.removeFromParent();
    disposeObject(world.root);
  }
}
