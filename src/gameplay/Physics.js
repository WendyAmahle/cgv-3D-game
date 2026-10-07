import * as THREE from 'three';
import { events } from '../core/Events.js';
import { disposeItem } from './Items.js';
import { LAYOUT } from '../utils/Constants.js';

// Small rigid-body simulation for loose items: things you throw in the bin and
// things you let go of in mid-air. Each body is a sphere (bounding radius of
// the item) integrated with semi-implicit Euler at a fixed 120 Hz step, with
// gravity, restitution, friction and spin, colliding against the floor plane
// and the counters/back wall as axis-aligned boxes.
//
// Scene graph: root → pivot (body position + rotation) → item mesh, offset so
// the pivot sits at the mesh's centre and it spins about its middle.

const GRAVITY = new THREE.Vector3(0, -9.81, 0);
const STEP = 1 / 120;
const RESTITUTION = 0.38;
const FRICTION = 0.35; // share of sliding speed lost per bounce
const REST_SPEED = 0.25;
const REST_TIME = 0.8; // seconds at rest before a dropped item is cleared away
const FADE_TIME = 0.35;
const MAX_AGE = 6;

function counterBox(z) {
  const half = LAYOUT.counterLength / 2 + 0.1;
  return new THREE.Box3(new THREE.Vector3(-half, 0, z - 0.61), new THREE.Vector3(half, LAYOUT.counterTopY, z + 0.61));
}

const COLLIDERS = [
  counterBox(LAYOUT.frontRowZ),
  counterBox(LAYOUT.backRowZ),
  new THREE.Box3(new THREE.Vector3(-7.5, 0, -10), new THREE.Vector3(7.5, 4.3, LAYOUT.backWallZ + 0.15)),
];

const closest = new THREE.Vector3();
const normal = new THREE.Vector3();
const tangent = new THREE.Vector3();
const spinAxis = new THREE.Vector3();
const spinStep = new THREE.Quaternion();
const box = new THREE.Box3();
const centre = new THREE.Vector3();
const size = new THREE.Vector3();

export class Physics {
  constructor(scene) {
    this.root = new THREE.Group();
    this.root.name = 'physics';
    scene.add(this.root);
    this.bodies = [];
    this.accumulator = 0;
  }

  // Wraps `item` in a body at world position `from`. The mesh must already be
  // detached from wherever it was.
  addBody(item, from, velocity) {
    item.mesh.updateMatrixWorld(true);
    box.setFromObject(item.mesh);
    box.getCenter(centre).sub(item.mesh.position);
    box.getSize(size);

    const pivot = new THREE.Group();
    pivot.position.copy(from).add(centre);
    item.mesh.position.copy(centre).negate();
    pivot.add(item.mesh);
    this.root.add(pivot);

    const body = {
      item,
      pivot,
      velocity: velocity.clone(),
      spin: new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 8),
      radius: THREE.MathUtils.clamp(Math.max(size.x, size.y, size.z) * 0.45, 0.05, 0.35),
      bin: null,
      resting: 0,
      fading: 0,
      age: 0,
      bounces: 0,
    };
    this.bodies.push(body);
    return body;
  }

  // Lets go of an item in mid-air: it falls, bounces and is cleared once it settles.
  drop(item, from, velocity = new THREE.Vector3()) {
    this.addBody(item, from, velocity);
  }

  // Throws an item into a bin along a ballistic arc. Solving
  //   target = from + v·T + ½·g·T²   for v
  // gives the launch velocity that lands it at `target` after T seconds.
  throwInto(item, from, bin) {
    const target = bin.rim.clone();
    const distance = from.distanceTo(target);
    const time = THREE.MathUtils.clamp(0.5 + distance * 0.06, 0.6, 1.1);
    const velocity = target
      .clone()
      .sub(from)
      .addScaledVector(GRAVITY, -0.5 * time * time)
      .divideScalar(time);
    const body = this.addBody(item, from, velocity);
    body.bin = bin;
  }

  update(dt) {
    this.accumulator = Math.min(this.accumulator + dt, 0.1);
    while (this.accumulator >= STEP) {
      this.accumulator -= STEP;
      for (const body of this.bodies) this.step(body, STEP);
    }

    for (let index = this.bodies.length - 1; index >= 0; index -= 1) {
      const body = this.bodies[index];
      body.age += dt;
      if (body.fading > 0 || body.resting > REST_TIME || body.age > MAX_AGE) body.fading += dt;
      if (body.fading > 0) body.pivot.scale.setScalar(Math.max(0.001, 1 - body.fading / FADE_TIME));
      if (body.fading >= FADE_TIME) this.remove(index);
    }
  }

  step(body, h) {
    const { pivot, velocity, spin } = body;
    const position = pivot.position;

    velocity.addScaledVector(GRAVITY, h);
    position.addScaledVector(velocity, h);

    const speed = spin.length();
    if (speed > 1e-4) {
      spinAxis.copy(spin).divideScalar(speed);
      spinStep.setFromAxisAngle(spinAxis, speed * h);
      pivot.quaternion.premultiply(spinStep);
    }

    if (body.bin) {
      this.stepBin(body);
      return;
    }

    let touching = false;
    for (const collider of COLLIDERS) {
      collider.clampPoint(position, closest);
      normal.subVectors(position, closest);
      let distance = normal.length();
      if (distance > 1e-6) {
        if (distance >= body.radius) continue;
        normal.divideScalar(distance);
      } else {
        // The centre ended up fully inside the box (a fast-falling item can
        // tunnel past the top face in one step): clampPoint gives no useful
        // direction here, so push out through whichever face is nearest
        // instead of always assuming "up" — the old fallback could leave a
        // dropped item hovering/embedded inside a counter indefinitely.
        const left = position.x - collider.min.x, right = collider.max.x - position.x;
        const down = position.y - collider.min.y, up = collider.max.y - position.y;
        const back = position.z - collider.min.z, front = collider.max.z - position.z;
        const minX = Math.min(left, right), minY = Math.min(down, up), minZ = Math.min(back, front);
        if (minY <= minX && minY <= minZ) normal.set(0, down < up ? -1 : 1, 0);
        else if (minX <= minZ) normal.set(left < right ? -1 : 1, 0, 0);
        else normal.set(0, 0, back < front ? -1 : 1);
        distance = 0;
      }
      position.addScaledVector(normal, body.radius - distance);
      this.bounce(body, normal);
      touching = true;
    }

    if (position.y < body.radius) {
      position.y = body.radius;
      this.bounce(body, normal.set(0, 1, 0));
      touching = true;
    }

    const still = touching && velocity.lengthSq() < REST_SPEED * REST_SPEED;
    body.resting = still ? body.resting + h : 0;
  }

  // Reflects the velocity about the contact normal, losing energy on the way.
  bounce(body, n) {
    const { velocity, spin } = body;
    const into = velocity.dot(n);
    if (into >= 0) return;
    tangent.copy(velocity).addScaledVector(n, -into).multiplyScalar(1 - FRICTION);
    velocity.copy(tangent).addScaledVector(n, -into * RESTITUTION);
    spin.multiplyScalar(0.7);
    if (-into > 1.4 && body.bounces < 3) {
      body.bounces += 1;
      events.emit('item:bounce', { item: body.item, strength: -into });
    }
  }

  // Thrown items fly free until they drop through the bin's opening. The arc
  // is aimed at the rim's centre, so it's checked as it passes the rim height.
  stepBin(body) {
    const position = body.pivot.position;
    const bin = body.bin;
    const dx = position.x - bin.rim.x;
    const dz = position.z - bin.rim.z;
    const inside = dx * dx + dz * dz < bin.radius * bin.radius;
    if (!body.fading && inside && position.y < bin.rim.y + 0.05 && body.velocity.y < 0) {
      body.fading = 1e-4;
      body.velocity.set(0, -1.5, 0);
      body.spin.set(0, 0, 0);
      events.emit('item:trash', { item: body.item });
    }
    if (position.y < body.radius) {
      position.y = body.radius;
      body.velocity.set(0, 0, 0);
      body.fading ||= 1e-4; // missed: clear it away
    }
  }

  remove(index) {
    const [body] = this.bodies.splice(index, 1);
    disposeItem(body.item);
    body.pivot.removeFromParent();
  }

  clear() {
    for (let index = this.bodies.length - 1; index >= 0; index -= 1) this.remove(index);
    this.accumulator = 0;
  }
}
