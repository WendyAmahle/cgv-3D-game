import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { events } from '../core/Events.js';
import { pick, STREET } from '../utils/Constants.js';
import { canvasTexture, physical, surfaces } from '../graphics/Materials.js';
import { createBeamMaterial } from '../graphics/Shaders.js';
import { createCustomer } from './Characters.js';

// Night traffic on the road in front of the Neon Diner, and people walking
// along the far pavement. Cars are built from primitives (rounded body, glass
// cabin, wheels) with emissive head and tail lamps. Their light on the wet
// road is faked with additive ground decals and the beam shader rather than
// real spotlights, so a dozen cars add no lights to the scene.
//
// Every car is built facing +x; cars in the -x lane are turned around.

const CLEARANCE = 0.2;
const CARS = {
  sedan: { length: 4.5, width: 1.8, body: 0.6, cabin: { length: 2.3, height: 0.5, x: -0.2 }, wheel: 0.33 },
  hatch: { length: 3.9, width: 1.72, body: 0.64, cabin: { length: 2.2, height: 0.55, x: -0.35 }, wheel: 0.31 },
  suv: { length: 4.7, width: 1.95, body: 0.85, cabin: { length: 2.9, height: 0.62, x: -0.35 }, wheel: 0.38 },
};
const PAINTS = [0xe5e7eb, 0x111827, 0x7f1d1d, 0x1e3a8a, 0x6b7280, 0x0f766e, 0xf8fafc, 0x312e81];
const TAXI = 0xf5c518;
const LINEUPS = [
  ['sedan', 'taxi', 'hatch', 'suv', 'sedan'],
  ['bus', 'sedan', 'taxi', 'hatch', 'suv'],
];

const WALK_SPEED = 1.5; // m/s, matches the walk animation (see Customers.js)
const WALK_EXTENT = 44; // pedestrians wrap around at x = ±WALK_EXTENT

// ---------------------------------------------------------- shared parts

const geometries = new Map();
function shared(key, build) {
  if (!geometries.has(key)) {
    const geometry = build();
    geometry.userData.shared = true;
    geometries.set(key, geometry);
  }
  return geometries.get(key);
}

const materials = new Map();
function sharedMaterial(key, build) {
  if (!materials.has(key)) {
    const material = build();
    material.userData.shared = true;
    materials.set(key, material);
  }
  return materials.get(key);
}

const glass = () => physical(0x0a0d14, { roughness: 0.06, metalness: 0.9, clearcoat: 1 });
const lamp = (color, intensity) =>
  sharedMaterial(`lamp-${color}-${intensity}`, () => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: intensity }));
const beam = () => sharedMaterial('beam', () => createBeamMaterial());

// Soft white blob, added onto the road for light pools.
export function poolMaterial(color, opacity) {
  return sharedMaterial(`pool-${color}-${opacity}`, () => {
    const map = canvasTexture('light-pool', 128, (ctx, size) => {
      const c = size / 2;
      const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.45, '#6b6b6b');
      gradient.addColorStop(1, '#000000');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
    }, [1, 1], THREE.NoColorSpace);
    return new THREE.MeshBasicMaterial({ map, color, opacity, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  });
}

function shadowMaterial() {
  return sharedMaterial('car-shadow', () => {
    const map = canvasTexture('car-shadow', 128, (ctx, size) => {
      const c = size / 2;
      const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
      gradient.addColorStop(0, 'rgba(0,0,0,0.75)');
      gradient.addColorStop(0.6, 'rgba(0,0,0,0.5)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
    }, [1, 1], THREE.NoColorSpace);
    return new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false });
  });
}

const groundQuad = () => shared('ground-quad', () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));

export function decal(material, [sx, sz], [x, y, z]) {
  const mesh = new THREE.Mesh(groundQuad(), material);
  mesh.scale.set(sx, 1, sz);
  mesh.position.set(x, y, z);
  return mesh;
}

// Two headlight cones (tips at the lamps, opening forward and slightly down).
function beamGeometry(x, y, halfSpread) {
  return shared(`beams-${x}-${y}-${halfSpread}`, () =>
    mergeGeometries([-1, 1].map((side) => {
      const cone = new THREE.ConeGeometry(1.3, 9, 20, 1, true);
      cone.rotateZ(Math.PI / 2); // tip now points to -x
      cone.translate(4.5, 0, 0); // tip at the origin, opening along +x
      cone.rotateZ(-0.09); // aimed a little down at the road
      return cone.translate(x, y, side * halfSpread);
    }))
  );
}

// Head lamps, tail lamps, their beams and light on the road, and a contact
// shadow: everything a vehicle of this size needs besides its body.
function addLights(group, { length, width, lampY, key }) {
  const halfSpread = width / 2 - 0.3;
  const pair = (x, w, h) => mergeGeometries([-1, 1].map((side) => new THREE.BoxGeometry(0.08, h, w).translate(x, lampY, side * halfSpread)));
  group.add(new THREE.Mesh(shared(`${key}-heads`, () => pair(length / 2, 0.36, 0.13)), lamp(0xfff3dc, 6)));
  group.add(new THREE.Mesh(shared(`${key}-tails`, () => pair(-length / 2, 0.3, 0.12)), lamp(0xff1a1a, 3)));
  group.add(new THREE.Mesh(beamGeometry(length / 2, lampY, halfSpread), beam()));
  group.add(decal(shadowMaterial(), [length + 0.5, width + 0.6], [0, 0.012, 0]));
  group.add(decal(poolMaterial(0xfff0d0, 0.5), [8, 3.6], [length / 2 + 4, 0.02, 0]));
  group.add(decal(poolMaterial(0xff2020, 0.35), [2.6, 2.4], [-length / 2 - 0.9, 0.02, 0]));
}

function wheels(key, positions, radius, width) {
  return new THREE.Mesh(
    shared(`${key}-wheels`, () =>
      mergeGeometries(positions.map(([x, z]) => new THREE.CylinderGeometry(radius, radius, width, 18).rotateX(Math.PI / 2).translate(x, radius, z)))
    ),
    surfaces.rubber()
  );
}

// ------------------------------------------------------------- vehicles

function buildCar(kind) {
  const spec = CARS[kind === 'taxi' ? 'sedan' : kind];
  const key = kind === 'taxi' ? 'sedan' : kind;
  const { length, width, body, cabin, wheel } = spec;
  const paint = surfaces.paint(kind === 'taxi' ? TAXI : PAINTS[Math.floor(Math.random() * PAINTS.length)]);
  const group = new THREE.Group();
  const roofY = CLEARANCE + body + cabin.height - 0.06;

  group.add(new THREE.Mesh(shared(`${key}-body`, () => new RoundedBoxGeometry(length, body, width, 3, 0.14).translate(0, CLEARANCE + body / 2, 0)), paint));
  group.add(new THREE.Mesh(shared(`${key}-cabin`, () => new RoundedBoxGeometry(cabin.length, cabin.height, width * 0.84, 3, 0.16).translate(cabin.x, roofY - cabin.height / 2, 0)), glass()));
  group.add(new THREE.Mesh(shared(`${key}-roof`, () => new RoundedBoxGeometry(cabin.length * 0.78, 0.05, width * 0.78, 2, 0.02).translate(cabin.x, roofY, 0)), paint));
  const axle = length / 2 - 0.85;
  const track = width / 2 - 0.12;
  group.add(wheels(key, [[axle, track], [axle, -track], [-axle, track], [-axle, -track]], wheel, 0.24));
  addLights(group, { length, width, lampY: CLEARANCE + body * 0.62, key });

  if (kind === 'taxi') {
    const sign = new THREE.Mesh(shared('taxi-sign', () => new THREE.BoxGeometry(0.22, 0.16, 0.55)), lamp(0xfff1a8, 2.5));
    sign.position.set(cabin.x, roofY + 0.1, 0);
    group.add(sign);
  }
  return { group, length, cruise: 9 + Math.random() * 4 };
}

// A row of lit bus windows, drawn in the top quarter of the canvas (the
// texture's repeat/offset crop to just that strip).
function busWindows() {
  const texture = canvasTexture('bus-windows', 512, (ctx, size) => {
    const h = size / 4;
    ctx.fillStyle = '#0b0d12';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 7; i += 1) {
      const x = 6 + i * (size / 7);
      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, '#f3f7ff');
      gradient.addColorStop(1, '#9fb8d8');
      ctx.fillStyle = gradient;
      ctx.fillRect(x, 8, size / 7 - 12, h - 16);
      // Passengers' heads and shoulders against the lit interior.
      ctx.fillStyle = 'rgba(15,18,28,0.85)';
      if (i % 3 !== 1) {
        const px = x + 18 + (i * 23) % 30;
        ctx.beginPath();
        ctx.arc(px, h * 0.55, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(px - 15, h * 0.68, 30, h * 0.3);
      }
    }
  }, [1, 0.25]);
  texture.offset.set(0, 0.75);
  return texture;
}

function buildBus() {
  const length = 11;
  const width = 2.5;
  const body = 2.9;
  const clearance = 0.32;
  const group = new THREE.Group();
  group.add(new THREE.Mesh(shared('bus-body', () => new RoundedBoxGeometry(length, body, width, 3, 0.2).translate(0, clearance + body / 2, 0)), surfaces.paint(0xb91c1c)));
  const windows = busWindows();
  const band = new THREE.Mesh(
    shared('bus-band', () => new THREE.BoxGeometry(length - 0.5, 1.05, width + 0.02).translate(0.1, clearance + 2.05, 0)),
    sharedMaterial('bus-glass', () => new THREE.MeshStandardMaterial({ color: 0xffffff, map: windows, emissive: 0xffffff, emissiveMap: windows, emissiveIntensity: 0.9, roughness: 0.1, metalness: 0.3 }))
  );
  group.add(band);
  const destination = new THREE.Mesh(shared('bus-destination', () => new THREE.BoxGeometry(0.06, 0.26, 1.7).translate(length / 2, clearance + body - 0.25, 0)), lamp(0xffa21a, 2.5));
  group.add(destination);
  group.add(wheels('bus', [[3.6, 1.1], [3.6, -1.1], [-3.4, 1.1], [-3.4, -1.1]], 0.5, 0.3));
  addLights(group, { length, width, lampY: clearance + 0.55, key: 'bus' });
  return { group, length, cruise: 8 };
}

// ---------------------------------------------------------------- traffic

const wrap = (value, size) => ((value % size) + size) % size;
const PASS_LEAD = 3.1; // s from the start of a pass-by sound to its loudest moment (AudioManager)

// Adds the cars to `parent` and returns an update(dt) that drives them. Each
// car cruises at its own speed but brakes for the one ahead in its lane, so
// faster cars bunch up behind the bus instead of driving through it.
export function buildTraffic(parent) {
  const span = STREET.halfLength * 2;
  const lanes = STREET.lanes.map((lane, laneIndex) => {
    const lineup = LINEUPS[laneIndex];
    const cars = lineup.map((kind, index) => {
      const car = kind === 'bus' ? buildBus() : buildCar(kind);
      car.group.rotation.y = lane.direction > 0 ? 0 : Math.PI;
      car.group.position.set(0, STREET.roadY, lane.z);
      parent.add(car.group);
      car.x = -STREET.halfLength + (index + Math.random() * 0.5) * (span / lineup.length);
      car.speed = car.cruise;
      return car;
    });
    return { ...lane, cars };
  });
  let hornTimer = 8 + Math.random() * 10;

  return (dt) => {
    for (const lane of lanes) {
      for (const car of lane.cars) {
        let gap = Infinity;
        let leader = null;
        for (const other of lane.cars) {
          if (other === car) continue;
          const ahead = wrap((other.x - car.x) * lane.direction, span) - (other.length + car.length) / 2;
          if (ahead < gap) {
            gap = ahead;
            leader = other;
          }
        }
        const target = Math.min(car.cruise, Math.max(0, (gap - 3) * 1.2));
        car.speed += (target - car.speed) * Math.min(1, dt * 2);
        if (leader && gap < 1.5) car.speed = Math.min(car.speed, leader.speed);
        // Distance still to drive to the diner's front (x = 0), before and
        // after this step: crossing PASS_LEAD seconds out starts the pass-by
        // sound, so its loudest moment lands as the car goes past.
        const before = -car.x * lane.direction;
        car.x += lane.direction * car.speed * dt;
        const after = -car.x * lane.direction;
        const lead = PASS_LEAD * car.speed;
        if (before > lead && after <= lead) events.emit('traffic:pass', { object: car.group, heavy: car.length > 8 });
        if (car.x * lane.direction > STREET.halfLength) car.x -= lane.direction * span;
        car.group.position.x = car.x;
      }
    }

    // Now and then somebody leans on the horn, somewhere near the diner.
    hornTimer -= dt;
    if (hornTimer <= 0) {
      hornTimer = 15 + Math.random() * 25;
      const nearby = lanes.flatMap((lane) => lane.cars).filter((car) => Math.abs(car.x) < 25);
      if (nearby.length) events.emit('traffic:horn', { object: pick(nearby).group });
    }
  };
}

// ------------------------------------------------------------ pedestrians

function person(seed, position, rotationY) {
  const { root, animator } = createCustomer('cyber', seed);
  root.position.copy(position);
  root.rotation.y = rotationY;
  root.traverse((object) => {
    if (object.isMesh) object.castShadow = false; // out on the street, beyond the shadow map
  });
  return { root, animator };
}

// People walking both ways along the far pavement, plus a couple waiting at
// the bus stop. Same animated bodies as the customers. Returns update(dt, time).
export function buildPedestrians(parent, busStopX) {
  const walkers = [];
  for (let index = 0; index < 8; index += 1) {
    const way = STREET.walkways[index % 2];
    const x = -WALK_EXTENT + (index + Math.random() * 0.6) * ((WALK_EXTENT * 2) / 8);
    const z = way.z + (Math.random() - 0.5) * 0.5;
    const walker = person(700 + index * 37, new THREE.Vector3(x, 0, z), way.direction > 0 ? Math.PI / 2 : -Math.PI / 2);
    const pace = 0.85 + Math.random() * 0.25;
    walker.animator.play('walk', { fade: 0, timeScale: pace });
    walker.animator.update(Math.random() * 1.5); // out of step with each other
    walkers.push({ ...walker, direction: way.direction, speed: WALK_SPEED * pace });
    parent.add(walker.root);
  }

  const waiting = [
    person(911, new THREE.Vector3(busStopX - 0.7, 0, 17.6), Math.PI - 0.3),
    person(947, new THREE.Vector3(busStopX + 0.9, 0, 17.4), Math.PI + 0.4),
  ];
  for (const { root, animator } of waiting) {
    animator.play('idle', { fade: 0 });
    animator.update(Math.random() * 2);
    parent.add(root);
  }

  return (dt, time) => {
    for (const walker of walkers) {
      walker.animator.update(dt);
      const { position } = walker.root;
      position.x += walker.direction * walker.speed * dt;
      if (position.x * walker.direction > WALK_EXTENT) position.x -= walker.direction * WALK_EXTENT * 2;
      if (!walker.animator.animated) position.y = Math.abs(Math.sin(time * 9 + walker.speed * 10)) * 0.06;
    }
    for (const { animator } of waiting) animator.update(dt);
  };
}
