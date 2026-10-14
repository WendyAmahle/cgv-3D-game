import * as THREE from 'three';
import { canvasTexture, mat, physical, surfaces, woodTexture } from '../graphics/Materials.js';
import { ITEMS, SYRUPS, SYRUP_KEYS, cookAmount } from '../gameplay/Recipes.js';
import { createBoilMaterial, createPlumeMaterial } from '../graphics/Shaders.js';
import { LAYOUT } from '../utils/Constants.js';
import { assets } from '../utils/AssetLoader.js';
import { createItemMesh } from './Models.js';

// Station meshes. Each builder returns a view:
//   root   — group placed on the counter (raycast target)
//   anchor — where items sit (gameplay parents items here)
//   label  — display name
//   parts  — named sub-objects effects may animate (parts.glow = heat material,
//            parts.steam = the view's own steam, so Effects skips its column)
//   update — optional (dt, station) hook, called each frame by graphics/Effects.js
//            so a view can follow its station's gameplay state

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

// Magenta grid etched into the Laser Searer's plate (lit by parts.glow).
const laserGridTexture = () =>
  canvasTexture('laser-grid', 256, (ctx, size) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#ff3d8b';
    ctx.lineWidth = 3;
    for (let i = 16; i < size; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }
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

  // `label` (name in the HUD) and `plate` ({ text, background, color, width }
  // for the sign on the front) let a level dedicate the grill, e.g. Level 2's
  // chashu searing grill.
  grill(config) {
    const plate = { text: 'GRILL', background: '#1f2937', color: '#f8fafc', width: 0.42, ...config.plate };
    const glow = new THREE.MeshStandardMaterial({ color: 0x1a0a05, emissive: 0xffffff, emissiveMap: coalTexture(), emissiveIntensity: 0.25, roughness: 0.9 });
    const result = view(config.label ?? 'Grill', 0.4, { glow });
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
    result.root.add(labelPlate(plate.text, { background: plate.background, color: plate.color, width: plate.width, y: 0.21, z: 0.452 }));
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

  // `boil: true` (Level 2) swaps the flat water for the boiling-water shader
  // and adds a steam plume, both following the noodles' real cooking state.
  pot(config) {
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
    if (config.boil) addBoilingWater(result);
    else {
      const water = cylinder(0.37, 0.37, 0.01, physical(0x51646b, { roughness: 0.25, transparent: true, opacity: 0.75 }), [0, 0.45, 0], 40);
      result.root.add(water);
      result.parts.water = water;
    }
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

  // Level 3 Laser Searer: a glowing grid plate under a gantry. The laser head
  // slides along the crossbar, sweeping its beam across the steak.
  // Scene graph: root → base, grid plate (parts.glow), posts, crossbar,
  // head (parts.head) → lens, beam group (parts.beam: core, glow, hit spot)
  // and a point light (parts.light) that flashes the diner while it fires.
  laser() {
    const glow = new THREE.MeshStandardMaterial({ color: 0x0b0710, emissive: 0xffffff, emissiveMap: laserGridTexture(), emissiveIntensity: 0.25, roughness: 0.25, metalness: 0.4 });
    const result = view('Laser Searer', 0.27, { glow });
    const dark = surfaces.darkSteel();
    const chrome = surfaces.chrome();
    result.root.add(box(1.05, 0.24, 0.86, dark, [0, 0.12, 0]));
    result.root.add(box(0.9, 0.02, 0.7, glow, [0, 0.25, 0]));
    for (const x of [-0.49, 0.49]) result.root.add(box(0.06, 0.9, 0.06, chrome, [x, 0.7, 0]));
    result.root.add(box(1.04, 0.06, 0.08, chrome, [0, 1.15, 0]));

    const laserColor = 0xff3d8b;
    const head = new THREE.Group();
    head.position.y = 1.05;
    head.add(box(0.16, 0.14, 0.16, dark));
    head.add(cylinder(0.035, 0.045, 0.03, new THREE.MeshBasicMaterial({ color: laserColor, toneMapped: false }), [0, -0.08, 0], 16));

    // Beam from the lens (y −0.09 in the head) down to the plate (y −0.77).
    const beam = new THREE.Group();
    const length = 0.68;
    const additive = (opacity) => new THREE.MeshBasicMaterial({ color: laserColor, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    beam.add(cylinder(0.011, 0.011, length, new THREE.MeshBasicMaterial({ color: 0xffd6e8, toneMapped: false }), [0, -0.09 - length / 2, 0], 8));
    beam.add(cylinder(0.04, 0.04, length, additive(0.28), [0, -0.09 - length / 2, 0], 12, true));
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), additive(0.8));
    hit.position.y = -0.09 - length;
    beam.add(hit);
    beam.traverse((object) => (object.userData.noShadow = true));
    beam.visible = false;
    head.add(beam);

    const light = new THREE.PointLight(laserColor, 0, 4, 2);
    light.position.y = -0.6;
    head.add(light);
    result.root.add(head);

    result.root.add(labelPlate('LASER', { background: '#1f0b1a', color: '#ff7ab6', y: 0.13, z: 0.432 }));
    Object.assign(result.parts, { head, beam, light });
    return result;
  },

  // Level 3 Mixology Bar: three syrup taps over a rail the glass slides along,
  // and a magnetic stirrer under the middle tap that blends the drink.
  // Scene graph: root → back panel, tray, stirrer, and one group per tap
  // (canister, pipe, nozzle, ring light, pour stream). Each tap group is its own
  // click/keyboard target; the glass rides a carriage that is re-parented to
  // whichever tap it sits under, so clicking the glass picks that tap.
  mixer() {
    const result = view('Mixology Bar', 0.05);
    const steel = surfaces.steel();
    const dark = surfaces.darkSteel();
    const chrome = surfaces.chrome();
    const glassZ = 0.12;

    result.root.add(box(1.45, 0.05, 0.62, steel, [0, 0.025, 0]));
    result.root.add(box(1.4, 0.006, 0.56, mat(0xffffff, { map: grateTexture(), metalness: 0.6, roughness: 0.4 }), [0, 0.053, 0]));
    // Kept low so the crates on the back counter stay visible behind it.
    result.root.add(box(1.45, 0.62, 0.1, dark, [0, 0.31, -0.31]));
    result.root.add(labelPlate('MIXOLOGY', { width: 0.9, background: '#0b0b10', color: '#ff4fe0', y: 0.42, z: -0.255 }));

    const stirrer = new THREE.MeshStandardMaterial({ color: 0x0b0b10, emissive: 0x7c3aed, emissiveIntensity: 0.4, roughness: 0.3 });
    result.root.add(cylinder(0.14, 0.15, 0.02, stirrer, [0, 0.062, glassZ], 32));

    const taps = SYRUP_KEYS.map((syrup, index) => {
      const { label, color } = SYRUPS[syrup];
      const offset = (index - 1) * 0.45;
      const root = new THREE.Group();
      root.position.x = offset;
      root.name = `mixer-tap-${syrup}`;

      // Canister of glowing syrup on a pipe to the nozzle.
      root.add(cylinder(0.095, 0.095, 0.36, surfaces.glass(), [0, 0.96, -0.14], 24));
      const syrupMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: 1.1, roughness: 0.3 });
      root.add(cylinder(0.08, 0.08, 0.3, syrupMaterial, [0, 0.95, -0.14], 24));
      root.add(cylinder(0.1, 0.1, 0.03, dark, [0, 1.15, -0.14], 24), cylinder(0.1, 0.1, 0.03, dark, [0, 0.77, -0.14], 24));
      root.add(cylinder(0.016, 0.016, 0.1, chrome, [0, 0.71, -0.14], 10));
      const arm = cylinder(0.016, 0.016, 0.28, chrome, [0, 0.67, -0.01], 10);
      arm.rotation.x = Math.PI / 2;
      root.add(arm);
      root.add(cylinder(0.026, 0.018, 0.07, chrome, [0, 0.64, glassZ], 14));

      const light = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: 0.5 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.009, 8, 24), light);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 0.61, glassZ);
      root.add(ring);

      const stream = cylinder(0.011, 0.011, 0.54, new THREE.MeshBasicMaterial({ color }), [0, 0.34, glassZ], 8);
      stream.visible = false;
      root.add(stream);

      const hex = `#${new THREE.Color(color).getHexString()}`;
      root.add(labelPlate(label.toUpperCase(), { width: 0.3, background: hex, color: '#0b0b10', y: 0.74, z: -0.035 }));
      result.root.add(root);
      return { syrup, offset, root, light, stream };
    });

    const carriage = new THREE.Object3D();
    carriage.position.set(0, 0.075, glassZ);
    taps[1].root.add(carriage);
    Object.assign(result.parts, { taps, stirrer, carriage });
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

// Boiling water (vertex-displaced disc) and a steam plume for a pot view.
// uBoil, uStarch and the plume's uIntensity ease towards targets computed from
// the noodles' cook amount (0 raw → 1 cooked → 2 soggy), so nothing jumps.
function addBoilingWater(result) {
  const water = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.74, 40, 40), createBoilMaterial({ radius: 0.37 }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.45;
  const plumeGeometry = new THREE.PlaneGeometry(0.8, 1.7, 1, 12);
  plumeGeometry.translate(0, 0.85, 0); // grow upwards from the rim
  const plume = new THREE.Mesh(plumeGeometry, createPlumeMaterial());
  plume.position.y = 0.6;
  plume.frustumCulled = false; // the vertex shader moves it beyond its plane bounds
  plume.renderOrder = 1; // after the opaque food in the pot
  // Not clickable: the raycaster only knows the unturned plane, an invisible
  // card above the pot that would steal clicks meant for the crates behind it.
  plume.raycast = () => {};
  water.userData.noShadow = plume.userData.noShadow = true;
  result.root.add(water, plume);
  Object.assign(result.parts, { water, steam: plume });

  const boil = water.material.uniforms;
  const steam = plume.material.uniforms;
  let starch = 0;
  result.update = (dt, station) => {
    const item = station.item;
    const amount = item ? cookAmount(item.type, item.cookTime) : 0;
    const targetBoil = item ? (amount < 1 ? 0.6 + 0.4 * amount : 1 + (amount - 1) * 0.5) : 0.15;
    const targetSteam = item ? (amount < 1 ? 0.35 + 0.65 * amount : 1 + (amount - 1) * 0.4) : 0.15;
    const ease = Math.min(1, dt * 2);
    boil.uBoil.value += (targetBoil - boil.uBoil.value) * ease;
    steam.uIntensity.value += (targetSteam - steam.uIntensity.value) * ease;
    // Starch builds while noodles cook. Once they're taken out the water stays
    // cloudy (never frothy, that's only for soggy noodles in the pot) and slowly clears.
    const leftover = Math.max(0, Math.min(starch, 1) - dt * 0.08);
    starch = item ? Math.max(amount, leftover) : leftover;
    boil.uStarch.value = starch;
  };
}

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
      object.castShadow = !object.userData.noShadow; // light beams and the steam plume cast no shadow
      object.receiveShadow = true;
    }
  });
  return result;
}
