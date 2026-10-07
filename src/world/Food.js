import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTexture, mat, noiseNormalMap, physical, surfaces } from '../graphics/Materials.js';
import { createCookingMaterial, createLiquidMaterial } from '../graphics/Shaders.js';
import { ITEMS } from '../gameplay/Recipes.js';
import { assets } from '../utils/AssetLoader.js';

// Food models. Everything is roughly 5× real size so it reads from the overview
// camera. Each builder returns a group with userData.height (for stacking) and,
// where relevant, userData.cookMaterial / liquidMaterial.

const COOKING = {
  patty: { raw: 0xb24a52, cooked: 0x5c3322, burnt: 0x1a1210, marks: 1, roughness: [0.35, 0.62, 0.95] },
  pork: { raw: 0xeab0a6, cooked: 0xb87142, burnt: 0x2b1a12, marks: 1, roughness: [0.4, 0.5, 0.95] },
  potato: { raw: 0xf1e1b0, cooked: 0xdb9d36, burnt: 0x3c2410, marks: 0, roughness: [0.5, 0.55, 0.9] },
  noodles: { raw: 0xeadcae, cooked: 0xf2d67e, burnt: 0xcfc69c, marks: 0, roughness: [0.75, 0.3, 0.55] },
};

// ------------------------------------------------------------------ helpers

function hash3(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fade = (t) => t * t * (3 - 2 * t);
  const u = fade(x - xi), v = fade(y - yi), w = fade(z - zi);
  const lerp = (a, b, t) => a + (b - a) * t;
  const corner = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
  return lerp(
    lerp(lerp(corner(0, 0, 0), corner(1, 0, 0), u), lerp(corner(0, 1, 0), corner(1, 1, 0), u), v),
    lerp(lerp(corner(0, 0, 1), corner(1, 0, 1), u), lerp(corner(0, 1, 1), corner(1, 1, 1), u), v),
    w
  );
}

function mesh(geometry, material, position = [0, 0, 0]) {
  const result = new THREE.Mesh(geometry, material);
  result.position.set(...position);
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
}

function group(height, ...children) {
  const result = new THREE.Group();
  result.add(...children);
  result.userData.height = height;
  return result;
}

// Lathe from a bottom-to-top profile of [radius, y] pairs (outward-facing normals).
function lathe(points, segments = 48) {
  return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segments);
}

function cookable(type, build, options = {}) {
  const material = createCookingMaterial({ ...COOKING[type], ...options });
  const result = build(material);
  result.userData.cookMaterial = material;
  return result;
}

// Geometry and textures that never change are built once and shared.
const cache = new Map();
function cached(key, build) {
  if (!cache.has(key)) {
    const value = build();
    if (value.isBufferGeometry) value.userData.shared = true;
    cache.set(key, value);
  }
  return cache.get(key);
}

// --------------------------------------------------------------- textures

// Canvas-drawn food textures at 2x their original resolution (less blurry
// held up close), with every fixed-pixel detail (speckle size, line width,
// ring spacing) scaled by `unit` so the pattern itself looks identical, just
// sharper — only the raster resolution changes, not the design.
const crumbTexture = () =>
  canvasTexture('crumb', 512, (ctx, size) => {
    const unit = size / 256;
    const gradient = ctx.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, '#f6e7c4');
    gradient.addColorStop(0.85, '#eed8a8');
    gradient.addColorStop(1, '#c98f4a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 900 * unit * unit; i += 1) {
      ctx.fillStyle = `rgba(150,110,60,${Math.random() * 0.25})`;
      ctx.beginPath();
      ctx.ellipse(Math.random() * size, Math.random() * size, (Math.random() * 3 + 0.5) * unit, (Math.random() * 2 + 0.5) * unit, Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });

const leafTexture = () =>
  canvasTexture('lettuce', 512, (ctx, size) => {
    const unit = size / 256;
    const c = size / 2;
    const gradient = ctx.createRadialGradient(c, c, 4 * unit, c, c, c);
    gradient.addColorStop(0, '#e8f5b8');
    gradient.addColorStop(0.35, '#a8d86a');
    gradient.addColorStop(1, '#4f9a2f');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(235,250,200,0.55)';
    for (let i = 0; i < 22; i += 1) {
      const angle = (i / 22) * Math.PI * 2;
      ctx.lineWidth = (1 + Math.random() * 2) * unit;
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.quadraticCurveTo(c + Math.cos(angle + 0.3) * c * 0.5, c + Math.sin(angle + 0.3) * c * 0.5, c + Math.cos(angle) * c, c + Math.sin(angle) * c);
      ctx.stroke();
    }
  });

const noriTexture = () =>
  canvasTexture('nori', 512, (ctx, size) => {
    const unit = size / 256;
    ctx.fillStyle = '#16200f';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 3000 * unit * unit; i += 1) {
      ctx.fillStyle = `rgba(${40 + Math.random() * 40},${60 + Math.random() * 50},${30 + Math.random() * 20},${Math.random() * 0.4})`;
      ctx.fillRect(Math.random() * size, Math.random() * size, (Math.random() * 6 + 1) * unit, unit);
    }
  });

const chashuTexture = () =>
  canvasTexture('chashu', 512, (ctx, size) => {
    const unit = size / 256;
    const c = size / 2;
    ctx.fillStyle = '#f0c9b8';
    ctx.fillRect(0, 0, size, size);
    ctx.lineCap = 'round';
    for (let r = c; r > 6 * unit; r -= 11 * unit) {
      ctx.strokeStyle = (r / unit) % 22 < 11 ? '#fff4e6' : '#d98f7c';
      ctx.lineWidth = 7 * unit;
      ctx.beginPath();
      ctx.arc(c + (c - r) * 0.08, c, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = '#8a4a2a';
    ctx.lineWidth = 10 * unit;
    ctx.beginPath();
    ctx.arc(c, c, c - 5 * unit, 0, Math.PI * 2);
    ctx.stroke();
  });

const yolkTexture = () =>
  canvasTexture('yolk', 256, (ctx, size) => {
    const c = size / 2;
    const gradient = ctx.createRadialGradient(c, c, 2, c, c, c);
    gradient.addColorStop(0, '#c85a05');
    gradient.addColorStop(0.55, '#ee8f1a');
    gradient.addColorStop(0.8, '#f7b640');
    gradient.addColorStop(1, '#fbeed0');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  });

const strawTexture = () =>
  canvasTexture('straw', 64, (ctx, size) => {
    for (let i = 0; i < 8; i += 1) {
      ctx.fillStyle = i % 2 ? '#f8fafc' : '#e11d48';
      ctx.fillRect(0, (i * size) / 8, size, size / 8);
    }
  }, [1, 3]);

// ----------------------------------------------------------------- bun

// The scanned Poly Haven bun, sliced into a bottom and top half with a crumb face.
function bunHalves() {
  return cached('bun-halves', () => {
    const source = assets.node('buns', 'hamburger_buns_02');
    if (!source) return null;

    const geometry = source.geometry.clone();
    geometry.computeBoundingBox();
    const { min, max } = geometry.boundingBox;
    geometry.translate(-(min.x + max.x) / 2, -min.y, -(min.z + max.z) / 2);
    const height = max.y - min.y;
    const cut = height * 0.4;
    const scale = 0.6 / Math.max(max.x - min.x, max.z - min.z);

    let cutRadius = 0;
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i += 1) {
      if (Math.abs(position.getY(i) - cut) < height * 0.12) {
        cutRadius = Math.max(cutRadius, Math.hypot(position.getX(i), position.getZ(i)));
      }
    }

    const slice = (keepBottom) => {
      const half = geometry.clone();
      const p = half.attributes.position;
      for (let i = 0; i < p.count; i += 1) {
        const y = p.getY(i);
        p.setY(i, keepBottom ? Math.min(y, cut) : Math.max(y, cut) - cut);
      }
      half.scale(scale, scale, scale);
      half.userData.shared = true;
      return half;
    };

    const face = new THREE.CircleGeometry(cutRadius * scale * 0.98, 40);
    face.rotateX(-Math.PI / 2);
    face.userData.shared = true;

    return {
      bottom: slice(true),
      top: slice(false),
      face,
      material: source.material,
      bottomHeight: cut * scale,
      topHeight: (height - cut) * scale,
    };
  });
}

function buildBun() {
  const halves = bunHalves();
  const crumb = mat(0xffffff, { map: crumbTexture(), roughness: 0.95 });

  if (!halves) {
    // Procedural fallback if the scanned bun failed to load.
    const bottom = group(0.12, mesh(new THREE.CylinderGeometry(0.3, 0.29, 0.12, 32), physical(0xd99a4e, { roughness: 0.6 }), [0, 0.06, 0]));
    const dome = mesh(new THREE.SphereGeometry(0.31, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), physical(0xc9853c, { roughness: 0.5 }));
    dome.scale.y = 0.6;
    const top = group(0.19, dome);
    const result = group(0.33, bottom, top);
    top.position.y = 0.13;
    result.userData.bun = { bottom, top };
    return result;
  }

  const bottomFace = mesh(halves.face, crumb, [0, halves.bottomHeight + 0.002, 0]);
  const bottom = group(halves.bottomHeight, mesh(halves.bottom, halves.material), bottomFace);
  const topFace = mesh(halves.face, crumb, [0, 0.002, 0]);
  topFace.rotation.x = Math.PI;
  const top = group(halves.topHeight, mesh(halves.top, halves.material), topFace);
  top.position.y = halves.bottomHeight + 0.01;

  const result = group(halves.bottomHeight + halves.topHeight + 0.01, bottom, top);
  result.userData.bun = { bottom, top };
  return result;
}

// ------------------------------------------------------------- cookables

function pattyGeometry() {
  return cached('patty', () => {
    const r = 0.3;
    const h = 0.1;
    const points = [[0, 0], [0.6 * r, 0], [0.88 * r, 0.06 * h], [0.97 * r, 0.25 * h], [r, 0.5 * h], [0.97 * r, 0.74 * h], [0.9 * r, 0.9 * h]];
    for (let t = 0.8; t > 0; t -= 0.1) points.push([t * r, h * (0.97 + 0.03 * (1 - t))]);
    points.push([0, h]);
    const geometry = lathe(points, 56);
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
      const n = noise3(x * 10, y * 10, z * 10) - 0.5;
      const edge = 1 + n * 0.12 + (noise3(x * 3, 0, z * 3) - 0.5) * 0.1;
      position.setXYZ(i, x * edge, y > 0.001 ? y + n * 0.025 : 0, z * edge);
    }
    geometry.computeVertexNormals();
    return geometry;
  });
}

function buildPatty() {
  return cookable(
    'patty',
    (material) => group(0.1, mesh(pattyGeometry(), material)),
    { normalMap: noiseNormalMap('meat', { scale: 24, strength: 3 }), normalScale: new THREE.Vector2(0.8, 0.8) }
  );
}

function buildPork() {
  return cookable(
    'pork',
    (material) => {
      const geometry = cached('pork-slice', () => new THREE.CylinderGeometry(0.2, 0.2, 0.05, 40));
      const a = mesh(geometry, material, [-0.08, 0.025, 0]);
      const b = mesh(geometry, material, [0.1, 0.06, 0.05]);
      b.rotation.set(0.15, 0.4, 0.2);
      return group(0.09, a, b);
    },
    { map: chashuTexture(), normalMap: noiseNormalMap('meat', { scale: 24, strength: 3 }), normalScale: new THREE.Vector2(0.5, 0.5) }
  );
}

function buildFries() {
  const geometry = cached('fries', () => {
    const sticks = [];
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    for (let i = 0; i < 14; i += 1) {
      const stick = new THREE.BoxGeometry(0.05, 0.05, 0.3 + Math.random() * 0.08);
      quaternion.setFromEuler(new THREE.Euler((Math.random() - 0.5) * 0.4, Math.random() * Math.PI, (Math.random() - 0.5) * 0.3));
      matrix.compose(new THREE.Vector3((Math.random() - 0.5) * 0.22, 0.03 + (i % 3) * 0.04, (Math.random() - 0.5) * 0.22), quaternion, new THREE.Vector3(1, 1, 1));
      stick.applyMatrix4(matrix);
      sticks.push(stick);
    }
    return mergeGeometries(sticks);
  });
  return cookable('potato', (material) => group(0.14, mesh(geometry, material)), {
    normalMap: noiseNormalMap('potato', { scale: 16, strength: 1.5 }),
  });
}

function buildNoodles() {
  const geometry = cached('noodles', () => {
    const strands = [];
    for (let i = 0; i < 18; i += 1) {
      const points = [];
      const turns = 5 + Math.floor(Math.random() * 3);
      const phase = Math.random() * Math.PI * 2;
      for (let j = 0; j <= turns; j += 1) {
        const angle = phase + j * 1.4;
        const radius = 0.06 + Math.random() * 0.14;
        points.push(new THREE.Vector3(Math.cos(angle) * radius, 0.015 + Math.random() * 0.1, Math.sin(angle) * radius));
      }
      strands.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 40, 0.012, 5, false));
    }
    return mergeGeometries(strands);
  });
  return cookable('noodles', (material) => group(0.13, mesh(geometry, material)));
}

// ---------------------------------------------------------- fresh items

function buildLettuce() {
  const geometry = cached('lettuce', () => {
    const ring = new THREE.RingGeometry(0.01, 0.36, 72, 8);
    const position = ring.attributes.position;
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i), y = position.getY(i);
      const r = Math.hypot(x, y);
      const angle = Math.atan2(y, x);
      const t = r / 0.36;
      const wobble = 1 + (noise3(Math.cos(angle) * 2, Math.sin(angle) * 2, 0) - 0.5) * 0.25;
      const ruffle = Math.sin(angle * 13 + noise3(x * 8, y * 8, 1) * 4) * 0.03 * t * t;
      position.setXYZ(i, x * wobble, y * wobble, ruffle + t * t * 0.05);
    }
    ring.rotateX(-Math.PI / 2);
    ring.computeVertexNormals();
    return ring;
  });
  const material = physical(0xffffff, { map: leafTexture(), roughness: 0.45, side: THREE.DoubleSide, sheen: 0.4, sheenColor: 0xd9f99d });
  const a = mesh(geometry, material, [0, 0.01, 0]);
  const b = mesh(geometry, material, [0.03, 0.03, -0.02]);
  b.rotation.y = 1.9;
  b.scale.setScalar(0.85);
  return group(0.07, a, b);
}

function buildCheese() {
  const geometry = cached('cheese', () => {
    const slice = new THREE.BoxGeometry(0.5, 0.025, 0.5, 18, 1, 18);
    const position = slice.attributes.position;
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i), z = position.getZ(i);
      const d = Math.max(Math.abs(x), Math.abs(z));
      if (d > 0.16) position.setY(i, position.getY(i) - (d - 0.16) ** 2 * 2.4);
    }
    slice.rotateY(Math.PI / 4);
    slice.computeVertexNormals();
    return slice;
  });
  return group(0.03, mesh(geometry, physical(0xf2b12c, { roughness: 0.32, clearcoat: 0.25 }), [0, 0.015, 0]));
}

function buildEgg() {
  const white = mesh(
    cached('egg-shell', () => new THREE.SphereGeometry(0.12, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)),
    physical(0xd7a467, { roughness: 0.28, clearcoat: 0.6 })
  );
  white.scale.set(1, 0.9, 1.35);
  const face = mesh(cached('egg-face', () => new THREE.CircleGeometry(0.12, 40).rotateX(-Math.PI / 2)), physical(0xfaf6ec, { roughness: 0.3 }), [0, 0.001, 0]);
  face.scale.z = 1.35;
  const yolk = mesh(
    cached('egg-yolk', () => new THREE.SphereGeometry(0.07, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2)),
    physical(0xffffff, { map: yolkTexture(), roughness: 0.15, clearcoat: 1 }),
    [0, 0.001, 0]
  );
  yolk.scale.set(1, 0.3, 1.25);
  const egg = new THREE.Group();
  egg.add(white, face, yolk);
  egg.position.y = 0.108;
  return group(0.11, egg);
}

function buildNori() {
  const geometry = cached('nori', () => {
    const sheet = new THREE.PlaneGeometry(0.24, 0.32, 8, 8);
    const position = sheet.attributes.position;
    for (let i = 0; i < position.count; i += 1) position.setZ(i, position.getX(i) ** 2 * 0.9);
    sheet.computeVertexNormals();
    return sheet;
  });
  const sheet = mesh(
    geometry,
    physical(0xffffff, { map: noriTexture(), normalMap: noiseNormalMap('nori', { scale: 40, strength: 1 }), roughness: 0.6, side: THREE.DoubleSide }),
    [0, 0.16, -0.17]
  );
  sheet.rotation.x = -0.25;
  return group(0.02, sheet);
}

// --------------------------------------------------------------- liquids

function buildCup(type) {
  const { color, foam } = ITEMS[type].liquid;
  const glass = new THREE.Mesh(
    cached('cup-glass', () => lathe([[0, 0], [0.12, 0], [0.126, 0.012], [0.16, 0.42], [0.152, 0.42], [0.118, 0.022], [0, 0.022]], 40)),
    surfaces.glass()
  );
  glass.castShadow = true;

  const liquidMaterial = createLiquidMaterial({ color, foam, bottom: -0.19, top: 0.17 });
  const liquid = new THREE.Mesh(cached('cup-liquid', () => new THREE.CylinderGeometry(0.148, 0.114, 0.38, 32, 1, true)), liquidMaterial);
  liquid.position.y = 0.212;

  const ice = new THREE.Group();
  const cube = cached('ice', () => new THREE.BoxGeometry(0.075, 0.075, 0.075));
  const iceMaterial = physical(0xf0f9ff, { roughness: 0.12, transmission: 0.9, thickness: 0.04, ior: 1.31 });
  [[-0.05, 0.34, 0.03, 0.4], [0.05, 0.36, -0.03, 1.1], [0.0, 0.32, 0.06, 2.1]].forEach(([x, y, z, r]) => {
    const piece = new THREE.Mesh(cube, iceMaterial);
    piece.position.set(x, y, z);
    piece.rotation.set(r, r * 0.7, r * 0.3);
    ice.add(piece);
  });

  const straw = mesh(cached('straw', () => new THREE.CylinderGeometry(0.011, 0.011, 0.6, 10)), mat(0xffffff, { map: strawTexture(), roughness: 0.4 }), [0.05, 0.37, 0]);
  straw.rotation.z = -0.18;

  const result = group(0.42, liquid, glass, ice, straw);
  result.userData.liquidMaterial = liquidMaterial;
  result.userData.ice = ice;
  return result;
}

function buildBowl(type) {
  const { color, foam } = ITEMS[type].liquid;
  const bowl = mesh(
    cached('ramen-bowl', () =>
      lathe([[0, 0], [0.14, 0], [0.15, 0.03], [0.21, 0.05], [0.3, 0.12], [0.37, 0.23], [0.39, 0.3], [0.37, 0.3], [0.35, 0.235], [0.28, 0.14], [0.18, 0.075], [0, 0.065]], 48)
    ),
    surfaces.ceramic(0x1f1a1a)
  );
  const liquidMaterial = createLiquidMaterial({ color, foam, bottom: -0.1, top: 0.08 });
  const liquid = new THREE.Mesh(cached('bowl-liquid', () => new THREE.CylinderGeometry(0.345, 0.19, 0.2, 40, 1, true)), liquidMaterial);
  liquid.position.y = 0.165;
  const result = group(0.2, bowl, liquid);
  result.userData.liquidMaterial = liquidMaterial;
  result.userData.base = true; // other food sits in it
  return result;
}

// -------------------------------------------------------------- public

const BUILDERS = {
  bun: buildBun,
  patty: buildPatty,
  pork: buildPork,
  potato: buildFries,
  noodles: buildNoodles,
  lettuce: buildLettuce,
  cheese: buildCheese,
  egg: buildEgg,
  nori: buildNori,
};

export function createFoodMesh(type) {
  const liquid = ITEMS[type]?.liquid;
  if (liquid) return liquid.vessel === 'bowl' ? buildBowl(type) : buildCup(type);
  const builder = BUILDERS[type];
  if (!builder) throw new Error(`No model for item type: ${type}`);
  return builder();
}

export function createPlateMesh() {
  const plate = mesh(
    cached('plate', () => lathe([[0, 0], [0.3, 0], [0.32, 0.01], [0.42, 0.035], [0.47, 0.052], [0.462, 0.058], [0.41, 0.045], [0.31, 0.022], [0, 0.022]], 56)),
    surfaces.ceramic()
  );
  const result = group(0.022, plate);
  result.userData.baseHeight = 0.022;
  return result;
}
