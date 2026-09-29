import * as THREE from 'three';
import { events } from '../core/Events.js';
import { disposeItem, refreshItem } from '../gameplay/Items.js';

// The chef's hands: holds one item. Normally it bobs in the bottom-right of
// the view; while dragging with the mouse it follows the cursor in the world
// (dragRoot, positioned by PlayerController).
export class Player {
  constructor(camera) {
    this.held = null;
    this.hand = new THREE.Group();
    this.hand.position.set(0.62, -0.42, -1.3);
    this.hand.scale.setScalar(0.65);
    camera.add(this.hand);
    this.dragRoot = new THREE.Group();
    this.dragging = false;
  }

  setDragging(dragging) {
    this.dragging = dragging;
    if (this.held) this.attach(this.held);
  }

  attach(item) {
    item.mesh.removeFromParent();
    item.mesh.position.set(0, 0, 0);
    item.mesh.rotation.set(this.dragging ? 0 : 0.35, 0, 0);
    (this.dragging ? this.dragRoot : this.hand).add(item.mesh);
  }

  get isEmpty() {
    return !this.held;
  }

  hold(item) {
    this.held = item;
    item.heating = false;
    if (item.type !== 'plate') refreshItem(item);
    this.attach(item);
    events.emit('item:pickup', { item });
  }

  release() {
    const item = this.held;
    this.held = null;
    if (item) {
      item.mesh.removeFromParent();
      item.mesh.rotation.set(0, 0, 0);
    }
    return item;
  }

  clear() {
    if (this.held) disposeItem(this.held);
    this.held = null;
  }

  update(dt, time) {
    this.hand.position.y = -0.42 + Math.sin(time * 2.2) * 0.012;
    this.hand.rotation.y = Math.sin(time * 1.3) * 0.08;
  }
}
