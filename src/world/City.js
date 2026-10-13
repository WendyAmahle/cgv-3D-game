import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { events } from '../core/Events.js';
import { assets } from '../utils/AssetLoader.js';
import { STREET } from '../utils/Constants.js';
import { canvasTexture, mat, pbr, physical, surfaces } from '../graphics/Materials.js';
import { buildPedestrians, buildTraffic, decal, poolMaterial } from './Traffic.js';

// The Level 3 street at night: the diner faces a two-lane road with traffic,
// and across it a pavement where people walk past lit shopfronts. Buildings
// are assembled from Poly Haven's modular facade kit (3 m wide, 3 m tall
// pieces), with lit and dark windows, neon-lit shops on the ground floor,
// blade signs, aircon units and cables across the street; taller towers with
// lit windows make the skyline behind them. Each building's kit pieces are
// merged by material so a whole street costs only a few dozen draw calls.

const MODULE = 3; // metres per kit piece
const GROUND_FLOOR = 3.4; // shopfront height
const WINDOW_STYLES = ['centered_large', 'centered_small', 'centered_double', 'offset_small'];

const SIGNS = [
  { text: '拉麺', color: '#ff3df2' },
  { text: 'BAR', color: '#38f8ff' },
  { text: '24H', color: '#fff05a' },
  { text: 'HOTEL', color: '#ff5a5a' },
  { text: '薬局', color: '#5aff8a' },
  { text: 'KARAOKE', color: '#c77dff' },
  { text: '寿司', color: '#ff9e3d' },
  { text: 'NOODLES', color: '#38f8ff' },
];

function seeded(seed) {
  let state = seed * 9301 + 49297;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

// ------------------------------------------------------------- textures

function neonTexture(text, color, vertical = false) {
  return canvasTexture(`neon-${text}-${color}-${vertical}`, 256, (ctx, size) => {
    ctx.fillStyle = '#05040a';
    ctx.fillRect(0, 0, size, size);
    ctx.shadowColor = color;
    ctx.shadowBlur = 22;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (vertical) {
      const chars = [...text];
      const step = size / (chars.length + 0.5);
      ctx.font = `800 ${Math.min(90, step * 0.9)}px "Segoe UI", "Yu Gothic", sans-serif`;
      chars.forEach((char, index) => {
        ctx.strokeText(char, size / 2, step * (index + 0.75));
        ctx.fillText(char, size / 2, step * (index + 0.75));
      });
    } else {
      ctx.font = `800 ${text.length > 5 ? 52 : 90}px "Segoe UI", "Yu Gothic", sans-serif`;
      ctx.strokeText(text, size / 2, size / 2);
      ctx.fillText(text, size / 2, size / 2);
    }
    ctx.shadowBlur = 0;
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, size - 16, size - 16);
  });
}

function shopTexture(variant) {
  return canvasTexture(`shop-${variant}`, 256, (ctx, size) => {
    const warm = variant % 2 === 0;
    const gradient = ctx.createLinearGradient(0, 0, 0, size);
    gradient.addColorStop(0, warm ? '#ffe2b0' : '#cfe8ff');
    gradient.addColorStop(1, warm ? '#6b3d1a' : '#1d3557');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    // Shelves, counters and silhouettes inside.
    for (let row = 0; row < 4; row += 1) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 60 + row * 45, size, 6);
      for (let i = 0; i < 14; i += 1) {
        ctx.fillStyle = `hsla(${(i * 47 + variant * 60) % 360},70%,${45 + (i % 3) * 10}%,0.8)`;
        ctx.fillRect(10 + i * 17, 38 + row * 45, 11, 22);
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.ellipse(size * (0.3 + (variant % 3) * 0.2), size * 0.8, 18, 60, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ------------------------------------------------------------ kit pieces

function kitMeshes(name) {
  const node = assets.node('facadeKit', name);
  if (!node) return [];
  const meshes = [];
  node.traverse((object) => {
    if (object.isMesh) meshes.push(object);
  });
  return meshes.map((mesh) => ({
    geometry: mesh.geometry,
    material: mesh.material,
    local: mesh === node ? new THREE.Matrix4() : mesh.matrix.clone(),
  }));
}

// Collects transformed kit pieces, then merges them into one mesh per material.
class Batcher {
  constructor() {
    this.parts = new Map(); // material -> geometries
  }

  add(name, matrix, materialFor = (material) => material) {
    for (const { geometry, material, local } of kitMeshes(name)) {
      const copy = new THREE.BufferGeometry();
      for (const attribute of ['position', 'normal', 'uv']) {
        if (geometry.attributes[attribute]) copy.setAttribute(attribute, geometry.attributes[attribute].clone());
      }
      if (geometry.index) copy.setIndex(geometry.index.clone());
      copy.applyMatrix4(new THREE.Matrix4().multiplyMatrices(matrix, local));
      const target = materialFor(material);
      if (!this.parts.has(target)) this.parts.set(target, []);
      this.parts.get(target).push(copy);
    }
  }

  build(group) {
    for (const [material, geometries] of this.parts) {
      const merged = mergeGeometries(geometries);
      geometries.forEach((geometry) => geometry.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, material);
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }
}

// ------------------------------------------------------------- buildings

// A building facade `modules` wide and `floors` high above a row of shops,
// built along +x from the origin and facing +z.
function building({ modules, floors, seed, tint }) {
  const random = seeded(seed);
  const group = new THREE.Group();
  const batch = new Batcher();
  const at = (x, y, z = 0) => new THREE.Matrix4().makeTranslation(x, y, z);

  const plasterCache = new Map();
  const tinted = (material) => {
    if (!material.name.includes('plaster')) return material;
    if (!plasterCache.has(material)) {
      const copy = material.clone();
      copy.color.set(tint);
      copy.userData.shared = false;
      plasterCache.set(material, copy);
    }
    return plasterCache.get(material);
  };
  const litWarm = new THREE.MeshStandardMaterial({ color: 0x1a1208, emissive: 0xffc98a, emissiveIntensity: 0.9, roughness: 0.2 });
  const litCool = new THREE.MeshStandardMaterial({ color: 0x0a1018, emissive: 0x9cc8ff, emissiveIntensity: 0.8, roughness: 0.2 });

  // Upper storeys.
  const styles = Array.from({ length: modules }, () => WINDOW_STYLES[Math.floor(random() * WINDOW_STYLES.length)]);
  for (let floor = 0; floor < floors; floor += 1) {
    const y = GROUND_FLOOR + floor * MODULE;
    for (let column = 0; column < modules; column += 1) {
      const x = (column + 1) * MODULE;
      const style = styles[column];
      batch.add(`wall_window_${style}_01`, at(x, y), tinted);
      // Late evening: most flats have their lights on.
      const light = random();
      const glass = light > 0.5 ? litWarm : light > 0.35 ? litCool : null;
      batch.add(`window_${style}_01`, at(x, y), (material) =>
        glass && material.name.includes('glass') ? glass : tinted(material)
      );
      batch.add('cornice_standard_standard_01', at(x, y - 0.1), tinted);
    }
  }
  const top = GROUND_FLOOR + floors * MODULE;
  for (let column = 0; column < modules; column += 1) batch.add('crown_standard_standard_01', at((column + 1) * MODULE, top), tinted);
  batch.build(group);

  // The kit is only a front face: a block behind it, with windows on the
  // kit's 3 m floors, closes the sides and roof (seen down the alleys).
  const depth = 10;
  group.add(litBlock(modules * MODULE, top, depth, litMaterial(6 + (seed % 3), [1.6, MODULE], 0.45), [(modules * MODULE) / 2, top / 2, -depth / 2 - 0.32]));

  // Ground-floor shops: lit window, sign board, or a closed shutter.
  const frame = physical(0x16161c, { metalness: 0.8, roughness: 0.4 });
  const shutter = pbr('corrugated_iron_02', [1, 1], 0x4b5563, { color: 0x6b7280, metalness: 0.6 });
  for (let column = 0; column < modules; column += 1) {
    const x = column * MODULE + MODULE / 2;
    group.add(box(MODULE, GROUND_FLOOR, 0.3, frame, [x, GROUND_FLOOR / 2, -0.15]));
    if (random() < 0.25) {
      group.add(box(MODULE - 0.3, 2.6, 0.05, shutter, [x, 1.4, 0.03]));
      continue;
    }
    const interior = shopTexture(Math.floor(random() * 6));
    const window = new THREE.Mesh(new THREE.PlaneGeometry(MODULE - 0.4, 2.3), new THREE.MeshStandardMaterial({ map: interior, emissive: 0xffffff, emissiveMap: interior, emissiveIntensity: 0.35, roughness: 0.1, metalness: 0.2 }));
    window.position.set(x, 1.3, 0.02);
    group.add(window);
    const sign = SIGNS[Math.floor(random() * SIGNS.length)];
    const board = new THREE.Mesh(new THREE.PlaneGeometry(MODULE - 0.3, 0.7), neonMaterial(sign));
    board.material.map.repeat.set(1, 0.3);
    board.material.map.offset.set(0, 0.35);
    board.position.set(x, 2.95, 0.04);
    group.add(board);
  }

  // Blade signs sticking out over the street.
  for (let column = 1; column < modules; column += 3) {
    const sign = SIGNS[Math.floor(random() * SIGNS.length)];
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.2, 0.9), neonMaterial(sign, true));
    blade.position.set(column * MODULE, GROUND_FLOOR + 3.2, 0.6);
    group.add(blade);
    blade.userData.flicker = random() > 0.6;
  }

  // Aircon units under a few windows.
  const aircon = assets.model('aircon');
  if (aircon) {
    const unit = aircon.getObjectByName(random() > 0.5 ? 'exterior_aircon_unit' : 'exterior_aircon_unit_rusted');
    for (let i = 0; i < 1; i += 1) {
      const copy = unit.clone();
      copy.position.set(MODULE * (1 + Math.floor(random() * modules)) - 1.5, GROUND_FLOOR + MODULE * Math.floor(random() * floors) + 0.35, 0.25);
      group.add(copy);
    }
  }

  group.userData.width = modules * MODULE;
  return group;
}

const neonMaterials = new Map();
function neonMaterial(sign, vertical = false) {
  const key = `${sign.text}-${vertical}`;
  if (!neonMaterials.has(key)) {
    const texture = neonTexture(sign.text, sign.color, vertical);
    const material = new THREE.MeshStandardMaterial({ map: texture, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 2.2, roughness: 0.4 });
    material.userData.shared = true;
    neonMaterials.set(key, material);
  }
  const material = neonMaterials.get(key).clone();
  material.userData.shared = false; // per-sign copy so signs can flicker independently
  return material;
}

function box(w, h, d, material, [x, y, z]) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  return mesh;
}

// Sagging cable between two points.
function cable(from, to, sag, material) {
  const mid = from.clone().lerp(to, 0.5);
  mid.y -= sag;
  const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.025, 5, false), material);
}

// ------------------------------------------------------------------- road

// The street in front of the diner (see STREET in utils/Constants.js): the
// diner's own pavement, a two-lane road sunk between kerbs, and the far
// pavement with shops facing back across the road.
const ROAD_LENGTH = STREET.halfLength * 2 + 12;
const BUS_STOP_X = 10;

function flat(w, d, material, [x, y, z]) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  return mesh;
}

function buildRoad(street) {
  const { roadY, kerbNearZ, kerbFarZ } = STREET;
  const roadWidth = kerbFarZ - kerbNearZ;
  const roadZ = (kerbNearZ + kerbFarZ) / 2;

  // Wet asphalt: low roughness so the skyline and the lamps reflect in it.
  const asphalt = pbr('asphalt_02', [ROAD_LENGTH / 4, roadWidth / 4], 0x1f2937, { color: 0x4b5563, roughness: 0.3, metalness: 0.2 });
  street.add(flat(ROAD_LENGTH, roadWidth, asphalt, [0, roadY, roadZ]));

  // Paving on both sides, out past where the buildings stand.
  const paving = (depth) => pbr('patterned_paving', [ROAD_LENGTH / 2.5, depth / 2.5], 0x6b6f78, { color: 0x8a8d96, roughness: 0.6 });
  street.add(flat(ROAD_LENGTH, 40, paving(40), [0, 0.004, kerbNearZ - 20]));
  street.add(flat(ROAD_LENGTH, 30, paving(30), [0, 0.004, kerbFarZ + 15]));

  // Kerbstones: the step from the pavements down to the road.
  const concrete = physical(0x6b6e76, { roughness: 0.85 });
  for (const [z, side] of [[kerbNearZ, -1], [kerbFarZ, 1]]) {
    const kerb = new THREE.Mesh(new THREE.BoxGeometry(ROAD_LENGTH, 0.02 - roadY, 0.3), concrete);
    kerb.position.set(0, (roadY + 0.02) / 2, z + side * 0.15);
    kerb.receiveShadow = true;
    street.add(kerb);
  }

  // Road markings: broken white centre line, yellow edge lines and a zebra
  // crossing, each colour merged into one mesh.
  const markY = roadY + 0.005;
  const strip = (w, d, x, z) => new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(x, markY, z);
  const dashes = [];
  for (let x = -ROAD_LENGTH / 2; x < ROAD_LENGTH / 2; x += 9) dashes.push(strip(3, 0.12, x, roadZ));
  const zebra = Array.from({ length: 7 }, (_, i) => strip(3, 0.5, -18, kerbNearZ + 0.6 + i));
  street.add(new THREE.Mesh(mergeGeometries([...dashes, ...zebra]), mat(0xe5e7eb, { roughness: 0.45 })));
  const edges = [kerbNearZ + 0.3, kerbFarZ - 0.3].map((z) => strip(ROAD_LENGTH, 0.1, 0, z));
  street.add(new THREE.Mesh(mergeGeometries(edges), mat(0xd4a017, { roughness: 0.45 })));

  // Rain puddles: glossy patches with soft edges that pick up the city's
  // reflections.
  const edge = canvasTexture('puddle-edge', 128, (ctx, size) => {
    const c = size / 2;
    const gradient = ctx.createRadialGradient(c, c, c * 0.35, c, c, c);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(1, '#000000');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }, [1, 1], THREE.NoColorSpace);
  const water = new THREE.MeshStandardMaterial({ color: 0x1c2029, roughness: 0.04, metalness: 0.6, alphaMap: edge, transparent: true, opacity: 0.85, depthWrite: false });
  const puddles = [
    [-6, roadY + 0.008, 9.6, 2.4, 1.1], [5, roadY + 0.008, 12.3, 1.8, 0.9], [15, roadY + 0.008, 7.9, 2.8, 1.2],
    [-26, roadY + 0.008, 11.2, 3, 1.3], [-3, 0.009, 15.9, 1.6, 0.8], [17, 0.009, 16.6, 2.2, 0.9], [-12, 0.009, 5.6, 1.6, 0.7],
  ];
  for (const [x, y, z, rx, rz] of puddles) {
    const puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 28), water);
    puddle.rotation.x = -Math.PI / 2;
    puddle.scale.set(rx, rz, 1);
    puddle.position.set(x, y, z);
    puddle.receiveShadow = true;
    street.add(puddle);
  }
}

// LED street lights on both pavements, arms reaching out over the road. Real
// point lights would cost every material in the scene, so their light on the
// road is an additive pool decal instead.
function buildStreetLights(street) {
  const height = 7;
  const spots = [
    ...[-45, -30, -15, 15, 30, 45].map((x) => ({ x, z: STREET.kerbNearZ - 0.45, toward: 1 })),
    ...[-40, -24, -8, 8, 24, 40].map((x) => ({ x, z: STREET.kerbFarZ + 0.45, toward: -1 })),
  ];
  const poles = [];
  const heads = [];
  for (const { x, z, toward } of spots) {
    poles.push(new THREE.CylinderGeometry(0.07, 0.11, height, 10).translate(x, height / 2, z));
    poles.push(new THREE.BoxGeometry(0.08, 0.08, 1.9).translate(x, height - 0.05, z + toward * 0.95));
    heads.push(new THREE.BoxGeometry(0.34, 0.1, 0.75).translate(x, height - 0.12, z + toward * 1.65));
    street.add(decal(poolMaterial(0xcfdcff, 0.28), [9, 7], [x, STREET.roadY + 0.012, z + toward * 2.6]));
    street.add(decal(poolMaterial(0xcfdcff, 0.25), [4, 3], [x, 0.014, z - toward * 0.6]));
  }
  const pole = new THREE.Mesh(mergeGeometries(poles), surfaces.darkSteel());
  pole.castShadow = true;
  street.add(pole);
  street.add(new THREE.Mesh(mergeGeometries(heads), mat(0x000000, { emissive: 0xe8efff, emissiveIntensity: 4 })));
}

// Glass bus shelter on the far pavement, with a lit advert for MegaMunch.
function buildBusStop(street, x) {
  const z = 17.7;
  const steel = surfaces.darkSteel();
  const pane = physical(0x9fb3c8, { roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.35 });
  for (const [dx, dz] of [[-1.9, -0.6], [1.9, -0.6], [-1.9, 0.6], [1.9, 0.6]]) street.add(box(0.08, 2.5, 0.08, steel, [x + dx, 1.25, z + dz]));
  street.add(box(4.2, 0.08, 1.6, pane, [x, 2.52, z]));
  street.add(box(3.8, 2.1, 0.03, pane, [x, 1.25, z + 0.6]));
  street.add(box(2.6, 0.06, 0.4, steel, [x + 0.3, 0.46, z + 0.35]));

  const advert = canvasTexture('ad-megamunch', 256, (ctx, size) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, size);
    gradient.addColorStop(0, '#ff7a18');
    gradient.addColorStop(1, '#b3001b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.ellipse(size / 2, size * 0.42, 70, 46, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7c2d12';
    ctx.fillRect(size / 2 - 72, size * 0.42 - 6, 144, 14);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = '900 40px "Segoe UI", sans-serif';
    ctx.fillText('MEGAMUNCH', size / 2, 52);
    ctx.font = '700 26px "Segoe UI", sans-serif';
    ctx.fillText('NOW OPEN 24/7', size / 2, size - 34);
  });
  const sign = new THREE.MeshStandardMaterial({ map: advert, emissive: 0xffffff, emissiveMap: advert, emissiveIntensity: 1.1, roughness: 0.3 });
  street.add(box(0.14, 1.9, 1.15, sign, [x - 2.0, 1.2, z]));
}

// -------------------------------------------------------------- skyline

// Towers rising behind the street buildings. Each is one box with a lit-window
// texture (most windows lit, since it is night), a rooftop plant room and a
// red aviation light. Some get a neon strip up the corner facing the street.
const TOWERS = [
  // Across the road, behind the shopfronts.
  { x: -52, z: 34, w: 12, d: 12, h: 38 },
  { x: -36, z: 40, w: 14, d: 14, h: 64, neon: 0xff2bd6 },
  { x: -18, z: 34, w: 12, d: 12, h: 46 },
  { x: 0, z: 44, w: 16, d: 16, h: 90, neon: 0x00f0ff },
  { x: 18, z: 36, w: 12, d: 12, h: 54 },
  { x: 36, z: 42, w: 14, d: 14, h: 72, neon: 0xff2bd6 },
  { x: 52, z: 32, w: 10, d: 10, h: 40 },
  // Behind the diner.
  { x: -46, z: -30, w: 12, d: 12, h: 56, neon: 0x00f0ff },
  { x: -26, z: -26, w: 14, d: 12, h: 44 },
  { x: -6, z: -34, w: 16, d: 14, h: 80, neon: 0xff2bd6 },
  { x: 14, z: -28, w: 12, d: 12, h: 42 },
  { x: 32, z: -36, w: 16, d: 16, h: 96, neon: 0x00f0ff },
  { x: 50, z: -24, w: 10, d: 10, h: 36 },
];
const WINDOW_COLORS = ['#ffd9a0', '#ffe8c2', '#ffcf87', '#bcd6ff', '#9fc0ff'];

// Lit-window walls: an 8 x 8 grid of windows as a colour map plus a matching
// emissive map holding only the lit ones (both drawn from the same seeded
// sequence). Cached per seed and window size, so blocks share materials.
const litMaterials = new Map();
function litMaterial(seed, [windowWidth, floorHeight], litChance) {
  const key = `${seed}-${windowWidth}-${floorHeight}-${litChance}`;
  if (litMaterials.has(key)) return litMaterials.get(key);
  const draw = (glow) => (ctx, size) => {
    const random = seeded(seed);
    const cell = size / 8;
    ctx.fillStyle = glow ? '#000000' : '#262a33';
    ctx.fillRect(0, 0, size, size);
    for (let row = 0; row < 8; row += 1) {
      for (let column = 0; column < 8; column += 1) {
        const lit = random() < litChance;
        const color = WINDOW_COLORS[Math.floor(random() * WINDOW_COLORS.length)];
        const blind = random() * 0.5; // part-drawn blinds
        const [x, y, w, h] = [column * cell + 5, row * cell + 6, cell - 10, cell * 0.62];
        ctx.fillStyle = lit ? color : glow ? '#000000' : '#0b0f16';
        ctx.fillRect(x, y, w, h);
        if (lit) {
          ctx.fillStyle = glow ? 'rgba(0,0,0,0.75)' : 'rgba(20,16,12,0.6)';
          ctx.fillRect(x, y, w, h * blind);
        }
        ctx.fillStyle = glow ? '#000000' : '#1a1d24';
        ctx.fillRect(x + w / 2 - 1, y, 2, h); // mullion
      }
    }
  };
  // UVs are in metres (see litBlock), so the repeat sets the window size.
  const repeat = [1 / (8 * windowWidth), 1 / (8 * floorHeight)];
  const map = canvasTexture(`windows-${key}`, 256, draw(false), repeat);
  const emissiveMap = canvasTexture(`windows-${key}-glow`, 256, draw(true), repeat);
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, map, emissive: 0xffffff, emissiveMap, emissiveIntensity: 1.3, roughness: 0.3, metalness: 0.4 });
  material.userData.shared = true;
  litMaterials.set(key, material);
  return material;
}

// A box with `walls` on its four sides and a plain roof. Its UVs are scaled
// to metres so windows keep the same size on every face.
function litBlock(w, h, d, walls, [x, y, z]) {
  const geometry = new THREE.BoxGeometry(w, h, d);
  const uv = geometry.attributes.uv;
  const across = [d, d, w, w, w, w]; // faces: +x, -x, +y, -y, +z, -z
  const up = [h, h, d, d, h, h];
  for (let i = 0; i < uv.count; i += 1) {
    const face = Math.floor(i / 4);
    uv.setXY(i, uv.getX(i) * across[face], uv.getY(i) * up[face]);
  }
  const roof = physical(0x1a1c22, { roughness: 0.8 });
  const mesh = new THREE.Mesh(geometry, [walls, walls, roof, roof, walls, walls]);
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  return mesh;
}

// Returns the aviation lights' shared material, so they can blink together.
function buildSkyline(street) {
  const beacon = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff1a1a, emissiveIntensity: 4 });
  const plant = physical(0x1a1c22, { roughness: 0.8 });
  TOWERS.forEach(({ x, z, w, d, h, neon }, index) => {
    // ~1.8 m windows on 3.4 m floors; five window patterns shared between towers.
    street.add(litBlock(w, h, d, litMaterial(1 + (index % 5), [1.8, 3.4], 0.62), [x, h / 2, z]));
    street.add(box(w * 0.55, 3, d * 0.55, plant, [x, h + 1.5, z]));
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), beacon);
    light.position.set(x, h + 3.4, z);
    street.add(light);
    if (neon) {
      const facing = z > 0 ? -1 : 1;
      street.add(box(0.3, h * 0.92, 0.3, mat(0x000000, { emissive: neon, emissiveIntensity: 2.6 }), [x - w / 2, h * 0.46, z + facing * (d / 2)]));
    }
  });
  return beacon;
}

// ------------------------------------------------------------- buildings

// Street buildings from the facade kit. Across the road they are turned round
// to face the diner, so each one runs from its origin towards -x.
const ACROSS = [
  { from: -37, modules: 7, floors: 5, seed: 21, tint: 0xa39e98 },
  { from: -15.5, modules: 5, floors: 7, seed: 23, tint: 0x8d96a3 },
  { from: 0.5, modules: 6, floors: 4, seed: 29, tint: 0xb3a596 },
  { from: 19.5, modules: 5, floors: 6, seed: 31, tint: 0x9aa0a8 },
];

function buildFacades(street) {
  const place = (options, position, rotationY) => {
    const facade = building(options);
    facade.position.set(...position);
    facade.rotation.y = rotationY;
    street.add(facade);
  };

  // Behind the diner, then its neighbours either side on this pavement.
  place({ modules: 12, floors: 4, seed: 3, tint: 0x9a9aa6 }, [-18, 0, -7.5], 0);
  place({ modules: 6, floors: 4, seed: 7, tint: 0xb7a79a }, [-27.6, 0, 2.0], 0);
  place({ modules: 6, floors: 5, seed: 11, tint: 0x8f9bab }, [9.6, 0, 2.0], 0);
  for (const { from, modules, ...options } of ACROSS) place({ modules, ...options }, [from + modules * MODULE, 0, STREET.facadeZ], Math.PI);

  // Cables strung over the road between the two rows.
  const wire = physical(0x0b0b0e, { roughness: 0.6 });
  [-22, -12, 13, 24].forEach((x, i) => {
    const y = 8.5 + (i % 3) * 1.2;
    street.add(cable(new THREE.Vector3(x, y, 2.4), new THREE.Vector3(x + (i % 2 ? 1.5 : -1), y + 0.8, STREET.facadeZ - 0.3), 1.4 + (i % 2) * 0.6, wire));
  });
}

// ------------------------------------------------------------------ street

// Builds the street around the diner: road, traffic, pavements with people,
// street lights, the skyline and (if the facade kit loaded) the buildings.
// Returns an update function.
export function buildNeonStreet(root) {
  const street = new THREE.Group();
  buildRoad(street);
  buildStreetLights(street);
  buildBusStop(street, BUS_STOP_X);
  const beacon = buildSkyline(street);
  if (assets.has('facadeKit')) buildFacades(street);

  // Coloured light spilling from the neighbours' signs onto the wet pavement.
  for (const [color, position] of [[0xff3df2, [-12, 4, 4]], [0x38f8ff, [12, 4, 4]]]) {
    const light = new THREE.PointLight(color, 12, 14, 2);
    light.position.set(...position);
    street.add(light);
  }

  const flickering = [];
  street.traverse((object) => {
    if (object.userData.flicker) flickering.push(object);
  });

  const traffic = buildTraffic(street);
  const pedestrians = buildPedestrians(street, BUS_STOP_X);
  const storm = buildLightning(street);
  root.add(street);

  return (dt, time) => {
    flickering.forEach((blade, index) => {
      const off = Math.sin(time * (13 + index * 3)) > 0.9 || Math.sin(time * 2.1 + index) > 0.97;
      blade.material.emissiveIntensity = off ? 0.3 : 2.2;
    });
    beacon.emissiveIntensity = time % 1.6 < 0.25 ? 4 : 0.15;
    traffic(dt);
    pedestrians(dt, time);
    storm(dt);
  };
}

// Lightning over the city every so often: a cold flicker of light across the
// whole scene, then the thunder rolls in a moment later (the further away the
// strike, the longer the gap), played by audio/AudioManager.js.
function buildLightning(street) {
  const flash = new THREE.HemisphereLight(0xdfe6ff, 0x404060, 0);
  street.add(flash);
  let timer = 10 + Math.random() * 10;
  let age = Infinity; // seconds since the last strike
  return (dt) => {
    timer -= dt;
    if (timer <= 0) {
      timer = 18 + Math.random() * 22;
      age = 0;
      events.emit('weather:thunder', { delay: 0.4 + Math.random() * 2.2 });
    }
    age += dt;
    // Two quick flickers, the second one brighter.
    flash.intensity = age < 0.07 ? 1.6 : age > 0.14 && age < 0.26 ? 2.6 * (1 - (age - 0.14) / 0.12) : 0;
  };
}
