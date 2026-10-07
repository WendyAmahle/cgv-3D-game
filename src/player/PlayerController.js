import * as THREE from 'three';
import { KEYS, LAYOUT, matches } from '../utils/Constants.js';
import { createSelectionRing } from '../world/Models.js';

const ROWS = ['back', 'front', 'customers'];
const DRAG_THRESHOLD = 6; // pixels the mouse must move before a press becomes a drag
const RING = { select: 0xfff08a, ok: 0x4ade80, bad: 0xf87171 };

// Mouse and keyboard control over gameplay targets.
// A target is { kind, row, x, object, focus, title(), status() } (see Gameplay.buildTargets).
//
// Mouse: drag and drop. Press on a station that has something to give (crate,
// cooked food, a full drink, the plate on the board), drag it over another
// station or a customer and release. The ring turns green where it can go and
// red where it can't; invalid drops go back where they came from. A plain click
// (no drag) uses the station, e.g. to start pouring a drink.
//
// Keyboard: A/D and W/S move the selection, Space/Enter uses it (pick up / put down).
//
// Letting go over empty space drops the item, thrown with the cursor's speed.
//
// handlers: { interact(target), pickUp(target) → bool, canGive(target) → bool,
//             canDrop(target) → bool, drop(target | null, source), spill(source, velocity) }
export class PlayerController {
  constructor(camera, dom, player, handlers) {
    this.camera = camera;
    this.dom = dom;
    this.player = player;
    this.handlers = handlers;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.pointerMoved = false;
    this.targets = [];
    this.selected = null;
    this.enabled = false;
    this.press = null; // { target, x, y, moved }
    this.drag = null; // { source, over }
    this.ring = createSelectionRing();
    this.ring.visible = false;
    this.worldPosition = new THREE.Vector3();
    this.dragGoal = new THREE.Vector3();
    this.dragLast = new THREE.Vector3();
    this.dragVelocity = new THREE.Vector3();
    this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(LAYOUT.counterTopY + 0.5));

    dom.addEventListener('pointerdown', (event) => this.onPointerDown(event));
    dom.addEventListener('pointermove', (event) => this.onPointerMove(event));
    dom.addEventListener('pointerup', (event) => this.onPointerUp(event));
    dom.addEventListener('pointercancel', () => this.cancelDrag());
  }

  // ------------------------------------------------------------------ mouse

  onPointerDown(event) {
    if (!this.enabled || event.button !== 0) return;
    this.setPointer(event);
    const target = this.pick();
    if (!target) return;
    this.select(target);
    this.press = { target, x: event.clientX, y: event.clientY, moved: false };
    this.dom.setPointerCapture?.(event.pointerId);
  }

  onPointerMove(event) {
    this.setPointer(event);
    this.pointerMoved = true;
    const press = this.press;
    if (!press || this.drag || press.moved) return;
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) < DRAG_THRESHOLD) return;
    press.moved = true;
    this.beginDrag(press.target);
  }

  onPointerUp(event) {
    const press = this.press;
    this.press = null;
    this.dom.releasePointerCapture?.(event.pointerId);
    if (this.drag) this.endDrag();
    else if (press && !press.moved && this.enabled) this.handlers.interact(press.target);
  }

  beginDrag(source) {
    if (!this.enabled || !this.handlers.pickUp(source)) return;
    this.drag = { source, over: null };
    this.player.setDragging(true);
    source.focus.getWorldPosition(this.player.dragRoot.position).add({ x: 0, y: 0.5, z: 0 });
    this.dragVelocity.set(0, 0, 0);
    this.updateDrag(0);
  }

  endDrag() {
    const { source, over } = this.drag;
    this.drag = null;
    if (over) this.handlers.drop(over, source);
    else this.handlers.spill(source, this.dragVelocity.clampLength(0, 5));
    this.player.setDragging(false);
    this.select(over ?? source);
  }

  // Abandons a drag (pause, focus loss): the item goes back where it came from.
  cancelDrag() {
    this.press = null;
    if (!this.drag) return;
    const { source } = this.drag;
    this.drag = null;
    this.handlers.drop(null, source);
    this.player.setDragging(false);
  }

  updateDrag(dt) {
    const over = this.pick();
    this.drag.over = over;
    this.selected = over;

    // Hover above the target it would land on, otherwise follow the cursor.
    if (over && over !== this.drag.source && this.handlers.canDrop(over)) {
      over.focus.getWorldPosition(this.dragGoal);
      this.dragGoal.y += over.kind === 'customer' ? 1.3 : 0.55;
    } else if (!this.raycaster.ray.intersectPlane(this.dragPlane, this.dragGoal)) {
      return;
    }
    const root = this.player.dragRoot;
    this.dragLast.copy(root.position);
    // Snappy but not jittery: a touchpad's lower-frequency updates still read
    // as an immediate response instead of the held item visibly trailing behind.
    root.position.lerp(this.dragGoal, dt ? 1 - Math.exp(-dt * 38) : 1);
    if (dt) {
      // Smoothed hand speed, so a flick of the mouse throws the item.
      this.dragLast.subVectors(root.position, this.dragLast).divideScalar(dt).multiplyScalar(0.6);
      this.dragVelocity.lerp(this.dragLast, 1 - Math.exp(-dt * 26));
    }
  }

  // --------------------------------------------------------------- picking

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
    this.press = null;
    if (this.drag) {
      this.drag = null;
      this.player.setDragging(false);
    }
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
  }

  // -------------------------------------------------------------- keyboard

  // Returns true if the key was used.
  handleKey(code) {
    if (!this.enabled || !this.selected || this.drag) return false;
    if (matches(code, KEYS.left)) this.step(-1);
    else if (matches(code, KEYS.right)) this.step(1);
    else if (matches(code, KEYS.up)) this.changeRow(-1);
    else if (matches(code, KEYS.down)) this.changeRow(1);
    else if (matches(code, KEYS.interact)) this.handlers.interact(this.selected);
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

  // ---------------------------------------------------------------- update

  update(dt, time) {
    if (this.drag) {
      this.updateDrag(dt);
    } else if (this.enabled && this.pointerMoved && !this.press) {
      this.pointerMoved = false;
      const hovered = this.pick();
      if (hovered) this.select(hovered);
      this.dom.style.cursor = hovered ? (this.handlers.canGive(hovered) ? 'grab' : 'pointer') : 'default';
    }
    if (this.drag) this.dom.style.cursor = 'grabbing';

    this.ring.visible = Boolean(this.selected) && this.enabled;
    if (!this.ring.visible) return;

    let color = RING.select;
    if (this.drag && this.selected !== this.drag.source) color = this.handlers.canDrop(this.selected) ? RING.ok : RING.bad;
    this.ring.material.color.setHex(color);

    this.selected.focus.getWorldPosition(this.worldPosition);
    this.ring.position.copy(this.worldPosition);
    this.ring.position.y += 0.03;
    this.ring.scale.setScalar(1 + Math.sin(time * 5) * 0.06);
  }
}
