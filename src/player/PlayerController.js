import * as THREE from 'three';
import { KEYS, matches } from '../utils/Constants.js';
import { createSelectionRing } from '../world/Models.js';

const ROWS = ['back', 'front', 'customers'];

// Mouse raycasting + keyboard navigation over gameplay targets.
// A target is { kind, row, x, object, focus, title(), status() } (see Gameplay.buildTargets).
export class PlayerController {
  constructor(camera, dom, onInteract) {
    this.camera = camera;
    this.dom = dom;
    this.onInteract = onInteract;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.pointerMoved = false;
    this.targets = [];
    this.selected = null;
    this.enabled = false;
    this.ring = createSelectionRing();
    this.ring.visible = false;
    this.worldPosition = new THREE.Vector3();

    dom.addEventListener('pointermove', (event) => {
      this.setPointer(event);
      this.pointerMoved = true;
    });

    dom.addEventListener('pointerdown', (event) => {
      if (!this.enabled || event.button !== 0) return;
      this.setPointer(event);
      const target = this.pick();
      if (!target) return;
      this.select(target);
      this.onInteract(target);
    });
  }

  setPointer(event) {
    const rect = this.dom.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
  }

  setTargets(targets) {
    this.targets = targets;
    this.select(targets.find((target) => target.row === 'front') ?? targets[0] ?? null);
  }

  clear() {
    this.targets = [];
    this.select(null);
  }

  pick() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(
      this.targets.map((target) => target.object),
      true
    );
    for (const hit of hits) {
      const target = this.targetFor(hit.object);
      if (target) return target;
    }
    return null;
  }

  targetFor(object) {
    for (let node = object; node; node = node.parent) {
      const target = this.targets.find((candidate) => candidate.object === node);
      if (target) return target;
    }
    return null;
  }

  select(target) {
    this.selected = target;
    this.ring.visible = Boolean(target) && this.enabled;
  }

  // Returns true if the key was used.
  handleKey(code) {
    if (!this.enabled || !this.selected) return false;
    if (matches(code, KEYS.left)) this.step(-1);
    else if (matches(code, KEYS.right)) this.step(1);
    else if (matches(code, KEYS.up)) this.changeRow(-1);
    else if (matches(code, KEYS.down)) this.changeRow(1);
    else if (matches(code, KEYS.interact)) this.onInteract(this.selected);
    else return false;
    return true;
  }

  rowTargets(row) {
    return this.targets.filter((target) => target.row === row).sort((a, b) => a.x - b.x);
  }

  step(direction) {
    const row = this.rowTargets(this.selected.row);
    const index = row.indexOf(this.selected);
    this.select(row[(index + direction + row.length) % row.length]);
  }

  changeRow(direction) {
    const current = ROWS.indexOf(this.selected.row);
    for (let index = current + direction; index >= 0 && index < ROWS.length; index += direction) {
      const row = this.rowTargets(ROWS[index]);
      if (!row.length) continue;
      const x = this.selected.x;
      this.select(row.reduce((best, target) => (Math.abs(target.x - x) < Math.abs(best.x - x) ? target : best)));
      return;
    }
  }

  update(dt, time) {
    if (this.enabled && this.pointerMoved) {
      this.pointerMoved = false;
      const hovered = this.pick();
      if (hovered) this.select(hovered);
      this.dom.style.cursor = hovered ? 'pointer' : 'default';
    }

    this.ring.visible = Boolean(this.selected) && this.enabled;
    if (!this.ring.visible) return;
    this.selected.focus.getWorldPosition(this.worldPosition);
    this.ring.position.copy(this.worldPosition);
    this.ring.position.y += 0.03;
    this.ring.scale.setScalar(1 + Math.sin(time * 5) * 0.06);
  }
}
