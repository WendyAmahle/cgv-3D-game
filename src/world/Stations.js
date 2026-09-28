import * as THREE from 'three';
import { mat, woodTexture } from '../graphics/Materials.js';
import { ITEMS } from '../gameplay/Recipes.js';
import { LAYOUT } from '../utils/Constants.js';
import { createItemMesh, createTextSprite } from './Models.js';

// Station meshes. Each builder returns a view:
//   root   — group placed on the counter (raycast target)
//   anchor — where items sit (gameplay parents items here)
//   label  — display name
//   parts  — named sub-objects effects may animate (e.g. parts.glow material)

function box(w, h, d, material, [x, y, z] = [0, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  return mesh;
}

function cylinder(rTop, rBottom, h, material, [x, y, z] = [0, 0, 0], segments = 24, open = false) {
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

function sign(text, y = 0.08) {
  const sprite = createTextSprite(text, { fontSize: 40, color: '#ffffff', background: 'rgba(15,23,42,0.75)', height: 0.2 });
  sprite.position.set(0, y, 0.5);
  return sprite;
}

const BUILDERS = {
  crate(config, palette) {
    const item = ITEMS[config.item];
    const result = view(`${item.label} Crate`, 0.36);
    const wood = mat(0xffffff, { map: woodTexture(palette.wood) });
    result.root.add(box(1.0, 0.34, 0.8, wood, [0, 0.17, 0]));
    result.root.add(box(0.92, 0.02, 0.72, mat(0x1f130a), [0, 0.345, 0]));
    for (const x of [-0.22, 0.22]) {
      const sample = createItemMesh(config.item);
      sample.position.set(x, 0.35, 0);
      sample.scale.setScalar(0.8);
      result.root.add(sample);
    }
    result.root.add(sign(item.label, 0.18));
    return result;
  },

  grill(config, palette) {
    const glow = new THREE.MeshStandardMaterial({ color: 0x3a1204, emissive: 0xff5a1f, emissiveIntensity: 0.25 });
    const result = view('Grill', 0.36, { glow });
    result.root.add(box(1.1, 0.26, 0.9, mat(0x2b2f36, { metalness: 0.6, roughness: 0.45 }), [0, 0.13, 0]));
    result.root.add(box(0.94, 0.02, 0.74, glow, [0, 0.27, 0]));
    const bar = mat(0x111111, { metalness: 0.8, roughness: 0.4 });
    for (let index = 0; index < 7; index += 1) {
      result.root.add(box(0.04, 0.04, 0.78, bar, [-0.39 + index * 0.13, 0.33, 0]));
    }
    result.root.add(sign('GRILL'));
    return result;
  },

  fryer(config, palette) {
    const glow = new THREE.MeshStandardMaterial({ color: 0xc58b1c, emissive: 0xffa31a, emissiveIntensity: 0.25, roughness: 0.2 });
    const result = view('Fryer', 0.44, { glow });
    const steel = mat(0xb8c1cc, { metalness: 0.8, roughness: 0.3 });
    result.root.add(box(1.0, 0.44, 0.8, steel, [0, 0.22, 0]));
    result.root.add(box(0.8, 0.02, 0.6, glow, [0, 0.43, 0]));
    const wire = mat(0x6b7280, { metalness: 0.9 });
    result.root.add(box(0.03, 0.03, 0.5, wire, [0, 0.62, -0.42]));
    result.root.add(box(0.03, 0.26, 0.03, wire, [0, 0.52, -0.3]));
    result.root.add(sign('FRYER', 0.26));
    return result;
  },

  pot(config, palette) {
    const glow = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, emissive: 0x3b82f6, emissiveIntensity: 0.25 });
    const result = view('Boiling Pot', 0.5, { glow });
    result.root.add(box(1.0, 0.18, 0.9, mat(0x2b2f36, { metalness: 0.5 }), [0, 0.09, 0]));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 8, 24), glow);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.19;
    result.root.add(ring);
    const steel = mat(0xcbd5e1, { metalness: 0.85, roughness: 0.25, side: THREE.DoubleSide });
    result.root.add(cylinder(0.4, 0.38, 0.42, steel, [0, 0.4, 0], 28, true));
    result.root.add(cylinder(0.38, 0.38, 0.02, steel, [0, 0.2, 0], 28));
    const water = cylinder(0.38, 0.38, 0.01, mat(0xa9cfe0, { roughness: 0.1, transparent: true, opacity: 0.85 }), [0, 0.5, 0], 28);
    result.root.add(water);
    result.parts.water = water;
    for (const side of [-1, 1]) result.root.add(box(0.16, 0.04, 0.06, steel, [side * 0.47, 0.54, 0]));
    result.root.add(sign('POT', 0.12));
    return result;
  },

  dispenser(config, palette) {
    const item = ITEMS[config.item];
    const isBowl = item.liquid.vessel === 'bowl';
    const result = view(isBowl ? `${item.label} Urn` : `${item.label} Dispenser`, 0.06);
    const body = mat(palette.machine ?? 0xe5e7eb, { metalness: 0.4, roughness: 0.35 });
    result.root.add(box(0.8, 0.02, 0.6, mat(0x374151, { metalness: 0.6 }), [0, 0.01, 0.12]));
    result.root.add(box(0.8, 1.1, 0.35, body, [0, 0.55, -0.22]));
    result.root.add(box(0.8, 0.14, 0.3, body, [0, 1.03, 0.08]));
    result.root.add(box(0.06, 0.08, 0.06, mat(0x6b7280, { metalness: 0.9 }), [0, 0.92, 0.12]));
    const panel = new THREE.MeshStandardMaterial({ color: item.liquid.color, emissive: item.liquid.color, emissiveIntensity: 0.6 });
    result.root.add(box(0.5, 0.35, 0.02, panel, [0, 0.6, -0.04]));
    result.anchor.position.z = 0.12;
    result.root.add(sign(item.label.toUpperCase(), 0.28));
    return result;
  },

  board(config, palette) {
    const result = view('Assembly Board', 0.06);
    result.root.add(box(1.1, 0.06, 0.85, mat(0xffffff, { map: woodTexture(0xc49a6c) }), [0, 0.03, 0]));
    result.root.add(sign('ASSEMBLE'));
    return result;
  },

  trash(config, palette) {
    const result = view('Bin', 0.6);
    result.root.add(cylinder(0.3, 0.26, 0.56, mat(0x3f3f46, { metalness: 0.5, roughness: 0.5 }), [0, 0.28, 0], 20));
    result.root.add(cylinder(0.33, 0.33, 0.04, mat(0x52525b, { metalness: 0.6 }), [0, 0.58, 0], 20));
    result.root.add(sign('BIN', 0.15));
    return result;
  },
};

export function buildStationView(config, palette) {
  const builder = BUILDERS[config.type];
  if (!builder) throw new Error(`No station model for type: ${config.type}`);
  const result = builder(config, palette);
  const z = config.row === 'back' ? LAYOUT.backRowZ : LAYOUT.frontRowZ;
  result.root.position.set(config.x, LAYOUT.counterTopY, z);
  result.root.name = `station-${config.type}`;
  result.root.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  return result;
}
