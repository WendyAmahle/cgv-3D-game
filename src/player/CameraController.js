import * as THREE from 'three';
import { events } from '../core/Events.js';

export const CAMERA_VIEWS = {
  1: 'Overview',
  2: 'Third person',
  3: 'Station focus',
  4: 'Top-down',
  5: 'First person',
};

const PIVOT = new THREE.Vector3(0, 1.0, 1.0);

// Multiple camera views with smooth transitions between them.
//   1 Overview   — orbit with Q/E, zoom with the mouse wheel
//   2 Third person — over the chef avatar's shoulder, following them along the aisle
//   3 Focus      — follows whatever is selected
//   4 Top-down   — plan view of the whole kitchen
//   5 First person — through the chef's eyes (Chef hides its body)
export class CameraController {
  constructor(camera, dom) {
    this.camera = camera;
    this.dom = dom;
    this.mode = 1;
    this.yaw = 0;
    this.distance = 10;
    this.firstPersonYaw = 0;
    this.firstPersonPitch = -0.18;
    this.autoOrbit = false; // used behind the main menu
    this.shakeAmount = 0;
    this.follow = null; // the chef, for the third-person view

    this.focus = new THREE.Vector3(0, 1.1, 1.2);
    this.focusKind = 'station';
    this.desiredPosition = new THREE.Vector3();
    this.desiredLook = new THREE.Vector3();
    this.look = new THREE.Vector3().copy(PIVOT);
    this.lookDrag = null;

    dom.addEventListener(
      'wheel',
      (event) => {
        if (this.mode === 1 && !this.autoOrbit) {
          this.distance = THREE.MathUtils.clamp(this.distance + event.deltaY * 0.01, 6.5, 16);
        }
      },
      { passive: true }
    );

    // Left drag is reserved for moving food. Use the middle or right mouse
    // button to look around without accidentally picking up an ingredient.
    dom.addEventListener('contextmenu', (event) => event.preventDefault());
    dom.addEventListener('pointerdown', (event) => {
      if (this.autoOrbit || (event.button !== 1 && event.button !== 2)) return;
      this.lookDrag = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
      dom.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });
    dom.addEventListener('pointermove', (event) => this.dragLook(event));
    dom.addEventListener('pointerup', (event) => this.endLookDrag(event));
    dom.addEventListener('pointercancel', (event) => this.endLookDrag(event));
  }

  dragLook(event) {
    if (!this.lookDrag || event.pointerId !== this.lookDrag.pointerId) return;
    const dx = event.clientX - this.lookDrag.x;
    const dy = event.clientY - this.lookDrag.y;
    this.lookDrag.x = event.clientX;
    this.lookDrag.y = event.clientY;

    if (this.mode === 1) {
      this.yaw = THREE.MathUtils.clamp(this.yaw - dx * 0.008, -1.2, 1.2);
    } else if (this.mode === 5) {
      this.firstPersonYaw = THREE.MathUtils.clamp(this.firstPersonYaw - dx * 0.008, -1.35, 1.35);
      this.firstPersonPitch = THREE.MathUtils.clamp(this.firstPersonPitch - dy * 0.006, -0.7, 0.45);
    }
    event.preventDefault();
  }

  endLookDrag(event) {
    if (!this.lookDrag || event.pointerId !== this.lookDrag.pointerId) return;
    this.dom.releasePointerCapture?.(event.pointerId);
    this.lookDrag = null;
  }

  setMode(mode) {
    if (!CAMERA_VIEWS[mode]) return;
    this.mode = mode;
    events.emit('camera:mode', { mode, name: CAMERA_VIEWS[mode] });
  }

  cycle() {
    this.setMode((this.mode % 5) + 1);
  }

  orbit(direction) {
    if (this.mode !== 1) this.setMode(1);
    this.yaw = THREE.MathUtils.clamp(this.yaw + direction * 0.18, -1.2, 1.2);
  }

  setFocus(position, kind) {
    this.focus.copy(position);
    this.focusKind = kind;
  }

  shake(amount) {
    this.shakeAmount = Math.max(this.shakeAmount, amount);
  }

  reset() {
    this.yaw = 0;
    this.distance = 10;
    this.firstPersonYaw = 0;
    this.firstPersonPitch = -0.18;
    this.setMode(1);
  }

  recenter() {
    if (this.mode === 1) this.yaw = 0;
    if (this.mode === 5) {
      this.firstPersonYaw = 0;
      this.firstPersonPitch = -0.18;
    }
  }

  computeDesired(time) {
    const position = this.desiredPosition;
    const look = this.desiredLook;

    if (this.autoOrbit) {
      const yaw = Math.sin(time * 0.12) * 0.7;
      position.set(Math.sin(yaw) * 12, 6.2, Math.cos(yaw) * 12).add(PIVOT);
      look.copy(PIVOT);
      return;
    }

    switch (this.mode) {
      case 2:
        if (this.follow) {
          // A genuine shoulder camera: it follows the chef's facing direction
          // rather than staying at a fixed world position as the chef moves.
          const chef = this.follow;
          const forwardX = Math.sin(chef.rotation.y);
          const forwardZ = Math.cos(chef.rotation.y);
          position.set(chef.position.x - forwardX * 3.4, chef.position.y + 2.25, chef.position.z - forwardZ * 3.4);
          look.set(chef.position.x + forwardX * 1.35, chef.position.y + 1.15, chef.position.z + forwardZ * 1.35);
        } else {
          position.set(0, 3.0, -3.4);
          look.set(0, 1.2, 2.8);
        }
        break;
      case 3:
        if (this.focusKind === 'customer') {
          // From the kitchen side, so you see the customer's face.
          position.copy(this.focus).add({ x: 0, y: 2.6, z: -2.4 });
          look.copy(this.focus).add({ x: 0, y: 1.45, z: 0 });
        } else {
          position.copy(this.focus).add({ x: 0, y: 2.2, z: 2.8 });
          look.copy(this.focus).add({ x: 0, y: 0.3, z: 0 });
        }
        break;
      case 5:
        if (this.follow) {
          // Eye height. Right/middle mouse drag looks independently of the
          // chef, which makes this a usable first-person inspection view.
          const chef = this.follow;
          const yaw = chef.rotation.y + this.firstPersonYaw;
          const forwardX = Math.sin(yaw);
          const forwardZ = Math.cos(yaw);
          const horizontal = Math.cos(this.firstPersonPitch);
          position.set(chef.position.x, chef.position.y + 1.62, chef.position.z);
          look.set(
            position.x + forwardX * horizontal * 3,
            position.y + Math.sin(this.firstPersonPitch) * 3,
            position.z + forwardZ * horizontal * 3
          );
          break;
        }
        position.set(0, 1.62, -1.2);
        look.set(0, 0.95, 2.8);
        break;
      case 4:
        position.set(0, 14, 2.6);
        look.set(0, 0, 1.2);
        break;
      default:
        position
          .set(Math.sin(this.yaw) * this.distance, this.distance * 0.58, Math.cos(this.yaw) * this.distance)
          .add(PIVOT);
        look.copy(PIVOT);
    }
  }

  // Jump straight to the current view (no transition), e.g. when a level loads.
  snap(time = 0) {
    this.computeDesired(time);
    this.camera.position.copy(this.desiredPosition);
    this.look.copy(this.desiredLook);
    this.camera.lookAt(this.look);
  }

  update(dt, time) {
    this.computeDesired(time);
    const blend = 1 - Math.exp(-dt * (this.mode === 5 ? 12 : 4.5)); // first person keeps up with the head
    this.camera.position.lerp(this.desiredPosition, blend);
    this.look.lerp(this.desiredLook, blend);

    if (this.shakeAmount > 0.001) {
      const s = this.shakeAmount;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
      this.shakeAmount *= Math.exp(-dt * 8);
    }

    this.camera.lookAt(this.look);
  }
}
