import * as THREE from 'three';
import { events } from '../core/Events.js';
import { disposeItem, refreshItem } from '../gameplay/Items.js';
import { mat, physical } from '../graphics/Materials.js';

// A simple first-person hand and sleeve: without it, a held item used to
// just float at the bottom-right of the screen with nothing holding it.
// Built directly in Player.hand's local space (already scaled 0.65 with the
// items it sits beside), so these numbers are "on-screen" units, not metres.
function createFirstPersonHand() {
  const group = new THREE.Group();
  const skin = physical(0xe0ac69, { roughness: 0.55 });
  const sleeve = mat(0xf8fafc, { roughness: 0.82 });
  const cuff = mat(0xe8edf3, { roughness: 0.6 });

  // Fist, cradling the item from below/behind.
  const palm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.05, 6, 12), skin);
  palm.rotation.z = Math.PI / 2;
  palm.scale.z = 1.3;
  palm.position.set(0, -0.08, 0.03);
  group.add(palm);

  // Forearm sleeve, reaching off toward the bottom-right edge of the view.
  const wrist = new THREE.Vector3(0, -0.15, 0);
  const elbow = new THREE.Vector3(0.45, -0.68, 0.4);
  const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.15, wrist.distanceTo(elbow), 12), sleeve);
  forearm.position.copy(wrist).lerp(elbow, 0.5);
  forearm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), elbow.clone().sub(wrist).normalize());
  group.add(forearm);

  // Cuff where the sleeve meets the wrist.
  const sleeveCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.097, 0.05, 12), cuff);
  sleeveCuff.position.copy(wrist).lerp(elbow, 0.1);
  sleeveCuff.quaternion.copy(forearm.quaternion);
  group.add(sleeveCuff);

  group.traverse((object) => {
    if (object.isMesh) object.castShadow = false;
  });
  return group;
}

// The chef's hands: holds one item. Normally it bobs in the bottom-right of
// the view (a child of the camera); in the third-person view it sits in the
// chef avatar's arms (carry); while dragging with the mouse it follows the
// cursor in the world (dragRoot, positioned by PlayerController).
export class Player {
  constructor(camera) {
    this.held = null;
    this.hand = new THREE.Group();
    this.hand.position.set(0.62, -0.42, -1.3);
    this.hand.scale.setScalar(0.65);
    camera.add(this.hand);
    this.handModel = createFirstPersonHand();
    this.hand.add(this.handModel);
    this.dragRoot = new THREE.Group();
    this.dragging = false;
    this.carry = null;
  }

  // Where held items go when not dragging: an object, or null for the camera
  // hand. The camera hand's own model only makes sense when it's actually
  // the one holding things — in third person the chef's own arms take over.
  setCarry(anchor) {
    this.carry = anchor;
    this.handModel.visible = !anchor;
    if (this.held) this.attach(this.held);
  }

  setDragging(dragging) {
    this.dragging = dragging;
    if (this.held) this.attach(this.held);
  }

  attach(item) {
    item.mesh.removeFromParent();
    item.mesh.position.set(0, 0, 0);
    item.mesh.rotation.set(this.dragging ? 0 : 0.35, 0, 0);
    (this.dragging ? this.dragRoot : this.carry ?? this.hand).add(item.mesh);
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
