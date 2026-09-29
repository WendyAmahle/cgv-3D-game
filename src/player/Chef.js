import * as THREE from 'three';
import { events } from '../core/Events.js';
import { createChef } from '../world/Characters.js';
import { LAYOUT, MINIMAP_LAYER } from '../utils/Constants.js';

const AISLE_Z = (LAYOUT.frontRowZ + LAYOUT.backRowZ) / 2;
const SIDE_STEP = 0.55; // stand beside a station, not in front of it
const WALK_SPEED = 3.2;
const LIMIT_X = LAYOUT.counterLength / 2 - 0.6;

// The player's avatar. Walks the aisle between the counters to whatever is
// selected (or being dragged), turns to face it and reacts to orders.
//
// Scene graph: root (position + facing)
//   ├─ body (skinned model; the hat hangs off its head bone)
//   ├─ carry  — where held items go in the third-person view
//   └─ marker — arrow drawn only on the minimap
export class Chef {
  constructor() {
    const { root: body, animator } = createChef();
    this.root = new THREE.Group();
    this.root.name = 'chef';
    this.root.add(body);
    this.animator = animator;

    this.carry = new THREE.Group();
    this.carry.position.set(0, 1.08, 0.38);
    this.root.add(this.carry);

    this.marker = createMarker();
    this.root.add(this.marker);

    this.speed = 0;
    this.yaw = 0;
    this.busy = 0; // seconds left of a one-shot reaction
    this.binX = Infinity;
    this.goal = new THREE.Vector3();
    this.animator.play('idle', { fade: 0 });

    events.on('order:served', () => this.react('agree'));
    events.on('order:wrong', () => this.react('headShake'));
  }

  // New level: back to the middle of the aisle, keeping clear of the bin.
  reset(level) {
    const bin = level.stations.find((station) => station.type === 'trash');
    this.binX = bin ? bin.x : Infinity;
    this.root.position.set(0, 0, AISLE_Z);
    this.yaw = 0;
    this.root.rotation.y = 0;
    this.speed = 0;
    this.busy = 0;
    this.animator.play('idle', { fade: 0 });
  }

  react(clip) {
    this.busy = 1.6;
    this.animator.play(clip, { fade: 0.2, then: 'idle' });
  }

  // `target`: world point the chef is working on, or null to stay put.
  update(dt, target) {
    const position = this.root.position;
    let goalX = position.x;
    if (target) {
      goalX = target.x + (target.x > position.x ? -SIDE_STEP : SIDE_STEP);
      if (Math.abs(goalX - target.x) < SIDE_STEP * 0.5) goalX = target.x + SIDE_STEP;
    }
    goalX = THREE.MathUtils.clamp(goalX, -LIMIT_X, LIMIT_X);
    if (goalX > this.binX - 0.75) goalX = this.binX - 0.75;

    const distance = goalX - position.x;
    const step = Math.sign(distance) * Math.min(Math.abs(distance), WALK_SPEED * dt, Math.abs(distance) * dt * 6);
    position.x += step;
    this.speed = THREE.MathUtils.lerp(this.speed, Math.abs(step) / Math.max(dt, 1e-4), 1 - Math.exp(-dt * 10));

    // Face the target, or the direction of travel while walking.
    let facing = this.yaw;
    if (this.speed > 0.6) facing = Math.sign(distance) * Math.PI / 2;
    else if (target) facing = Math.atan2(target.x - position.x, target.z - position.z);
    const turn = Math.atan2(Math.sin(facing - this.yaw), Math.cos(facing - this.yaw));
    this.yaw += turn * (1 - Math.exp(-dt * 10));
    this.root.rotation.y = this.yaw;

    this.busy = Math.max(0, this.busy - dt);
    if (!this.busy) {
      if (this.speed > 0.3) this.animator.play('walk', { timeScale: THREE.MathUtils.clamp(this.speed / 1.6, 0.8, 1.6) });
      else this.animator.play('idle');
    }
    this.animator.update(dt);
  }
}

// Flat yellow arrow above the chef, pointing the way they face.
function createMarker() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.42);
  shape.lineTo(0.3, -0.26);
  shape.lineTo(0, -0.1);
  shape.lineTo(-0.3, -0.26);
  shape.closePath();
  const marker = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide, depthTest: false, toneMapped: false })
  );
  marker.rotation.x = Math.PI / 2; // shape's +y → world +z (the chef's forward)
  marker.position.y = 2.6;
  marker.renderOrder = 10;
  marker.layers.set(MINIMAP_LAYER);
  return marker;
}
