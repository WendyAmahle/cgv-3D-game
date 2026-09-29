import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { assets } from '../utils/AssetLoader.js';
import { canvasTexture, pbr, physical } from '../graphics/Materials.js';

// The Level 3 street: apartment buildings assembled from Poly Haven's modular
// facade kit (3 m wide, 3 m tall pieces), with lit and dark windows, neon-lit
// shopfronts on the ground floor, blade signs, aircon units and cables across
// the street. Each building's kit pieces are merged by material so a whole
// street costs only a few dozen draw calls.

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
      const light = random();
      const glass = light > 0.72 ? litWarm : light > 0.6 ? litCool : null;
      batch.add(`window_${style}_01`, at(x, y), (material) =>
        glass && material.name.includes('glass') ? glass : tinted(material)
      );
      batch.add('cornice_standard_standard_01', at(x, y - 0.1), tinted);
    }
  }
  const top = GROUND_FLOOR + floors * MODULE;
  for (let column = 0; column < modules; column += 1) batch.add('crown_standard_standard_01', at((column + 1) * MODULE, top), tinted);
  batch.build(group);

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

// ------------------------------------------------------------------ street

// Builds the street around the diner. Returns an update function (sign flicker)
// or null if the facade kit failed to load.
export function buildNeonStreet(root) {
  if (!assets.has('facadeKit')) return null;

  const street = new THREE.Group();
  const buildings = [];
  const place = (options, position, rotationY) => {
    const facade = building(options);
    facade.position.set(...position);
    facade.rotation.y = rotationY;
    street.add(facade);
    buildings.push(facade);
    return facade;
  };

  // Behind the diner, then both sides of the street facing inwards.
  place({ modules: 12, floors: 3, seed: 3, tint: 0x9a9aa6 }, [-18, 0, -7.5], 0);
  place({ modules: 8, floors: 3, seed: 7, tint: 0xb7a79a }, [-13, 0, 18], Math.PI / 2);
  place({ modules: 8, floors: 4, seed: 11, tint: 0x8f9bab }, [13, 0, -6], -Math.PI / 2);

  // Sidewalk kerbs along the side buildings.
  const concrete = physical(0x3a3d45, { roughness: 0.8 });
  for (const side of [-1, 1]) street.add(box(2.2, 0.15, 26, concrete, [side * 11.9, 0.075, 5]));

  // Cables strung across the street.
  const wire = physical(0x0b0b0e, { roughness: 0.6 });
  for (let i = 0; i < 5; i += 1) {
    const z = -2 + i * 4.2;
    const y = 8 + (i % 3) * 1.4;
    street.add(cable(new THREE.Vector3(-12.9, y, z), new THREE.Vector3(12.9, y + (i % 2 ? 0.8 : -0.6), z + 1), 1.2 + (i % 2) * 0.6, wire));
  }

  // Coloured light spilling from the signs onto the wet street.
  for (const [color, position] of [[0xff3df2, [-11, 4, 6]], [0x38f8ff, [11, 4, 3]]]) {
    const light = new THREE.PointLight(color, 12, 14, 2);
    light.position.set(...position);
    street.add(light);
  }

  root.add(street);

  const flickering = [];
  street.traverse((object) => {
    if (object.userData.flicker) flickering.push(object);
  });
  return (dt, time) => {
    flickering.forEach((blade, index) => {
      const off = Math.sin(time * (13 + index * 3)) > 0.9 || Math.sin(time * 2.1 + index) > 0.97;
      blade.material.emissiveIntensity = off ? 0.3 : 2.2;
    });
  };
}
