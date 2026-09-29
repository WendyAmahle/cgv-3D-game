import * as THREE from 'three';
import { canvasTexture, mat, physical, surfaces, woodTexture } from '../graphics/Materials.js';
import { ITEMS } from '../gameplay/Recipes.js';
import { LAYOUT } from '../utils/Constants.js';
import { assets } from '../utils/AssetLoader.js';
import { createItemMesh } from './Models.js';

// Station meshes. Each builder returns a view:
//   root   — group placed on the counter (raycast target)
//   anchor — where items sit (gameplay parents items here)
//   label  — display name
//   parts  — named sub-objects effects may animate (parts.glow = heat material)

function box(w, h, d, material, [x, y, z] = [0, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  return mesh;
}

function cylinder(rTop, rBottom, h, material, [x, y, z] = [0, 0, 0], segments = 32, open = false) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments, 1, open), material);
  mesh.position.set(x, y, z);
  return mesh;
}

function view(label, anchorY, parts = {}) {
  const root = new THREE.Group();
  const anchor = new THREE.Object3D();
  anchor.position.y = anchorY;
  root.add(anchor);
  return { root, anchor, label, parts };
}

// A printed label stuck to the front of a station.
function labelPlate(text, { width = 0.42, background = '#f8fafc', color = '#111827', y = 0.1, z = 0.46 } = {}) {
  const texture = canvasTexture(`label-${text}-${background}-${color}`, 256, (ctx, size) => {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = color;
    ctx.font = `700 ${text.length > 8 ? 34 : 46}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, size / 2, size / 2);
  });
  texture.repeat.set(1, 0.3);
  texture.offset.set(0, 0.35);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(width, width * 0.3), physical(0xffffff, { map: texture, roughness: 0.4, clearcoat: 0.5 }));
  plate.position.set(0, y, z);
  return plate;
}

function knobs(count, width, y, z) {
  const group = new THREE.Group();
  for (let i = 0; i < count; i += 1) {
    const knob = cylinder(0.035, 0.04, 0.04, surfaces.castIron(), [(i - (count - 1) / 2) * (width / count), y, z], 20);
    knob.rotation.x = Math.PI / 2;
    group.add(knob);
  }
  return group;
}

const coalTexture = () =>
  canvasTexture('coals', 256, (ctx, size) => {
    ctx.fillStyle = '#120806';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 90; i += 1) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = 8 + Math.random() * 18;
      const gradient = ctx.createRadialGradient(x, y, 1, x, y, r);
      gradient.addColorStop(0, '#ffd28a');
      gradient.addColorStop(0.35, '#ff6a14');
      gradient.addColorStop(1, 'rgba(60,10,0,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });

const brandTexture = (text, color) =>
  canvasTexture(`brand-${text}-${color}`, 256, (ctx, size) => {
    const base = `#${new THREE.Color(color).getHexString()}`;
    const gradient = ctx.createLinearGradient(0, 0, 0, size);
    gradient.addColorStop(0, base);
    gradient.addColorStop(1, '#111111');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `italic 800 ${text.length > 6 ? 42 : 58}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, size / 2, size / 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(30, size * 0.68);
    ctx.quadraticCurveTo(size / 2, size * 0.78, size - 30, size * 0.64);
    ctx.stroke();
  });

const grateTexture = () =>
  canvasTexture('drip-grate', 128, (ctx, size) => {
    ctx.fillStyle = '#2b2f36';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#0b0c0e';
    for (let x = 6; x < size; x += 12) ctx.fillRect(x, 8, 5, size - 16);
  });

const BUILDERS = {
  crate(config) {
    const item = ITEMS[config.item];
    const result = view(`${item.label} Crate`, 0.36);
    const crate = assets.model('crate');
    if (crate) {
      crate.getObjectByName('wooden_crate_02_lid')?.removeFromParent();
      crate.rotation.y = Math.PI / 2;
      crate.scale.setScalar(0.86);
      result.root.add(crate);
    } else {
      result.root.add(box(1.0, 0.36, 0.5, mat(0xffffff, { map: woodTexture(0xb07a4a) }), [0, 0.18, 0]));
    }
    const spots = [[-0.26, 0.05], [0.02, -0.04], [0.28, 0.06]];
    for (const [x, z] of spots) {
      const sample = createItemMesh(config.item);
      sample.position.set(x, 0.28, z);
      sample.rotation.y = x * 4;
      sample.scale.setScalar(0.75);
      result.root.add(sample);
    }
    result.root.add(labelPlate(item.label.toUpperCase(), { background: '#e7d3a8', color: '#3b2412', y: 0.2, z: 0.235, width: 0.36 }));
    return result;
  },

  grill() {
    const glow = new THREE.MeshStandardMaterial({ color: 0x1a0a05, emissive: 0xffffff, emissiveMap: coalTexture(), emissiveIntensity: 0.25, roughness: 0.9 });
    const result = view('Grill', 0.4, { glow });
    const steel = surfaces.steel();
    result.root.add(box(1.1, 0.26, 0.9, steel, [0, 0.13, 0]));
    result.root.add(box(1.1, 0.3, 0.04, steel, [0, 0.4, -0.43])); // splash guard
    result.root.add(box(0.96, 0.02, 0.74, glow, [0, 0.27, 0]));
    const iron = surfaces.castIron();
    for (let i = 0; i < 9; i += 1) {
      const bar = cylinder(0.018, 0.018, 0.76, iron, [-0.42 + i * 0.105, 0.36, 0], 10);
      bar.rotation.x = Math.PI / 2;
      result.root.add(bar);
    }
    result.root.add(box(0.98, 0.03, 0.03, iron, [0, 0.36, 0.38]), box(0.98, 0.03, 0.03, iron, [0, 0.36, -0.38]));
    result.root.add(knobs(3, 0.6, 0.12, 0.47));
    result.root.add(labelPlate('GRILL', { background: '#1f2937', color: '#f8fafc', y: 0.21, z: 0.452 }));
    return result;
  },

  fryer() {
    const glow = physical(0x9a6212, { roughness: 0.04, clearcoat: 1, emissive: 0xff8a00, emissiveIntensity: 0.1 }).clone();
    glow.userData.shared = false;
    const result = view('Fryer', 0.47, { glow });
    const steel = surfaces.steel();
    result.root.add(box(1.0, 0.44, 0.84, steel, [0, 0.22, 0]));
    result.root.add(box(0.8, 0.02, 0.62, glow, [0, 0.44, 0]));
    // Wire basket.
    const wire = surfaces.chrome();
    const basket = new THREE.Group();
    for (let i = 0; i <= 6; i += 1) {
      const x = -0.3 + i * 0.1;
      const rib = cylinder(0.006, 0.006, 0.5, wire, [x, 0.5, 0], 6);
      rib.rotation.x = Math.PI / 2;
      basket.add(rib);
    }
    for (const z of [-0.25, 0.25]) {
      const rim = cylinder(0.008, 0.008, 0.62, wire, [0, 0.56, z], 6);
      rim.rotation.z = Math.PI / 2;
      basket.add(rim);
    }
    const handle = cylinder(0.02, 0.02, 0.34, surfaces.castIron(), [0, 0.62, 0.42], 10);
    handle.rotation.x = 1.1;
    basket.add(handle);
    result.root.add(basket);
    result.root.add(knobs(2, 0.4, 0.3, 0.43));
    result.root.add(labelPlate('FRYER', { background: '#1f2937', color: '#fcd34d', y: 0.14, z: 0.422 }));
    return result;
  },

  pot() {
    const glow = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: 0x3b82f6, emissiveIntensity: 0.25 });
    const result = view('Boiling Pot', 0.47, { glow });
    const steel = surfaces.steel();
    result.root.add(box(1.0, 0.16, 0.9, surfaces.darkSteel(), [0, 0.08, 0]));
    const flames = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.025, 8, 32), glow);
    flames.rotation.x = Math.PI / 2;
    flames.position.y = 0.17;
    result.root.add(flames);
    const pot = new THREE.Mesh(
      new THREE.LatheGeometry([[0, 0.18], [0.38, 0.18], [0.4, 0.2], [0.4, 0.6], [0.42, 0.62], [0.38, 0.62], [0.37, 0.2], [0, 0.2]].map(([x, y]) => new THREE.Vector2(x, y)), 40),
      steel
    );
    result.root.add(pot);
    const water = cylinder(0.37, 0.37, 0.01, physical(0x51646b, { roughness: 0.25, transparent: true, opacity: 0.75 }), [0, 0.45, 0], 40);
    result.root.add(water);
    result.parts.water = water;
    for (const side of [-1, 1]) {
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.014, 8, 16, Math.PI), steel);
      handle.position.set(side * 0.43, 0.55, 0);
      handle.rotation.set(0, side > 0 ? 0 : Math.PI, -Math.PI / 2);
      result.root.add(handle);
    }
    result.root.add(knobs(1, 0.2, 0.08, 0.46));
    return result;
  },

  dispenser(config) {
    const item = ITEMS[config.item];
    const isBowl = item.liquid.vessel === 'bowl';
    const result = view(isBowl ? `${item.label} Urn` : `${item.label} Dispenser`, 0.06);
    const steel = surfaces.steel();
    result.anchor.position.z = 0.12;

    // Drip tray.
    result.root.add(box(0.8, 0.05, 0.5, steel, [0, 0.025, 0.12]));
    result.root.add(box(0.76, 0.006, 0.46, mat(0xffffff, { map: grateTexture(), metalness: 0.6, roughness: 0.4 }), [0, 0.053, 0.12]));

    if (isBowl) {
      // Stock urn with a tap.
      result.root.add(cylinder(0.3, 0.3, 0.8, steel, [0, 0.5, -0.2], 40));
      result.root.add(cylinder(0.31, 0.31, 0.04, surfaces.darkSteel(), [0, 0.92, -0.2], 40));
      result.root.add(cylinder(0.05, 0.06, 0.08, surfaces.castIron(), [0, 0.96, -0.2], 16));
      const tap = cylinder(0.025, 0.025, 0.26, surfaces.chrome(), [0, 0.42, 0.02], 12);
      tap.rotation.x = Math.PI / 2;
      result.root.add(tap);
      result.root.add(cylinder(0.02, 0.02, 0.08, surfaces.chrome(), [0, 0.37, 0.14], 12));
      result.root.add(labelPlate(item.label.toUpperCase(), { background: '#7c2d12', color: '#fde68a', y: 0.7, z: 0.105, width: 0.34 }));
      return result;
    }

    // Soda fountain.
    const brand = new THREE.MeshStandardMaterial({ map: brandTexture(item.label.toUpperCase(), item.liquid.color), emissive: 0xffffff, emissiveMap: brandTexture(item.label.toUpperCase(), item.liquid.color), emissiveIntensity: 0.35, roughness: 0.3 });
    result.root.add(box(0.8, 1.05, 0.42, steel, [0, 0.55, -0.24]));
    result.root.add(box(0.8, 0.16, 0.32, steel, [0, 0.99, 0.1]));
    result.root.add(box(0.56, 0.5, 0.01, brand, [0, 0.62, -0.025]));
    result.root.add(cylinder(0.03, 0.022, 0.1, surfaces.chrome(), [0, 0.87, 0.14], 16));
    const lever = box(0.04, 0.16, 0.02, surfaces.castIron(), [0, 0.74, 0.2]);
    lever.rotation.x = -0.25;
    result.root.add(lever);
    return result;
  },

  board() {
    const result = view('Assembly Board', 0.09);
    const board = assets.model('cuttingBoard');
    if (board) {
      board.scale.setScalar(2.2);
      result.root.add(board);
    } else {
      result.root.add(box(1.0, 0.07, 0.55, mat(0xffffff, { map: woodTexture(0xc49a6c) }), [0, 0.035, 0]));
      result.anchor.position.y = 0.07;
    }
    return result;
  },

  trash() {
    const result = view('Bin', 0.95);
    const can = assets.model('trashCan');
    if (can) {
      // The model holds a clean and a rusty bin side by side; keep the clean one.
      const unwanted = [];
      can.traverse((object) => {
        if (object.isMesh && object.name.includes('rust')) unwanted.push(object);
      });
      unwanted.forEach((object) => object.removeFromParent());
      can.position.x = -0.5;
      const holder = new THREE.Group();
      holder.add(can);
      holder.scale.setScalar(1.05);
      result.root.add(holder);
    } else {
      result.root.add(cylinder(0.3, 0.26, 0.9, surfaces.darkSteel(), [0, 0.45, 0], 24));
    }
    return result;
  },
};

export function buildStationView(config, palette) {
  const builder = BUILDERS[config.type];
  if (!builder) throw new Error(`No station model for type: ${config.type}`);
  const result = builder(config, palette);

  if (config.type === 'trash') {
    // The bin stands on the floor in the aisle between the counters.
    result.root.position.set(config.x, 0, (LAYOUT.frontRowZ + LAYOUT.backRowZ) / 2);
  } else {
    const z = config.row === 'back' ? LAYOUT.backRowZ : LAYOUT.frontRowZ;
    result.root.position.set(config.x, LAYOUT.counterTopY, z);
  }

  result.root.name = `station-${config.type}`;
  result.root.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  return result;
}
