import * as THREE from 'three';
import { events } from '../core/Events.js';

export const CAMERA_VIEWS = {
  1: 'Overview',
  2: 'Third person',
  3: 'Station focus',
  4: 'Top-down',
};

const PIVOT = new THREE.Vector3(0, 1.0, 1.0);

// Multiple camera views with smooth transitions between them.
//   1 Overview   — orbit with Q/E, zoom with the mouse wheel
//   2 Third person — over the chef avatar's shoulder, following them along the aisle
//   3 Focus      — follows whatever is selected
//   4 Top-down   — plan view of the whole kitchen
export class CameraController {
  constructor(camera, dom) {
    this.camera = camera;
    this.mode = 1;
    this.yaw = 0;
    this.distance = 10;
    this.autoOrbit = false; // used behind the main menu
    this.shakeAmount = 0;
    this.follow = null; // the chef, for the third-person view

    this.focus = new THREE.Vector3(0, 1.1, 1.2);
    this.focusKind = 'station';
    this.desiredPosition = new THREE.Vector3();
    this.desiredLook = new THREE.Vector3();
    this.look = new THREE.Vector3().copy(PIVOT);

    dom.addEventListener(
      'wheel',
      (event) => {
        if (this.mode === 1 && !this.autoOrbit) {
          this.distance = THREE.MathUtils.clamp(this.distance + event.deltaY * 0.01, 6.5, 16);
        }
      },
      { passive: true }
    );
  }

  setMode(mode) {
    if (!CAMERA_VIEWS[mode]) return;
    this.mode = mode;
    events.emit('camera:mode', { mode, name: CAMERA_VIEWS[mode] });
  }

  cycle() {
    this.setMode((this.mode % 4) + 1);
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
    this.setMode(1);
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
          // Stays behind the chef (on the back-wall side) rather than swinging
          // round every time they turn between the two counters.
          const chef = this.follow.position;
          position.set(chef.x * 0.9, 4.1, chef.z - 3.3);
          look.set(chef.x, 0.9, chef.z + 2.8);
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
    const blend = 1 - Math.exp(-dt * 4.5);
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
