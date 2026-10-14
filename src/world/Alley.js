import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mat, pbr } from '../graphics/Materials.js';

// Level 2's surroundings: a Tokyo side street (yokochō) at night. Narrow
// two-to-four storey buildings line the street behind the noodle bar, beside
// it and across the road, each with a lit shopfront, signs stacked up the
// facade (backlit lightboxes and vertical neon in Japanese), lit and dark
// windows and aircon units. Concrete utility poles carry sagging power lines
// and strings of red paper lanterns, vending machines glow beside the stall
// and the wet asphalt reflects it all.
//
// The gameplay cameras look down at ~30°, so the sky is never in view; what
// sells the place is everything from the pavement up to ~6 m.

const SHOP_NAMES = [
  'らーめん 一番', '居酒屋 たぬき', '焼き鳥', 'すし', 'カラオケ', '喫茶 ルナ',
  'ぎょうざ', 'スナック 夢', 'バー 月', 'たこ焼き', 'うどん そば', '酒場',
];
const VERTICAL_NAMES = ['ラーメン', '居酒屋', 'カラオケ', '焼き鳥', '寿司', 'スナック', '喫茶', 'バー', '餃子', '酒場', '薬', 'ホテル'];
const NEON_COLORS = ['#ff3d6e', '#ffb02e', '#c77dff', '#ff5a3c', '#38d8ff', '#ff4fd8', '#7dffb0', '#ffe14d'];
const WALLS = ['#5f646d', '#7d8189', '#4a4e57', '#8b8478', '#566070', '#6e675d', '#3f434c', '#9a958c'];
const NOREN = ['#1e2a5a', '#8b1a1a', '#efe9dc', '#2b2b2b', '#4a1d4f'];
const JP_FONT = '"Yu Gothic", "Meiryo", "MS Gothic", sans-serif';

function seeded(seed) {
  let state = (seed * 9301 + 49297) % 233280;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

// --------------------------------------------------------------- textures

// Non-square canvas textures, cached for the session (shared, so disposing a
// level leaves them alone). `draw(ctx, glow, w, h)` runs twice when a glow
// (emissive) version is wanted: glow=true should paint only what lights up.
const textures = new Map();
function canvasTextures(key, width, height, draw, withGlow = false) {
  if (!textures.has(key)) {
    const make = (glow) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      draw(canvas.getContext('2d'), glow, width, height);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      texture.userData.shared = true;
      return texture;
    };
    textures.set(key, { map: make(false), emissiveMap: withGlow ? make(true) : null });
  }
  return textures.get(key);
}

// A sign's face: a backlit lightbox (white with dark text) or neon on black.
export function signTexture(text, color, { vertical = false, lightbox = false } = {}) {
  const [w, h] = vertical ? [128, 512] : [512, 128];
  return canvasTextures(`alley-sign-${text}-${color}-${vertical}-${lightbox}`, w, h, (ctx) => {
    ctx.fillStyle = lightbox ? '#f4f1ea' : '#0b0810';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (lightbox) {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, vertical ? w : 18, vertical ? 18 : h); // coloured stripe
      ctx.fillStyle = '#1a1414';
    } else {
      ctx.shadowColor = color;
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = color;
      ctx.lineWidth = 5;
    }
    const chars = [...text];
    if (vertical) {
      const step = (h - 30) / chars.length;
      ctx.font = `800 ${Math.min(96, step * 0.92)}px ${JP_FONT}`;
      chars.forEach((char, index) => {
        const y = 22 + step * (index + 0.5);
        if (!lightbox) ctx.strokeText(char, w / 2, y);
        ctx.fillText(char, w / 2, y);
      });
    } else {
      ctx.font = `800 ${Math.min(84, (w - 60) / Math.max(chars.length, 3))}px ${JP_FONT}`;
      if (!lightbox) ctx.strokeText(text, w / 2, h / 2 + 4);
      ctx.fillText(text, w / 2, h / 2 + 4);
    }
    ctx.shadowBlur = 0;
    if (!lightbox) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.strokeRect(6, 6, w - 12, h - 12);
    }
  }).map;
}

const SHOP_HEIGHT = 3.4;
const FLOOR_HEIGHT = 3;

// The street face of a building: a shopfront on the ground floor (lit
// interior with a noren curtain, or a closed shutter) and rows of windows
// above, some lit warm or cool, some dark, some with curtains half drawn.
function facadeTextures(seed, width, height) {
  const rand = seeded(seed);
  const floors = Math.max(1, Math.floor((height - SHOP_HEIGHT) / FLOOR_HEIGHT));
  const perFloor = width < 4.5 ? 2 : 3;
  const windows = Array.from({ length: floors * perFloor }, () => ({
    lit: rand() < 0.5,
    warm: rand() < 0.65,
    curtain: rand() < 0.4,
  }));
  const shop = { shutter: rand() < 0.18, warm: rand() < 0.7, noren: NOREN[Math.floor(rand() * NOREN.length)] };
  const wall = WALLS[seed % WALLS.length];
  const w = 256;
  const h = Math.min(1024, Math.round((w * height) / width / 32) * 32);
  const px = w / width;
  const py = h / height;
  const yOf = (metres) => h - metres * py; // canvas y of a height above the pavement

  return canvasTextures(`alley-facade-${seed}-${width}-${height}`, w, h, (ctx, glow) => {
    ctx.fillStyle = glow ? '#000000' : wall;
    ctx.fillRect(0, 0, w, h);
    if (!glow) {
      // Tile seams and weathering streaks.
      const streak = seeded(seed + 7);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (let y = yOf(SHOP_HEIGHT); y > 0; y -= 10) ctx.fillRect(0, y, w, 1);
      for (let i = 0; i < 40; i += 1) {
        ctx.fillStyle = `rgba(0,0,0,${streak() * 0.1})`;
        ctx.fillRect(streak() * w, streak() * yOf(SHOP_HEIGHT), 2 + streak() * 5, 20 + streak() * 70);
      }
    }

    // Windows, floor by floor.
    for (let floor = 0; floor < floors; floor += 1) {
      const base = SHOP_HEIGHT + floor * FLOOR_HEIGHT;
      if (!glow) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(0, yOf(base) - 3, w, 4); // floor ledge
      }
      for (let i = 0; i < perFloor; i += 1) {
        const info = windows[floor * perFloor + i];
        const cell = w / perFloor;
        const x = i * cell + cell * 0.18;
        const ww = cell * 0.64;
        const top = yOf(base + 2.3);
        const wh = (2.3 - 0.8) * py;
        const light = info.warm ? '#ffd59a' : '#cfe0ff';
        if (glow) {
          ctx.fillStyle = info.lit ? light : '#000000';
        } else {
          ctx.fillStyle = '#2b2f37';
          ctx.fillRect(x - 3, top - 3, ww + 6, wh + 6); // frame
          ctx.fillStyle = info.lit ? light : '#151820';
        }
        ctx.fillRect(x, top, ww, wh);
        if (info.lit && info.curtain) {
          ctx.fillStyle = glow ? 'rgba(0,0,0,0.6)' : 'rgba(120,90,70,0.85)';
          ctx.fillRect(x, top, ww * 0.45, wh);
        }
        if (!glow) {
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.fillRect(x + ww / 2 - 1, top, 2, wh); // mullion
        }
      }
    }

    // Shopfront.
    const left = 0.3 * px;
    const right = w - 0.3 * px;
    const top = yOf(2.6);
    const bottom = h;
    if (shop.shutter) {
      ctx.fillStyle = glow ? '#000000' : '#8e9298';
      ctx.fillRect(left, top, right - left, bottom - top);
      if (!glow) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        for (let y = top; y < bottom; y += 6) ctx.fillRect(left, y, right - left, 1);
      }
    } else {
      const gradient = ctx.createLinearGradient(0, top, 0, bottom);
      gradient.addColorStop(0, shop.warm ? '#ffe6b8' : '#dff0ff');
      gradient.addColorStop(1, shop.warm ? '#a8612a' : '#4a6c99');
      ctx.fillStyle = gradient;
      ctx.fillRect(left, top, right - left, bottom - top);
      // Shelves and a silhouette inside.
      ctx.fillStyle = glow ? 'rgba(0,0,0,0.35)' : 'rgba(40,20,10,0.35)';
      for (let y = top + 0.9 * py; y < bottom - 0.4 * py; y += 0.45 * py) ctx.fillRect(left + 6, y, right - left - 12, 4);
      ctx.fillStyle = glow ? 'rgba(0,0,0,0.75)' : 'rgba(20,12,10,0.8)';
      ctx.beginPath();
      ctx.ellipse(left + (right - left) * 0.35, bottom - 0.75 * py, 0.18 * px, 0.75 * py, 0, 0, Math.PI * 2);
      ctx.fill();
      // Noren split curtain across the top of the doorway.
      const strips = 4;
      const stripWidth = (right - left) / strips;
      for (let i = 0; i < strips; i += 1) {
        ctx.fillStyle = glow ? 'rgba(0,0,0,0.85)' : shop.noren;
        ctx.fillRect(left + i * stripWidth + 2, top, stripWidth - 4, 0.75 * py);
      }
    }
    if (!glow) {
      ctx.fillStyle = '#22252b';
      ctx.fillRect(0, top - 6, w, 6); // lintel
      ctx.fillRect(0, top, left, bottom - top); // pillars
      ctx.fillRect(right, top, w - right, bottom - top);
    }
  }, true);
}

// Front of a drinks vending machine: lit display of cans and bottles in
// rows behind glass, a lit header and the coin/collection panel below.
function vendingTextures(body) {
  return canvasTextures(`alley-vending-${body}`, 256, 512, (ctx, glow, w, h) => {
    ctx.fillStyle = glow ? '#000000' : body;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = glow ? '#cfe6ff' : '#e8f4ff';
    ctx.fillRect(14, 14, w - 28, 40); // header
    ctx.fillStyle = glow ? '#f3f8ff' : '#f8fbff';
    ctx.fillRect(14, 64, w - 28, 260); // display
    const drinks = ['#d62828', '#1d4ed8', '#f59e0b', '#16a34a', '#7c3aed', '#0ea5e9', '#e11d48', '#a16207', '#111827'];
    for (let row = 0; row < 4; row += 1) {
      for (let i = 0; i < 6; i += 1) {
        ctx.fillStyle = drinks[(row * 6 + i * 5) % drinks.length];
        ctx.fillRect(24 + i * 37, 76 + row * 62, 22, 40);
        ctx.fillStyle = glow ? '#ffd54a' : '#fde047';
        ctx.fillRect(26 + i * 37, 120 + row * 62, 18, 6); // price buttons
      }
    }
    ctx.fillStyle = glow ? '#000000' : '#1f2937';
    ctx.fillRect(w - 70, 340, 50, 70); // coin panel
    ctx.fillRect(30, 430, w - 60, 52); // collection slot
    if (glow) {
      ctx.fillStyle = '#ff4040';
      ctx.fillRect(w - 62, 350, 34, 12); // little red price display
    }
  }, true);
}

// ---------------------------------------------------------------- pieces

function box(w, h, d, material, [x, y, z]) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  return mesh;
}

function signMesh(texture, width, height) {
  const material = new THREE.MeshStandardMaterial({ map: texture, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 1.6, roughness: 0.5 });
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
}

// One building, built facing +z with its front at local z = 0.
function building({ width, height, depth = 6, seed }, lanterns, flicker) {
  const rand = seeded(seed * 31 + 5);
  const group = new THREE.Group();
  const { map, emissiveMap } = facadeTextures(seed, width, height);
  const front = new THREE.MeshStandardMaterial({ map, emissive: 0xffffff, emissiveMap, emissiveIntensity: 0.9, roughness: 0.85 });
  const side = mat(new THREE.Color(WALLS[seed % WALLS.length]).multiplyScalar(0.7).getHex(), { roughness: 0.9 });
  const body = box(width, height, depth, [side, side, mat(0x1b1d22), side, front, side], [0, height / 2, -depth / 2]);
  group.add(body);

  // Sign band over the shop: a white lightbox or neon on black.
  const name = SHOP_NAMES[seed % SHOP_NAMES.length];
  const color = NEON_COLORS[seed % NEON_COLORS.length];
  const band = signMesh(signTexture(name, color, { lightbox: rand() < 0.55 }), width - 0.5, 0.62);
  band.position.set(0, 2.95, 0.06);
  group.add(band);

  // Signs stacked up the facade, as on any Tokyo side street.
  if (rand() < 0.7 && height > 6) {
    const second = signMesh(signTexture(SHOP_NAMES[(seed + 5) % SHOP_NAMES.length], NEON_COLORS[(seed + 3) % NEON_COLORS.length], { lightbox: rand() < 0.5 }), Math.min(width - 0.8, 3.2), 0.55);
    second.position.set((rand() - 0.5) * 0.6, SHOP_HEIGHT + 1.05, 0.06);
    group.add(second);
  }
  if (rand() < 0.75) {
    const signHeight = Math.min(4.6, height - SHOP_HEIGHT - 0.6);
    const vertical = signMesh(
      signTexture(VERTICAL_NAMES[seed % VERTICAL_NAMES.length], NEON_COLORS[(seed + 1) % NEON_COLORS.length], { vertical: true, lightbox: rand() < 0.3 }),
      0.62,
      signHeight
    );
    const edge = rand() < 0.5 ? -1 : 1;
    vertical.position.set(edge * (width / 2 - 0.45), SHOP_HEIGHT + 0.2 + signHeight / 2, 0.22);
    group.add(vertical);
    if (rand() < 0.4) flicker.push(vertical.material);
  }

  // Red paper lanterns either side of the door.
  if (rand() < 0.55) {
    for (const side of [-1, 1]) lanterns.push(new THREE.Vector3(side * (width / 2 - 0.55), 2.25, 0.35));
  }

  // Aircon units on the upper floors.
  const aircon = mat(0xb9bcc2, { roughness: 0.6 });
  for (let floor = 0; SHOP_HEIGHT + floor * FLOOR_HEIGHT + 1 < height; floor += 1) {
    if (rand() < 0.35) group.add(box(0.75, 0.55, 0.3, aircon, [(rand() - 0.5) * (width - 1.2), SHOP_HEIGHT + floor * FLOOR_HEIGHT + 0.5, 0.15]));
  }
  return group;
}

// A row of buildings along x, fronts at z = `z`, facing `facing` (±1 along z).
function buildRow(root, { from, to, z, facing, seed, heights }, lanterns, flicker) {
  const rand = seeded(seed);
  let x = from;
  let index = 0;
  while (x < to) {
    const width = 3.6 + Math.round(rand() * 4) * 0.6;
    const height = heights[0] + Math.round(rand() * (heights[1] - heights[0]));
    const local = [];
    const piece = building({ width, height, seed: seed + index * 3 }, local, flicker);
    piece.position.set(x + width / 2, 0, z);
    piece.rotation.y = facing > 0 ? 0 : Math.PI;
    piece.updateMatrixWorld(true);
    for (const point of local) lanterns.push(point.applyMatrix4(piece.matrixWorld));
    root.add(piece);
    x += width + 0.05;
    index += 1;
  }
}

// A column of buildings along z, fronts at x = `x`, facing `facing` (±1 along x).
function buildColumn(root, { from, to, x, facing, seed, heights }, lanterns, flicker) {
  const rand = seeded(seed);
  let z = from;
  let index = 0;
  while (z < to) {
    const width = 3.6 + Math.round(rand() * 3) * 0.6;
    const height = heights[0] + Math.round(rand() * (heights[1] - heights[0]));
    const local = [];
    const piece = building({ width, height, seed: seed + index * 3 }, local, flicker);
    piece.position.set(x, 0, z + width / 2);
    piece.rotation.y = facing > 0 ? Math.PI / 2 : -Math.PI / 2;
    piece.updateMatrixWorld(true);
    for (const point of local) lanterns.push(point.applyMatrix4(piece.matrixWorld));
    root.add(piece);
    z += width + 0.05;
    index += 1;
  }
}

function vendingMachine(body, [x, z], rotation = 0) {
  const { map, emissiveMap } = vendingTextures(body);
  const front = new THREE.MeshStandardMaterial({ map, emissive: 0xffffff, emissiveMap, emissiveIntensity: 1.1, roughness: 0.35 });
  const shell = mat(new THREE.Color(body).getHex(), { roughness: 0.4, metalness: 0.2 });
  const machine = box(1.0, 1.85, 0.75, [shell, shell, shell, shell, front, shell], [0, 0.925, 0]);
  machine.castShadow = true;
  const group = new THREE.Group();
  group.add(machine);
  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  return group;
}

// Concrete utility pole with crossarms; returns the points wires hang from.
function utilityPole(root, [x, z]) {
  const concrete = mat(0x8d8f93, { roughness: 0.85 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 8, 10), concrete);
  pole.position.set(x, 4, z);
  pole.castShadow = true;
  root.add(pole);
  const arm = mat(0x3a3d42, { roughness: 0.6 });
  root.add(box(1.7, 0.1, 0.1, arm, [x, 7.5, z]), box(1.2, 0.1, 0.1, arm, [x, 6.9, z]));
  return [-0.75, 0, 0.75].map((dx) => new THREE.Vector3(x + dx, 7.5, z)).concat([-0.5, 0.5].map((dx) => new THREE.Vector3(x + dx, 6.9, z)));
}

function wire(from, to, sag) {
  const mid = from.clone().lerp(to, 0.5);
  mid.y -= sag;
  return new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(from, mid, to), 20, 0.018, 4, false);
}

// --------------------------------------------------------------- street

export function buildTokyoStreet(root) {
  const lanterns = [];
  const flicker = [];

  // Wet asphalt with puddles that mirror the signs and lanterns.
  const asphalt = pbr('asphalt_02', [48, 48], 0x3a3d44, { color: 0xa4a8b2, roughness: 0.5 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), asphalt);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.003;
  ground.receiveShadow = true;
  root.add(ground);
  // Glossy and half see-through, so they read as wet patches, not holes.
  const puddle = new THREE.MeshStandardMaterial({ color: 0x9aa3b3, roughness: 0.06, metalness: 1, transparent: true, opacity: 0.45, depthWrite: false });
  const puddleGeometry = new THREE.CircleGeometry(1, 28);
  for (const [x, z, sx, sz, r] of [
    [-4.5, 6.2, 1.4, 0.7, 0.3], [3.2, 8.4, 2.0, 0.9, -0.2], [9.5, 5.8, 1.1, 0.6, 0.8], [-10.5, 9.6, 1.8, 0.8, 0.1],
    [0.8, 12.6, 1.3, 0.6, 0.5], [-3, -6.4, 1.6, 0.6, 0], [6.5, -6.6, 1.2, 0.5, 0.4], [13, 12, 1.5, 0.7, -0.4],
  ]) {
    const mesh = new THREE.Mesh(puddleGeometry, puddle);
    mesh.rotation.set(-Math.PI / 2, 0, r);
    mesh.scale.set(sx, sz, 1);
    mesh.position.set(x, 0.006, z);
    mesh.receiveShadow = true;
    root.add(mesh);
  }

  // 止まれ ("stop") painted on the road with its stop line, as at every
  // Japanese side-street junction.
  const marking = canvasTextures('alley-tomare', 128, 256, (ctx, glow, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(240,240,232,0.85)';
    ctx.font = `900 76px ${JP_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    [...'止まれ'].forEach((char, index) => {
      ctx.save();
      ctx.translate(w / 2, 46 + index * 80);
      ctx.scale(1.1, 1); // painted stretched, as road markings are
      ctx.fillText(char, 0, 0);
      ctx.restore();
    });
  }).map;
  const paint = new THREE.MeshStandardMaterial({ map: marking, transparent: true, roughness: 0.7, depthWrite: false });
  const tomare = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 3.0), paint);
  tomare.rotation.x = -Math.PI / 2;
  tomare.position.set(-5.5, 0.008, 10.2);
  root.add(tomare);
  const stopLine = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 0.3), mat(0xe8e8e0, { roughness: 0.7 }));
  stopLine.rotation.x = -Math.PI / 2;
  stopLine.position.set(-5.5, 0.008, 8.1);
  root.add(stopLine);

  // Buildings: a row behind the noodle bar (seen over its roof), a row
  // across the road (seen from behind the chef) and the two sides.
  buildRow(root, { from: -30, to: 30, z: -7.6, facing: 1, seed: 11, heights: [7, 12] }, lanterns, flicker);
  buildRow(root, { from: -32, to: 32, z: 18.5, facing: -1, seed: 47, heights: [7, 13] }, lanterns, flicker);
  buildColumn(root, { from: -7.5, to: 0.8, x: -10.2, facing: 1, seed: 83, heights: [6, 9] }, lanterns, flicker);
  buildColumn(root, { from: -7.5, to: 0.8, x: 10.2, facing: -1, seed: 97, heights: [6, 9] }, lanterns, flicker);

  // Vending machines beside the stall.
  root.add(vendingMachine('#c81e1e', [-8.45, 0.1]), vendingMachine('#f1f5f9', [-9.5, 0.1]), vendingMachine('#1d4ed8', [8.6, 0.1]));

  // Utility poles and the tangle of power lines between them.
  const wires = [];
  const behind = [-18, -6, 6, 18].map((x) => utilityPole(root, [x, -6.6]));
  const across = [-20, -8, 4, 16].map((x) => utilityPole(root, [x, 16.8]));
  for (const line of [behind, across]) {
    for (let i = 0; i + 1 < line.length; i += 1) {
      line[i].forEach((point, k) => wires.push(wire(point, line[i + 1][k], 0.45 + k * 0.08)));
    }
  }
  // Drops from the poles to the buildings.
  for (const [pole, toZ] of [[behind[1], -7.6], [behind[2], -7.6], [across[0], 18.5], [across[2], 18.5]]) {
    wires.push(wire(pole[3], new THREE.Vector3(pole[3].x + 1.5, 5.6, toZ), 0.3));
  }
  root.add(new THREE.Mesh(mergeGeometries(wires), mat(0x0d0e10, { roughness: 0.6 })));

  // Strings of red lanterns between the poles behind the stall (seen above
  // its roof) and across the road.
  for (const line of [behind, across]) {
    for (let i = 0; i + 1 < line.length; i += 1) {
      const a = new THREE.Vector3(line[i][0].x, 5.4, line[i][0].z);
      const b = new THREE.Vector3(line[i + 1][0].x, 5.4, line[i + 1][0].z);
      root.add(new THREE.Mesh(wire(a, b, 0.6), mat(0x0d0e10)));
      for (let t = 0.08; t < 0.95; t += 0.12) {
        const point = a.clone().lerp(b, t);
        point.y -= 0.6 * 4 * t * (1 - t) + 0.3;
        lanterns.push(point);
      }
    }
  }
  const lanternMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.2, 14, 10).scale(1, 1.35, 1),
    new THREE.MeshStandardMaterial({ color: 0xff2a1a, emissive: 0xff3a1e, emissiveIntensity: 1.8, roughness: 0.8 }),
    lanterns.length
  );
  const matrix = new THREE.Matrix4();
  lanterns.forEach((point, index) => lanternMesh.setMatrixAt(index, matrix.makeTranslation(point)));
  root.add(lanternMesh);

  // A few neon signs buzz and flicker.
  return (dt, time) => {
    flicker.forEach((material, index) => {
      const glitch = Math.sin(time * (17 + index * 3)) > 0.95 || Math.sin(time * (5.3 + index)) > 0.985;
      material.emissiveIntensity = glitch ? 0.3 : 1.6;
    });
  };
}

// A paper menu tag for the noodle bar's wall: a dish written top to bottom
// with its price in red at the foot, as hung in real izakaya.
export function menuTagTexture(text, price) {
  return canvasTextures(`alley-tag-${text}`, 96, 320, (ctx, glow, w, h) => {
    ctx.fillStyle = '#f3ead6';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(80,50,20,0.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.fillStyle = '#1b1410';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const chars = [...text];
    const step = Math.min(56, 220 / chars.length);
    ctx.font = `700 ${step * 0.9}px "Yu Mincho", "MS Mincho", ${JP_FONT}`;
    chars.forEach((char, index) => ctx.fillText(char, w / 2, 30 + step * (index + 0.5)));
    ctx.fillStyle = '#b91c1c';
    ctx.font = `700 26px ${JP_FONT}`;
    ctx.fillText(`¥${price}`, w / 2, h - 30);
  }).map;
}
